import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByKelas = query({
  args: { kelasId: v.id("kelas") },
  handler: async (ctx, args) => {
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
    const pertemuan = await ctx.db.get(args.id);
    if (!pertemuan) throw new Error("Pertemuan not found");

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
    await ctx.db.patch(args.id, {
      status: "done",
      endedAt: new Date().toISOString(),
    });
  },
});
