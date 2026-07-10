import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { useAction, useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Colors, QURAN_EDITION_ARABIC, QURAN_EDITION_AUDIO } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";
import { getSurahMultiEdition, SurahDetail } from "@/lib/alquran-api";

type WordHighlightStatus = "correct" | "partial" | "wrong" | "missing";

type LetterStatus = {
  letter: string;
  correct: boolean;
};

type WordStatusItem = {
  displayIndex: number;
  word: string;
  status: WordHighlightStatus;
  recognized: string;
  similarity: number;
  note: string;
  letters?: LetterStatus[];
};

type MistakeItem = {
  wordIndex: number;
  expected: string;
  recognized: string;
  type: string;
  note: string;
};

type ExtraWordItem = {
  recognized: string;
  atRecognizedIndex: number;
  note: string;
};

// Bentuk seragam untuk hasil analisis, baik yang baru dari AI maupun yang
// sudah tersimpan di Convex.
type DisplayResult = {
  score: number;
  pronunciationScore: number;
  tajwidScore: number;
  fluencyScore: number;
  transcript: string;
  wordStatuses: WordStatusItem[];
  mistakes: MistakeItem[];
  extraWords: ExtraWordItem[];
  recommendation: string;
  attemptCount?: number;
  bestScore?: number;
  saved: boolean;
};

type AnalyzeActionResult = Omit<
  DisplayResult,
  "wordStatuses" | "saved" | "attemptCount" | "bestScore"
> & {
  expectedWordStatuses: WordStatusItem[];
};

const STATUS_LABELS: Record<WordHighlightStatus, string> = {
  correct: "Benar",
  partial: "Perlu perbaikan",
  wrong: "Salah lafaz",
  missing: "Terlewat",
};

// Harakat/tanda baca Arab yang menempel pada huruf sebelumnya. Set yang sama
// dipakai backend saat normalisasi, sehingga jumlah klaster huruf tampilan
// selalu sama dengan jumlah huruf hasil analisis.
const ARABIC_MARKS = /[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/;

// Pecah satu kata tampilan (dengan harakat) menjadi klaster per huruf dasar.
function splitLetterClusters(word: string): string[] {
  const clusters: string[] = [];
  for (const ch of word) {
    if (ARABIC_MARKS.test(ch) && clusters.length > 0) {
      clusters[clusters.length - 1] += ch;
    } else if (!ARABIC_MARKS.test(ch)) {
      clusters.push(ch);
    }
  }
  return clusters;
}

// Transliterasi latin sederhana per huruf hijaiyah (gaya Indonesia).
const LETTER_LATIN: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "aa", "ٱ": "a", "ء": "'", "ؤ": "'u", "ئ": "'i",
  "ب": "b", "ت": "t", "ث": "ts", "ج": "j", "ح": "h", "خ": "kh",
  "د": "d", "ذ": "dz", "ر": "r", "ز": "z", "س": "s", "ش": "sy",
  "ص": "sh", "ض": "dh", "ط": "th", "ظ": "zh", "ع": "'", "غ": "gh",
  "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "و": "w", "ه": "h", "ة": "h", "ي": "y", "ى": "a",
};

// Perkiraan pelafalan satu klaster huruf (huruf dasar + harakatnya),
// misal "حِ" → "hi", "رَّ" → "rra".
function clusterPronunciation(cluster: string): string {
  const base = cluster[0] ?? "";
  let latin = LETTER_LATIN[base] ?? base;
  if (cluster.includes("ّ")) latin = latin + latin; // tasydid
  if (cluster.includes("َ")) return latin + "a"; // fathah
  if (cluster.includes("ِ")) return latin + "i"; // kasrah
  if (cluster.includes("ُ")) return latin + "u"; // dhammah
  if (cluster.includes("ً")) return latin + "an"; // fathatain
  if (cluster.includes("ٍ")) return latin + "in"; // kasratain
  if (cluster.includes("ٌ")) return latin + "un"; // dhammatain
  return latin;
}

