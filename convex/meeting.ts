import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  canManageKelas,
  getAuthUser,
  getPertemuanAccess,
  isAdministrator,
  requirePertemuanAccess,
  requireSelf,
  requireUser,
} from "./authz";

// Batas ukuran field yang dikirim client (cegah penyalahgunaan storage).
const MAX_SESSION_ID = 100;
const MAX_SIGNAL_PAYLOAD = 64 * 1024;

function assertSessionId(sessionId: string) {
  if (sessionId.length === 0 || sessionId.length > MAX_SESSION_ID) {
    throw new Error("sessionId tidak valid");
  }
}

/**
 * Baris peserta milik sesi ini, dan pastikan sesi tersebut milik `userId`.
 * Sesi (sessionId) dibuat di client, jadi tanpa pengecekan ini pengguna lain
 * bisa "mengambil alih" / mengeluarkan sesi orang lain hanya dengan menebak id-nya.
 */
async function getOwnedParticipant(
  ctx: MutationCtx,
  pertemuanId: Id<"kelas_pertemuan">,
  sessionId: string,
  user: Doc<"users">
): Promise<Doc<"meeting_participants"> | null> {
  const row = await ctx.db
    .query("meeting_participants")
    .withIndex("by_pertemuanId_sessionId", (q) =>
      q.eq("pertemuanId", pertemuanId).eq("sessionId", sessionId)
    )
    .unique();
  if (row && row.userId !== user._id && !isAdministrator(user)) {
    throw new Error("Sesi meeting ini milik pengguna lain");
  }
  return row;
}

// Peserta dianggap terputus jika heartbeat berhenti selama ini.
const STALE_PARTICIPANT_MS = 60_000;
// Signal yang tidak pernah dikonsumsi penerimanya dibersihkan setelah ini.
const STALE_SIGNAL_MS = 5 * 60_000;

async function deleteSignalsOfSession(
  ctx: MutationCtx,
  pertemuanId: Id<"kelas_pertemuan">,
  sessionId: string
) {
  const incoming = await ctx.db
    .query("meeting_signals")
    .withIndex("by_pertemuanId_toSession", (q) =>
      q.eq("pertemuanId", pertemuanId).eq("toSession", sessionId)
    )
    .take(200);
  for (const row of incoming) await ctx.db.delete(row._id);

  const all = await ctx.db
    .query("meeting_signals")
    .withIndex("by_pertemuanId", (q) => q.eq("pertemuanId", pertemuanId))
    .take(200);
  for (const row of all) {
    if (row.fromSession === sessionId) await ctx.db.delete(row._id);
  }
}

// Klaim host dari client hanya diakui bila pemanggil memang berhak mengelola
// kelas dari pertemuan ini (ustadz pengampu, pemilik LKM, atau administrator).
async function verifyHost(
  ctx: MutationCtx,
  user: Doc<"users">,
  pertemuanId: Id<"kelas_pertemuan">,
  claimed: boolean | undefined
): Promise<boolean> {
  if (!claimed) return false;
  const pertemuan = await ctx.db.get(pertemuanId);
  if (!pertemuan) return false;
  const kelas = await ctx.db.get(pertemuan.kelasId);
  if (!kelas) return false;
  return await canManageKelas(ctx, user, kelas);
}

// Bersihkan peserta yang heartbeat-nya mati (app crash / tab ditutup) beserta
// signal basi, agar peserta lama tidak terlihat "hantu" di dalam room.
async function purgeStale(ctx: MutationCtx, pertemuanId: Id<"kelas_pertemuan">) {
  const now = Date.now();
  const participants = await ctx.db
    .query("meeting_participants")
    .withIndex("by_pertemuanId", (q) => q.eq("pertemuanId", pertemuanId))
    .take(100);
  for (const p of participants) {
    if (now - p.lastSeen > STALE_PARTICIPANT_MS) {
      await ctx.db.delete(p._id);
      await deleteSignalsOfSession(ctx, pertemuanId, p.sessionId);
    }
  }
  const signals = await ctx.db
    .query("meeting_signals")
    .withIndex("by_pertemuanId", (q) => q.eq("pertemuanId", pertemuanId))
    .take(200);
  for (const s of signals) {
    if (now - s._creationTime > STALE_SIGNAL_MS) await ctx.db.delete(s._id);
  }
}

