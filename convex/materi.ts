import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List materi by type, optionally filtered by parentId
export const list = query({
  args: {
    type: v.union(v.literal("tahsin"), v.literal("ulumul_quran")),
    parentId: v.optional(v.id("materi")),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("materi")
      .withIndex("by_type_seq", (q) => q.eq("type", args.type));

    const all = await q.collect();

    if (args.parentId !== undefined) {
      return all.filter((m) => m.parentId === args.parentId);
    }
    // Return top-level items (no parent)
    return all.filter((m) => m.parentId === undefined);
  },
});

// Get children of a materi
export const getChildren = query({
  args: { parentId: v.id("materi") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("materi")
      .withIndex("by_parentId", (q) => q.eq("parentId", args.parentId))
      .collect();
  },
});

// Get single materi
export const getById = query({
  args: { id: v.id("materi") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create materi
export const create = mutation({
  args: {
    seq: v.float64(),
    parentId: v.optional(v.id("materi")),
    judul: v.string(),
    deskripsi: v.optional(v.string()),
    urlCover: v.optional(v.string()),
    urlVideo: v.optional(v.string()),
    isShow: v.boolean(),
    type: v.union(v.literal("tahsin"), v.literal("ulumul_quran")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("materi", args);
  },
});

// Update materi
export const update = mutation({
  args: {
    id: v.id("materi"),
    seq: v.optional(v.float64()),
    judul: v.optional(v.string()),
    deskripsi: v.optional(v.string()),
    urlCover: v.optional(v.string()),
    urlVideo: v.optional(v.string()),
    isShow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

// Delete materi
export const remove = mutation({
  args: { id: v.id("materi") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
