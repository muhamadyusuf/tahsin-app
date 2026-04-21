import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Create ustadz profile for a user
export const create = mutation({
  args: {
    userId: v.id("users"),
    adminPengajianId: v.id("admin_pengajian"),
    spesialisasi: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ustadz")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      throw new Error("Ustadz profile already exists for this user");
    }

    return await ctx.db.insert("ustadz", {
      userId: args.userId,
      adminPengajianId: args.adminPengajianId,
      spesialisasi: args.spesialisasi,
      isActive: true,
    });
  },
});

// Get ustadz profile by user id
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ustadz")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// List ustadz for a specific admin pengajian
export const listByAdminPengajian = query({
  args: { adminPengajianId: v.id("admin_pengajian") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ustadz")
      .withIndex("by_adminPengajianId", (q) =>
        q.eq("adminPengajianId", args.adminPengajianId)
      )
      .collect();
  },
});
