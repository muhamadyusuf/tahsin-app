import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getAuthUser,
  getLkmRow,
  isAdministrator,
  requireAdministrator,
  requireSelf,
} from "./authz";

// User mengajukan diri menjadi admin_pengajian (membuka lembaga).
// Menunggu persetujuan administrator.
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
    const user = await requireSelf(ctx, args.userId);

    // Sudah menjadi admin_pengajian? tidak perlu mengajukan.
    const existingLkm = await getLkmRow(ctx, user);
    if (existingLkm) {
      throw new Error("Anda sudah terdaftar sebagai admin pengajian");
    }

    // Cegah pengajuan ganda yang masih menunggu.
    const requests = await ctx.db
      .query("admin_pengajian_request")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    if (requests.some((r) => r.status === "pending")) {
      throw new Error("Sudah ada pengajuan yang masih menunggu persetujuan");
    }

    return await ctx.db.insert("admin_pengajian_request", {
      userId: args.userId,
      userName: user.name,
      userEmail: user.email,
      namaLembaga: args.namaLembaga,
      alamat: args.alamat,
      kota: args.kota,
      provinsi: args.provinsi,
      latitude: args.latitude,
      longitude: args.longitude,
      fotoUrl: args.fotoUrl,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  },
});

// Pengajuan milik user sendiri (dipakai untuk menampilkan status).
export const getMine = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller || caller._id !== args.userId) return [];
    return await ctx.db
      .query("admin_pengajian_request")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Daftar pengajuan untuk administrator (default: yang menunggu).
export const listByStatus = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected")
      )
    ),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    // Hanya administrator yang boleh mereview.
    if (!isAdministrator(caller)) return [];

    if (args.status !== undefined) {
      return await ctx.db
        .query("admin_pengajian_request")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("admin_pengajian_request").collect();
  },
});

// Administrator menyetujui pengajuan → membuat lembaga (admin_pengajian).
export const approve = mutation({
  args: {
    id: v.id("admin_pengajian_request"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdministrator(ctx);
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Pengajuan tidak ditemukan");
    if (request.status !== "pending") {
      throw new Error("Pengajuan sudah pernah direview");
    }

    // Jika user sudah punya lembaga, cukup tandai disetujui tanpa duplikasi.
    const existingLkm = await ctx.db
      .query("admin_pengajian")
      .withIndex("by_userId", (q) => q.eq("userId", request.userId))
      .first();

    const adminPengajianId =
      existingLkm?._id ??
      (await ctx.db.insert("admin_pengajian", {
        userId: request.userId,
        namaLembaga: request.namaLembaga,
        alamat: request.alamat,
        kota: request.kota,
        provinsi: request.provinsi,
        latitude: request.latitude,
        longitude: request.longitude,
        fotoUrl: request.fotoUrl,
        isActive: true,
      }));

    await ctx.db.patch(args.id, {
      status: "approved",
      reviewedBy: admin._id,
      reviewNote: args.reviewNote,
      reviewedAt: new Date().toISOString(),
      adminPengajianId,
    });

    return adminPengajianId;
  },
});

// Administrator menolak pengajuan.
export const reject = mutation({
  args: {
    id: v.id("admin_pengajian_request"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdministrator(ctx);
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Pengajuan tidak ditemukan");
    if (request.status !== "pending") {
      throw new Error("Pengajuan sudah pernah direview");
    }

    await ctx.db.patch(args.id, {
      status: "rejected",
      reviewedBy: admin._id,
      reviewNote: args.reviewNote,
      reviewedAt: new Date().toISOString(),
    });
  },
});
