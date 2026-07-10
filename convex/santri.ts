import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get santri profile by user id
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("santri")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// LKM's own santri roster
export const listByAdminPengajian = query({
  args: { adminPengajianId: v.id("admin_pengajian") },
  handler: async (ctx, args) => {
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
