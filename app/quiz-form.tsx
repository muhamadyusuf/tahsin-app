import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { Colors } from "@/lib/constants";

type OptionItem = {
  id: string;
  deskripsi: string;
  poin: number;
};

const createEmptyOption = (): OptionItem => ({
  id: `${Date.now()}-${Math.random()}`,
  deskripsi: "",
  poin: 0,
});

const createDefaultOptions = () => [
  createEmptyOption(),
  createEmptyOption(),
  createEmptyOption(),
  createEmptyOption(),
];

export default function QuizFormScreen() {
  const { materiId, quizId } = useLocalSearchParams<{ materiId: string; quizId?: string }>();
  const router = useRouter();
  const isEditMode = Boolean(quizId);
  const isWeb = Platform.OS === "web";

  const materi = useQuery(
    api.materi.getById,
    materiId ? { id: materiId as Id<"materi"> } : "skip"
  );
  const existingQuizzes = useQuery(
    api.quiz.listByMateri,
    materiId ? { materiId: materiId as Id<"materi"> } : "skip"
  );
  const quiz = useQuery(
    api.quiz.getById,
    quizId ? { quizId: quizId as Id<"quiz"> } : "skip"
  );
  const quizOptions = useQuery(
    api.quiz.getOptions,
    quizId ? { quizId: quizId as Id<"quiz"> } : "skip"
  );
  const createQuiz = useMutation(api.quiz.createQuiz);
  const createOption = useMutation(api.quiz.createOption);
  const updateQuiz = useMutation(api.quiz.updateQuiz);
  const replaceOptions = useMutation(api.quiz.replaceOptions);

  const [question, setQuestion] = useState("");
  const [type, setType] = useState<"pilihan_ganda" | "essay">("pilihan_ganda");
  const [options, setOptions] = useState<OptionItem[]>(createDefaultOptions);
  const [submitting, setSubmitting] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!isEditMode || hasInitialized || !quiz) {
      return;
    }

    setQuestion(quiz.question);
    setType(quiz.type);

    if (quiz.type === "pilihan_ganda" && quizOptions) {
      const normalizedOptions = quizOptions
        .sort((a, b) => a.seq - b.seq)
        .map((item) => ({
          id: `${item._id}`,
          deskripsi: item.deskripsi,
          poin: item.poin,
        }));

      setOptions(
        normalizedOptions.length > 0
          ? normalizedOptions
          : createDefaultOptions()
      );
      setHasInitialized(true);
      return;
    }

    setHasInitialized(true);
  }, [hasInitialized, isEditMode, quiz, quizOptions]);

  const updateOption = (idx: number, field: "deskripsi" | "poin", val: string) => {
    setOptions((prev) =>
      prev.map((o, i) =>
        i === idx
          ? { ...o, [field]: field === "poin" ? parseFloat(val) || 0 : val }
          : o
      )
    );
  };

  const addOption = () => {
    setOptions((prev) => [...prev, createEmptyOption()]);
  };

  const moveOption = (fromIndex: number, toIndex: number) => {
    setOptions((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const removeOption = (idx: number) => {
    setOptions((prev) => {
      if (prev.length <= 2) {
        Alert.alert("Minimal Opsi", "Quiz pilihan ganda harus memiliki minimal 2 opsi.");
        return prev;
      }

      return prev.filter((_, optionIndex) => optionIndex !== idx);
    });
  };

  const previewOptions = options
    .map((option, index) => ({
      id: option.id,
      seq: index + 1,
      deskripsi: option.deskripsi.trim(),
      poin: option.poin,
    }))
    .filter((option) => option.deskripsi.length > 0);

  const renderOptionItem = ({ item, getIndex, drag, isActive }: RenderItemParams<OptionItem>) => {
    const idx = getIndex() ?? 0;

    return (
      <Pressable
        onLongPress={drag}
        delayLongPress={120}
        style={[st.optionCard, isActive && st.optionCardActive]}
      >
        <View style={st.optionCardHeader}>
          <View style={st.optionBadge}>
            <Text style={st.optionBadgeText}>{String.fromCharCode(65 + idx)}</Text>
          </View>
          <Text style={st.optionHint}>Tahan lalu geser untuk ubah urutan</Text>
          <Pressable
            onPress={() => removeOption(idx)}
            style={({ pressed }) => [st.removeOptionBtn, pressed && { opacity: 0.7 }]}
          >
            <FontAwesome name="trash-o" size={14} color={Colors.error} />
          </Pressable>
        </View>

        <TextInput
          style={st.input}
          value={item.deskripsi}
          onChangeText={(value) => updateOption(idx, "deskripsi", value)}
          placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
          placeholderTextColor={Colors.textSecondary}
        />
        <TextInput
          style={[st.input, st.pointInput]}
          value={String(item.poin)}
          onChangeText={(value) => updateOption(idx, "poin", value)}
          keyboardType="numeric"
          placeholder="Poin"
          placeholderTextColor={Colors.textSecondary}
        />
      </Pressable>
    );
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      Alert.alert("Error", "Pertanyaan wajib diisi.");
      return;
    }
    if (!materiId) return;

    setSubmitting(true);
    try {
      const sanitizedOptions = previewOptions;

      if (type === "pilihan_ganda" && sanitizedOptions.length < 2) {
        Alert.alert("Error", "Minimal isi 2 opsi jawaban.");
        setSubmitting(false);
        return;
      }

      if (isEditMode && quizId) {
        await updateQuiz({
          quizId: quizId as Id<"quiz">,
          question: question.trim(),
          type,
        });

        await replaceOptions({
          quizId: quizId as Id<"quiz">,
          options:
            type === "pilihan_ganda"
              ? sanitizedOptions.map((option) => ({
                  seq: option.seq,
                  deskripsi: option.deskripsi,
                  poin: option.poin,
                }))
              : [],
        });

        Alert.alert("Berhasil", "Quiz berhasil diperbarui.", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } else {
        const createdQuizId = await createQuiz({
          materiId: materiId as Id<"materi">,
          question: question.trim(),
          type,
        });

        if (type === "pilihan_ganda") {
          for (const option of sanitizedOptions) {
            await createOption({
              quizId: createdQuizId,
              seq: option.seq,
              deskripsi: option.deskripsi,
              poin: option.poin,
            });
          }
        }

        Alert.alert("Berhasil", "Quiz berhasil ditambahkan.", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      }
    } catch {
      Alert.alert("Error", isEditMode ? "Gagal memperbarui quiz." : "Gagal membuat quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!materi || (isEditMode && (!quiz || (quiz?.type === "pilihan_ganda" && !quizOptions)))) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const formContent = (
    <>
      <Text style={st.heading}>Quiz: {materi.judul}</Text>
      <Text style={st.subheading}>
        {isEditMode
          ? "Perbarui quiz yang sudah ada"
          : `${existingQuizzes?.length ?? 0} quiz sudah ada`}
      </Text>

      <Text style={st.label}>Tipe Quiz</Text>
      <View style={st.typeRow}>
        <Pressable
          style={[st.typeBtn, type === "pilihan_ganda" && st.typeBtnActive]}
          onPress={() => setType("pilihan_ganda")}
        >
          <Text
            style={[
              st.typeBtnText,
              type === "pilihan_ganda" && st.typeBtnTextActive,
            ]}
          >
            Pilihan Ganda
          </Text>
        </Pressable>
        <Pressable
          style={[st.typeBtn, type === "essay" && st.typeBtnActive]}
          onPress={() => setType("essay")}
        >
          <Text
            style={[st.typeBtnText, type === "essay" && st.typeBtnTextActive]}
          >
            Essay
          </Text>
        </Pressable>
      </View>

      <Text style={st.label}>Pertanyaan *</Text>
      <TextInput
        style={[st.input, { height: 80, textAlignVertical: "top" }]}
        value={question}
        onChangeText={setQuestion}
        placeholder="Tulis pertanyaan..."
        placeholderTextColor={Colors.textSecondary}
        multiline
      />

      {type === "pilihan_ganda" && (
        <>
          <Text style={st.label}>Pilihan Jawaban</Text>
          <Text style={st.helperText}>
            {isWeb
              ? "Gunakan tombol panah untuk mengubah urutan jawaban di web."
              : "Tahan salah satu kartu opsi lalu geser untuk mengubah urutan jawaban."}
          </Text>
          {isWeb ? (
            <View style={st.optionList}>
              {options.map((item, idx) => (
                <View key={item.id} style={st.optionCard}>
                  <View style={st.optionCardHeader}>
                    <View style={st.optionBadge}>
                      <Text style={st.optionBadgeText}>{String.fromCharCode(65 + idx)}</Text>
                    </View>
                    <Text style={st.optionHint}>Urutan jawaban</Text>
                    <View style={st.webOrderBtns}>
                      <Pressable
                        onPress={() => moveOption(idx, idx - 1)}
                        style={({ pressed }) => [
                          st.webOrderBtn,
                          idx === 0 && st.webOrderBtnDisabled,
                          pressed && { opacity: 0.7 },
                        ]}
                        disabled={idx === 0}
                      >
                        <FontAwesome name="arrow-up" size={12} color={idx === 0 ? Colors.textSecondary : Colors.primary} />
                      </Pressable>
                      <Pressable
                        onPress={() => moveOption(idx, idx + 1)}
                        style={({ pressed }) => [
                          st.webOrderBtn,
                          idx === options.length - 1 && st.webOrderBtnDisabled,
                          pressed && { opacity: 0.7 },
                        ]}
                        disabled={idx === options.length - 1}
                      >
                        <FontAwesome
                          name="arrow-down"
                          size={12}
                          color={idx === options.length - 1 ? Colors.textSecondary : Colors.primary}
                        />
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => removeOption(idx)}
                      style={({ pressed }) => [st.removeOptionBtn, pressed && { opacity: 0.7 }]}
                    >
                      <FontAwesome name="trash-o" size={14} color={Colors.error} />
                    </Pressable>
                  </View>

                  <TextInput
                    style={st.input}
                    value={item.deskripsi}
                    onChangeText={(value) => updateOption(idx, "deskripsi", value)}
                    placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                    placeholderTextColor={Colors.textSecondary}
                  />
                  <TextInput
                    style={[st.input, st.pointInput]}
                    value={String(item.poin)}
                    onChangeText={(value) => updateOption(idx, "poin", value)}
                    keyboardType="numeric"
                    placeholder="Poin"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
              ))}
            </View>
          ) : (
            <NestableDraggableFlatList
              data={options}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => setOptions(data)}
              renderItem={renderOptionItem}
              scrollEnabled={false}
              activationDistance={10}
              containerStyle={st.optionList}
            />
          )}
          <Pressable
            style={({ pressed }) => [st.secondaryBtn, pressed && { opacity: 0.8 }]}
            onPress={addOption}
          >
            <FontAwesome name="plus" size={14} color={Colors.primary} />
            <Text style={st.secondaryBtnText}>Tambah Opsi</Text>
          </Pressable>
        </>
      )}

      <Pressable
        style={({ pressed }) => [st.previewBtn, pressed && { opacity: 0.85 }]}
        onPress={() => setShowPreview(true)}
      >
        <FontAwesome name="eye" size={16} color={Colors.primaryDark} />
        <Text style={st.previewBtnText}>Preview Soal</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          st.submitBtn,
          pressed && { opacity: 0.85 },
          submitting && { opacity: 0.5 },
        ]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <FontAwesome name="check" size={16} color="#fff" />
            <Text style={st.submitBtnText}>{isEditMode ? "Simpan Perubahan" : "Tambah Quiz"}</Text>
          </>
        )}
      </Pressable>
    </>
  );

  return (
    <>
      {isWeb ? (
        <ScrollView
          style={st.container}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          {formContent}
        </ScrollView>
      ) : (
        <NestableScrollContainer
          style={st.container}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          {formContent}
        </NestableScrollContainer>
      )}

      <Modal visible={showPreview} transparent animationType="fade" onRequestClose={() => setShowPreview(false)}>
        <View style={st.modalBackdrop}>
          <View style={st.modalCard}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Preview Soal</Text>
              <Pressable onPress={() => setShowPreview(false)}>
                <FontAwesome name="close" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={st.previewQuestion}>
              {question.trim() || "Pertanyaan belum diisi."}
            </Text>
            <Text style={st.previewType}>
              {type === "pilihan_ganda" ? "Pilihan Ganda" : "Essay"}
            </Text>

            {type === "pilihan_ganda" ? (
              previewOptions.length > 0 ? (
                <View style={st.previewOptionList}>
                  {previewOptions.map((option, index) => (
                    <View key={option.id} style={st.previewOptionItem}>
                      <View style={st.previewOptionBadge}>
                        <Text style={st.previewOptionBadgeText}>{String.fromCharCode(65 + index)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.previewOptionText}>{option.deskripsi}</Text>
                        <Text style={st.previewOptionPoint}>Poin: {option.poin}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={st.previewEmpty}>Belum ada opsi yang terisi.</Text>
              )
            ) : (
              <Text style={st.previewEmpty}>
                Santri akan menjawab dalam bentuk esai pada quiz ini.
              </Text>
            )}

            <Pressable
              style={({ pressed }) => [st.submitBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setShowPreview(false)}
            >
              <Text style={st.submitBtnText}>Tutup Preview</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  heading: { fontSize: 20, fontWeight: "700", color: Colors.text },
  subheading: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
  },

  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeBtnText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  typeBtnTextActive: { color: "#fff" },

  optionList: {
    gap: 10,
  },
  optionCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  optionCardActive: {
    borderColor: Colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  optionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  optionBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  optionHint: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  webOrderBtns: {
    flexDirection: "row",
    gap: 6,
  },
  webOrderBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryLight,
  },
  webOrderBtnDisabled: {
    backgroundColor: "#ECEFF1",
  },
  removeOptionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFEBEE",
  },
  pointInput: {
    width: 90,
    textAlign: "center",
    alignSelf: "flex-end",
  },
  secondaryBtn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  previewBtn: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E8F5E9",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  previewBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    gap: 12,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  previewQuestion: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 24,
  },
  previewType: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
  },
  previewOptionList: {
    gap: 10,
  },
  previewOptionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 12,
  },
  previewOptionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryLight,
  },
  previewOptionBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  previewOptionText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: "600",
  },
  previewOptionPoint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  previewEmpty: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  submitBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 28,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
