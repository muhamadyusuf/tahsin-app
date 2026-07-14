// Ekstrak videoId YouTube dari berbagai bentuk URL (watch, youtu.be, embed,
// shorts, live). Mengembalikan null bila bukan link YouTube.
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#\s]+)/,
    /youtube\.com\/shorts\/([^&?#\s]+)/,
    /youtube\.com\/live\/([^&?#\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}
