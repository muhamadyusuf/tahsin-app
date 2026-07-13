import { cachedFetch } from "./offline-cache";

const BASE_URL = "https://equran.id/api";

export interface DoaItem {
  id: number;
  grup: string;
  nama: string;
  ar: string;
  tr: string;
  idn: string;
  tentang: string;
  tag: string[];
}

interface DoaAllResponse {
  status: string;
  total: number;
  data: DoaItem[];
}

interface DoaSingleResponse {
  status: string;
  data: DoaItem;
}

export async function getAllDoa(): Promise<DoaItem[]> {
  return cachedFetch("doa:all", async () => {
    const res = await fetch(`${BASE_URL}/doa`);
    if (!res.ok) throw new Error("Gagal memuat daftar do'a");
    const json: DoaAllResponse = await res.json();
    return json.data;
  });
}

export async function getDoaById(id: number): Promise<DoaItem> {
  return cachedFetch(`doa:${id}`, async () => {
    const res = await fetch(`${BASE_URL}/doa/${id}`);
    if (!res.ok) throw new Error("Gagal memuat do'a");
    const json: DoaSingleResponse = await res.json();
    return json.data;
  });
}
