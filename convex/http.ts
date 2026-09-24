import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getSurahForPage, getJuzForPage } from "./quranPages";
import { extractClientIp } from "./clientIp";
import { cleanText, isIsoDate } from "./sanitize";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

// Batas permintaan per IP untuk endpoint perangkat IoT.
const IOT_LIMIT = 120;
const IOT_WINDOW_MS = 60_000;

/**
 * API key perangkat: header `X-API-Key` / `Authorization: Bearer` lebih
 * disukai (tidak tercatat di log URL); query `?apiKey=` tetap didukung agar
 * firmware lama tidak putus.
 */
function readApiKey(req: Request, fallback?: string | null): string | null {
  const header = req.headers.get("x-api-key");
  if (header) return header;
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return fallback ?? null;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * IoT device reports that its physical page counter moved to `page`.
 * POST body: { apiKey: string, page: number, tanggal?: "YYYY-MM-DD" }
 * Logs the read against the device owner's tilawah harian (deduped per day)
 * and updates the shared reading position.
 */
http.route({
  path: "/iot/page-read",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const { ip } = extractClientIp(req.headers);
    const allowed = await ctx.runMutation(internal.rateLimit.consume, {
      key: `iot:${ip}`,
      limit: IOT_LIMIT,
      windowMs: IOT_WINDOW_MS,
    });
    if (!allowed) return json({ error: "rate_limited" }, 429);

    let body: { apiKey?: string; page?: number; tanggal?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const apiKey = readApiKey(req, typeof body.apiKey === "string" ? body.apiKey : null);
    if (!apiKey || apiKey.length > 200) {
      return json({ error: "missing_api_key" }, 401);
    }
    if (
      typeof body.page !== "number" ||
      !Number.isFinite(body.page) ||
      body.page < 1 ||
      body.page > 604
    ) {
      return json({ error: "invalid_page" }, 400);
    }
    if (body.tanggal !== undefined && (typeof body.tanggal !== "string" || !isIsoDate(body.tanggal))) {
      return json({ error: "invalid_tanggal" }, 400);
    }

    const device = await ctx.runQuery(internal.iotDevices.getDeviceByApiKey, {
      apiKey,
    });
    if (!device) {
      return json({ error: "unauthorized" }, 401);
    }

    const page = Math.round(body.page);
    const { surahNumber, surahName } = getSurahForPage(page);
    const juz = getJuzForPage(page);
    const tanggal = body.tanggal ?? todayISO();

    const result = await ctx.runMutation(internal.mushafProgress.recordPageReadInternal, {
      userId: device.userId,
      page,
      surahNumber,
      surahName,
      juz,
      tanggal,
      source: "iot",
    });
    await ctx.runMutation(internal.iotDevices.touchDevice, { id: device._id });

    return json({ ok: true, page, surahNumber, surahName, juz, duplicate: result.duplicate });
  }),
});

/**
 * IoT device polls for the user's current reading position (e.g. to move a
 * physical indicator to the last page read in the app).
 * GET /iot/position?apiKey=...
 */
http.route({
  path: "/iot/position",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const { ip } = extractClientIp(req.headers);
    const allowed = await ctx.runMutation(internal.rateLimit.consume, {
      key: `iot:${ip}`,
      limit: IOT_LIMIT,
      windowMs: IOT_WINDOW_MS,
    });
    if (!allowed) return json({ error: "rate_limited" }, 429);

    const apiKey = readApiKey(req, new URL(req.url).searchParams.get("apiKey"));
    if (!apiKey || apiKey.length > 200) {
      return json({ error: "missing_api_key" }, 401);
    }

    const device = await ctx.runQuery(internal.iotDevices.getDeviceByApiKey, { apiKey });
    if (!device) {
      return json({ error: "unauthorized" }, 401);
    }
    await ctx.runMutation(internal.iotDevices.touchDevice, { id: device._id });

    const position = await ctx.runQuery(
      internal.mushafProgress.getReadingPositionInternal,
      { userId: device.userId }
    );
    return json({ position });
  }),
});

// ---------------------------------------------------------------------------
// Perangkap (honeypot) — endpoint publik yang dipanggil halaman umpan di web.
// Lihat convex/trap.ts untuk model data & kebijakan. Semua endpoint dibatasi
// (rate limit, ukuran, tipe file) karena bisa dipanggil siapa saja.
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function corsJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const MAX_TRAP_JSON_CHARS = 4096;
const MAX_TRAP_PHOTO_BYTES = 500_000;

/** Jenis gambar dari magic bytes (jangan percaya header Content-Type klien). */
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > MAX_TRAP_JSON_CHARS) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

for (const path of ["/trap/hit", "/trap/evidence", "/trap/photo"]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
  });
}

