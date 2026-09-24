/// <reference types="vite/client" />
// Test regresi untuk celah keamanan yang ditemukan pada audit. Setiap test
// mendokumentasikan serangan yang dulu berhasil dan kini harus gagal.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { ADMIN_EMAILS } from "./authz";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
type T = ReturnType<typeof convexTest>;

const ADMIN_EMAIL = ADMIN_EMAILS[0];

// Dunia uji: admin, LKM A (dengan ustadz + kelas + pertemuan + 1 santri
// terdaftar), LKM B (pemilik lain), dan seorang penyusup (santri biasa).
async function seedWorld(t: T) {
  return await t.run(async (ctx) => {
    const mk = (clerkId: string, name: string, role: "administrator" | "admin_pengajian" | "ustadz" | "santri") =>
      ctx.db.insert("users", {
        clerkId,
        name,
        email: `${clerkId}@example.com`,
        role,
        isActive: true,
      });

    const adminId = await mk("clerk_admin", "Admin", "administrator");
    const lkmAUser = await mk("clerk_lkm_a", "LKM A", "admin_pengajian");
    const lkmBUser = await mk("clerk_lkm_b", "LKM B", "admin_pengajian");
    const ustadzUser = await mk("clerk_ustadz", "Ustadz", "ustadz");
    const santriUser = await mk("clerk_santri", "Santri Terdaftar", "santri");
    const santri2User = await mk("clerk_santri2", "Santri Lain", "santri");
    const intruderUser = await mk("clerk_intruder", "Penyusup", "santri");

    const lembagaBase = { kota: "Tangsel", provinsi: "Banten", isActive: true };
    const lkmA = await ctx.db.insert("admin_pengajian", {
      userId: lkmAUser,
      namaLembaga: "LKM A",
      ...lembagaBase,
    });
    const lkmB = await ctx.db.insert("admin_pengajian", {
      userId: lkmBUser,
      namaLembaga: "LKM B",
      ...lembagaBase,
    });
    const ustadz = await ctx.db.insert("ustadz", {
      userId: ustadzUser,
      adminPengajianId: lkmA,
      isActive: true,
    });
    const santri = await ctx.db.insert("santri", {
      userId: santriUser,
      adminPengajianId: lkmA,
      isActive: true,
    });
    const santri2 = await ctx.db.insert("santri", {
      userId: santri2User,
      adminPengajianId: lkmA,
      isActive: true,
    });
    await ctx.db.insert("santri", { userId: intruderUser, isActive: true });

    const kelasA = await ctx.db.insert("kelas", {
      adminPengajianId: lkmA,
      ustadzId: ustadz,
      nama: "Kelas A",
      type: "tahsin",
      modeDefault: "online",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    const kelasB = await ctx.db.insert("kelas", {
      adminPengajianId: lkmB,
      ustadzId: ustadz,
      nama: "Kelas B",
      type: "tahsin",
      modeDefault: "online",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    for (const s of [santri, santri2]) {
      const u = s === santri ? santriUser : santri2User;
      await ctx.db.insert("kelas_santri", {
        kelasId: kelasA,
        santriId: s,
        userId: u,
        joinedAt: new Date().toISOString(),
        isActive: true,
      });
    }
    const pertemuan = await ctx.db.insert("kelas_pertemuan", {
      kelasId: kelasA,
      pertemuanKe: 1,
      tanggal: "2026-01-01",
      mode: "online",
      status: "ongoing",
    });

    return {
      adminId,
      lkmAUser,
      lkmBUser,
      ustadzUser,
      santriUser,
      santri2User,
      intruderUser,
      lkmA,
      lkmB,
      ustadz,
      kelasA,
      kelasB,
      pertemuan,
    };
  });
}

const as = (t: T, clerkId: string, extra: Record<string, unknown> = {}) =>
  t.withIdentity({ subject: clerkId, ...extra });

// ---------------------------------------------------------------------------
describe("upsertUser — eskalasi administrator lewat email palsu", () => {
  test("email admin yang dikirim client tanpa bukti di JWT ditolak", async () => {
    const t = convexTest(schema, modules);
    await expect(
      as(t, "clerk_attacker").mutation(api.users.upsertUser, {
        clerkId: "clerk_attacker",
        name: "Attacker",
        email: ADMIN_EMAIL,
      })
    ).rejects.toThrow();
    const rows = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(0);
  });

  test("email di JWT yang menang, bukan argumen — argumen admin tidak menaikkan role", async () => {
    const t = convexTest(schema, modules);
    const id = await as(t, "clerk_attacker", {
      email: "attacker@evil.test",
      emailVerified: true,
    }).mutation(api.users.upsertUser, {
      clerkId: "clerk_attacker",
      name: "Attacker",
      email: ADMIN_EMAIL,
    });
    const user = await t.run(async (ctx) => ctx.db.get(id));
    expect(user?.role).toBe("santri");
    expect(user?.email).toBe("attacker@evil.test");
  });

  test("akun lama tidak bisa dipromosikan dengan mengirim email admin", async () => {
    const t = convexTest(schema, modules);
    const { intruderUser } = await seedWorld(t);
    await as(t, "clerk_intruder", {
      email: "clerk_intruder@example.com",
      emailVerified: true,
    }).mutation(api.users.upsertUser, {
      clerkId: "clerk_intruder",
      name: "Penyusup",
      email: ADMIN_EMAIL,
    });
    const user = await t.run(async (ctx) => ctx.db.get(intruderUser));
    expect(user?.role).toBe("santri");
    expect(user?.email).toBe("clerk_intruder@example.com");
  });

  test("administrator sah (email terverifikasi di JWT) tetap otomatis dipromosikan", async () => {
    const t = convexTest(schema, modules);
    const id = await as(t, "clerk_real_admin", {
      email: ADMIN_EMAIL,
      emailVerified: true,
    }).mutation(api.users.upsertUser, {
      clerkId: "clerk_real_admin",
      name: "Admin Asli",
      email: ADMIN_EMAIL,
    });
    const user = await t.run(async (ctx) => ctx.db.get(id));
    expect(user?.role).toBe("administrator");
  });

  test("email admin dengan emailVerified=false tidak dipromosikan", async () => {
    const t = convexTest(schema, modules);
    await expect(
      as(t, "clerk_x", { email: ADMIN_EMAIL, emailVerified: false }).mutation(
        api.users.upsertUser,
        { clerkId: "clerk_x", name: "X", email: ADMIN_EMAIL }
      )
    ).rejects.toThrow();
  });

  test("avatarUrl berskema berbahaya dibuang", async () => {
    const t = convexTest(schema, modules);
    const id = await as(t, "clerk_a", { email: "a@a.test" }).mutation(api.users.upsertUser, {
      clerkId: "clerk_a",
      name: "A",
      email: "a@a.test",
      avatarUrl: "javascript:alert(1)",
    });
    const user = await t.run(async (ctx) => ctx.db.get(id));
    expect(user?.avatarUrl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe("users.getById — kebocoran PII", () => {
  test("pengguna biasa hanya mendapat data publik pengguna lain", async () => {
    const t = convexTest(schema, modules);
    const { santriUser } = await seedWorld(t);
    const view = await as(t, "clerk_intruder").query(api.users.getById, {
      userId: santriUser,
    });
    expect(view?.name).toBe("Santri Terdaftar");
    expect(view).not.toHaveProperty("email");
    expect(view).not.toHaveProperty("phone");
    expect(view).not.toHaveProperty("clerkId");
  });

  test("diri sendiri dan staf mendapat profil lengkap", async () => {
    const t = convexTest(schema, modules);
    const { santriUser } = await seedWorld(t);
    const self = await as(t, "clerk_santri").query(api.users.getById, { userId: santriUser });
    expect(self).toHaveProperty("email");
    const staff = await as(t, "clerk_ustadz").query(api.users.getById, { userId: santriUser });
    expect(staff).toHaveProperty("email");
  });
});

// ---------------------------------------------------------------------------
describe("melewati approval lembaga", () => {
  test("user biasa tidak bisa membuat lembaga untuk dirinya sendiri", async () => {
    const t = convexTest(schema, modules);
    const { intruderUser } = await seedWorld(t);
    await expect(
      as(t, "clerk_intruder").mutation(api.adminPengajian.create, {
        userId: intruderUser,
        namaLembaga: "Lembaga Palsu",
        kota: "X",
        provinsi: "Y",
      })
    ).rejects.toThrow();
  });

  test("administrator boleh", async () => {
    const t = convexTest(schema, modules);
    const { intruderUser } = await seedWorld(t);
    await as(t, "clerk_admin").mutation(api.adminPengajian.create, {
      userId: intruderUser,
      namaLembaga: "Lembaga Sah",
      kota: "X",
      provinsi: "Y",
    });
  });

  test("fotoUrl berskema javascript: ditolak", async () => {
    const t = convexTest(schema, modules);
    const { intruderUser } = await seedWorld(t);
    await expect(
      as(t, "clerk_admin").mutation(api.adminPengajian.create, {
        userId: intruderUser,
        namaLembaga: "L",
        kota: "X",
        provinsi: "Y",
        fotoUrl: "javascript:alert(1)",
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe("upload storage", () => {
  test("appConfig.generateUploadUrl menolak anonim & non-admin", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);
    await expect(t.mutation(api.appConfig.generateUploadUrl, {})).rejects.toThrow();
    await expect(
      as(t, "clerk_intruder").mutation(api.appConfig.generateUploadUrl, {})
    ).rejects.toThrow();
    const url = await as(t, "clerk_admin").mutation(api.appConfig.generateUploadUrl, {});
    expect(typeof url).toBe("string");
  });

  test("recordings.generateUploadUrl menolak santri biasa", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);
    await expect(
      as(t, "clerk_santri").mutation(api.recordings.generateUploadUrl, {})
    ).rejects.toThrow();
    const url = await as(t, "clerk_ustadz").mutation(api.recordings.generateUploadUrl, {});
    expect(typeof url).toBe("string");
  });
});

// ---------------------------------------------------------------------------
describe("meeting — akses room & pembajakan sesi", () => {
  test("penyusup tidak bisa join, mengintip peserta, chat, atau signal", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    const intruder = as(t, "clerk_intruder");

    await expect(
      intruder.mutation(api.meeting.join, {
        pertemuanId: w.pertemuan,
        sessionId: "sess-x",
        userId: w.intruderUser,
        name: "Penyusup",
      })
    ).rejects.toThrow();
    expect(await intruder.query(api.meeting.participants, { pertemuanId: w.pertemuan })).toEqual([]);
    expect(await intruder.query(api.meeting.listMessages, { pertemuanId: w.pertemuan })).toEqual([]);
    await expect(
      intruder.mutation(api.meeting.sendMessage, {
        pertemuanId: w.pertemuan,
        userId: w.intruderUser,
        name: "x",
        text: "halo",
      })
    ).rejects.toThrow();
  });

  test("santri terdaftar bisa join; nama diambil dari profil, bukan argumen", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    await as(t, "clerk_santri").mutation(api.meeting.join, {
      pertemuanId: w.pertemuan,
      sessionId: "sess-1",
      userId: w.santriUser,
      name: "Nama Palsu Pak Ustadz",
    });
    const list = await as(t, "clerk_santri").query(api.meeting.participants, {
      pertemuanId: w.pertemuan,
    });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Santri Terdaftar");
  });

  test("peserta lain tidak bisa mengeluarkan / membaca signal / mengonsumsi signal sesi orang", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    const a = as(t, "clerk_santri");
    const b = as(t, "clerk_santri2");
    await a.mutation(api.meeting.join, {
      pertemuanId: w.pertemuan,
      sessionId: "sess-a",
      userId: w.santriUser,
      name: "A",
    });
    await b.mutation(api.meeting.join, {
      pertemuanId: w.pertemuan,
      sessionId: "sess-b",
      userId: w.santri2User,
      name: "B",
    });

    // B menembak ke A; A menerima.
    await b.mutation(api.meeting.signal, {
      pertemuanId: w.pertemuan,
      fromSession: "sess-b",
      toSession: "sess-a",
      kind: "offer",
      payload: "{}",
    });
    expect(await a.query(api.meeting.signalsFor, { pertemuanId: w.pertemuan, sessionId: "sess-a" })).toHaveLength(1);

    // B (bukan pemilik sess-a) tidak boleh membaca signal untuk sess-a.
    expect(await b.query(api.meeting.signalsFor, { pertemuanId: w.pertemuan, sessionId: "sess-a" })).toEqual([]);

    // B tidak bisa memalsukan pengirim sess-a.
    await expect(
      b.mutation(api.meeting.signal, {
        pertemuanId: w.pertemuan,
        fromSession: "sess-a",
        toSession: "sess-b",
        kind: "offer",
        payload: "{}",
      })
    ).rejects.toThrow();

    // B tidak bisa mengeluarkan sess-a.
    await expect(
      b.mutation(api.meeting.leave, { pertemuanId: w.pertemuan, sessionId: "sess-a" })
    ).rejects.toThrow();
    const still = await a.query(api.meeting.participants, { pertemuanId: w.pertemuan });
    expect(still.map((p) => p.sessionId).sort()).toEqual(["sess-a", "sess-b"]);

    // B tidak bisa menghapus signal milik A lewat consumeSignals.
    const [sig] = await a.query(api.meeting.signalsFor, { pertemuanId: w.pertemuan, sessionId: "sess-a" });
    await b.mutation(api.meeting.consumeSignals, { ids: [sig._id] });
    expect(await a.query(api.meeting.signalsFor, { pertemuanId: w.pertemuan, sessionId: "sess-a" })).toHaveLength(1);
    await a.mutation(api.meeting.consumeSignals, { ids: [sig._id] });
    expect(await a.query(api.meeting.signalsFor, { pertemuanId: w.pertemuan, sessionId: "sess-a" })).toHaveLength(0);
  });

  test("rekaman: penyusup tidak mendapat daftar rekaman", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("meeting_recordings", {
        pertemuanId: w.pertemuan,
        kelasId: w.kelasA,
        byUserId: w.ustadzUser,
        byName: "Ustadz",
        status: "ready",
        driveLink: "https://drive.google.com/file/d/abc/view",
        mimeType: "video/webm",
        sizeBytes: 1,
        durationSec: 1,
        createdAt: new Date().toISOString(),
      });
    });
    expect(await as(t, "clerk_intruder").query(api.recordings.listByPertemuan, { pertemuanId: w.pertemuan })).toEqual([]);
    expect(await as(t, "clerk_santri").query(api.recordings.listByPertemuan, { pertemuanId: w.pertemuan })).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe("talaqi — nilai santri", () => {
  async function seedTalaqi(t: T, w: Awaited<ReturnType<typeof seedWorld>>) {
    await t.run(async (ctx) => {
      for (const userId of [w.santriUser, w.santri2User]) {
        await ctx.db.insert("talaqi", {
          userId,
          ustadzId: w.ustadzUser,
          kelasId: w.kelasA,
          kelasPertemuanId: w.pertemuan,
          tanggal: "2026-01-01",
          presensi: true,
          type: "tahsin",
          nilai: 8,
          catatan: `rahasia-${userId}`,
        });
      }
    });
  }

  test("santri hanya melihat catatannya sendiri; ustadz melihat semua; penyusup tidak melihat apa pun", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    await seedTalaqi(t, w);
    const args = { kelasPertemuanId: w.pertemuan };

    const santriView = await as(t, "clerk_santri").query(api.talaqi.getByKelasPertemuan, args);
    expect(santriView).toHaveLength(1);
    expect(santriView[0].userId).toBe(w.santriUser);

    expect(await as(t, "clerk_ustadz").query(api.talaqi.getByKelasPertemuan, args)).toHaveLength(2);
    expect(await as(t, "clerk_intruder").query(api.talaqi.getByKelasPertemuan, args)).toEqual([]);
    expect(await as(t, "clerk_intruder").query(api.talaqi.getByKelas, { kelasId: w.kelasA })).toEqual([]);
  });

  test("pemilik LKM lain tidak bisa menulis nilai di kelas orang", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    await expect(
      as(t, "clerk_lkm_b").mutation(api.talaqi.upsertForPertemuan, {
        userId: w.santriUser,
        ustadzId: w.lkmBUser,
        kelasId: w.kelasA,
        kelasPertemuanId: w.pertemuan,
        tanggal: "2026-01-01",
        presensi: true,
        type: "tahsin",
        nilai: 10,
      })
    ).rejects.toThrow();
  });

  test("ustadz pengampu boleh menilai santri terdaftar, tapi tidak santri non-anggota", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    const base = {
      ustadzId: w.ustadzUser,
      kelasId: w.kelasA,
      kelasPertemuanId: w.pertemuan,
      tanggal: "2026-01-01",
      presensi: true,
      type: "tahsin" as const,
      nilai: 9 as const,
    };
    await as(t, "clerk_ustadz").mutation(api.talaqi.upsertForPertemuan, {
      ...base,
      userId: w.santriUser,
    });
    await expect(
      as(t, "clerk_ustadz").mutation(api.talaqi.upsertForPertemuan, {
        ...base,
        userId: w.intruderUser,
      })
    ).rejects.toThrow();
  });

  test("getByAdminPengajian tidak bocor ke staf lembaga lain", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("talaqi", {
        userId: w.santriUser,
        ustadzId: w.ustadzUser,
        adminPengajianId: w.lkmA,
        tanggal: "2026-01-01",
        presensi: true,
        type: "tahsin",
      });
    });
    expect(await as(t, "clerk_lkm_b").query(api.talaqi.getByAdminPengajian, { adminPengajianId: w.lkmA })).toEqual([]);
    expect(await as(t, "clerk_lkm_a").query(api.talaqi.getByAdminPengajian, { adminPengajianId: w.lkmA })).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe("kelas & join request lintas lembaga", () => {
  test("kelas.listSantri: penyusup kosong, santri hanya dirinya, pengelola semua", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    const args = { kelasId: w.kelasA };
    expect(await as(t, "clerk_intruder").query(api.kelas.listSantri, args)).toEqual([]);
    expect(await as(t, "clerk_santri").query(api.kelas.listSantri, args)).toHaveLength(1);
    expect(await as(t, "clerk_lkm_a").query(api.kelas.listSantri, args)).toHaveLength(2);
  });

  test("pemilik LKM B tidak bisa memasukkan santri ke kelas LKM A saat approve", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    const requestId = await t.run(async (ctx) => {
      const santri = await ctx.db
        .query("santri")
        .withIndex("by_userId", (q) => q.eq("userId", w.intruderUser))
        .first();
      return await ctx.db.insert("lkm_join_request", {
        santriId: santri!._id,
        userId: w.intruderUser,
        adminPengajianId: w.lkmB,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    });
    await expect(
      as(t, "clerk_lkm_b").mutation(api.lkmJoinRequest.approve, {
        id: requestId,
        assignedKelasId: w.kelasA, // milik LKM A
        reviewedBy: w.lkmBUser,
      })
    ).rejects.toThrow();
  });

  test("kelas.create menolak ustadz dari lembaga lain", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    await expect(
      as(t, "clerk_lkm_b").mutation(api.kelas.create, {
        adminPengajianId: w.lkmB,
        ustadzId: w.ustadz, // ustadz milik LKM A
        nama: "Kelas Curian",
        type: "tahsin",
        modeDefault: "online",
        jumlahPertemuan: 2,
        tanggalMulai: "2026-01-01",
        jadwal: [{ hari: 1, jamMulai: "08:00", jamSelesai: "09:00" }],
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe("materi & kuis", () => {
  const baseMateri = {
    seq: 1,
    judul: "Bab",
    isShow: true,
    type: "tahsin" as const,
  };

  test("URL berbahaya (javascript:) ditolak di propose/create", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    await expect(
      as(t, "clerk_lkm_a").mutation(api.materi.propose, {
        ...baseMateri,
        urlPdf: "javascript:alert(document.cookie)",
        submittedBy: w.lkmAUser,
        submittedByAdminPengajianId: w.lkmA,
      })
    ).rejects.toThrow();
    await expect(
      as(t, "clerk_admin").mutation(api.materi.create, {
        ...baseMateri,
        urlVideo: "http://insecure.example/video",
      })
    ).rejects.toThrow();
  });

  test("materi yang sudah disetujui kembali ke pending saat diedit pengusul (tidak lolos review)", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    const id = await as(t, "clerk_lkm_a").mutation(api.materi.propose, {
      ...baseMateri,
      submittedBy: w.lkmAUser,
      submittedByAdminPengajianId: w.lkmA,
    });
    await as(t, "clerk_admin").mutation(api.materi.approve, { id, reviewedBy: w.adminId });
    await as(t, "clerk_lkm_a").mutation(api.materi.update, {
      id,
      urlPdf: "https://example.com/ganti-isi.pdf",
    });
    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.status).toBe("pending");
  });

  test("materi belum disetujui tidak terbaca lewat getById oleh pengguna lain", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    const id = await as(t, "clerk_lkm_a").mutation(api.materi.propose, {
      ...baseMateri,
      submittedBy: w.lkmAUser,
      submittedByAdminPengajianId: w.lkmA,
    });
    expect(await as(t, "clerk_intruder").query(api.materi.getById, { id })).toBeNull();
    expect(await as(t, "clerk_lkm_a").query(api.materi.getById, { id })).not.toBeNull();
  });

  test("pemilik LKM tidak bisa mengubah kuis materi milik administrator", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    const materiId = await as(t, "clerk_admin").mutation(api.materi.create, baseMateri);
    await expect(
      as(t, "clerk_lkm_a").mutation(api.quiz.createQuiz, {
        materiId,
        question: "Soal titipan",
        type: "essay",
      })
    ).rejects.toThrow();
    // Administrator tetap bisa.
    await as(t, "clerk_admin").mutation(api.quiz.createQuiz, {
      materiId,
      question: "Soal sah",
      type: "essay",
    });
    void w;
  });
});

// ---------------------------------------------------------------------------
describe("mushaf & skor", () => {
  test("halaman mushaf di luar 1..604 ditolak", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    await expect(
      as(t, "clerk_santri").mutation(api.mushafProgress.recordPageRead, {
        userId: w.santriUser,
        page: 99999,
        surahNumber: 1,
        surahName: "Al-Fatihah",
        juz: 1,
        tanggal: "2026-01-01",
        source: "app",
      })
    ).rejects.toThrow();
  });

  test("skor Sambung Ayat yang mustahil ditolak", async () => {
    const t = convexTest(schema, modules);
    const w = await seedWorld(t);
    await expect(
      as(t, "clerk_santri").mutation(api.sambungAyat.submitScore, {
        userId: w.santriUser,
        score: 999_999_999,
        correctCount: 1,
        totalCount: 1,
        bestCombo: 1,
        juzRange: "Juz 30",
      })
    ).rejects.toThrow();
    await as(t, "clerk_santri").mutation(api.sambungAyat.submitScore, {
      userId: w.santriUser,
      score: 400,
      correctCount: 3,
      totalCount: 4,
      bestCombo: 3,
      juzRange: "Juz 30",
    });
  });
});

// ---------------------------------------------------------------------------
describe("endpoint IoT", () => {
  test("tanggal tidak valid dan page NaN-like ditolak; tanpa apiKey 401", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);
    const post = (body: unknown, headers: Record<string, string> = {}) =>
      t.fetch("/iot/page-read", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "x-forwarded-for": "198.51.100.7", ...headers },
      });
    expect((await post({ page: 5 })).status).toBe(401);
    expect((await post({ apiKey: "k", page: 5, tanggal: "bukan-tanggal" })).status).toBe(400);
    expect((await post({ apiKey: "k", page: 5.5e300 })).status).toBe(400);
    // Kunci tidak dikenal via header → 401 (bukan 400).
    expect((await post({ page: 5 }, { "x-api-key": "salah" })).status).toBe(401);
  });
});
