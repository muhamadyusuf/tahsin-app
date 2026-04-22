import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

type StageItem = {
  key: string;
  title: string;
  subtitle: string;
  kind: "materi" | "quiz-sub" | "quiz-final";
  unlocked: boolean;
  completed: boolean;
  onPress: () => void;
};

const TAP_SOUND_URL = "https://actions.google.com/sounds/v1/cartoon/pop.ogg";

export default function MateriDetailScreen() {
  const { materiId } = useLocalSearchParams<{ materiId: string }>();
  const router = useRouter();
  const { userData } = useAuthContext();
  const soundRef = useRef<Audio.Sound | null>(null);

  const materi = useQuery(
    api.materi.getById,
    materiId ? { id: materiId as Id<"materi"> } : "skip"
  );

  const allMateri = useQuery(
    api.materi.listAllByType,
    materi?.type ? { type: materi.type } : "skip"
  );

  const userProgress = useQuery(
    api.quiz.getUserProgress,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const descendants = useMemo(() => {
    if (!materi || !allMateri) {
      return [] as { id: Id<"materi">; title: string; depth: number; hasChildren: boolean }[];
    }

    const childrenMap = new Map<string, typeof allMateri>();
    allMateri.forEach((item) => {
      if (!item.parentId) {
        return;
      }
      const list = childrenMap.get(item.parentId) ?? [];
      list.push(item);
      childrenMap.set(item.parentId, list);
    });

    for (const [key, value] of childrenMap.entries()) {
      childrenMap.set(
        key,
        [...value].sort((a, b) => a.seq - b.seq)
      );
    }

    const result: { id: Id<"materi">; title: string; depth: number; hasChildren: boolean }[] = [];

    const walk = (parentId: Id<"materi">, depth: number) => {
      const children = childrenMap.get(parentId) ?? [];
      for (const child of children) {
        const grandChildren = childrenMap.get(child._id) ?? [];
        result.push({
          id: child._id,
          title: child.judul,
          depth,
          hasChildren: grandChildren.length > 0,
        });
        walk(child._id, depth + 1);
      }
    };

    walk(materi._id, 1);
    return result;
  }, [materi, allMateri]);

  const descendantIds = descendants.map((d) => d.id);

  const subQuizCounts = useQuery(
    api.quiz.getQuizCountsByMateriIds,
    descendantIds.length > 0 ? { materiIds: descendantIds } : "skip"
  );

  const finalQuizSet = useQuery(
    api.quiz.getRandomFinalQuizForBab,
    userData?._id && materiId
      ? {
          babMateriId: materiId as Id<"materi">,
          userId: userData._id,
          limit: 20,
        }
      : "skip"
  );

  const completedIds = new Set(
    (userProgress ?? [])
      .filter((p) => p.completedAt)
      .map((p) => p.materiId)
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
      // ignore sound failures; navigation should continue
    }
  }, []);

  const quizCountMap = new Map((subQuizCounts ?? []).map((item) => [item.materiId, item.count]));

  const stageItems = useMemo(() => {
    if (!materi) {
      return [] as StageItem[];
    }

    const stages: StageItem[] = [];
    let prevStageDone = true;

    descendants.forEach((entry) => {
      const materiDone = completedIds.has(entry.id);
      const materiUnlocked = prevStageDone;

      stages.push({
        key: `materi-${entry.id}`,
        title: entry.title,
        subtitle:
          entry.depth > 1
            ? `Sub-bab level ${entry.depth}${entry.hasChildren ? " • berisi sub-bab" : " • mode baca buku"}`
            : "Sub-bab utama",
        kind: "materi",
        unlocked: materiUnlocked,
        completed: materiDone,
        onPress: () => {
          if (entry.hasChildren) {
            router.push({
              pathname: "/materi/[materiId]",
              params: { materiId: entry.id, materiTitle: entry.title },
            });
            return;
          }
          router.push({
            pathname: "/materi-reader/[materiId]",
            params: { materiId: entry.id },
          });
        },
      });

      prevStageDone = materiUnlocked && materiDone;

      const quizCount = quizCountMap.get(entry.id) ?? 0;
      if (quizCount > 0) {
        const quizUnlocked = prevStageDone;
        const quizDone = materiDone;

        stages.push({
          key: `quiz-sub-${entry.id}`,
          title: `Quiz ${entry.title}`,
          subtitle: `${quizCount} pertanyaan`,
          kind: "quiz-sub",
          unlocked: quizUnlocked,
          completed: quizDone,
          onPress: () =>
            router.push({
              pathname: "/quiz/[materiId]",
              params: { materiId: entry.id, materiTitle: entry.title },
            }),
        });

        prevStageDone = quizUnlocked && quizDone;
      }
    });

    if (descendants.length > 0) {
      const finalCount = Math.min(20, finalQuizSet?.length ?? 0);
      stages.push({
        key: `quiz-final-${materi._id}`,
        title: `Quiz Akhir ${materi.judul}`,
        subtitle:
          finalCount > 0
            ? `${finalCount} pertanyaan acak dari sub-bab yang sudah dilewati`
            : "Butuh sub-bab selesai + bank soal",
        kind: "quiz-final",
        unlocked: prevStageDone,
        completed: completedIds.has(materi._id),
        onPress: () =>
          router.push({
            pathname: "/quiz/[materiId]",
            params: {
              materiId: materi._id,
              materiTitle: `Quiz Akhir ${materi.judul}`,
              finalMode: "1",
              babMateriId: materi._id,
            },
          }),
      });
    }

    return stages;
  }, [materi, descendants, completedIds, quizCountMap, router, finalQuizSet]);

  const handleStagePress = useCallback(
    async (stage: StageItem) => {
      if (!stage.unlocked) {
        return;
      }
      await playTapSound();
      stage.onPress();
    },
    [playTapSound]
  );

  if (!materi || allMateri === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!materi) {
    return (
      <View style={styles.center}>
        <FontAwesome name="exclamation-circle" size={40} color={Colors.textSecondary} />
        <Text style={styles.errorText}>Materi tidak ditemukan</Text>
      </View>
    );
  }

  const completedSubCount = descendants.filter((sub) => completedIds.has(sub.id)).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {materi.urlCover ? (
        <Image source={{ uri: materi.urlCover }} style={styles.cover} resizeMode="cover" />
      ) : null}

      <View style={styles.headerCard}>
        <Text style={styles.title}>{materi.judul}</Text>
        <Text style={styles.description}>
          {materi.deskripsi ?? "Pelajari materi ini secara bertahap seperti game belajar bahasa."}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Peta Belajar Duolingo Mode</Text>
      <View style={styles.chapterProgressWrap}>
        <Text style={styles.chapterProgressText}>
          Progress node: {completedSubCount}/{descendants.length} selesai
        </Text>
      </View>

      <View style={styles.mapWrap}>
        {stageItems.map((item, idx) => {
          const alignLeft = idx % 2 === 0;
          const isQuiz = item.kind !== "materi";
          return (
            <View key={item.key} style={styles.mapStageWrap}>
              {idx > 0 && <View style={styles.mapConnector} />}
              <Pressable
                style={({ pressed }) => [
                  styles.mapNode,
                  alignLeft ? styles.mapNodeLeft : styles.mapNodeRight,
                  isQuiz && styles.mapNodeQuiz,
                  !item.unlocked && styles.mapNodeLocked,
                  item.completed && styles.mapNodeDone,
                  pressed && item.unlocked && { transform: [{ scale: 0.98 }] },
                ]}
                disabled={!item.unlocked}
                onPress={() => handleStagePress(item)}
              >
                <View
                  style={[
                    styles.mapNodeIcon,
                    isQuiz && styles.mapNodeIconQuiz,
                    item.completed && styles.mapNodeIconDone,
                    !item.unlocked && styles.mapNodeIconLocked,
                  ]}
                >
                  {item.completed ? (
                    <FontAwesome name="check" size={16} color="#fff" />
                  ) : !item.unlocked ? (
                    <FontAwesome name="lock" size={14} color={Colors.textSecondary} />
                  ) : item.kind === "materi" ? (
                    <FontAwesome name="book" size={15} color={Colors.primary} />
                  ) : item.kind === "quiz-final" ? (
                    <FontAwesome name="trophy" size={15} color={Colors.primary} />
                  ) : (
                    <FontAwesome name="question" size={14} color={Colors.primary} />
                  )}
                </View>

                <View style={styles.mapNodeTextWrap}>
                  <Text style={styles.mapNodeTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.mapNodeSubtitle} numberOfLines={2}>
                    {item.subtitle}
                    {!item.unlocked ? " • Terkunci" : ""}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
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
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  cover: {
    width: "100%",
    height: 200,
  },
  headerCard: {
    backgroundColor: "#fff",
    padding: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.text,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.text,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  chapterProgressWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  chapterProgressText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  mapWrap: {
    marginTop: 4,
  },
  mapStageWrap: {
    position: "relative",
    marginBottom: 8,
  },
  mapConnector: {
    position: "absolute",
    left: "50%",
    top: -8,
    width: 2,
    height: 14,
    marginLeft: -1,
    backgroundColor: Colors.border,
  },
  mapNode: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    width: "86%",
    borderRadius: 18,
    padding: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  mapNodeLeft: {
    alignSelf: "flex-start",
    marginLeft: 16,
  },
  mapNodeRight: {
    alignSelf: "flex-end",
    marginRight: 16,
  },
  mapNodeQuiz: {
    backgroundColor: "#F7FCF8",
  },
  mapNodeLocked: {
    backgroundColor: "#F3F3F3",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapNodeDone: {
    borderWidth: 1,
    borderColor: Colors.success,
  },
  mapNodeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  mapNodeIconQuiz: {
    backgroundColor: "#EAF5EC",
  },
  mapNodeIconDone: {
    backgroundColor: Colors.success,
  },
  mapNodeIconLocked: {
    backgroundColor: "#E0E0E0",
  },
  mapNodeTextWrap: {
    flex: 1,
  },
  mapNodeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  mapNodeSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
