import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Extended user profile linked to Clerk
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    role: v.union(
      v.literal("administrator"),
      v.literal("admin_pengajian"),
      v.literal("ustadz"),
      v.literal("santri")
    ),
    adminPengajianId: v.optional(v.id("admin_pengajian")),
    location: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // Lembaga pengajian managed by admin_pengajian role
  admin_pengajian: defineTable({
    userId: v.id("users"),
    namaLembaga: v.string(),
    alamat: v.optional(v.string()),
    kota: v.string(),
    provinsi: v.string(),
    latitude: v.optional(v.float64()),
    longitude: v.optional(v.float64()),
    fotoUrl: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_kota", ["kota"])
    .index("by_provinsi", ["provinsi"]),

  // Ustadz linked to admin_pengajian
  ustadz: defineTable({
    userId: v.id("users"),
    adminPengajianId: v.id("admin_pengajian"),
    spesialisasi: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_adminPengajianId", ["adminPengajianId"]),

  // Santri — can register independently
  santri: defineTable({
    userId: v.id("users"),
    adminPengajianId: v.optional(v.id("admin_pengajian")),
    ustadzId: v.optional(v.id("ustadz")),
    isActive: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_adminPengajianId", ["adminPengajianId"])
    .index("by_ustadzId", ["ustadzId"]),

  // Materi — hierarchical (parent-child), supports tahsin & ulumul_quran
  materi: defineTable({
    seq: v.float64(),
    parentId: v.optional(v.id("materi")),
    judul: v.string(),
    deskripsi: v.optional(v.string()),
    urlCover: v.optional(v.string()),
    urlVideo: v.optional(v.string()),
    isShow: v.boolean(),
    type: v.union(v.literal("tahsin"), v.literal("ulumul_quran")),
    // Approval workflow — undefined/omitted is treated as "approved" so
    // pre-existing rows (created before this field existed) stay visible.
    status: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
    ),
    submittedBy: v.optional(v.id("users")),
    submittedByAdminPengajianId: v.optional(v.id("admin_pengajian")),
    reviewedBy: v.optional(v.id("users")),
    reviewNote: v.optional(v.string()),
    reviewedAt: v.optional(v.string()),
  })
    .index("by_parentId", ["parentId"])
    .index("by_type", ["type"])
    .index("by_type_seq", ["type", "seq"])
    .index("by_status", ["status"])
    .index("by_submittedBy", ["submittedBy"]),

  // Quiz per materi
  quiz: defineTable({
    materiId: v.id("materi"),
    question: v.string(),
    urlImage: v.optional(v.string()),
    urlVideo: v.optional(v.string()),
    type: v.union(v.literal("pilihan_ganda"), v.literal("essay")),
  }).index("by_materiId", ["materiId"]),

  // Quiz answer options (for pilihan_ganda)
  quiz_options: defineTable({
    seq: v.float64(),
    quizId: v.id("quiz"),
    urlImage: v.optional(v.string()),
    deskripsi: v.string(),
    poin: v.float64(),
  }).index("by_quizId", ["quizId"]),

  // Tilawah harian log
  tilawah_harian: defineTable({
    userId: v.id("users"),
    tanggal: v.string(), // ISO date string YYYY-MM-DD
    suratNumber: v.float64(),
    suratName: v.string(),
    juz: v.float64(),
    jumlahHalaman: v.float64(),
    isKhatam: v.optional(v.boolean()), // user-declared khatam marker
    // Where this entry came from — manual form entry, auto-tracked from the
    // Mushaf reader, or reported by a synced IoT device. Defaults to manual
    // for legacy rows (field didn't exist before).
    source: v.optional(
      v.union(v.literal("manual"), v.literal("mushaf"), v.literal("iot"))
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_tanggal", ["userId", "tanggal"]),

  // Distinct (user, date, page) reads from the Mushaf reader — used to dedupe
  // auto-tracking so revisiting the same page the same day doesn't inflate
  // tilawah_harian counts.
  mushaf_read_log: defineTable({
    userId: v.id("users"),
    tanggal: v.string(), // ISO date string YYYY-MM-DD
    page: v.float64(), // 1-604
    surahNumber: v.float64(),
    surahName: v.string(),
    juz: v.float64(),
    source: v.union(v.literal("app"), v.literal("iot")),
  })
    .index("by_userId_tanggal_page", ["userId", "tanggal", "page"])
    .index("by_userId_tanggal", ["userId", "tanggal"]),

  // Latest known Mushaf reading position per user — written by the app as the
  // user reads, and by IoT devices when they report a page turn. Lets an IoT
  // device poll "where is this user currently reading" and lets the app show
  // the last page an IoT device reported.
  reading_position: defineTable({
    userId: v.id("users"),
    page: v.float64(),
    surahNumber: v.float64(),
    surahName: v.string(),
    juz: v.float64(),
    updatedAt: v.string(), // ISO datetime
    updatedBy: v.union(v.literal("app"), v.literal("iot")),
  }).index("by_userId", ["userId"]),

  // IoT devices paired to a user account, authenticated via apiKey when
  // calling the public HTTP endpoints in convex/http.ts.
  iot_devices: defineTable({
    userId: v.id("users"),
    deviceName: v.string(),
    apiKey: v.string(),
    isActive: v.boolean(),
    lastSeenAt: v.optional(v.string()), // ISO datetime
  })
    .index("by_userId", ["userId"])
    .index("by_apiKey", ["apiKey"]),

  // Talaqi session records
  talaqi: defineTable({
    userId: v.id("users"), // santri
    ustadzId: v.id("users"), // ustadz user
    adminPengajianId: v.optional(v.id("admin_pengajian")),
    tanggal: v.string(), // ISO date string
    presensi: v.boolean(),
    type: v.union(
      v.literal("tahsin"),
      v.literal("murojaah"),
      v.literal("tahfidz")
    ),
    materiId: v.optional(v.id("materi")),
    subMateriId: v.optional(v.id("materi")),
    suratNumber: v.optional(v.float64()),
    suratName: v.optional(v.string()),
    juz: v.optional(v.float64()),
    nilai: v.optional(
      v.union(
        v.literal(6),
        v.literal(6.5),
        v.literal(7),
        v.literal(7.5),
        v.literal(8),
        v.literal(8.5),
        v.literal(9),
        v.literal(9.5),
        v.literal(10)
      )
    ),
    catatan: v.optional(v.string()),
    // Links this record to a specific kelas/pertemuan when it originates from
    // the structured kelas teaching flow. Optional so ad-hoc talaqi rows
    // (not tied to any kelas) keep working unchanged.
    kelasId: v.optional(v.id("kelas")),
    kelasPertemuanId: v.optional(v.id("kelas_pertemuan")),
  })
    .index("by_userId", ["userId"])
    .index("by_ustadzId", ["ustadzId"])
    .index("by_adminPengajianId", ["adminPengajianId"])
    .index("by_userId_tanggal", ["userId", "tanggal"])
    .index("by_kelasId", ["kelasId"])
    .index("by_kelasPertemuanId_userId", ["kelasPertemuanId", "userId"]),

  // LKM join request — santri requesting to join a lembaga/kelas, pending LKM verification
  lkm_join_request: defineTable({
    santriId: v.id("santri"),
    userId: v.id("users"), // denormalized for easy display join
    adminPengajianId: v.id("admin_pengajian"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    requestedKelasId: v.optional(v.id("kelas")),
    assignedKelasId: v.optional(v.id("kelas")),
    reviewedBy: v.optional(v.id("users")),
    reviewNote: v.optional(v.string()),
    createdAt: v.string(),
    reviewedAt: v.optional(v.string()),
  })
    .index("by_santriId", ["santriId"])
    .index("by_adminPengajianId_status", ["adminPengajianId", "status"]),

  // Kelas (class) — created/managed by admin_pengajian
  kelas: defineTable({
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
    // Used to auto-generate the kelas_pertemuan schedule at creation time.
    // Optional so kelas rows created before this field existed stay valid.
    jumlahPertemuan: v.optional(v.float64()),
    tanggalMulai: v.optional(v.string()), // ISO date string
    isActive: v.boolean(),
    createdAt: v.string(),
  })
    .index("by_adminPengajianId", ["adminPengajianId"])
    .index("by_ustadzId", ["ustadzId"]),

  // Recurring weekly schedule slots for a kelas
  kelas_jadwal: defineTable({
    kelasId: v.id("kelas"),
    hari: v.union(
      v.literal(0),
      v.literal(1),
      v.literal(2),
      v.literal(3),
      v.literal(4),
      v.literal(5),
      v.literal(6)
    ), // 0=Minggu
    jamMulai: v.string(), // "HH:mm"
    jamSelesai: v.string(),
  }).index("by_kelasId", ["kelasId"]),

  // Kelas enrollment — many santri per kelas
  kelas_santri: defineTable({
    kelasId: v.id("kelas"),
    santriId: v.id("santri"),
    userId: v.id("users"), // denormalized
    joinedAt: v.string(),
    isActive: v.boolean(),
  })
    .index("by_kelasId", ["kelasId"])
    .index("by_santriId", ["santriId"])
    .index("by_kelasId_santriId", ["kelasId", "santriId"]),

  // One row per scheduled meeting occurrence of a kelas, auto-generated from
  // the kelas jadwal + jumlahPertemuan + tanggalMulai when the kelas is created.
  kelas_pertemuan: defineTable({
    kelasId: v.id("kelas"),
    pertemuanKe: v.float64(),
    tanggal: v.string(),
    mode: v.union(v.literal("online"), v.literal("offline")),
    meetingUrl: v.optional(v.string()),
    status: v.union(
      v.literal("scheduled"),
      v.literal("ongoing"),
      v.literal("done"),
      v.literal("cancelled")
    ),
    startedAt: v.optional(v.string()),
    endedAt: v.optional(v.string()),
  })
    .index("by_kelasId", ["kelasId"])
    .index("by_kelasId_pertemuanKe", ["kelasId", "pertemuanKe"]),

  // User learning progress
  user_progress: defineTable({
    userId: v.id("users"),
    materiId: v.id("materi"),
    quizId: v.optional(v.id("quiz")),
    score: v.optional(v.float64()),
    completedAt: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_materiId", ["userId", "materiId"]),

  // User quiz answers
  user_quiz_answers: defineTable({
    userId: v.id("users"),
    quizId: v.id("quiz"),
    optionId: v.optional(v.id("quiz_options")),
    answer: v.optional(v.string()), // for essay
    isCorrect: v.optional(v.boolean()),
    answeredAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_quizId", ["userId", "quizId"]),

  // Khatam (completed reading all 114 surahs) log
  khatam: defineTable({
    userId: v.id("users"),
    khatamKe: v.float64(), // ordinal: 1st, 2nd, 3rd, ...
    completedAt: v.string(), // ISO date
  }).index("by_userId", ["userId"]),

  // Global app configuration managed by admin
  app_config: defineTable({
    key: v.string(),
    tilawahHeaderImageUrl: v.optional(v.string()),
    updatedAt: v.string(),
  }).index("by_key", ["key"]),

  // Ceramah video posts (YouTube links) managed by admin
  ceramah_video: defineTable({
    judul: v.string(),
    deskripsi: v.optional(v.string()),
    youtubeUrl: v.string(),
    isLive: v.boolean(),
    postedBy: v.id("users"),
    isActive: v.boolean(),
    createdAt: v.string(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_postedBy", ["postedBy"]),

  // Sambung Ayat game — personal best score per user, powers the leaderboard
  sambung_ayat_scores: defineTable({
    userId: v.id("users"),
    score: v.float64(),
    correctCount: v.float64(),
    totalCount: v.float64(),
    bestCombo: v.float64(),
    juzRange: v.string(), // e.g. "Juz 30" or "Juz 1-5"
    updatedAt: v.string(), // ISO datetime
  })
    .index("by_userId", ["userId"])
    .index("by_score", ["score"]),

  // Ngaji AI — hasil analisis bacaan terbaru per user+surah+ayat.
  // Satu dokumen per ayat (di-upsert saat rekam ulang), attemptCount &
  // bestScore menyimpan jejak perbaikan tanpa menumpuk riwayat tak terbatas.
  ngaji_ai_results: defineTable({
    userId: v.id("users"),
    surahNumber: v.float64(),
    ayahNumber: v.float64(),
    score: v.float64(),
    bestScore: v.float64(),
    pronunciationScore: v.float64(),
    tajwidScore: v.float64(),
    fluencyScore: v.float64(),
    transcript: v.string(),
    expectedText: v.string(),
    wordStatuses: v.array(
      v.object({
        displayIndex: v.float64(),
        word: v.string(),
        status: v.string(), // correct | partial | wrong | missing
        recognized: v.string(),
        similarity: v.float64(),
        note: v.string(),
        // Status per huruf (tanpa harakat) untuk highlight ala ngaji.ai;
        // optional agar dokumen lama tetap valid.
        letters: v.optional(
          v.array(v.object({ letter: v.string(), correct: v.boolean() }))
        ),
      })
    ),
    mistakes: v.array(
      v.object({
        wordIndex: v.float64(),
        expected: v.string(),
        recognized: v.string(),
        type: v.string(), // missing | different | extra
        note: v.string(),
      })
    ),
    extraWords: v.array(
      v.object({
        recognized: v.string(),
        atRecognizedIndex: v.float64(),
        note: v.string(),
      })
    ),
    recommendation: v.string(),
    attemptCount: v.float64(),
    updatedAt: v.string(), // ISO datetime
  })
    .index("by_userId_surah_ayah", ["userId", "surahNumber", "ayahNumber"])
    .index("by_userId_surah", ["userId", "surahNumber"])
    .index("by_userId", ["userId"]),

  // Peserta yang sedang berada di dalam video meeting internal (WebRTC mesh).
  // Baris dibuat saat join, di-refresh lewat heartbeat, dan dihapus saat leave
  // atau saat heartbeat berhenti (dianggap terputus).
  meeting_participants: defineTable({
    pertemuanId: v.id("kelas_pertemuan"),
    sessionId: v.string(), // id unik per perangkat/tab, dibuat di client
    userId: v.id("users"),
    name: v.string(),
    micOn: v.boolean(),
    camOn: v.boolean(),
    // Host (ustadz pengampu) — boleh mem-mute / meminta unmute peserta lain.
    isHost: v.optional(v.boolean()),
    // Sedang share layar (video track kamera diganti track layar).
    screenOn: v.optional(v.boolean()),
    // Sedang merekam sesi — ditampilkan sebagai badge REC ke semua peserta.
    recOn: v.optional(v.boolean()),
    lastSeen: v.float64(), // epoch ms heartbeat terakhir
  })
    .index("by_pertemuanId", ["pertemuanId"])
    .index("by_pertemuanId_sessionId", ["pertemuanId", "sessionId"]),

  // Pesan signaling WebRTC (SDP offer/answer & ICE candidate) antar peserta,
  // plus perintah moderasi host ("ctrl": mute / minta-unmute).
  // Dikonsumsi (dihapus) oleh penerima setelah diproses.
  meeting_signals: defineTable({
    pertemuanId: v.id("kelas_pertemuan"),
    fromSession: v.string(),
    toSession: v.string(),
    kind: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("ice"),
      v.literal("ctrl")
    ),
    payload: v.string(), // JSON SDP / ICE candidate / perintah ctrl
  })
    .index("by_pertemuanId_toSession", ["pertemuanId", "toSession"])
    .index("by_pertemuanId", ["pertemuanId"]),

  // Chat teks di dalam video meeting. Dipertahankan setelah meeting selesai
  // sehingga diskusi tetap bisa dibaca dari halaman pertemuan.
  meeting_messages: defineTable({
    pertemuanId: v.id("kelas_pertemuan"),
    userId: v.id("users"),
    name: v.string(),
    text: v.string(),
  }).index("by_pertemuanId", ["pertemuanId"]),

  // Rekaman sesi video meeting. File direkam di client (web) lalu diunggah ke
  // Convex storage; action Node kemudian memindahkannya ke Google Drive bila
  // kredensial Drive dikonfigurasi (lihat convex/recordingsNode.ts).
  meeting_recordings: defineTable({
    pertemuanId: v.id("kelas_pertemuan"),
    kelasId: v.id("kelas"),
    byUserId: v.id("users"),
    byName: v.string(),
    storageId: v.optional(v.id("_storage")), // dihapus setelah pindah ke Drive
    driveFileId: v.optional(v.string()),
    driveLink: v.optional(v.string()), // webViewLink Google Drive
    status: v.union(
      v.literal("processing"), // baru diunggah, menunggu transfer Drive
      v.literal("ready"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    mimeType: v.string(),
    sizeBytes: v.float64(),
    durationSec: v.float64(),
    createdAt: v.string(), // ISO datetime
  }).index("by_pertemuanId", ["pertemuanId"]),

  // Ringkasan Ngaji AI per surah (denormalisasi) — dipakai daftar surah agar
  // tidak perlu membaca seluruh ngaji_ai_results milik user.
  ngaji_ai_surah_summary: defineTable({
    userId: v.id("users"),
    surahNumber: v.float64(),
    totalScore: v.float64(), // jumlah skor terbaru semua ayat yang dinilai
    ayahDone: v.float64(), // banyaknya ayat yang sudah punya hasil
    totalAyahs: v.float64(),
    lastAyahNumber: v.float64(), // posisi terakhir latihan
    updatedAt: v.string(), // ISO datetime
  })
    .index("by_userId", ["userId"])
    .index("by_userId_surah", ["userId", "surahNumber"]),

  // Rekap Tasbih Digital — agregat harian per jenis dzikir. Sengaja low-churn:
  // hanya di-update saat satu putaran selesai atau sesi disimpan (bukan setiap
  // ketukan), sehingga aman dari amplifikasi tulis.
  tasbih_harian: defineTable({
    userId: v.id("users"),
    tanggal: v.string(), // YYYY-MM-DD (waktu lokal pengguna)
    dzikirId: v.string(), // id preset: subhanallah, alhamdulillah, dst.
    dzikirLabel: v.string(),
    jumlah: v.float64(), // total hitungan hari itu untuk dzikir ini
    putaran: v.float64(), // banyaknya putaran (target tercapai)
    updatedAt: v.string(), // ISO datetime
  })
    .index("by_userId", ["userId"])
    .index("by_userId_tanggal", ["userId", "tanggal"])
    .index("by_userId_tanggal_dzikir", ["userId", "tanggal", "dzikirId"]),

  // Rekap Dzikir harian — satu baris per butir dzikir yang diselesaikan,
  // di-dedup per (user, tanggal, kategori, butir) agar tidak dobel.
  dzikir_selesai: defineTable({
    userId: v.id("users"),
    tanggal: v.string(), // YYYY-MM-DD
    kategoriId: v.string(), // pagi, petang, setelah-shalat, dst.
    kategoriLabel: v.string(),
    itemId: v.string(),
    itemJudul: v.string(),
    completedAt: v.string(), // ISO datetime
  })
    .index("by_userId", ["userId"])
    .index("by_userId_tanggal", ["userId", "tanggal"])
    .index("by_userId_tanggal_kategori", ["userId", "tanggal", "kategoriId"])
    .index("by_userId_tanggal_kategori_item", [
      "userId",
      "tanggal",
      "kategoriId",
      "itemId",
    ]),

  // Target ibadah harian yang ditetapkan pengguna (satu baris per user).
  dzikir_target: defineTable({
    userId: v.id("users"),
    tasbihTarget: v.float64(), // target total hitungan tasbih per hari
    dzikirKategori: v.array(v.string()), // kategori dzikir yang ditargetkan tuntas tiap hari
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),
});
