// Ekstraksi alamat IP klien dari header permintaan HTTP.
//
// Header X-Forwarded-For berisi rantai "klien, proxy1, proxy2". Entri paling
// KIRI dikirim klien sendiri sehingga bisa dipalsukan; entri di KANAN
// ditambahkan proxy tepercaya. Karena itu yang dipilih adalah entri publik
// paling kanan. Nilai mentah header tetap disimpan oleh pemanggil sebagai
// bukti forensik dan untuk verifikasi asumsi ini di lingkungan produksi.

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_RE = /^[0-9a-fA-F:.]+$/;

export function isValidIp(value: string): boolean {
  if (value.length === 0 || value.length > 45) return false;
  if (value.includes(":")) return IPV6_RE.test(value) && value.split(":").length >= 3;
  return IPV4_RE.test(value);
}

/** True untuk alamat privat / loopback / link-local (bukan alamat klien di internet). */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fe80:") ||
      lower.startsWith("fc") ||
      lower.startsWith("fd")
    );
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) // CGNAT
  );
}

export type ClientIpInfo = {
  /** IP yang dianggap milik klien, atau "unknown". */
  ip: string;
  /** Nilai mentah X-Forwarded-For (dipotong) untuk verifikasi. */
  forwardedFor?: string;
};

export function extractClientIp(headers: Headers): ClientIpInfo {
  const rawForwarded = headers.get("x-forwarded-for") ?? undefined;
  const chain = (rawForwarded ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isValidIp);

  // Entri publik paling kanan; jika semuanya privat, ambil yang paling kanan.
  const publicFromRight = [...chain].reverse().find((ip) => !isPrivateIp(ip));
  const fallback = chain[chain.length - 1];
  const realIp = headers.get("x-real-ip")?.trim();

  const ip =
    publicFromRight ??
    fallback ??
    (realIp && isValidIp(realIp) ? realIp : undefined) ??
    "unknown";

  return { ip, forwardedFor: rawForwarded?.slice(0, 300) };
}
