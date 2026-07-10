import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get the logged-in user's personal best score
export const getMyBest = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sambung_ayat_scores")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Top scores across all users, joined with display name/avatar
export const getLeaderboard = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const max = Math.max(1, Math.min(50, Math.floor(args.limit ?? 20)));
    const top = await ctx.db
      .query("sambung_ayat_scores")
      .withIndex("by_score")
      .order("desc")
      .take(max);

    const results = [];
    for (const row of top) {
      const user = await ctx.db.get(row.userId);
      results.push({
        _id: row._id,
        userId: row.userId,
        name: user?.name ?? "Santri",
        avatarUrl: user?.avatarUrl,
        score: row.score,
        correctCount: row.correctCount,
        totalCount: row.totalCount,
        bestCombo: row.bestCombo,
        juzRange: row.juzRange,
        updatedAt: row.updatedAt,
      });
    }
    return results;
  },
});

// Submit a finished game's score — only overwrites the stored personal best
// when the new score is higher, so the leaderboard always reflects each
// user's best run.
export const submitScore = mutation({
  args: {
    userId: v.id("users"),
    score: v.float64(),
    correctCount: v.float64(),
    totalCount: v.float64(),
    bestCombo: v.float64(),
    juzRange: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sambung_ayat_scores")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const isNewBest = !existing || args.score > existing.score;

    if (!existing) {
      await ctx.db.insert("sambung_ayat_scores", {
        userId: args.userId,
        score: args.score,
        correctCount: args.correctCount,
        totalCount: args.totalCount,
        bestCombo: args.bestCombo,
        juzRange: args.juzRange,
        updatedAt: new Date().toISOString(),
      });
    } else if (isNewBest) {
      await ctx.db.patch(existing._id, {
        score: args.score,
        correctCount: args.correctCount,
        totalCount: args.totalCount,
        bestCombo: args.bestCombo,
        juzRange: args.juzRange,
        updatedAt: new Date().toISOString(),
      });
    }

    return { isNewBest, previousBest: existing?.score ?? 0 };
  },
});
