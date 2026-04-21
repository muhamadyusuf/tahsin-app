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

// Get single quiz by id
export const getById = query({
  args: { quizId: v.id("quiz") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.quizId);
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

// Get quiz counts grouped by materi IDs
export const getQuizCountsByMateriIds = query({
  args: { materiIds: v.array(v.id("materi")) },
  handler: async (ctx, args) => {
    if (args.materiIds.length === 0) {
      return [] as { materiId: string; count: number }[];
    }

    const counts = new Map<string, number>();
    for (const materiId of args.materiIds) {
      const quizzes = await ctx.db
        .query("quiz")
        .withIndex("by_materiId", (q) => q.eq("materiId", materiId))
        .collect();
      counts.set(materiId, quizzes.length);
    }

    return Array.from(counts.entries()).map(([materiId, count]) => ({
      materiId,
      count,
    }));
  },
});

// Get quiz usage grouped by quiz IDs
export const getUsageByQuizIds = query({
  args: { quizIds: v.array(v.id("quiz")) },
  handler: async (ctx, args) => {
    if (args.quizIds.length === 0) {
      return [] as {
        quizId: string;
        answerCount: number;
        progressCount: number;
        isUsed: boolean;
      }[];
    }

    const usageMap = new Map(
      args.quizIds.map((quizId) => [quizId, { answerCount: 0, progressCount: 0 }])
    );

    const allAnswers = await ctx.db.query("user_quiz_answers").collect();
    for (const answer of allAnswers) {
      const usage = usageMap.get(answer.quizId);
      if (usage) {
        usage.answerCount += 1;
      }
    }

    const allProgress = await ctx.db.query("user_progress").collect();
    for (const progress of allProgress) {
      if (!progress.quizId) {
        continue;
      }

      const usage = usageMap.get(progress.quizId);
      if (usage) {
        usage.progressCount += 1;
      }
    }

    return args.quizIds.map((quizId) => {
      const usage = usageMap.get(quizId) ?? { answerCount: 0, progressCount: 0 };
      return {
        quizId,
        answerCount: usage.answerCount,
        progressCount: usage.progressCount,
        isUsed: usage.answerCount > 0 || usage.progressCount > 0,
      };
    });
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

// Update quiz
export const updateQuiz = mutation({
  args: {
    quizId: v.id("quiz"),
    question: v.string(),
    urlImage: v.optional(v.string()),
    urlVideo: v.optional(v.string()),
    type: v.union(v.literal("pilihan_ganda"), v.literal("essay")),
  },
  handler: async (ctx, args) => {
    const { quizId, ...updates } = args;
    await ctx.db.patch(quizId, updates);
    return quizId;
  },
});

// Replace all options for a quiz
export const replaceOptions = mutation({
  args: {
    quizId: v.id("quiz"),
    options: v.array(
      v.object({
        seq: v.float64(),
        deskripsi: v.string(),
        poin: v.float64(),
        urlImage: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existingOptions = await ctx.db
      .query("quiz_options")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
      .collect();

    for (const option of existingOptions) {
      await ctx.db.delete(option._id);
    }

    for (const option of args.options) {
      await ctx.db.insert("quiz_options", {
        quizId: args.quizId,
        seq: option.seq,
        deskripsi: option.deskripsi,
        poin: option.poin,
        urlImage: option.urlImage,
      });
    }

    return args.quizId;
  },
});

// Delete quiz and related data
export const removeQuiz = mutation({
  args: { quizId: v.id("quiz"), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const allAnswers = await ctx.db.query("user_quiz_answers").collect();
    const answerCount = allAnswers.filter((answer) => answer.quizId === args.quizId).length;

    const allProgress = await ctx.db.query("user_progress").collect();
    const progressCount = allProgress.filter((progress) => progress.quizId === args.quizId).length;

    if ((answerCount > 0 || progressCount > 0) && !args.force) {
      throw new Error("Quiz ini sudah pernah dipakai santri dan butuh konfirmasi tambahan untuk dihapus.");
    }

    const existingOptions = await ctx.db
      .query("quiz_options")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
      .collect();

    for (const option of existingOptions) {
      await ctx.db.delete(option._id);
    }

    for (const answer of allAnswers) {
      if (answer.quizId === args.quizId) {
        await ctx.db.delete(answer._id);
      }
    }

    for (const progress of allProgress) {
      if (progress.quizId === args.quizId) {
        await ctx.db.patch(progress._id, { quizId: undefined });
      }
    }

    await ctx.db.delete(args.quizId);
    return args.quizId;
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
