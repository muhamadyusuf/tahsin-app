import { query, mutation, internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

const sourceValidator = v.union(v.literal("app"), v.literal("iot"));

const recordPageReadArgs = {
  userId: v.id("users"),
  page: v.float64(),
  surahNumber: v.float64(),
  surahName: v.string(),
  juz: v.float64(),
  tanggal: v.string(),
  source: sourceValidator,
};

type RecordPageReadArgs = {
  userId: Id<"users">;
  page: number;
  surahNumber: number;
  surahName: string;
  juz: number;
  tanggal: string;
  source: "app" | "iot";
};

async function upsertReadingPosition(ctx: MutationCtx, args: RecordPageReadArgs) {
  const existing = await ctx.db
    .query("reading_position")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .unique();
  const patch = {
    page: args.page,
    surahNumber: args.surahNumber,
    surahName: args.surahName,
    juz: args.juz,
    updatedAt: new Date().toISOString(),
    updatedBy: args.source,
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("reading_position", { userId: args.userId, ...patch });
  }
}

/**
 * Record that a user has read a given Mushaf page. Always updates the live
 * reading position; only increments the daily tilawah count the first time
 * a given (user, date, page) combination is seen, so revisiting a page the
 * same day doesn't inflate jumlahHalaman.
 */
async function recordPageReadImpl(
  ctx: MutationCtx,
  args: RecordPageReadArgs
): Promise<{ duplicate: boolean }> {
  await upsertReadingPosition(ctx, args);

  const alreadyLogged = await ctx.db
    .query("mushaf_read_log")
    .withIndex("by_userId_tanggal_page", (q) =>
      q.eq("userId", args.userId).eq("tanggal", args.tanggal).eq("page", args.page)
    )
    .unique();
  if (alreadyLogged) {
    return { duplicate: true };
  }

  await ctx.db.insert("mushaf_read_log", {
    userId: args.userId,
    tanggal: args.tanggal,
    page: args.page,
    surahNumber: args.surahNumber,
    surahName: args.surahName,
    juz: args.juz,
    source: args.source,
  });

  // Auto-tracked entries are kept separate per origin (mushaf reader vs IoT
  // device) so each day/surah can have both a "mushaf" and an "iot" row
  // alongside any manual entry, without them clobbering each other's counts.
  const tilawahSource = args.source === "iot" ? "iot" : "mushaf";
  const dayEntries: Doc<"tilawah_harian">[] = await ctx.db
    .query("tilawah_harian")
    .withIndex("by_userId_tanggal", (q) =>
      q.eq("userId", args.userId).eq("tanggal", args.tanggal)
    )
    .collect();
  const existingEntry = dayEntries.find(
    (e) => e.suratNumber === args.surahNumber && e.source === tilawahSource
  );

  if (existingEntry) {
    await ctx.db.patch(existingEntry._id, {
      jumlahHalaman: existingEntry.jumlahHalaman + 1,
    });
  } else {
    await ctx.db.insert("tilawah_harian", {
      userId: args.userId,
      tanggal: args.tanggal,
      suratNumber: args.surahNumber,
      suratName: args.surahName,
      juz: args.juz,
      jumlahHalaman: 1,
      source: tilawahSource,
    });
  }

  return { duplicate: false };
}

export const recordPageRead = mutation({
  args: recordPageReadArgs,
  handler: async (ctx, args) => recordPageReadImpl(ctx, args),
});

/** Used by the IoT HTTP endpoints in convex/http.ts (already-authenticated device calls). */
export const recordPageReadInternal = internalMutation({
  args: recordPageReadArgs,
  handler: async (ctx, args) => recordPageReadImpl(ctx, args),
});

export const getReadingPosition = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reading_position")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});
