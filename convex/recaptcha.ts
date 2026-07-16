import { v } from "convex/values";
import { action } from "./_generated/server";

export const verify = action({
  args: {
    token: v.string(),
    action: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      throw new Error("RECAPTCHA_SECRET_KEY is not configured");
    }

    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: secretKey,
          response: args.token,
        }),
      }
    );

    const data = (await response.json()) as {
      success: boolean;
      score: number;
      action: string;
      challenge_ts: string;
      hostname: string;
      "error-codes"?: string[];
    };

    return {
      success: data.success,
      score: data.score,
      action: data.action,
    };
  },
});
