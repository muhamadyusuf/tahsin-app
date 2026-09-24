// Path umpan (honeypot) — alamat yang sering dipindai bot/penyusup tetapi TIDAK
// pernah ditautkan dari aplikasi ini. Siapa pun yang membukanya dicatat oleh
// halaman perangkap (components/TrapPage.tsx). Jangan tambahkan path yang
// dipakai rute asli (lihat folder app/) — lihat lib/trap-paths.test.ts.

// Cocok bila path == entri, atau berada di bawahnya (entri + "/...").
const DECOY_PREFIXES = [
  "/wp-admin",
  "/wp-login.php",
  "/wp-content",
  "/wp-includes",
  "/wordpress",
  "/xmlrpc.php",
  "/phpmyadmin",
  "/pma",
  "/myadmin",
  "/adminer",
  "/cpanel",
  "/admin",
  "/administrator",
  "/admin-login",
  "/adminpanel",
  "/admin-panel",
  "/panel",
  "/backend",
  "/manager/html",
  "/server-status",
  "/actuator",
  "/api/admin",
  "/api/v1/admin",
  "/backup",
  "/backups",
  "/db",
  "/database",
  "/.env",
  "/.git",
  "/.svn",
  "/.aws",
  "/.ssh",
];

// Ekstensi/berkas server yang tidak ada di aplikasi Expo ini.
const DECOY_PATTERN = /\.(php\d?|asp|aspx|jsp|cgi|sql|bak|old|swp|ini|env)(\/|$)/i;

export function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0].toLowerCase();
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function isDecoyPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (DECOY_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  return DECOY_PATTERN.test(path);
}
