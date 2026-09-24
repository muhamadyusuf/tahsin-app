// Perangkap (honeypot).
//
// Halaman umpan di aplikasi web (mis. /wp-admin, /phpmyadmin, /.env — lihat
// lib/trap-paths.ts) tidak pernah ditautkan dari aplikasi asli, jadi siapa pun
// yang membukanya hampir pasti sedang memindai atau mencoba menyusup. Setiap
// kunjungan dicatat sebagai `trap_hits`:
//
//   - IP        : diambil server dari header permintaan (http.ts → clientIp.ts).
//   - Lokasi    : perkiraan dari IP (geo-IP, di sini) + titik GPS presisi
//                 HANYA bila pengunjung menekan "Izinkan" pada dialog browser.
//   - Foto      : dari kamera HANYA bila pengunjung menekan "Izinkan" pada
//                 dialog browser. Halaman umpan menampilkan pemberitahuan bahwa
//                 akses dicatat. Tidak ada pengambilan diam-diam.
//   - Username  : yang diketik di form login umpan. Password tidak pernah
//                 dikirim ke server.
//
// Data hanya bisa dibaca administrator dan otomatis dihapus setelah
// RETENTION_DAYS hari (data pribadi — jangan simpan lebih lama dari perlu).
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  MutationCtx,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUser, isAdministrator, requireAdministrator } from "./authz";
import { isPrivateIp } from "./clientIp";
import { consumeRateLimit } from "./rateLimit";
import { cleanText } from "./sanitize";

export const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Batas pembuatan hit: per IP, dan global (cegah banjir data dari banyak IP).
const HIT_LIMIT_PER_IP = 40;
const HIT_LIMIT_GLOBAL = 600;
const HIT_WINDOW_MS = 60 * 60 * 1000;

const EVIDENCE_STATUSES = new Set(["granted", "denied", "unsupported", "error"]);

function randomToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

// ---------------------------------------------------------------------------
// Ditulis oleh endpoint HTTP publik (http.ts) — semuanya internal.
// ---------------------------------------------------------------------------

/** Catat kunjungan ke halaman umpan. null bila terkena rate limit. */
export const recordHit = internalMutation({
  args: {
    path: v.string(),
    ip: v.string(),
    forwardedFor: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    referrer: v.optional(v.string()),
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
    screen: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const okIp = await consumeRateLimit(
      ctx,
      `trap:ip:${args.ip}`,
      HIT_LIMIT_PER_IP,
      HIT_WINDOW_MS
    );
    if (!okIp) return null;
    const okGlobal = await consumeRateLimit(
      ctx,
      "trap:global",
      HIT_LIMIT_GLOBAL,
      HIT_WINDOW_MS
    );
    if (!okGlobal) return null;

    const token = randomToken();
    const hitId = await ctx.db.insert("trap_hits", {
      path: cleanText(args.path, 200) ?? "/",
      ip: args.ip,
      forwardedFor: cleanText(args.forwardedFor, 300),
      userAgent: cleanText(args.userAgent, 300),
      referrer: cleanText(args.referrer, 300),
      language: cleanText(args.language, 35),
      timezone: cleanText(args.timezone, 64),
      screen: cleanText(args.screen, 32),
      token,
      status: "baru",
    });

    if (args.ip !== "unknown" && !isPrivateIp(args.ip)) {
      await ctx.scheduler.runAfter(0, internal.trap.lookupGeoIp, {
        hitId,
        ip: args.ip,
      });
    }
    return { hitId, token };
  },
});

/** Cek kepemilikan token sebelum menerima unggahan foto besar. */
export const verifyToken = internalQuery({
  args: { hitId: v.id("trap_hits"), token: v.string() },
  handler: async (ctx, args) => {
    const hit = await ctx.db.get(args.hitId);
    if (!hit || hit.token !== args.token) return { ok: false, hasPhoto: false };
    return { ok: true, hasPhoto: hit.photoStorageId !== undefined };
  },
});

/** Bukti susulan dari halaman umpan: GPS, status izin, username percobaan. */
export const attachEvidence = internalMutation({
  args: {
    hitId: v.id("trap_hits"),
    token: v.string(),
    gps: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        accuracy: v.optional(v.number()),
      })
    ),
    gpsStatus: v.optional(v.string()),
    cameraStatus: v.optional(v.string()),
    attemptedUsername: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hit = await ctx.db.get(args.hitId);
    if (!hit || hit.token !== args.token) return false;

    const patch: Record<string, unknown> = {};
    if (args.gps) {
      const { latitude, longitude, accuracy } = args.gps;
      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      ) {
        patch.gps = {
          latitude,
          longitude,
          accuracy:
            accuracy !== undefined && Number.isFinite(accuracy) && accuracy >= 0
              ? accuracy
              : undefined,
        };
      }
    }
    if (args.gpsStatus && EVIDENCE_STATUSES.has(args.gpsStatus)) {
      patch.gpsStatus = args.gpsStatus;
    }
    // "granted" untuk kamera hanya di-set oleh attachPhoto (saat foto benar-benar ada).
    if (args.cameraStatus && args.cameraStatus !== "granted" && EVIDENCE_STATUSES.has(args.cameraStatus)) {
      patch.cameraStatus = args.cameraStatus;
    }
    const username = cleanText(args.attemptedUsername, 100);
    if (username) patch.attemptedUsername = username;

    if (Object.keys(patch).length > 0) await ctx.db.patch(hit._id, patch);
    return true;
  },
});

