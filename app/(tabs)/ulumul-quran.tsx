import React from "react";
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
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

const BAB_ICONS: Record<number, React.ComponentProps<typeof FontAwesome>["name"]> = {
  0: "lightbulb-o",
  1: "history",
  2: "pencil",
  3: "bookmark",
  4: "globe",
  5: "puzzle-piece",
  6: "graduation-cap",
  7: "star",
  8: "diamond",
  9: "trophy",
};

export default function UlumulQuranScreen() {
  const router = useRouter();
  const { userData } = useAuthContext();

  const materiList = useQuery(api.materi.list, { type: "ulumul_quran" });
  const userProgress = useQuery(
    api.quiz.getUserProgress,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const isLoading = materiList === undefined;

  const completedIds = new Set(
    (userProgress ?? [])
      .filter((p) => p.completedAt)
      .map((p) => p.materiId)
  );

  const completedCount = materiList
    ? materiList.filter((m) => completedIds.has(m._id)).length
    : 0;
  const totalCount = materiList?.length ?? 0;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat materi ulumul qur'an...</Text>
      </View>
    );
  }

  const sorted = [...(materiList ?? [])].sort((a, b) => a.seq - b.seq);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <View style={styles.progressTop}>
          <View>
            <Text style={styles.progressTitle}>Ulumul Qur'an</Text>
            <Text style={styles.progressSubtitle}>
              Ilmu-ilmu tentang Al-Qur'an
            </Text>
          </View>
          <View style={styles.progressCircle}>
            <Text style={styles.progressCircleText}>{progressPercent}%</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          {completedCount} dari {totalCount} BAB selesai
        </Text>
      </View>

      {/* Materi List */}
      {sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="inbox" size={40} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Belum ada materi</Text>
          <Text style={styles.emptyDesc}>
            Materi Ulumul Qur'an akan ditambahkan oleh admin
          </Text>
        </View>
      ) : (
        sorted.map((materi, index) => {
          const isCompleted = completedIds.has(materi._id);
          const icon = BAB_ICONS[index] ?? "file-text";

          return (
            <TouchableOpacity
              key={materi._id}
              style={styles.babCard}
              onPress={() =>
                router.push({
                  pathname: "/materi/[materiId]",
                  params: { materiId: materi._id, materiTitle: materi.judul },
                })
              }
            >
              <View
                style={[
                  styles.babIconContainer,
                  isCompleted && styles.babIconCompleted,
                ]}
              >
                {isCompleted ? (
                  <FontAwesome name="check" size={20} color="#fff" />
                ) : (
                  <FontAwesome name={icon} size={20} color={Colors.primary} />
                )}
              </View>
              <View style={styles.babInfo}>
                <Text style={styles.babNumber}>BAB {index + 1}</Text>
                <Text style={styles.babTitle} numberOfLines={2}>
                  {materi.judul}
                </Text>
                {materi.deskripsi && (
                  <Text style={styles.babDesc} numberOfLines={1}>
                    {materi.deskripsi}
                  </Text>
                )}
              </View>
              {isCompleted ? (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>Selesai</Text>
                </View>
              ) : (
                <FontAwesome
                  name="chevron-right"
                  size={14}
                  color={Colors.textSecondary}
                />
              )}
            </TouchableOpacity>
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

  // Progress
  progressHeader: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.textLight,
  },
  progressSubtitle: {
    fontSize: 14,
    color: Colors.textLight,
    opacity: 0.8,
    marginTop: 2,
  },
  progressCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressCircleText: {
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.textLight,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    marginTop: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.textLight,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textLight,
    opacity: 0.8,
    marginTop: 8,
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.text,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 32,
  },

  // BAB card
  babCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  babIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  babIconCompleted: {
    backgroundColor: Colors.success,
  },
  babInfo: {
    flex: 1,
  },
  babNumber: {
    fontSize: 11,
    fontWeight: "bold",
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  babTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    marginTop: 2,
  },
  babDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  completedBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: Colors.success,
  },
});
