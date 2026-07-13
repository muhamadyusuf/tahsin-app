import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertSelfOrStaff,
  getAuthUser,
  isAdministrator,
  requireLkmOwner,
  requireSelf,
} from "./authz";

const EARTH_RADIUS_KM = 6371;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// List active LKM (admin_pengajian) with a known location, sorted by distance
// from the given coordinates. radiusKm optionally filters results.
export const listNearby = query({
  args: {
    latitude: v.float64(),
    longitude: v.float64(),
    radiusKm: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    if (!(await getAuthUser(ctx))) return [];
    const all = await ctx.db.query("admin_pengajian").collect();
    const withDistance = all
      .filter(
        (lkm) =>
          lkm.isActive &&
          lkm.latitude !== undefined &&
          lkm.longitude !== undefined
      )
      .map((lkm) => ({
        ...lkm,
        distanceKm: haversineKm(
          args.latitude,
          args.longitude,
          lkm.latitude as number,
          lkm.longitude as number
        ),
      }))
      .filter((lkm) =>
        args.radiusKm !== undefined ? lkm.distanceKm <= args.radiusKm : true
      )
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return withDistance;
  },
});

// Santri submits a join request to an LKM
export const create = mutation({
  args: {
    userId: v.id("users"),
    adminPengajianId: v.id("admin_pengajian"),
    requestedKelasId: v.optional(v.id("kelas")),
  },
  handler: async (ctx, args) => {
    await requireSelf(ctx, args.userId);
    let santri = await ctx.db
      .query("santri")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!santri) {
      const santriId = await ctx.db.insert("santri", {
        userId: args.userId,
        isActive: true,
      });
      santri = await ctx.db.get(santriId);
    }
    if (!santri) {
      throw new Error("Failed to provision santri profile");
    }

    const santriRequests = await ctx.db
      .query("lkm_join_request")
      .withIndex("by_santriId", (q) => q.eq("santriId", santri!._id))
      .collect();
    const existingPending = santriRequests.find((r) => r.status === "pending");
    if (existingPending) {
      throw new Error("Sudah ada permintaan bergabung yang masih menunggu");
    }

    return await ctx.db.insert("lkm_join_request", {
      santriId: santri._id,
      userId: args.userId,
      adminPengajianId: args.adminPengajianId,
      status: "pending",
      requestedKelasId: args.requestedKelasId,
      createdAt: new Date().toISOString(),
    });
  },
});

export const getBySantri = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    await assertSelfOrStaff(ctx, caller, args.userId);
    const santri = await ctx.db
      .query("santri")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (!santri) return [];

    return await ctx.db
      .query("lkm_join_request")
      .withIndex("by_santriId", (q) => q.eq("santriId", santri._id))
      .collect();
  },
});

export const listByAdminPengajian = query({
  args: {
    adminPengajianId: v.id("admin_pengajian"),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
    ),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    if (!isAdministrator(caller)) {
      const lkm = await ctx.db.get(args.adminPengajianId);
      if (!lkm || lkm.userId !== caller._id) {
        throw new Error("Bukan pengelola lembaga pengajian ini");
      }
    }
    return await ctx.db
      .query("lkm_join_request")
      .withIndex("by_adminPengajianId_status", (q) =>
        args.status !== undefined
          ? q
              .eq("adminPengajianId", args.adminPengajianId)
              .eq("status", args.status)
          : q.eq("adminPengajianId", args.adminPengajianId)
      )
      .collect();
  },
});

// LKM approves a request, assigning the santri to a kelas
export const approve = mutation({
  args: {
    id: v.id("lkm_join_request"),
    assignedKelasId: v.id("kelas"),
    reviewedBy: v.id("users"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Join request not found");
    const reviewer = await requireLkmOwner(ctx, request.adminPengajianId);
    if (request.status !== "pending") {
      throw new Error("Join request already reviewed");
    }

    const kelas = await ctx.db.get(args.assignedKelasId);
    if (!kelas) throw new Error("Kelas not found");

    await ctx.db.patch(request.santriId, {
      adminPengajianId: request.adminPengajianId,
      ustadzId: kelas.ustadzId,
    });

    await ctx.db.insert("kelas_santri", {
      kelasId: args.assignedKelasId,
      santriId: request.santriId,
      userId: request.userId,
      joinedAt: new Date().toISOString(),
      isActive: true,
    });

    await ctx.db.patch(args.id, {
      status: "approved",
      assignedKelasId: args.assignedKelasId,
      reviewedBy: reviewer._id,
      reviewNote: args.reviewNote,
      reviewedAt: new Date().toISOString(),
    });
  },
});

export const reject = mutation({
  args: {
    id: v.id("lkm_join_request"),
    reviewedBy: v.id("users"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Join request not found");
    const reviewer = await requireLkmOwner(ctx, request.adminPengajianId);
    if (request.status !== "pending") {
      throw new Error("Join request already reviewed");
    }

    await ctx.db.patch(args.id, {
      status: "rejected",
      reviewedBy: reviewer._id,
      reviewNote: args.reviewNote,
      reviewedAt: new Date().toISOString(),
    });
  },
});
