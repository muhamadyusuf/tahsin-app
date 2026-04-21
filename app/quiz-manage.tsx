import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors } from "@/lib/constants";

type QuizItemProps = {
  quiz: {
    _id: Id<"quiz">;
    question: string;
    type: "pilihan_ganda" | "essay";
  };
  materiId: Id<"materi">;
  usage?: {
    answerCount: number;
    progressCount: number;
    isUsed: boolean;
  };
  onDelete: (quizId: Id<"quiz">, usage?: { answerCount: number; progressCount: number; isUsed: boolean }) => void;
};

function QuizItemCard({ quiz, materiId, usage, onDelete }: QuizItemProps) {
  const router = useRouter();
  const options = useQuery(api.quiz.getOptions, { quizId: quiz._id });

  return (
    <View style={st.card}>
      <View style={st.cardHeader}>
        <View style={st.iconBadge}>
          <FontAwesome name="question" size={14} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.cardTitle}>{quiz.question}</Text>
          <Text style={st.cardMeta}>
            {quiz.type === "pilihan_ganda" ? "Pilihan ganda" : "Essay"}
            {quiz.type === "pilihan_ganda"
              ? ` • ${options?.length ?? 0} opsi`
              : ""}
          </Text>
          {usage?.isUsed ? (
            <View style={st.usedBadge}>
              <FontAwesome name="shield" size={12} color={Colors.warning} />
              <Text style={st.usedBadgeText}>
                Dipakai santri • {usage.answerCount} jawaban • {usage.progressCount} progres
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={st.cardActions}>
        <Pressable
          style={({ pressed }) => [st.actionBtn, pressed && { opacity: 0.75 }]}
          onPress={() =>
            router.push({
              pathname: "/quiz-form",
              params: { materiId, quizId: quiz._id },
            })
          }
        >
          <FontAwesome name="pencil" size={13} color={Colors.primary} />
          <Text style={st.actionText}>Edit</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [st.deleteBtn, pressed && { opacity: 0.75 }]}
          onPress={() => onDelete(quiz._id, usage)}
        >
          <FontAwesome name="trash-o" size={13} color={Colors.error} />
          <Text style={st.deleteText}>Hapus</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function QuizManageScreen() {
  const router = useRouter();
  const { materiId } = useLocalSearchParams<{ materiId: string }>();

  const materi = useQuery(
    api.materi.getById,
    materiId ? { id: materiId as Id<"materi"> } : "skip"
  );
  const quizzes = useQuery(
    api.quiz.listByMateri,
    materiId ? { materiId: materiId as Id<"materi"> } : "skip"
  );
  const usageStats = useQuery(
    api.quiz.getUsageByQuizIds,
    quizzes && quizzes.length > 0
      ? { quizIds: quizzes.map((item) => item._id) }
      : "skip"
  );
  const removeQuiz = useMutation(api.quiz.removeQuiz);

  const usageMap = new Map((usageStats ?? []).map((item) => [item.quizId, item]));

  const performDelete = async (quizId: Id<"quiz">, force?: boolean) => {
    await removeQuiz({ quizId, force });
    Alert.alert("Berhasil", "Quiz telah dihapus.");
  };

  const handleDelete = (
    quizId: Id<"quiz">,
    usage?: { answerCount: number; progressCount: number; isUsed: boolean }
  ) => {
    if (usage?.isUsed) {
      Alert.alert(
        "Quiz Sudah Dipakai",
        `Quiz ini sudah dipakai santri. Terdapat ${usage.answerCount} jawaban dan ${usage.progressCount} progres terkait. Hapus hanya jika Anda benar-benar yakin.`,
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Lanjut",
            style: "destructive",
            onPress: () => {
              Alert.alert(
                "Konfirmasi Akhir",
                "Menghapus quiz ini juga akan menghapus jawaban santri yang terkait dan melepas referensi progres quiz. Lanjut hapus?",
                [
                  { text: "Batal", style: "cancel" },
                  {
                    text: "Ya, Hapus",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await performDelete(quizId, true);
                      } catch (error) {
                        const message = error instanceof Error ? error.message : "Gagal menghapus quiz.";
                        Alert.alert("Error", message);
                      }
                    },
                  },
                ]
              );
            },
          },
        ]
      );
      return;
    }

    Alert.alert("Hapus Quiz", "Quiz ini akan dihapus permanen.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await performDelete(quizId, false);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Gagal menghapus quiz.";
            Alert.alert("Error", message);
          }
        },
      },
    ]);
  };

  if (!materi || !quizzes) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <View style={st.headerCard}>
        <Text style={st.heading}>{materi.judul}</Text>
        <Text style={st.subheading}>
          {quizzes.length} quiz tersedia untuk materi ini
        </Text>
      </View>

      <FlatList
        data={quizzes}
        keyExtractor={(item) => item._id}
        contentContainerStyle={st.listContent}
        renderItem={({ item }) => (
          <QuizItemCard
            quiz={item}
            materiId={materiId as Id<"materi">}
            usage={usageMap.get(item._id)}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={
          <View style={st.emptyState}>
            <FontAwesome name="question-circle-o" size={34} color={Colors.border} />
            <Text style={st.emptyTitle}>Belum ada quiz</Text>
            <Text style={st.emptyText}>
              Tambahkan quiz pertama untuk materi ini dari tombol di bawah.
            </Text>
          </View>
        }
      />

      <Pressable
        style={({ pressed }) => [st.fab, pressed && { opacity: 0.85 }]}
        onPress={() =>
          router.push({
            pathname: "/quiz-form",
            params: { materiId },
          })
        }
      >
        <FontAwesome name="plus" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerCard: {
    backgroundColor: "#fff",
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  subheading: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.primaryLight,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  cardMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  usedBadge: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#FFF8E1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  usedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.warning,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FFEBEE",
  },
  deleteText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.error,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});