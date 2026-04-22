import { action } from "./_generated/server";
import { v } from "convex/values";

type MistakeItem = {
  wordIndex: number;
  expected: string;
  recognized: string;
  type: "missing" | "different" | "extra";
};

type WordStatus = "correct" | "partial" | "wrong" | "missing";

type ExpectedWordStatus = {
  displayIndex: number;
  word: string;
  status: WordStatus;
  recognized: string;
  similarity: number;
  note: string;
};

type ExtraWordItem = {
  recognized: string;
  atRecognizedIndex: number;
  note: string;
};

type AlignmentOp =
  | { type: "sub"; expectedIndex: number; recognizedIndex: number; similarity: number }
  | { type: "missing"; expectedIndex: number }
  | { type: "extra"; recognizedIndex: number };

function normalizeArabic(text: string): string {
  return text
    .replace(/[\u0640]/g, "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[^\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArabicWord(word: string): string {
  return normalizeArabic(word).replace(/\s+/g, "");
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

function similarityRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length, 1);
  return Math.max(0, 1 - dist / maxLen);
}

function tokenizeExpectedWords(expectedText: string) {
  const displayWords = expectedText.split(/\s+/).filter(Boolean);
  const normalizedWords: string[] = [];
  const normalizedToDisplayIndex: number[] = [];

  for (let i = 0; i < displayWords.length; i += 1) {
    const normalized = normalizeArabicWord(displayWords[i]);
    if (!normalized) continue;
    normalizedWords.push(normalized);
    normalizedToDisplayIndex.push(i);
  }

  return { displayWords, normalizedWords, normalizedToDisplayIndex };
}

function tokenizeRecognizedWords(recognizedText: string): string[] {
  return recognizedText
    .split(/\s+/)
    .map((w) => normalizeArabicWord(w))
    .filter(Boolean);
}

