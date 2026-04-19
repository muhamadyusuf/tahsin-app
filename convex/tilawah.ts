import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Log tilawah harian — khatam is user-declared
export const create = mutation({
  args: {
    userId: v.id("users"),
    tanggal: v.string(),
    suratNumber: v.float64(),
    suratName: v.string(),
    juz: v.float64(),
    jumlahHalaman: v.float64(),
    isKhatam: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("tilawah_harian", {
      userId: args.userId,
      tanggal: args.tanggal,
      suratNumber: args.suratNumber,
      suratName: args.suratName,
      juz: args.juz,
      jumlahHalaman: args.jumlahHalaman,
      isKhatam: args.isKhatam ?? false,
    });

    // If user marks this entry as khatam, record it
    if (args.isKhatam) {
      const existingKhatam = await ctx.db
        .query("khatam")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();
      await ctx.db.insert("khatam", {
        userId: args.userId,
        khatamKe: existingKhatam.length + 1,
        completedAt: args.tanggal,
      });
    }

    return id;
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

// Update tilawah entry
export const update = mutation({
  args: {
    id: v.id("tilawah_harian"),
    tanggal: v.optional(v.string()),
    suratNumber: v.optional(v.float64()),
    suratName: v.optional(v.string()),
    juz: v.optional(v.float64()),
    jumlahHalaman: v.optional(v.float64()),
    isKhatam: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Remove undefined fields
    const patch: Record<string, any> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);
  },
});

// Get khatam records for a user
export const getKhatam = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("khatam")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get khatam info for a user
export const getKhatamProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const khatamList = await ctx.db
      .query("khatam")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return {
      khatamCount: khatamList.length,
      khatamList,
    };
  },
});
