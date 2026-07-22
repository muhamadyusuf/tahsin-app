/**
 * Tajwid (Hukum Bacaan) detection for Arabic Quran text.
 *
 * Detects common tajwid rules from Arabic text characters and patterns.
 * This is a rule-based detector covering the standard tajwid categories
 * used by most Indonesian tahsin references.
 */

export interface TajwidRule {
  name: string;
  arabic: string;
  description: string;
  color: string;
}

export interface ColoredSegment {
  text: string;
  color: string | null;
}

// All tajwid categories we detect
export const TAJWID_RULES: Record<string, TajwidRule> = {
  idgham_bighunnah: {
    name: "Idgham Bighunnah",
    arabic: "إدغام بغنة",
    description: "Nun sukun/tanwin bertemu ي ن م و — dilebur dengan dengung",
    color: "#4CAF50", // green
  },
  idgham_bilaghunnah: {
    name: "Idgham Bila Ghunnah",
    arabic: "إدغام بلا غنة",
    description: "Nun sukun/tanwin bertemu ل ر — dilebur tanpa dengung",
    color: "#2196F3", // blue
  },
  ikhfa: {
    name: "Ikhfa Haqiqi",
    arabic: "إخفاء حقيقي",
    description:
      "Nun sukun/tanwin bertemu huruf ikhfa — dibaca samar dengan dengung",
    color: "#FF9800", // orange
  },
  iqlab: {
    name: "Iqlab",
    arabic: "إقلاب",
    description: "Nun sukun/tanwin bertemu ب — berubah menjadi mim",
    color: "#9C27B0", // purple
  },
  izhar: {
    name: "Izhar Halqi",
    arabic: "إظهار حلقي",
    description:
      "Nun sukun/tanwin bertemu huruf halqi (ء هـ ع ح غ خ) — dibaca jelas",
    color: "#F44336", // red
  },
  ghunnah: {
    name: "Ghunnah",
    arabic: "غنة",
    description: "Mim atau nun bertasydid — dibaca dengung 2 harakat",
    color: "#E91E63", // pink
  },
  qalqalah: {
    name: "Qalqalah",
    arabic: "قلقلة",
    description: "Huruf qalqalah (ق ط ب ج د) saat sukun — dibaca memantul",
    color: "#795548", // brown
  },
  mad_thabii: {
    name: "Mad Thabi'i",
    arabic: "مد طبيعي",
    description: "Mad asli — dipanjangkan 2 harakat (alif, waw, ya)",
    color: "#607D8B", // blue-grey
  },
  mad_lin: {
    name: "Mad Lin",
    arabic: "مد لين",
    description:
      "Waw sukun / Ya sukun setelah Fathah — dibaca lunak & panjang 2-6 harakat",
    color: "#26A69A", // teal
  },
  ikhfa_syafawi: {
    name: "Ikhfa Syafawi",
    arabic: "إخفاء شفوي",
    description: "Mim sukun bertemu ب — dibaca samar di bibir",
    color: "#00BCD4", // cyan
  },
  idgham_mimi: {
    name: "Idgham Mimi",
    arabic: "إدغام ميمي",
    description: "Mim sukun bertemu م — dilebur dengan dengung",
    color: "#8BC34A", // light green
  },
  izhar_syafawi: {
    name: "Izhar Syafawi",
    arabic: "إظهار شفوي",
    description:
      "Mim sukun bertemu huruf selain ب dan م — dibaca jelas di bibir",
    color: "#EF5350", // light red
  },
};

// Arabic character references
const SUKUN = "\u0652";
const TANWIN_FATHAH = "\u064B";
const TANWIN_DAMMAH = "\u064C";
const TANWIN_KASRAH = "\u064D";
const SHADDA = "\u0651";
const FATHAH = "\u064E";
const DAMMAH = "\u064F";
const KASRAH = "\u0650";
const NUN = "ن";
const MIM = "م";
const BA = "ب";
const WAW = "و";
const YA = "ي";
const ALIF = "ا";
const ALEF_MAKSURA = "ى";