function alignWords(expected: string[], recognized: string[]): AlignmentOp[] {
  const m = expected.length;
  const n = recognized.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );
  const parent: ("sub" | "missing" | "extra")[][] = Array.from(
    { length: m + 1 },
    () => Array.from({ length: n + 1 }, () => "sub")
  );

  for (let i = 1; i <= m; i += 1) {
    dp[i][0] = i;
    parent[i][0] = "missing";
  }
  for (let j = 1; j <= n; j += 1) {
    dp[0][j] = j;
    parent[0][j] = "extra";
  }

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const sim = similarityRatio(expected[i - 1], recognized[j - 1]);
      const subCost = 1 - sim;

      const subVal = dp[i - 1][j - 1] + subCost;
      const missVal = dp[i - 1][j] + 1;
      const extraVal = dp[i][j - 1] + 1;

      let best = subVal;
      let op: "sub" | "missing" | "extra" = "sub";

      if (missVal < best) {
        best = missVal;
        op = "missing";
      }
      if (extraVal < best) {
        best = extraVal;
        op = "extra";
      }

      dp[i][j] = best;
      parent[i][j] = op;
    }
  }

  const ops: AlignmentOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    const op = parent[i][j];
    if (i > 0 && j > 0 && op === "sub") {
      ops.push({
        type: "sub",
        expectedIndex: i - 1,
        recognizedIndex: j - 1,
        similarity: similarityRatio(expected[i - 1], recognized[j - 1]),
      });
      i -= 1;
      j -= 1;
    } else if (i > 0 && (j === 0 || op === "missing")) {
      ops.push({ type: "missing", expectedIndex: i - 1 });
      i -= 1;
    } else {
      ops.push({ type: "extra", recognizedIndex: j - 1 });
      j -= 1;
    }
  }

  ops.reverse();
  return ops;
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

    const expectedTokenized = tokenizeExpectedWords(args.expectedText);

    if (!transcriptRaw) {
      const expectedWordStatuses: ExpectedWordStatus[] = expectedTokenized.normalizedWords.map(
        (word, idx) => ({
          displayIndex: expectedTokenized.normalizedToDisplayIndex[idx],
          word,
          status: "missing",
          recognized: "",
          similarity: 0,
          note: "Kata ini belum terbaca.",
        })
      );

      return {
        transcript: "",
        score: 0,
        pronunciationScore: 0,
        tajwidScore: 0,
        fluencyScore: 0,
        expectedWordStatuses,
        extraWords: [] as ExtraWordItem[],
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

    const expectedWords = useArabic
      ? expectedTokenized.normalizedWords
      : expectedComparable.split(" ").filter(Boolean);
    const recognizedWords = useArabic
      ? tokenizeRecognizedWords(transcriptRaw)
      : transcriptComparable.split(" ").filter(Boolean);

    const ops = alignWords(expectedWords, recognizedWords);

    const expectedWordStatuses: ExpectedWordStatus[] = expectedWords.map((word, idx) => ({
      displayIndex: useArabic ? expectedTokenized.normalizedToDisplayIndex[idx] : idx,
      word,
      status: "missing",
      recognized: "",
      similarity: 0,
      note: "Kata ini belum terbaca.",
    }));
    const extraWords: ExtraWordItem[] = [];

    let correctCount = 0;
    let partialCount = 0;
    let wrongCount = 0;
    let missingCount = 0;

    for (const op of ops) {
      if (op.type === "extra") {
        extraWords.push({
          recognized: recognizedWords[op.recognizedIndex] ?? "",
          atRecognizedIndex: op.recognizedIndex,
          note: "Lafaz tambahan di luar ayat target.",
        });
        continue;
      }

      if (op.type === "missing") {
        missingCount += 1;
        continue;
      }

      const recognizedWord = recognizedWords[op.recognizedIndex] ?? "";
      const status =
        op.similarity >= 0.88
          ? "correct"
          : op.similarity >= 0.6
            ? "partial"
            : "wrong";

      if (status === "correct") correctCount += 1;
      if (status === "partial") partialCount += 1;
      if (status === "wrong") wrongCount += 1;

      expectedWordStatuses[op.expectedIndex] = {
        ...expectedWordStatuses[op.expectedIndex],
        status,
        recognized: recognizedWord,
        similarity: op.similarity,
        note:
          status === "correct"
            ? "Lafaz sesuai target."
            : status === "partial"
              ? "Mendekati benar, perbaiki makhraj/harakat."
              : "Lafaz berbeda dari target.",
      };
    }

    missingCount += expectedWordStatuses.filter((w) => w.status === "missing").length;

    const expectedCount = Math.max(expectedWordStatuses.length, 1);
    const weightedAccuracy =
      (correctCount + partialCount * 0.6) / expectedCount;

    const pronunciationPenalty = wrongCount * 5 + missingCount * 6 + extraWords.length * 3;
    const tajwidPenalty = wrongCount * 6 + missingCount * 4;
    const fluencyPenalty = extraWords.length * 7 + missingCount * 2;

    const pronunciationScore = Math.max(
      0,
      Math.min(100, Math.round(weightedAccuracy * 100 - pronunciationPenalty))
    );
    const tajwidScore = Math.max(
      0,
      Math.min(100, Math.round(weightedAccuracy * 100 - tajwidPenalty))
    );
    const fluencyScore = Math.max(
      0,
      Math.min(100, Math.round(weightedAccuracy * 100 - fluencyPenalty))
    );
    const score = Math.round((pronunciationScore + tajwidScore + fluencyScore) / 3);

    const wordMistakes = expectedWordStatuses
      .filter((item) => item.status !== "correct")
      .slice(0, 8)
      .map((item) => ({
        wordIndex: item.displayIndex,
        expected: item.word,
        recognized: item.recognized,
        type: item.status === "missing" ? "missing" : "different",
        note: item.note,
      }));

    const extraMistakes = extraWords.slice(0, 4).map((item) => ({
      wordIndex: item.atRecognizedIndex,
      expected: "",
      recognized: item.recognized,
      type: "extra",
      note: item.note,
    }));

    const mistakes = [...wordMistakes, ...extraMistakes];

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
      expectedWordStatuses,
      extraWords,
      mistakes,
      recommendation,
    };
  },
});
