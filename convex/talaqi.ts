import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const nilaiValues = v.union(
  v.literal(6),
  v.literal(6.5),
  v.literal(7),
  v.literal(7.5),
  v.literal(8),
  v.literal(8.5),
  v.literal(9),
  v.literal(9.5),
  v.literal(10)
);

// Create talaqi session (ustadz input)
export const create = mutation({
  args: {
    userId: v.id("users"),
    ustadzId: v.id("users"),
    adminPengajianId: v.optional(v.id("admin_pengajian")),
    tanggal: v.string(),
    presensi: v.boolean(),
    type: v.union(
      v.literal("tahsin"),
      v.literal("murojaah"),
      v.literal("tahfidz")
    ),
    materiId: v.optional(v.id("materi")),
    subMateriId: v.optional(v.id("materi")),
    suratNumber: v.optional(v.float64()),
    suratName: v.optional(v.string()),
    juz: v.optional(v.float64()),
    nilai: v.optional(nilaiValues),
    catatan: v.optional(v.string()),
    kelasId: v.optional(v.id("kelas")),
    kelasPertemuanId: v.optional(v.id("kelas_pertemuan")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("talaqi", args);
  },
});

// Create-or-update a santri's attendance/grade record for a specific
// pertemuan. Called repeatedly by the ustadz grading screen — patches the
// existing row instead of duplicating it.
export const upsertForPertemuan = mutation({
  args: {
    userId: v.id("users"),
    ustadzId: v.id("users"),
    adminPengajianId: v.optional(v.id("admin_pengajian")),
    kelasId: v.id("kelas"),
    kelasPertemuanId: v.id("kelas_pertemuan"),
    tanggal: v.string(),
    presensi: v.boolean(),
    type: v.union(
      v.literal("tahsin"),
      v.literal("murojaah"),
      v.literal("tahfidz")
    ),
    materiId: v.optional(v.id("materi")),
    subMateriId: v.optional(v.id("materi")),
    suratNumber: v.optional(v.float64()),
    suratName: v.optional(v.string()),
    juz: v.optional(v.float64()),
    nilai: v.optional(nilaiValues),
    catatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("talaqi")
      .withIndex("by_kelasPertemuanId_userId", (q) =>
        q.eq("kelasPertemuanId", args.kelasPertemuanId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("talaqi", args);
  },
});

// Get talaqi history for a santri
export const getBySantri = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("talaqi")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get talaqi sessions by ustadz
export const getByUstadz = query({
  args: { ustadzId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("talaqi")
      .withIndex("by_ustadzId", (q) => q.eq("ustadzId", args.ustadzId))
      .collect();
  },
});

// Get talaqi sessions by admin pengajian
export const getByAdminPengajian = query({
  args: { adminPengajianId: v.id("admin_pengajian") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("talaqi")
      .withIndex("by_adminPengajianId", (q) =>
        q.eq("adminPengajianId", args.adminPengajianId)
      )
      .collect();
  },
});

// Get talaqi records for a specific pertemuan (ustadz roster prefill, santri detail view)
export const getByKelasPertemuan = query({
  args: { kelasPertemuanId: v.id("kelas_pertemuan") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("talaqi")
      .withIndex("by_kelasPertemuanId_userId", (q) =>
        q.eq("kelasPertemuanId", args.kelasPertemuanId)
      )
      .collect();
  },
});

// Get talaqi history for a kelas (santri's "riwayat kelas")
export const getByKelas = query({
  args: { kelasId: v.id("kelas") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("talaqi")
      .withIndex("by_kelasId", (q) => q.eq("kelasId", args.kelasId))
      .collect();
  },
});

// Update talaqi session
export const update = mutation({
  args: {
    id: v.id("talaqi"),
    presensi: v.optional(v.boolean()),
    nilai: v.optional(nilaiValues),
    catatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});
