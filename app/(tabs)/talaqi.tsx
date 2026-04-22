import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors, TALAQI_TYPES } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

const TYPE_COLORS: Record<string, string> = {
  tahsin: Colors.primary,
  murojaah: Colors.secondary,
  tahfidz: "#7B1FA2",
};

const TYPE_ICONS: Record<string, React.ComponentProps<typeof FontAwesome>["name"]> = {
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
  const router = useRouter();
  const { userData, role } = useAuthContext();
  const [filterType, setFilterType] = useState<string | null>(null);

  const talaqiList = useQuery(
    api.talaqi.getBySantri,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const isLoading = talaqiList === undefined;

  const filtered = filterType
    ? (talaqiList ?? []).filter((t) => t.type === filterType)
    : (talaqiList ?? []);

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
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

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat riwayat talaqi...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.aiCard}
        onPress={() => router.push("/ngaji-ai")}
        activeOpacity={0.85}
      >
        <View style={styles.aiLeft}>
          <View style={styles.aiIconWrap}>
            <FontAwesome name="microphone" size={18} color={Colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>Ngaji AI</Text>
            <Text style={styles.aiSubtitle}>Pilih surah, rekam suara, dan dapatkan koreksi bacaan otomatis</Text>
          </View>
        </View>
        <FontAwesome name="chevron-right" size={14} color={Colors.primary} />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Talaqi</Text>
            <Text style={styles.headerSubtitle}>
              {role === "ustadz"
                ? "Penilaian santri"
                : "Riwayat belajar dengan ustadz"}
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <FontAwesome name="users" size={24} color={Colors.primary} />
          </View>
        </View>

        {/* Stats row */}
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

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, !filterType && styles.filterChipActive]}
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

      {/* Session list */}
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
              : role === "ustadz"
                ? "Mulai beri penilaian pada santri Anda"
                : "Riwayat talaqi akan muncul setelah sesi bersama ustadz"}
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
                {/* Presensi */}
                <View style={styles.sessionRow}>
                  <FontAwesome
                    name={session.presensi ? "check-circle" : "times-circle"}
                    size={16}
                    color={session.presensi ? Colors.success : Colors.error}
                  />
                  <Text style={styles.sessionRowText}>
                    {session.presensi ? "Hadir" : "Tidak Hadir"}
                  </Text>
                </View>

                {/* Surat */}
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

                {/* Nilai */}
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

                {/* Catatan */}
                {session.catatan && (
                  <View style={styles.catatanBox}>
                    <FontAwesome
                      name="pencil"
                      size={12}
                      color={Colors.textSecondary}
                    />
                    <Text style={styles.catatanText}>{session.catatan}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  aiCard: {
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  aiLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  aiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#C8E6C9",
    justifyContent: "center",
    alignItems: "center",
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  aiSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
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

  // Header
  headerCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.textLight,
  },
  headerSubtitle: {
    fontSize: 14,
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

  // Filter
  filterScroll: {
    marginBottom: 12,
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: "#fff",
  },

  // Empty
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
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
  },
  sessionDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sessionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sessionRowText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  nilaiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
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
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  catatanText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});
