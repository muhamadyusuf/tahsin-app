import React, { useEffect, useRef, useState } from "react";
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
  Animated,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthContext } from "@/lib/auth-context";
import { getJuzAyahs } from "@/lib/alquran-api";

// ============ THEME (dedicated dark emerald/gold "game" palette) ============
const T = {
  ink: "#0a201c",
  ink2: "#0f2c26",
  panel: "#123832",
  panel2: "#16453d",
  teal: "#1b4b43",
  tealLight: "#2f6b60",
  gold: "#c9a24b",
  goldBright: "#f0ce7c",
  goldDim: "#8a713a",
  parchment: "#f4ead0",
  parchment2: "#e9dcb8",
  crimson: "#c14f4f",
  emerald: "#57a374",
  text: "#f5efdd",
  textDim: "#a9c0b8",
  textDim2: "#7c948c",
};

const QUESTION_TIME = 15; // seconds
const MAX_LIVES = 3;
const COMBO_STEP = 3;
const MAX_MULTIPLIER = 5;

// Sound effects (Google's public "sounds library" — same host already used
// for the tap sound in app/(tabs)/tahsin.tsx and app/materi/[materiId].tsx)
const SOUND_TAP = "https://actions.google.com/sounds/v1/cartoon/pop.ogg";
const SOUND_CORRECT = "https://actions.google.com/sounds/v1/cartoon/instrument_strum.ogg";
const SOUND_WRONG = "https://actions.google.com/sounds/v1/cartoon/metal_twang.ogg";
const SOUND_GAMEOVER = "https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg";
const SOUND_TICK = "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
const SOUND_ENABLED_KEY = "sambungAyat_soundEnabled";

type JuzAyah = {
  text: string;
  ayahNumber: number;
  surahNumber: number;
  surahName: string;
};
type Choice = { ayah: JuzAyah; isCorrect: boolean };
type Stats = {
  score: number;
  combo: number;
  bestCombo: number;
  lives: number;
  correctCount: number;
  totalCount: number;
};
type GameScreen = "start" | "loading" | "playing" | "gameover";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildValidIndices(pool: JuzAyah[]): number[] {
  const valid: number[] = [];
  for (let i = 0; i < pool.length - 1; i++) {
    if (pool[i].surahNumber === pool[i + 1].surahNumber) valid.push(i);
  }
  return valid;
}

function pickDistractors(
  pool: JuzAyah[],
  correctText: string,
  promptText: string,
  count: number
): JuzAyah[] {
  const exclude = new Set([correctText, promptText]);
  const out: JuzAyah[] = [];
  let guard = 0;
  while (out.length < count && guard < 400) {
    guard++;
    const cand = pool[Math.floor(Math.random() * pool.length)];
    if (exclude.has(cand.text)) continue;
    exclude.add(cand.text);
    out.push(cand);
  }
  return out;
}