// Huruf groups
const IDGHAM_BIGHUNNAH = ["ي", "ن", "م", "و"];
const IDGHAM_BILAGHUNNAH = ["ل", "ر"];
const IZHAR_HALQI = ["ء", "ه", "ع", "ح", "غ", "خ"];
const IKHFA_LETTERS = [
  "ت", "ث", "ج", "د", "ذ", "ز", "س", "ش",
  "ص", "ض", "ط", "ظ", "ف", "ق", "ك",
];
const QALQALAH_LETTERS = ["ق", "ط", "ب", "ج", "د"];
const MAD_LETTERS = [ALIF, WAW, YA, ALEF_MAKSURA];

function isDiacriticChar(c: string): boolean {
  return /[\u064B-\u065F\u0670\u06D6-\u06ED\u0610-\u061A]/.test(c);
}

function isSpaceChar(c: string): boolean {
  return c === " " || c === "\u00A0" || c === "\uFEFF";
}

function findNextBaseIndex(chars: string[], startIdx: number): number | null {
  for (let i = startIdx; i < chars.length; i++) {
    if (!isDiacriticChar(chars[i]) && !isSpaceChar(chars[i])) return i;
  }
  return null;
}

/**
 * Analyze an ayah's Arabic text and return which tajwid rules are present.
 */
export function detectTajwidRules(arabicText: string): string[] {
  const found = new Set<string>();
  const chars = [...arabicText];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1] ?? "";

    // --- Nun Sukun / Tanwin rules ---
    const isNunSukun = ch === NUN && next === SUKUN;
    const isTanwin =
      ch === TANWIN_FATHAH || ch === TANWIN_DAMMAH || ch === TANWIN_KASRAH;

    if (isNunSukun || isTanwin) {
      const targetIdx = isNunSukun
        ? findNextBaseIndex(chars, i + 2)
        : findNextBaseIndex(chars, i + 1);
      const target = targetIdx !== null ? chars[targetIdx] : null;

      if (target) {
        if (IDGHAM_BIGHUNNAH.includes(target)) {
          found.add("idgham_bighunnah");
        } else if (IDGHAM_BILAGHUNNAH.includes(target)) {
          found.add("idgham_bilaghunnah");
        } else if (target === BA) {
          found.add("iqlab");
        } else if (IZHAR_HALQI.includes(target)) {
          found.add("izhar");
        } else if (IKHFA_LETTERS.includes(target)) {
          found.add("ikhfa");
        }
      }
    }

    // --- Ghunnah (nun/mim with shadda) ---
    if ((ch === NUN || ch === MIM) && next === SHADDA) {
      found.add("ghunnah");
    }

    // --- Qalqalah (qalqalah letter with sukun) ---
    if (QALQALAH_LETTERS.includes(ch) && next === SUKUN) {
      found.add("qalqalah");
    }

    // --- Mim Sukun rules ---
    if (ch === MIM && next === SUKUN) {
      const targetIdx = findNextBaseIndex(chars, i + 2);
      const target = targetIdx !== null ? chars[targetIdx] : null;
      if (target === BA) {
        found.add("ikhfa_syafawi");
      } else if (target === MIM) {
        found.add("idgham_mimi");
      } else if (target) {
        found.add("izhar_syafawi");
      }
    }

    // --- Mad Thabi'i (simplified: alif/waw/ya after matching harakat) ---
    if (MAD_LETTERS.includes(ch)) {
      const prev = chars[i - 1] ?? "";
      if (
        (ch === ALIF && prev === FATHAH) ||
        (ch === WAW && prev === DAMMAH) ||
        (ch === YA && prev === KASRAH)
      ) {
        found.add("mad_thabii");
      }
    }

    // --- Mad Lin: waw_sukun or ya_sukun preceded by fathah ---
    if ((ch === WAW || ch === YA) && next === SUKUN) {
      const prev = chars[i - 1] ?? "";
      if (prev === FATHAH) {
        found.add("mad_lin");
      }
    }
  }

  return Array.from(found);
}

