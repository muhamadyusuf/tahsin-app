import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useAction } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import { getAllSurahs, getSurahByEdition, Surah, SurahDetail } from "@/lib/alquran-api";

type WordHighlightStatus = "correct" | "partial" | "wrong" | "missing";

type AnalysisResult = {
  transcript: string;
  score: number;
  pronunciationScore: number;
  tajwidScore: number;
  fluencyScore: number;
  mistakes: Array<{
    wordIndex: number;
    expected: string;
    recognized: string;
    type: "missing" | "different" | "extra";
    note: string;
  }>;
  expectedWordStatuses: Array<{
    displayIndex: number;
    word: string;
    status: WordHighlightStatus;
    recognized: string;
    similarity: number;
    note: string;
  }>;
  extraWords: Array<{
    recognized: string;
    atRecognizedIndex: number;
    note: string;
  }>;
  recommendation: string;
};

export default function NgajiAiScreen() {
  const [loadingSurahs, setLoadingSurahs] = useState(true);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [surahDetail, setSurahDetail] = useState<SurahDetail | null>(null);
  const [ayahIndex, setAyahIndex] = useState(0);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const analyzeRecitation = useAction((api as any).ngajiAi.analyzeRecitation);

  useEffect(() => {
    (async () => {
      try {
        const list = await getAllSurahs();
        setSurahs(list);
        setSelectedSurah(list[0] ?? null);
      } catch (error) {
        console.error("Failed to load surah list", error);
      } finally {
        setLoadingSurahs(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedSurah) return;

    setSurahDetail(null);
    setAyahIndex(0);
    setRecordingUri(null);
    setAnalysis(null);

    (async () => {
      try {
        // Force Quran Uthmani edition so displayed ayah follows mushaf standard.
        const detail = await getSurahByEdition(selectedSurah.number, "quran-uthmani");
        setSurahDetail(detail);
      } catch (error) {
        console.error("Failed to load selected surah", error);
      }
    })();
  }, [selectedSurah]);

  const filteredSurahs = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return surahs;

    return surahs.filter((s) => {
      return (
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation.toLowerCase().includes(q) ||
        s.number.toString() === q
      );
    });
  }, [searchText, surahs]);

  const currentAyah = surahDetail?.ayahs[ayahIndex] ?? null;
  const totalAyahs = surahDetail?.ayahs.length ?? 0;

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        alert("Izin mikrofon diperlukan untuk fitur Ngaji AI.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      setRecordingUri(null);
      setAnalysis(null);
    } catch (error) {
      console.error("Start recording error", error);
      alert("Gagal mulai rekam audio.");
    }
  }

  async function stopRecording() {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingUri(uri ?? null);
    } catch (error) {
      console.error("Stop recording error", error);
      alert("Gagal menyimpan rekaman.");
    } finally {
      setIsRecording(false);
      setRecording(null);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    }
  }

  async function runAnalysis() {
    if (!selectedSurah || !currentAyah || !recordingUri) {
      alert("Pilih surah dan rekam suara terlebih dahulu.");
      return;
    }

    setAnalyzing(true);
    setAnalysis(null);

    try {
      const base64 = await FileSystem.readAsStringAsync(recordingUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const uriLower = recordingUri.toLowerCase();
      const mimeType = uriLower.endsWith(".m4a") || uriLower.endsWith(".mp4")
        ? "audio/mp4"
        : uriLower.endsWith(".3gp")
          ? "audio/3gpp"
          : uriLower.endsWith(".webm")
            ? "audio/webm"
            : "audio/mp4";

      const result = (await analyzeRecitation({
        surahNumber: selectedSurah.number,
        ayahNumber: currentAyah.numberInSurah,
        expectedText: currentAyah.text,
        audioBase64: base64,
        mimeType,
      })) as AnalysisResult;

      setAnalysis(result);
    } catch (error) {
      console.error("Analyze error", error);
      const message =
        error instanceof Error
          ? error.message
          : "Gagal memproses suara. Coba ulangi beberapa saat lagi.";
      alert(message);
    } finally {
      setAnalyzing(false);
    }
  }

  const progress = totalAyahs > 0 ? ((ayahIndex + 1) / totalAyahs) * 100 : 0;
  const displayWords = currentAyah?.text.split(/\s+/).filter(Boolean) ?? [];
  const wordStatusMap = new Map(
    (analysis?.expectedWordStatuses ?? []).map((item) => [item.displayIndex, item])
  );

  const getWordStyleByStatus = (status?: WordHighlightStatus) => {
    if (status === "correct") return st.wordCorrect;
    if (status === "partial") return st.wordPartial;
    if (status === "wrong") return st.wordWrong;
    if (status === "missing") return st.wordMissing;
    return st.wordNeutral;
  };

  return (
    <View style={st.container}>
      <View style={st.headerCard}>
        <Text style={st.title}>Ngaji AI</Text>
        <Text style={st.subtitle}>Pilih surah, rekam suara, lalu dapatkan analisis bacaan.</Text>

        <Pressable style={st.surahBtn} onPress={() => setPickerVisible(true)}>
          <FontAwesome name="book" size={14} color={Colors.primary} />
          <Text style={st.surahBtnText}>
            {selectedSurah
              ? `${selectedSurah.number}. ${selectedSurah.englishName}`
              : "Pilih Surah"}
          </Text>
          <FontAwesome name="chevron-down" size={12} color={Colors.textSecondary} />
        </Pressable>

        <View style={st.progressWrap}>
          <View style={st.progressTrack}>
            <View style={[st.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={st.progressLabel}>
            Ayat {currentAyah?.numberInSurah ?? 0} / {totalAyahs}
          </Text>
        </View>
      </View>

      {loadingSurahs || !surahDetail || !currentAyah ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <>
          <View style={st.ayahCard}>
            <View style={st.ayahHeaderRow}>
              <Text style={st.ayahLabel}>Teks Ayat (Mushaf Utsmani)</Text>
              <Text style={st.ayahSubLabel}>Highlight per-lafaz</Text>
            </View>

            {analysis ? (
              <View style={st.wordWrap}>
                {displayWords.map((word, idx) => {
                  const status = wordStatusMap.get(idx)?.status;
                  return (
                    <Text key={`word-${idx}`} style={[st.ayahWord, getWordStyleByStatus(status)]}>
                      {word}{" "}
                    </Text>
                  );
                })}
              </View>
            ) : (
              <Text style={st.ayahArabic}>{currentAyah.text}</Text>
            )}

            <View style={st.legendRow}>
              <View style={st.legendItem}>
                <View style={[st.legendDot, { backgroundColor: "#2E7D32" }]} />
                <Text style={st.legendText}>Benar</Text>
              </View>
              <View style={st.legendItem}>
                <View style={[st.legendDot, { backgroundColor: "#FFB300" }]} />
                <Text style={st.legendText}>Perlu perbaikan</Text>
              </View>
              <View style={st.legendItem}>
                <View style={[st.legendDot, { backgroundColor: "#D32F2F" }]} />
                <Text style={st.legendText}>Terlewat/salah</Text>
              </View>
            </View>
          </View>

          <View style={st.navRow}>
            <Pressable
              style={[st.navBtn, ayahIndex === 0 && st.navBtnDisabled]}
              disabled={ayahIndex === 0}
              onPress={() => {
                setAyahIndex((prev) => Math.max(0, prev - 1));
                setRecordingUri(null);
                setAnalysis(null);
              }}
            >
              <FontAwesome name="chevron-left" size={14} color={ayahIndex === 0 ? Colors.border : Colors.primary} />
            </Pressable>

            <Pressable
              style={[
                st.recordBtn,
                isRecording && { backgroundColor: "#FFEBEE", borderColor: Colors.error },
              ]}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <FontAwesome
                name={isRecording ? "stop" : "microphone"}
                size={22}
                color={isRecording ? Colors.error : "#fff"}
              />
              <Text style={[st.recordText, isRecording && { color: Colors.error }]}> 
                {isRecording ? "Stop" : recordingUri ? "Rekam Ulang" : "Rekam"}
              </Text>
            </Pressable>

            <Pressable
              style={[st.navBtn, ayahIndex >= totalAyahs - 1 && st.navBtnDisabled]}
              disabled={ayahIndex >= totalAyahs - 1}
              onPress={() => {
                setAyahIndex((prev) => Math.min(totalAyahs - 1, prev + 1));
                setRecordingUri(null);
                setAnalysis(null);
              }}
            >
              <FontAwesome
                name="chevron-right"
                size={14}
                color={ayahIndex >= totalAyahs - 1 ? Colors.border : Colors.primary}
              />
            </Pressable>
          </View>

          <Pressable
            style={[st.analyzeBtn, (!recordingUri || analyzing) && st.analyzeBtnDisabled]}
            disabled={!recordingUri || analyzing}
            onPress={runAnalysis}
          >
            {analyzing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="magic" size={14} color="#fff" />
                <Text style={st.analyzeText}>Analisis Bacaan</Text>
              </>
            )}
          </Pressable>

          {analysis ? (
            <View style={st.resultCard}>
              <Text style={st.resultTitle}>Hasil Analisis</Text>
              <View style={st.scoreRow}>
                <View style={st.scoreItem}>
                  <Text style={st.scoreValue}>{analysis.score}</Text>
                  <Text style={st.scoreLabel}>Total</Text>
                </View>
                <View style={st.scoreItem}>
                  <Text style={st.scoreValue}>{analysis.pronunciationScore}</Text>
                  <Text style={st.scoreLabel}>Makharij</Text>
                </View>
                <View style={st.scoreItem}>
                  <Text style={st.scoreValue}>{analysis.tajwidScore}</Text>
                  <Text style={st.scoreLabel}>Tajwid</Text>
                </View>
                <View style={st.scoreItem}>
                  <Text style={st.scoreValue}>{analysis.fluencyScore}</Text>
                  <Text style={st.scoreLabel}>Kelancaran</Text>
                </View>
              </View>

              <Text style={st.smallTitle}>Transkripsi AI</Text>
              <Text style={st.transcriptText}>{analysis.transcript || "(kosong)"}</Text>

              <Text style={st.smallTitle}>Koreksi Utama</Text>
              {analysis.mistakes.length === 0 ? (
                <Text style={st.okText}>Tidak ada kesalahan signifikan terdeteksi.</Text>
              ) : (
                analysis.mistakes.map((m, idx) => (
                  <View key={`${m.wordIndex}-${idx}`} style={st.mistakeItem}>
                    <Text style={st.mistakeText}>{idx + 1}. {m.note}</Text>
                    <Text style={st.mistakeDetail}>
                      Target: {m.expected || "-"} | Terbaca: {m.recognized || "-"}
                    </Text>
                  </View>
                ))
              )}

              <View style={st.tipBox}>
                <FontAwesome name="lightbulb-o" size={14} color={Colors.warning} />
                <Text style={st.tipText}>{analysis.recommendation}</Text>
              </View>

              {analysis.extraWords.length > 0 ? (
                <View>
                  <Text style={st.smallTitle}>Lafaz Tambahan</Text>
                  {analysis.extraWords.map((item, idx) => (
                    <Text key={`extra-${idx}`} style={st.extraWordText}>
                      {idx + 1}. {item.recognized}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={st.modalContainer}>
          <View style={st.modalHeader}>
            <Text style={st.modalTitle}>Pilih Surah</Text>
            <Pressable onPress={() => setPickerVisible(false)}>
              <FontAwesome name="close" size={20} color={Colors.text} />
            </Pressable>
          </View>

          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Cari nama surah atau nomor"
            placeholderTextColor={Colors.textSecondary}
            style={st.searchInput}
          />

          <FlatList
            data={filteredSurahs}
            keyExtractor={(item) => String(item.number)}
            renderItem={({ item }) => (
              <Pressable
                style={st.surahItem}
                onPress={() => {
                  setSelectedSurah(item);
                  setPickerVisible(false);
                }}
              >
                <View style={st.surahNumberBadge}>
                  <Text style={st.surahNumberText}>{item.number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.surahName}>{item.englishName}</Text>
                  <Text style={st.surahMeta}>{item.englishNameTranslation} • {item.numberOfAyahs} ayat</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  surahBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  surahBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  progressWrap: {
    gap: 6,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  ayahCard: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 20,
    minHeight: 120,
    justifyContent: "center",
    gap: 8,
  },
  ayahHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  ayahLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  ayahSubLabel: {
    fontSize: 11,
    color: Colors.primary,
  },
  ayahArabic: {
    fontSize: 34,
    lineHeight: 58,
    textAlign: "center",
    color: Colors.primaryDark,
    writingDirection: "rtl",
    fontFamily: "AmiriQuran",
  },
  wordWrap: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "center",
    rowGap: 8,
    columnGap: 4,
  },
  ayahWord: {
    fontSize: 35,
    lineHeight: 58,
    writingDirection: "rtl",
    fontFamily: "AmiriQuran",
    paddingHorizontal: 2,
    borderRadius: 4,
  },
  wordNeutral: {
    color: Colors.primaryDark,
  },
  wordCorrect: {
    color: "#2E7D32",
  },
  wordPartial: {
    color: "#F57C00",
  },
  wordWrong: {
    color: "#D32F2F",
  },
  wordMissing: {
    color: "#D32F2F",
    textDecorationLine: "underline",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  navRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  navBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  recordBtn: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  recordText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  analyzeBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  analyzeBtnDisabled: {
    opacity: 0.5,
  },
  analyzeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  resultCard: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  scoreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  scoreItem: {
    flex: 1,
    minWidth: 70,
    borderRadius: 10,
    backgroundColor: "#F1F8E9",
    padding: 10,
    alignItems: "center",
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  scoreLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  smallTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  transcriptText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  okText: {
    fontSize: 13,
    color: Colors.success,
  },
  mistakeItem: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  mistakeText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: "600",
  },
  mistakeDetail: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  tipBox: {
    marginTop: 2,
    borderRadius: 10,
    backgroundColor: "#FFF8E1",
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: Colors.warning,
    fontWeight: "600",
  },
  extraWordText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 10,
  },
  surahItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  surahNumberBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  surahNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  surahName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },
  surahMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