export default function NgajiAiPracticeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData } = useAuthContext();
  const params = useLocalSearchParams<{ surahNumber: string }>();
  const surahNumber = Number(params.surahNumber);

  const [loading, setLoading] = useState(true);
  const [surahDetail, setSurahDetail] = useState<SurahDetail | null>(null);
  const [audioDetail, setAudioDetail] = useState<SurahDetail | null>(null);
  const [ayahIndex, setAyahIndex] = useState(0);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DisplayResult | null>(null);

  const [playingSource, setPlayingSource] = useState<"qari" | "me" | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const [showResultPanel, setShowResultPanel] = useState(false);
  const [wordDetail, setWordDetail] = useState<{
    item: WordStatusItem;
    displayWord: string;
  } | null>(null);

  const analyzeRecitation = useAction(api.ngajiAi.analyzeRecitation);
  const saveResult = useMutation(api.ngajiAi.saveResult);
  const savedResults = useQuery(
    api.ngajiAi.getSurahResults,
    userData?._id ? { userId: userData._id, surahNumber } : "skip"
  );

  useEffect(() => {
    if (!Number.isFinite(surahNumber)) return;
    (async () => {
      try {
        const [arabic, audio] = await getSurahMultiEdition(surahNumber, [
          QURAN_EDITION_ARABIC,
          QURAN_EDITION_AUDIO,
        ]);
        setSurahDetail(arabic);
        setAudioDetail(audio);
      } catch (error) {
        console.error("Failed to load surah", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [surahNumber]);

  // Bersihkan audio yang sedang diputar saat keluar layar.
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const savedMap = useMemo(() => {
    const map = new Map<number, DisplayResult>();
    (savedResults ?? []).forEach((doc: any) => {
      map.set(doc.ayahNumber, {
        score: doc.score,
        pronunciationScore: doc.pronunciationScore,
        tajwidScore: doc.tajwidScore,
        fluencyScore: doc.fluencyScore,
        transcript: doc.transcript,
        wordStatuses: doc.wordStatuses,
        mistakes: doc.mistakes,
        extraWords: doc.extraWords,
        recommendation: doc.recommendation,
        attemptCount: doc.attemptCount,
        bestScore: doc.bestScore,
        saved: true,
      });
    });
    return map;
  }, [savedResults]);

  const currentAyah = surahDetail?.ayahs[ayahIndex] ?? null;
  const totalAyahs = surahDetail?.ayahs.length ?? 0;
  const qariAudioUrl = audioDetail?.ayahs[ayahIndex]?.audio ?? null;

  const savedResult = currentAyah ? savedMap.get(currentAyah.numberInSurah) : undefined;
  // Analisis yang baru saja dilakukan menang atas hasil tersimpan.
  const currentResult = analysis ?? savedResult ?? null;

  const doneCount = savedMap.size;
  const allDone = totalAyahs > 0 && doneCount >= totalAyahs;
  const surahAvg = doneCount > 0
    ? Math.round(
        Array.from(savedMap.values()).reduce((acc, r) => acc + r.score, 0) / doneCount
      )
    : 0;

  function resetAyahState() {
    setAnalysis(null);
    setRecordingUri(null);
    setShowResultPanel(false);
    stopPlayback();
  }

  function goToAyah(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= totalAyahs) return;
    setAyahIndex(nextIndex);
    resetAyahState();
  }

  async function stopPlayback() {
    setPlayingSource(null);
    if (soundRef.current) {
      const sound = soundRef.current;
      soundRef.current = null;
      try {
        await sound.stopAsync();
      } catch {}
      sound.unloadAsync().catch(() => {});
    }
  }

  async function playAudio(uri: string, source: "qari" | "me") {
    if (playingSource === source) {
      await stopPlayback();
      return;
    }
    await stopPlayback();
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingSource(source);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingSource(null);
          soundRef.current = null;
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (error) {
      console.error("Playback error", error);
      setPlayingSource(null);
    }
  }

  async function startRecording() {
    try {
      await stopPlayback();
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
      setShowResultPanel(false);
    } catch (error) {
      console.error("Start recording error", error);
      alert("Gagal mulai rekam audio.");
    }
  }

  async function stopRecording() {
    if (!recording) return;

    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
      setRecordingUri(uri ?? null);
    } catch (error) {
      console.error("Stop recording error", error);
      alert("Gagal menyimpan rekaman.");
    } finally {
      setIsRecording(false);
      setRecording(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    }

    // Langsung analisis begitu rekaman selesai, seperti alur demo ngaji.ai.
    if (uri) {
      await runAnalysis(uri);
    }
  }

  // Di web hasil rekaman berupa blob: URI yang tidak bisa dibaca
  // expo-file-system, jadi konversi base64 lewat fetch + FileReader.
  async function uriToBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
    if (Platform.OS === "web") {
      const response = await fetch(uri);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca audio"));
        reader.readAsDataURL(blob);
      });
      const base64 = dataUrl.split(",")[1] ?? "";
      return { base64, mimeType: blob.type.split(";")[0] || "audio/webm" };
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const uriLower = uri.toLowerCase();
    const mimeType =
      uriLower.endsWith(".m4a") || uriLower.endsWith(".mp4")
        ? "audio/mp4"
        : uriLower.endsWith(".3gp")
          ? "audio/3gpp"
          : uriLower.endsWith(".webm")
            ? "audio/webm"
            : "audio/mp4";
    return { base64, mimeType };
  }

  async function runAnalysis(uri: string) {
    if (!surahDetail || !currentAyah) return;

    setAnalyzing(true);
    try {
      const { base64, mimeType } = await uriToBase64(uri);

      const result = (await analyzeRecitation({
        surahNumber,
        ayahNumber: currentAyah.numberInSurah,
        expectedText: currentAyah.text,
        audioBase64: base64,
        mimeType,
      })) as AnalyzeActionResult;

      const display: DisplayResult = {
        score: result.score,
        pronunciationScore: result.pronunciationScore,
        tajwidScore: result.tajwidScore,
        fluencyScore: result.fluencyScore,
        transcript: result.transcript,
        wordStatuses: result.expectedWordStatuses,
        mistakes: result.mistakes,
        extraWords: result.extraWords,
        recommendation: result.recommendation,
        attemptCount: (savedResult?.attemptCount ?? 0) + 1,
        bestScore: Math.max(savedResult?.bestScore ?? 0, result.score),
        saved: false,
      };
      setAnalysis(display);
      setShowResultPanel(true);

      if (userData?._id) {
        saveResult({
          userId: userData._id,
          surahNumber,
          ayahNumber: currentAyah.numberInSurah,
          totalAyahs,
          score: result.score,
          pronunciationScore: result.pronunciationScore,
          tajwidScore: result.tajwidScore,
          fluencyScore: result.fluencyScore,
          transcript: result.transcript,
          expectedText: currentAyah.text,
          wordStatuses: result.expectedWordStatuses,
          mistakes: result.mistakes,
          extraWords: result.extraWords,
          recommendation: result.recommendation,
        }).catch((error: unknown) => {
          console.error("Failed to save ngaji AI result", error);
        });
      }
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

  const displayWords = currentAyah?.text.split(/\s+/).filter(Boolean) ?? [];
  const wordStatusMap = useMemo(
    () =>
      new Map<number, WordStatusItem>(
        (currentResult?.wordStatuses ?? []).map((item) => [item.displayIndex, item])
      ),
    [currentResult]
  );

  const getWordStyleByStatus = (status?: WordHighlightStatus) => {
    if (status === "correct") return st.wordCorrect;
    if (status === "partial") return st.wordPartial;
    if (status === "wrong") return st.wordWrong;
    if (status === "missing") return st.wordMissing;
    return st.wordNeutral;
  };

  const scoreColor = (value: number) =>
    value >= 80 ? "#2E7D32" : value >= 60 ? "#F57C00" : "#D32F2F";

  const progress = totalAyahs > 0 ? ((ayahIndex + 1) / totalAyahs) * 100 : 0;

  if (loading || !surahDetail || !currentAyah) {
    return (
      <View style={[st.container, st.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={st.loadingText}>Memuat surah...</Text>
      </View>
    );
  }

  return (
    <View style={st.container}>
      {/* Header hijau ala demo ngaji.ai */}
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <View style={st.headerRow}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={16} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>{surahDetail.englishName}</Text>
            <Text style={st.headerSubtitle}>
              Ayat {currentAyah.numberInSurah} dari {totalAyahs}
            </Text>
          </View>
          <View style={st.doneBadge}>
            <FontAwesome name="check" size={11} color="#fff" />
            <Text style={st.doneBadgeText}>{doneCount}/{totalAyahs}</Text>
          </View>
        </View>
        <View style={st.progressTrack}>
          <View style={[st.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={st.scrollContent}>
        {allDone ? (
          <View style={st.completeBanner}>
            <FontAwesome name="trophy" size={18} color="#F9A825" />
            <Text style={st.completeText}>
              Semua ayat sudah dinilai! Rata-rata skor surah ini: {surahAvg}
            </Text>
          </View>
        ) : null}

        {/* Kartu ayat dengan highlight per kata */}
        <View style={st.ayahCard}>
          <View style={st.ayahHeaderRow}>
            <Text style={st.ayahLabel}>Mushaf Utsmani</Text>
            {currentResult ? (
              <View style={st.attemptChip}>
                <Text style={st.attemptChipText}>
                  Percobaan {currentResult.attemptCount ?? 1}
                  {currentResult.saved ? " • tersimpan" : ""}
                </Text>
              </View>
            ) : (
              <Text style={st.ayahSubLabel}>Rekam untuk mendapat koreksi</Text>
            )}
          </View>

          {currentResult ? (
            <View style={st.wordWrap}>
              {displayWords.map((word, idx) => {
                const item = wordStatusMap.get(idx);
                const clusters = splitLetterClusters(word);
                const letters =
                  item?.letters && item.letters.length === clusters.length
                    ? item.letters
                    : null;
                const hasIssue =
                  !!item &&
                  (item.status !== "correct" ||
                    (letters?.some((l) => !l.correct) ?? false));

                return (
                  <Pressable
                    key={`word-${idx}`}
                    disabled={!hasIssue}
                    onPress={() => item && setWordDetail({ item, displayWord: word })}
                  >
                    {letters && item?.status !== "missing" ? (
                      // Pewarnaan per huruf ala ngaji.ai: huruf benar hijau,
                      // huruf salah oranye. Span bersarang tetap menjaga
                      // sambungan huruf Arab.
                      <Text style={[st.ayahWord, st.wordNeutral]}>
                        {clusters.map((cluster, ci) => (
                          <Text
                            key={`c-${ci}`}
                            style={letters[ci].correct ? st.wordCorrect : st.wordPartial}
                          >
                            {cluster}
                          </Text>
                        ))}{" "}
                      </Text>
                    ) : (
                      <Text style={[st.ayahWord, getWordStyleByStatus(item?.status)]}>
                        {word}{" "}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={st.ayahArabic}>{currentAyah.text}</Text>
          )}

          {currentResult ? (
            <View style={st.legendRow}>
              <View style={st.legendItem}>
                <View style={[st.legendDot, { backgroundColor: "#2E7D32" }]} />
                <Text style={st.legendText}>Benar</Text>
              </View>
              <View style={st.legendItem}>
                <View style={[st.legendDot, { backgroundColor: "#F57C00" }]} />
                <Text style={st.legendText}>Perlu perbaikan</Text>
              </View>
              <View style={st.legendItem}>
                <View style={[st.legendDot, { backgroundColor: "#D32F2F" }]} />
                <Text style={st.legendText}>Terlewat/salah</Text>
              </View>
              <Text style={st.legendHint}>Ketuk kata berwarna untuk detail</Text>
            </View>
          ) : null}
        </View>

        {/* Baris aksi audio: qari referensi & rekaman sendiri */}
        <View style={st.audioRow}>
          {qariAudioUrl ? (
            <Pressable
              style={[st.audioBtn, playingSource === "qari" && st.audioBtnActive]}
              onPress={() => playAudio(qariAudioUrl, "qari")}
            >
              <FontAwesome
                name={playingSource === "qari" ? "stop" : "volume-up"}
                size={13}
                color={playingSource === "qari" ? "#fff" : Colors.primary}
              />
              <Text style={[st.audioBtnText, playingSource === "qari" && { color: "#fff" }]}>
                Contoh Qari
              </Text>
            </Pressable>
          ) : null}
          {recordingUri ? (
            <Pressable
              style={[st.audioBtn, playingSource === "me" && st.audioBtnActive]}
              onPress={() => playAudio(recordingUri, "me")}
            >
              <FontAwesome
                name={playingSource === "me" ? "stop" : "play"}
                size={13}
                color={playingSource === "me" ? "#fff" : Colors.primary}
              />
              <Text style={[st.audioBtnText, playingSource === "me" && { color: "#fff" }]}>
                Rekamanku
              </Text>
            </Pressable>
          ) : null}
          {currentResult ? (
            <Pressable
              style={[st.audioBtn, st.penilaianBtn]}
              onPress={() => setShowResultPanel((prev) => !prev)}
            >
              <FontAwesome name="star" size={13} color="#F9A825" />
              <Text style={st.audioBtnText}>
                Penilaian: <Text style={{ color: scoreColor(currentResult.score) }}>{currentResult.score}</Text>
              </Text>
              <FontAwesome
                name={showResultPanel ? "chevron-up" : "chevron-down"}
                size={10}
                color={Colors.textSecondary}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Panel hasil koreksi */}
        {showResultPanel && currentResult ? (
          <View style={st.resultCard}>
            <View style={st.resultHeaderRow}>
              <Text style={st.resultTitle}>Hasil Koreksi AI</Text>
              {currentResult.bestScore !== undefined ? (
                <Text style={st.bestScoreText}>Terbaik: {currentResult.bestScore}</Text>
              ) : null}
            </View>

            <View style={st.scoreRow}>
              <View style={[st.scoreItem, { backgroundColor: "#F1F8E9" }]}>
                <Text style={[st.scoreValue, { color: scoreColor(currentResult.score) }]}>
                  {currentResult.score}
                </Text>
                <Text style={st.scoreLabel}>Total</Text>
              </View>
              <View style={st.scoreItem}>
                <Text style={st.scoreValue}>{currentResult.pronunciationScore}</Text>
                <Text style={st.scoreLabel}>Makharij</Text>
              </View>
              <View style={st.scoreItem}>
                <Text style={st.scoreValue}>{currentResult.tajwidScore}</Text>
                <Text style={st.scoreLabel}>Tajwid</Text>
              </View>
              <View style={st.scoreItem}>
                <Text style={st.scoreValue}>{currentResult.fluencyScore}</Text>
                <Text style={st.scoreLabel}>Kelancaran</Text>
              </View>
            </View>

            <Text style={st.smallTitle}>Transkripsi AI</Text>
            <Text style={st.transcriptText}>{currentResult.transcript || "(kosong)"}</Text>

            <Text style={st.smallTitle}>Koreksi Utama</Text>
            {currentResult.mistakes.length === 0 ? (
              <Text style={st.okText}>Tidak ada kesalahan signifikan terdeteksi. Masya Allah!</Text>
            ) : (
              currentResult.mistakes.map((m, idx) => (
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
              <Text style={st.tipText}>{currentResult.recommendation}</Text>
            </View>

            <Pressable style={st.retryBtn} onPress={startRecording}>
              <FontAwesome name="refresh" size={13} color={Colors.primary} />
              <Text style={st.retryBtnText}>Rekam Ulang untuk Perbaiki</Text>
            </Pressable>
          </View>
        ) : null}

        {analyzing ? (
          <View style={st.analyzingBox}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={st.analyzingText}>AI sedang menganalisis bacaanmu...</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Kontrol bawah: navigasi ayat + tombol rekam */}
      <View style={[st.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[st.navBtn, ayahIndex === 0 && st.navBtnDisabled]}
          disabled={ayahIndex === 0 || isRecording}
          onPress={() => goToAyah(ayahIndex - 1)}
        >
          <FontAwesome
            name="chevron-left"
            size={15}
            color={ayahIndex === 0 ? Colors.border : Colors.primary}
          />
        </Pressable>

        <Pressable
          style={[st.recordBtn, isRecording && st.recordBtnActive]}
          disabled={analyzing}
          onPress={isRecording ? stopRecording : startRecording}
        >
          {analyzing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome
                name={isRecording ? "stop" : "microphone"}
                size={20}
                color="#fff"
              />
              <Text style={st.recordText}>
                {isRecording ? "Berhenti & Analisis" : currentResult ? "Rekam Ulang" : "Rekam"}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[st.navBtn, ayahIndex >= totalAyahs - 1 && st.navBtnDisabled]}
          disabled={ayahIndex >= totalAyahs - 1 || isRecording}
          onPress={() => goToAyah(ayahIndex + 1)}
        >
          <FontAwesome
            name="chevron-right"
            size={15}
            color={ayahIndex >= totalAyahs - 1 ? Colors.border : Colors.primary}
          />
        </Pressable>
      </View>

      {/* Detail koreksi per huruf, meniru modal demo ngaji.ai */}
      <Modal
        visible={wordDetail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setWordDetail(null)}
      >
        <Pressable style={st.modalOverlay} onPress={() => setWordDetail(null)}>
          <Pressable style={st.wordDetailCard} onPress={() => {}}>
            {wordDetail ? (() => {
              const { item, displayWord } = wordDetail;
              const clusters = splitLetterClusters(displayWord);
              const letters =
                item.letters && item.letters.length === clusters.length
                  ? item.letters
                  : null;
              const wrongIndexes = letters
                ? letters
                    .map((l, i) => (l.correct ? -1 : i))
                    .filter((i) => i >= 0)
                : [];

              return (
                <>
                  <View style={st.wordDetailHero}>
                    <View style={st.wordDetailWordBox}>
                      {letters ? (
                        <Text style={st.wordDetailArabic}>
                          {clusters.map((cluster, ci) => (
                            <Text
                              key={`dc-${ci}`}
                              style={
                                letters[ci].correct
                                  ? st.wordCorrect
                                  : st.wordPartial
                              }
                            >
                              {cluster}
                            </Text>
                          ))}
                        </Text>
                      ) : (
                        <Text style={[st.wordDetailArabic, st.wordPartial]}>
                          {displayWord}
                        </Text>
                      )}
                    </View>
                    <View style={st.wordDetailCountChip}>
                      <FontAwesome name="times-circle" size={14} color="#F57C00" />
                      <Text style={st.wordDetailCountText}>
                        {letters
                          ? `${wrongIndexes.length} dari ${clusters.length} huruf`
                          : STATUS_LABELS[item.status]}
                      </Text>
                    </View>
                  </View>

                  <ScrollView style={st.wordDetailBody}>
                    {letters && wrongIndexes.length > 0 ? (
                      wrongIndexes.map((ci) => (
                        <View key={`wrong-${ci}`} style={st.letterCard}>
                          <View style={st.letterCardTop}>
                            <View style={st.letterTile}>
                              <Text style={st.letterTileText}>
                                {clusters[ci]?.[0] ?? letters[ci].letter}
                              </Text>
                            </View>
                            <Text style={st.letterCardText}>
                              Pelafalan huruf ini belum tepat
                            </Text>
                          </View>
                          <View style={st.letterCorrectRow}>
                            <FontAwesome
                              name="check-circle"
                              size={16}
                              color={Colors.primary}
                            />
                            <Text style={st.letterCorrectText}>
                              Pelafalan yang benar adalah{" "}
                              <Text style={st.letterCorrectBold}>
                                {clusterPronunciation(clusters[ci])}
                              </Text>
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <View style={st.letterCard}>
                        <Text style={st.letterCardText}>{item.note}</Text>
                        {item.recognized ? (
                          <Text style={st.wordDetailRecognized}>
                            Terbaca oleh AI: {item.recognized}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </ScrollView>

                  <Pressable style={st.wordDetailClose} onPress={() => setWordDetail(null)}>
                    <Text style={st.wordDetailCloseText}>Tutup</Text>
                  </Pressable>
                </>
              );
            })() : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 1,
  },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  doneBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 999,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  completeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE082",
    padding: 12,
  },
  completeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#8D6E63",
  },
  ayahCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    minHeight: 140,
    justifyContent: "center",
    gap: 10,
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
  attemptChip: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  attemptChipText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  ayahArabic: {
    fontSize: 32,
    lineHeight: 56,
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
    fontSize: 33,
    lineHeight: 56,
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
    alignItems: "center",
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
  legendHint: {
    width: "100%",
    textAlign: "center",
    fontSize: 10.5,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  audioRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  audioBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  audioBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  audioBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: Colors.text,
  },
  penilaianBtn: {
    borderColor: "#FFE082",
    backgroundColor: "#FFFDE7",
  },
  resultCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  resultHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  bestScoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
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
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
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
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  analyzingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  analyzingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  navBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
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
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  recordBtnActive: {
    backgroundColor: Colors.error,
  },
  recordText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 28,
  },
  wordDetailCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    maxHeight: "80%",
  },
  wordDetailHero: {
    backgroundColor: "#F1F8E9",
    alignItems: "center",
    padding: 18,
    gap: 12,
  },
  wordDetailWordBox: {
    alignSelf: "stretch",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#F57C00",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  wordDetailArabic: {
    fontSize: 40,
    lineHeight: 72,
    color: Colors.primaryDark,
    fontFamily: "AmiriQuran",
    writingDirection: "rtl",
    textAlign: "center",
  },
  wordDetailCountChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F57C00",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  wordDetailCountText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#F57C00",
  },
  wordDetailBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  letterCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  letterCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  letterTile: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#F57C00",
    justifyContent: "center",
    alignItems: "center",
  },
  letterTileText: {
    fontSize: 24,
    lineHeight: 40,
    color: "#fff",
    fontFamily: "AmiriQuran",
  },
  letterCardText: {
    flex: 1,
    fontSize: 13.5,
    color: Colors.text,
  },
  letterCorrectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E8F5E9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  letterCorrectText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  letterCorrectBold: {
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  wordDetailRecognized: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  wordDetailClose: {
    margin: 16,
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    alignItems: "center",
  },
  wordDetailCloseText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
