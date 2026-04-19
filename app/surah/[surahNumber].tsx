import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Switch,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Colors, AUDIO_EDITIONS } from "@/lib/constants";
import {
  getSurahByEdition,
  getSurahMultiEdition,
  SurahDetail,
} from "@/lib/alquran-api";
import {
  getTajwidInfo,
  colorizeArabicText,
  TajwidRule,
  TAJWID_RULES,
  ColoredSegment,
} from "@/lib/tajwid";

// Available Arabic editions
const ARABIC_EDITIONS = [
  { id: "quran-uthmani", label: "Uthmani (Madinah)" },
  { id: "quran-simple", label: "Simple (Tanpa Tashkil)" },
  { id: "quran-simple-enhanced", label: "Simple Enhanced" },
  { id: "quran-simple-clean", label: "Simple Clean" },
];

// Available translation editions (Indonesian-related)
const TRANSLATION_EDITIONS = [
  { id: "id.indonesian", label: "Bahasa Indonesia" },
  { id: "id.muntakhab", label: "Tafsir Muntakhab" },
];

// Available tafsir editions
const TAFSIR_EDITIONS = [
  { id: "id.jalalayn", label: "Tafsir Jalalayn" },
];

// Regex to match bismillah prefix (same as MushafView)
const BISMILLAH_RE =
  /^\uFEFF?\u0628\p{M}*\u0633\p{M}*\u0645\p{M}*\s+[\u0627\u0671]\p{M}*\u0644\p{M}*\u0644\p{M}*\u0647\p{M}*\s+[\u0627\u0671]\p{M}*\u0644\p{M}*\u0631\p{M}*\u062d\p{M}*\u0645\p{M}*[\u0640\u0670]?\p{M}*\u0646\p{M}*\s+[\u0627\u0671]\p{M}*\u0644\p{M}*\u0631\p{M}*\u062d\p{M}*\u064a\p{M}*\u0645\p{M}*\s*/u;

function stripBismillah(text: string): string {
  return text.replace(BISMILLAH_RE, "");
}

// Repeat count options
const REPEAT_OPTIONS = [1, 2, 3, 5, 10];

interface AyahCombined {
  numberInSurah: number;
  arabic: string;
  coloredSegments: ColoredSegment[];
  translation?: string;
  tafsir?: string;
  tajwidRules: TajwidRule[];
  audioUrl?: string;
}

