import { cachedFetch } from "./offline-cache";

const BASE_URL = "https://api.myquran.com/v3/hadis/enc";

export interface HadisText {
  ar: string;
  id: string;
}

export interface HadisData {
  id: number;
  text: HadisText;
  grade: string;
  takhrij: string;
  hikmah: string;
  prev: number | null;
  next: number | null;
}

export interface HadisSearchItem {
  id: number;
  text: string;
}

export interface HadisSearchPaging {
  current: number;
  per_page: number;
  total_data: number;
  total_pages: number;
  has_prev: boolean;
  has_next: boolean;
  next_page: number | null;
  prev_page: number | null;
}

export interface HadisSearchResult {
  keyword: string;
  paging: HadisSearchPaging;
  hadis: HadisSearchItem[];
}

// Shared helper — every hadis endpoint below returns `{ data: T }`, so we
// fetch, unwrap, and cache the response by `cacheKey` in one place. A cache
// hit lets the same content re-appear offline instead of an error.
async function fetchHadisJson<T>(
  url: string,
  cacheKey: string,
  errorMessage: string
): Promise<T> {
  return cachedFetch(cacheKey, async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(errorMessage);
    const json: { data: T } = await res.json();
    return json.data;
  });
}

export async function getRandomHadis(): Promise<HadisData> {
  // Stable key on purpose: online, a fresh random pick always wins; offline,
  // the last pick shown is reused so the widget doesn't just show an error.
  return fetchHadisJson(`${BASE_URL}/random`, "hadis:random:last", "Gagal memuat hadis");
}

export async function getHadisById(id: number): Promise<HadisData> {
  return fetchHadisJson(`${BASE_URL}/show/${id}`, `hadis:show:${id}`, "Gagal memuat hadis");
}

export async function getNextHadis(id: number): Promise<HadisData> {
  return fetchHadisJson(`${BASE_URL}/next/${id}`, `hadis:next:${id}`, "Gagal memuat hadis");
}

export async function getPrevHadis(id: number): Promise<HadisData> {
  return fetchHadisJson(`${BASE_URL}/prev/${id}`, `hadis:prev:${id}`, "Gagal memuat hadis");
}

export async function searchHadis(
  keyword: string,
  page = 1,
  limit = 10
): Promise<HadisSearchResult> {
  const encodedKeyword = encodeURIComponent(keyword);
  return fetchHadisJson(
    `${BASE_URL}/cari/${encodedKeyword}?page=${page}&limit=${limit}`,
    `hadis:cari:${keyword}:${page}:${limit}`,
    "Gagal mencari hadis"
  );
}

// ─── v2 API (Arbain, Bulughul Maram, 9 Perawi) ────────────────────────────────
const BASE_URL_V2 = "https://api.myquran.com/v2/hadits";

// Arbain
export interface ArbainItem {
  no: string;
  judul: string;
  arab: string;
  indo: string;
}

export async function getAllArbain(): Promise<ArbainItem[]> {
  return fetchHadisJson(
    `${BASE_URL_V2}/arbain/semua`,
    "arbain:all",
    "Gagal memuat hadis arbain"
  );
}

export async function getArbainByNo(no: number): Promise<ArbainItem> {
  return fetchHadisJson(
    `${BASE_URL_V2}/arbain/${no}`,
    `arbain:${no}`,
    "Gagal memuat hadis arbain"
  );
}

// Bulughul Maram
export interface BmItem {
  no: number;
  ar: string;
  id: string;
}

export async function getBmByNo(no: number): Promise<BmItem> {
  return fetchHadisJson(
    `${BASE_URL_V2}/bm/${no}`,
    `bm:${no}`,
    "Gagal memuat hadis Bulughul Maram"
  );
}

export async function getRandomBm(): Promise<BmItem> {
  return fetchHadisJson(
    `${BASE_URL_V2}/bm/acak`,
    "bm:random:last",
    "Gagal memuat hadis Bulughul Maram"
  );
}

// 9 Perawi
export interface PerawiInfo {
  name: string;
  slug: string;
  total: number;
}

export interface PerawiHadisItem {
  number: number;
  arab: string;
  id: string;
}

export async function getPerawiList(): Promise<PerawiInfo[]> {
  return fetchHadisJson(`${BASE_URL_V2}/perawi/`, "perawi:list", "Gagal memuat daftar perawi");
}

export async function getHadisByPerawi(
  slug: string,
  no: number
): Promise<PerawiHadisItem> {
  return fetchHadisJson(
    `${BASE_URL_V2}/${slug}/${no}`,
    `perawi:${slug}:${no}`,
    "Gagal memuat hadis perawi"
  );
}
