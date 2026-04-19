import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

      {/* Sub Materi */}
      {sortedSub.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Sub Materi</Text>
          {sortedSub.map((sub, index) => {
            const isCompleted = completedIds.has(sub._id);
            return (
              <TouchableOpacity
                key={sub._id}
                style={styles.subCard}
                onPress={() =>
                  router.push({
                    pathname: "/materi/[materiId]",
                    params: { materiId: sub._id, materiTitle: sub.judul },
                  })
                }
              >
                <View
                  style={[
                    styles.subNumber,
                    isCompleted && styles.subNumberCompleted,
                  ]}
                >
                  {isCompleted ? (
                    <FontAwesome name="check" size={14} color="#fff" />
                  ) : (
                    <Text style={styles.subNumberText}>{index + 1}</Text>
                  )}
                </View>
                <View style={styles.subInfo}>
                  <Text style={styles.subTitle}>{sub.judul}</Text>
                  {sub.deskripsi && (
                    <Text style={styles.subDesc} numberOfLines={1}>
                      {sub.deskripsi}
                    </Text>
                  )}
                </View>
                {sub.urlVideo && (
                  <FontAwesome name="play-circle-o" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Quiz section */}
      {hasQuiz && (
        <>
          <Text style={styles.sectionTitle}>Kuis</Text>
          <TouchableOpacity
            style={styles.quizCard}
            onPress={() =>
              router.push({
                pathname: "/quiz/[materiId]",
                params: { materiId: materi._id, materiTitle: materi.judul },
              })
            }
          >
            <View style={styles.quizIconWrap}>
              <FontAwesome name="question-circle" size={28} color="#fff" />
            </View>
            <View style={styles.quizInfo}>
              <Text style={styles.quizTitle}>Kuis {materi.judul}</Text>
              <Text style={styles.quizDesc}>
                {quizzes!.length} pertanyaan • Uji pemahamanmu
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color="#fff" />
          </TouchableOpacity>
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

  // Sub Materi
  subCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  subNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  subNumberCompleted: {
    backgroundColor: Colors.success,
  },
  subNumberText: {
    fontSize: 13,
    fontWeight: "bold",
    color: Colors.primaryDark,
  },
  subInfo: {
    flex: 1,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  subDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Quiz
  quizCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 18,
    gap: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  quizIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  quizInfo: {
    flex: 1,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  quizDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
});
