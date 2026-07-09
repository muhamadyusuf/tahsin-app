/**
 * Static Uthmani Mushaf page layout data (604-page Madinah Mushaf), used to
 * resolve which surah/juz a bare page number belongs to. Needed on the
 * server because IoT devices only report a page number, unlike the app
 * which already has the full page data from the Quran API.
 */

// Standard Uthmani mushaf: surah number → starting page
export const SURAH_START_PAGE: Record<number, number> = {
  1: 1, 2: 2, 3: 50, 4: 77, 5: 106, 6: 128, 7: 151, 8: 177, 9: 187, 10: 208,
  11: 221, 12: 235, 13: 249, 14: 255, 15: 262, 16: 267, 17: 282, 18: 293,
  19: 305, 20: 312, 21: 322, 22: 332, 23: 342, 24: 350, 25: 359, 26: 367,
  27: 377, 28: 385, 29: 396, 30: 404, 31: 411, 32: 415, 33: 418, 34: 428,
  35: 434, 36: 440, 37: 446, 38: 453, 39: 458, 40: 467, 41: 477, 42: 483,
  43: 489, 44: 496, 45: 499, 46: 502, 47: 507, 48: 511, 49: 515, 50: 518,
  51: 520, 52: 523, 53: 526, 54: 528, 55: 531, 56: 534, 57: 537, 58: 542,
  59: 545, 60: 549, 61: 551, 62: 553, 63: 554, 64: 556, 65: 558, 66: 560,
  67: 562, 68: 564, 69: 566, 70: 568, 71: 570, 72: 572, 73: 574, 74: 575,
  75: 577, 76: 578, 77: 580, 78: 582, 79: 583, 80: 585, 81: 586, 82: 587,
  83: 587, 84: 589, 85: 590, 86: 591, 87: 591, 88: 592, 89: 593, 90: 594,
  91: 595, 92: 595, 93: 596, 94: 596, 95: 597, 96: 597, 97: 598, 98: 598,
  99: 599, 100: 599, 101: 600, 102: 600, 103: 601, 104: 601, 105: 601,
  106: 602, 107: 602, 108: 602, 109: 603, 110: 603, 111: 603, 112: 604,
  113: 604, 114: 604,
};

export const SURAH_ENGLISH_NAME: Record<number, string> = {
  1: "Al-Fatihah", 2: "Al-Baqarah", 3: "Ali 'Imran", 4: "An-Nisa'", 5: "Al-Ma'idah",
  6: "Al-An'am", 7: "Al-A'raf", 8: "Al-Anfal", 9: "At-Taubah", 10: "Yunus",
  11: "Hud", 12: "Yusuf", 13: "Ar-Ra'd", 14: "Ibrahim", 15: "Al-Hijr",
  16: "An-Nahl", 17: "Al-Isra'", 18: "Al-Kahf", 19: "Maryam", 20: "Taha",
  21: "Al-Anbiya'", 22: "Al-Hajj", 23: "Al-Mu'minun", 24: "An-Nur", 25: "Al-Furqan",
  26: "Asy-Syu'ara'", 27: "An-Naml", 28: "Al-Qasas", 29: "Al-'Ankabut", 30: "Ar-Rum",
  31: "Luqman", 32: "As-Sajdah", 33: "Al-Ahzab", 34: "Saba'", 35: "Fatir",
  36: "Yasin", 37: "As-Saffat", 38: "Sad", 39: "Az-Zumar", 40: "Ghafir",
  41: "Fussilat", 42: "Asy-Syura", 43: "Az-Zukhruf", 44: "Ad-Dukhan", 45: "Al-Jasiyah",
  46: "Al-Ahqaf", 47: "Muhammad", 48: "Al-Fath", 49: "Al-Hujurat", 50: "Qaf",
  51: "Az-Zariyat", 52: "At-Tur", 53: "An-Najm", 54: "Al-Qamar", 55: "Ar-Rahman",
  56: "Al-Waqi'ah", 57: "Al-Hadid", 58: "Al-Mujadalah", 59: "Al-Hasyr", 60: "Al-Mumtahanah",
  61: "As-Saff", 62: "Al-Jumu'ah", 63: "Al-Munafiqun", 64: "At-Tagabun", 65: "At-Talaq",
  66: "At-Tahrim", 67: "Al-Mulk", 68: "Al-Qalam", 69: "Al-Haqqah", 70: "Al-Ma'arij",
  71: "Nuh", 72: "Al-Jinn", 73: "Al-Muzzammil", 74: "Al-Muddassir", 75: "Al-Qiyamah",
  76: "Al-Insan", 77: "Al-Mursalat", 78: "An-Naba'", 79: "An-Nazi'at", 80: "'Abasa",
  81: "At-Takwir", 82: "Al-Infitar", 83: "Al-Mutaffifin", 84: "Al-Insyiqaq", 85: "Al-Buruj",
  86: "At-Tariq", 87: "Al-A'la", 88: "Al-Gasyiyah", 89: "Al-Fajr", 90: "Al-Balad",
  91: "Asy-Syams", 92: "Al-Lail", 93: "Ad-Duha", 94: "Asy-Syarh", 95: "At-Tin",
  96: "Al-'Alaq", 97: "Al-Qadr", 98: "Al-Bayyinah", 99: "Az-Zalzalah", 100: "Al-'Adiyat",
  101: "Al-Qari'ah", 102: "At-Takasur", 103: "Al-'Asr", 104: "Al-Humazah", 105: "Al-Fil",
  106: "Quraisy", 107: "Al-Ma'un", 108: "Al-Kausar", 109: "Al-Kafirun", 110: "An-Nasr",
  111: "Al-Masad", 112: "Al-Ikhlas", 113: "Al-Falaq", 114: "An-Nas",
};

// Juz (1-30) → starting page in the 604-page Madinah Mushaf
export const JUZ_START_PAGE: number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

const SURAH_ENTRIES = Object.entries(SURAH_START_PAGE)
  .map(([num, startPage]) => ({ surahNumber: Number(num), startPage }))
  .sort((a, b) => a.startPage - b.startPage);

/**
 * Resolve the surah at the TOP of a given mushaf page (1-604). When a page
 * contains the tail of one surah and the start of the next (or, for very
 * short surahs, several starts on one page), this returns the surah whose
 * text appears first/topmost — i.e. the lowest surah number among those
 * tied for the latest starting page not after `page`.
 */
export function getSurahForPage(page: number): { surahNumber: number; surahName: string } {
  let maxStartPage = SURAH_ENTRIES[0].startPage;
  for (const entry of SURAH_ENTRIES) {
    if (entry.startPage > page) break;
    maxStartPage = entry.startPage;
  }
  const tied = SURAH_ENTRIES.filter((e) => e.startPage === maxStartPage);
  const match = tied.reduce((a, b) => (a.surahNumber < b.surahNumber ? a : b));
  return {
    surahNumber: match.surahNumber,
    surahName: SURAH_ENGLISH_NAME[match.surahNumber] ?? `Surah ${match.surahNumber}`,
  };
}

/** Resolve the juz (1-30) a given mushaf page (1-604) belongs to. */
export function getJuzForPage(page: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGE.length; i++) {
    if (JUZ_START_PAGE[i] > page) break;
    juz = i + 1;
  }
  return juz;
}
