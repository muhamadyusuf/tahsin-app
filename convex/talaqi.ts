import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  assertSelfOrStaff,
  canManageKelas,
  getAuthUser,
  getLkmRow,
  getUstadzRow,
  isAdministrator,
  isEnrolledInKelas,
  requireUser,
} from "./authz";
import { assertIsoDate, assertMaxLength } from "./sanitize";

type TalaqiScope = {
  userId: Id<"users">; // santri yang dinilai
  ustadzId: Id<"users">;
  kelasId?: Id<"kelas">;
  kelasPertemuanId?: Id<"kelas_pertemuan">;
};

// Pengisi nilai/presensi talaqi. Nilai adalah data sensitif santri, jadi
// penulis dibatasi ke lingkup yang sah — bukan sekadar "LKM mana pun":
//  - administrator: bebas.
//  - bila terkait kelas: pengelola kelas itu (pemilik LKM / ustadz pengampu),
//    pertemuan harus milik kelas tsb dan santri harus terdaftar di kelas.
//  - tanpa kelas: ustadz sendiri / pemilik LKM, dan santri harus berafiliasi
//    ke lembaga yang sama.
async function requireTalaqiWriter(
  ctx: MutationCtx,
  scope: TalaqiScope
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (isAdministrator(user)) return user;

  if (scope.kelasId) {
    const kelas = await ctx.db.get(scope.kelasId);
    if (!kelas) throw new Error("Kelas tidak ditemukan");
    if (!(await canManageKelas(ctx, user, kelas))) {
      throw new Error("Tidak punya akses menilai di kelas ini");
    }
    if (scope.kelasPertemuanId) {
      const pertemuan = await ctx.db.get(scope.kelasPertemuanId);
      if (!pertemuan || pertemuan.kelasId !== kelas._id) {
        throw new Error("Pertemuan bukan bagian dari kelas ini");
      }
    }
    const santriUser = await ctx.db.get(scope.userId);
    if (!santriUser || !(await isEnrolledInKelas(ctx, santriUser, kelas._id))) {
      throw new Error("Santri tidak terdaftar di kelas ini");
    }
    return user;
  }

  const lkm = await getLkmRow(ctx, user);
  const ustadzRow = await getUstadzRow(ctx, user);
  if (!lkm && !(ustadzRow && scope.ustadzId === user._id)) {
    throw new Error("Hanya ustadz yang bersangkutan yang boleh mengisi talaqi");
  }
  const lembagaId = lkm?._id ?? ustadzRow?.adminPengajianId;
  const santri = await ctx.db
    .query("santri")
    .withIndex("by_userId", (q) => q.eq("userId", scope.userId))
    .first();
  if (!lembagaId || !santri || santri.adminPengajianId !== lembagaId) {
    throw new Error("Santri bukan bagian dari lembaga Anda");
  }
  return user;
}

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
    await requireTalaqiWriter(ctx, args);
    assertIsoDate(args.tanggal);
    assertMaxLength(args.catatan, 2000, "Catatan");
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
    await requireTalaqiWriter(ctx, args);
    assertIsoDate(args.tanggal);
    assertMaxLength(args.catatan, 2000, "Catatan");
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
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    await assertSelfOrStaff(ctx, caller, args.userId);
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
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    await assertSelfOrStaff(ctx, caller, args.ustadzId);
    return await ctx.db
      .query("talaqi")
      .withIndex("by_ustadzId", (q) => q.eq("ustadzId", args.ustadzId))
      .collect();
  },
});

// Get talaqi sessions by admin pengajian — administrator, pemilik LKM tsb,
// atau ustadz LKM tsb (bukan staf lembaga lain).
export const getByAdminPengajian = query({
  args: { adminPengajianId: v.id("admin_pengajian") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    if (!isAdministrator(caller)) {
      const lkm = await ctx.db.get(args.adminPengajianId);
      const ustadzRow = await getUstadzRow(ctx, caller);
      const isOwner = lkm?.userId === caller._id;
      const isUstadzHere = ustadzRow?.adminPengajianId === args.adminPengajianId;
      if (!isOwner && !isUstadzHere) return [];
    }
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
    // Pengelola kelas melihat seluruh roster; santri hanya melihat catatannya
    // sendiri — nilai & catatan santri lain tidak boleh bocor.
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    const pertemuan = await ctx.db.get(args.kelasPertemuanId);
    if (!pertemuan) return [];
    const kelas = await ctx.db.get(pertemuan.kelasId);
    if (!kelas) return [];
    const rows = await ctx.db
      .query("talaqi")
      .withIndex("by_kelasPertemuanId_userId", (q) =>
        q.eq("kelasPertemuanId", args.kelasPertemuanId)
      )
      .collect();
    if (await canManageKelas(ctx, caller, kelas)) return rows;
    return rows.filter((r) => r.userId === caller._id);
  },
});

// Get talaqi history for a kelas (santri's "riwayat kelas")
export const getByKelas = query({
  args: { kelasId: v.id("kelas") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    const kelas = await ctx.db.get(args.kelasId);
    if (!kelas) return [];
    const rows = await ctx.db
      .query("talaqi")
      .withIndex("by_kelasId", (q) => q.eq("kelasId", args.kelasId))
      .collect();
    if (await canManageKelas(ctx, caller, kelas)) return rows;
    return rows.filter((r) => r.userId === caller._id);
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
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Catatan talaqi tidak ditemukan");
    await requireTalaqiWriter(ctx, row);
    assertMaxLength(args.catatan, 2000, "Catatan");
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});
