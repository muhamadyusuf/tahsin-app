import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Bersihkan penghitung rate limit yang jendelanya sudah lewat.
crons.interval("purge stale rate limits", { hours: 6 }, internal.rateLimit.purgeStale, {});

// Hapus catatan perangkap (data pribadi: IP, lokasi, foto) yang melewati masa
// simpan — lihat RETENTION_DAYS di convex/trap.ts.
crons.interval("purge old trap hits", { hours: 24 }, internal.trap.purgeOld, {});

export default crons;
