// Helper otorisasi bersama untuk semua fungsi Convex.
//
// Prinsip: identitas pemanggil SELALU diambil dari ctx.auth.getUserIdentity()
// (JWT Clerk yang diverifikasi server), tidak pernah dipercaya dari argumen.
// Argumen userId yang dikirim client hanya dicocokkan terhadap identitas asli.
//
// Konvensi pemakaian:
// - Mutation: pakai require* (melempar error bila tidak berhak).
// - Query: mulai dengan getAuthUser() dan kembalikan hasil kosong bila belum
//   login (token bisa belum terpasang sesaat setelah app dibuka), lalu pakai
//   assert* untuk pelanggaran akses yang sesungguhnya.
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

// Email yang otomatis dipromosikan menjadi administrator saat login
// (bootstrap admin pertama). Juga dipakai sebagai penanda administrator yang
// stabil karena field `role` berubah-ubah saat pengguna berganti tampilan role.
export const ADMIN_EMAILS = ["muhamadyusufaa@gmail.com", "badrudin.on@gmail.com"];

/** Profil users milik pemanggil, atau null bila belum login / belum terdaftar. */
export async function getAuthUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Harus login untuk mengakses fitur ini");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) {
    throw new Error("Akun belum terdaftar di aplikasi");
  }
  return user;
}

export function isAdministrator(user: Doc<"users">): boolean {
  return (
    user.role === "administrator" ||
    ADMIN_EMAILS.includes(user.email.toLowerCase())
  );
}

export async function requireAdministrator(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdministrator(user)) {
    throw new Error("Hanya administrator yang boleh melakukan ini");
  }
  return user;
}

/** Baris admin_pengajian (LKM) milik user, bila ada. */
export async function getLkmRow(
  ctx: Ctx,
  user: Doc<"users">
): Promise<Doc<"admin_pengajian"> | null> {
  return await ctx.db
    .query("admin_pengajian")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .first();
}

/** Baris ustadz milik user, bila ada. */
export async function getUstadzRow(
  ctx: Ctx,
  user: Doc<"users">
): Promise<Doc<"ustadz"> | null> {
  return await ctx.db
    .query("ustadz")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .first();
}

/**
 * Staf = administrator, pemilik LKM, atau ustadz. Penentu hak membaca data
 * pengguna lain (monitoring, statistik, roster). Berbasis baris keanggotaan —
 * bukan field `role` yang berubah saat ganti tampilan.
 */
export async function isStaff(ctx: Ctx, user: Doc<"users">): Promise<boolean> {
  if (isAdministrator(user)) return true;
  if (await getLkmRow(ctx, user)) return true;
  if (await getUstadzRow(ctx, user)) return true;
  return false;
}

/**
 * Mutasi atas data milik sendiri: argumen userId harus pemanggil sendiri.
 * Administrator boleh bertindak atas nama pengguna lain.
 */
export async function requireSelf(
  ctx: Ctx,
  userId: Id<"users">
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user._id !== userId && !isAdministrator(user)) {
    throw new Error("Tidak boleh mengubah data pengguna lain");
  }
  return user;
}

/** Membaca data seorang pengguna: dirinya sendiri atau staf. Melempar error. */
export async function assertSelfOrStaff(
  ctx: Ctx,
  user: Doc<"users">,
  userId: Id<"users">
): Promise<void> {
  if (user._id === userId) return;
  if (await isStaff(ctx, user)) return;
  throw new Error("Tidak punya akses ke data pengguna lain");
}

/** Administrator, atau pemilik LKM (admin_pengajian) yang dimaksud. */
export async function requireLkmOwner(
  ctx: Ctx,
  adminPengajianId: Id<"admin_pengajian">
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (isAdministrator(user)) return user;
  const lkm = await ctx.db.get(adminPengajianId);
  if (lkm && lkm.userId === user._id) return user;
  throw new Error("Bukan pengelola lembaga pengajian ini");
}

/** Administrator atau pemilik LKM mana pun — pengelola konten (materi/quiz). */
export async function requireContentManager(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (isAdministrator(user)) return user;
  if (await getLkmRow(ctx, user)) return user;
  throw new Error("Hanya administrator atau pengelola lembaga yang boleh melakukan ini");
}

/**
 * Boleh mengelola sebuah kelas: administrator, pemilik LKM kelas tersebut,
 * atau ustadz pengampunya.
 */
export async function canManageKelas(
  ctx: Ctx,
  user: Doc<"users">,
  kelas: Doc<"kelas">
): Promise<boolean> {
  if (isAdministrator(user)) return true;
  const lkm = await ctx.db.get(kelas.adminPengajianId);
  if (lkm && lkm.userId === user._id) return true;
  const ustadz = await ctx.db.get(kelas.ustadzId);
  if (ustadz && ustadz.userId === user._id) return true;
  return false;
}

export async function requireKelasManager(
  ctx: Ctx,
  kelasId: Id<"kelas">
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  const kelas = await ctx.db.get(kelasId);
  if (!kelas) throw new Error("Kelas tidak ditemukan");
  if (!(await canManageKelas(ctx, user, kelas))) {
    throw new Error("Tidak punya akses mengelola kelas ini");
  }
  return user;
}
