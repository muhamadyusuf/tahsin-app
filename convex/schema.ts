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
  })
    .index("by_parentId", ["parentId"])
    .index("by_type", ["type"])
    .index("by_type_seq", ["type", "seq"]),

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
  })
    .index("by_userId", ["userId"])
    .index("by_userId_tanggal", ["userId", "tanggal"]),

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
  })
    .index("by_userId", ["userId"])
    .index("by_ustadzId", ["ustadzId"])
    .index("by_adminPengajianId", ["adminPengajianId"])
    .index("by_userId_tanggal", ["userId", "tanggal"]),

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
});
