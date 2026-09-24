// Validasi & sanitasi input yang tidak bisa diungkapkan lewat validator `v`.
//
// Semua field URL yang nanti dirender client (iframe PDF, WebView YouTube,
// <Image>, Linking) WAJIB lewat sini agar skema berbahaya seperti
// `javascript:` / `data:text/html` tidak bisa tersimpan di database.

const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

/** True bila `value` adalah URL https:// yang valid. */
export function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname.length > 0;
  } catch {
    return false;
  }
}

/** URL https, atau string kosong/undefined (dianggap "tidak diisi"). */
export function assertHttpsUrl(
  value: string | undefined,
  field: string
): string | undefined {
  if (value === undefined || value === "") return value;
  if (value.length > 2048 || !isHttpsUrl(value)) {
    throw new Error(`${field} harus berupa tautan https:// yang valid`);
  }
  return value;
}

/**
 * URL gambar: https:// atau data URI gambar (hasil image picker). Skema lain —
 * termasuk `data:image/svg+xml` — ditolak.
 */
export function assertImageUrl(
  value: string | undefined,
  field: string
): string | undefined {
  if (value === undefined || value === "") return value;
  if (value.startsWith("data:")) {
    // Data URI dibatasi ~1 MB (batas dokumen Convex) dan hanya format raster.
    if (value.length > 1_000_000 || !DATA_IMAGE_RE.test(value)) {
      throw new Error(`${field} bukan gambar yang valid`);
    }
    return value;
  }
  return assertHttpsUrl(value, field);
}

/** Versi lunak: kembalikan undefined (bukan error) bila URL gambar tidak valid. */
export function safeImageUrl(value: string | undefined): string | undefined {
  try {
    return assertImageUrl(value, "url") || undefined;
  } catch {
    return undefined;
  }
}

export function assertMaxLength(
  value: string | undefined,
  max: number,
  field: string
): string | undefined {
  if (value !== undefined && value.length > max) {
    throw new Error(`${field} maksimal ${max} karakter`);
  }
  return value;
}

/** Buang karakter kontrol & potong; dipakai untuk data dari header/klien anonim. */
export function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, max);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD yang benar-benar tanggal kalender. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function assertIsoDate(value: string, field = "tanggal"): string {
  if (!isIsoDate(value)) throw new Error(`${field} harus berformat YYYY-MM-DD`);
  return value;
}

/** Halaman mushaf: bilangan bulat 1..604. */
export function assertMushafPage(page: number): number {
  if (!Number.isInteger(page) || page < 1 || page > 604) {
    throw new Error("Nomor halaman mushaf tidak valid");
  }
  return page;
}
