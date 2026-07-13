import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUser, isAdministrator, requireSelf, requireUser } from "./authz";

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
    await requireSelf(ctx, args.userId);
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
    // Berisi apiKey perangkat — hanya pemilik (atau administrator).
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    if (caller._id !== args.userId && !isAdministrator(caller)) {
      throw new Error("Tidak punya akses ke perangkat pengguna lain");
    }
    return await ctx.db
      .query("iot_devices")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const removeDevice = mutation({
  args: { id: v.id("iot_devices") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const device = await ctx.db.get(args.id);
    if (!device) return;
    if (device.userId !== user._id && !isAdministrator(user)) {
      throw new Error("Bukan pemilik perangkat ini");
    }
    await ctx.db.delete(args.id);
  },
});

export const setDeviceActive = mutation({
  args: { id: v.id("iot_devices"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const device = await ctx.db.get(args.id);
    if (!device) throw new Error("Perangkat tidak ditemukan");
    if (device.userId !== user._id && !isAdministrator(user)) {
      throw new Error("Bukan pemilik perangkat ini");
    }
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