export default function SurahDetailScreen() {
  const { surahNumber, surahName } = useLocalSearchParams<{
    surahNumber: string;
    surahName: string;
  }>();
  const num = parseInt(surahNumber, 10);

  // Data state
  const [loading, setLoading] = useState(true);
  const [surahInfo, setSurahInfo] = useState<SurahDetail | null>(null);
  const [ayahs, setAyahs] = useState<AyahCombined[]>([]);

  // Settings
  const [arabicEdition, setArabicEdition] = useState("quran-uthmani");
  const [translationEdition, setTranslationEdition] =
    useState("id.indonesian");
  const [tafsirEdition, setTafsirEdition] = useState("id.jalalayn");
  const [showTranslation, setShowTranslation] = useState(true);
  const [showTafsir, setShowTafsir] = useState(false);
  const [showTajwid, setShowTajwid] = useState(true);
  const [audioEdition, setAudioEdition] = useState("ar.alafasy");
  const [repeatCount, setRepeatCount] = useState(1);

  // Modals
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tajwidModalVisible, setTajwidModalVisible] = useState(false);
  const [legendVisible, setLegendVisible] = useState(false);
  const [selectedAyahTajwid, setSelectedAyahTajwid] = useState<TajwidRule[]>(
    []
  );

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);

  // Audio refs
  const soundRef = useRef<Audio.Sound | null>(null);
  const isPlayingAllRef = useRef(false);
  const audioUrlsRef = useRef<Record<number, string>>({});
  const totalAyahsRef = useRef(0);
  const repeatCountRef = useRef(1);
  const currentRepeatRef = useRef(0);

  // Configure audio mode
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  }, []);

  // Keep repeatCountRef in sync
  useEffect(() => {
    repeatCountRef.current = repeatCount;
  }, [repeatCount]);

  // Load audio URLs
  useEffect(() => {
    setAudioLoaded(false);
    stopAudio();
    (async () => {
      try {
        const audioData = await getSurahByEdition(num, audioEdition);
        const urls: Record<number, string> = {};
        audioData.ayahs.forEach((a) => {
          if (a.audio) urls[a.numberInSurah] = a.audio;
        });
        audioUrlsRef.current = urls;
        totalAyahsRef.current = audioData.numberOfAyahs;
        setAudioLoaded(true);
      } catch (e) {
        console.error("Failed to load audio URLs:", e);
      }
    })();
  }, [num, audioEdition]);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const loadSurah = useCallback(async () => {
    setLoading(true);
    try {
      const editions = [arabicEdition];
      if (showTranslation) editions.push(translationEdition);
      if (showTafsir) editions.push(tafsirEdition);

      let arabicData: SurahDetail;
      let translationData: SurahDetail | null = null;
      let tafsirData: SurahDetail | null = null;

      if (editions.length === 1) {
        arabicData = await getSurahByEdition(num, arabicEdition);
      } else {
        const results = await getSurahMultiEdition(num, editions);
        arabicData = results[0];
        if (showTranslation && results[1]) translationData = results[1];
        if (showTafsir) {
          tafsirData = showTranslation ? results[2] ?? null : results[1] ?? null;
        }
      }

      setSurahInfo(arabicData);

      const combined: AyahCombined[] = arabicData.ayahs.map((ayah, idx) => {
        // Strip bismillah from first ayah (except Al-Fatihah #1 and At-Tawbah #9)
        const shouldStrip = ayah.numberInSurah === 1 && num !== 1 && num !== 9;
        const arabicText = shouldStrip ? stripBismillah(ayah.text) : ayah.text;
        return {
          numberInSurah: ayah.numberInSurah,
          arabic: arabicText,
          coloredSegments: colorizeArabicText(arabicText),
          translation: translationData?.ayahs[idx]?.text,
          tafsir: tafsirData?.ayahs[idx]?.text,
          tajwidRules: getTajwidInfo(arabicText),
          audioUrl: audioUrlsRef.current[ayah.numberInSurah],
        };
      });

      setAyahs(combined);
    } catch (error) {
      console.error("Failed to load surah:", error);
    } finally {
      setLoading(false);
    }
  }, [
    num,
    arabicEdition,
    translationEdition,
    tafsirEdition,
    showTranslation,
    showTafsir,
  ]);

  useEffect(() => {
    loadSurah();
  }, [loadSurah]);

  // ===== AUDIO FUNCTIONS =====

  async function playAyah(numberInSurah: number, isRepeat = false) {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    const url = audioUrlsRef.current[numberInSurah];
    if (!url) return;

    // Reset repeat counter when starting a new ayah (not a repeat)
    if (!isRepeat) {
      currentRepeatRef.current = 0;
    }

    setPlayingAyah(numberInSurah);
    setIsPlaying(true);

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          currentRepeatRef.current += 1;

          // Check if we need to repeat this ayah
          if (currentRepeatRef.current < repeatCountRef.current) {
            playAyah(numberInSurah, true);
            return;
          }

          setIsPlaying(false);
          setPlayingAyah(null);

          if (isPlayingAllRef.current) {
            const next = numberInSurah + 1;
            if (next <= totalAyahsRef.current) {
              playAyah(next);
            } else {
              isPlayingAllRef.current = false;
              setIsPlayingAll(false);
            }
          }
        }
      });
    } catch (e) {
      console.error("Audio playback error:", e);
      setIsPlaying(false);
      setPlayingAyah(null);
    }
  }

  async function stopAudio() {
    isPlayingAllRef.current = false;
    setIsPlayingAll(false);
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsPlaying(false);
    setPlayingAyah(null);
  }

  async function togglePlayPause(numberInSurah: number) {
    if (playingAyah === numberInSurah && isPlaying) {
      await soundRef.current?.pauseAsync();
      setIsPlaying(false);
    } else if (playingAyah === numberInSurah && !isPlaying) {
      await soundRef.current?.playAsync();
      setIsPlaying(true);
    } else {
      isPlayingAllRef.current = false;
      setIsPlayingAll(false);
      playAyah(numberInSurah);
    }
  }

  function playAllFromStart() {
    isPlayingAllRef.current = true;
    setIsPlayingAll(true);
    playAyah(1);
  }

  function playAllFromAyah(numberInSurah: number) {
    isPlayingAllRef.current = true;
    setIsPlayingAll(true);
    playAyah(numberInSurah);
  }

  const openTajwidDetail = (rules: TajwidRule[]) => {
    setSelectedAyahTajwid(rules);
    setTajwidModalVisible(true);
  };

  const renderAyah = ({ item }: { item: AyahCombined }) => {
    const isCurrentAyah = playingAyah === item.numberInSurah;
    const isThisPlaying = isCurrentAyah && isPlaying;

    return (
      <View
        style={[styles.ayahCard, isCurrentAyah && styles.ayahCardPlaying]}
      >
        {/* Header: Number + Audio + Tajwid */}
        <View style={styles.ayahHeader}>
          <View style={styles.ayahHeaderLeft}>
            <View style={styles.ayahBadge}>
              <Text style={styles.ayahBadgeText}>{item.numberInSurah}</Text>
            </View>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => togglePlayPause(item.numberInSurah)}
            >
              <FontAwesome
                name={isThisPlaying ? "pause" : "play"}
                size={12}
                color={Colors.primary}
              />
            </TouchableOpacity>
            {!isPlayingAll && (
              <TouchableOpacity
                style={styles.playFromButton}
                onPress={() => playAllFromAyah(item.numberInSurah)}
              >
                <FontAwesome name="forward" size={10} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          {showTajwid && item.tajwidRules.length > 0 && (
            <TouchableOpacity
              style={styles.tajwidButton}
              onPress={() => openTajwidDetail(item.tajwidRules)}
            >
              <FontAwesome
                name="info-circle"
                size={14}
                color={Colors.primary}
              />
              <Text style={styles.tajwidButtonText}>Tajwid</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Arabic Text with inline tajwid colors */}
        <Text style={styles.arabicText}>
          {showTajwid
            ? item.coloredSegments.map((seg, i) => (
                <Text
                  key={i}
                  style={seg.color ? { color: seg.color } : undefined}
                >
                  {seg.text}
                </Text>
              ))
            : item.arabic}
        </Text>

        {/* Translation */}
        {showTranslation && item.translation && (
          <View style={styles.translationContainer}>
            <Text style={styles.translationLabel}>Terjemah</Text>
            <Text style={styles.translationText}>{item.translation}</Text>
          </View>
        )}

        {/* Tafsir */}
        {showTafsir && item.tafsir && (
          <View style={styles.tafsirContainer}>
            <Text style={styles.tafsirLabel}>Tafsir</Text>
            <Text style={styles.tafsirText}>{item.tafsir}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.surahHeader}>
      <Text style={styles.surahArabicName}>{surahInfo?.name}</Text>
      <Text style={styles.surahEnglishName}>
        {surahInfo?.englishName} — {surahInfo?.englishNameTranslation}
      </Text>
      <Text style={styles.surahMeta}>
        {surahInfo?.revelationType === "Meccan" ? "Makkiyah" : "Madaniyah"} •{" "}
        {surahInfo?.numberOfAyahs} Ayat
      </Text>

      {/* Bismillah (except At-Taubah) */}
      {num !== 9 && (
        <View style={styles.bismillah}>
          <Text style={styles.bismillahText}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</Text>
        </View>
      )}

      {/* Audio controls */}
      <View style={styles.surahAudioRow}>
        {audioLoaded ? (
          <>
            <TouchableOpacity
              style={styles.surahPlayAllBtn}
              onPress={isPlayingAll ? stopAudio : playAllFromStart}
            >
              <FontAwesome
                name={isPlayingAll ? "stop" : "play"}
                size={14}
                color={Colors.textLight}
              />
              <Text style={styles.surahPlayAllText}>
                {isPlayingAll ? "Stop" : "Putar Semua"}
              </Text>
            </TouchableOpacity>
            {isPlayingAll && playingAyah && (
              <Text style={styles.surahNowPlaying}>
                Ayat {playingAyah} / {surahInfo?.numberOfAyahs}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.surahAudioLoading}>Memuat audio...</Text>
        )}
      </View>

      {/* Tajwid color legend */}
      {showTajwid && (
        <TouchableOpacity
          style={styles.legendButton}
          onPress={() => setLegendVisible(true)}
        >
          <FontAwesome name="paint-brush" size={12} color={Colors.textLight} />
          <Text style={styles.legendButtonText}>Keterangan Warna Tajwid</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // === Settings Modal ===
  const renderSettingsModal = () => (
    <Modal
      visible={settingsVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setSettingsVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pengaturan Tampilan</Text>
            <TouchableOpacity onPress={() => setSettingsVisible(false)}>
              <FontAwesome name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* --- Arabic Edition --- */}
            <Text style={styles.settingSection}>Jenis Al-Qur'an</Text>
            {ARABIC_EDITIONS.map((ed) => (
              <TouchableOpacity
                key={ed.id}
                style={[
                  styles.editionOption,
                  arabicEdition === ed.id && styles.editionSelected,
                ]}
                onPress={() => setArabicEdition(ed.id)}
              >
                <Text
                  style={[
                    styles.editionLabel,
                    arabicEdition === ed.id && styles.editionLabelSelected,
                  ]}
                >
                  {ed.label}
                </Text>
                {arabicEdition === ed.id && (
                  <FontAwesome
                    name="check"
                    size={16}
                    color={Colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}

            {/* --- Toggle Terjemah --- */}
            <Text style={styles.settingSection}>Terjemah</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Tampilkan Terjemah</Text>
              <Switch
                value={showTranslation}
                onValueChange={setShowTranslation}
                trackColor={{ true: Colors.primary, false: Colors.border }}
                thumbColor={Colors.surface}
              />
            </View>
            {showTranslation && (
              <>
                {TRANSLATION_EDITIONS.map((ed) => (
                  <TouchableOpacity
                    key={ed.id}
                    style={[
                      styles.editionOption,
                      translationEdition === ed.id && styles.editionSelected,
                    ]}
                    onPress={() => setTranslationEdition(ed.id)}
                  >
                    <Text
                      style={[
                        styles.editionLabel,
                        translationEdition === ed.id &&
                          styles.editionLabelSelected,
                      ]}
                    >
                      {ed.label}
                    </Text>
                    {translationEdition === ed.id && (
                      <FontAwesome
                        name="check"
                        size={16}
                        color={Colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* --- Toggle Tafsir --- */}
            <Text style={styles.settingSection}>Tafsir</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Tampilkan Tafsir</Text>
              <Switch
                value={showTafsir}
                onValueChange={setShowTafsir}
                trackColor={{ true: Colors.primary, false: Colors.border }}
                thumbColor={Colors.surface}
              />
            </View>
            {showTafsir && (
              <>
                {TAFSIR_EDITIONS.map((ed) => (
                  <TouchableOpacity
                    key={ed.id}
                    style={[
                      styles.editionOption,
                      tafsirEdition === ed.id && styles.editionSelected,
                    ]}
                    onPress={() => setTafsirEdition(ed.id)}
                  >
                    <Text
                      style={[
                        styles.editionLabel,
                        tafsirEdition === ed.id && styles.editionLabelSelected,
                      ]}
                    >
                      {ed.label}
                    </Text>
                    {tafsirEdition === ed.id && (
                      <FontAwesome
                        name="check"
                        size={16}
                        color={Colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* --- Toggle Tajwid --- */}
            <Text style={styles.settingSection}>Hukum Bacaan (Tajwid)</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Tampilkan Tajwid</Text>
              <Switch
                value={showTajwid}
                onValueChange={setShowTajwid}
                trackColor={{ true: Colors.primary, false: Colors.border }}
                thumbColor={Colors.surface}
              />
            </View>

            {/* --- Audio / Qari Edition --- */}
            <Text style={styles.settingSection}>Pengisi Suara (Qari)</Text>
            {AUDIO_EDITIONS.map((ed) => (
              <TouchableOpacity
                key={ed.id}
                style={[
                  styles.editionOption,
                  audioEdition === ed.id && styles.editionSelected,
                ]}
                onPress={() => setAudioEdition(ed.id)}
              >
                <Text
                  style={[
                    styles.editionLabel,
                    audioEdition === ed.id && styles.editionLabelSelected,
                  ]}
                >
                  {ed.label}
                </Text>
                {audioEdition === ed.id && (
                  <FontAwesome
                    name="check"
                    size={16}
                    color={Colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}

            {/* --- Repeat Count --- */}
            <Text style={styles.settingSection}>Perulangan Audio</Text>
            <Text style={styles.repeatHint}>Jumlah pengulangan per ayat</Text>
            <View style={styles.repeatRow}>
              {REPEAT_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.repeatChip,
                    repeatCount === n && styles.repeatChipSelected,
                  ]}
                  onPress={() => setRepeatCount(n)}
                >
                  <Text
                    style={[
                      styles.repeatChipText,
                      repeatCount === n && styles.repeatChipTextSelected,
                    ]}
                  >
                    {n}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Apply button */}
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setSettingsVisible(false)}
            >
              <Text style={styles.applyButtonText}>Terapkan</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // === Tajwid Detail Modal ===
  const renderTajwidModal = () => (
    <Modal
      visible={tajwidModalVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setTajwidModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.tajwidModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Hukum Bacaan (Tajwid)</Text>
            <TouchableOpacity onPress={() => setTajwidModalVisible(false)}>
              <FontAwesome name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedAyahTajwid.map((rule) => (
              <View key={rule.name} style={styles.tajwidDetailCard}>
                <View style={styles.tajwidDetailHeader}>
                  <View
                    style={[
                      styles.tajwidColorBar,
                      { backgroundColor: rule.color },
                    ]}
                  />
                  <View style={styles.tajwidDetailNames}>
                    <Text style={styles.tajwidDetailName}>{rule.name}</Text>
                    <Text style={styles.tajwidDetailArabic}>
                      {rule.arabic}
                    </Text>
                  </View>
                </View>
                <Text style={styles.tajwidDetailDesc}>
                  {rule.description}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // === Tajwid Legend Modal ===
  const renderLegendModal = () => (
    <Modal
      visible={legendVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setLegendVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.tajwidModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Keterangan Warna Tajwid</Text>
            <TouchableOpacity onPress={() => setLegendVisible(false)}>
              <FontAwesome name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {Object.values(TAJWID_RULES).map((rule) => (
              <View key={rule.name} style={styles.legendRow}>
                <View
                  style={[styles.legendSwatch, { backgroundColor: rule.color }]}
                />
                <View style={styles.legendInfo}>
                  <Text style={styles.legendName}>
                    {rule.name}{" "}
                    <Text style={styles.legendArabic}>{rule.arabic}</Text>
                  </Text>
                  <Text style={styles.legendDesc}>{rule.description}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{ title: surahName ?? `Surah ${surahNumber}` }}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat surah...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: surahName ?? surahInfo?.englishName ?? `Surah ${surahNumber}`,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setSettingsVisible(true)}
              style={styles.headerButton}
            >
              <FontAwesome name="sliders" size={20} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        data={ayahs}
        renderItem={renderAyah}
        keyExtractor={(item) => item.numberInSurah.toString()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
      />

      {/* Floating audio bar */}
      {isPlaying && playingAyah !== null && (
        <View style={styles.floatingBar}>
          <View style={styles.floatingBarLeft}>
            <FontAwesome name="volume-up" size={16} color={Colors.textLight} />
            <Text style={styles.floatingBarText}>
              {isPlayingAll ? "Putar Semua \u2014 " : ""}Ayat {playingAyah}
            </Text>
          </View>
          <View style={styles.floatingBarRight}>
            <TouchableOpacity
              onPress={() => togglePlayPause(playingAyah)}
              style={styles.floatingBarBtn}
            >
              <FontAwesome
                name={isPlaying ? "pause" : "play"}
                size={16}
                color={Colors.textLight}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={stopAudio} style={styles.floatingBarBtn}>
              <FontAwesome name="stop" size={16} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {renderSettingsModal()}
      {renderTajwidModal()}
      {renderLegendModal()}
    </>
  );
}

const styles = StyleSheet.create({
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
  headerButton: {
    padding: 8,
  },
  list: {
    paddingBottom: 120,
    backgroundColor: Colors.background,
  },

  // Surah header
  surahHeader: {
    backgroundColor: Colors.primary,
    padding: 24,
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 8,
  },
  surahArabicName: {
    fontFamily: "Amiri",
    fontSize: 32,
    color: Colors.textLight,
    marginBottom: 8,
  },
  surahEnglishName: {
    fontSize: 16,
    color: Colors.textLight,
    opacity: 0.9,
  },
  surahMeta: {
    fontSize: 13,
    color: Colors.textLight,
    opacity: 0.7,
    marginTop: 4,
  },
  bismillah: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bismillahText: {
    fontFamily: "AmiriQuran",
    fontSize: 22,
    color: Colors.textLight,
    textAlign: "center",
  },

  // Audio row in header
  surahAudioRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 12,
  },
  surahPlayAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  surahPlayAllText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: "600",
  },
  surahNowPlaying: {
    color: Colors.textLight,
    fontSize: 13,
    opacity: 0.8,
  },
  surahAudioLoading: {
    color: Colors.textLight,
    fontSize: 12,
    opacity: 0.6,
  },

  // Legend button
  legendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  legendButtonText: {
    color: Colors.textLight,
    fontSize: 12,
    fontWeight: "500",
  },

  // Ayah card
  ayahCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  ayahCardPlaying: {
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  ayahHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ayahHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ayahBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  ayahBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.primaryDark,
  },
  playButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  playFromButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  tajwidButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
  },
  tajwidButtonText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600",
  },

  // Arabic
  arabicText: {
    fontFamily: "AmiriQuran",
    fontSize: 26,
    lineHeight: 52,
    color: Colors.text,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 12,
  },

  // Translation
  translationContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  translationLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  translationText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
  },

  // Tafsir
  tafsirContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    marginTop: 12,
  },
  tafsirLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.secondary,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tafsirText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },

  // Settings Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
  },
  settingSection: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  editionOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    backgroundColor: Colors.background,
    marginBottom: 6,
  },
  editionSelected: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  editionLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  editionLabelSelected: {
    fontWeight: "600",
    color: Colors.primaryDark,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  switchLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: Platform.OS === "ios" ? 24 : 8,
  },
  applyButtonText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: "bold",
  },
  repeatHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  repeatRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  repeatChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  repeatChipSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  repeatChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  repeatChipTextSelected: {
    color: Colors.primaryDark,
  },

  // Tajwid Modal
  tajwidModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "70%",
  },
  tajwidDetailCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  tajwidDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tajwidColorBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  tajwidDetailNames: {
    flex: 1,
  },
  tajwidDetailName: {
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.text,
  },
  tajwidDetailArabic: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tajwidDetailDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },

  // Floating audio bar
  floatingBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primaryDark,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === "ios" ? 30 : 14,
  },
  floatingBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  floatingBarText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: "500",
  },
  floatingBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  floatingBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Legend modal
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  legendSwatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 12,
  },
  legendInfo: {
    flex: 1,
  },
  legendName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  legendArabic: {
    fontWeight: "400",
    color: Colors.textSecondary,
  },
  legendDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
