import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  ADMIN_EMAILS,
  getAuthUser,
  isAdministrator,
  isStaff,
  requireAdministrator,
  requireSelf,
  requireUser,
} from "./authz";

const ALL_ROLES = [
  "administrator",
  "admin_pengajian",
  "ustadz",
  "santri",
] as const;

type Role = (typeof ALL_ROLES)[number];

// Get current user by Clerk ID — hanya mengembalikan profil pemanggil sendiri.
// Mengembalikan null (bukan error) saat token belum terpasang agar alur
// login/splash tidak crash.
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.clerkId) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

// Get all roles available for a user
export const getAvailableRoles = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Role[]> => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    if (caller._id !== args.userId && !isAdministrator(caller)) return [];

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return [];
    }

    const roles = new Set<Role>([user.role as Role]);

    const [adminPengajian, ustadz, santri] = await Promise.all([
      ctx.db
        .query("admin_pengajian")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first(),
      ctx.db
        .query("ustadz")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first(),
      ctx.db
        .query("santri")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first(),
    ]);

    if (adminPengajian) {
      roles.add("admin_pengajian");
    }
    if (ustadz) {
      roles.add("ustadz");
    }
    if (santri) {
      roles.add("santri");
    }

    // Administrators can switch to any role view.
    if (user.role === "administrator") {
      ALL_ROLES.forEach((role) => roles.add(role));
    }

    return ALL_ROLES.filter((role) => roles.has(role));
  },
});

// Create or update user from first login — identitas diambil dari JWT Clerk,
// argumen clerkId harus cocok dengan identitas pemanggil.
export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Harus login untuk mendaftarkan akun");
    }
    if (identity.subject !== args.clerkId) {
      throw new Error("clerkId tidak cocok dengan akun yang sedang login");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      const updates: Record<string, any> = {
        name: args.name,
        email: args.email,
        phone: args.phone,
        avatarUrl: args.avatarUrl,
      };
      // Auto-promote admin emails on every login
      if (ADMIN_EMAILS.includes(args.email.toLowerCase()) && existing.role !== "administrator") {
        updates.role = "administrator";
      }
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      role: ADMIN_EMAILS.includes(args.email.toLowerCase()) ? "administrator" : "santri",
      avatarUrl: args.avatarUrl,
      isActive: true,
    });
  },
});

// Update user profile — hanya milik sendiri (administrator boleh untuk siapa pun)
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSelf(ctx, args.userId);
    const { userId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(userId, filtered);
  },
});

// Set a user's base role (administrator only).
//
// Hanya menangani "base role": administrator ↔ santri. Peran ustadz &
// admin_pengajian TIDAK diatur di sini karena butuh data pendukung
// (lembaga/afiliasi) — keduanya diberikan lewat pembuatan keanggotaan
// (ustadz.create / adminPengajian.create). Dengan begitu setiap role yang
// dipegang selalu punya baris pendukung, konsisten dengan model multi-role
// di getAvailableRoles/setActiveRole.
export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("administrator"),
      v.literal("admin_pengajian"),
      v.literal("ustadz"),
      v.literal("santri"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdministrator(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Pastikan baris keanggotaan untuk role ybs ada.
    if (args.role === "santri") {
      const existing = await ctx.db
        .query("santri")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first();
      if (!existing) {
        await ctx.db.insert("santri", {
          userId: args.userId,
          isActive: true,
        });
      }
    }

    await ctx.db.patch(args.userId, { role: args.role });
  },
});

// List all users — hanya staf (administrator/LKM/ustadz), dipakai layar
// admin, form kelas, dan roster penilaian.
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
    const caller = await getAuthUser(ctx);
    if (!caller || !(await isStaff(ctx, caller))) return [];

    if (args.role) {
      return await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", args.role!))
        .collect();
    }
    return await ctx.db.query("users").collect();
  },
});

// Get user by ID — perlu login (dipakai menampilkan nama/avatar pengguna lain)
export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return null;
    return await ctx.db.get(args.userId);
  },
});

// Promote a user to administrator by email (admin only)
export const promoteByEmail = mutation({
  args: { email: v.string(), role: v.string() },
  handler: async (ctx, args) => {
    await requireAdministrator(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { role: args.role as any });
    return user._id;
  },
});

// Set active role for current user
export const setActiveRole = mutation({
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
    await requireSelf(ctx, args.userId);
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const roles = new Set<Role>([user.role as Role]);

    const [adminPengajian, ustadz, santri] = await Promise.all([
      ctx.db
        .query("admin_pengajian")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first(),
      ctx.db
        .query("ustadz")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first(),
      ctx.db
        .query("santri")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first(),
    ]);

    if (adminPengajian) {
      roles.add("admin_pengajian");
    }
    if (ustadz) {
      roles.add("ustadz");
    }
    if (santri) {
      roles.add("santri");
    }
    if (user.role === "administrator" || isAdministrator(user)) {
      ALL_ROLES.forEach((role) => roles.add(role));
    }

    if (!roles.has(args.role as Role)) {
      throw new Error("Role is not available for this user");
    }

    await ctx.db.patch(args.userId, { role: args.role });
    return args.userId;
  },
});
