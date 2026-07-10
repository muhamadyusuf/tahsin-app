import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

type MistakeItem = {
  wordIndex: number;
  expected: string;
  recognized: string;
  type: "missing" | "different" | "extra";
};

type WordStatus = "correct" | "partial" | "wrong" | "missing";

type LetterStatus = {
  letter: string;
  correct: boolean;
};

type ExpectedWordStatus = {
  displayIndex: number;
  word: string;
  status: WordStatus;
  recognized: string;
  similarity: number;
  note: string;
  letters: LetterStatus[];
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
    // Samakan varian alif (wasla/hamzah/madda) dan alif maqsura dengan bentuk
    // dasarnya \u2014 teks mushaf memakai alif wasla sementara hasil transkripsi
    // memakai alif biasa, sehingga tanpa ini semua kata berawalan lam-alif
    // ("al-") dicap salah di huruf pertamanya.
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
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

// Sejajarkan huruf kata target dengan kata hasil transkripsi (backtrace
// Levenshtein) untuk menandai huruf mana yang terbaca benar — dipakai untuk
// highlight per huruf ala ngaji.ai.
function alignLetters(expected: string, recognized: string): LetterStatus[] {
  const m = expected.length;
  const n = recognized.length;

  const statuses: LetterStatus[] = Array.from({ length: m }, (_, i) => ({
    letter: expected[i],
    correct: false,
  }));
  if (m === 0 || n === 0) return statuses;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = expected[i - 1] === recognized[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (expected[i - 1] === recognized[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      statuses[i - 1].correct = true;
      i -= 1;
      j -= 1;
    } else if (dp[i][j] === dp[i - 1][j - 1] + 1) {
      i -= 1;
      j -= 1;
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return statuses;
}

function allLettersWrong(word: string): LetterStatus[] {
  return word.split("").map((letter) => ({ letter, correct: false }));
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

// Transkripsi lewat Gemini: audio dikirim inline sebagai base64 ke
// generateContent. Prompt menekankan transkripsi verbatim supaya model tidak
// "membetulkan" bacaan yang salah menjadi teks ayat yang benar.
async function transcribeWithGemini(
  apiKey: string,
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const prompt =
    "Transkripsikan audio bacaan Al-Quran ini dalam huruf Arab, persis seperti " +
    "yang benar-benar diucapkan pembaca — termasuk jika ada kesalahan lafaz, " +
    "kata yang terlewat, atau tambahan. Jangan mengoreksi bacaan menjadi teks " +
    "ayat yang seharusnya. Keluarkan hanya teks transkripsinya tanpa penjelasan, " +
    "tanpa tanda kutip. Jika tidak ada ucapan yang terdengar, keluarkan teks kosong.";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: audioBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gagal memproses audio (Gemini): ${detail}`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");
  return text.trim();
}

// Ubah base64 menjadi Blob audio. atob dipakai (bukan Buffer) karena action
// ini berjalan di runtime default Convex yang tidak menyediakan Node Buffer.
function base64ToAudioBlob(audioBase64: string, mimeType: string): Blob {
  const binary = atob(audioBase64);
  const audioBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    audioBytes[i] = binary.charCodeAt(i);
  }
  return new Blob([audioBytes], { type: mimeType });
}

function audioExtension(mimeType: string): string {
  return mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : "webm";
}

async function transcribeWithOpenAI(
  apiKey: string,
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const formData = new FormData();
  formData.append("model", "gpt-4o-mini-transcribe");
  formData.append("language", "ar");
  formData.append(
    "file",
    base64ToAudioBlob(audioBase64, mimeType),
    `recitation.${audioExtension(mimeType)}`
  );

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gagal memproses audio: ${detail}`);
  }

  const json = (await response.json()) as { text?: string };
  return (json.text ?? "").trim();
}

// Transkripsi lewat Mistral (model audio Voxtral) — endpoint transcriptions
// dengan bentuk multipart yang serupa dengan OpenAI.
async function transcribeWithMistral(
  apiKey: string,
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const model = process.env.MISTRAL_TRANSCRIBE_MODEL ?? "voxtral-mini-latest";

  const formData = new FormData();
  formData.append("model", model);
  formData.append("language", "ar");
  formData.append(
    "file",
    base64ToAudioBlob(audioBase64, mimeType),
    `recitation.${audioExtension(mimeType)}`
  );

  const response = await fetch("https://api.mistral.ai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      // Dokumentasi endpoint audio Mistral memakai x-api-key; Bearer juga
      // diterima di API utama — kirim keduanya agar tahan perubahan.
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gagal memproses audio (Mistral): ${detail}`);
  }

  const json = (await response.json()) as { text?: string };
  return (json.text ?? "").trim();
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
    const keys = {
      gemini: process.env.GEMINI_API_KEY,
      mistral: process.env.MISTRAL_API_KEY,
      openai: process.env.OPENAI_API_KEY,
    } as const;
    type Provider = keyof typeof keys;

    // NGAJI_AI_PROVIDER memaksa penyedia tertentu; tanpa itu pakai kunci yang
    // tersedia dengan urutan prioritas gemini → mistral → openai.
    const forced = process.env.NGAJI_AI_PROVIDER?.toLowerCase();
    let provider: Provider;
    if (forced) {
      if (!(forced in keys)) {
        throw new Error(
          `NGAJI_AI_PROVIDER tidak dikenal: "${forced}". Pilihan: gemini, mistral, openai.`
        );
      }
      provider = forced as Provider;
      if (!keys[provider]) {
        throw new Error(
          `NGAJI_AI_PROVIDER=${provider} tetapi kunci API-nya belum diset di environment Convex.`
        );
      }
    } else {
      const available = (Object.keys(keys) as Provider[]).find((p) => keys[p]);
      if (!available) {
        throw new Error(
          "Set GEMINI_API_KEY, MISTRAL_API_KEY, atau OPENAI_API_KEY di environment " +
            "Convex, misal: npx convex env set GEMINI_API_KEY <kunci>"
        );
      }
      provider = available;
    }

    const mimeType = args.mimeType ?? "audio/webm";
    const apiKey = keys[provider]!;
    const transcriptRaw =
      provider === "gemini"
        ? await transcribeWithGemini(apiKey, args.audioBase64, mimeType)
        : provider === "mistral"
          ? await transcribeWithMistral(apiKey, args.audioBase64, mimeType)
          : await transcribeWithOpenAI(apiKey, args.audioBase64, mimeType);

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
          letters: allLettersWrong(word),
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
      letters: allLettersWrong(word),
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

      const letters =
        status === "correct"
          ? expectedWordStatuses[op.expectedIndex].word
              .split("")
              .map((letter) => ({ letter, correct: true }))
          : alignLetters(expectedWordStatuses[op.expectedIndex].word, recognizedWord);
      const wrongLetters = letters
        .filter((l) => !l.correct)
        .map((l) => l.letter);

      expectedWordStatuses[op.expectedIndex] = {
        ...expectedWordStatuses[op.expectedIndex],
        status,
        recognized: recognizedWord,
        similarity: op.similarity,
        letters,
        note:
          status === "correct"
            ? "Lafaz sesuai target."
            : (status === "partial"
                ? "Mendekati benar, perbaiki makhraj/harakat."
                : "Lafaz berbeda dari target.") +
              (wrongLetters.length > 0
                ? ` Perhatikan huruf: ${wrongLetters.join("، ")}`
                : ""),
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

const wordStatusValidator = v.object({
  displayIndex: v.float64(),
  word: v.string(),
  status: v.string(),
  recognized: v.string(),
  similarity: v.float64(),
  note: v.string(),
  letters: v.optional(
    v.array(v.object({ letter: v.string(), correct: v.boolean() }))
  ),
});

const mistakeValidator = v.object({
  wordIndex: v.float64(),
  expected: v.string(),
  recognized: v.string(),
  type: v.string(),
  note: v.string(),
});

const extraWordValidator = v.object({
  recognized: v.string(),
  atRecognizedIndex: v.float64(),
  note: v.string(),
});

// Simpan hasil analisis untuk satu ayat (upsert). Sekaligus memperbarui
// ringkasan per surah supaya daftar surah bisa menampilkan skor & progres
// tanpa membaca seluruh hasil.
export const saveResult = mutation({
  args: {
    userId: v.id("users"),
    surahNumber: v.float64(),
    ayahNumber: v.float64(),
    totalAyahs: v.float64(),
    score: v.float64(),
    pronunciationScore: v.float64(),
    tajwidScore: v.float64(),
    fluencyScore: v.float64(),
    transcript: v.string(),
    expectedText: v.string(),
    wordStatuses: v.array(wordStatusValidator),
    mistakes: v.array(mistakeValidator),
    extraWords: v.array(extraWordValidator),
    recommendation: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const { totalAyahs, ...resultFields } = args;

    const existing = await ctx.db
      .query("ngaji_ai_results")
      .withIndex("by_userId_surah_ayah", (q) =>
        q
          .eq("userId", args.userId)
          .eq("surahNumber", args.surahNumber)
          .eq("ayahNumber", args.ayahNumber)
      )
      .unique();

    const previousScore = existing?.score ?? 0;
    const bestScore = Math.max(existing?.bestScore ?? 0, args.score);

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...resultFields,
        bestScore,
        attemptCount: existing.attemptCount + 1,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("ngaji_ai_results", {
        ...resultFields,
        bestScore,
        attemptCount: 1,
        updatedAt: now,
      });
    }

    const summary = await ctx.db
      .query("ngaji_ai_surah_summary")
      .withIndex("by_userId_surah", (q) =>
        q.eq("userId", args.userId).eq("surahNumber", args.surahNumber)
      )
      .unique();

    if (summary) {
      await ctx.db.patch(summary._id, {
        totalScore: summary.totalScore - previousScore + args.score,
        ayahDone: existing ? summary.ayahDone : summary.ayahDone + 1,
        totalAyahs,
        lastAyahNumber: args.ayahNumber,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("ngaji_ai_surah_summary", {
        userId: args.userId,
        surahNumber: args.surahNumber,
        totalScore: args.score,
        ayahDone: 1,
        totalAyahs,
        lastAyahNumber: args.ayahNumber,
        updatedAt: now,
      });
    }

    return { bestScore, isImprovement: args.score > previousScore };
  },
});

// Ringkasan semua surah milik user — untuk badge skor di daftar surah.
export const getMySummaries = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ngaji_ai_surah_summary")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(120);
  },
});

// Semua hasil tersimpan milik user untuk satu surah (maks 286 ayat).
export const getSurahResults = query({
  args: { userId: v.id("users"), surahNumber: v.float64() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ngaji_ai_results")
      .withIndex("by_userId_surah", (q) =>
        q.eq("userId", args.userId).eq("surahNumber", args.surahNumber)
      )
      .take(300);
  },
});