/**
 * Get the detected tajwid rule objects for a given Arabic text.
 */
export function getTajwidInfo(arabicText: string): TajwidRule[] {
  const ruleKeys = detectTajwidRules(arabicText);
  return ruleKeys.map((key) => TAJWID_RULES[key]).filter(Boolean);
}

// --- Inline coloring helpers ---

function letterEndIndex(chars: string[], baseIdx: number): number {
  let end = baseIdx + 1;
  while (end < chars.length && isDiacriticChar(chars[end])) end++;
  return end; // exclusive
}

function markColors(
  colors: (string | null)[],
  from: number,
  to: number,
  color: string,
) {
  for (let j = from; j < to && j < colors.length; j++) {
    if (colors[j] === null) colors[j] = color;
  }
}

/**
 * Compute per-character color assignments for the given Arabic text.
 * Shared by colorizeArabicText (single-string API) and colorizeWordsByLine
 * (word-aware API used by the mushaf for per-word rendering).
 */
export function computeCharColors(
  chars: string[],
): (string | null)[] {
  const colors: (string | null)[] = new Array(chars.length).fill(null);

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1] ?? "";

    // === Nun Sukun / Tanwin rules ===
    const isNunSukun = ch === NUN && next === SUKUN;
    const isTanwin =
      ch === TANWIN_FATHAH || ch === TANWIN_DAMMAH || ch === TANWIN_KASRAH;

    if (isNunSukun || isTanwin) {
      const searchFrom = isNunSukun ? i + 2 : i + 1;
      const tIdx = findNextBaseIndex(chars, searchFrom);

      if (tIdx !== null) {
        const target = chars[tIdx];
        let ruleKey: string | null = null;

        if (IDGHAM_BIGHUNNAH.includes(target)) ruleKey = "idgham_bighunnah";
        else if (IDGHAM_BILAGHUNNAH.includes(target))
          ruleKey = "idgham_bilaghunnah";
        else if (target === BA) ruleKey = "iqlab";
        else if (IZHAR_HALQI.includes(target)) ruleKey = "izhar";
        else if (IKHFA_LETTERS.includes(target)) ruleKey = "ikhfa";
        else ruleKey = "izhar"; // default izhar for tanwin/nun sukun across word boundary

        // Don't override default izhar color for non-halqi consonants across
        // words — keep izhar strictly to halqi letters. Revert.
        if (ruleKey === "izhar" && !IZHAR_HALQI.includes(target)) {
          ruleKey = null;
        }

        if (ruleKey) {
          const c = TAJWID_RULES[ruleKey].color;
          if (isNunSukun) {
            markColors(colors, i, i + 2, c);
            markColors(colors, tIdx, letterEndIndex(chars, tIdx), c);
          } else {
            // tanwin diacritic + the letter it's on (letter is before tanwin)
            const prevBase = i > 0 ? i - 1 : i;
            markColors(colors, prevBase, i + 1, c);
            markColors(colors, tIdx, letterEndIndex(chars, tIdx), c);
          }
        }
      }
    }

    // === Ghunnah (nun/mim + shadda) ===
    if ((ch === NUN || ch === MIM) && next === SHADDA) {
      markColors(colors, i, letterEndIndex(chars, i), TAJWID_RULES.ghunnah.color);
    }

    // === Qalqalah ===
    if (QALQALAH_LETTERS.includes(ch) && next === SUKUN) {
      markColors(colors, i, i + 2, TAJWID_RULES.qalqalah.color);
    }

    // === Mim Sukun ===
    if (ch === MIM && next === SUKUN) {
      const tIdx = findNextBaseIndex(chars, i + 2);
      if (tIdx !== null) {
        const target = chars[tIdx];
        let ruleKey: string | null = null;
        if (target === BA) ruleKey = "ikhfa_syafawi";
        else if (target === MIM) ruleKey = "idgham_mimi";
        else ruleKey = "izhar_syafawi";

        if (ruleKey) {
          const c = TAJWID_RULES[ruleKey].color;
          markColors(colors, i, i + 2, c);
          markColors(colors, tIdx, letterEndIndex(chars, tIdx), c);
        }
      }
    }

    // === Mad Thabi'i ===
    if (MAD_LETTERS.includes(ch)) {
      const prev = chars[i - 1] ?? "";
      if (
        (ch === ALIF && prev === FATHAH) ||
        (ch === WAW && prev === DAMMAH) ||
        (ch === YA && prev === KASRAH)
      ) {
        markColors(colors, i - 1, i + 1, TAJWID_RULES.mad_thabii.color);
      }
    }

    // === Mad Lin: waw_sukun or ya_sukun after fathah ===
    if ((ch === WAW || ch === YA) && next === SUKUN) {
      const prev = chars[i - 1] ?? "";
      if (prev === FATHAH) {
        markColors(colors, i - 1, i + 2, TAJWID_RULES.mad_lin.color);
      }
    }
  }

  return colors;
}

