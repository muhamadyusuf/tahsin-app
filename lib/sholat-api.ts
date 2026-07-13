import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { cachedFetch } from "./offline-cache";

const BASE_URL = "https://equran.id/api/v2/shalat";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const STORAGE_KEY = "@tahsin_sholat_location";

// ===== Types =====

export interface SholatJadwal {
  tanggal: string;
  imsak: string;
  subuh: string;
  terbit: string;
  dhuha: string;
  dzuhur: string;
  ashar: string;
  maghrib: string;
  isya: string;
  date: string;
}

export interface SholatData {
  kota: string;
  koordinat?: { lat: string; lon: string; lintang: string; bujur: string };
  jadwal: SholatJadwal[];
}

export interface NextPrayer {
  name: string;
  key: string;
  time: string;
  timeLeft: string;
  minutesLeft: number;
}

export interface LocationResult {
  provinsi: string;
  kabkota: string;
  displayName: string;
}

// ===== Persistence =====

export async function saveLocation(loc: LocationResult): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // ignore storage errors
  }
}

export async function loadSavedLocation(): Promise<LocationResult | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocationResult;
  } catch {
    return null;
  }
}

export const PRAYER_DISPLAY: { key: keyof SholatJadwal; label: string }[] = [
  { key: "subuh", label: "Subuh" },
  { key: "dhuha", label: "Dhuha" },
  { key: "dzuhur", label: "Dzuhur" },
  { key: "ashar", label: "Ashar" },
  { key: "maghrib", label: "Maghrib" },
  { key: "isya", label: "Isya'" },
];

const PRAYER_KEYS: (keyof SholatJadwal)[] = [
  "subuh",
  "dzuhur",
  "ashar",
  "maghrib",
  "isya",
];

// ===== API Calls =====

export async function getProvinsi(): Promise<string[]> {
  return cachedFetch("sholat:provinsi", async () => {
    const res = await fetch(`${BASE_URL}/provinsi`);
    if (!res.ok) throw new Error("Gagal mengambil data provinsi");
    const json = await res.json();
    // API might return { data: [...] } or { status, data: [...] }
    const raw = json.data ?? json;
    return Array.isArray(raw) ? raw : [];
  });
}

export async function getKabKota(provinsi: string): Promise<string[]> {
  return cachedFetch(`sholat:kabkota:${provinsi}`, async () => {
    const res = await fetch(`${BASE_URL}/kabkota`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provinsi }),
    });
    if (!res.ok) throw new Error("Gagal mengambil data kabupaten/kota");
    const json = await res.json();
    const raw = json.data ?? json;
    return Array.isArray(raw) ? raw : [];
  });
}

// Jadwal sholat sebulan penuh untuk satu lokasi tidak pernah berubah setelah
// diterbitkan — aman di-cache permanen per (provinsi, kabkota, bulan, tahun)
// supaya tetap tersedia offline sepanjang bulan itu.
export async function getSholatTimes(
  provinsi: string,
  kabkota: string,
  bulan: number,
  tahun: number
): Promise<SholatData> {
  return cachedFetch(
    `sholat:jadwal:${provinsi}:${kabkota}:${tahun}-${bulan}`,
    async () => {
      const res = await fetch(`${BASE_URL}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provinsi, kabkota, bulan, tahun }),
      });
      if (!res.ok) throw new Error("Gagal mengambil jadwal sholat");
      const json = await res.json();
      return json.data ?? json;
    }
  );
}

// ===== Location Detection =====

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(kota|kabupaten|kab\.?)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findBestMatch(target: string, list: string[]): string | null {
  if (!target || !list.length) return null;
  const t = normalize(target);

  // 1. Exact normalized match
  const exact = list.find((l) => normalize(l) === t);
  if (exact) return exact;

  // 2. Target contains list item or vice versa
  const contains = list.find(
    (l) => normalize(l).includes(t) || t.includes(normalize(l))
  );
  if (contains) return contains;

  // 3. Word-level partial match (at least 1 significant word matches)
  const tWords = t.split(" ").filter((w) => w.length > 2);
  const partial = list.find((l) => {
    const lWords = normalize(l).split(" ");
    return tWords.some((w) => lWords.includes(w));
  });
  if (partial) return partial;

  return null;
}

// ===== Reverse Geocoding via Nominatim (no SDK version restrictions) =====

async function reverseGeocodeNominatim(
  lat: number,
  lon: number
): Promise<{ state: string; city: string } | null> {
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lon}&accept-language=id`,
      {
        headers: {
          "User-Agent": "TahsinApp/1.0 (quran-learning-app)",
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address ?? {};
    // Indonesian geocoding: state = provinsi, city/regency/county = kabkota
    const state = addr.state ?? addr.province ?? addr.region ?? "";
    const city =
      addr.city ??
      addr.regency ??
      addr.county ??
      addr.municipality ??
      addr.town ??
      addr.village ??
      "";
    return { state, city };
  } catch {
    return null;
  }
}

export async function detectLocation(): Promise<LocationResult | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    // Use lower accuracy on web since high-accuracy GPS may not be available
    const accuracy =
      Platform.OS === "web"
        ? Location.Accuracy.Low
        : Location.Accuracy.Balanced;

    const position = await Location.getCurrentPositionAsync({ accuracy });

    const geocoded = await reverseGeocodeNominatim(
      position.coords.latitude,
      position.coords.longitude
    );
    if (!geocoded) return null;

    const { state: regionRaw, city: cityRaw } = geocoded;

    const provinsiList = await getProvinsi();
    const matchedProvinsi = findBestMatch(regionRaw, provinsiList);
    if (!matchedProvinsi) return null;

    const kabkotaList = await getKabKota(matchedProvinsi);
    const matchedKabkota = findBestMatch(cityRaw, kabkotaList);
    if (!matchedKabkota) return null;

    return {
      provinsi: matchedProvinsi,
      kabkota: matchedKabkota,
      displayName: matchedKabkota,
    };
  } catch {
    return null;
  }
}

// ===== Next Prayer Calculation =====

function timeStrToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length < 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function formatTimeLeft(minutesLeft: number): string {
  const h = Math.floor(minutesLeft / 60);
  const m = minutesLeft % 60;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

export function getNextPrayer(
  jadwal: SholatJadwal,
  now: Date
): NextPrayer | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const key of PRAYER_KEYS) {
    const timeStr = jadwal[key] as string;
    if (!timeStr) continue;
    const prayerMinutes = timeStrToMinutes(timeStr);
    if (prayerMinutes > nowMinutes) {
      const left = prayerMinutes - nowMinutes;
      const label =
        PRAYER_DISPLAY.find((p) => p.key === key)?.label ?? String(key);
      return {
        name: label,
        key: String(key),
        time: timeStr,
        timeLeft: formatTimeLeft(left),
        minutesLeft: left,
      };
    }
  }

  // All prayers passed, next is Subuh tomorrow
  const subuhMinutes = timeStrToMinutes(jadwal.subuh);
  const minutesUntilMidnight = 24 * 60 - nowMinutes;
  const left = minutesUntilMidnight + subuhMinutes;
  return {
    name: "Subuh",
    key: "subuh",
    time: jadwal.subuh,
    timeLeft: formatTimeLeft(left),
    minutesLeft: left,
  };
}
