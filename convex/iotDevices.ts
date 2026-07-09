import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

function generateApiKey(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

/** Pair a new IoT device to a user account. Returns the device including its apiKey. */
export const registerDevice = mutation({
  args: {
    userId: v.id("users"),
    deviceName: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = generateApiKey();
    const id = await ctx.db.insert("iot_devices", {
      userId: args.userId,
      deviceName: args.deviceName,
      apiKey,
      isActive: true,
    });
    return await ctx.db.get(id);
  },
});

export const listDevices = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("iot_devices")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const removeDevice = mutation({
  args: { id: v.id("iot_devices") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const setDeviceActive = mutation({
  args: { id: v.id("iot_devices"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: args.isActive });
  },
});

/** Used by the HTTP endpoints in convex/http.ts to record that a device just called in. */
export const touchDevice = internalMutation({
  args: { id: v.id("iot_devices") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastSeenAt: new Date().toISOString() });
  },
});

/** Used by the HTTP endpoints in convex/http.ts to authenticate device requests. */
export const getDeviceByApiKey = internalQuery({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("iot_devices")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!device || !device.isActive) return null;
    return device;
  },
});
