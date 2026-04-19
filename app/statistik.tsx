import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

export default function StatistikScreen() {
  const { userData } = useAuthContext();

  const tilawahData = useQuery(
    api.tilawah.getByUser,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const talaqiData = useQuery(
    api.talaqi.getBySantri,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const progressData = useQuery(
    api.quiz.getUserProgress,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const isLoading =
    tilawahData === undefined ||
    talaqiData === undefined ||
    progressData === undefined;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat statistik...</Text>
      </View>
    );
  }

  const totalTilawah = tilawahData?.length ?? 0;
  const totalPages = tilawahData?.reduce(
    (sum, t) => sum + (t.jumlahHalaman || 0),
    0
  ) ?? 0;

  const totalTalaqi = talaqiData?.length ?? 0;
  const attendedTalaqi = talaqiData?.filter((t) => t.presensi).length ?? 0;
  const avgNilai =
    talaqiData && talaqiData.length > 0
      ? talaqiData
          .filter((t) => t.nilai != null)
          .reduce((sum, t) => sum + (t.nilai || 0), 0) /
        (talaqiData.filter((t) => t.nilai != null).length || 1)
      : 0;

  const completedMateri = progressData?.filter((p) => p.completedAt).length ?? 0;
  const totalMateri = progressData?.length ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: "#E8F5E9" }]}>
          <FontAwesome name="book" size={24} color={Colors.primary} />
          <Text style={styles.summaryNumber}>{totalTilawah}</Text>
          <Text style={styles.summaryLabel}>Hari Tilawah</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#E3F2FD" }]}>
          <FontAwesome name="file-text" size={24} color="#1565C0" />
          <Text style={[styles.summaryNumber, { color: "#1565C0" }]}>
            {totalPages}
          </Text>
          <Text style={styles.summaryLabel}>Halaman</Text>
        </View>
      </View>

      {/* Tilawah Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="book" size={18} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Tilawah Harian</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total hari membaca</Text>
          <Text style={styles.statValue}>{totalTilawah} hari</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total halaman</Text>
          <Text style={styles.statValue}>{totalPages} halaman</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Rata-rata harian</Text>
          <Text style={styles.statValue}>
            {totalTilawah > 0
              ? (totalPages / totalTilawah).toFixed(1)
              : "0"}{" "}
            halaman
          </Text>
        </View>
      </View>

      {/* Talaqi Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="users" size={18} color="#C62828" />
          <Text style={styles.sectionTitle}>Talaqi</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total sesi</Text>
          <Text style={styles.statValue}>{totalTalaqi} sesi</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Kehadiran</Text>
          <Text style={styles.statValue}>
            {attendedTalaqi}/{totalTalaqi}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Rata-rata nilai</Text>
          <Text style={styles.statValue}>
            {avgNilai > 0 ? avgNilai.toFixed(1) : "-"}
          </Text>
        </View>
      </View>

      {/* Progress Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="graduation-cap" size={18} color="#E65100" />
          <Text style={styles.sectionTitle}>Tahsin & Materi</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Materi dipelajari</Text>
          <Text style={styles.statValue}>{totalMateri}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Materi selesai</Text>
          <Text style={styles.statValue}>{completedMateri}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Progres</Text>
          <Text style={styles.statValue}>
            {totalMateri > 0
              ? Math.round((completedMateri / totalMateri) * 100)
              : 0}
            %
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  totalMateri > 0
                    ? Math.round((completedMateri / totalMateri) * 100)
                    : 0
                }%`,
              },
            ]}
          />
        </View>
      </View>
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
    paddingBottom: 40,
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
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.primary,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.text,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
});
