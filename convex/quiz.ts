import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List quizzes for a materi
export const listByMateri = query({
  args: { materiId: v.id("materi") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quiz")
      .withIndex("by_materiId", (q) => q.eq("materiId", args.materiId))
      .collect();
  },
});

// Get quiz options
export const getOptions = query({
  args: { quizId: v.id("quiz") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quiz_options")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
      .collect();
  },
});

// Create quiz
export const createQuiz = mutation({
  args: {
    materiId: v.id("materi"),
    question: v.string(),
    urlImage: v.optional(v.string()),
    urlVideo: v.optional(v.string()),
    type: v.union(v.literal("pilihan_ganda"), v.literal("essay")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("quiz", args);
  },
});

// Create quiz option
export const createOption = mutation({
  args: {
    seq: v.float64(),
    quizId: v.id("quiz"),
    urlImage: v.optional(v.string()),
    deskripsi: v.string(),
    poin: v.float64(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("quiz_options", args);
  },
});

// Submit quiz answer
export const submitAnswer = mutation({
  args: {
    userId: v.id("users"),
    quizId: v.id("quiz"),
    optionId: v.optional(v.id("quiz_options")),
    answer: v.optional(v.string()),
    isCorrect: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("user_quiz_answers", {
      userId: args.userId,
      quizId: args.quizId,
      optionId: args.optionId,
      answer: args.answer,
      isCorrect: args.isCorrect,
      answeredAt: new Date().toISOString(),
    });
  },
});

// Save user progress on a materi
export const saveProgress = mutation({
  args: {
    userId: v.id("users"),
    materiId: v.id("materi"),
    quizId: v.optional(v.id("quiz")),
    score: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("user_progress")
      .withIndex("by_userId_materiId", (q) =>
        q.eq("userId", args.userId).eq("materiId", args.materiId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        score: args.score,
        quizId: args.quizId,
        completedAt: new Date().toISOString(),
      });
      return existing._id;
    }

    return await ctx.db.insert("user_progress", {
      userId: args.userId,
      materiId: args.materiId,
      quizId: args.quizId,
      score: args.score,
      completedAt: new Date().toISOString(),
    });
  },
});

// Get user progress for a type
export const getUserProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("user_progress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get answers for a specific quiz by user
export const getUserAnswers = query({
  args: {
    userId: v.id("users"),
    quizId: v.id("quiz"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("user_quiz_answers")
      .withIndex("by_userId_quizId", (q) =>
        q.eq("userId", args.userId).eq("quizId", args.quizId)
      )
      .collect();
  },
});
