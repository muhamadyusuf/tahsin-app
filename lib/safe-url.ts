// Validasi URL di sisi client sebelum dirender ke iframe/WebView/Linking.
// Server juga memvalidasi (convex/sanitize.ts), tetapi data lama atau parameter
// rute yang dibuat penyerang tetap bisa sampai ke sini.

/** True hanya untuk URL https:// yang valid. Menolak javascript:, data:, http:, dll. */
export function isSafeHttpsUrl(value: string | undefined | null): value is string {
  if (!value || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname.length > 0;
  } catch {
    return false;
  }
}
