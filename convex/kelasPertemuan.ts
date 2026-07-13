import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { canManageKelas, getAuthUser, requireUser } from "./authz";

// Administrator, pemilik LKM, atau ustadz pengampu kelas dari pertemuan ini.
async function requirePertemuanManager(
  ctx: MutationCtx,
  pertemuanId: Id<"kelas_pertemuan">
) {
  const user = await requireUser(ctx);
  const pertemuan = await ctx.db.get(pertemuanId);
  if (!pertemuan) throw new Error("Pertemuan not found");
  const kelas = await ctx.db.get(pertemuan.kelasId);
  if (!kelas) throw new Error("Kelas tidak ditemukan");
  if (!(await canManageKelas(ctx, user, kelas))) {
    throw new Error("Tidak punya akses mengelola pertemuan ini");
  }
  return pertemuan;
}

export const listByKelas = query({
  args: { kelasId: v.id("kelas") },
  handler: async (ctx, args) => {
    if (!(await getAuthUser(ctx))) return [];
    const rows = await ctx.db
      .query("kelas_pertemuan")
      .withIndex("by_kelasId", (q) => q.eq("kelasId", args.kelasId))
      .collect();
    return rows.sort((a, b) => a.pertemuanKe - b.pertemuanKe);
  },
});

export const getById = query({
  args: { id: v.id("kelas_pertemuan") },
  handler: async (ctx, args) => {
    if (!(await getAuthUser(ctx))) return null;
    return await ctx.db.get(args.id);
  },
});

// Ustadz editing a generated occurrence's date/mode
export const update = mutation({
  args: {
    id: v.id("kelas_pertemuan"),
    tanggal: v.optional(v.string()),
    mode: v.optional(v.union(v.literal("online"), v.literal("offline"))),
    status: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("ongoing"),
        v.literal("done"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requirePertemuanManager(ctx, args.id);
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const start = mutation({
  args: { id: v.id("kelas_pertemuan") },
  handler: async (ctx, args) => {
    await requirePertemuanManager(ctx, args.id);

    // Pertemuan online memakai video meeting internal (WebRTC, convex/meeting.ts)
    // dengan pertemuanId sebagai room — tidak perlu URL pihak ketiga lagi.
    await ctx.db.patch(args.id, {
      status: "ongoing",
      startedAt: new Date().toISOString(),
    });
  },
});

export const end = mutation({
  args: { id: v.id("kelas_pertemuan") },
  handler: async (ctx, args) => {
    await requirePertemuanManager(ctx, args.id);
    await ctx.db.patch(args.id, {
      status: "done",
      endedAt: new Date().toISOString(),
    });
  },
});
