import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

const BAB_ICONS: Record<number, React.ComponentProps<typeof FontAwesome>["name"]> = {
  0: "book",
  1: "info-circle",
  2: "comment",
  3: "list",
  4: "file-text",
  5: "file-text",
  6: "file-text",
  7: "file-text",
  8: "file-text",
  9: "file-text",
  10: "file-text",
  11: "file-text",
  12: "file-text",
  13: "file-text",
};

export default function TahsinScreen() {
  const router = useRouter();
  const { userData } = useAuthContext();

  const materiList = useQuery(api.materi.list, { type: "tahsin" });
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
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat materi tahsin...</Text>
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
            <Text style={styles.progressTitle}>Belajar Tahsin</Text>
            <Text style={styles.progressSubtitle}>
              Pedoman Dauroh Al-Qur'an
            </Text>
          </View>
          <View style={styles.progressCircle}>
            <Text style={styles.progressCircleText}>{progressPercent}%</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
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
            Materi tahsin akan ditambahkan oleh admin
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
    marginTop: 4,
  },
  progressCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  progressCircleText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 4,
    marginTop: 16,
  },
  progressFill: {
    height: 8,
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  progressText: {
    color: Colors.textLight,
    fontSize: 12,
    marginTop: 8,
    opacity: 0.8,
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // BAB cards
  babCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  babIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
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
    textTransform: "uppercase",
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
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: Colors.success,
  },
});
