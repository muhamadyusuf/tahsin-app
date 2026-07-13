import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSelfOrStaff, getAuthUser, requireSelf } from "./authz";

// ── TASBIH ───────────────────────────────────────────────────────────────────

/**
 * Catat hasil tasbih ke agregat harian (per jenis dzikir). Dipanggil saat satu
 * putaran selesai (jumlah = target, putaran = 1) atau saat pengguna menyimpan
 * sisa hitungan (jumlah = sisa, putaran = 0). Selalu menambah (increment)
 * sehingga tidak menimpa hitungan sebelumnya di hari yang sama.
 */
export const recordTasbih = mutation({
  args: {
    userId: v.id("users"),
    tanggal: v.string(),
    dzikirId: v.string(),
    dzikirLabel: v.string(),
    jumlah: v.float64(),
    putaran: v.float64(),
  },
  handler: async (ctx, args) => {
    await requireSelf(ctx, args.userId);
    if (args.jumlah <= 0 && args.putaran <= 0) return null;

    const existing = await ctx.db
      .query("tasbih_harian")
      .withIndex("by_userId_tanggal_dzikir", (q) =>
        q
          .eq("userId", args.userId)
          .eq("tanggal", args.tanggal)
          .eq("dzikirId", args.dzikirId)
      )
      .unique();

    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        jumlah: existing.jumlah + args.jumlah,
        putaran: existing.putaran + args.putaran,
        dzikirLabel: args.dzikirLabel,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("tasbih_harian", {
      userId: args.userId,
      tanggal: args.tanggal,
      dzikirId: args.dzikirId,
      dzikirLabel: args.dzikirLabel,
      jumlah: args.jumlah,
      putaran: args.putaran,
      updatedAt: now,
    });
  },
});

/** Riwayat agregat tasbih (dibatasi ~1 tahun agregat harian). */
export const getTasbihHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    await assertSelfOrStaff(ctx, caller, args.userId);
    return await ctx.db
      .query("tasbih_harian")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(400);
  },
});

// ── DZIKIR (pagi/petang/setelah shalat/dll) ──────────────────────────────────

/**
 * Catat satu butir dzikir yang telah selesai dibaca. Di-dedup per
 * (user, tanggal, kategori, butir): jika sudah tercatat hari itu, tidak
 * menambah baris baru sehingga rekap tidak menggelembung.
 */
export const recordDzikirItem = mutation({
  args: {
    userId: v.id("users"),
    tanggal: v.string(),
    kategoriId: v.string(),
    kategoriLabel: v.string(),
    itemId: v.string(),
    itemJudul: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSelf(ctx, args.userId);
    const existing = await ctx.db
      .query("dzikir_selesai")
      .withIndex("by_userId_tanggal_kategori_item", (q) =>
        q
          .eq("userId", args.userId)
          .eq("tanggal", args.tanggal)
          .eq("kategoriId", args.kategoriId)
          .eq("itemId", args.itemId)
      )
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("dzikir_selesai", {
      userId: args.userId,
      tanggal: args.tanggal,
      kategoriId: args.kategoriId,
      kategoriLabel: args.kategoriLabel,
      itemId: args.itemId,
      itemJudul: args.itemJudul,
      completedAt: new Date().toISOString(),
    });
  },
});

/** Riwayat butir dzikir yang diselesaikan (dibatasi 600 baris terbaru). */
export const getDzikirHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    await assertSelfOrStaff(ctx, caller, args.userId);
    return await ctx.db
      .query("dzikir_selesai")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(600);
  },
});

/** Butir dzikir yang sudah diselesaikan pada satu tanggal (untuk menandai
 *  progres di layar dzikir agar tidak dobel hitung). */
export const getDzikirSelesaiByDate = query({
  args: { userId: v.id("users"), tanggal: v.string() },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    await assertSelfOrStaff(ctx, caller, args.userId);
    return await ctx.db
      .query("dzikir_selesai")
      .withIndex("by_userId_tanggal", (q) =>
        q.eq("userId", args.userId).eq("tanggal", args.tanggal)
      )
      .collect();
  },
});

// ── REKAP BULANAN ────────────────────────────────────────────────────────────
// `bulan` berformat "YYYY-MM". Rentang tanggal dibatasi lewat index sehingga
// hanya membaca dokumen bulan yang diminta.

export const getTasbihByMonth = query({
  args: { userId: v.id("users"), bulan: v.string() },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    await assertSelfOrStaff(ctx, caller, args.userId);
    return await ctx.db
      .query("tasbih_harian")
      .withIndex("by_userId_tanggal", (q) =>
        q
          .eq("userId", args.userId)
          .gte("tanggal", `${args.bulan}-01`)
          .lte("tanggal", `${args.bulan}-31`)
      )
      .collect();
  },
});

export const getDzikirByMonth = query({
  args: { userId: v.id("users"), bulan: v.string() },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    await assertSelfOrStaff(ctx, caller, args.userId);
    return await ctx.db
      .query("dzikir_selesai")
      .withIndex("by_userId_tanggal", (q) =>
        q
          .eq("userId", args.userId)
          .gte("tanggal", `${args.bulan}-01`)
          .lte("tanggal", `${args.bulan}-31`)
      )
      .collect();
  },
});

// ── TARGET HARIAN ────────────────────────────────────────────────────────────

export const getTarget = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return null;
    await assertSelfOrStaff(ctx, caller, args.userId);
    return await ctx.db
      .query("dzikir_target")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const setTarget = mutation({
  args: {
    userId: v.id("users"),
    tasbihTarget: v.float64(),
    dzikirKategori: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSelf(ctx, args.userId);
    const existing = await ctx.db
      .query("dzikir_target")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        tasbihTarget: args.tasbihTarget,
        dzikirKategori: args.dzikirKategori,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("dzikir_target", {
      userId: args.userId,
      tasbihTarget: args.tasbihTarget,
      dzikirKategori: args.dzikirKategori,
      updatedAt: now,
    });
  },
});
