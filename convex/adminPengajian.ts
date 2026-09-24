import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUser, isAdministrator, requireAdministrator, requireUser } from "./authz";
import { assertImageUrl, assertMaxLength } from "./sanitize";

function validateLembagaFields(args: {
  namaLembaga?: string;
  alamat?: string;
  kota?: string;
  provinsi?: string;
  fotoUrl?: string;
  latitude?: number;
  longitude?: number;
}) {
  assertMaxLength(args.namaLembaga, 200, "Nama lembaga");
  assertMaxLength(args.alamat, 500, "Alamat");
  assertMaxLength(args.kota, 100, "Kota");
  assertMaxLength(args.provinsi, 100, "Provinsi");
  assertImageUrl(args.fotoUrl, "Foto lembaga");
  if (
    (args.latitude !== undefined && !(args.latitude >= -90 && args.latitude <= 90)) ||
    (args.longitude !== undefined && !(args.longitude >= -180 && args.longitude <= 180))
  ) {
    throw new Error("Koordinat tidak valid");
  }
}

// Create admin pengajian — HANYA administrator. User biasa mengajukan lewat
// adminPengajianRequest.create dan menunggu persetujuan; jika mutation ini
// terbuka untuk diri sendiri, siapa pun bisa melewati approval, otomatis
// menjadi staf (isStaff) dan membaca daftar seluruh pengguna.
export const create = mutation({
  args: {
    userId: v.id("users"),
    namaLembaga: v.string(),
    alamat: v.optional(v.string()),
    kota: v.string(),
    provinsi: v.string(),
    latitude: v.optional(v.float64()),
    longitude: v.optional(v.float64()),
    fotoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdministrator(ctx);
    validateLembagaFields(args);
    const existing = await ctx.db
      .query("admin_pengajian")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      throw new Error("Admin pengajian profile already exists for this user");
    }

    return await ctx.db.insert("admin_pengajian", {
      ...args,
      isActive: true,
    });
  },
});

// List all admin pengajian
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getAuthUser(ctx))) return [];
    return await ctx.db.query("admin_pengajian").collect();
  },
});

// List by kota (for santri selecting pengajian)
export const listByKota = query({
  args: { kota: v.string() },
  handler: async (ctx, args) => {
    if (!(await getAuthUser(ctx))) return [];
    return await ctx.db
      .query("admin_pengajian")
      .withIndex("by_kota", (q) => q.eq("kota", args.kota))
      .collect();
  },
});

// Get by userId
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    if (!(await getAuthUser(ctx))) return null;
    return await ctx.db
      .query("admin_pengajian")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Get by id
export const getById = query({
  args: { id: v.id("admin_pengajian") },
  handler: async (ctx, args) => {
    if (!(await getAuthUser(ctx))) return null;
    return await ctx.db.get(args.id);
  },
});

// Update admin pengajian — pemilik lembaga atau administrator
export const update = mutation({
  args: {
    id: v.id("admin_pengajian"),
    namaLembaga: v.optional(v.string()),
    alamat: v.optional(v.string()),
    kota: v.optional(v.string()),
    provinsi: v.optional(v.string()),
    latitude: v.optional(v.float64()),
    longitude: v.optional(v.float64()),
    fotoUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Lembaga tidak ditemukan");
    if (row.userId !== user._id && !isAdministrator(user)) {
      throw new Error("Bukan pengelola lembaga ini");
    }
    validateLembagaFields(args);
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const remove = mutation({
  args: { id: v.id("admin_pengajian") },
  handler: async (ctx, args) => {
    await requireAdministrator(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Lembaga tidak ditemukan");
    await ctx.db.delete(args.id);
  },
});