/**
 * Colorize Arabic text with tajwid rule colors.
 * Returns segments of text, each with a color or null (default).
 */
export function colorizeArabicText(arabicText: string): ColoredSegment[] {
  const chars = [...arabicText];
  if (chars.length === 0) return [];

  const colors = computeCharColors(chars);

  // Build segments by merging consecutive same-color chars
  const segments: ColoredSegment[] = [];
  let curColor = colors[0];
  let curText = chars[0];

  for (let i = 1; i < chars.length; i++) {
    if (colors[i] === curColor) {
      curText += chars[i];
    } else {
      segments.push({ text: curText, color: curColor });
      curColor = colors[i];
      curText = chars[i];
    }
  }
  segments.push({ text: curText, color: curColor });

  return segments;
}

/**
 * Colorize a list of words (e.g. a single mushaf line) WITH cross-word
 * context. Tajwid rules often span word boundaries (e.g. Nun sukun at the
 * end of one word + Ikhfa letter at the start of the next), so analyzing
 * each word in isolation misses most rules. This joins the words with a
 * space separator, runs `computeCharColors` on the combined string, then
 * splits the per-character colors back out to each word.
 *
 * Returns an array (same length as `words`) of either:
 *   - `null`    → the word has no tajwid coloring (use default text color)
 *   - array of colored segments → render each segment with its color
 *
 * @param words Uthmani word strings for one line (e.g. from quran.com API)
 */
export function colorizeWordsByLine(
  words: string[],
): (ColoredSegment[] | null)[] {
  if (words.length === 0) return [];

  // Track each word's span [start, end) in the joined string
  const spans: { start: number; end: number }[] = [];
  let pos = 0;
  const parts: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i > 0) {
      parts.push(" ");
      pos += 1;
    }
    const w = [...words[i]];
    spans.push({ start: pos, end: pos + w.length });
    parts.push(...w);
    pos += w.length;
  }

  const joined = parts;
  const colors = computeCharColors(joined);

  const result: (ColoredSegment[] | null)[] = [];
  for (const span of spans) {
    const wordColors = colors.slice(span.start, span.end);
    const wordChars = joined.slice(span.start, span.end);

    // Check if word has any non-null color
    if (!wordColors.some((c) => c !== null)) {
      result.push(null);
      continue;
    }

    // Build segments within this word
    const segs: ColoredSegment[] = [];
    if (wordChars.length === 0) {
      result.push(null);
      continue;
    }
    let curColor = wordColors[0];
    let curText = wordChars[0];
    for (let i = 1; i < wordChars.length; i++) {
      if (wordColors[i] === curColor) {
        curText += wordChars[i];
      } else {
        segs.push({ text: curText, color: curColor });
        curColor = wordColors[i];
        curText = wordChars[i];
      }
    }
    segs.push({ text: curText, color: curColor });
    result.push(segs);
  }

  return result;
}