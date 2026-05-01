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
import { Id } from "@/convex/_generated/dataModel";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

const TAP_SOUND_URL = "https://actions.google.com/sounds/v1/cartoon/pop.ogg";

type StageKind = "materi" | "quiz-sub" | "quiz-final";

type Stage = {
  key: string;
  kind: StageKind;
  id: Id<"materi">;
  title: string;
  subtitle: string;
  unlocked: boolean;
  completed: boolean;
  onPress: () => void;
};

type BabSection = {
  babId: Id<"materi">;
  babTitle: string;
  babIndex: number;
  stages: Stage[];
};

export default function TahsinScreen() {
  const router = useRouter();
  const { userData } = useAuthContext();
  const soundRef = useRef<Audio.Sound | null>(null);

  const materiAll = useQuery(api.materi.listAllByType, { type: "tahsin" });
  const userProgress = useQuery(
    api.quiz.getUserProgress,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const allMateriIds = useMemo(() => (materiAll ?? []).map((m) => m._id), [materiAll]);

  const quizCounts = useQuery(
    api.quiz.getQuizCountsByMateriIds,
    allMateriIds.length > 0 ? { materiIds: allMateriIds } : "skip"
  );

  const isLoading =
    materiAll === undefined ||
    (allMateriIds.length > 0 && quizCounts === undefined);

  const completedIds = useMemo(
    () =>
      new Set(
        (userProgress ?? [])
          .filter((p) => p.completedAt)
          .map((p) => p.materiId)
      ),
    [userProgress]
  );

  const quizCountMap = useMemo(
    () => new Map((quizCounts ?? []).map((item) => [item.materiId, item.count])),
    [quizCounts]
  );

  const childrenMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof materiAll>>();
    if (!materiAll) return map;
    for (const item of materiAll) {
      if (!item.parentId) continue;
      const list = map.get(item.parentId) ?? [];
      list.push(item);
      map.set(item.parentId, list);
    }
    for (const [key, list] of map.entries()) {
      map.set(key, [...list].sort((a, b) => a.seq - b.seq));
    }
    return map;
  }, [materiAll]);

  const topBab = useMemo(
    () =>
      [...(materiAll ?? [])]
        .filter((m) => !m.parentId)
        .sort((a, b) => a.seq - b.seq),
    [materiAll]
  );

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

  const sections = useMemo<BabSection[]>(() => {
    if (!materiAll || quizCounts === undefined) return [];

    let prevStageDone = true;
    const result: BabSection[] = [];

    topBab.forEach((bab, babIndex) => {
      const children = childrenMap.get(bab._id) ?? [];
      const stages: Stage[] = [];

      if (children.length === 0) {
        // Leaf BAB — materi node + optional quiz
        const done = completedIds.has(bab._id);
        const unlocked = prevStageDone;

        stages.push({
          key: `materi-${bab._id}`,
          kind: "materi",
          id: bab._id,
          title: bab.judul,
          subtitle: "Materi utama",
          unlocked,
          completed: done,
          onPress: () =>
            router.push({
              pathname: "/materi-reader/[materiId]",
              params: { materiId: bab._id },
            }),
        });
        prevStageDone = unlocked && done;

        const qCount = quizCountMap.get(bab._id) ?? 0;
        if (qCount > 0) {
          const qUnlocked = prevStageDone;
          stages.push({
            key: `quiz-${bab._id}`,
            kind: "quiz-sub",
            id: bab._id,
            title: `Quiz ${bab.judul}`,
            subtitle: `${qCount} pertanyaan`,
            unlocked: qUnlocked,
            completed: done,
            onPress: () =>
              router.push({
                pathname: "/quiz/[materiId]",
                params: { materiId: bab._id, materiTitle: bab.judul },
              }),
          });
          prevStageDone = qUnlocked && done;
        }
      } else {
        // BAB with sub-babs
        children.forEach((sub) => {
          const subDone = completedIds.has(sub._id);
          const subUnlocked = prevStageDone;
          const hasGrandChildren = (childrenMap.get(sub._id) ?? []).length > 0;

          stages.push({
            key: `materi-${sub._id}`,
            kind: "materi",
            id: sub._id,
            title: sub.judul,
            subtitle: hasGrandChildren ? "Berisi sub-unit" : "Sub-bab",
            unlocked: subUnlocked,
            completed: subDone,
            onPress: () => {
              if (hasGrandChildren) {
                router.push({
                  pathname: "/materi/[materiId]",
                  params: { materiId: sub._id, materiTitle: sub.judul },
                });
              } else {
                router.push({
                  pathname: "/materi-reader/[materiId]",
                  params: { materiId: sub._id },
                });
              }
            },
          });
          prevStageDone = subUnlocked && subDone;

          const subQCount = quizCountMap.get(sub._id) ?? 0;
          if (subQCount > 0) {
            const qUnlocked = prevStageDone;
            stages.push({
              key: `quiz-sub-${sub._id}`,
              kind: "quiz-sub",
              id: sub._id,
              title: `Quiz ${sub.judul}`,
              subtitle: `${subQCount} pertanyaan`,
              unlocked: qUnlocked,
              completed: subDone,
              onPress: () =>
                router.push({
                  pathname: "/quiz/[materiId]",
                  params: { materiId: sub._id, materiTitle: sub.judul },
                }),
            });
            prevStageDone = qUnlocked && subDone;
          }
        });

        // Final BAB quiz (random from all completed sub-babs)
        const babFinalDone = completedIds.has(bab._id);
        const finalUnlocked = prevStageDone;
        stages.push({
          key: `quiz-final-${bab._id}`,
          kind: "quiz-final",
          id: bab._id,
          title: `Quiz Akhir ${bab.judul}`,
          subtitle: "Quiz penutup dari seluruh sub-bab",
          unlocked: finalUnlocked,
          completed: babFinalDone,
          onPress: () =>
            router.push({
              pathname: "/quiz/[materiId]",
              params: {
                materiId: bab._id,
                materiTitle: `Quiz Akhir ${bab.judul}`,
                finalMode: "1",
                babMateriId: bab._id,
              },
            }),
        });
        prevStageDone = finalUnlocked && babFinalDone;
      }

      result.push({ babId: bab._id, babTitle: bab.judul, babIndex, stages });
    });

    return result;
  }, [materiAll, quizCounts, topBab, childrenMap, completedIds, quizCountMap, router]);

  const completedBabCount = topBab.filter((bab) => completedIds.has(bab._id)).length;
  const progressPercent =
    topBab.length > 0 ? Math.round((completedBabCount / topBab.length) * 100) : 0;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat materi tahsin...</Text>
      </View>
    );
  }

  // Running global stage index for zigzag alignment across all sections
  let globalStageIdx = 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <View style={styles.progressTop}>
          <View>
            <Text style={styles.progressTitle}>Belajar Tahsin</Text>
            <Text style={styles.progressSubtitle}>Pedoman Dauroh Al-Qur'an</Text>
          </View>
          <View style={styles.progressCircle}>
            <Text style={styles.progressCircleText}>{progressPercent}%</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {completedBabCount} dari {topBab.length} BAB selesai
        </Text>
      </View>

      {sections.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="inbox" size={40} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Belum ada materi</Text>
          <Text style={styles.emptyDesc}>
            Materi tahsin akan ditambahkan oleh admin
          </Text>
        </View>
      ) : (
        <View style={styles.pathWrap}>
          {sections.map((section) => {
            const babDone = completedIds.has(section.babId);
            const firstStageUnlocked = section.stages[0]?.unlocked ?? false;

            return (
              <View key={`sec-${section.babId}`}>
                {/* BAB Section Header */}
                <View
                  style={[
                    styles.babHeader,
                    babDone && styles.babHeaderDone,
                    !firstStageUnlocked && styles.babHeaderLocked,
                  ]}
                >
                  <View
                    style={[
                      styles.babBadge,
                      babDone && styles.babBadgeDone,
                      !firstStageUnlocked && styles.babBadgeLocked,
                    ]}
                  >
                    <Text style={styles.babBadgeText}>
                      BAB {section.babIndex + 1}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.babHeaderTitle,
                      babDone && styles.babHeaderTitleDone,
                      !firstStageUnlocked && styles.babHeaderTitleLocked,
                    ]}
                    numberOfLines={2}
                  >
                    {section.babTitle}
                  </Text>
                  {babDone && (
                    <FontAwesome
                      name="check-circle"
                      size={18}
                      color={Colors.success}
                      style={styles.babCheckIcon}
                    />
                  )}
                  {!firstStageUnlocked && !babDone && (
                    <FontAwesome
                      name="lock"
                      size={14}
                      color={Colors.textSecondary}
                      style={styles.babCheckIcon}
                    />
                  )}
                </View>

                {/* Stage nodes within this BAB */}
                <View style={styles.sectionStages}>
                  {section.stages.map((stage, stageIdx) => {
                    const alignLeft = globalStageIdx % 2 === 0;
                    globalStageIdx += 1;
                    const isQuiz = stage.kind !== "materi";
                    const isFinal = stage.kind === "quiz-final";

                    return (
                      <View key={stage.key} style={styles.pathNodeWrap}>
                        {stageIdx > 0 && <View style={styles.pathConnector} />}
                        <Pressable
                          style={({ pressed }) => [
                            styles.pathNode,
                            alignLeft ? styles.pathNodeLeft : styles.pathNodeRight,
                            isQuiz && styles.pathNodeQuiz,
                            isFinal && styles.pathNodeFinal,
                            !stage.unlocked && styles.pathNodeLocked,
                            stage.completed && styles.pathNodeDone,
                            pressed && stage.unlocked && { opacity: 0.85 },
                          ]}
                          disabled={!stage.unlocked}
                          onPress={async () => {
                            if (!stage.unlocked) return;
                            await playTapSound();
                            stage.onPress();
                          }}
                        >
                          <View
                            style={[
                              styles.pathIcon,
                              isQuiz && styles.pathIconQuiz,
                              isFinal && styles.pathIconFinal,
                              stage.completed && styles.pathIconDone,
                              !stage.unlocked && styles.pathIconLocked,
                            ]}
                          >
                            {stage.completed ? (
                              <FontAwesome name="check" size={18} color="#fff" />
                            ) : !stage.unlocked ? (
                              <FontAwesome
                                name="lock"
                                size={16}
                                color={Colors.textSecondary}
                              />
                            ) : isFinal ? (
                              <FontAwesome name="trophy" size={18} color="#fff" />
                            ) : isQuiz ? (
                              <FontAwesome
                                name="pencil-square-o"
                                size={18}
                                color="#fff"
                              />
                            ) : (
                              <FontAwesome
                                name="book"
                                size={18}
                                color={Colors.primary}
                              />
                            )}
                          </View>

                          <View style={styles.pathTextWrap}>
                            <Text style={styles.pathTitle} numberOfLines={2}>
                              {stage.title}
                            </Text>
                            <Text style={styles.pathSubtitle} numberOfLines={1}>
                              {stage.subtitle}
                            </Text>
                            {stage.completed && (
                              <Text style={styles.statusDone}>Selesai</Text>
                            )}
                            {!stage.completed && !stage.unlocked && (
                              <Text style={styles.statusLocked}>
                                Selesaikan tahap sebelumnya
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
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

  // Progress header
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

  // Empty state
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

  // Full path container
  pathWrap: {
    gap: 4,
  },

  // BAB section header
  babHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  babHeaderDone: {
    backgroundColor: "#C8E6C9",
  },
  babHeaderLocked: {
    backgroundColor: "#EEEEEE",
  },
  babBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  babBadgeDone: {
    backgroundColor: Colors.success,
  },
  babBadgeLocked: {
    backgroundColor: Colors.textSecondary,
  },
  babBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  babHeaderTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  babHeaderTitleDone: {
    color: Colors.primaryDark,
  },
  babHeaderTitleLocked: {
    color: Colors.textSecondary,
  },
  babCheckIcon: {
    marginLeft: 4,
  },

  // Stages within a BAB section
  sectionStages: {
    gap: 8,
    paddingBottom: 4,
  },

  // Stage path nodes
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
    padding: 14,
    width: "86%",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  pathNodeLeft: {
    alignSelf: "flex-start",
  },
  pathNodeRight: {
    alignSelf: "flex-end",
  },
  pathNodeQuiz: {
    backgroundColor: "#FFF8E1",
  },
  pathNodeFinal: {
    backgroundColor: "#FFF3E0",
    borderWidth: 1.5,
    borderColor: Colors.secondary,
  },
  pathNodeLocked: {
    backgroundColor: "#F3F3F3",
  },
  pathNodeDone: {
    borderWidth: 1,
    borderColor: Colors.success,
  },
  pathIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  pathIconQuiz: {
    backgroundColor: Colors.secondary,
  },
  pathIconFinal: {
    backgroundColor: "#FF6F00",
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
  pathTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  pathSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusDone: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "700",
    color: Colors.success,
  },
  statusLocked: {
    marginTop: 5,
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