export const join = mutation({
  args: {
    pertemuanId: v.id("kelas_pertemuan"),
    sessionId: v.string(),
    userId: v.id("users"),
    name: v.string(),
    isHost: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireSelf(ctx, args.userId);
    assertSessionId(args.sessionId);
    // Hanya pengelola kelas & santri terdaftar yang boleh masuk room.
    await requirePertemuanAccess(ctx, user, args.pertemuanId);
    const isHost = await verifyHost(ctx, user, args.pertemuanId, args.isHost);
    await purgeStale(ctx, args.pertemuanId);
    const existing = await getOwnedParticipant(
      ctx,
      args.pertemuanId,
      args.sessionId,
      user
    );
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: Date.now(),
        isHost,
      });
    } else {
      await ctx.db.insert("meeting_participants", {
        pertemuanId: args.pertemuanId,
        sessionId: args.sessionId,
        userId: args.userId,
        // Nama tampilan diambil dari profil, bukan argumen — cegah penyamaran.
        name: user._id === args.userId ? user.name : args.name.slice(0, 120),
        micOn: true,
        camOn: true,
        isHost,
        screenOn: false,
        recOn: false,
        lastSeen: Date.now(),
      });
    }
    return null;
  },
});

export const heartbeat = mutation({
  args: {
    pertemuanId: v.id("kelas_pertemuan"),
    sessionId: v.string(),
    userId: v.id("users"),
    name: v.string(),
    micOn: v.boolean(),
    camOn: v.boolean(),
    isHost: v.optional(v.boolean()),
    screenOn: v.optional(v.boolean()),
    recOn: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireSelf(ctx, args.userId);
    assertSessionId(args.sessionId);
    const existing = await getOwnedParticipant(
      ctx,
      args.pertemuanId,
      args.sessionId,
      user
    );
    // Baris yang sudah ada berarti akses sudah diverifikasi saat join; hanya
    // pendaftaran ulang (baris hilang karena purge) yang perlu cek akses lagi.
    if (!existing) await requirePertemuanAccess(ctx, user, args.pertemuanId);
    const isHost = await verifyHost(ctx, user, args.pertemuanId, args.isHost);
    const fields = {
      lastSeen: Date.now(),
      micOn: args.micOn,
      camOn: args.camOn,
      isHost,
      screenOn: args.screenOn ?? false,
      recOn: args.recOn ?? false,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      // Baris bisa hilang karena purge (mis. app sempat background lama) —
      // daftar ulang secara transparan supaya peserta tetap terlihat.
      await ctx.db.insert("meeting_participants", {
        pertemuanId: args.pertemuanId,
        sessionId: args.sessionId,
        userId: args.userId,
        name: user._id === args.userId ? user.name : args.name.slice(0, 120),
        ...fields,
      });
    }
    return null;
  },
});

