import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Linking,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

export default function MateriDetailScreen() {
  const { materiId, materiTitle } = useLocalSearchParams<{
    materiId: string;
    materiTitle: string;
  }>();
  const router = useRouter();
  const { userData } = useAuthContext();

  const materi = useQuery(
    api.materi.getById,
    materiId ? { id: materiId as Id<"materi"> } : "skip"
  );

  const subMateri = useQuery(
    api.materi.getChildren,
    materiId ? { parentId: materiId as Id<"materi"> } : "skip"
  );

  const quizzes = useQuery(
    api.quiz.listByMateri,
    materiId ? { materiId: materiId as Id<"materi"> } : "skip"
  );

  const subIds = (subMateri ?? []).map((item) => item._id as Id<"materi">);
  const subQuizCounts = useQuery(
    api.quiz.getQuizCountsByMateriIds,
    subIds.length > 0 ? { materiIds: subIds } : "skip"
  );

  const userProgress = useQuery(
    api.quiz.getUserProgress,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const isLoading = materi === undefined;

  const completedIds = new Set(
    (userProgress ?? [])
      .filter((p) => p.completedAt)
      .map((p) => p.materiId)
  );

  if (isLoading) {
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

  const sortedSub = [...(subMateri ?? [])].sort((a, b) => a.seq - b.seq);
  const hasQuiz = (quizzes ?? []).length > 0;
  const subQuizMap = new Map((subQuizCounts ?? []).map((item) => [item.materiId, item.count]));
  const completedSubCount = sortedSub.filter((sub) => completedIds.has(sub._id)).length;
  const allSubCompleted = sortedSub.length === 0 || completedSubCount === sortedSub.length;

  const stageItems: {
    key: string;
    title: string;
    subtitle: string;
    kind: "materi" | "quiz-sub" | "quiz-bab";
    unlocked: boolean;
    completed: boolean;
    onPress: () => void;
  }[] = [];

  sortedSub.forEach((sub, index) => {
    const isCompleted = completedIds.has(sub._id);
    const isUnlocked = index === 0 || completedIds.has(sortedSub[index - 1]._id);
    const quizCount = subQuizMap.get(sub._id) ?? 0;

    stageItems.push({
      key: `materi-${sub._id}`,
      title: sub.judul,
      subtitle: "Materi Sub-bab",
      kind: "materi",
      unlocked: isUnlocked,
      completed: isCompleted,
      onPress: () =>
        router.push({
          pathname: "/materi/[materiId]",
          params: { materiId: sub._id, materiTitle: sub.judul },
        }),
    });

    if (quizCount > 0) {
      stageItems.push({
        key: `quiz-sub-${sub._id}`,
        title: `Quiz ${sub.judul}`,
        subtitle: `${quizCount} pertanyaan`,
        kind: "quiz-sub",
        unlocked: isCompleted,
        completed: isCompleted,
        onPress: () =>
          router.push({
            pathname: "/quiz/[materiId]",
            params: { materiId: sub._id, materiTitle: sub.judul },
          }),
      });
    }
  });

  if (hasQuiz) {
    stageItems.push({
      key: `quiz-bab-${materi._id}`,
      title: `Quiz Penutup ${materi.judul}`,
      subtitle: `${quizzes!.length} pertanyaan ringkasan BAB`,
      kind: "quiz-bab",
      unlocked: allSubCompleted,
      completed: completedIds.has(materi._id),
      onPress: () =>
        router.push({
          pathname: "/quiz/[materiId]",
          params: { materiId: materi._id, materiTitle: materi.judul },
        }),
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Cover image */}
      {materi.urlCover && (
        <Image
          source={{ uri: materi.urlCover }}
          style={styles.cover}
          resizeMode="cover"
        />
      )}

      {/* Title & Description */}
      <View style={styles.headerCard}>
        <Text style={styles.title}>{materi.judul}</Text>
        {materi.deskripsi && (
          <Text style={styles.description}>{materi.deskripsi}</Text>
        )}
      </View>

      {/* Video */}
      {materi.urlVideo && (
        <TouchableOpacity
          style={styles.videoCard}
          onPress={() => Linking.openURL(materi.urlVideo!)}
        >
          <View style={styles.videoIcon}>
            <FontAwesome name="play-circle" size={32} color={Colors.primary} />
          </View>
          <View style={styles.videoInfo}>
            <Text style={styles.videoTitle}>Video Pembelajaran</Text>
            <Text style={styles.videoDesc}>Tonton video materi ini</Text>
          </View>
          <FontAwesome name="external-link" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Zig-zag path */}
      {stageItems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Peta Belajar BAB</Text>
          <View style={styles.chapterProgressWrap}>
            <Text style={styles.chapterProgressText}>
              Progress Sub-bab: {completedSubCount}/{sortedSub.length}
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
                      pressed && item.unlocked && { opacity: 0.85 },
                    ]}
                    disabled={!item.unlocked}
                    onPress={item.onPress}
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
        </>
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

  // Cover
  cover: {
    width: "100%",
    height: 200,
  },

  // Header
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

  // Video
  videoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  videoIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  videoDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Section
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

  // Zig-zag map
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
    borderRadius: 12,
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
    fontWeight: "600",
    color: Colors.text,
  },
  mapNodeSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
