import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import {
  ADMIN_EMAILS,
  getAuthUser,
  isAdministrator,
  isStaff,
  requireAdministrator,
  requireSelf,
  verifiedIdentityEmail,
} from "./authz";
import { assertMaxLength, cleanText, safeImageUrl, assertImageUrl } from "./sanitize";

const ALL_ROLES = [
  "administrator",
  "admin_pengajian",
  "ustadz",
  "santri",
] as const;

type Role = (typeof ALL_ROLES)[number];

// Profil pengguna sebagaimana dilihat pemanggil: field pribadi hanya terisi
// untuk diri sendiri / staf (lihat getById).
type VisibleUser = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "name" | "avatarUrl" | "role" | "isActive"
> &
  Partial<
    Pick<Doc<"users">, "clerkId" | "email" | "phone" | "location" | "adminPengajianId">
  >;

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
//
// KEAMANAN: `args.email` berasal dari client dan TIDAK boleh dipercaya untuk
// otorisasi. Email yang dipakai untuk promosi administrator (ADMIN_EMAILS)
// hanya boleh berasal dari klaim `email` di JWT yang sudah diverifikasi.
// Tanpa ini, siapa pun yang login bisa mengirim email admin dan otomatis
// menjadi administrator.
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

    const trustedEmail = verifiedIdentityEmail(identity);
    const claimedEmail = args.email.trim().slice(0, 254);

    // Email admin tanpa bukti dari JWT = percobaan eskalasi (atau template JWT
    // Clerk belum menyertakan klaim email). Tolak, jangan simpan.
    if (!trustedEmail && ADMIN_EMAILS.includes(claimedEmail.toLowerCase())) {
      throw new Error(
        "Email administrator harus berasal dari token login yang terverifikasi"
      );
    }

    const name = cleanText(args.name, 120) ?? "User";
    const phone = cleanText(args.phone, 32);
    const avatarUrl = safeImageUrl(args.avatarUrl);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      const updates: Record<string, unknown> = { avatarUrl };
      // Email hanya diperbarui dari sumber tepercaya; tanpa itu biarkan apa adanya.
      if (trustedEmail) updates.email = trustedEmail;
      // Auto-promote admin emails on every login (hanya via email terverifikasi)
      if (
        trustedEmail &&
        ADMIN_EMAILS.includes(trustedEmail) &&
        existing.role !== "administrator"
      ) {
        updates.role = "administrator";
      }
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    const email = trustedEmail ?? claimedEmail;
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name,
      email,
      phone,
      role:
        trustedEmail && ADMIN_EMAILS.includes(trustedEmail)
          ? "administrator"
          : "santri",
      avatarUrl,
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
    assertMaxLength(args.name, 120, "Nama");
    assertMaxLength(args.phone, 32, "Nomor telepon");
    assertMaxLength(args.location, 200, "Lokasi");
    assertImageUrl(args.avatarUrl, "Foto profil");
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

// Get user by ID — profil lengkap (email, telepon, clerkId) hanya untuk diri
// sendiri atau staf. Pengguna lain hanya mendapat data publik (nama & avatar),
// karena ID pengguna mudah didapat dari leaderboard / daftar peserta meeting.
export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<VisibleUser | null> => {
    const caller = await getAuthUser(ctx);
    if (!caller) return null;
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    if (caller._id === user._id || (await isStaff(ctx, caller))) return user;
    return {
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
    };
  },
});

// Promote a user to administrator by email (admin only)
export const promoteByEmail = mutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("administrator"),
      v.literal("admin_pengajian"),
      v.literal("ustadz"),
      v.literal("santri")
    ),
  },
  handler: async (ctx, args) => {
    await requireAdministrator(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { role: args.role });
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
