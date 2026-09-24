import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  assertSelfOrStaff,
  getAuthUser,
  getLkmRow,
  isAdministrator,
  isStaff,
  requireAdministrator,
  requireUser,
} from "./authz";
import { assertHttpsUrl, assertImageUrl, assertMaxLength } from "./sanitize";

function isApproved(m: Doc<"materi">) {
  return m.status === undefined || m.status === "approved";
}

// Semua tautan yang nanti dirender client (iframe PDF, WebView video, gambar)
// divalidasi di server: hanya https (gambar juga boleh data URI raster).
// Tanpa ini `javascript:` di urlPdf akan jalan di dalam iframe web.
function validateMateriFields(args: {
  judul?: string;
  deskripsi?: string;
  urlCover?: string;
  urlVideo?: string;
  urlPdf?: string;
}) {
  assertMaxLength(args.judul, 300, "Judul");
  assertMaxLength(args.deskripsi, 50_000, "Deskripsi");
  assertImageUrl(args.urlCover, "Cover");
  assertHttpsUrl(args.urlVideo, "Tautan video");
  assertHttpsUrl(args.urlPdf, "Tautan PDF");
}

// List materi by type, optionally filtered by parentId — approved-only,
// used by student-facing browsing everywhere.
export const list = query({
  args: {
    type: v.union(
      v.literal("tahsin"),
      v.literal("ulumul_quran"),
      v.literal("fiqih")
    ),
    parentId: v.optional(v.id("materi")),
  },
  handler: async (ctx, args) => {
    if (!(await getAuthUser(ctx))) return [];
    const all = await ctx.db
      .query("materi")
      .withIndex("by_type_seq", (q) => q.eq("type", args.type))
      .collect();

    const approved = all.filter(isApproved);

    if (args.parentId !== undefined) {
      return approved.filter((m) => m.parentId === args.parentId);
    }
    // Return top-level items (no parent)
    return approved.filter((m) => m.parentId === undefined);
  },
});

// List all materi by type including nested children — approved-only.
export const listAllByType = query({
  args: {
    type: v.union(
      v.literal("tahsin"),
      v.literal("ulumul_quran"),
      v.literal("fiqih")
    ),
  },
  handler: async (ctx, args) => {
    if (!(await getAuthUser(ctx))) return [];
    const all = await ctx.db
      .query("materi")
      .withIndex("by_type_seq", (q) => q.eq("type", args.type))
      .collect();
    return all.filter(isApproved);
  },
});

// Get children of a materi — approved-only.
export const getChildren = query({
  args: { parentId: v.id("materi") },
  handler: async (ctx, args) => {
    if (!(await getAuthUser(ctx))) return [];
    const children = await ctx.db
      .query("materi")
      .withIndex("by_parentId", (q) => q.eq("parentId", args.parentId))
      .collect();
    return children.filter(isApproved);
  },
});

// Get single materi
export const getById = query({
  args: { id: v.id("materi") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return null;
    const materi = await ctx.db.get(args.id);
    if (!materi) return null;
    // Draf / usulan yang belum disetujui hanya untuk administrator & pengusulnya.
    if (
      !isApproved(materi) &&
      !isAdministrator(caller) &&
      materi.submittedBy !== caller._id
    ) {
      return null;
    }
    return materi;
  },
});

// List all materi of a type regardless of status — administrator management view.
export const listAllForType = query({
  args: {
    type: v.union(
      v.literal("tahsin"),
      v.literal("ulumul_quran"),
      v.literal("fiqih")
    ),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller || !(await isStaff(ctx, caller))) return [];
    return await ctx.db
      .query("materi")
      .withIndex("by_type_seq", (q) => q.eq("type", args.type))
      .collect();
  },
});

// List all materi submitted by a given user, any status — LKM's "materi saya" view.
export const listBySubmitter = query({
  args: { submittedBy: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    await assertSelfOrStaff(ctx, caller, args.submittedBy);
    return await ctx.db
      .query("materi")
      .withIndex("by_submittedBy", (q) => q.eq("submittedBy", args.submittedBy))
      .collect();
  },
});

// Create materi — administrator's direct-publish path (auto-approved).
export const create = mutation({
  args: {
    seq: v.float64(),
    parentId: v.optional(v.id("materi")),
    judul: v.string(),
    deskripsi: v.optional(v.string()),
    urlCover: v.optional(v.string()),
    urlVideo: v.optional(v.string()),
    urlPdf: v.optional(v.string()),
    isShow: v.boolean(),
    type: v.union(
      v.literal("tahsin"),
      v.literal("ulumul_quran"),
      v.literal("fiqih")
    ),
  },
  handler: async (ctx, args) => {
    await requireAdministrator(ctx);
    validateMateriFields(args);
    return await ctx.db.insert("materi", { ...args, status: "approved" });
  },
});

