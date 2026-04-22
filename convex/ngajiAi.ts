import { action } from "./_generated/server";
import { v } from "convex/values";

type MistakeItem = {
  wordIndex: number;
  expected: string;
  recognized: string;
  type: "missing" | "different" | "extra";
};

function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[^\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLatin(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

function buildMistakes(expectedText: string, recognizedText: string): MistakeItem[] {
  const expected = expectedText.split(" ").filter(Boolean);
  const recognized = recognizedText.split(" ").filter(Boolean);

  const maxLen = Math.max(expected.length, recognized.length);
  const mistakes: MistakeItem[] = [];

  for (let i = 0; i < maxLen; i += 1) {
    const exp = expected[i];
    const rec = recognized[i];

    if (exp && !rec) {
      mistakes.push({
        wordIndex: i,
        expected: exp,
        recognized: "",
        type: "missing",
      });
      continue;
    }

    if (!exp && rec) {
      mistakes.push({
        wordIndex: i,
        expected: "",
        recognized: rec,
        type: "extra",
      });
      continue;
    }

    if (exp && rec && exp !== rec) {
      mistakes.push({
        wordIndex: i,
        expected: exp,
        recognized: rec,
        type: "different",
      });
    }
  }

  return mistakes.slice(0, 8);
}

export const analyzeRecitation = action({
  args: {
    surahNumber: v.number(),
    ayahNumber: v.number(),
    expectedText: v.string(),
    audioBase64: v.string(),
    mimeType: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY belum diset di environment Convex.");
    }

    const mimeType = args.mimeType ?? "audio/webm";
    const extension = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : "webm";

    const audioBuffer = Buffer.from(args.audioBase64, "base64");
    const audioBlob = new Blob([audioBuffer], { type: mimeType });

    const formData = new FormData();
    formData.append("model", "gpt-4o-mini-transcribe");
    formData.append("language", "ar");
    formData.append("file", audioBlob, `recitation.${extension}`);

    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const detail = await transcriptionResponse.text();
      throw new Error(`Gagal memproses audio: ${detail}`);
    }

    const transcriptionJson = (await transcriptionResponse.json()) as { text?: string };
    const transcriptRaw = (transcriptionJson.text ?? "").trim();

    if (!transcriptRaw) {
      return {
        transcript: "",
        score: 0,
        pronunciationScore: 0,
        tajwidScore: 0,
        fluencyScore: 0,
        mistakes: [
          {
            wordIndex: 0,
            expected: "",
            recognized: "",
            type: "different",
            note: "Suara tidak terbaca jelas. Coba rekam ulang di tempat lebih tenang.",
          },
        ],
        recommendation: "Pastikan mikrofon aktif dan jarak mulut ke mic sekitar 10-15 cm.",
      };
    }

    const expectedArabic = normalizeArabic(args.expectedText);
    const transcriptArabic = normalizeArabic(transcriptRaw);

    const expectedLatin = normalizeLatin(args.expectedText);
    const transcriptLatin = normalizeLatin(transcriptRaw);

    const useArabic = transcriptArabic.length > 0 && expectedArabic.length > 0;
    const expectedComparable = useArabic ? expectedArabic : expectedLatin;
    const transcriptComparable = useArabic ? transcriptArabic : transcriptLatin;

    const distance = levenshtein(expectedComparable, transcriptComparable);
    const maxLen = Math.max(expectedComparable.length, 1);
    const rawAccuracy = Math.max(0, 100 - (distance / maxLen) * 100);

    const pronunciationScore = Math.round(rawAccuracy);
    const tajwidScore = Math.round(Math.max(0, pronunciationScore - 8));
    const fluencyScore = Math.round(Math.min(100, pronunciationScore + 4));
    const score = Math.round((pronunciationScore + tajwidScore + fluencyScore) / 3);

    const mistakes = buildMistakes(expectedComparable, transcriptComparable).map((item) => ({
      ...item,
      note:
        item.type === "missing"
          ? "Bagian ini belum terbaca atau terlewat."
          : item.type === "extra"
            ? "Ada tambahan lafaz yang tidak terdeteksi pada ayat target."
            : "Lafaz berbeda dari ayat target, perhatikan makhraj dan harakat.",
    }));

    const recommendation =
      score >= 85
        ? "Bagus, bacaan sudah sangat baik. Tingkatkan stabilitas tempo agar lebih konsisten."
        : score >= 70
          ? "Cukup baik. Ulangi ayat perlahan sambil mendengarkan qari referensi lalu rekam ulang."
          : "Perlu latihan lagi. Fokus pada makhraj huruf dan ulang per kata sebelum membaca penuh.";

    return {
      transcript: transcriptRaw,
      score,
      pronunciationScore,
      tajwidScore,
      fluencyScore,
      mistakes,
      recommendation,
    };
  },
});