/** Tautkan foto yang sudah tersimpan di storage. false bila token salah / sudah ada foto. */
export const attachPhoto = internalMutation({
  args: {
    hitId: v.id("trap_hits"),
    token: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const hit = await ctx.db.get(args.hitId);
    if (!hit || hit.token !== args.token || hit.photoStorageId !== undefined) {
      await ctx.storage.delete(args.storageId);
      return false;
    }
    await ctx.db.patch(hit._id, {
      photoStorageId: args.storageId,
      cameraStatus: "granted",
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Geo-IP: perkiraan lokasi dari IP. Gagal = tidak fatal (hit tetap tersimpan).
// ---------------------------------------------------------------------------

export const setGeoIp = internalMutation({
  args: {
    hitId: v.id("trap_hits"),
    geoIp: v.object({
      country: v.optional(v.string()),
      region: v.optional(v.string()),
      city: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      isp: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const hit = await ctx.db.get(args.hitId);
    if (!hit) return;
    await ctx.db.patch(hit._id, { geoIp: args.geoIp });
  },
});

type GeoResult = {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
};

function toCoord(value: unknown, limit: number): number | undefined {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.warn(`Geo-IP: ${new URL(url).host} membalas HTTP ${res.status}`);
    return null;
  }
  const data: unknown = await res.json();
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

// Penyedia geo-IP gratis sering membatasi laju (HTTP 429) untuk IP cloud
// bersama, jadi dicoba berurutan: yang pertama memberi hasil dipakai.
const GEO_PROVIDERS: ((ip: string) => Promise<GeoResult | null>)[] = [
  async (ip) => {
    const d = await fetchJson(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`);
    if (!d) return null;
    return {
      country: cleanText(d.country, 80),
      region: cleanText(d.region, 80),
      city: cleanText(d.city, 80),
      latitude: toCoord(d.latitude, 90),
      longitude: toCoord(d.longitude, 180),
      isp: cleanText(d.organization_name ?? d.organization, 120),
    };
  },
  async (ip) => {
    const d = await fetchJson(`https://ipinfo.io/${encodeURIComponent(ip)}/json`);
    if (!d || d.bogon) return null;
    const [lat, lon] = typeof d.loc === "string" ? d.loc.split(",") : [];
    return {
      country: cleanText(d.country, 80),
      region: cleanText(d.region, 80),
      city: cleanText(d.city, 80),
      latitude: toCoord(lat, 90),
      longitude: toCoord(lon, 180),
      isp: cleanText(d.org, 120),
    };
  },
  async (ip) => {
    const d = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`);
    if (!d || d.success !== true) return null;
    const conn = (d.connection ?? {}) as Record<string, unknown>;
    return {
      country: cleanText(d.country, 80),
      region: cleanText(d.region, 80),
      city: cleanText(d.city, 80),
      latitude: toCoord(d.latitude, 90),
      longitude: toCoord(d.longitude, 180),
      isp: cleanText(conn.isp ?? conn.org, 120),
    };
  },
];

export const lookupGeoIp = internalAction({
  args: { hitId: v.id("trap_hits"), ip: v.string() },
  handler: async (ctx, args) => {
    for (const provider of GEO_PROVIDERS) {
      try {
        const geo = await provider(args.ip);
        if (geo && (geo.country || geo.city || geo.latitude !== undefined)) {
          await ctx.runMutation(internal.trap.setGeoIp, { hitId: args.hitId, geoIp: geo });
          return null;
        }
      } catch (err) {
        console.warn("Geo-IP: penyedia gagal:", err instanceof Error ? err.message : err);
      }
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Halaman admin — hanya administrator.
// ---------------------------------------------------------------------------

/** Hit terbaru (maks. 200) beserta URL foto. Token rahasia tidak ikut dikirim. */
export const listHits = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller || !isAdministrator(caller)) return [];
    const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 100)));
    const hits = await ctx.db.query("trap_hits").order("desc").take(limit);
    return await Promise.all(
      hits.map(async (hit) => {
        const { token: _token, photoStorageId, ...rest } = hit;
        return {
          ...rest,
          photoUrl: photoStorageId ? await ctx.storage.getUrl(photoStorageId) : null,
        };
      })
    );
  },
});

/** Jumlah hit berstatus "baru" (dibatasi 100) untuk lencana di dashboard. */
export const countNew = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthUser(ctx);
    if (!caller || !isAdministrator(caller)) return 0;
    const rows = await ctx.db
      .query("trap_hits")
      .withIndex("by_status", (q) => q.eq("status", "baru"))
      .take(100);
    return rows.length;
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("trap_hits"),
    status: v.union(v.literal("baru"), v.literal("ditinjau")),
  },
  handler: async (ctx, args) => {
    await requireAdministrator(ctx);
    const hit = await ctx.db.get(args.id);
    if (!hit) throw new Error("Catatan tidak ditemukan");
    await ctx.db.patch(args.id, { status: args.status });
  },
});

async function deleteHit(ctx: MutationCtx, hit: Doc<"trap_hits">) {
  if (hit.photoStorageId) await ctx.storage.delete(hit.photoStorageId);
  await ctx.db.delete(hit._id);
}

export const remove = mutation({
  args: { id: v.id("trap_hits") },
  handler: async (ctx, args) => {
    await requireAdministrator(ctx);
    const hit = await ctx.db.get(args.id);
    if (!hit) return;
    await deleteHit(ctx, hit);
  },
});

/** Hapus catatan lebih tua dari RETENTION_DAYS (dipanggil cron harian). */
export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;
    const old = await ctx.db
      .query("trap_hits")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(100);
    for (const hit of old) await deleteHit(ctx, hit);
    // Masih ada sisa? Lanjutkan di transaksi berikutnya.
    if (old.length === 100) {
      await ctx.scheduler.runAfter(0, internal.trap.purgeOld, {});
    }
    return old.length;
  },
});