/**
 * Halaman umpan melaporkan kunjungan. IP diambil dari header permintaan —
 * bukan dari body — sehingga tidak bisa dipalsukan lewat payload.
 * POST { path, referrer?, language?, timezone?, screen? } → { hitId, token }
 */
http.route({
  path: "/trap/hit",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await readJsonBody(req);
    if (!body) return corsJson({ error: "invalid_body" }, 400);
    const path = cleanText(body.path, 200);
    if (!path || !path.startsWith("/")) return corsJson({ error: "invalid_path" }, 400);

    const { ip, forwardedFor } = extractClientIp(req.headers);
    const result = await ctx.runMutation(internal.trap.recordHit, {
      path,
      ip,
      forwardedFor,
      userAgent: cleanText(req.headers.get("user-agent"), 300),
      referrer: cleanText(body.referrer, 300),
      language: cleanText(body.language, 35),
      timezone: cleanText(body.timezone, 64),
      screen: cleanText(body.screen, 32),
    });
    if (!result) return corsJson({ error: "rate_limited" }, 429);
    return corsJson(result);
  }),
});

/**
 * Bukti susulan: titik GPS (hanya bila pengunjung mengizinkan), status izin,
 * dan username yang dicoba. Password TIDAK dikirim.
 * POST { hitId, token, gps?, gpsStatus?, cameraStatus?, attemptedUsername? }
 */
http.route({
  path: "/trap/evidence",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const { ip } = extractClientIp(req.headers);
    const allowed = await ctx.runMutation(internal.rateLimit.consume, {
      key: `trap:evidence:${ip}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!allowed) return corsJson({ error: "rate_limited" }, 429);

    const body = await readJsonBody(req);
    if (!body || typeof body.hitId !== "string" || typeof body.token !== "string") {
      return corsJson({ error: "invalid_body" }, 400);
    }

    const gps = body.gps as { latitude?: unknown; longitude?: unknown; accuracy?: unknown } | undefined;
    try {
      const ok = await ctx.runMutation(internal.trap.attachEvidence, {
        hitId: body.hitId as Id<"trap_hits">,
        token: body.token,
        gps:
          gps && typeof gps.latitude === "number" && typeof gps.longitude === "number"
            ? {
                latitude: gps.latitude,
                longitude: gps.longitude,
                accuracy: typeof gps.accuracy === "number" ? gps.accuracy : undefined,
              }
            : undefined,
        gpsStatus: typeof body.gpsStatus === "string" ? body.gpsStatus : undefined,
        cameraStatus: typeof body.cameraStatus === "string" ? body.cameraStatus : undefined,
        attemptedUsername:
          typeof body.attemptedUsername === "string" ? body.attemptedUsername : undefined,
      });
      return corsJson({ ok }, ok ? 200 : 403);
    } catch {
      // hitId bukan ID valid → validator Convex menolak.
      return corsJson({ error: "invalid_hit" }, 400);
    }
  }),
});

/**
 * Foto dari kamera (hanya ada bila pengunjung mengizinkan kamera).
 * POST /trap/photo?hitId=...&token=...  body: bytes JPEG/PNG/WebP ≤ 500 KB.
 * Satu foto per hit.
 */
http.route({
  path: "/trap/photo",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const { ip } = extractClientIp(req.headers);
    const allowed = await ctx.runMutation(internal.rateLimit.consume, {
      key: `trap:photo:${ip}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!allowed) return corsJson({ error: "rate_limited" }, 429);

    const url = new URL(req.url);
    const hitId = url.searchParams.get("hitId");
    const token = url.searchParams.get("token");
    if (!hitId || !token) return corsJson({ error: "invalid_body" }, 400);

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_TRAP_PHOTO_BYTES) return corsJson({ error: "too_large" }, 413);

    // Periksa token SEBELUM menyimpan apa pun ke storage.
    let check: { ok: boolean; hasPhoto: boolean };
    try {
      check = await ctx.runQuery(internal.trap.verifyToken, {
        hitId: hitId as Id<"trap_hits">,
        token,
      });
    } catch {
      return corsJson({ error: "invalid_hit" }, 400);
    }
    if (!check.ok) return corsJson({ error: "forbidden" }, 403);
    if (check.hasPhoto) return corsJson({ error: "already_has_photo" }, 409);

    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_TRAP_PHOTO_BYTES) {
      return corsJson({ error: "too_large" }, 413);
    }
    const type = sniffImageType(bytes);
    if (!type) return corsJson({ error: "unsupported_type" }, 415);

    const storageId = await ctx.storage.store(new Blob([bytes], { type }));
    const ok = await ctx.runMutation(internal.trap.attachPhoto, {
      hitId: hitId as Id<"trap_hits">,
      token,
      storageId,
    });
    return corsJson({ ok }, ok ? 200 : 409);
  }),
});

export default http;
