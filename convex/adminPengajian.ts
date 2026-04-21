import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Create admin pengajian
export const create = mutation({
  args: {
    userId: v.id("users"),
    namaLembaga: v.string(),
    alamat: v.optional(v.string()),
    kota: v.string(),
    provinsi: v.string(),
    latitude: v.optional(v.float64()),
    longitude: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
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
    return await ctx.db.query("admin_pengajian").collect();
  },
});

// List by kota (for santri selecting pengajian)
export const listByKota = query({
  args: { kota: v.string() },
  handler: async (ctx, args) => {
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
    return await ctx.db.get(args.id);
  },
});

// Update admin pengajian
export const update = mutation({
  args: {
    id: v.id("admin_pengajian"),
    namaLembaga: v.optional(v.string()),
    alamat: v.optional(v.string()),
    kota: v.optional(v.string()),
    provinsi: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});
