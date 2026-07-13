import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { useAuthContext } from "@/lib/auth-context";
import { Colors, TALAQI_TYPES } from "@/lib/constants";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const TYPE_COLORS: Record<string, string> = {
  tahsin: Colors.primary,
  murojaah: Colors.secondary,
  tahfidz: "#7B1FA2",
};

const TYPE_ICONS: Record<
  string,
  React.ComponentProps<typeof FontAwesome>["name"]
> = {
  tahsin: "book",
  murojaah: "refresh",
  tahfidz: "bookmark",
};

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function TalaqiScreen() {
  const { role } = useAuthContext();

  if (role === "ustadz") {
    return <UstadzTalaqiContent />;
  }
  return <SantriTalaqiContent />;
}

function UstadzTalaqiContent() {
  const router = useRouter();
  const { userData } = useAuthContext();

  const ownUstadz = useQuery(
    api.ustadz.getByUserId,
    userData?._id ? { userId: userData._id } : "skip",
  );
  const kelasList = useQuery(
    api.kelas.listByUstadz,
    ownUstadz?._id ? { ustadzId: ownUstadz._id } : "skip",
  );

  const isLoading =
    ownUstadz === undefined || (ownUstadz && kelasList === undefined);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat kelas Anda...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Talaqi</Text>
            <Text style={styles.headerSubtitle}>Kelas yang Anda ampu</Text>
          </View>
          <View style={styles.headerIcon}>
            <FontAwesome
              name="graduation-cap"
              size={24}
              color={Colors.primary}
            />
          </View>
        </View>
      </View>

      {!ownUstadz ? (
        <View style={styles.emptyState}>
          <FontAwesome name="user-md" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Profil Ustadz Belum Ada</Text>
          <Text style={styles.emptySubtitle}>
            Hubungi admin lembaga pengajian Anda untuk didaftarkan sebagai
            ustadz.
          </Text>
        </View>
      ) : (kelasList ?? []).length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome
            name="graduation-cap"
            size={48}
            color={Colors.textSecondary}
          />
          <Text style={styles.emptyTitle}>Belum Ada Kelas</Text>
          <Text style={styles.emptySubtitle}>
            Kelas yang ditugaskan LKM akan tampil di sini
          </Text>
        </View>
      ) : (
        (kelasList ?? []).map((kelas) => (
          <KelasCard
            key={kelas._id}
            kelas={kelas}
            onPress={() =>
              router.push({
                pathname: "/kelas-detail/[kelasId]",
                params: { kelasId: kelas._id },
              })
            }
          />
        ))
      )}
    </ScrollView>
  );
}

