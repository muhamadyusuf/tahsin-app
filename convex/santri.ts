import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertSelfOrStaff,
  getAuthUser,
  getUstadzRow,
  isAdministrator,
  requireSelf,
} from "./authz";

// Get santri profile by user id
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return null;
    await assertSelfOrStaff(ctx, caller, args.userId);
    return await ctx.db
      .query("santri")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// LKM's own santri roster — administrator, pemilik LKM, atau ustadz LKM tsb.
export const listByAdminPengajian = query({
  args: { adminPengajianId: v.id("admin_pengajian") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    if (!isAdministrator(caller)) {
      const lkm = await ctx.db.get(args.adminPengajianId);
      const ustadzRow = await getUstadzRow(ctx, caller);
      const isOwner = lkm?.userId === caller._id;
      const isUstadzHere = ustadzRow?.adminPengajianId === args.adminPengajianId;
      if (!isOwner && !isUstadzHere) {
        throw new Error("Tidak punya akses ke daftar santri lembaga ini");
      }
    }
    return await ctx.db
      .query("santri")
      .withIndex("by_adminPengajianId", (q) =>
        q.eq("adminPengajianId", args.adminPengajianId)
      )
      .collect();
  },
});

// Create santri profile for a user (first-time provisioning)
export const create = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSelf(ctx, args.userId);
    const existing = await ctx.db
      .query("santri")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("santri", {
      userId: args.userId,
      isActive: true,
    });
  },
});
