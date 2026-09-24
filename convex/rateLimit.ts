// Rate limiter jendela-tetap (fixed window) berbasis tabel `rate_limits`.
//
// Dipakai untuk melindungi endpoint publik (HTTP perangkap, endpoint IoT) dan
// action berbiaya (Ngaji AI) dari penyalahgunaan. Sengaja sederhana: satu baris
// per key, di-reset saat jendela lewat. Baris basi dibersihkan cron (crons.ts).
import { internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Catat satu percobaan untuk `key`. Mengembalikan true bila masih di bawah
 * batas `limit` dalam jendela `windowMs`, false bila sudah melewatinya.
 */
export async function consumeRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const row = await ctx.db
    .query("rate_limits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!row || now - row.windowStart >= windowMs) {
    if (row) {
      await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    } else {
      await ctx.db.insert("rate_limits", { key, windowStart: now, count: 1 });
    }
    return true;
  }

  if (row.count >= limit) return false;
  await ctx.db.patch(row._id, { count: row.count + 1 });
  return true;
}

export const consume = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    return await consumeRateLimit(ctx, args.key.slice(0, 200), args.limit, args.windowMs);
  },
});

/** Hapus baris rate limit yang jendelanya sudah lewat > 1 hari. */
export const purgeStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const stale = await ctx.db
      .query("rate_limits")
      .withIndex("by_windowStart", (q) => q.lt("windowStart", cutoff))
      .take(200);
    for (const row of stale) await ctx.db.delete(row._id);
    return stale.length;
  },
});
