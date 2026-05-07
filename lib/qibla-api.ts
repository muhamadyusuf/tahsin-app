const ALADHAN_BASE = "https://api.aladhan.com/v1";

export interface QiblaData {
  latitude: number;
  longitude: number;
  bearing: number; // degrees clockwise from North
}

export async function getQiblaDirection(
  lat: number,
  lon: number
): Promise<QiblaData> {
  const res = await fetch(`${ALADHAN_BASE}/qibla/${lat}/${lon}`);
  if (!res.ok) throw new Error("Gagal mendapatkan arah kiblat");
  const json = await res.json();
  if (json.code !== 200) throw new Error("Gagal mendapatkan arah kiblat");
  const data = json.data;
  if (data?.bearing == null) throw new Error("Data arah kiblat tidak valid");
  return {
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    bearing: Number(data.bearing),
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
