import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Log tilawah harian
export const create = mutation({
  args: {
    userId: v.id("users"),
    tanggal: v.string(),
    suratNumber: v.float64(),
    suratName: v.string(),
    juz: v.float64(),
    jumlahHalaman: v.float64(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tilawah_harian", args);
  },
});

// Get tilawah history for a user
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tilawah_harian")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get tilawah for a specific date
export const getByDate = query({
  args: {
    userId: v.id("users"),
    tanggal: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tilawah_harian")
      .withIndex("by_userId_tanggal", (q) =>
        q.eq("userId", args.userId).eq("tanggal", args.tanggal)
      )
      .collect();
  },
});

// Delete tilawah entry
export const remove = mutation({
  args: { id: v.id("tilawah_harian") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