export const leave = mutation({
  args: {
    pertemuanId: v.id("kelas_pertemuan"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertSessionId(args.sessionId);
    // Hanya pemilik sesi (atau administrator) yang boleh mengeluarkannya.
    const existing = await getOwnedParticipant(
      ctx,
      args.pertemuanId,
      args.sessionId,
      user
    );
    if (existing) await ctx.db.delete(existing._id);
    await deleteSignalsOfSession(ctx, args.pertemuanId, args.sessionId);
    return null;
  },
});

export const participants = query({
  args: { pertemuanId: v.id("kelas_pertemuan") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    if (!(await getPertemuanAccess(ctx, caller, args.pertemuanId))) return [];
    return await ctx.db
      .query("meeting_participants")
      .withIndex("by_pertemuanId", (q) => q.eq("pertemuanId", args.pertemuanId))
      .take(100);
  },
});

export const signal = mutation({
  args: {
    pertemuanId: v.id("kelas_pertemuan"),
    fromSession: v.string(),
    toSession: v.string(),
    kind: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("ice"),
      v.literal("ctrl")
    ),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertSessionId(args.fromSession);
    assertSessionId(args.toSession);
    if (args.payload.length > MAX_SIGNAL_PAYLOAD) {
      throw new Error("Payload signal terlalu besar");
    }
    await requirePertemuanAccess(ctx, user, args.pertemuanId);
    // Pengirim harus sesi yang terdaftar dan MILIKNYA sendiri — cegah
    // penyusup memalsukan signal atas nama peserta lain. Signal dari sesi yang
    // sudah di-purge dibuang diam-diam (klien akan join ulang lewat heartbeat).
    const sender = await getOwnedParticipant(
      ctx,
      args.pertemuanId,
      args.fromSession,
      user
    );
    if (!sender) return null;
    // Perintah moderasi (mute / minta unmute) hanya sah dari host yang
    // terdaftar di room — cegah peserta biasa mem-mute peserta lain.
    if (args.kind === "ctrl" && !sender.isHost) return null;
    await ctx.db.insert("meeting_signals", args);
    return null;
  },
});

// ---- Chat dalam meeting ----

export const sendMessage = mutation({
  args: {
    pertemuanId: v.id("kelas_pertemuan"),
    userId: v.id("users"),
    name: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSelf(ctx, args.userId);
    await requirePertemuanAccess(ctx, user, args.pertemuanId);
    const text = args.text.trim().slice(0, 2000);
    if (!text) return null;
    await ctx.db.insert("meeting_messages", {
      pertemuanId: args.pertemuanId,
      userId: args.userId,
      // Nama diambil dari profil pemanggil, bukan argumen — cegah penyamaran.
      name: user._id === args.userId ? user.name : args.name.slice(0, 120),
      text,
    });
    return null;
  },
});

export const listMessages = query({
  args: { pertemuanId: v.id("kelas_pertemuan") },
  handler: async (ctx, args) => {
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    if (!(await getPertemuanAccess(ctx, caller, args.pertemuanId))) return [];
    const rows = await ctx.db
      .query("meeting_messages")
      .withIndex("by_pertemuanId", (q) => q.eq("pertemuanId", args.pertemuanId))
      .order("desc")
      .take(200);
    return rows.reverse(); // urut lama → baru untuk ditampilkan
  },
});

export const signalsFor = query({
  args: {
    pertemuanId: v.id("kelas_pertemuan"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Signal berisi SDP/ICE (termasuk alamat IP peserta): hanya pemilik sesi
    // penerima yang boleh membacanya.
    const caller = await getAuthUser(ctx);
    if (!caller) return [];
    const session = await ctx.db
      .query("meeting_participants")
      .withIndex("by_pertemuanId_sessionId", (q) =>
        q.eq("pertemuanId", args.pertemuanId).eq("sessionId", args.sessionId)
      )
      .unique();
    if (!session || (session.userId !== caller._id && !isAdministrator(caller))) {
      return [];
    }
    return await ctx.db
      .query("meeting_signals")
      .withIndex("by_pertemuanId_toSession", (q) =>
        q.eq("pertemuanId", args.pertemuanId).eq("toSession", args.sessionId)
      )
      .take(200);
  },
});

export const consumeSignals = mutation({
  args: { ids: v.array(v.id("meeting_signals")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.ids.length > 200) throw new Error("Terlalu banyak signal");
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      // Hanya penerima signal yang boleh mengonsumsinya (bukan sembarang id).
      const owner = await ctx.db
        .query("meeting_participants")
        .withIndex("by_pertemuanId_sessionId", (q) =>
          q.eq("pertemuanId", row.pertemuanId).eq("sessionId", row.toSession)
        )
        .unique();
      if (owner && owner.userId !== user._id && !isAdministrator(user)) continue;
      await ctx.db.delete(id);
    }
    return null;
  },
});
