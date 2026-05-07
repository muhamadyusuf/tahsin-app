// Koordinat Ka'bah, Mekkah
const KAABA_LAT = 21.4225;
const KAABA_LON = 39.8262;

export interface QiblaData {
  latitude: number;
  longitude: number;
  bearing: number; // degrees clockwise from North (0–360)
}

/**
 * Menghitung arah kiblat secara lokal menggunakan formula great-circle bearing.
 * Tidak membutuhkan koneksi internet.
 */
export function calculateQiblaBearing(userLat: number, userLon: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(userLat);
  const lat2 = toRad(KAABA_LAT);
  const dLon = toRad(KAABA_LON - userLon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return ((bearing % 360) + 360) % 360;
}

export function getQiblaData(userLat: number, userLon: number): QiblaData {
  return {
    latitude: userLat,
    longitude: userLon,
    bearing: calculateQiblaBearing(userLat, userLon),
  };
}

export function bearingToCardinal(bearing: number): string {
  const directions = [
    "Utara",
    "Timur Laut",
    "Timur",
    "Tenggara",
    "Selatan",
    "Barat Daya",
    "Barat",
    "Barat Laut",
  ];
  const normalized = ((bearing % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}
