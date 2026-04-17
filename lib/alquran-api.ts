import {
  QURAN_API_BASE,
  QURAN_EDITION_ARABIC,
  QURAN_EDITION_TRANSLATION,
  QURAN_EDITION_AUDIO,
} from "./constants";

// Types
export interface Surah {
  number: number;
  name: string; // Arabic name
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: "Meccan" | "Medinan";
}

export interface Ayah {
  number: number;
  text: string;
  audio?: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
}

export interface SurahDetail {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: Ayah[];
}

export interface Edition {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: string;
  type: string;
  direction: string | null;
}

interface ApiResponse<T> {
  code: number;
  status: string;
  data: T;
}

// API Helper
async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${QURAN_API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Al-Quran API error: ${response.status}`);
  }
  const json: ApiResponse<T> = await response.json();
  if (json.code !== 200) {
    throw new Error(`Al-Quran API error: ${json.status}`);
  }
  return json.data;
}

// === SURAH ===

/** Get list of all 114 surahs */
export async function getAllSurahs(): Promise<Surah[]> {
  return fetchApi<Surah[]>("/surah");
}

/** Get a surah with Arabic text (Uthmani) */
export async function getSurahArabic(
  surahNumber: number
): Promise<SurahDetail> {
  return fetchApi<SurahDetail>(
    `/surah/${surahNumber}/${QURAN_EDITION_ARABIC}`
  );
}

/** Get a surah with Indonesian translation */
export async function getSurahTranslation(
  surahNumber: number
): Promise<SurahDetail> {
  return fetchApi<SurahDetail>(
    `/surah/${surahNumber}/${QURAN_EDITION_TRANSLATION}`
  );
}

/** Get a surah with a custom edition */
export async function getSurahByEdition(
  surahNumber: number,
  edition: string
): Promise<SurahDetail> {
  return fetchApi<SurahDetail>(`/surah/${surahNumber}/${edition}`);
}

/** Get a surah with both Arabic and translation */
export async function getSurahWithTranslation(
  surahNumber: number
): Promise<SurahDetail[]> {
  return fetchApi<SurahDetail[]>(
    `/surah/${surahNumber}/editions/${QURAN_EDITION_ARABIC},${QURAN_EDITION_TRANSLATION}`
  );
}

/** Get a surah with custom Arabic edition + custom translation edition */
export async function getSurahMultiEdition(
  surahNumber: number,
  editions: string[]
): Promise<SurahDetail[]> {
  return fetchApi<SurahDetail[]>(
    `/surah/${surahNumber}/editions/${editions.join(",")}`
  );
}

/** Get a surah with audio */
export async function getSurahAudio(
  surahNumber: number
): Promise<SurahDetail> {
  return fetchApi<SurahDetail>(
    `/surah/${surahNumber}/${QURAN_EDITION_AUDIO}`
  );
}

// === JUZ ===

/** Get a juz with Arabic text */
export async function getJuz(juzNumber: number): Promise<SurahDetail> {
  return fetchApi<SurahDetail>(
    `/juz/${juzNumber}/${QURAN_EDITION_ARABIC}`
  );
}

// === PAGE ===

/** Get a page of the Quran */
export async function getPage(pageNumber: number): Promise<SurahDetail> {
  return fetchApi<SurahDetail>(
    `/page/${pageNumber}/${QURAN_EDITION_ARABIC}`
  );
}

// === AYAH ===

/** Get a specific ayah with translation */
export async function getAyah(
  ayahNumber: number
): Promise<{ text: string; numberInSurah: number }> {
  return fetchApi(`/ayah/${ayahNumber}/${QURAN_EDITION_TRANSLATION}`);
}

// === SEARCH ===

/** Search the Quran text */
export async function searchQuran(
  keyword: string,
  surah?: number | "all"
): Promise<{ count: number; matches: Ayah[] }> {
  const surahParam = surah ?? "all";
  return fetchApi(
    `/search/${encodeURIComponent(keyword)}/${surahParam}/${QURAN_EDITION_TRANSLATION}`
  );
}

// === META ===

/** Get metadata about the Quran */
export async function getQuranMeta(): Promise<unknown> {
  return fetchApi("/meta");
}

// === EDITIONS ===

/** Get all available editions */
export async function getEditions(): Promise<Edition[]> {
  return fetchApi<Edition[]>("/edition");
}

// === PAGE DATA (with surah info per ayah) ===

export interface PageAyah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
  surah: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
    numberOfAyahs: number;
  };
}

export interface PageData {
  number: number;
  ayahs: PageAyah[];
  surahs: Record<string, Surah>;
  edition: Edition;
}

/** Get a Quran page with full ayah data including surah info */
export async function getPageData(pageNumber: number): Promise<PageData> {
  return fetchApi<PageData>(
    `/page/${pageNumber}/${QURAN_EDITION_ARABIC}`
  );
}
