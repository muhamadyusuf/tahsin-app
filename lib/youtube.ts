// Ekstrak videoId YouTube dari berbagai bentuk URL (watch, youtu.be, embed,
// shorts, live). Mengembalikan null bila bukan link YouTube.
//
// KEAMANAN: videoId disisipkan ke HTML/URL embed (WebView & iframe). ID YouTube
// selalu berupa 11 karakter [A-Za-z0-9_-], jadi apa pun selain itu ditolak —
// tanpa ini `youtu.be/x"><script>…` bisa lolos dan disuntikkan ke HTML.
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#\s]+)/,
    /youtube\.com\/shorts\/([^&?#\s]+)/,
    /youtube\.com\/live\/([^&?#\s]+)/,
  ];
  for (const pattern of patterns) {
    const id = url.match(pattern)?.[1];
    if (id && YOUTUBE_ID_RE.test(id)) return id;
  }
  return null;
}
