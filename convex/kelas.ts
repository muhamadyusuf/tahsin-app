import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const jadwalArg = v.object({
  hari: v.union(
    v.literal(0),
    v.literal(1),
    v.literal(2),
    v.literal(3),
    v.literal(4),
    v.literal(5),
    v.literal(6)
  ),
  jamMulai: v.string(),
  jamSelesai: v.string(),
});

// Walk forward day-by-day from tanggalMulai and collect one date per calendar
// day whose weekday matches any jadwal slot, until jumlahPertemuan dates are
// found. Pure function so it's easy to unit-test independently.
export function generatePertemuanDates(
  tanggalMulai: string,
  jadwal: { hari: number }[],
  jumlahPertemuan: number
): string[] {
  if (jadwal.length === 0 || jumlahPertemuan <= 0) return [];
  const hariSet = new Set(jadwal.map((j) => j.hari));
  const dates: string[] = [];
  const cursor = new Date(`${tanggalMulai}T00:00:00Z`);
  let guard = 0;
  while (dates.length < jumlahPertemuan && guard < 3650) {
    if (hariSet.has(cursor.getUTCDay())) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }
  return dates;
}

// Create kelas with its weekly jadwal slots, auto-generating the
// kelas_pertemuan schedule from jumlahPertemuan + tanggalMulai.
export const create = mutation({
  args: {
    adminPengajianId: v.id("admin_pengajian"),
    ustadzId: v.id("ustadz"),
    nama: v.string(),
    type: v.union(
      v.literal("tahsin"),
      v.literal("murojaah"),
      v.literal("tahfidz")
    ),
    modeDefault: v.union(v.literal("online"), v.literal("offline")),
    silabus: v.optional(v.string()),
    silabusMateriIds: v.optional(v.array(v.id("materi"))),
    kapasitas: v.optional(v.float64()),
    jumlahPertemuan: v.float64(),
    tanggalMulai: v.string(),
    jadwal: v.array(jadwalArg),
  },
  handler: async (ctx, args) => {
    const { jadwal, ...kelasArgs } = args;
    const kelasId = await ctx.db.insert("kelas", {
      ...kelasArgs,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    for (const slot of jadwal) {
      await ctx.db.insert("kelas_jadwal", { kelasId, ...slot });
    }

    const dates = generatePertemuanDates(
      args.tanggalMulai,
      jadwal,
      args.jumlahPertemuan
    );
    for (let i = 0; i < dates.length; i++) {
      await ctx.db.insert("kelas_pertemuan", {
        kelasId,
        pertemuanKe: i + 1,
        tanggal: dates[i],
        mode: args.modeDefault,
        status: "scheduled",
      });
    }

    return kelasId;
  },
});

// Update kelas fields (jadwal managed separately via setJadwal)
export const update = mutation({
  args: {
    id: v.id("kelas"),
    nama: v.optional(v.string()),
    ustadzId: v.optional(v.id("ustadz")),
    type: v.optional(
      v.union(v.literal("tahsin"), v.literal("murojaah"), v.literal("tahfidz"))
    ),
    modeDefault: v.optional(v.union(v.literal("online"), v.literal("offline"))),
    silabus: v.optional(v.string()),
    silabusMateriIds: v.optional(v.array(v.id("materi"))),
    kapasitas: v.optional(v.float64()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

// Replace all jadwal slots for a kelas
export const setJadwal = mutation({
  args: {
    kelasId: v.id("kelas"),
    jadwal: v.array(jadwalArg),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("kelas_jadwal")
      .withIndex("by_kelasId", (q) => q.eq("kelasId", args.kelasId))
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    for (const slot of args.jadwal) {
      await ctx.db.insert("kelas_jadwal", { kelasId: args.kelasId, ...slot });
    }
  },
});

export const listJadwal = query({
  args: { kelasId: v.id("kelas") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("kelas_jadwal")
      .withIndex("by_kelasId", (q) => q.eq("kelasId", args.kelasId))
      .collect();
  },
});

export const listByAdminPengajian = query({
  args: { adminPengajianId: v.id("admin_pengajian") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("kelas")
      .withIndex("by_adminPengajianId", (q) =>
        q.eq("adminPengajianId", args.adminPengajianId)
      )
      .collect();
  },
});

export const listByUstadz = query({
  args: { ustadzId: v.id("ustadz") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("kelas")
      .withIndex("by_ustadzId", (q) => q.eq("ustadzId", args.ustadzId))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("kelas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listSantri = query({
  args: { kelasId: v.id("kelas") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("kelas_santri")
      .withIndex("by_kelasId", (q) => q.eq("kelasId", args.kelasId))
      .collect();
  },
});

// Santri's kelas enrollments (current + past), each row joined with its kelas doc.
export const listEnrollmentsBySantri = query({
  args: { santriId: v.id("santri") },
  handler: async (ctx, args) => {
    const enrollments = await ctx.db
      .query("kelas_santri")
      .withIndex("by_santriId", (q) => q.eq("santriId", args.santriId))
      .collect();

    const withKelas = await Promise.all(
      enrollments.map(async (enrollment) => ({
        enrollment,
        kelas: await ctx.db.get(enrollment.kelasId),
      }))
    );

    return withKelas.filter((row) => row.kelas !== null);
  },
});
