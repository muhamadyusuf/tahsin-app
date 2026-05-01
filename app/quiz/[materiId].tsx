import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors, QUIZ_PASSING_GRADE } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

type QuizDoc = {
  _id: Id<"quiz">;
  question: string;
  urlImage?: string;
  urlVideo?: string;
  type: "pilihan_ganda" | "essay";
  materiId: Id<"materi">;
};

type OptionDoc = {
  _id: Id<"quiz_options">;
  seq: number;
  quizId: Id<"quiz">;
  deskripsi: string;
  poin: number;
  urlImage?: string;
};

export default function QuizScreen() {
  const { materiId, materiTitle, finalMode, babMateriId, nextMateriId } = useLocalSearchParams<{
    materiId: string;
    materiTitle: string;
    finalMode?: string;
    babMateriId?: string;
    nextMateriId?: string;
  }>();
  const router = useRouter();
  const { userData } = useAuthContext();

  const isFinalMode = finalMode === "1";

  const quizzes = useQuery(
    api.quiz.listByMateri,
    materiId ? { materiId: materiId as Id<"materi"> } : "skip"
  );
  const finalQuizzes = useQuery(
    api.quiz.getRandomFinalQuizForBab,
    isFinalMode && babMateriId && userData?._id
      ? {
          babMateriId: babMateriId as Id<"materi">,
          userId: userData._id,
          limit: 20,
        }
      : "skip"
  );

  const submitAnswer = useMutation(api.quiz.submitAnswer);
  const saveProgress = useMutation(api.quiz.saveProgress);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<Id<"quiz_options"> | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [totalPoin, setTotalPoin] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeQuizzes = isFinalMode ? (finalQuizzes as QuizDoc[] | undefined) : quizzes;
  const currentQuiz: QuizDoc | undefined = activeQuizzes?.[currentIndex];

  const options = useQuery(
    api.quiz.getOptions,
    currentQuiz ? { quizId: currentQuiz._id } : "skip"
  );

  const sortedOptions = [...(options ?? [])].sort(
    (a, b) => a.seq - b.seq
  ) as OptionDoc[];

  const handleSelectOption = useCallback(
    (optionId: Id<"quiz_options">) => {
      if (isAnswered) return;
      setSelectedOption(optionId);
    },
    [isAnswered]
  );

  const handleConfirm = useCallback(async () => {
    if (!selectedOption || !currentQuiz || !userData?._id) return;

    setSubmitting(true);
    const selected = sortedOptions.find((o) => o._id === selectedOption);
    const isCorrect = selected ? selected.poin > 0 : false;
    const optionPoin = selected?.poin ?? 0;

    try {
      await submitAnswer({
        userId: userData._id,
        quizId: currentQuiz._id,
        optionId: selectedOption,
        isCorrect,
      });

      setScore((prev) => prev + optionPoin);
      const maxPoin = sortedOptions.reduce(
        (max, o) => Math.max(max, o.poin),
        0
      );
      setTotalPoin((prev) => prev + maxPoin);
      setIsAnswered(true);
    } catch {
      const msg = "Gagal menyimpan jawaban";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [selectedOption, currentQuiz, userData, sortedOptions, submitAnswer]);

  const handleNext = useCallback(async () => {
    if (!activeQuizzes) return;

    if (currentIndex < activeQuizzes.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      // Finish quiz
      const finalScore = totalPoin > 0 ? score / totalPoin : 0;
      setIsFinished(true);

      if (userData?._id && materiId) {
        try {
          const progressMateriId = isFinalMode && babMateriId ? babMateriId : materiId;
          await saveProgress({
            userId: userData._id,
            materiId: progressMateriId as Id<"materi">,
            score: finalScore,
          });
        } catch {
          // silently fail — progress saves best-effort
        }
      }
    }
  }, [currentIndex, activeQuizzes, score, totalPoin, userData, materiId, isFinalMode, babMateriId, saveProgress]);

  if (activeQuizzes === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (activeQuizzes.length === 0) {
    return (
      <View style={styles.center}>
        <FontAwesome name="info-circle" size={40} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>
          {isFinalMode
            ? "Belum ada cukup quiz dari sub-bab yang sudah diselesaikan"
            : "Tidak ada kuis untuk materi ini"}
        </Text>
      </View>
    );
  }

  // Result screen
  if (isFinished) {
    const finalScore = totalPoin > 0 ? score / totalPoin : 0;
    const passed = finalScore >= QUIZ_PASSING_GRADE;

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.resultContent}
      >
        <View style={[styles.resultCard, passed ? styles.passCard : styles.failCard]}>
          <FontAwesome
            name={passed ? "trophy" : "refresh"}
            size={56}
            color={passed ? "#FFD700" : Colors.textSecondary}
          />
          <Text style={styles.resultTitle}>
            {passed ? "Selamat! 🎉" : "Belum Lulus"}
          </Text>
          <Text style={styles.resultSubtitle}>
            {passed
              ? "Kamu berhasil menyelesaikan kuis ini"
              : "Pelajari kembali materinya dan coba lagi"}
          </Text>

          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>
              {Math.round(finalScore * 100)}%
            </Text>
            <Text style={styles.scoreLabel}>Skor</Text>
          </View>

          <View style={styles.resultStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{activeQuizzes.length}</Text>
              <Text style={styles.statLabel}>Pertanyaan</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {Math.round(QUIZ_PASSING_GRADE * 100)}%
              </Text>
              <Text style={styles.statLabel}>Nilai Lulus</Text>
            </View>
          </View>
        </View>

        {passed && nextMateriId ? (
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() =>
              router.replace({
                pathname: "/materi-reader/[materiId]",
                params: { materiId: nextMateriId },
              })
            }
          >
            <Text style={styles.btnPrimaryText}>Materi Berikutnya →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.back()}
          >
            <Text style={styles.btnPrimaryText}>
              {passed ? "Kembali ke Materi" : "Kembali"}
            </Text>
          </TouchableOpacity>
        )}

        {!passed && (
          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => {
              setCurrentIndex(0);
              setSelectedOption(null);
              setIsAnswered(false);
              setIsFinished(false);
              setScore(0);
              setTotalPoin(0);
            }}
          >
            <FontAwesome name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.btnOutlineText}>Coba Lagi</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // Quiz question screen
  const selected = sortedOptions.find((o) => o._id === selectedOption);
  const isCorrect = selected ? selected.poin > 0 : false;
  const progress = (currentIndex + 1) / activeQuizzes.length;
  const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.quizContent}>
      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>
        Soal {currentIndex + 1} dari {activeQuizzes.length}
      </Text>

      {/* Question */}
      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{currentQuiz?.question}</Text>
        {currentQuiz?.urlImage && (
          <Image
            source={{ uri: currentQuiz.urlImage }}
            style={styles.questionImage}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Options */}
      {sortedOptions.map((option, idx) => {
        const isSelected = selectedOption === option._id;
        const showCorrect = isAnswered && option.poin > 0;
        const showWrong = isAnswered && isSelected && option.poin <= 0;

        return (
          <TouchableOpacity
            key={option._id}
            style={[
              styles.optionCard,
              isSelected && !isAnswered && styles.optionSelected,
              showCorrect && styles.optionCorrect,
              showWrong && styles.optionWrong,
            ]}
            onPress={() => handleSelectOption(option._id)}
            disabled={isAnswered}
          >
            <View
              style={[
                styles.optionLabel,
                isSelected && !isAnswered && styles.optionLabelSelected,
                showCorrect && styles.optionLabelCorrect,
                showWrong && styles.optionLabelWrong,
              ]}
            >
              {showCorrect ? (
                <FontAwesome name="check" size={12} color="#fff" />
              ) : showWrong ? (
                <FontAwesome name="times" size={12} color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.optionLabelText,
                    isSelected && styles.optionLabelTextSelected,
                  ]}
                >
                  {optionLabels[idx] ?? idx + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.optionText,
                showCorrect && styles.optionTextCorrect,
                showWrong && styles.optionTextWrong,
              ]}
            >
              {option.deskripsi}
            </Text>
            {option.urlImage && (
              <Image
                source={{ uri: option.urlImage }}
                style={styles.optionImage}
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>
        );
      })}

      {/* Feedback */}
      {isAnswered && (
        <View
          style={[
            styles.feedbackCard,
            isCorrect ? styles.feedbackCorrect : styles.feedbackWrong,
          ]}
        >
          <FontAwesome
            name={isCorrect ? "check-circle" : "times-circle"}
            size={20}
            color={isCorrect ? Colors.success : "#E53935"}
          />
          <Text
            style={[
              styles.feedbackText,
              { color: isCorrect ? Colors.success : "#E53935" },
            ]}
          >
            {isCorrect ? "Jawaban Benar!" : "Jawaban Salah"}
          </Text>
        </View>
      )}

      {/* Action Button */}
      {!isAnswered ? (
        <TouchableOpacity
          style={[styles.btnPrimary, !selectedOption && styles.btnDisabled]}
          onPress={handleConfirm}
          disabled={!selectedOption || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnPrimaryText}>Jawab</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.btnPrimary} onPress={handleNext}>
          <Text style={styles.btnPrimaryText}>
            {currentIndex < activeQuizzes.length - 1 ? "Soal Berikutnya" : "Lihat Hasil"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },

  // Quiz content
  quizContent: {
    padding: 16,
    paddingBottom: 40,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },

  // Question
  questionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  questionText: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
    lineHeight: 26,
  },
  questionImage: {
    width: "100%",
    height: 180,
    marginTop: 12,
    borderRadius: 8,
  },

  // Options
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#E8E8E8",
    gap: 12,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  optionCorrect: {
    borderColor: Colors.success,
    backgroundColor: "#E8F5E9",
  },
  optionWrong: {
    borderColor: "#E53935",
    backgroundColor: "#FFEBEE",
  },

  optionLabel: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  optionLabelSelected: {
    backgroundColor: Colors.primary,
  },
  optionLabelCorrect: {
    backgroundColor: Colors.success,
  },
  optionLabelWrong: {
    backgroundColor: "#E53935",
  },
  optionLabelText: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.textSecondary,
  },
  optionLabelTextSelected: {
    color: "#fff",
  },

  optionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  optionTextCorrect: {
    color: Colors.success,
    fontWeight: "600",
  },
  optionTextWrong: {
    color: "#E53935",
    fontWeight: "600",
  },
  optionImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },

  // Feedback
  feedbackCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  feedbackCorrect: {
    backgroundColor: "#E8F5E9",
  },
  feedbackWrong: {
    backgroundColor: "#FFEBEE",
  },
  feedbackText: {
    fontSize: 15,
    fontWeight: "600",
  },

  // Buttons
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
  },
  btnOutlineText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: "bold",
  },

  // Result
  resultContent: {
    padding: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  resultCard: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: 10,
  },
  passCard: {
    borderTopWidth: 4,
    borderTopColor: Colors.success,
  },
  failCard: {
    borderTopWidth: 4,
    borderTopColor: "#E53935",
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.text,
    marginTop: 8,
  },
  resultSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    borderColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 16,
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: "bold",
    color: Colors.primary,
  },
  scoreLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  resultStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E0E0E0",
  },
});