export default function SambungAyatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData } = useAuthContext();

  const myBest = useQuery(
    api.sambungAyat.getMyBest,
    userData?._id ? { userId: userData._id } : "skip"
  );
  const submitScore = useMutation(api.sambungAyat.submitScore);

  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const leaderboard = useQuery(
    api.sambungAyat.getLeaderboard,
    leaderboardVisible ? { limit: 20 } : "skip"
  );

  // ── sound effects ───────────────────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const soundCacheRef = useRef<Map<string, Audio.Sound>>(new Map());
  const warnPlayedRef = useRef(false);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
    AsyncStorage.getItem(SOUND_ENABLED_KEY).then((v) => {
      if (v === "0") {
        soundEnabledRef.current = false;
        setSoundEnabled(false);
      }
    });
  }, []);

  async function playSound(uri: string, volume = 0.7) {
    if (!soundEnabledRef.current) return;
    try {
      const cached = soundCacheRef.current.get(uri);
      if (cached) {
        await cached.replayAsync();
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume });
      soundCacheRef.current.set(uri, sound);
    } catch {
      // ignore sound failures — never block gameplay on audio issues
    }
  }

  function toggleSound() {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    AsyncStorage.setItem(SOUND_ENABLED_KEY, next ? "1" : "0").catch(() => {});
  }

  // ── setup / mode selection ─────────────────────────────────
  const [mode, setMode] = useState<"single" | "range">("single");
  const [startJuz, setStartJuz] = useState(30);
  const [endJuz, setEndJuz] = useState(30);
  const [howToOpen, setHowToOpen] = useState(false);

  useEffect(() => {
    if (mode === "single") setEndJuz(startJuz);
    else if (endJuz < startJuz) setEndJuz(startJuz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, startJuz]);

  // ── screen / loading state ─────────────────────────────────
  const [screen, setScreen] = useState<GameScreen>("start");
  const [loadingText, setLoadingText] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadAbortRef = useRef(false);
  const juzCacheRef = useRef<Map<number, JuzAyah[]>>(new Map());

  // ── game data ───────────────────────────────────────────────
  const poolRef = useRef<JuzAyah[]>([]);
  const validIdxRef = useRef<number[]>([]);
  const usedIdxRef = useRef<Set<number>>(new Set());
  const answeringRef = useRef(false);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [juzLabel, setJuzLabel] = useState("Juz 30");

  const [prompt, setPrompt] = useState<JuzAyah | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [answeredIdx, setAnsweredIdx] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);

  const statsRef = useRef<Stats>({
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: MAX_LIVES,
    correctCount: 0,
    totalCount: 0,
  });
  const [stats, setStats] = useState<Stats>(statsRef.current);
  const [submitResult, setSubmitResult] = useState<{
    isNewBest: boolean;
    previousBest: number;
  } | null>(null);

  function updateStats(patch: Partial<Stats>) {
    statsRef.current = { ...statsRef.current, ...patch };
    setStats(statsRef.current);
  }
  function resetStats() {
    statsRef.current = {
      score: 0,
      combo: 0,
      bestCombo: 0,
      lives: MAX_LIVES,
      correctCount: 0,
      totalCount: 0,
    };
    setStats(statsRef.current);
    setSubmitResult(null);
  }

  // ── feedback animations ────────────────────────────────────
  const comboScale = useRef(new Animated.Value(1)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState(T.emerald);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const [floatText, setFloatText] = useState<string | null>(null);

  function triggerComboPulse() {
    comboScale.setValue(1);
    Animated.sequence([
      Animated.timing(comboScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(comboScale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }
  function triggerShake() {
    shakeX.setValue(0);
    Animated.sequence(
      [-10, 10, -8, 8, -4, 4, 0].map((v) =>
        Animated.timing(shakeX, { toValue: v, duration: 40, useNativeDriver: true })
      )
    ).start();
  }
  function triggerFlash(kind: "correct" | "wrong") {
    setFlashColor(kind === "correct" ? T.emerald : T.crimson);
    flashOpacity.setValue(0.35);
    Animated.timing(flashOpacity, { toValue: 0, duration: 550, useNativeDriver: true }).start();
  }
  function spawnScoreFloat(points: number) {
    setFloatText("+" + points);
    floatAnim.setValue(0);
    Animated.timing(floatAnim, { toValue: 1, duration: 750, useNativeDriver: true }).start(() =>
      setFloatText(null)
    );
  }

  // ── data fetching ──────────────────────────────────────────
  async function fetchJuzCached(n: number): Promise<JuzAyah[]> {
    const cached = juzCacheRef.current.get(n);
    if (cached) return cached;
    const raw = await getJuzAyahs(n);
    const normalized: JuzAyah[] = raw.map((a) => ({
      text: a.text,
      ayahNumber: a.numberInSurah,
      surahNumber: a.surah.number,
      surahName: a.surah.englishName,
    }));
    juzCacheRef.current.set(n, normalized);
    return normalized;
  }

  async function loadRange(start: number, end: number): Promise<JuzAyah[] | null> {
    loadAbortRef.current = false;
    setLoadError(null);
    setScreen("loading");
    const total = end - start + 1;
    let combined: JuzAyah[] = [];
    for (let n = start; n <= end; n++) {
      if (loadAbortRef.current) return null;
      setLoadingText(`Memuat Juz ${n} dari rentang ${start}–${end}…`);
      setLoadingProgress(Math.round(((n - start) / total) * 100));
      try {
        const ayahs = await fetchJuzCached(n);
        combined = combined.concat(ayahs);
      } catch {
        setLoadError(`Gagal memuat Juz ${n}. Periksa koneksi internet Anda.`);
        return null;
      }
    }
    setLoadingProgress(100);
    return combined;
  }

  async function beginNewGame() {
    const start = Math.min(startJuz, endJuz);
    const end = Math.max(startJuz, endJuz);
    const pool = await loadRange(start, end);
    if (!pool) return;
    const valid = buildValidIndices(pool);
    if (valid.length < 3) {
      setLoadError("Rentang juz terlalu kecil untuk membuat soal. Pilih rentang yang lebih besar.");
      return;
    }
    poolRef.current = pool;
    validIdxRef.current = valid;
    usedIdxRef.current = new Set();
    resetStats();
    setJuzLabel(start === end ? `Juz ${start}` : `Juz ${start}-${end}`);
    setScreen("playing");
    newQuestion();
  }

  function pickQuestionIndex(): number {
    if (usedIdxRef.current.size >= validIdxRef.current.length) usedIdxRef.current.clear();
    let idx = 0;
    let tries = 0;
    do {
      idx = validIdxRef.current[Math.floor(Math.random() * validIdxRef.current.length)];
      tries++;
    } while (usedIdxRef.current.has(idx) && tries < 100);
    usedIdxRef.current.add(idx);
    return idx;
  }

  function newQuestion() {
    answeringRef.current = false;
    setAnsweredIdx(null);
    setFloatText(null);
    const qIdx = pickQuestionIndex();
    const promptAyah = poolRef.current[qIdx];
    const correctAyah = poolRef.current[qIdx + 1];
    setPrompt(promptAyah);
    const distractors = pickDistractors(poolRef.current, correctAyah.text, promptAyah.text, 3);
    const shuffled = shuffle<Choice>([
      { ayah: correctAyah, isCorrect: true },
      ...distractors.map((d) => ({ ayah: d, isCorrect: false })),
    ]);
    setChoices(shuffled);
    startTimer();
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }
  function startTimer() {
    clearTimer();
    setTimeLeft(QUESTION_TIME);
    warnPlayedRef.current = false;
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const remain = Math.max(0, QUESTION_TIME - elapsed);
      setTimeLeft(remain);
      if (!warnPlayedRef.current && remain / QUESTION_TIME <= 0.25) {
        warnPlayedRef.current = true;
        playSound(SOUND_TICK, 0.5);
      }
      if (remain <= 0) {
        clearTimer();
        onTimeUp();
      }
    }, 100);
  }

  function onTimeUp() {
    if (answeringRef.current) return;
    answeringRef.current = true;
    setAnsweredIdx(-1);
    registerWrong();
  }

  function selectAnswer(idx: number) {
    if (answeringRef.current) return;
    answeringRef.current = true;
    clearTimer();
    setAnsweredIdx(idx);
    const chosen = choices[idx];
    if (chosen.isCorrect) registerCorrect();
    else registerWrong();
  }

  function registerCorrect() {
    const mult = Math.min(1 + Math.floor(statsRef.current.combo / COMBO_STEP), MAX_MULTIPLIER);
    const timeBonus = Math.round((timeLeft / QUESTION_TIME) * 50);
    const points = Math.round((100 + timeBonus) * mult);
    const newCombo = statsRef.current.combo + 1;
    updateStats({
      score: statsRef.current.score + points,
      combo: newCombo,
      bestCombo: Math.max(statsRef.current.bestCombo, newCombo),
      correctCount: statsRef.current.correctCount + 1,
      totalCount: statsRef.current.totalCount + 1,
    });
    spawnScoreFloat(points);
    triggerComboPulse();
    triggerFlash("correct");
    playSound(SOUND_CORRECT);
    pendingTimeoutRef.current = setTimeout(() => newQuestion(), 950);
  }

  function registerWrong() {
    updateStats({
      combo: 0,
      lives: statsRef.current.lives - 1,
      totalCount: statsRef.current.totalCount + 1,
    });
    triggerFlash("wrong");
    triggerShake();
    playSound(SOUND_WRONG);
    if (statsRef.current.lives <= 0) {
      pendingTimeoutRef.current = setTimeout(() => endGame(), 900);
    } else {
      pendingTimeoutRef.current = setTimeout(() => newQuestion(), 1100);
    }
  }

  function endGame() {
    clearTimer();
    setScreen("gameover");
    setSubmitResult(null);
    playSound(SOUND_GAMEOVER);
    if (userData?._id) {
      submitScore({
        userId: userData._id,
        score: statsRef.current.score,
        correctCount: statsRef.current.correctCount,
        totalCount: statsRef.current.totalCount,
        bestCombo: statsRef.current.bestCombo,
        juzRange: juzLabel,
      })
        .then((res) => setSubmitResult(res))
        .catch(() => {});
    }
  }

  function restartGame() {
    usedIdxRef.current = new Set();
    resetStats();
    setScreen("playing");
    newQuestion();
  }

  function goToMenu() {
    clearTimer();
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    setScreen("start");
  }

  useEffect(
    () => () => {
      clearTimer();
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      soundCacheRef.current.forEach((s) => s.unloadAsync().catch(() => {}));
    },
    []
  );

  function handleBack() {
    if (screen === "playing" || screen === "loading") {
      const msg = "Keluar dari permainan? Progres saat ini akan hilang.";
      if (Platform.OS === "web") {
        if (window.confirm(msg)) {
          goToMenu();
          router.back();
        }
      } else {
        Alert.alert("Keluar Permainan", msg, [
          { text: "Batal", style: "cancel" },
          {
            text: "Keluar",
            style: "destructive",
            onPress: () => {
              goToMenu();
              router.back();
            },
          },
        ]);
      }
      return;
    }
    router.back();
  }

  const timeFrac = timeLeft / QUESTION_TIME;
  const multiplier = Math.min(1 + Math.floor(stats.combo / COMBO_STEP), MAX_MULTIPLIER);

  return (
    <View style={styles.root}>
      {/* ===== Header ===== */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.push("/")} style={styles.headerBtn}>
          <FontAwesome name="arrow-left" size={18} color={T.textDim} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sambung Ayat</Text>
        <View style={styles.headerRightGroup}>
          <TouchableOpacity onPress={toggleSound} style={styles.headerBtn}>
            <FontAwesome
              name={soundEnabled ? "volume-up" : "volume-off"}
              size={17}
              color={T.textDim}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setLeaderboardVisible(true)}
            style={styles.headerBtn}
          >
            <FontAwesome name="trophy" size={18} color={T.goldBright} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== START ===== */}
      {screen === "start" && (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.startContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.eyebrow}>UJI HAFALAN AL-QUR'AN</Text>
            <Text style={styles.titleAr}>سِبَاقُ الْحِفْظِ</Text>
            <Text style={styles.titleLat}>Sambung Ayat</Text>
            <Text style={styles.subtitle}>
              Bacalah satu ayat, lalu kenali sambungannya. Mushaf Utsmani, standar penomoran resmi.
            </Text>

            {userData && (
              <View style={styles.bestRow}>
                <View style={styles.bestChip}>
                  <FontAwesome name="star" size={12} color={T.goldBright} />
                  <Text style={styles.bestChipText}>
                    Skor Terbaikmu: {myBest ? myBest.score : 0}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerDot}>{"◆"}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.panelSelect}>
              <Text style={styles.panelLabel}>PILIH RENTANG JUZ</Text>
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === "single" && styles.modeBtnActive]}
                  onPress={() => setMode("single")}
                >
                  <Text style={[styles.modeBtnText, mode === "single" && styles.modeBtnTextActive]}>
                    Satu Juz
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === "range" && styles.modeBtnActive]}
                  onPress={() => setMode("range")}
                >
                  <Text style={[styles.modeBtnText, mode === "range" && styles.modeBtnTextActive]}>
                    Rentang Juz
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.stepperRow}>
                <JuzStepper
                  label={mode === "range" ? "Dari Juz" : "Juz"}
                  value={startJuz}
                  onChange={(v) => setStartJuz(Math.max(1, Math.min(30, v)))}
                />
                {mode === "range" && (
                  <JuzStepper
                    label="Sampai Juz"
                    value={endJuz}
                    onChange={(v) => setEndJuz(Math.max(startJuz, Math.min(30, v)))}
                  />
                )}
              </View>
              <Text style={styles.hintText}>
                Pilihan default: Juz 30 (Juz 'Amma) — ringkas dan cocok untuk pemanasan hafalan.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => {
                playSound(SOUND_TAP);
                beginNewGame();
              }}
            >
              <Text style={styles.ctaBtnText}>{"▶"} Mulai Bermain</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => setLeaderboardVisible(true)}
            >
              <Text style={styles.ghostBtnText}>{"🏆"} Papan Skor Tertinggi</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setHowToOpen((v) => !v)} style={styles.howToToggle}>
              <Text style={styles.howToToggleText}>
                {howToOpen ? "Sembunyikan cara bermain" : "Cara bermain"}
              </Text>
            </TouchableOpacity>
            {howToOpen && (
              <View style={styles.howToBox}>
                <Text style={styles.howToText}>1. Sebuah ayat akan ditampilkan di kartu utama.</Text>
                <Text style={styles.howToText}>
                  2. Pilih ayat yang benar-benar menyambung tepat setelahnya, dari 4 pilihan.
                </Text>
                <Text style={styles.howToText}>
                  3. Jawaban cepat &amp; benar beruntun menaikkan pengali skor (combo). Jawaban salah
                  mengurangi nyawa.
                </Text>
                <Text style={styles.howToText}>
                  4. Permainan berakhir saat nyawa habis. Kumpulkan skor tertinggi!
                </Text>
              </View>
            )}

            <Text style={styles.sourceNote}>
              Teks Arab menggunakan mushaf Utsmani (Uthmani script) dari Al Quran Cloud API —
              bersumber dari proyek Tanzil yang telah diverifikasi dan lazim dipakai aplikasi
              Qur'an. Penomoran surah/ayat mengikuti standar mushaf.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ===== LOADING ===== */}
      {screen === "loading" && (
        <View style={styles.center}>
          {!loadError ? (
            <>
              <ActivityIndicator size="large" color={T.goldBright} />
              <Text style={styles.loadText}>{loadingText || "Memuat ayat…"}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${loadingProgress}%` }]} />
              </View>
            </>
          ) : (
            <>
              <FontAwesome name="exclamation-circle" size={36} color={T.crimson} />
              <Text style={styles.loadErrorText}>{loadError}</Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={beginNewGame}>
                <Text style={styles.ctaBtnText}>Coba Lagi</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => {
              loadAbortRef.current = true;
              setScreen("start");
            }}
          >
            <Text style={styles.ghostBtnText}>Batal</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ===== PLAYING ===== */}
      {screen === "playing" && prompt && (
        <View style={styles.gameWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.flashOverlay, { backgroundColor: flashColor, opacity: flashOpacity }]}
          />

          <View style={styles.topbar}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{juzLabel}</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={{ position: "relative" }}>
              <Text style={styles.statLabel}>SKOR</Text>
              <Text style={styles.scoreValue}>{stats.score}</Text>
              {floatText && (
                <Animated.Text
                  style={[
                    styles.scoreFloat,
                    {
                      opacity: floatAnim.interpolate({
                        inputRange: [0, 0.7, 1],
                        outputRange: [1, 1, 0],
                      }),
                      transform: [
                        {
                          translateY: floatAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -30],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {floatText}
                </Animated.Text>
              )}
            </View>
            <Animated.View style={[styles.comboBadge, { transform: [{ scale: comboScale }] }]}>
              <Text style={styles.comboBadgeText}>{"×"}{multiplier}</Text>
            </Animated.View>
            <View style={styles.livesRow}>
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <View key={i} style={[styles.lifeDot, i >= stats.lives && styles.lifeDotLost]} />
              ))}
            </View>
          </View>

          <View style={styles.timerTrack}>
            <View
              style={[
                styles.timerFill,
                { width: `${Math.max(0, timeFrac) * 100}%` },
                timeFrac <= 0.25 && styles.timerFillWarn,
              ]}
            />
          </View>

          <Animated.View style={[styles.ayahCard, { transform: [{ translateX: shakeX }] }]}>
            <View style={styles.ayahBadge}>
              <Text style={styles.ayahBadgeText} numberOfLines={1}>
                {prompt.surahName} {"•"} Ayat {prompt.ayahNumber}
              </Text>
            </View>
            <ScrollView style={styles.ayahScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.ayahText}>{prompt.text}</Text>
            </ScrollView>
          </Animated.View>

          <Text style={styles.continueLabel}>
            {"◈"} Lanjutan ayat yang tepat adalah… {"◈"}
          </Text>

          <View style={styles.answers}>
            {choices.map((choice, i) => {
              const revealed = answeredIdx !== null;
              const isChosenWrong = revealed && i === answeredIdx && !choice.isCorrect;
              const isCorrectCard = revealed && choice.isCorrect;
              const isDim = revealed && !isCorrectCard && !isChosenWrong;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.answerCard,
                    isCorrectCard && styles.answerCorrect,
                    isChosenWrong && styles.answerWrong,
                    isDim && styles.answerDim,
                  ]}
                  activeOpacity={0.85}
                  disabled={revealed}
                  onPress={() => selectAnswer(i)}
                >
                  <View style={styles.answerNum}>
                    <Text style={styles.answerNumText}>{i + 1}</Text>
                  </View>
                  <ScrollView style={styles.answerScroll} showsVerticalScrollIndicator={false}>
                    <Text style={styles.answerText}>{choice.ayah.text}</Text>
                  </ScrollView>
                  {revealed && (
                    <Text style={styles.answerRef} numberOfLines={1}>
                      {choice.ayah.surahName} {"•"} Ayat {choice.ayah.ayahNumber}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ===== GAME OVER ===== */}
      {screen === "gameover" && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.startContent}>
          <View style={styles.card}>
            <FontAwesome name="flag-checkered" size={40} color={T.goldBright} />
            <Text style={styles.resultTitle}>Permainan Berakhir</Text>
            <Text style={styles.subtitle}>Nyawa habis — lihat hasil Anda di bawah.</Text>
            <Text style={styles.resultScore}>{stats.score}</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxNum}>{stats.correctCount}</Text>
                <Text style={styles.statBoxLbl}>Benar</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxNum}>
                  {stats.totalCount ? Math.round((stats.correctCount / stats.totalCount) * 100) : 0}%
                </Text>
                <Text style={styles.statBoxLbl}>Akurasi</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxNum}>{"×"}{stats.bestCombo}</Text>
                <Text style={styles.statBoxLbl}>Combo Terbaik</Text>
              </View>
            </View>

            {submitResult?.isNewBest && (
              <View style={styles.newHighBadge}>
                <FontAwesome name="star" size={13} color={T.goldBright} />
                <Text style={styles.newHighText}>Skor tertinggi baru!</Text>
              </View>
            )}
            {!userData && (
              <Text style={styles.hintText}>Masuk akun untuk menyimpan skor ke papan peringkat.</Text>
            )}

            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => {
                playSound(SOUND_TAP);
                restartGame();
              }}
            >
              <Text style={styles.ctaBtnText}>{"⟲"} Main Lagi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={goToMenu}>
              <Text style={styles.ghostBtnText}>{"☰"} Menu Utama</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => setLeaderboardVisible(true)}
            >
              <Text style={styles.ghostBtnText}>{"🏆"} Lihat Papan Skor</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ===== LEADERBOARD MODAL ===== */}
      <Modal
        visible={leaderboardVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLeaderboardVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { marginBottom: insets.bottom + 20 }]}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setLeaderboardVisible(false)}
            >
              <FontAwesome name="times" size={18} color={T.textDim} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{"🏆"} Skor Tertinggi</Text>
            <Text style={styles.subtitle}>Peringkat santri se-aplikasi</Text>

            {leaderboard === undefined ? (
              <ActivityIndicator color={T.goldBright} style={{ marginTop: 20 }} />
            ) : leaderboard.length === 0 ? (
              <Text style={styles.hsEmpty}>Belum ada skor. Jadilah yang pertama!</Text>
            ) : (
              <ScrollView style={styles.hsList} showsVerticalScrollIndicator={false}>
                {leaderboard.map((row, i) => {
                  const isMe = userData?._id === row.userId;
                  return (
                    <View
                      key={row._id}
                      style={[styles.hsRow, isMe && styles.hsRowMe]}
                    >
                      <Text style={styles.hsRank}>{i + 1}</Text>
                      {row.avatarUrl ? (
                        <Image source={{ uri: row.avatarUrl }} style={styles.hsAvatar} />
                      ) : (
                        <View style={styles.hsAvatarFallback}>
                          <FontAwesome name="user" size={13} color={T.textDim2} />
                        </View>
                      )}
                      <View style={styles.hsNameCol}>
                        <Text style={styles.hsName} numberOfLines={1}>
                          {row.name}
                          {isMe ? " (Kamu)" : ""}
                        </Text>
                        <Text style={styles.hsMeta}>{row.juzRange}</Text>
                      </View>
                      <Text style={styles.hsScore}>{row.score}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function JuzStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepperField}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControl}>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(value - 1)}>
          <FontAwesome name="minus" size={12} color={T.goldBright} />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>Juz {value}</Text>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(value + 1)}>
          <FontAwesome name="plus" size={12} color={T.goldBright} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.ink },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, padding: 24 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerRightGroup: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff12",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { color: T.text, fontSize: 16, fontWeight: "800" },

  // ── start screen ──
  startContent: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  card: {
    backgroundColor: T.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffffff14",
    padding: 24,
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: T.gold,
    fontWeight: "800",
    marginBottom: 8,
  },
  titleAr: { fontSize: 30, color: T.goldBright, fontFamily: "Amiri", writingDirection: "rtl" },
  titleLat: { fontSize: 24, fontWeight: "800", color: T.text, marginTop: 2 },
  subtitle: {
    fontSize: 13.5,
    color: T.textDim,
    marginTop: 8,
    lineHeight: 20,
    textAlign: "center",
  },
  bestRow: { marginTop: 14 },
  bestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff10",
    borderWidth: 1,
    borderColor: "#ffffff1a",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
  },
  bestChipText: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    marginTop: 22,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#c9a24b55" },
  dividerDot: { color: T.goldDim, fontSize: 12 },

  panelSelect: { width: "100%", marginTop: 18 },
  panelLabel: {
    fontSize: 11.5,
    letterSpacing: 1.2,
    color: T.gold,
    fontWeight: "800",
    marginBottom: 10,
  },
  modeToggle: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#00000040",
    padding: 5,
    borderRadius: 12,
    marginBottom: 14,
  },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  modeBtnActive: { backgroundColor: T.gold },
  modeBtnText: { color: T.textDim, fontWeight: "700", fontSize: 13 },
  modeBtnTextActive: { color: "#241c09" },

  stepperRow: { flexDirection: "row", gap: 10 },
  stepperField: { flex: 1 },
  stepperLabel: { fontSize: 11, color: T.textDim2, marginBottom: 6 },
  stepperControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#08211ccc",
    borderWidth: 1,
    borderColor: "#ffffff22",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ffffff14",
    justifyContent: "center",
    alignItems: "center",
  },
  stepperValue: { color: T.text, fontWeight: "700", fontSize: 13 },
  hintText: { fontSize: 11.5, color: T.textDim2, marginTop: 10, lineHeight: 17, textAlign: "center" },

  ctaBtn: {
    width: "100%",
    backgroundColor: T.goldBright,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 22,
  },
  ctaBtnText: { color: "#22190a", fontWeight: "800", fontSize: 16 },
  ghostBtn: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ffffff2a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  ghostBtnText: { color: T.textDim, fontWeight: "700", fontSize: 14 },

  howToToggle: { marginTop: 16 },
  howToToggleText: { fontSize: 12.5, color: T.textDim2, textDecorationLine: "underline" },
  howToBox: { marginTop: 10, gap: 6, width: "100%" },
  howToText: { fontSize: 12.5, color: T.textDim, lineHeight: 19, textAlign: "left" },
  sourceNote: { fontSize: 10.5, color: T.textDim2, lineHeight: 16, marginTop: 18, textAlign: "center" },

  // ── loading ──
  loadText: { fontSize: 14, color: T.textDim, textAlign: "center" },
  progressTrack: {
    width: 220,
    height: 6,
    borderRadius: 6,
    backgroundColor: "#ffffff14",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: T.goldBright },
  loadErrorText: { fontSize: 13, color: "#e08b8b", textAlign: "center", lineHeight: 19 },

  // ── playing ──
  gameWrap: { flex: 1, paddingHorizontal: 14, paddingTop: 6, gap: 12 },
  flashOverlay: { position: "absolute", top: -100, left: -100, right: -100, bottom: -100 },
  topbar: { flexDirection: "row", justifyContent: "space-between" },
  chip: {
    backgroundColor: "#ffffff10",
    borderWidth: 1,
    borderColor: "#ffffff1a",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
  },
  chipText: { color: T.textDim, fontSize: 12, fontWeight: "700" },

  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statLabel: { fontSize: 10, letterSpacing: 1, color: T.textDim2, fontWeight: "700" },
  scoreValue: { fontSize: 24, fontWeight: "900", color: T.goldBright },
  scoreFloat: {
    position: "absolute",
    left: 60,
    top: -4,
    fontWeight: "900",
    fontSize: 18,
    color: T.goldBright,
  },
  comboBadge: {
    backgroundColor: T.goldBright,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  comboBadgeText: { color: "#1b140a", fontWeight: "800", fontSize: 13 },
  livesRow: { flexDirection: "row", gap: 5 },
  lifeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: T.goldBright,
  },
  lifeDotLost: { backgroundColor: "#3a3a3a", opacity: 0.5 },

  timerTrack: { height: 7, borderRadius: 6, backgroundColor: "#ffffff14", overflow: "hidden" },
  timerFill: { height: "100%", backgroundColor: T.emerald, borderRadius: 6 },
  timerFillWarn: { backgroundColor: T.crimson },

  ayahCard: {
    backgroundColor: T.parchment,
    borderRadius: 20,
    padding: 22,
    minHeight: 140,
    maxHeight: 220,
    justifyContent: "center",
  },
  ayahBadge: {
    alignSelf: "center",
    backgroundColor: "#00000010",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 10,
    maxWidth: "90%",
  },
  ayahBadgeText: { fontSize: 11, fontWeight: "700", color: T.goldDim },
  ayahScroll: { maxHeight: 160 },
  ayahText: {
    fontSize: 24,
    lineHeight: 46,
    textAlign: "center",
    color: "#241c0c",
    fontFamily: "AmiriQuran",
    writingDirection: "rtl",
  },

  continueLabel: { textAlign: "center", fontSize: 12, color: T.textDim, fontWeight: "600" },

  answers: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  answerCard: {
    width: "47.5%",
    flexGrow: 1,
    borderRadius: 14,
    padding: 12,
    paddingTop: 16,
    backgroundColor: "#ffffff0d",
    borderWidth: 1,
    borderColor: "#ffffff1c",
  },
  answerCorrect: { backgroundColor: "#2c5a41", borderColor: "#7fd3a3" },
  answerWrong: { backgroundColor: "#5c2b2b", borderColor: "#e59f9f" },
  answerDim: { opacity: 0.4 },
  answerNum: {
    position: "absolute",
    top: 8,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#00000030",
    justifyContent: "center",
    alignItems: "center",
  },
  answerNumText: { color: T.gold, fontSize: 11, fontWeight: "800" },
  answerScroll: { maxHeight: 90 },
  answerText: {
    fontSize: 17,
    lineHeight: 32,
    textAlign: "center",
    color: T.text,
    fontFamily: "AmiriQuran",
    writingDirection: "rtl",
  },
  answerRef: { fontSize: 10, color: T.textDim2, textAlign: "center", marginTop: 6 },

  // ── result ──
  resultTitle: { fontSize: 20, fontWeight: "800", color: T.text, marginTop: 10 },
  resultScore: { fontSize: 40, fontWeight: "900", color: T.goldBright, marginTop: 8 },
  statsGrid: { flexDirection: "row", gap: 8, marginTop: 18, width: "100%" },
  statBox: {
    flex: 1,
    backgroundColor: "#ffffff0d",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  statBoxNum: { fontSize: 18, fontWeight: "900", color: T.goldBright },
  statBoxLbl: { fontSize: 10, color: T.textDim2, marginTop: 3, textTransform: "uppercase" },
  newHighBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
  },
  newHighText: { color: T.goldBright, fontWeight: "700", fontSize: 12.5 },

  // ── leaderboard modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "#050f0dcc",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    backgroundColor: T.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ffffff14",
    padding: 24,
  },
  modalClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffffff12",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  modalTitle: { fontSize: 19, fontWeight: "800", color: T.text, textAlign: "center" },
  hsEmpty: { textAlign: "center", color: T.textDim2, fontSize: 13, marginTop: 24 },
  hsList: { marginTop: 16 },
  hsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff10",
  },
  hsRowMe: {
    backgroundColor: "#c9a24b1a",
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  hsRank: { width: 20, textAlign: "center", fontWeight: "900", color: T.gold, fontSize: 13 },
  hsAvatar: { width: 28, height: 28, borderRadius: 14 },
  hsAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffff14",
    justifyContent: "center",
    alignItems: "center",
  },
  hsNameCol: { flex: 1 },
  hsName: { fontWeight: "700", color: T.text, fontSize: 13 },
  hsMeta: { fontSize: 10.5, color: T.textDim2, marginTop: 1 },
  hsScore: { fontWeight: "900", color: T.goldBright, fontSize: 14 },
});
