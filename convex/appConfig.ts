import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdministrator } from "./authz";
import { assertImageUrl } from "./sanitize";

const APP_CONFIG_KEY = "global";

export const getPublicConfig = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("app_config")
      .withIndex("by_key", (q) => q.eq("key", APP_CONFIG_KEY))
      .first();

    return {
      tilawahHeaderImageUrl: config?.tilawahHeaderImageUrl,
      updatedAt: config?.updatedAt,
    };
  },
});

// Hanya administrator. Tanpa pemeriksaan ini siapa pun (bahkan tanpa login)
// bisa mengunggah file sembarang ke storage proyek.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdministrator(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const upsertTilawahHeaderImage = mutation({
  args: {
    tilawahHeaderImageUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await requireAdministrator(ctx);

    let url = assertImageUrl(args.tilawahHeaderImageUrl, "Gambar header");
    if (args.storageId) {
      url = (await ctx.storage.getUrl(args.storageId)) ?? undefined;
    }

    const existing = await ctx.db
      .query("app_config")
      .withIndex("by_key", (q) => q.eq("key", APP_CONFIG_KEY))
      .first();

    const payload = {
      key: APP_CONFIG_KEY,
      tilawahHeaderImageUrl: url,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("app_config", payload);
  },
});
