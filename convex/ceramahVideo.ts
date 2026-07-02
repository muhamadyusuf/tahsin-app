import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Public: list all active ceramah videos (live first, then by createdAt desc)
export const listActiveVideos = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db
      .query("ceramah_video")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    return videos
      .sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, 20);
  },
});

// Admin: list all videos (including inactive)
export const listAllVideos = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("ceramah_video").collect();
    return videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

// Admin: add a new ceramah video
export const addVideo = mutation({
  args: {
    judul: v.string(),
    deskripsi: v.optional(v.string()),
    youtubeUrl: v.string(),
    isLive: v.boolean(),
    postedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("ceramah_video", {
      judul: args.judul,
      deskripsi: args.deskripsi,
      youtubeUrl: args.youtubeUrl,
      isLive: args.isLive,
      postedBy: args.postedBy,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  },
});

// Admin: update a ceramah video
export const updateVideo = mutation({
  args: {
    id: v.id("ceramah_video"),
    judul: v.optional(v.string()),
    deskripsi: v.optional(v.string()),
    youtubeUrl: v.optional(v.string()),
    isLive: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const patch: Partial<{
      judul: string;
      deskripsi: string;
      youtubeUrl: string;
      isLive: boolean;
      isActive: boolean;
    }> = {};

    if (updates.judul !== undefined) patch.judul = updates.judul;
    if (updates.deskripsi !== undefined) patch.deskripsi = updates.deskripsi;
    if (updates.youtubeUrl !== undefined) patch.youtubeUrl = updates.youtubeUrl;
    if (updates.isLive !== undefined) patch.isLive = updates.isLive;
    if (updates.isActive !== undefined) patch.isActive = updates.isActive;

    await ctx.db.patch(id, patch);
  },
});

// Admin: delete a ceramah video
export const deleteVideo = mutation({
  args: { id: v.id("ceramah_video") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
