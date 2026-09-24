// Rekaman sesi video meeting. Alur:
// 1. Client (web, ustadz) merekam sesi → unggah blob ke Convex storage lewat
//    URL dari generateUploadUrl.
// 2. finalize() mencatat metadata + menjadwalkan transfer ke Google Drive
//    (convex/recordingsNode.ts). Bila kredensial Drive belum diset, rekaman
//    tetap bisa diputar langsung dari Convex storage.
// 3. listByPertemuan() dipakai halaman pertemuan untuk menonton ulang.
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  canManageKelas,
  getAuthUser,
  getPertemuanAccess,
  isStaff,
  requireSelf,
  requireUser,
} from "./authz";

// Rekaman ≤ 1 GB, hanya audio/video.
const MAX_RECORDING_BYTES = 1024 * 1024 * 1024;

// Hanya staf (administrator / LKM / ustadz) yang merekam sesi. Tanpa batas ini
// setiap akun terdaftar bisa mengunggah file sembarang ke storage.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!(await isStaff(ctx, user))) {
      throw new Error("Hanya pengajar yang boleh mengunggah rekaman");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const finalize = mutation({
  args: {
    pertemuanId: v.id("kelas_pertemuan"),
    byUserId: v.id("users"),
    byName: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    sizeBytes: v.float64(),
    durationSec: v.float64(),
  },
  handler: async (ctx, args) => {
    const user = await requireSelf(ctx, args.byUserId);
    const pertemuan = await ctx.db.get(args.pertemuanId);
    if (!pertemuan) throw new Error("Pertemuan tidak ditemukan");
    const kelas = await ctx.db.get(pertemuan.kelasId);
    if (!kelas) throw new Error("Kelas tidak ditemukan");

    // Metadata file diambil dari storage (bukan dari klaim client) dan file
    // yang tidak sah langsung dihapus agar tidak jadi tempat sampah/penyimpanan gelap.
    const meta = await ctx.db.system.get(args.storageId);
    const contentType = meta?.contentType ?? args.mimeType;
    const isMedia = /^(video|audio)\//.test(contentType);
    if (
      !meta ||
      !isMedia ||
      meta.size > MAX_RECORDING_BYTES ||
      !(await canManageKelas(ctx, user, kelas))
    ) {
      if (meta) await ctx.storage.delete(args.storageId);
      throw new Error("Rekaman ditolak: bukan pengelola kelas atau file tidak valid");
    }

    const recordingId = await ctx.db.insert("meeting_recordings", {
      pertemuanId: args.pertemuanId,
      kelasId: pertemuan.kelasId,
      byUserId: args.byUserId,
      byName: user._id === args.byUserId ? user.name : args.byName.slice(0, 120),
      storageId: args.storageId,
      status: "processing",
      mimeType: contentType,
      sizeBytes: meta.size,
      durationSec: Math.max(0, Math.min(args.durationSec, 24 * 3600)),
      createdAt: new Date().toISOString(),
    });
    await ctx.scheduler.runAfter(0, internal.recordingsNode.uploadToDrive, {
      recordingId,
    });
    return recordingId;
  },
});

export const listByPertemuan = query({
  args: { pertemuanId: v.id("kelas_pertemuan") },
  handler: async (ctx, args) => {
    // Hanya pengelola kelas & santri terdaftar yang boleh melihat rekaman
    // (berisi video/suara peserta; link storage/Drive-nya berlaku publik).
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    if (!(await getPertemuanAccess(ctx, caller, args.pertemuanId))) return [];
    const rows = await ctx.db
      .query("meeting_recordings")
      .withIndex("by_pertemuanId", (q) => q.eq("pertemuanId", args.pertemuanId))
      .order("desc")
      .take(50);
    return await Promise.all(
      rows.map(async (row) => ({
        ...row,
        // Link tonton: Google Drive bila sudah dipindah, selain itu langsung
        // dari Convex storage.
        playbackUrl:
          row.driveLink ??
          (row.storageId ? await ctx.storage.getUrl(row.storageId) : null),
      }))
    );
  },
});

// ---- Dipakai internal oleh action transfer Drive ----

export const getInternal = internalQuery({
  args: { id: v.id("meeting_recordings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const patchInternal = internalMutation({
  args: {
    id: v.id("meeting_recordings"),
    status: v.optional(
      v.union(v.literal("processing"), v.literal("ready"), v.literal("failed"))
    ),
    driveFileId: v.optional(v.string()),
    driveLink: v.optional(v.string()),
    error: v.optional(v.string()),
    clearStorage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const patch: Record<string, unknown> = {};
    if (args.status !== undefined) patch.status = args.status;
    if (args.driveFileId !== undefined) patch.driveFileId = args.driveFileId;
    if (args.driveLink !== undefined) patch.driveLink = args.driveLink;
    if (args.error !== undefined) patch.error = args.error;
    if (args.clearStorage && row.storageId) {
      await ctx.storage.delete(row.storageId);
      patch.storageId = undefined;
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});