// Propose materi — admin_pengajian's only creation path; stays hidden from
// student-facing queries until an administrator approves it.
export const propose = mutation({
  args: {
    seq: v.float64(),
    parentId: v.optional(v.id("materi")),
    judul: v.string(),
    deskripsi: v.optional(v.string()),
    urlCover: v.optional(v.string()),
    urlVideo: v.optional(v.string()),
    urlPdf: v.optional(v.string()),
    isShow: v.boolean(),
    type: v.union(
      v.literal("tahsin"),
      v.literal("ulumul_quran"),
      v.literal("fiqih")
    ),
    submittedBy: v.id("users"),
    submittedByAdminPengajianId: v.id("admin_pengajian"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!isAdministrator(user)) {
      const lkm = await getLkmRow(ctx, user);
      if (
        !lkm ||
        args.submittedBy !== user._id ||
        args.submittedByAdminPengajianId !== lkm._id
      ) {
        throw new Error("Hanya pengelola lembaga yang boleh mengusulkan materi atas nama lembaganya");
      }
    }
    validateMateriFields(args);
    return await ctx.db.insert("materi", { ...args, status: "pending" });
  },
});

// Boleh menyunting materi: administrator atau pengusul materi itu sendiri.
async function requireMateriEditor(ctx: MutationCtx, materiId: Id<"materi">) {
  const user = await requireUser(ctx);
  if (isAdministrator(user)) return user;
  const materi = await ctx.db.get(materiId);
  if (!materi) throw new Error("Materi tidak ditemukan");
  if (materi.submittedBy !== user._id) {
    throw new Error("Tidak punya akses mengubah materi ini");
  }
  return user;
}

// Update materi
export const update = mutation({
  args: {
    id: v.id("materi"),
    seq: v.optional(v.float64()),
    judul: v.optional(v.string()),
    deskripsi: v.optional(v.string()),
    urlCover: v.optional(v.string()),
    urlVideo: v.optional(v.string()),
    urlPdf: v.optional(v.string()),
    isShow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const editor = await requireMateriEditor(ctx, args.id);
    validateMateriFields(args);
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    // Pengusul (non-administrator) tidak boleh mengubah materi yang sudah
    // disetujui secara diam-diam: perubahan apa pun harus melewati review lagi,
    // kalau tidak approval bisa dikelabui (setujui materi jinak, lalu ganti isinya).
    if (!isAdministrator(editor)) {
      await ctx.db.patch(id, {
        ...filtered,
        status: "pending",
        reviewedBy: undefined,
        reviewNote: undefined,
        reviewedAt: undefined,
      });
      return;
    }
    await ctx.db.patch(id, filtered);
  },
});

// Re-submit a previously rejected/pending materi after edits (LKM only).
export const resubmit = mutation({
  args: {
    id: v.id("materi"),
    seq: v.optional(v.float64()),
    judul: v.optional(v.string()),
    deskripsi: v.optional(v.string()),
    urlCover: v.optional(v.string()),
    urlVideo: v.optional(v.string()),
    urlPdf: v.optional(v.string()),
    isShow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireMateriEditor(ctx, args.id);
    validateMateriFields(args);
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(id, {
      ...filtered,
      status: "pending",
      reviewedBy: undefined,
      reviewNote: undefined,
      reviewedAt: undefined,
    });
  },
});

// Approve a pending materi submission (administrator only).
export const approve = mutation({
  args: {
    id: v.id("materi"),
    reviewedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdministrator(ctx);
    await ctx.db.patch(args.id, {
      status: "approved",
      isShow: true,
      reviewedBy: admin._id,
      reviewedAt: new Date().toISOString(),
    });
  },
});

// Reject a pending materi submission (administrator only).
export const reject = mutation({
  args: {
    id: v.id("materi"),
    reviewedBy: v.id("users"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdministrator(ctx);
    await ctx.db.patch(args.id, {
      status: "rejected",
      reviewedBy: admin._id,
      reviewNote: args.reviewNote,
      reviewedAt: new Date().toISOString(),
    });
  },
});

// Delete materi — administrator atau pengusulnya
export const remove = mutation({
  args: { id: v.id("materi") },
  handler: async (ctx, args) => {
    await requireMateriEditor(ctx, args.id);
    await ctx.db.delete(args.id);
  },
});