function KelasCard({
  kelas,
  onPress,
}: {
  kelas: Doc<"kelas">;
  onPress: () => void;
}) {
  const pertemuanList = useQuery(api.kelasPertemuan.listByKelas, {
    kelasId: kelas._id,
  });
  const nextPertemuan = (pertemuanList ?? []).find(
    (p) => p.status === "scheduled",
  );
  const typeLabel =
    TALAQI_TYPES.find((t) => t.value === kelas.type)?.label ?? kelas.type;

  return (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.sessionBody}>
        <View style={styles.sessionRow}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: TYPE_COLORS[kelas.type] ?? Colors.primary },
            ]}
          >
            <FontAwesome
              name={TYPE_ICONS[kelas.type] ?? "book"}
              size={10}
              color="#fff"
            />
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
          <Text style={styles.sessionDate}>
            {kelas.modeDefault === "online" ? "Online" : "Offline"}
          </Text>
        </View>
        <Text style={styles.kelasNama}>{kelas.nama}</Text>
        {nextPertemuan ? (
          <Text style={styles.sessionRowText}>
            Pertemuan berikutnya: {nextPertemuan.tanggal} (ke-
            {nextPertemuan.pertemuanKe})
          </Text>
        ) : (
          <Text style={styles.sessionRowText}>
            Tidak ada pertemuan terjadwal
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SantriTalaqiContent() {
  const router = useRouter();
  const { userData, role } = useAuthContext();
  const [filterType, setFilterType] = useState<string | null>(null);

  const talaqiList = useQuery(
    api.talaqi.getBySantri,
    userData?._id ? { userId: userData._id } : "skip",
  );

  const santriProfile = useQuery(
    api.santri.getByUserId,
    userData?._id ? { userId: userData._id } : "skip",
  );

  const enrollments = useQuery(
    api.kelas.listEnrollmentsBySantri,
    santriProfile?._id ? { santriId: santriProfile._id } : "skip",
  );

  const isLoading =
    talaqiList === undefined ||
    santriProfile === undefined ||
    (!!santriProfile?._id && enrollments === undefined);

  const isUnaffiliated = !santriProfile?.adminPengajianId;

  const filtered = filterType
    ? (talaqiList ?? []).filter((t) => t.type === filterType)
    : (talaqiList ?? []);

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime(),
  );

  // Stats
  const totalSessions = talaqiList?.length ?? 0;
  const hadirCount = (talaqiList ?? []).filter((t) => t.presensi).length;
  const avgNilai =
    (talaqiList ?? []).filter((t) => t.nilai != null).length > 0
      ? (
          (talaqiList ?? [])
            .filter((t) => t.nilai != null)
            .reduce((sum, t) => sum + (t.nilai ?? 0), 0) /
          (talaqiList ?? []).filter((t) => t.nilai != null).length
        ).toFixed(1)
      : "-";

  const currentEnrollments = (enrollments ?? []).filter(
    (e) => e.enrollment.isActive,
  );
  const pastEnrollments = (enrollments ?? []).filter(
    (e) => !e.enrollment.isActive,
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat data talaqi...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Welcome & Section Title ala screenshot */}
      <View style={styles.welcomeSection}>
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.welcomeTitle}>Mari Mengaji!</Text>
          <View style={styles.badgeTop}>
            <Text style={styles.badgeTopText}>Pilih Metode</Text>
          </View>
        </View>
        <Text style={styles.welcomeSubtitle}>
          {isUnaffiliated
            ? "Pilih metode belajar yang paling sesuai untukmu hari ini."
            : "Lanjutkan progres belajarmu hari ini."}
        </Text>
      </View>

      {/* --- SMOOTH CARD: NGAJI AI --- */}
      <TouchableOpacity
        style={styles.smoothMenuCard}
        onPress={() => router.push("/ngaji-ai")}
        activeOpacity={0.7}
      >
        <View style={[styles.cardIconWrap, { backgroundColor: "#E8F5E9" }]}>
          <FontAwesome name="microphone" size={26} color="#2E7D32" />
        </View>
        <View style={styles.cardTextContent}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Ngaji dengan AI</Text>
            <View style={styles.badgeAi}>
              <Text style={styles.badgeAiText}>AI</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle} numberOfLines={2}>
            Latih bacaan mandiri kapan saja dengan koreksi tajwid & makhraj
            otomatis.
          </Text>
        </View>
        <FontAwesome
          name="chevron-right"
          size={14}
          color="#D1D5DB"
          style={styles.cardChevron}
        />
      </TouchableOpacity>

      {/* --- SMOOTH CARD: NGAJI USTADZ (Khusus Belum Terafiliasi) --- */}
      {isUnaffiliated && (
        <TouchableOpacity
          style={styles.smoothMenuCard}
          onPress={() => router.push("/talaqi-lkm")}
          activeOpacity={0.7}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: "#FFF3E0" }]}>
            <FontAwesome name="graduation-cap" size={24} color="#EF6C00" />
          </View>
          <View style={styles.cardTextContent}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Ngaji dengan Ustadz</Text>
              <View style={styles.badgeUstadz}>
                <Text style={styles.badgeUstadzText}>LKM</Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle} numberOfLines={2}>
              Cari Lembaga Kursus Mengaji terdekat.
            </Text>
          </View>
          <FontAwesome
            name="chevron-right"
            size={14}
            color="#D1D5DB"
            style={styles.cardChevron}
          />
        </TouchableOpacity>
      )}

      {/* --- KONTEN TALAQI (Hanya Tampil Jika Sudah Terafiliasi LKM) --- */}
      {!isUnaffiliated && (
        <>
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.headerTitle}>Riwayat Talaqi</Text>
                <Text style={styles.headerSubtitle}>
                  {role === "ustadz"
                    ? "Penilaian santri"
                    : "Progres belajar dengan ustadz"}
                </Text>
              </View>
              <View style={styles.headerIcon}>
                <FontAwesome name="users" size={24} color={Colors.primary} />
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{totalSessions}</Text>
                <Text style={styles.statLabel}>Sesi</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{hadirCount}</Text>
                <Text style={styles.statLabel}>Hadir</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{avgNilai}</Text>
                <Text style={styles.statLabel}>Rata-rata</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Kelas Saya</Text>
          {currentEnrollments.length === 0 ? (
            <Text style={styles.sectionEmpty}>
              Belum ditempatkan di kelas manapun
            </Text>
          ) : (
            currentEnrollments.map(({ enrollment, kelas }) => (
              <EnrollmentCard
                key={enrollment._id}
                kelas={kelas!}
                onPress={() =>
                  router.push({
                    pathname: "/kelas-detail/[kelasId]",
                    params: { kelasId: kelas!._id },
                  })
                }
              />
            ))
          )}

          {pastEnrollments.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Kelas Sebelumnya</Text>
              {pastEnrollments.map(({ enrollment, kelas }) => (
                <EnrollmentCard
                  key={enrollment._id}
                  kelas={kelas!}
                  onPress={() =>
                    router.push({
                      pathname: "/kelas-detail/[kelasId]",
                      params: { kelasId: kelas!._id },
                    })
                  }
                />
              ))}
            </>
          )}

          <View style={styles.sectionHeaderWrapList}>
            <Text style={styles.sectionTitle}>Riwayat Pertemuan</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                !filterType && styles.filterChipActive,
              ]}
              onPress={() => setFilterType(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !filterType && styles.filterChipTextActive,
                ]}
              >
                Semua
              </Text>
            </TouchableOpacity>
            {TALAQI_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.filterChip,
                  filterType === t.value && styles.filterChipActive,
                ]}
                onPress={() =>
                  setFilterType(filterType === t.value ? null : t.value)
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterType === t.value && styles.filterChipTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {sorted.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome
                name="calendar-o"
                size={48}
                color={Colors.textSecondary}
              />
              <Text style={styles.emptyTitle}>Belum Ada Riwayat</Text>
              <Text style={styles.emptySubtitle}>
                {filterType
                  ? "Tidak ada sesi untuk filter ini"
                  : "Riwayat talaqi akan muncul setelah kamu mengikuti sesi bersama ustadz"}
              </Text>
            </View>
          ) : (
            sorted.map((session) => {
              const typeLabel =
                TALAQI_TYPES.find((t) => t.value === session.type)?.label ??
                session.type;
              const typeColor = TYPE_COLORS[session.type] ?? Colors.primary;
              const typeIcon = TYPE_ICONS[session.type] ?? "book";

              return (
                <View key={session._id} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View
                      style={[styles.typeBadge, { backgroundColor: typeColor }]}
                    >
                      <FontAwesome name={typeIcon} size={10} color="#fff" />
                      <Text style={styles.typeBadgeText}>{typeLabel}</Text>
                    </View>
                    <Text style={styles.sessionDate}>
                      {formatDate(session.tanggal)}
                    </Text>
                  </View>

                  <View style={styles.sessionBody}>
                    <View style={styles.sessionRow}>
                      <FontAwesome
                        name={
                          session.presensi ? "check-circle" : "times-circle"
                        }
                        size={16}
                        color={session.presensi ? Colors.success : Colors.error}
                      />
                      <Text style={styles.sessionRowText}>
                        {session.presensi ? "Hadir" : "Tidak Hadir"}
                      </Text>
                    </View>

                    {session.suratName && (
                      <View style={styles.sessionRow}>
                        <FontAwesome
                          name="file-text-o"
                          size={14}
                          color={Colors.textSecondary}
                        />
                        <Text style={styles.sessionRowText}>
                          {session.suratName}
                          {session.juz ? ` • Juz ${session.juz}` : ""}
                        </Text>
                      </View>
                    )}

                    {session.nilai != null && (
                      <View style={styles.sessionRow}>
                        <FontAwesome
                          name="star"
                          size={14}
                          color={Colors.secondary}
                        />
                        <Text style={styles.sessionRowText}>
                          Nilai: {session.nilai}
                        </Text>
                        <View
                          style={[
                            styles.nilaiBadge,
                            {
                              backgroundColor:
                                session.nilai >= 8
                                  ? Colors.success
                                  : session.nilai >= 7
                                    ? Colors.secondary
                                    : Colors.error,
                            },
                          ]}
                        >
                          <Text style={styles.nilaiBadgeText}>
                            {session.nilai >= 8
                              ? "Baik"
                              : session.nilai >= 7
                                ? "Cukup"
                                : "Perlu Latihan"}
                          </Text>
                        </View>
                      </View>
                    )}

                    {session.catatan && (
                      <View style={styles.catatanBox}>
                        <FontAwesome
                          name="pencil"
                          size={12}
                          color={Colors.textSecondary}
                        />
                        <Text style={styles.catatanText}>
                          {session.catatan}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

function EnrollmentCard({
  kelas,
  onPress,
}: {
  kelas: Doc<"kelas">;
  onPress: () => void;
}) {
  const typeLabel =
    TALAQI_TYPES.find((t) => t.value === kelas.type)?.label ?? kelas.type;
  return (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.sessionBody}>
        <View style={styles.sessionRow}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: TYPE_COLORS[kelas.type] ?? Colors.primary },
            ]}
          >
            <FontAwesome
              name={TYPE_ICONS[kelas.type] ?? "book"}
              size={10}
              color="#fff"
            />
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
          <Text style={styles.sessionDate}>
            {kelas.modeDefault === "online" ? "Online" : "Offline"}
          </Text>
        </View>
        <Text style={styles.kelasNama}>{kelas.nama}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background, // Idealnya light / white tone
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
  },

  // Welcome Section
  welcomeSection: {
    marginBottom: 20,
    marginTop: 4,
  },
  sectionHeaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1F2937", // Dark elegant text
  },
  badgeTop: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTopText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#4B5563",
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#6B7280", // Softer text
    marginTop: 4,
    lineHeight: 20,
  },

  // SMOOTH MENU CARDS
  smoothMenuCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6", // Thin subtle border
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16, // Squircle shape
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardTextContent: {
    flex: 1,
    justifyContent: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#111827",
  },
  badgeAi: {
    backgroundColor: "#66C1B6", // Turquoise green from screenshot
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeAiText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
  },
  badgeUstadz: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeUstadzText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    paddingRight: 4,
  },
  cardChevron: {
    marginLeft: 6,
  },

  // Header Stats
  headerCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    marginTop: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.textLight,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textLight,
    opacity: 0.8,
    marginTop: 2,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.textLight,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textLight,
    opacity: 0.8,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  sectionHeaderWrapList: {
    marginTop: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 10,
    marginTop: 8,
  },
  sectionEmpty: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  kelasNama: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 6,
  },

  // Filter
  filterScroll: {
    marginBottom: 16,
  },
  filterContent: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: "#66C1B6",
    borderColor: "#66C1B6",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterChipTextActive: {
    color: "#fff",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 32,
    lineHeight: 22,
  },

  // Session card
  sessionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
  },
  sessionDate: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  sessionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sessionRowText: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  nilaiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nilaiBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  catatanBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
  catatanText: {
    fontSize: 13,
    color: "#4B5563",
    flex: 1,
    lineHeight: 20,
  },
});
