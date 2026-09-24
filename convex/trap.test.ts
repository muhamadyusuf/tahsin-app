/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { extractClientIp, isPrivateIp, isValidIp } from "./clientIp";
import { assertImageUrl, assertHttpsUrl, cleanText, isIsoDate } from "./sanitize";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
type T = ReturnType<typeof convexTest>;

async function seedUsers(t: T) {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkId: "clerk_admin",
      name: "Admin",
      email: "admin@example.com",
      role: "administrator",
      isActive: true,
    });
    await ctx.db.insert("users", {
      clerkId: "clerk_santri",
      name: "Santri",
      email: "santri@example.com",
      role: "santri",
      isActive: true,
    });
  });
}

const XFF = { "x-forwarded-for": "203.0.113.9", "user-agent": "curl/8.0" };

async function postHit(
  t: T,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = XFF
) {
  return await t.fetch("/trap/hit", {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "/wp-admin", language: "id-ID", timezone: "Asia/Jakarta", ...extra }),
  });
}

// JPEG minimal: magic bytes FF D8 FF + isi.
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0]);

describe("clientIp", () => {
  test("mengambil IP publik paling kanan dari X-Forwarded-For (kiri bisa dipalsukan)", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" });
    expect(extractClientIp(h).ip).toBe("203.0.113.9");
  });

  test("melewati IP privat di sisi kanan (hop internal)", () => {
    const h = new Headers({ "x-forwarded-for": "198.51.100.20, 10.0.0.5" });
    expect(extractClientIp(h).ip).toBe("198.51.100.20");
  });

  test("abaikan entri sampah; jatuh ke x-real-ip lalu 'unknown'", () => {
    expect(extractClientIp(new Headers({ "x-forwarded-for": "<script>", "x-real-ip": "198.51.100.1" })).ip).toBe("198.51.100.1");
    expect(extractClientIp(new Headers()).ip).toBe("unknown");
  });

  test("validasi & klasifikasi IP", () => {
    expect(isValidIp("256.1.1.1")).toBe(false);
    expect(isValidIp("2001:db8::1")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("172.20.0.1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("::1")).toBe(true);
  });
});

describe("sanitize", () => {
  test("URL: hanya https; data URI hanya gambar raster", () => {
    expect(() => assertHttpsUrl("javascript:alert(1)", "u")).toThrow();
    expect(() => assertHttpsUrl("http://x.test", "u")).toThrow();
    expect(() => assertHttpsUrl("//x.test", "u")).toThrow();
    expect(assertHttpsUrl("https://x.test/a.pdf", "u")).toBe("https://x.test/a.pdf");
    expect(assertHttpsUrl("", "u")).toBe("");
    expect(() => assertImageUrl("data:text/html;base64,PHNjcmlwdD4=", "g")).toThrow();
    expect(() => assertImageUrl("data:image/svg+xml;base64,PHN2Zz4=", "g")).toThrow();
    expect(assertImageUrl("data:image/png;base64,iVBORw0KGgo=", "g")).toBeTruthy();
  });

  test("cleanText membuang karakter kontrol & memotong", () => {
    expect(cleanText("a\u0000b\nc", 10)).toBe("a b c");
    expect(cleanText("x".repeat(500), 20)).toHaveLength(20);
    expect(cleanText(123, 10)).toBeUndefined();
  });

  test("isIsoDate menolak tanggal kalender yang mustahil", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
  });
});

