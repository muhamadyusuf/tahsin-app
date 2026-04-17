import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get current user by Clerk ID
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

// Create or update user from Clerk webhook / first login
export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        phone: args.phone,
        avatarUrl: args.avatarUrl,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      role: "santri", // default role
      avatarUrl: args.avatarUrl,
      isActive: true,
    });
  },
});

// Update user profile
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(userId, filtered);
  },
});

// Update user role (admin only)
export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("administrator"),
      v.literal("admin_pengajian"),
      v.literal("ustadz"),
      v.literal("santri")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

// List all users (admin)
export const listAll = query({
  args: {
    role: v.optional(
      v.union(
        v.literal("administrator"),
        v.literal("admin_pengajian"),
        v.literal("ustadz"),
        v.literal("santri")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.role) {
      return await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", args.role!))
        .collect();
    }
    return await ctx.db.query("users").collect();
  },
});

// Get user by ID
export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});
