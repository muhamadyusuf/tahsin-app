import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Audio } from "expo-av";
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

const TAP_SOUND_URL = "https://actions.google.com/sounds/v1/cartoon/pop.ogg";

export default function TahsinScreen() {
  const router = useRouter();
  const { userData } = useAuthContext();
  const soundRef = useRef<Audio.Sound | null>(null);

  const materiAll = useQuery(api.materi.listAllByType, { type: "tahsin" });
  const userProgress = useQuery(
    api.quiz.getUserProgress,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const isLoading = materiAll === undefined;

  const topBab = useMemo(
    () => [...(materiAll ?? [])].filter((m) => !m.parentId).sort((a, b) => a.seq - b.seq),
    [materiAll]
  );

  const childCountMap = useMemo(() => {
    const map = new Map<string, number>();
    const all = materiAll ?? [];
    for (const item of all) {
      if (!item.parentId) {
        continue;
      }
      map.set(item.parentId, (map.get(item.parentId) ?? 0) + 1);
    }
    return map;
  }, [materiAll]);

  const playTapSound = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.replayAsync();
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: TAP_SOUND_URL },
        { shouldPlay: true, volume: 0.6 }
      );
      soundRef.current = sound;
    } catch {
      // ignore sound failures
    }
  }, []);

  const completedIds = new Set(
    (userProgress ?? [])
      .filter((p) => p.completedAt)
      .map((p) => p.materiId)
  );

  const completedCount = topBab.filter((m) => completedIds.has(m._id)).length;
  const totalCount = topBab.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat materi tahsin...</Text>
      </View>
    );
  }

  const sorted = topBab;

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
        <View style={styles.pathWrap}>
          {sorted.map((materi, index) => {
            const isCompleted = completedIds.has(materi._id);
            const isUnlocked = index === 0 || completedIds.has(sorted[index - 1]._id);
            const icon = BAB_ICONS[index] ?? "file-text";
            const alignLeft = index % 2 === 0;

            return (
              <View key={materi._id} style={styles.pathNodeWrap}>
                {index > 0 && <View style={styles.pathConnector} />}
                <Pressable
                  style={({ pressed }) => [
                    styles.pathNode,
                    alignLeft ? styles.pathNodeLeft : styles.pathNodeRight,
                    !isUnlocked && styles.pathNodeLocked,
                    isCompleted && styles.pathNodeDone,
                    pressed && isUnlocked && { opacity: 0.85 },
                  ]}
                  disabled={!isUnlocked}
                  onPress={async () => {
                    if (!isUnlocked) {
                      return;
                    }
                    await playTapSound();
                    router.push({
                      pathname: "/materi/[materiId]",
                      params: { materiId: materi._id, materiTitle: materi.judul },
                    });
                  }}
                >
                  <View
                    style={[
                      styles.pathIcon,
                      isCompleted && styles.pathIconDone,
                      !isUnlocked && styles.pathIconLocked,
                    ]}
                  >
                    {isCompleted ? (
                      <FontAwesome name="check" size={18} color="#fff" />
                    ) : !isUnlocked ? (
                      <FontAwesome name="lock" size={16} color={Colors.textSecondary} />
                    ) : (
                      <FontAwesome name={icon} size={18} color={Colors.primary} />
                    )}
                  </View>

                  <View style={styles.pathTextWrap}>
                    <Text style={styles.pathBab}>BAB {index + 1}</Text>
                    <Text style={styles.pathTitle} numberOfLines={2}>
                      {materi.judul}
                    </Text>
                    <Text style={styles.pathHint} numberOfLines={2}>
                      {childCountMap.get(materi._id) ?? 0} sub-bab di dalam BAB ini
                    </Text>
                    {isCompleted && <Text style={styles.pathStatusDone}>Selesai</Text>}
                    {!isCompleted && !isUnlocked && (
                      <Text style={styles.pathStatusLocked}>Selesaikan BAB sebelumnya</Text>
                    )}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
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

  pathWrap: {
    gap: 8,
  },
  pathNodeWrap: {
    position: "relative",
  },
  pathConnector: {
    position: "absolute",
    left: "50%",
    top: -8,
    width: 2,
    height: 16,
    marginLeft: -1,
    backgroundColor: Colors.border,
  },
  pathNode: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "88%",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pathNodeLeft: {
    alignSelf: "flex-start",
  },
  pathNodeRight: {
    alignSelf: "flex-end",
  },
  pathNodeLocked: {
    backgroundColor: "#F3F3F3",
  },
  pathNodeDone: {
    borderWidth: 1,
    borderColor: Colors.success,
  },
  pathIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  pathIconDone: {
    backgroundColor: Colors.success,
  },
  pathIconLocked: {
    backgroundColor: "#E6E6E6",
  },
  pathTextWrap: {
    flex: 1,
  },
  pathBab: {
    fontSize: 11,
    fontWeight: "bold",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pathTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    marginTop: 2,
  },
  pathHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  pathStatusDone: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: Colors.success,
  },
  pathStatusLocked: {
    marginTop: 6,
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