describe("perangkap — alur HTTP", () => {
  test("hit mencatat IP dari header (bukan dari body) dan mengembalikan token", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);
    const res = await postHit(t, { ip: "6.6.6.6" }); // 'ip' di body harus diabaikan
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const { hitId, token } = await res.json();
    expect(hitId).toBeTruthy();
    expect(token).toHaveLength(64);

    const hits = await t.withIdentity({ subject: "clerk_admin" }).query(api.trap.listHits, {});
    expect(hits).toHaveLength(1);
    expect(hits[0].ip).toBe("203.0.113.9");
    expect(hits[0].path).toBe("/wp-admin");
    expect(hits[0].userAgent).toBe("curl/8.0");
    expect(hits[0]).not.toHaveProperty("token"); // rahasia tidak bocor ke admin UI
  });

  test("hanya administrator yang bisa membaca / mengubah / menghapus catatan", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);
    await postHit(t);
    const santri = t.withIdentity({ subject: "clerk_santri" });
    expect(await santri.query(api.trap.listHits, {})).toEqual([]);
    expect(await t.query(api.trap.listHits, {})).toEqual([]);
    expect(await santri.query(api.trap.countNew, {})).toBe(0);

    const admin = t.withIdentity({ subject: "clerk_admin" });
    const [hit] = await admin.query(api.trap.listHits, {});
    await expect(santri.mutation(api.trap.setStatus, { id: hit._id, status: "ditinjau" })).rejects.toThrow();
    await expect(santri.mutation(api.trap.remove, { id: hit._id })).rejects.toThrow();

    expect(await admin.query(api.trap.countNew, {})).toBe(1);
    await admin.mutation(api.trap.setStatus, { id: hit._id, status: "ditinjau" });
    expect(await admin.query(api.trap.countNew, {})).toBe(0);
    await admin.mutation(api.trap.remove, { id: hit._id });
    expect(await admin.query(api.trap.listHits, {})).toEqual([]);
  });

  test("evidence: GPS + username tersimpan; token salah ditolak; password tidak punya jalur masuk", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);
    const { hitId, token } = await (await postHit(t)).json();

    const bad = await t.fetch("/trap/evidence", {
      method: "POST",
      headers: XFF,
      body: JSON.stringify({ hitId, token: "salah", gpsStatus: "granted" }),
    });
    expect(bad.status).toBe(403);

    const ok = await t.fetch("/trap/evidence", {
      method: "POST",
      headers: XFF,
      body: JSON.stringify({
        hitId,
        token,
        gps: { latitude: -6.2884, longitude: 106.7129, accuracy: 25 },
        gpsStatus: "granted",
        attemptedUsername: "root",
        password: "hunter2", // field asing — tidak boleh tersimpan di mana pun
      }),
    });
    expect(ok.status).toBe(200);

    const [hit] = await t.withIdentity({ subject: "clerk_admin" }).query(api.trap.listHits, {});
    expect(hit.gps).toEqual({ latitude: -6.2884, longitude: 106.7129, accuracy: 25 });
    expect(hit.gpsStatus).toBe("granted");
    expect(hit.attemptedUsername).toBe("root");
    expect(JSON.stringify(hit)).not.toContain("hunter2");
  });

  test("evidence: koordinat di luar rentang diabaikan; hitId ngawur → 400", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);
    const { hitId, token } = await (await postHit(t)).json();
    await t.fetch("/trap/evidence", {
      method: "POST",
      headers: XFF,
      body: JSON.stringify({ hitId, token, gps: { latitude: 999, longitude: 999 } }),
    });
    const [hit] = await t.withIdentity({ subject: "clerk_admin" }).query(api.trap.listHits, {});
    expect(hit.gps).toBeUndefined();

    const junk = await t.fetch("/trap/evidence", {
      method: "POST",
      headers: XFF,
      body: JSON.stringify({ hitId: "bukan-id", token }),
    });
    expect(junk.status).toBe(400);
  });

  test("foto: JPEG valid tersimpan & terlihat admin; file bukan gambar / token salah / kedua kali ditolak", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);
    const { hitId, token } = await (await postHit(t)).json();
    const photoUrl = (h: string, tk: string) => `/trap/photo?hitId=${h}&token=${tk}`;

    // Bukan gambar (mis. HTML/script) → 415, tidak disimpan.
    const html = await t.fetch(photoUrl(hitId, token), {
      method: "POST",
      headers: XFF,
      body: new TextEncoder().encode("<script>alert(1)</script>"),
    });
    expect(html.status).toBe(415);

    // Token salah → 403.
    const forbidden = await t.fetch(photoUrl(hitId, "salah"), {
      method: "POST",
      headers: XFF,
      body: jpeg(),
    });
    expect(forbidden.status).toBe(403);

    // Terlalu besar → 413.
    const big = await t.fetch(photoUrl(hitId, token), {
      method: "POST",
      headers: XFF,
      body: new Uint8Array(600_000).fill(0xff),
    });
    expect(big.status).toBe(413);

    // JPEG sah → 200.
    const ok = await t.fetch(photoUrl(hitId, token), { method: "POST", headers: XFF, body: jpeg() });
    expect(ok.status).toBe(200);

    const [hit] = await t.withIdentity({ subject: "clerk_admin" }).query(api.trap.listHits, {});
    expect(hit.photoUrl).toBeTruthy();
    expect(hit.cameraStatus).toBe("granted");

    // Satu foto per hit.
    const again = await t.fetch(photoUrl(hitId, token), { method: "POST", headers: XFF, body: jpeg() });
    expect(again.status).toBe(409);
  });

  test("hapus catatan ikut menghapus fotonya dari storage", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);
    const { hitId, token } = await (await postHit(t)).json();
    await t.fetch(`/trap/photo?hitId=${hitId}&token=${token}`, { method: "POST", headers: XFF, body: jpeg() });
    const admin = t.withIdentity({ subject: "clerk_admin" });
    const [hit] = await admin.query(api.trap.listHits, {});
    await admin.mutation(api.trap.remove, { id: hit._id });
    const files = await t.run(async (ctx) => ctx.db.system.query("_storage").collect());
    expect(files).toHaveLength(0);
  });

  test("rate limit per IP: hit ke-41 dalam sejam ditolak (429)", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);
    let last = 200;
    for (let i = 0; i < 41; i++) {
      last = (await postHit(t)).status;
    }
    expect(last).toBe(429);
    // IP lain tidak terpengaruh.
    const other = await postHit(t, {}, { "x-forwarded-for": "203.0.113.77" });
    expect(other.status).toBe(200);
  });

  test("body tidak valid / path bukan '/…' ditolak; preflight CORS berjalan", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);
    expect((await t.fetch("/trap/hit", { method: "POST", headers: XFF, body: "bukan json" })).status).toBe(400);
    expect((await postHit(t, { path: "javascript:alert(1)" })).status).toBe(400);
    expect((await t.fetch("/trap/hit", { method: "POST", headers: XFF, body: "x".repeat(5000) })).status).toBe(400);
    const pre = await t.fetch("/trap/hit", { method: "OPTIONS" });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
