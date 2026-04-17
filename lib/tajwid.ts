/**
 * Tajwid (Hukum Bacaan) detection for Arabic Quran text.
 *
 * Detects common tajwid rules from Arabic text characters and patterns.
 * This is a simplified rule-based detector — not a full phonological analyzer.
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
};

// Arabic character references
const SUKUN = "\u0652";
const TANWIN_FATHAH = "\u064B";
const TANWIN_DAMMAH = "\u064C";
const TANWIN_KASRAH = "\u064D";
const SHADDA = "\u0651";
const NUN = "ن";
const MIM = "م";
const BA = "ب";

// Huruf groups
const IDGHAM_BIGHUNNAH = ["ي", "ن", "م", "و"];
const IDGHAM_BILAGHUNNAH = ["ل", "ر"];
const IZHAR_HALQI = ["ء", "ه", "ع", "ح", "غ", "خ"];
const IKHFA_LETTERS = [
  "ت", "ث", "ج", "د", "ذ", "ز", "س", "ش",
  "ص", "ض", "ط", "ظ", "ف", "ق", "ك",
];
const QALQALAH_LETTERS = ["ق", "ط", "ب", "ج", "د"];

/**
 * Analyze an ayah's Arabic text and return which tajwid rules are present.
 */
export function detectTajwidRules(arabicText: string): string[] {
  const found = new Set<string>();
  const chars = [...arabicText];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1] ?? "";
    const next2 = chars[i + 2] ?? "";

    // Find the next "base letter" (skip diacritics)
    const nextBaseLetter = findNextBaseLetter(chars, i + 1);

    // --- Nun Sukun / Tanwin rules ---
    const isNunSukun = ch === NUN && next === SUKUN;
    const isTanwin =
      ch === TANWIN_FATHAH ||
      ch === TANWIN_DAMMAH ||
      ch === TANWIN_KASRAH;

    if (isNunSukun || isTanwin) {
      const target = isNunSukun
        ? findNextBaseLetter(chars, i + 2)
        : nextBaseLetter;

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
      const target = findNextBaseLetter(chars, i + 2);
      if (target === BA) {
        found.add("ikhfa_syafawi");
      } else if (target === MIM) {
        found.add("idgham_mimi");
      }
    }

    // --- Mad Thabi'i (simplified: alif/waw/ya after specific harakat) ---
    if (ch === "ا" || ch === "و" || ch === "ي") {
      // Check if preceded by a matching harakat (simplified detection)
      const prev = chars[i - 1] ?? "";
      if (
        (ch === "ا" && prev === "\u064E") || // fathah + alif
        (ch === "و" && prev === "\u064F") || // dammah + waw
        (ch === "ي" && prev === "\u0650") // kasrah + ya
      ) {
        found.add("mad_thabii");
      }
    }
  }

  return Array.from(found);
}

function findNextBaseLetter(chars: string[], startIdx: number): string | null {
  const diacritics = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;
  for (let i = startIdx; i < chars.length; i++) {
    if (!diacritics.test(chars[i]) && chars[i].trim() !== "") {
      return chars[i];
    }
  }
  return null;
}

/**
 * Get the detected tajwid rule objects for a given Arabic text.
 */
export function getTajwidInfo(arabicText: string): TajwidRule[] {
  const ruleKeys = detectTajwidRules(arabicText);
  return ruleKeys.map((key) => TAJWID_RULES[key]).filter(Boolean);
}

// --- Inline coloring helpers ---

const isDiacriticChar = (c: string) =>
  /[\u064B-\u065F\u0670\u06D6-\u06ED\u0610-\u061A]/.test(c);

function nextBaseIndex(chars: string[], start: number): number | null {
  for (let i = start; i < chars.length; i++) {
    if (!isDiacriticChar(chars[i]) && chars[i].trim()) return i;
  }
  return null;
}

function letterEndIndex(chars: string[], baseIdx: number): number {
  let end = baseIdx + 1;
  while (end < chars.length && isDiacriticChar(chars[end])) end++;
  return end; // exclusive
}

function markColors(
  colors: (string | null)[],
  from: number,
  to: number,
  color: string
) {
  for (let j = from; j < to && j < colors.length; j++) {
    if (colors[j] === null) colors[j] = color;
  }
}

/**
 * Colorize Arabic text with tajwid rule colors.
 * Returns segments of text, each with a color or null (default).
 */
export function colorizeArabicText(arabicText: string): ColoredSegment[] {
  const chars = [...arabicText];
  if (chars.length === 0) return [];

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
      const tIdx = nextBaseIndex(chars, searchFrom);

      if (tIdx !== null) {
        const target = chars[tIdx];
        let ruleKey: string | null = null;

        if (IDGHAM_BIGHUNNAH.includes(target)) ruleKey = "idgham_bighunnah";
        else if (IDGHAM_BILAGHUNNAH.includes(target))
          ruleKey = "idgham_bilaghunnah";
        else if (target === BA) ruleKey = "iqlab";
        else if (IZHAR_HALQI.includes(target)) ruleKey = "izhar";
        else if (IKHFA_LETTERS.includes(target)) ruleKey = "ikhfa";

        if (ruleKey) {
          const c = TAJWID_RULES[ruleKey].color;
          if (isNunSukun) {
            markColors(colors, i, i + 2, c);
          } else {
            // tanwin diacritic + the letter it's on (letter is before tanwin)
            const prevBase = i > 0 ? i - 1 : i;
            markColors(colors, prevBase, i + 1, c);
          }
          markColors(colors, tIdx, letterEndIndex(chars, tIdx), c);
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
      const tIdx = nextBaseIndex(chars, i + 2);
      if (tIdx !== null) {
        const target = chars[tIdx];
        let ruleKey: string | null = null;
        if (target === BA) ruleKey = "ikhfa_syafawi";
        else if (target === MIM) ruleKey = "idgham_mimi";

        if (ruleKey) {
          const c = TAJWID_RULES[ruleKey].color;
          markColors(colors, i, i + 2, c);
          markColors(colors, tIdx, letterEndIndex(chars, tIdx), c);
        }
      }
    }

    // === Mad Thabi'i ===
    if (ch === "ا" || ch === "و" || ch === "ي") {
      const prev = chars[i - 1] ?? "";
      if (
        (ch === "ا" && prev === "\u064E") ||
        (ch === "و" && prev === "\u064F") ||
        (ch === "ي" && prev === "\u0650")
      ) {
        markColors(colors, i - 1, i + 1, TAJWID_RULES.mad_thabii.color);
      }
    }
  }

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
