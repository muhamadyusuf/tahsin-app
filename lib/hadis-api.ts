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

interface HadisResponse {
  status: boolean;
  data: HadisData;
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

interface HadisSearchResponse {
  status: boolean;
  data: HadisSearchResult;
}

export async function getRandomHadis(): Promise<HadisData> {
  const res = await fetch(`${BASE_URL}/random`);
  if (!res.ok) throw new Error("Gagal memuat hadis");
  const json: HadisResponse = await res.json();
  return json.data;
}

export async function getHadisById(id: number): Promise<HadisData> {
  const res = await fetch(`${BASE_URL}/show/${id}`);
  if (!res.ok) throw new Error("Gagal memuat hadis");
  const json: HadisResponse = await res.json();
  return json.data;
}

export async function getNextHadis(id: number): Promise<HadisData> {
  const res = await fetch(`${BASE_URL}/next/${id}`);
  if (!res.ok) throw new Error("Gagal memuat hadis");
  const json: HadisResponse = await res.json();
  return json.data;
}

export async function getPrevHadis(id: number): Promise<HadisData> {
  const res = await fetch(`${BASE_URL}/prev/${id}`);
  if (!res.ok) throw new Error("Gagal memuat hadis");
  const json: HadisResponse = await res.json();
  return json.data;
}

export async function searchHadis(
  keyword: string,
  page = 1,
  limit = 10
): Promise<HadisSearchResult> {
  const encodedKeyword = encodeURIComponent(keyword);
  const res = await fetch(
    `${BASE_URL}/cari/${encodedKeyword}?page=${page}&limit=${limit}`
  );
  if (!res.ok) throw new Error("Gagal mencari hadis");
  const json: HadisSearchResponse = await res.json();
  return json.data;
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

interface ArbainResponse {
  status: boolean;
  data: ArbainItem;
}

interface ArbainAllResponse {
  status: boolean;
  data: ArbainItem[];
}

export async function getAllArbain(): Promise<ArbainItem[]> {
  const res = await fetch(`${BASE_URL_V2}/arbain/semua`);
  if (!res.ok) throw new Error("Gagal memuat hadis arbain");
  const json: ArbainAllResponse = await res.json();
  return json.data;
}

export async function getArbainByNo(no: number): Promise<ArbainItem> {
  const res = await fetch(`${BASE_URL_V2}/arbain/${no}`);
  if (!res.ok) throw new Error("Gagal memuat hadis arbain");
  const json: ArbainResponse = await res.json();
  return json.data;
}

// Bulughul Maram
export interface BmItem {
  no: number;
  ar: string;
  id: string;
}

interface BmResponse {
  status: boolean;
  info: { min: number; max: number };
  data: BmItem;
}

export async function getBmByNo(no: number): Promise<BmItem> {
  const res = await fetch(`${BASE_URL_V2}/bm/${no}`);
  if (!res.ok) throw new Error("Gagal memuat hadis Bulughul Maram");
  const json: BmResponse = await res.json();
  return json.data;
}

export async function getRandomBm(): Promise<BmItem> {
  const res = await fetch(`${BASE_URL_V2}/bm/acak`);
  if (!res.ok) throw new Error("Gagal memuat hadis Bulughul Maram");
  const json: BmResponse = await res.json();
  return json.data;
}

// 9 Perawi
export interface PerawiInfo {
  name: string;
  slug: string;
  total: number;
}

interface PerawiListResponse {
  status: boolean;
  data: PerawiInfo[];
}

export interface PerawiHadisItem {
  number: number;
  arab: string;
  id: string;
}

interface PerawiHadisResponse {
  status: boolean;
  info: { perawi: PerawiInfo };
  data: PerawiHadisItem;
}

export async function getPerawiList(): Promise<PerawiInfo[]> {
  const res = await fetch(`${BASE_URL_V2}/perawi/`);
  if (!res.ok) throw new Error("Gagal memuat daftar perawi");
  const json: PerawiListResponse = await res.json();
  return json.data;
}

export async function getHadisByPerawi(
  slug: string,
  no: number
): Promise<PerawiHadisItem> {
  const res = await fetch(`${BASE_URL_V2}/${slug}/${no}`);
  if (!res.ok) throw new Error("Gagal memuat hadis perawi");
  const json: PerawiHadisResponse = await res.json();
  return json.data;
}
