import { describe, expect, test } from "vitest";
import { getSurahForPage, getJuzForPage } from "./quranPages";

describe("getSurahForPage", () => {
  test("page 1 is Al-Fatihah", () => {
    expect(getSurahForPage(1)).toEqual({ surahNumber: 1, surahName: "Al-Fatihah" });
  });

  test("page 2 is Al-Baqarah (starts right after Al-Fatihah)", () => {
    expect(getSurahForPage(2)).toEqual({ surahNumber: 2, surahName: "Al-Baqarah" });
  });

  test("mid-surah page resolves to the surah that started earlier, not the next one", () => {
    // Al-Baqarah starts at page 2, Ali 'Imran at page 50 — page 49 is still Al-Baqarah.
    expect(getSurahForPage(49).surahNumber).toBe(2);
  });

  test("when several short surahs start on the same page, returns the lowest (topmost) one", () => {
    // Surah 82 and 83 both start on mushaf page 587.
    const result = getSurahForPage(587);
    expect(result.surahNumber).toBe(82);
  });

  test("last page (604) resolves to the topmost of the three surahs that start there", () => {
    // Al-Ikhlas (112), Al-Falaq (113), and An-Nas (114) all start on page 604.
    expect(getSurahForPage(604).surahNumber).toBe(112);
  });
});

describe("getJuzForPage", () => {
  test("page 1 is juz 1", () => {
    expect(getJuzForPage(1)).toBe(1);
  });

  test("page right before a juz boundary stays in the previous juz", () => {
    // Juz 2 starts at page 22 — page 21 must still be juz 1.
    expect(getJuzForPage(21)).toBe(1);
    expect(getJuzForPage(22)).toBe(2);
  });

  test("last page (604) is juz 30", () => {
    expect(getJuzForPage(604)).toBe(30);
  });
});
