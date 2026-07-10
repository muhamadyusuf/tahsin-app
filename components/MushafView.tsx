import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
  FlatList,
  Platform,
  StatusBar,
  TextInput,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import {
  Colors,
  QURAN_API_BASE,
  QURAN_EDITION_AUDIO,
  QURAN_EDITION_TRANSLATION,
  AUDIO_EDITIONS,
  getDisplayWidth,
  WEB_MAX_WIDTH,
} from "@/lib/constants";
import { getPageData, PageData, PageAyah } from "@/lib/alquran-api";
import { colorizeArabicText, TAJWID_RULES } from "@/lib/tajwid";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthContext } from "@/lib/auth-context";
import ConfirmModal from "@/components/ConfirmModal";

const COVER_PAGE = 0;
const DESKTOP_BREAKPOINT = 900;

const TOTAL_PAGES = 604;
const BOOKMARKS_KEY = "mushaf_bookmarks";
const TAFSIR_EDITION = "id.jalalayn";
const REPEAT_OPTIONS = [1, 2, 3, 5, 10];
const SWIPE_THRESHOLD = 70;
const SWIPE_ANIM_MS = 180;
const FLOATING_TOOLBAR_H = 64; // approx height of the floating glass toolbar pill
const SCREEN_WIDTH = getDisplayWidth();

// Regex to match bismillah prefix with any diacritics ordering (quran-uthmani)
// Matches: بسم الله الرحمن الرحيم — base consonants with any combining marks
const BISMILLAH_RE =
  /^\uFEFF?\u0628\p{M}*\u0633\p{M}*\u0645\p{M}*\s+[\u0627\u0671]\p{M}*\u0644\p{M}*\u0644\p{M}*\u0647\p{M}*\s+[\u0627\u0671]\p{M}*\u0644\p{M}*\u0631\p{M}*\u062d\p{M}*\u0645\p{M}*[\u0640\u0670]?\p{M}*\u0646\p{M}*\s+[\u0627\u0671]\p{M}*\u0644\p{M}*\u0631\p{M}*\u062d\p{M}*\u064a\p{M}*\u0645\p{M}*\s*/u;

function stripBismillah(text: string): string {
  return text.replace(BISMILLAH_RE, "");
}

// Mushaf-specific colors (green Quran theme)
const M = {
  pageBg: "#FFF8E7",
  border: "#2E7D32",
  headerBg: "#E8F5E9",
  toolbarBg: "#E8F5E9",
  toolbarText: "#1B5E20",
  surahDecor: "#2E7D32",
  surahBg: "#F1F8E9",
  ayahMarker: "#6D4C41",
  text: "#1A1A1A",
  bookmark: "#E91E63",
  hizb: "#FF8F00",
};

function toArabicNumeral(n: number): string {
  const d = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return n
    .toString()
    .split("")
    .map((c) => d[parseInt(c)])
    .join("");
}

/** Convert hizbQuarter to display info */
function getHizbInfo(hizbQuarter: number): {
  hizb: number;
  quarter: number;
  label: string;
  arabicLabel: string;
} {
  const hizb = Math.ceil(hizbQuarter / 4);
  const quarter = ((hizbQuarter - 1) % 4) + 1;
  const qLabels = ["", "¼", "½", "¾"];
  const label =
    quarter === 1
      ? `Hizb ${hizb}`
      : `Hizb ${hizb} ${qLabels[quarter - 1]}`;
  const arabicLabel =
    quarter === 1
      ? `الحزب ${toArabicNumeral(hizb)}`
      : `الحزب ${toArabicNumeral(hizb)} ${qLabels[quarter - 1]}`;
  return { hizb, quarter, label, arabicLabel };
}

/** Convert juz number to Arabic ordinal label */
function getJuzArabicLabel(juzNum: number): string {
  const ordinals: Record<number, string> = {
    1: "الجُزْءُ الْأَوَّلُ",
    2: "الجُزْءُ الثَّانِي",
    3: "الجُزْءُ الثَّالِثُ",
    4: "الجُزْءُ الرَّابِعُ",
    5: "الجُزْءُ الْخَامِسُ",
    6: "الجُزْءُ السَّادِسُ",
    7: "الجُزْءُ السَّابِعُ",
    8: "الجُزْءُ الثَّامِنُ",
    9: "الجُزْءُ التَّاسِعُ",
    10: "الجُزْءُ الْعَاشِرُ",
    11: "الجُزْءُ الْحَادِي عَشَرَ",
    12: "الجُزْءُ الثَّانِي عَشَرَ",
    13: "الجُزْءُ الثَّالِثَ عَشَرَ",
    14: "الجُزْءُ الرَّابِعَ عَشَرَ",
    15: "الجُزْءُ الْخَامِسَ عَشَرَ",
    16: "الجُزْءُ السَّادِسَ عَشَرَ",
    17: "الجُزْءُ السَّابِعَ عَشَرَ",
    18: "الجُزْءُ الثَّامِنَ عَشَرَ",
    19: "الجُزْءُ التَّاسِعَ عَشَرَ",
    20: "الجُزْءُ الْعِشْرُونَ",
    21: "الجُزْءُ الْحَادِي وَالْعِشْرُونَ",
    22: "الجُزْءُ الثَّانِي وَالْعِشْرُونَ",
    23: "الجُزْءُ الثَّالِثُ وَالْعِشْرُونَ",
    24: "الجُزْءُ الرَّابِعُ وَالْعِشْرُونَ",
    25: "الجُزْءُ الْخَامِسُ وَالْعِشْرُونَ",
    26: "الجُزْءُ السَّادِسُ وَالْعِشْرُونَ",
    27: "الجُزْءُ السَّابِعُ وَالْعِشْرُونَ",
    28: "الجُزْءُ الثَّامِنُ وَالْعِشْرُونَ",
    29: "الجُزْءُ التَّاسِعُ وَالْعِشْرُونَ",
    30: "الجُزْءُ الثَّلَاثُونَ",
  };
  return ordinals[juzNum] ?? `الجُزْءُ ${toArabicNumeral(juzNum)}`;
}

/** Ornamental surah-divider banner — double border + corner jewels + double
 * hairline side rules, echoing the decorative surah headers of a printed
 * Uthmani mushaf. */
function SurahHeaderBanner({ name, fontSize }: { name: string; fontSize: number }) {
  return (
    <View style={s.surahBannerRow}>
      <View style={s.surahBannerSide}>
        <View style={s.surahBannerSideLine} />
      </View>
      <View style={s.surahBannerBoxOuter}>
        <View style={s.surahBannerBoxInner}>
          <Text style={[s.surahNameText, { fontSize }]}>{name}</Text>
        </View>
        <View style={[s.surahBannerCorner, s.surahBannerCornerTL]} />
        <View style={[s.surahBannerCorner, s.surahBannerCornerTR]} />
        <View style={[s.surahBannerCorner, s.surahBannerCornerBL]} />
        <View style={[s.surahBannerCorner, s.surahBannerCornerBR]} />
      </View>
      <View style={s.surahBannerSide}>
        <View style={s.surahBannerSideLine} />
      </View>
    </View>
  );
}

interface SurahGroup {
  surahNumber: number;
  surahName: string;
  startsNewSurah: boolean;
  ayahs: PageAyah[];
}

function groupBySurah(ayahs: PageAyah[]): SurahGroup[] {
  const groups: SurahGroup[] = [];
  let cur: SurahGroup | null = null;
  for (const a of ayahs) {
    if (!cur || cur.surahNumber !== a.surah.number) {
      cur = {
        surahNumber: a.surah.number,
        surahName: a.surah.name,
        startsNewSurah: a.numberInSurah === 1,
        ayahs: [a],
      };
      groups.push(cur);
    } else {
      cur.ayahs.push(a);
    }
  }
  return groups;
}

interface Bookmark {
  page: number;
  surahName: string;
  timestamp: number;
}

interface SelectedAyah {
  ayah: PageAyah;
  idx: number; // index in page's ayah array for audio
}

interface PageTranslation {
  number: number;
  surahNumber: number;
  surahName: string;
  numberInSurah: number;
  text: string;
}

/** One word/token from the quran.com word-level API — carries exact line number */
interface MushafWord {
  id: number;
  charType: "word" | "end";
  textUthmani: string;
  lineNumber: number;
  verseKey: string;   // e.g. "2:6"
  surahNumber: number;
  verseNumber: number; // numberInSurah
}

interface Props {
  initialPage?: number;
}

// Standard Uthmani mushaf: surah number → starting page
const SURAH_PAGE: Record<number, number> = {
  1:1,2:2,3:50,4:77,5:106,6:128,7:151,8:177,9:187,10:208,11:221,12:235,13:249,
  14:255,15:262,16:267,17:282,18:293,19:305,20:312,21:322,22:332,23:342,24:350,
  25:359,26:367,27:377,28:385,29:396,30:404,31:411,32:415,33:418,34:428,35:434,
  36:440,37:446,38:453,39:458,40:467,41:477,42:483,43:489,44:496,45:499,46:502,
  47:507,48:511,49:515,50:518,51:520,52:523,53:526,54:528,55:531,56:534,57:537,
  58:542,59:545,60:549,61:551,62:553,63:554,64:556,65:558,66:560,67:562,68:564,
  69:566,70:568,71:570,72:572,73:574,74:575,75:577,76:578,77:580,78:582,79:583,
  80:585,81:586,82:587,83:587,84:589,85:590,86:591,87:591,88:592,89:593,90:594,
  91:595,92:595,93:596,94:596,95:597,96:597,97:598,98:598,99:599,100:599,101:600,
  102:600,103:601,104:601,105:601,106:602,107:602,108:602,109:603,110:603,111:603,
  112:604,113:604,114:604,
};

// Surah metadata for main index
export const SURAH_META: { num: number; name: string; english: string; arti: string; type: string; ayahs: number }[] = [
  { num: 1, name: "سُورَةُ ٱلْفَاتِحَةِ", english: "Al-Fatihah", arti: "Pembukaan", type: "Makkiyah", ayahs: 7 },
  { num: 2, name: "سُورَةُ ٱلْبَقَرَةِ", english: "Al-Baqarah", arti: "Sapi Betina", type: "Madaniyah", ayahs: 286 },
  { num: 3, name: "سُورَةُ آلِ عِمْرَانَ", english: "Ali 'Imran", arti: "Keluarga Imran", type: "Madaniyah", ayahs: 200 },
  { num: 4, name: "سُورَةُ ٱلنِّسَاءِ", english: "An-Nisa'", arti: "Perempuan", type: "Madaniyah", ayahs: 176 },
  { num: 5, name: "سُورَةُ ٱلْمَائِدَةِ", english: "Al-Ma'idah", arti: "Hidangan", type: "Madaniyah", ayahs: 120 },
  { num: 6, name: "سُورَةُ ٱلْأَنْعَامِ", english: "Al-An'am", arti: "Binatang Ternak", type: "Makkiyah", ayahs: 165 },
  { num: 7, name: "سُورَةُ ٱلْأَعْرَافِ", english: "Al-A'raf", arti: "Tempat Tertinggi", type: "Makkiyah", ayahs: 206 },
  { num: 8, name: "سُورَةُ ٱلْأَنْفَالِ", english: "Al-Anfal", arti: "Rampasan Perang", type: "Madaniyah", ayahs: 75 },
  { num: 9, name: "سُورَةُ ٱلتَّوْبَةِ", english: "At-Taubah", arti: "Pengampunan", type: "Madaniyah", ayahs: 129 },
  { num: 10, name: "سُورَةُ يُونُسَ", english: "Yunus", arti: "Yunus", type: "Makkiyah", ayahs: 109 },
  { num: 11, name: "سُورَةُ هُودٍ", english: "Hud", arti: "Hud", type: "Makkiyah", ayahs: 123 },
  { num: 12, name: "سُورَةُ يُوسُفَ", english: "Yusuf", arti: "Yusuf", type: "Makkiyah", ayahs: 111 },
  { num: 13, name: "سُورَةُ ٱلرَّعْدِ", english: "Ar-Ra'd", arti: "Guruh", type: "Madaniyah", ayahs: 43 },
  { num: 14, name: "سُورَةُ إِبْرَاهِيمَ", english: "Ibrahim", arti: "Ibrahim", type: "Makkiyah", ayahs: 52 },
  { num: 15, name: "سُورَةُ ٱلْحِجْرِ", english: "Al-Hijr", arti: "Hijr", type: "Makkiyah", ayahs: 99 },
  { num: 16, name: "سُورَةُ ٱلنَّحْلِ", english: "An-Nahl", arti: "Lebah", type: "Makkiyah", ayahs: 128 },
  { num: 17, name: "سُورَةُ ٱلْإِسْرَاءِ", english: "Al-Isra'", arti: "Memperjalankan Malam Hari", type: "Makkiyah", ayahs: 111 },
  { num: 18, name: "سُورَةُ ٱلْكَهْفِ", english: "Al-Kahf", arti: "Gua", type: "Makkiyah", ayahs: 110 },
  { num: 19, name: "سُورَةُ مَرْيَمَ", english: "Maryam", arti: "Maryam", type: "Makkiyah", ayahs: 98 },
  { num: 20, name: "سُورَةُ طه", english: "Taha", arti: "Ta-ha", type: "Makkiyah", ayahs: 135 },
  { num: 21, name: "سُورَةُ ٱلْأَنْبِيَاءِ", english: "Al-Anbiya'", arti: "Para Nabi", type: "Makkiyah", ayahs: 112 },
  { num: 22, name: "سُورَةُ ٱلْحَجِّ", english: "Al-Hajj", arti: "Haji", type: "Madaniyah", ayahs: 78 },
  { num: 23, name: "سُورَةُ ٱلْمُؤْمِنِينَ", english: "Al-Mu'minun", arti: "Orang-Orang Mukmin", type: "Makkiyah", ayahs: 118 },
  { num: 24, name: "سُورَةُ ٱلنُّورِ", english: "An-Nur", arti: "Cahaya", type: "Madaniyah", ayahs: 64 },
  { num: 25, name: "سُورَةُ ٱلْفُرْقَانِ", english: "Al-Furqan", arti: "Pembeda", type: "Makkiyah", ayahs: 77 },
  { num: 26, name: "سُورَةُ ٱلشُّعَرَاءِ", english: "Asy-Syu'ara'", arti: "Para Penyair", type: "Makkiyah", ayahs: 227 },
  { num: 27, name: "سُورَةُ ٱلنَّمْلِ", english: "An-Naml", arti: "Semut", type: "Makkiyah", ayahs: 93 },
  { num: 28, name: "سُورَةُ ٱلْقَصَصِ", english: "Al-Qasas", arti: "Kisah-Kisah", type: "Makkiyah", ayahs: 88 },
  { num: 29, name: "سُورَةُ ٱلْعَنْكَبُوتِ", english: "Al-'Ankabut", arti: "Laba-Laba", type: "Makkiyah", ayahs: 69 },
  { num: 30, name: "سُورَةُ ٱلرُّومِ", english: "Ar-Rum", arti: "Romawi", type: "Makkiyah", ayahs: 60 },
  { num: 31, name: "سُورَةُ لُقْمَانَ", english: "Luqman", arti: "Luqman", type: "Makkiyah", ayahs: 34 },
  { num: 32, name: "سُورَةُ ٱلسَّجْدَةِ", english: "As-Sajdah", arti: "Sajdah", type: "Makkiyah", ayahs: 30 },
  { num: 33, name: "سُورَةُ ٱلْأَحْزَابِ", english: "Al-Ahzab", arti: "Golongan yang Bersekutu", type: "Madaniyah", ayahs: 73 },
  { num: 34, name: "سُورَةُ سَبَإٍ", english: "Saba'", arti: "Saba'", type: "Makkiyah", ayahs: 54 },
  { num: 35, name: "سُورَةُ فَاطِرٍ", english: "Fatir", arti: "Pencipta", type: "Makkiyah", ayahs: 45 },
  { num: 36, name: "سُورَةُ يس", english: "Yasin", arti: "Ya-sin", type: "Makkiyah", ayahs: 83 },
  { num: 37, name: "سُورَةُ ٱلصَّافَّاتِ", english: "As-Saffat", arti: "Barisan-Barisan", type: "Makkiyah", ayahs: 182 },
  { num: 38, name: "سُورَةُ ص", english: "Sad", arti: "Sad", type: "Makkiyah", ayahs: 88 },
  { num: 39, name: "سُورَةُ ٱلزُّمَرِ", english: "Az-Zumar", arti: "Rombongan", type: "Makkiyah", ayahs: 75 },
  { num: 40, name: "سُورَةُ غَافِرٍ", english: "Ghafir", arti: "Maha Pengampun", type: "Makkiyah", ayahs: 85 },
  { num: 41, name: "سُورَةُ فُصِّلَتْ", english: "Fussilat", arti: "Dijelaskan", type: "Makkiyah", ayahs: 54 },
  { num: 42, name: "سُورَةُ ٱلشُّورَىٰ", english: "Asy-Syura", arti: "Musyawarah", type: "Makkiyah", ayahs: 53 },
  { num: 43, name: "سُورَةُ ٱلزُّخْرُفِ", english: "Az-Zukhruf", arti: "Perhiasan", type: "Makkiyah", ayahs: 89 },
  { num: 44, name: "سُورَةُ ٱلدُّخَانِ", english: "Ad-Dukhan", arti: "Kabut", type: "Makkiyah", ayahs: 59 },
  { num: 45, name: "سُورَةُ ٱلْجَاثِيَةِ", english: "Al-Jasiyah", arti: "Berlutut", type: "Makkiyah", ayahs: 37 },
  { num: 46, name: "سُورَةُ ٱلْأَحْقَافِ", english: "Al-Ahqaf", arti: "Bukit Pasir", type: "Makkiyah", ayahs: 35 },
  { num: 47, name: "سُورَةُ مُحَمَّدٍ", english: "Muhammad", arti: "Muhammad", type: "Madaniyah", ayahs: 38 },
  { num: 48, name: "سُورَةُ ٱلْفَتْحِ", english: "Al-Fath", arti: "Kemenangan", type: "Madaniyah", ayahs: 29 },
  { num: 49, name: "سُورَةُ ٱلْحُجُرَاتِ", english: "Al-Hujurat", arti: "Kamar-Kamar", type: "Madaniyah", ayahs: 18 },
  { num: 50, name: "سُورَةُ ق", english: "Qaf", arti: "Qaf", type: "Makkiyah", ayahs: 45 },
  { num: 51, name: "سُورَةُ ٱلذَّارِيَاتِ", english: "Az-Zariyat", arti: "Angin yang Menerbangkan", type: "Makkiyah", ayahs: 60 },
  { num: 52, name: "سُورَةُ ٱلطُّورِ", english: "At-Tur", arti: "Bukit", type: "Makkiyah", ayahs: 49 },
  { num: 53, name: "سُورَةُ ٱلنَّجْمِ", english: "An-Najm", arti: "Bintang", type: "Makkiyah", ayahs: 62 },
  { num: 54, name: "سُورَةُ ٱلْقَمَرِ", english: "Al-Qamar", arti: "Bulan", type: "Makkiyah", ayahs: 55 },
  { num: 55, name: "سُورَةُ ٱلرَّحْمَٰنِ", english: "Ar-Rahman", arti: "Maha Pengasih", type: "Madaniyah", ayahs: 78 },
  { num: 56, name: "سُورَةُ ٱلْوَاقِعَةِ", english: "Al-Waqi'ah", arti: "Hari Kiamat", type: "Makkiyah", ayahs: 96 },
  { num: 57, name: "سُورَةُ ٱلْحَدِيدِ", english: "Al-Hadid", arti: "Besi", type: "Madaniyah", ayahs: 29 },
  { num: 58, name: "سُورَةُ ٱلْمُجَادَلَةِ", english: "Al-Mujadalah", arti: "Gugatan", type: "Madaniyah", ayahs: 22 },
  { num: 59, name: "سُورَةُ ٱلْحَشْرِ", english: "Al-Hasyr", arti: "Pengusiran", type: "Madaniyah", ayahs: 24 },
  { num: 60, name: "سُورَةُ ٱلْمُمْتَحَنَةِ", english: "Al-Mumtahanah", arti: "Wanita yang Diuji", type: "Madaniyah", ayahs: 13 },
  { num: 61, name: "سُورَةُ ٱلصَّفِّ", english: "As-Saff", arti: "Barisan", type: "Madaniyah", ayahs: 14 },
  { num: 62, name: "سُورَةُ ٱلْجُمُعَةِ", english: "Al-Jumu'ah", arti: "Jumat", type: "Madaniyah", ayahs: 11 },
  { num: 63, name: "سُورَةُ ٱلْمُنَافِقِينَ", english: "Al-Munafiqun", arti: "Orang-Orang Munafik", type: "Madaniyah", ayahs: 11 },
  { num: 64, name: "سُورَةُ ٱلتَّغَابُنِ", english: "At-Tagabun", arti: "Pengungkapan Kesalahan", type: "Madaniyah", ayahs: 18 },
  { num: 65, name: "سُورَةُ ٱلطَّلَاقِ", english: "At-Talaq", arti: "Talak", type: "Madaniyah", ayahs: 12 },
  { num: 66, name: "سُورَةُ ٱلتَّحْرِيمِ", english: "At-Tahrim", arti: "Pengharaman", type: "Madaniyah", ayahs: 12 },
  { num: 67, name: "سُورَةُ ٱلْمُلْكِ", english: "Al-Mulk", arti: "Kerajaan", type: "Makkiyah", ayahs: 30 },
  { num: 68, name: "سُورَةُ ٱلْقَلَمِ", english: "Al-Qalam", arti: "Pena", type: "Makkiyah", ayahs: 52 },
  { num: 69, name: "سُورَةُ ٱلْحَاقَّةِ", english: "Al-Haqqah", arti: "Hari Kiamat", type: "Makkiyah", ayahs: 52 },
  { num: 70, name: "سُورَةُ ٱلْمَعَارِجِ", english: "Al-Ma'arij", arti: "Tempat Naik", type: "Makkiyah", ayahs: 44 },
  { num: 71, name: "سُورَةُ نُوحٍ", english: "Nuh", arti: "Nuh", type: "Makkiyah", ayahs: 28 },
  { num: 72, name: "سُورَةُ ٱلْجِنِّ", english: "Al-Jinn", arti: "Jin", type: "Makkiyah", ayahs: 28 },
  { num: 73, name: "سُورَةُ ٱلْمُزَّمِّلِ", english: "Al-Muzzammil", arti: "Orang yang Berselimut", type: "Makkiyah", ayahs: 20 },
  { num: 74, name: "سُورَةُ ٱلْمُدَّثِّرِ", english: "Al-Muddassir", arti: "Orang yang Berkemul", type: "Makkiyah", ayahs: 56 },
  { num: 75, name: "سُورَةُ ٱلْقِيَامَةِ", english: "Al-Qiyamah", arti: "Hari Kiamat", type: "Makkiyah", ayahs: 40 },
  { num: 76, name: "سُورَةُ ٱلْإِنْسَانِ", english: "Al-Insan", arti: "Manusia", type: "Madaniyah", ayahs: 31 },
  { num: 77, name: "سُورَةُ ٱلْمُرْسَلَاتِ", english: "Al-Mursalat", arti: "Malaikat yang Diutus", type: "Makkiyah", ayahs: 50 },
  { num: 78, name: "سُورَةُ ٱلنَّبَإِ", english: "An-Naba'", arti: "Berita", type: "Makkiyah", ayahs: 40 },
  { num: 79, name: "سُورَةُ ٱلنَّازِعَاتِ", english: "An-Nazi'at", arti: "Malaikat yang Mencabut", type: "Makkiyah", ayahs: 46 },
  { num: 80, name: "سُورَةُ عَبَسَ", english: "'Abasa", arti: "Bermuka Masam", type: "Makkiyah", ayahs: 42 },
  { num: 81, name: "سُورَةُ ٱلتَّكْوِيرِ", english: "At-Takwir", arti: "Penggulungan", type: "Makkiyah", ayahs: 29 },
  { num: 82, name: "سُورَةُ ٱلْإِنْفِطَارِ", english: "Al-Infitar", arti: "Terbelah", type: "Makkiyah", ayahs: 19 },
  { num: 83, name: "سُورَةُ ٱلْمُطَفِّفِينَ", english: "Al-Mutaffifin", arti: "Orang-Orang yang Curang", type: "Makkiyah", ayahs: 36 },
  { num: 84, name: "سُورَةُ ٱلْإِنْشِقَاقِ", english: "Al-Insyiqaq", arti: "Terbelah", type: "Makkiyah", ayahs: 25 },
  { num: 85, name: "سُورَةُ ٱلْبُرُوجِ", english: "Al-Buruj", arti: "Gugusan Bintang", type: "Makkiyah", ayahs: 22 },
  { num: 86, name: "سُورَةُ ٱلطَّارِقِ", english: "At-Tariq", arti: "Yang Datang pada Malam Hari", type: "Makkiyah", ayahs: 17 },
  { num: 87, name: "سُورَةُ ٱلْأَعْلَىٰ", english: "Al-A'la", arti: "Yang Maha Tinggi", type: "Makkiyah", ayahs: 19 },
  { num: 88, name: "سُورَةُ ٱلْغَاشِيَةِ", english: "Al-Gasyiyah", arti: "Hari Kiamat", type: "Makkiyah", ayahs: 26 },
  { num: 89, name: "سُورَةُ ٱلْفَجْرِ", english: "Al-Fajr", arti: "Fajar", type: "Makkiyah", ayahs: 30 },
  { num: 90, name: "سُورَةُ ٱلْبَلَدِ", english: "Al-Balad", arti: "Negeri", type: "Makkiyah", ayahs: 20 },
  { num: 91, name: "سُورَةُ ٱلشَّمْسِ", english: "Asy-Syams", arti: "Matahari", type: "Makkiyah", ayahs: 15 },
  { num: 92, name: "سُورَةُ ٱللَّيْلِ", english: "Al-Lail", arti: "Malam", type: "Makkiyah", ayahs: 21 },
  { num: 93, name: "سُورَةُ ٱلضُّحَىٰ", english: "Ad-Duha", arti: "Duha", type: "Makkiyah", ayahs: 11 },
  { num: 94, name: "سُورَةُ ٱلشَّرْحِ", english: "Asy-Syarh", arti: "Kelapangan", type: "Makkiyah", ayahs: 8 },
  { num: 95, name: "سُورَةُ ٱلتِّينِ", english: "At-Tin", arti: "Buah Tin", type: "Makkiyah", ayahs: 8 },
  { num: 96, name: "سُورَةُ ٱلْعَلَقِ", english: "Al-'Alaq", arti: "Segumpal Darah", type: "Makkiyah", ayahs: 19 },
  { num: 97, name: "سُورَةُ ٱلْقَدْرِ", english: "Al-Qadr", arti: "Kemuliaan", type: "Makkiyah", ayahs: 5 },
  { num: 98, name: "سُورَةُ ٱلْبَيِّنَةِ", english: "Al-Bayyinah", arti: "Bukti yang Nyata", type: "Madaniyah", ayahs: 8 },
  { num: 99, name: "سُورَةُ ٱلزَّلْزَلَةِ", english: "Az-Zalzalah", arti: "Guncangan", type: "Madaniyah", ayahs: 8 },
  { num: 100, name: "سُورَةُ ٱلْعَادِيَاتِ", english: "Al-'Adiyat", arti: "Kuda yang Berlari Kencang", type: "Makkiyah", ayahs: 11 },
  { num: 101, name: "سُورَةُ ٱلْقَارِعَةِ", english: "Al-Qari'ah", arti: "Hari Kiamat", type: "Makkiyah", ayahs: 11 },
  { num: 102, name: "سُورَةُ ٱلتَّكَاثُرِ", english: "At-Takasur", arti: "Bermegah-Megahan", type: "Makkiyah", ayahs: 8 },
  { num: 103, name: "سُورَةُ ٱلْعَصْرِ", english: "Al-'Asr", arti: "Asar", type: "Makkiyah", ayahs: 3 },
  { num: 104, name: "سُورَةُ ٱلْهُمَزَةِ", english: "Al-Humazah", arti: "Pengumpat", type: "Makkiyah", ayahs: 9 },
  { num: 105, name: "سُورَةُ ٱلْفِيلِ", english: "Al-Fil", arti: "Gajah", type: "Makkiyah", ayahs: 5 },
  { num: 106, name: "سُورَةُ قُرَيْشٍ", english: "Quraisy", arti: "Quraisy", type: "Makkiyah", ayahs: 4 },
  { num: 107, name: "سُورَةُ ٱلْمَاعُونِ", english: "Al-Ma'un", arti: "Bantuan", type: "Makkiyah", ayahs: 7 },
  { num: 108, name: "سُورَةُ ٱلْكَوْثَرِ", english: "Al-Kausar", arti: "Nikmat yang Banyak", type: "Makkiyah", ayahs: 3 },
  { num: 109, name: "سُورَةُ ٱلْكَافِرِينَ", english: "Al-Kafirun", arti: "Orang-Orang Kafir", type: "Makkiyah", ayahs: 6 },
  { num: 110, name: "سُورَةُ ٱلنَّصْرِ", english: "An-Nasr", arti: "Pertolongan", type: "Madaniyah", ayahs: 3 },
  { num: 111, name: "سُورَةُ ٱلْمَسَدِ", english: "Al-Masad", arti: "Sabut", type: "Makkiyah", ayahs: 5 },
  { num: 112, name: "سُورَةُ ٱلْإِخْلَاصِ", english: "Al-Ikhlas", arti: "Ikhlas", type: "Makkiyah", ayahs: 4 },
  { num: 113, name: "سُورَةُ ٱلْفَلَقِ", english: "Al-Falaq", arti: "Waktu Subuh", type: "Makkiyah", ayahs: 5 },
  { num: 114, name: "سُورَةُ ٱلنَّاسِ", english: "An-Nas", arti: "Manusia", type: "Makkiyah", ayahs: 6 },
];



// Juz → starting surah number (approximate, for display in index)
const JUZ_START_SURAH: Record<number, number> = {
  1:1,2:2,3:2,4:3,5:4,6:4,7:5,8:6,9:7,10:8,11:9,12:11,13:12,14:15,15:17,
  16:18,17:21,18:23,19:25,20:27,21:29,22:33,23:36,24:39,25:41,26:46,27:51,
  28:58,29:67,30:78,
};

const READ_TRACK_DELAY_MS = 2000;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MushafView({ initialPage = 0 }: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userData } = useAuthContext();
  const updateReadingPosition = useMutation(api.mushafProgress.updateReadingPosition);
  const finishReadingSession = useMutation(api.mushafProgress.finishReadingSession);
  const savedPosition = useQuery(
    api.mushafProgress.getReadingPosition,
    userData?._id ? { userId: userData._id } : "skip"
  );
  // Whether the user has agreed to track this reading session — asked once
  // per Mushaf visit via readingConsentVisible. Pages visited during the
  // session are only accumulated locally (sessionPagesRef); they're only
  // written to Tilawah Harian once the user confirms "sudah selesai membaca"
  // when leaving (see the beforeRemove listener below).
  const [trackingConsent, setTrackingConsent] = useState(false);
  const [readingConsentVisible, setReadingConsentVisible] = useState(false);
  const hasPromptedRef = useRef(false);
  const sessionPagesRef = useRef(
    new Map<number, { page: number; surahNumber: number; surahName: string; juz: number }>()
  );
  const [finishConfirmVisible, setFinishConfirmVisible] = useState(false);
  const pendingNavActionRef = useRef<any>(null);
  const sessionSavedRef = useRef(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && windowWidth >= DESKTOP_BREAKPOINT;
  const [page, setPage] = useState(
    Math.max(COVER_PAGE, Math.min(TOTAL_PAGES, initialPage))
  );
  const isCover = page === COVER_PAGE;
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTajwid, setShowTajwid] = useState(false);
  const [legendVisible, setLegendVisible] = useState(false);
  const swipeX = useRef(new Animated.Value(0)).current;

  // Slider
  const [sliderVisible, setSliderVisible] = useState(false);
  const [sliderValue, setSliderValue] = useState(1);

  // Main Index
  const [indexVisible, setIndexVisible] = useState(false);
  const [indexSearch, setIndexSearch] = useState("");

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarksVisible, setBookmarksVisible] = useState(false);

  // Audio
  const soundRef = useRef<Audio.Sound | null>(null);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [playingAyahIdx, setPlayingAyahIdx] = useState<number | null>(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const isPlayingAllRef = useRef(false);
  const playingIdxRef = useRef<number | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioEdition, setAudioEdition] = useState(QURAN_EDITION_AUDIO);
  const [repeatCount, setRepeatCount] = useState(1);
  const repeatCountRef = useRef(1);
  const currentRepeatRef = useRef(0);
  const [audioSettingsVisible, setAudioSettingsVisible] = useState(false);

  // Ayah context menu
  const [selectedAyah, setSelectedAyah] = useState<SelectedAyah | null>(
    null
  );
  const [menuVisible, setMenuVisible] = useState(false);

  // Translation / Tafsir
  const [translationVisible, setTranslationVisible] = useState(false);
  const [tafsirVisible, setTafsirVisible] = useState(false);
  const [translationText, setTranslationText] = useState("");
  const [tafsirText, setTafsirText] = useState("");
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoAyahLabel, setInfoAyahLabel] = useState("");

  // Desktop side panel translations
  const [pageTranslations, setPageTranslations] = useState<PageTranslation[]>([]);
  const [translationsLoading, setTranslationsLoading] = useState(false);

  // Desktop panel visibility
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Word-level mushaf data (quran.com API) for exact Madinah Mushaf line breaks
  const [pageWords, setPageWords] = useState<MushafWord[]>([]);
  const [wordsLoading, setWordsLoading] = useState(false);
  const wordsCache = useRef<Record<number, MushafWord[]>>({});

  const cache = useRef<Record<number, PageData>>({});
  const translationCache = useRef<Record<number, PageTranslation[]>>({});

  const animateToPage = useCallback(
    (targetPage: number, direction: 1 | -1) => {
      Animated.timing(swipeX, {
        toValue: direction === 1 ? SCREEN_WIDTH : -SCREEN_WIDTH,
        duration: SWIPE_ANIM_MS,
        useNativeDriver: true,
      }).start(() => {
        setPage(targetPage);
        swipeX.setValue(direction === 1 ? -SCREEN_WIDTH * 0.18 : SCREEN_WIDTH * 0.18);
        Animated.timing(swipeX, {
          toValue: 0,
          duration: SWIPE_ANIM_MS,
          useNativeDriver: true,
        }).start();
      });
    },
    [swipeX]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const { dx, dy } = gestureState;
          return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy);
        },
        onPanResponderMove: (_, gestureState) => {
          const { dx } = gestureState;
          const canMovePrev = page > COVER_PAGE && dx > 0;
          const canMoveNext = page < TOTAL_PAGES && dx < 0;
          if (canMovePrev || canMoveNext) {
            swipeX.setValue(dx);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const { dx } = gestureState;

          if (dx < -SWIPE_THRESHOLD && page < TOTAL_PAGES) {
            animateToPage(page + 1, 1);
            return;
          }

          if (dx > SWIPE_THRESHOLD && page > COVER_PAGE) {
            animateToPage(page - 1, -1);
            return;
          }

          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        },
      }),
    [animateToPage, page, swipeX]
  );

  // ===== Bookmarks persistence =====
  useEffect(() => {
    AsyncStorage.getItem(BOOKMARKS_KEY).then((raw) => {
      if (raw) {
        try {
          setBookmarks(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

  const saveBookmarks = async (bks: Bookmark[]) => {
    setBookmarks(bks);
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bks));
  };

  const isBookmarked = bookmarks.some((b) => b.page === page);

  const toggleBookmark = async () => {
    if (isBookmarked) {
      await saveBookmarks(bookmarks.filter((b) => b.page !== page));
    } else {
      const surahName = data?.ayahs[0]?.surah.name ?? `Halaman ${page}`;
      await saveBookmarks([
        ...bookmarks,
        { page, surahName, timestamp: Date.now() },
      ]);
    }
  };

  const deleteBookmark = async (pg: number) => {
    await saveBookmarks(bookmarks.filter((b) => b.page !== pg));
  };

  // ===== Reading-session consent (synced with Tilawah Harian) =====
  // Ask once per visit whether to auto-track this session, offering to
  // resume from the last known reading position if one exists.
  useEffect(() => {
    if (!userData?._id || savedPosition === undefined || hasPromptedRef.current) return;
    hasPromptedRef.current = true;
    setReadingConsentVisible(true);
  }, [userData?._id, savedPosition]);

  const handleStartReading = () => {
    if (savedPosition) {
      setPage(savedPosition.page);
    }
    sessionPagesRef.current.clear();
    sessionSavedRef.current = false;
    setTrackingConsent(true);
    setReadingConsentVisible(false);
  };

  const handleDeclineReading = () => {
    setTrackingConsent(false);
    setReadingConsentVisible(false);
  };

  // ===== Session finish confirmation (leaving the Mushaf) =====
  // Intercept back navigation while a tracked session has unsaved pages and
  // ask "sudah selesai membaca?" — only once confirmed do those pages get
  // written to Tilawah Harian.
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      if (!trackingConsent || sessionPagesRef.current.size === 0 || sessionSavedRef.current) {
        return;
      }
      e.preventDefault();
      pendingNavActionRef.current = e.data.action;
      setFinishConfirmVisible(true);
    });
    return unsubscribe;
  }, [navigation, trackingConsent]);

  const leaveMushaf = () => {
    if (pendingNavActionRef.current) {
      navigation.dispatch(pendingNavActionRef.current);
      pendingNavActionRef.current = null;
    }
  };

  const handleConfirmFinish = async () => {
    sessionSavedRef.current = true;
    setFinishConfirmVisible(false);
    if (userData?._id && sessionPagesRef.current.size > 0) {
      const pages = Array.from(sessionPagesRef.current.values());
      try {
        await finishReadingSession({ userId: userData._id, tanggal: todayISO(), pages });
      } catch {}
    }
    sessionPagesRef.current.clear();
    leaveMushaf();
  };

  const handleSkipFinish = () => {
    sessionSavedRef.current = true;
    setFinishConfirmVisible(false);
    sessionPagesRef.current.clear();
    leaveMushaf();
  };

  // ===== Page loading =====
  const load = useCallback(async (p: number) => {
    if (p === COVER_PAGE) return; // cover page has no API data
    if (cache.current[p]) {
      setData(cache.current[p]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await getPageData(p);
      cache.current[p] = d;
      setData(d);
    } catch (e) {
      console.error("Failed to load page:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Preload only caches data — does NOT touch `data` or `loading` state
  const preload = useCallback(async (p: number) => {
    if (p < 1 || p > TOTAL_PAGES || cache.current[p]) return;
    try {
      const d = await getPageData(p);
      cache.current[p] = d;
    } catch {}
  }, []);

  /** Pre-cache word data for adjacent pages so transitions feel instant */
  const preloadWords = useCallback(async (p: number) => {
    if (p < 1 || p > TOTAL_PAGES || wordsCache.current[p]) return;
    try {
      const resp = await fetch(
        `https://api.quran.com/api/v4/verses/by_page/${p}?words=true&word_fields=text_uthmani,line_number,char_type_name&per_page=50`
      );
      const json = await resp.json();
      if (!json.verses) return;
      const words: MushafWord[] = [];
      for (const verse of json.verses) {
        const parts = verse.verse_key.split(':');
        const sNum = parseInt(parts[0]);
        const vNum = parseInt(parts[1]);
        for (const w of verse.words) {
          if (w.char_type_name === 'word' || w.char_type_name === 'end') {
            words.push({
              id: w.id,
              charType: w.char_type_name as 'word' | 'end',
              textUthmani: w.text_uthmani,
              lineNumber: w.line_number,
              verseKey: verse.verse_key,
              surahNumber: sNum,
              verseNumber: vNum,
            });
          }
        }
      }
      wordsCache.current[p] = words;
    } catch {}
  }, [])

  useEffect(() => {
    if (page >= 1) load(page);
  }, [page, load]);

  // Track reading progress: once the user has stayed on a page for a couple
  // of seconds (so scrubbing through the slider/index doesn't count), (a)
  // push the live position so a paired IoT device can see it, and (b)
  // remember the page locally for this session. Nothing is written to
  // Tilawah Harian yet — that only happens when the session is confirmed
  // finished (see the beforeRemove listener below). Only runs once the user
  // has confirmed they want this session tracked.
  useEffect(() => {
    if (page < 1 || !userData?._id || !data || !trackingConsent) return;
    const firstAyah = data.ayahs[0];
    if (!firstAyah) return;
    const timer = setTimeout(() => {
      const entry = {
        page,
        surahNumber: firstAyah.surah.number,
        surahName: firstAyah.surah.englishName,
        juz: firstAyah.juz,
      };
      sessionPagesRef.current.set(page, entry);
      updateReadingPosition({ userId: userData._id, ...entry }).catch(() => {});
    }, READ_TRACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [page, data, userData?._id, trackingConsent, updateReadingPosition]);

  // Fetch word-level data from quran.com API for exact mushaf line breaks
  useEffect(() => {
    if (page < 1) { setPageWords([]); return; }
    if (wordsCache.current[page]) {
      setPageWords(wordsCache.current[page]);
      setWordsLoading(false);
      return;
    }
    // Clear stale content immediately so the old page never flashes on the new one
    setPageWords([]);
    setWordsLoading(true);
    (async () => {
      try {
        const resp = await fetch(
          `https://api.quran.com/api/v4/verses/by_page/${page}?words=true&word_fields=text_uthmani,line_number,char_type_name&per_page=50`
        );
        const json = await resp.json();
        if (!json.verses) return;
        const words: MushafWord[] = [];
        for (const verse of json.verses) {
          const parts = verse.verse_key.split(':');
          const sNum = parseInt(parts[0]);
          const vNum = parseInt(parts[1]);
          for (const w of verse.words) {
            if (w.char_type_name === 'word' || w.char_type_name === 'end') {
              words.push({
                id: w.id,
                charType: w.char_type_name as 'word' | 'end',
                textUthmani: w.text_uthmani,
                lineNumber: w.line_number,
                verseKey: verse.verse_key,
                surahNumber: sNum,
                verseNumber: vNum,
              });
            }
          }
        }
        wordsCache.current[page] = words;
        setPageWords(words);
      } catch {}
      finally { setWordsLoading(false); }
    })();
  }, [page]);

  useEffect(() => {
    if (page >= 1 && page > 1) { preload(page - 1); preloadWords(page - 1); }
    if (page < TOTAL_PAGES) { preload(page + 1); preloadWords(page + 1); }
    if (page === COVER_PAGE) { preload(1); preloadWords(1); }
  }, [page, preload, preloadWords]);

  // Keep repeatCountRef in sync
  useEffect(() => {
    repeatCountRef.current = repeatCount;
  }, [repeatCount]);

  /** Map verse_key (e.g. "2:6") → index in data.ayahs for audio/menu */
  const verseKeyToAyahIdx = useMemo(() => {
    const map = new Map<string, number>();
    if (data) {
      data.ayahs.forEach((a, i) => {
        map.set(`${a.surah.number}:${a.numberInSurah}`, i);
      });
    }
    return map;
  }, [data]);

  /**
   * Dynamic font size: target 15 lines fitting in the available page height.
   * Clamped to [16, 26] for readability on all screen sizes.
   */
  const mushafFontSize = useMemo(() => {
    if (isDesktop) return 20;
    // Header/footer no longer take layout space (they float over the page),
    // so we only reserve room for the safe-area insets plus enough clearance
    // so the floating close button / info pill (top) and glass toolbar
    // (bottom) never overlap the first/last line of text.
    const reservedH =
      (insets.top || TOP_INSET) +
      58 + // clearance for floating top row
      (insets.bottom || 0) +
      FLOATING_TOOLBAR_H + 24 + // clearance for floating bottom toolbar
      52;  // page header inside border
    const availH = windowHeight - reservedH;
    const lineH = availH / 15;
    const heightBasedSize = Math.min(Math.max(lineH * 0.54, 16), 26);

    // The formula above only looks at height, so on narrower/taller screens
    // it can pick a font size wide enough to make a real mushaf line wrap
    // onto two rows — breaking the 1:1 line-for-line mapping to the printed
    // Uthmani mushaf (and making textAlign:"justify" look broken, since the
    // wrapped remainder never reaches the margins). Cap it by the page's
    // actual content width too. Calibrated from the natural (AmiriQuran)
    // width of ~2,200 sampled mushaf lines across all 604 pages: at a
    // reference size of 20px, the 75th-percentile line is ~392px wide.
    const PAGE_CHROME_W = 30; // pageOuter + pageBorder + pageContent horizontal padding/border
    const effectiveWidth =
      Platform.OS === "web" ? Math.min(windowWidth, WEB_MAX_WIDTH) : windowWidth;
    const contentWidth = effectiveWidth - PAGE_CHROME_W;
    const widthBasedCeiling = (contentWidth * 20) / 392;

    return Math.round(Math.min(heightBasedSize, Math.max(widthBasedCeiling, 12)));
  }, [isDesktop, windowHeight, windowWidth, insets]);

  // Fetch page-level translations for desktop side panel
  useEffect(() => {
    if (!isDesktop || page < 1) {
      setPageTranslations([]);
      return;
    }
    if (translationCache.current[page]) {
      setPageTranslations(translationCache.current[page]);
      return;
    }
    setPageTranslations([]);
    setTranslationsLoading(true);
    (async () => {
      try {
        const resp = await fetch(
          `${QURAN_API_BASE}/page/${page}/${QURAN_EDITION_TRANSLATION}`
        );
        const json = await resp.json();
        if (json.code === 200 && json.data?.ayahs) {
          const translations: PageTranslation[] = json.data.ayahs.map(
            (a: { number: number; text: string; surah: { number: number; name: string }; numberInSurah: number }) => ({
              number: a.number,
              surahNumber: a.surah.number,
              surahName: a.surah.name,
              numberInSurah: a.numberInSurah,
              text: a.text,
            })
          );
          translationCache.current[page] = translations;
          setPageTranslations(translations);
        }
      } catch {
        // silent fail
      } finally {
        setTranslationsLoading(false);
      }
    })();
  }, [isDesktop, page]);

  // Fetch audio URLs when page or edition changes
  useEffect(() => {
    stopAudio();
    setAudioUrls([]);
    if (page < 1) return; // no audio for cover page
    (async () => {
      try {
        const resp = await fetch(
          `${QURAN_API_BASE}/page/${page}/${audioEdition}`
        );
        const json = await resp.json();
        if (json.code === 200 && json.data?.ayahs) {
          setAudioUrls(
            json.data.ayahs.map((a: { audio: string }) => a.audio)
          );
        }
      } catch {}
    })();
  }, [page, audioEdition]);

  // Derived info
  const juz = data?.ayahs[0]?.juz ?? 0;
  const hizbInfo = data?.ayahs[0]
    ? getHizbInfo(data.ayahs[0].hizbQuarter)
    : null;
  const surahNames = data
    ? [...new Set(data.ayahs.map((a) => a.surah.name))]
    : [];

  // ===== Audio controls =====
  const stopAudio = async () => {
    isPlayingAllRef.current = false;
    setIsPlayingAll(false);
    setPlayingAyahIdx(null);
    playingIdxRef.current = null;
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  };

  /** Unload current sound without resetting the sequential-play flag */
  const unloadCurrentSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  };

  const playAyah = async (idx: number, isRepeat = false) => {
    if (!audioUrls[idx]) return;
    // Preserve isPlayingAllRef — only unload existing sound
    await unloadCurrentSound();
    // Reset repeat counter when starting a new ayah (not a repeat)
    if (!isRepeat) {
      currentRepeatRef.current = 0;
    }
    setAudioLoading(true);
    setPlayingAyahIdx(idx);
    playingIdxRef.current = idx;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrls[idx] },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setAudioLoading(false);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          currentRepeatRef.current += 1;

          // Check if we need to repeat this ayah
          if (currentRepeatRef.current < repeatCountRef.current) {
            playAyah(idx, true);
            return;
          }

          if (isPlayingAllRef.current) {
            const nextIdx = (playingIdxRef.current ?? 0) + 1;
            if (nextIdx < audioUrls.length) {
              playAyah(nextIdx);
            } else {
              stopAudio();
            }
          } else {
            setPlayingAyahIdx(null);
            playingIdxRef.current = null;
            soundRef.current = null;
          }
        }
      });
    } catch {
      setAudioLoading(false);
      setPlayingAyahIdx(null);
      playingIdxRef.current = null;
    }
  };

  const playAll = async () => {
    if (isPlayingAll) {
      await stopAudio();
      return;
    }
    if (audioUrls.length === 0) return;
    isPlayingAllRef.current = true;
    setIsPlayingAll(true);
    await playAyah(0);
  };

  const playFromAyah = async (idx: number) => {
    if (audioUrls.length === 0) return;
    isPlayingAllRef.current = true;
    setIsPlayingAll(true);
    await playAyah(idx);
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // ===== Ayah context menu actions =====
  const onAyahPress = (ayah: PageAyah, idx: number) => {
    setSelectedAyah({ ayah, idx });
    setMenuVisible(true);
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setSelectedAyah(null);
  };

  const handlePlayAyah = () => {
    if (!selectedAyah) return;
    closeMenu();
    isPlayingAllRef.current = false;
    setIsPlayingAll(false);
    playAyah(selectedAyah.idx);
  };

  const handlePlayFromHere = () => {
    if (!selectedAyah) return;
    closeMenu();
    playFromAyah(selectedAyah.idx);
  };

  const handleBookmarkAyah = () => {
    if (!selectedAyah) return;
    const a = selectedAyah.ayah;
    const surahName = `${a.surah.name} : ${a.numberInSurah}`;
    // We bookmark the page with the ayah info
    const existing = bookmarks.find((b) => b.page === page);
    if (!existing) {
      saveBookmarks([
        ...bookmarks,
        { page, surahName, timestamp: Date.now() },
      ]);
    }
    closeMenu();
  };

  const handleShowTranslation = async () => {
    if (!selectedAyah) return;
    const a = selectedAyah.ayah;
    setInfoAyahLabel(
      `${a.surah.englishName} : ${a.numberInSurah}`
    );
    closeMenu();
    setTranslationText("");
    setTranslationVisible(true);
    setInfoLoading(true);
    try {
      const resp = await fetch(
        `${QURAN_API_BASE}/ayah/${a.number}/${QURAN_EDITION_TRANSLATION}`
      );
      const json = await resp.json();
      if (json.code === 200 && json.data?.text) {
        setTranslationText(json.data.text);
      } else {
        setTranslationText("Terjemahan tidak tersedia.");
      }
    } catch {
      setTranslationText("Gagal memuat terjemahan.");
    } finally {
      setInfoLoading(false);
    }
  };

  const handleShowTafsir = async () => {
    if (!selectedAyah) return;
    const a = selectedAyah.ayah;
    setInfoAyahLabel(
      `${a.surah.englishName} : ${a.numberInSurah}`
    );
    closeMenu();
    setTafsirText("");
    setTafsirVisible(true);
    setInfoLoading(true);
    try {
      const resp = await fetch(
        `${QURAN_API_BASE}/ayah/${a.number}/${TAFSIR_EDITION}`
      );
      const json = await resp.json();
      if (json.code === 200 && json.data?.text) {
        setTafsirText(json.data.text);
      } else {
        setTafsirText("Tafsir tidak tersedia.");
      }
    } catch {
      setTafsirText("Gagal memuat tafsir.");
    } finally {
      setInfoLoading(false);
    }
  };

  // ===== Render Madinah Mushaf lines (word-by-word, exact line breaks) =====
  const renderMushafLines = () => {
    if (wordsLoading && pageWords.length === 0) {
      return (
        <View style={s.loading}>
          <ActivityIndicator size="large" color={M.border} />
          <Text style={s.loadingText}>Memuat mushaf...</Text>
        </View>
      );
    }

    // Group words by line number
    const lineMap = new Map<number, MushafWord[]>();
    for (const w of pageWords) {
      const arr = lineMap.get(w.lineNumber) ?? [];
      arr.push(w);
      lineMap.set(w.lineNumber, arr);
    }
    const sortedLineNums = Array.from(lineMap.keys()).sort((a, b) => a - b);
    if (sortedLineNums.length === 0) return null;

    const minLine = sortedLineNums[0];

    // Surahs whose first page is this page (for top-of-page headers)
    const surahsAtTop = Object.entries(SURAH_PAGE)
      .filter(([, pg]) => Number(pg) === page)
      .map(([num]) => Number(num))
      .sort((a, b) => a - b);

    // Only the FIRST surah in surahsAtTop gets rendered at the very top of the page
    // (when minLine > 1, meaning lines 1-2 are reserved for surah header + bismillah).
    // All other surah changes within the page are mid-page transitions.
    const topRenderedSurah = surahsAtTop.length > 0 && minLine > 1 ? surahsAtTop[0] : -1;

    const content: React.ReactNode[] = [];

    // ── Page header (juz | page number | surah name) ──
    const pageJuz = data?.ayahs[0]?.juz ?? 0;
    content.push(
      <View key="pg-hdr" style={s.mushafPageHeader}>
        <Text style={s.mushafPageHeaderJuz} numberOfLines={1}>
          {pageJuz > 0 ? getJuzArabicLabel(pageJuz) : ""}
        </Text>
        <Text style={s.mushafPageHeaderPage}>{toArabicNumeral(page)}</Text>
        <Text style={s.mushafPageHeaderSurah} numberOfLines={1}>
          {surahNames[0] ?? ""}
        </Text>
      </View>
    );
    content.push(<View key="pg-hdr-line" style={s.mushafPageHeaderLine} />);

    // ── Surah header at top of page (lines 1-2 have no word data) ──
    if (surahsAtTop.length > 0 && minLine > 1) {
      const sNum = surahsAtTop[0];
      const sInfo = SURAH_META.find((sm) => sm.num === sNum);
      if (sInfo) {
        content.push(
          <SurahHeaderBanner key="top-surah-hdr" name={sInfo.name} fontSize={mushafFontSize} />
        );
        if (sNum !== 1 && sNum !== 9) {
          content.push(
            <Text key="top-bismillah" style={[s.bismillah, {fontSize: mushafFontSize}]}>
              بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
            </Text>
          );
        }
      }
    }

    // ── Text lines ──
    let prevSurahNum = pageWords[0]?.surahNumber ?? 0;

    for (const lineNum of sortedLineNums) {
      const lineWords = lineMap.get(lineNum)!;
      const firstWordSurah = lineWords[0].surahNumber;

      // Mid-page surah change: insert decorative header between lines.
      // Compare against topRenderedSurah (not all surahsAtTop) so pages with
      // multiple short surahs (e.g. page 604: Al-Ikhlas, Al-Falaq, An-Nas)
      // correctly get headers for the 2nd and 3rd surahs.
      if (firstWordSurah !== prevSurahNum && firstWordSurah !== topRenderedSurah) {
        const sInfo = SURAH_META.find((sm) => sm.num === firstWordSurah);
        if (sInfo) {
          content.push(
            <SurahHeaderBanner
              key={`mid-surah-${firstWordSurah}`}
              name={sInfo.name}
              fontSize={mushafFontSize}
            />
          );
          if (firstWordSurah !== 1 && firstWordSurah !== 9) {
            content.push(
              <Text key={`mid-bismillah-${firstWordSurah}`} style={[s.bismillah, {fontSize: mushafFontSize}]}>
                بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
              </Text>
            );
          }
        }
      }
      prevSurahNum = lineWords[lineWords.length - 1].surahNumber;

      // Highlight if any word on this line is the active audio ayah
      const isActiveLine =
        playingAyahIdx !== null &&
        lineWords.some((w) => verseKeyToAyahIdx.get(w.verseKey) === playingAyahIdx);

      content.push(
        <Text
          key={`line-${lineNum}`}
          // Safety net for the rare mushaf line still wider than the
          // width-aware ceiling above (e.g. several short ayahs packed onto
          // one line) — shrink just that line instead of wrapping it, which
          // would break the 1:1 mapping to the printed mushaf. Native-only:
          // react-native-web doesn't implement font auto-shrinking, and
          // numberOfLines alone would truncate (hide) ayah text instead.
          {...(Platform.OS !== "web"
            ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.55 }
            : {})}
          style={[
            s.mushafLineText,
            {
              fontSize: mushafFontSize,
              lineHeight: Math.round(mushafFontSize * 1.95),
              // Pages 1-2 are decorative (Al-Fatihah / Al-Baqarah opening) — centre-align
              // All other pages use full justification to match the printed mushaf
              textAlign: page <= 2 ? ("center" as const) : ("center" as const),
            },
            isActiveLine && s.mushafLineActive,
          ]}
        >
          {lineWords.map((w, wi) => {
            const audioIdx = verseKeyToAyahIdx.get(w.verseKey) ?? 0;
            const isActive = playingAyahIdx === audioIdx;
            const isLast = wi === lineWords.length - 1;
            const nextIsEnd = !isLast && lineWords[wi + 1].charType === "end";

            if (w.charType === "end") {
              return (
                <Text
                  key={w.id}
                  style={[
                    s.mushafLineEndMarker,
                    { fontSize: mushafFontSize * 0.35 },
                    isActive && s.activeMarker,
                  ]}
                  onPress={() => {
                    isPlayingAllRef.current = false;
                    setIsPlayingAll(false);
                    playAyah(audioIdx);
                  }}
                >
                  {" ﴿"}{toArabicNumeral(w.verseNumber)}{"﴾ "}
                </Text>
              );
            }

            return (
              <Text
                key={w.id}
                style={[
                  s.mushafLineWord,
                  isActive && s.mushafWordActive,
                  showTajwid && { color: colorizeArabicText(w.textUthmani)[0]?.color ?? M.text },
                ]}
                onPress={() => {
                  if (!data) return;
                  const ayah = data.ayahs[audioIdx];
                  if (ayah) onAyahPress(ayah, audioIdx);
                }}
              >
                {w.textUthmani}
                {!isLast && !nextIsEnd ? " " : ""}
              </Text>
            );
          })}
        </Text>
      );
    }

    return <>{content}</>;
  };

  // ===== Render desktop translation panel =====
  const renderTranslationPanel = () => {
    if (!data) return null;
    const transMap = new Map(pageTranslations.map((t) => [t.number, t]));
    const groups = groupBySurah(data.ayahs);
    return groups.map((g, gi) => (
      <View key={`tg-${gi}`}>
        {g.startsNewSurah && (
          <View style={s.desktopSurahHeader}>
            <Text style={s.desktopSurahHeaderText}>{g.surahName}</Text>
          </View>
        )}
        {g.ayahs.map((a) => {
          const t = transMap.get(a.number);
          return (
            <View key={a.number} style={s.desktopTranslationAyah}>
              <View style={s.desktopTranslationNum}>
                <Text style={s.desktopTranslationNumText}>{a.numberInSurah}</Text>
              </View>
              <Text style={s.desktopTranslationText}>{t?.text ?? ""}</Text>
            </View>
          );
        })}
      </View>
    ));
  };

  // ===== Render page content =====
  const renderContent = () => {
    if (!data) return null;
    const groups = groupBySurah(data.ayahs);
    let ayahCounter = 0;

    // Detect hizb boundaries within this page
    const hizbBoundaries = new Set<number>();
    let prevHQ = 0;
    for (const a of data.ayahs) {
      if (prevHQ !== 0 && a.hizbQuarter !== prevHQ) {
        hizbBoundaries.add(a.number);
      }
      prevHQ = a.hizbQuarter;
    }

    // Page header — mimics standard Mushaf layout
    const firstAyah = data.ayahs[0];
    const pageJuz = firstAyah?.juz ?? 0;
    // Left side: juz label in Arabic, Right side: surah name
    const juzLabel = pageJuz > 0 ? getJuzArabicLabel(pageJuz) : "";
    const pageNum = toArabicNumeral(page);

    return (
      <>
        {/* Mushaf page header */}
        <View style={s.mushafPageHeader}>
          <Text style={s.mushafPageHeaderJuz} numberOfLines={1}>
            {juzLabel}
          </Text>
          <Text style={s.mushafPageHeaderPage}>{pageNum}</Text>
          <Text style={s.mushafPageHeaderSurah} numberOfLines={1}>
            {surahNames[0]}
          </Text>
        </View>
        <View style={s.mushafPageHeaderLine} />

        {groups.map((g, gi) => (
      <View key={`g-${gi}`}>
        {g.startsNewSurah && (
          <SurahHeaderBanner name={g.surahName} fontSize={mushafFontSize} />
        )}
        {g.startsNewSurah && g.surahNumber !== 9 && g.surahNumber !== 1 && (
          <Text style={[s.bismillah, {fontSize: mushafFontSize}]}>
            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
          </Text>
        )}

        <Text style={s.ayahText}>
          {g.ayahs.map((a) => {
            const idx = ayahCounter++;
            // Strip bismillah prefix from first ayah (already rendered separately)
            const rawText =
              a.numberInSurah === 1 &&
              g.surahNumber !== 1 &&
              g.surahNumber !== 9
                ? stripBismillah(a.text)
                : a.text;
            const segs = showTajwid
              ? colorizeArabicText(rawText)
              : [{ text: rawText, color: null }];
            const isActive = playingAyahIdx === idx;
            const showHizbMark = hizbBoundaries.has(a.number);
            return (
              <React.Fragment key={a.number}>
                {/* {showHizbMark && (
                  <Text style={s.hizbInline}>{" ۞ "}</Text>
                )} */}
                {segs.map((seg, si) => (
                  <Text
                    key={si}
                    style={[
                      seg.color ? { color: seg.color } : undefined,
                      isActive && s.activeAyahText,
                    ]}
                    onPress={() => onAyahPress(a, idx)}
                  >
                    {seg.text}
                  </Text>
                ))}
                <Text
                  style={[s.marker, isActive && s.activeMarker]}
                  onPress={() => onAyahPress(a, idx)}
                >
                  {" ﴿" + toArabicNumeral(a.numberInSurah) + "﴾ "}
                </Text>
              </React.Fragment>
            );
          })}
        </Text>
      </View>
    ))}
      </>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle={isCover ? "light-content" : "dark-content"} />

      {/* ===== COVER PAGE ===== */}
      {isCover ? (
        <>
          <View style={s.coverContainer}>
            {/* Outer gold border */}
            <View style={s.coverOuterBorder}>
              {/* Inner border with ornamental feel */}
              <View style={s.coverInnerBorder}>
                <View style={s.coverContent}>
                  {/* Top ornament */}
                  <Text style={s.coverOrnamentTop}>❁ ❁ ❁</Text>

                  {/* Central medallion */}
                  <View style={s.coverMedallion}>
                    <View style={s.coverMedallionInner}>
                      <Text style={s.coverArabicTitle}>
                        ٱلْقُرْآنُ ٱلْكَرِيمُ
                      </Text>
                    </View>
                  </View>

                  {/* Latin title */}
                  <Text style={s.coverLatinTitle}>Al-Quran Al-Karim</Text>
                  <Text style={s.coverSubtitle}>
                    Aplikasi Tahsin
                  </Text>

                  {/* Bottom ornament */}
                  <Text style={s.coverOrnamentBottom}>❁ ❁ ❁</Text>
                </View>
              </View>
            </View>

            {/* Start reading button */}
            <TouchableOpacity
              style={s.coverStartBtn}
              onPress={() => setPage(1)}
            >
              <Text style={s.coverStartText}>Mulai Membaca</Text>
              <FontAwesome name="arrow-left" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Minimal bottom bar for cover */}
          <View style={[s.toolbar, { backgroundColor: "#1B5E20", paddingBottom: insets.bottom + 8 }]}>
            {/* <TouchableOpacity
              style={s.navBtn}
              onPress={() => setPage(1)}
            >
              <FontAwesome name="chevron-left" size={16} color="#E8F5E9" />
            </TouchableOpacity> */}
            <View style={s.topBarCenter}>
              <Text style={[s.toolLabel, { color: "#E8F5E9", fontSize: 12 }]}>
                Sampul
              </Text>
            </View>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => router.back()}
            >
              <FontAwesome name="times" size={18} color="#E8F5E9" />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          {/* Floating close button — replaces the old full-width header (mobile only).
              Placed top-left so it never sits under the reading thumb/swipe zone,
              and stays visible at all times (not tied to showBars) so the mushaf
              can always be closed. */}
          {!isDesktop && (
            ""
            // <View
            //   pointerEvents="box-none"
            //   style={[s.floatingTopRow, { top: (insets.top || TOP_INSET) + 8 }]}
            // >
            //   <TouchableOpacity
            //     style={s.floatingGlassBtn}
            //     onPress={() => router.push("/")}
            //     hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            //   >
            //     <BlurView intensity={45} tint="light" style={s.floatingGlassBlur} />
            //     <FontAwesome name="times" size={18} color={M.toolbarText} />
            //   </TouchableOpacity>

            //   {/* Floating page/surah info pill — replaces the info that used to
            //       live in the header. Tap to bookmark this page. */}
            //   <TouchableOpacity
            //     style={s.floatingInfoPill}
            //     onPress={toggleBookmark}
            //     hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            //   >
            //     <BlurView intensity={45} tint="light" style={s.floatingGlassBlur} />
            //     <View style={s.floatingInfoTextWrap}>
            //       <Text style={s.floatingInfoSurah} numberOfLines={1}>
            //         {surahNames.join(" · ")}
            //       </Text>
            //       <Text style={s.floatingInfoMeta} numberOfLines={1}>
            //         Hal. {page} · Juz {juz}
            //         {hizbInfo ? ` · ${hizbInfo.label}` : ""}
            //       </Text>
            //     </View>
            //     <FontAwesome
            //       name={isBookmarked ? "bookmark" : "bookmark-o"}
            //       size={15}
            //       color={isBookmarked ? M.bookmark : M.toolbarText}
            //     />
            //   </TouchableOpacity>
            // </View>
          )}

          {/* Bookmark ribbon indicator — pushed below the floating top row on mobile */}
          {isBookmarked && (
            <View
              style={[
                s.bookmarkRibbon,
                !isDesktop && { marginTop: (insets.top || TOP_INSET) + 58 },
              ]}
            >
              <FontAwesome name="bookmark" size={16} color={M.bookmark} />
              <Text style={s.bookmarkRibbonText}>Batas Baca</Text>
            </View>
          )}

          {/* Page content area — image loads immediately */}
            <View style={isDesktop ? s.desktopLayout : { flex: 1 }}>
              {/* Left: Translation Panel with toggle */}
              {isDesktop && (
                <View style={s.desktopLeftContainer}>
                  {leftPanelOpen && (
                    <ScrollView
                      style={s.desktopTranslationPanel}
                      contentContainerStyle={s.desktopTranslationContent}
                      showsVerticalScrollIndicator={false}
                    >
                      <Text style={s.desktopTranslationTitle}>Terjemahan</Text>
                      {translationsLoading ? (
                        <View style={s.desktopTranslationLoading}>
                          <ActivityIndicator size="small" color={M.border} />
                        </View>
                      ) : (
                        renderTranslationPanel()
                      )}
                    </ScrollView>
                  )}
                  <TouchableOpacity
                    style={s.desktopLeftToggle}
                    onPress={() => setLeftPanelOpen((v) => !v)}
                  >
                    <FontAwesome
                      name={leftPanelOpen ? "chevron-left" : "chevron-right"}
                      size={11}
                      color={M.toolbarText}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Center: Mushaf Page */}
              <Pressable
                style={[
                  s.pageOuter,
                  isDesktop && s.desktopPageArea,
                  !isDesktop && {
                    // paddingTop: (insets.top || TOP_INSET) + 58,
                    // paddingBottom: insets.bottom + FLOATING_TOOLBAR_H + 24,
                    paddingTop: 10,
                    paddingBottom: insets.bottom + FLOATING_TOOLBAR_H + 10,
                  },
                ]}
                {...panResponder.panHandlers}
              >
                <View style={isDesktop ? s.desktopPageTurnStage : s.pageTurnStage}>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      s.pageTurnShadow,
                      {
                        opacity: swipeX.interpolate({
                          inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                          outputRange: [0.25, 0, 0.25],
                        }),
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      s.pageBorder,
                      isDesktop && s.desktopPageBorder,
                      {
                        transform: [
                          { perspective: 1200 },
                          { translateX: swipeX },
                          {
                            rotateY: swipeX.interpolate({
                              inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                              outputRange: ["-14deg", "0deg", "14deg"],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <ScrollView
                      contentContainerStyle={s.pageContent}
                      showsVerticalScrollIndicator={false}
                    >
                      {renderMushafLines()}
                    </ScrollView>
                  </Animated.View>
                </View>
                {/* <Text style={s.swipeHint}>Geser kiri/kanan untuk pindah halaman</Text> */}
              </Pressable>

              {/* Right: Sidebar with header + tools (desktop only) */}
              {isDesktop && (
                <View style={s.desktopRightContainer}>
                  <TouchableOpacity
                    style={s.desktopRightToggle}
                    onPress={() => setRightPanelOpen((v) => !v)}
                  >
                    <FontAwesome
                      name={rightPanelOpen ? "chevron-right" : "chevron-left"}
                      size={11}
                      color={M.toolbarText}
                    />
                  </TouchableOpacity>
                  {rightPanelOpen && (
                    <View style={s.desktopSidebar}>
                      {/* Back + Info */}
                      <View style={s.desktopSidebarTop}>
                        <TouchableOpacity
                          style={s.desktopSidebarBackBtn}
                          onPress={() => router.push("/")}
                        >
                          <FontAwesome name="arrow-left" size={16} color={M.toolbarText} />
                        </TouchableOpacity>
                        <Text style={s.desktopSidebarSurah} numberOfLines={2}>
                          {surahNames.join(" · ")}
                        </Text>
                        <Text style={s.desktopSidebarMeta}>
                          Hal. {page} · Juz {juz}
                          {hizbInfo ? ` · ${hizbInfo.label}` : ""}
                        </Text>
                        <TouchableOpacity
                          style={[
                            s.desktopSidebarBookmarkBtn,
                            isBookmarked && { backgroundColor: M.bookmark + "25" },
                          ]}
                          onPress={toggleBookmark}
                        >
                          <FontAwesome
                            name={isBookmarked ? "bookmark" : "bookmark-o"}
                            size={14}
                            color={M.bookmark}
                          />
                          <Text style={s.desktopSidebarBookmarkText}>
                            {isBookmarked ? "Hapus Bookmark" : "Bookmark Halaman"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Audio status */}
                      {(playingAyahIdx !== null || audioLoading) && (
                        <View style={s.desktopSidebarAudioBar}>
                          {audioLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <FontAwesome name="volume-up" size={13} color="#fff" />
                          )}
                          <Text style={s.desktopSidebarAudioText} numberOfLines={1}>
                            {isPlayingAll
                              ? `Ayat ${(playingAyahIdx ?? 0) + 1}/${audioUrls.length}`
                              : `Ayat ${(playingAyahIdx ?? 0) + 1}`}
                          </Text>
                          <TouchableOpacity onPress={stopAudio}>
                            <FontAwesome name="stop" size={12} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Tool buttons */}
                      <View style={s.desktopSidebarTools}>
                        <Text style={s.desktopSidebarSection}>Navigasi & Alat</Text>

                        <TouchableOpacity
                          style={s.desktopSidebarToolBtn}
                          onPress={() => setIndexVisible(true)}
                        >
                          <View style={s.desktopSidebarToolIcon}>
                            <FontAwesome name="list-ol" size={16} color={M.toolbarText} />
                          </View>
                          <Text style={s.desktopSidebarToolText}>Indeks Surah</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.desktopSidebarToolBtn}
                          onPress={() => setAudioSettingsVisible(true)}
                        >
                          <View style={s.desktopSidebarToolIcon}>
                            <FontAwesome name="cog" size={16} color={M.toolbarText} />
                          </View>
                          <Text style={s.desktopSidebarToolText}>Pengaturan Qari</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            s.desktopSidebarToolBtn,
                            isPlayingAll && s.desktopSidebarToolBtnActive,
                          ]}
                          onPress={playAll}
                        >
                          <View style={s.desktopSidebarToolIcon}>
                            <FontAwesome
                              name={isPlayingAll ? "stop-circle" : "play-circle"}
                              size={18}
                              color={isPlayingAll ? M.bookmark : M.toolbarText}
                            />
                          </View>
                          <Text
                            style={[
                              s.desktopSidebarToolText,
                              isPlayingAll && { color: M.bookmark },
                            ]}
                          >
                            {isPlayingAll ? "Hentikan Audio" : "Putar Semua"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.desktopSidebarToolBtn}
                          onPress={() => setBookmarksVisible(true)}
                        >
                          <View style={s.desktopSidebarToolIcon}>
                            <FontAwesome
                              name="bookmark"
                              size={16}
                              color={isBookmarked ? M.bookmark : M.toolbarText}
                            />
                          </View>
                          <Text style={s.desktopSidebarToolText}>Daftar Bookmark</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            s.desktopSidebarToolBtn,
                            showTajwid && s.desktopSidebarToolBtnActive,
                          ]}
                          onPress={() => setLegendVisible(true)}
                        >
                          <View style={s.desktopSidebarToolIcon}>
                            <FontAwesome
                              name="paint-brush"
                              size={16}
                              color={showTajwid ? "#FF8F00" : M.toolbarText}
                            />
                          </View>
                          <Text
                            style={[
                              s.desktopSidebarToolText,
                              showTajwid && { color: "#FF8F00" },
                            ]}
                          >
                            Warna Tajwid
                          </Text>
                        </TouchableOpacity>

                        {/* <TouchableOpacity
                          style={s.desktopSidebarToolBtn}
                          onPress={() => {
                            setSliderValue(page);
                            setSliderVisible(true);
                          }}
                        >
                          <View style={s.desktopSidebarToolIcon}>
                            <FontAwesome name="sliders" size={16} color={M.toolbarText} />
                          </View>
                          <Text style={s.desktopSidebarToolText}>Lompat Halaman</Text>
                        </TouchableOpacity> */}
                      </View>

                      {/* Page Navigation */}
                      <View style={s.desktopSidebarNav}>
                        <TouchableOpacity
                          style={[
                            s.desktopSidebarNavBtn,
                            page >= TOTAL_PAGES && { opacity: 0.35 },
                          ]}
                          onPress={() => { if (page < TOTAL_PAGES) animateToPage(page + 1, 1); }}
                          disabled={page >= TOTAL_PAGES}
                        >
                          <FontAwesome
                            name="chevron-left"
                            size={16}
                            color={M.toolbarText}
                          />
                          <Text style={s.desktopSidebarNavLabel}>Sebelumnya</Text>
                        </TouchableOpacity>

                        <View style={s.desktopSidebarPageBadge}>
                          <Text style={s.desktopSidebarPageNum}>
                            {toArabicNumeral(page)}
                          </Text>
                          <Text style={s.desktopSidebarPageLabel}>Halaman</Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            s.desktopSidebarNavBtn,
                            page <= COVER_PAGE && { opacity: 0.35 },
                          ]}
                          onPress={() => { if (page > COVER_PAGE) animateToPage(page - 1, -1); }}
                          disabled={page <= COVER_PAGE}
                        >
                          <FontAwesome
                            name="chevron-right"
                            size={16}
                            color={M.toolbarText}
                          />
                          <Text style={s.desktopSidebarNavLabel}>Berikutnya</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

      {/* Audio floating bar (mobile only) — floats just above the glass toolbar */}
      {!isDesktop && (playingAyahIdx !== null || audioLoading) && (
        <View style={[s.audioBar, { bottom: insets.bottom + FLOATING_TOOLBAR_H + 22 }]}>
          {audioLoading && (
            <ActivityIndicator size="small" color="#fff" />
          )}
          <Text style={s.audioBarText} numberOfLines={1}>
            {isPlayingAll
              ? `Memutar semua — Ayat ${(playingAyahIdx ?? 0) + 1}/${audioUrls.length}`
              : `Ayat ${(playingAyahIdx ?? 0) + 1}`}
          </Text>
          <TouchableOpacity onPress={stopAudio} style={s.audioBarStop}>
            <FontAwesome name="stop" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom toolbar — floating glass pill, ALWAYS visible on mobile
          (no longer tied to showBars), like an iPhone control-center pill.
          RTL layout: left=next, right=prev. */}
      {!isDesktop && (
      <View style={[s.toolbarFloatingWrap, { bottom: insets.bottom + 12 }]}>
        <View style={s.toolbarFloating}>
          <BlurView intensity={55} tint="light" style={s.floatingGlassBlur} />
          <TouchableOpacity
            style={s.navBtn}
            onPress={() => { if (page < TOTAL_PAGES) animateToPage(page + 1, 1); }}
            disabled={page >= TOTAL_PAGES}
          >
            <FontAwesome
              name="chevron-left"
              size={16}
              color={page >= TOTAL_PAGES ? "#ccc" : M.toolbarText}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.toolBtn}
            onPress={() => setIndexVisible(true)}
          >
            <FontAwesome name="list-ol" size={15} color={M.toolbarText} />
            <Text style={s.toolLabel}>Indeks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.toolBtn}
            onPress={() => setAudioSettingsVisible(true)}
          >
            <FontAwesome name="cog" size={15} color={M.toolbarText} />
            <Text style={s.toolLabel}>Qari</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.toolBtn} onPress={playAll}>
            <FontAwesome
              name={isPlayingAll ? "stop-circle" : "play-circle"}
              size={17}
              color={isPlayingAll ? M.bookmark : M.toolbarText}
            />
            <Text style={s.toolLabel}>Audio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.toolBtn}
            onPress={() => setBookmarksVisible(true)}
          >
            <FontAwesome
              name="bookmark"
              size={15}
              color={isBookmarked ? M.bookmark : M.toolbarText}
            />
            <Text style={s.toolLabel}>Bookmark</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.toolBtn}
            onPress={() => setLegendVisible(true)}
          >
            <FontAwesome
              name="paint-brush"
              size={15}
              color={showTajwid ? "#FF8F00" : M.toolbarText}
            />
            <Text style={s.toolLabel}>Tajwid</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.navBtn}
            onPress={() => { if (page > COVER_PAGE) animateToPage(page - 1, -1); }}
            disabled={page <= COVER_PAGE}
          >
            <FontAwesome
              name="chevron-right"
              size={16}
              color={page <= COVER_PAGE ? "#ccc" : M.toolbarText}
            />
          </TouchableOpacity>
        </View>
      </View>
      )}
        </>
      )}

      {/* ===== Ayah Context Menu ===== */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity
          style={s.menuOverlay}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <View style={s.menuCard}>
            {selectedAyah && (
              <Text style={s.menuAyahLabel}>
                {selectedAyah.ayah.surah.name} :{" "}
                {toArabicNumeral(selectedAyah.ayah.numberInSurah)}
              </Text>
            )}

            <TouchableOpacity
              style={s.menuItem}
              onPress={handlePlayFromHere}
            >
              <View style={s.menuIcon}>
                <FontAwesome name="play-circle-o" size={22} color={M.border} />
              </View>
              <Text style={s.menuItemText}>Putar Dari Sini</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.menuItem} onPress={handlePlayAyah}>
              <View style={s.menuIcon}>
                <FontAwesome name="play-circle" size={22} color={M.border} />
              </View>
              <Text style={s.menuItemText}>Putar Ayat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.menuItem}
              onPress={handleBookmarkAyah}
            >
              <View style={s.menuIcon}>
                <FontAwesome name="bookmark-o" size={22} color={M.bookmark} />
              </View>
              <Text style={s.menuItemText}>Bookmark Ayat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.menuItem}
              onPress={handleShowTranslation}
            >
              <View style={s.menuIcon}>
                <FontAwesome name="language" size={22} color={Colors.info} />
              </View>
              <Text style={s.menuItemText}>Tampilkan Terjemahan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.menuItem}
              onPress={handleShowTafsir}
            >
              <View style={s.menuIcon}>
                <FontAwesome name="file-text-o" size={22} color={M.hizb} />
              </View>
              <Text style={s.menuItemText}>Tampilkan Tafsir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.menuItem, s.menuCancel]}
              onPress={closeMenu}
            >
              <View style={s.menuIcon}>
                <FontAwesome
                  name="times-circle"
                  size={22}
                  color={Colors.textSecondary}
                />
              </View>
              <Text style={[s.menuItemText, { color: Colors.textSecondary }]}>
                Batal
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===== Translation Modal ===== */}
      <Modal
        visible={translationVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTranslationVisible(false)}
      >
        <View style={s.infoOverlay}>
          <View style={s.infoModal}>
            <View style={s.infoHeader}>
              <View>
                <Text style={s.infoTitle}>Terjemahan</Text>
                <Text style={s.infoAyahLabel}>{infoAyahLabel}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTranslationVisible(false)}
              >
                <FontAwesome name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            {infoLoading ? (
              <View style={s.infoLoading}>
                <ActivityIndicator size="small" color={M.border} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.infoText}>{translationText}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ===== Tafsir Modal ===== */}
      <Modal
        visible={tafsirVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTafsirVisible(false)}
      >
        <View style={s.infoOverlay}>
          <View style={s.infoModal}>
            <View style={s.infoHeader}>
              <View>
                <Text style={s.infoTitle}>Tafsir Jalalayn</Text>
                <Text style={s.infoAyahLabel}>{infoAyahLabel}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTafsirVisible(false)}
              >
                <FontAwesome name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            {infoLoading ? (
              <View style={s.infoLoading}>
                <ActivityIndicator size="small" color={M.border} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.infoText}>{tafsirText}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ===== Page Slider Panel ===== */}
      <Modal
        visible={sliderVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSliderVisible(false)}
      >
        <TouchableOpacity
          style={s.sliderOverlay}
          activeOpacity={1}
          onPress={() => setSliderVisible(false)}
        >
          <View style={s.sliderPanel}>
            <View style={s.sliderHandle} />
            <Text style={s.sliderTitle}>Geser ke Halaman</Text>
            <View style={s.sliderInfoRow}>
              <Text style={s.sliderJuz}>
                Juz {data?.ayahs[0]?.juz ?? 0}
              </Text>
              <Text style={s.sliderPageNum}>
                Hal. {Math.round(sliderValue)}
              </Text>
              <Text style={s.sliderSurah}>
                {data?.ayahs[0]?.surah.name ?? ""}
              </Text>
            </View>
            <Slider
              style={s.sliderRtl}
              minimumValue={1}
              maximumValue={TOTAL_PAGES}
              step={1}
              value={sliderValue}
              onValueChange={setSliderValue}
              onSlidingComplete={(val: number) => {
                setPage(Math.round(val));
                setSliderVisible(false);
              }}
              minimumTrackTintColor={M.border}
              maximumTrackTintColor={M.border + "40"}
              thumbTintColor={M.border}
            />
            <View style={s.sliderRange}>
              <Text style={s.sliderRangeText}>{TOTAL_PAGES}</Text>
              <Text style={s.sliderRangeText}>1</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===== Main Index Modal ===== */}
      <Modal
        visible={indexVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setIndexVisible(false); setIndexSearch(""); }}
      >
        <View style={s.sliderOverlay}>
          <View style={s.indexModal}>
            <View style={s.indexHeader}>
              <TouchableOpacity
                style={s.indexHeaderBtn}
                onPress={() => { setIndexVisible(false); setIndexSearch(""); }}
              >
                <FontAwesome name="book" size={16} color={M.toolbarText} />
              </TouchableOpacity>
              <Text style={s.indexTitle}>Main Index</Text>
              <TouchableOpacity
                style={s.indexHeaderBtn}
                onPress={() => { setIndexVisible(false); setIndexSearch(""); }}
              >
                <FontAwesome name="times-circle-o" size={20} color={M.toolbarText} />
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            <View style={s.indexSearchWrap}>
              <FontAwesome name="search" size={14} color={Colors.textSecondary} />
              <TextInput
                style={s.indexSearchInput}
                placeholder="Cari surah..."
                placeholderTextColor={Colors.textSecondary}
                value={indexSearch}
                onChangeText={setIndexSearch}
                autoCorrect={false}
                returnKeyType="search"
              />
              {indexSearch.length > 0 && (
                <TouchableOpacity onPress={() => setIndexSearch("")}>
                  <FontAwesome name="times-circle" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Column headers */}
            <View style={s.indexColHeader}>
              <Text style={[s.indexColText, { width: 36 }]}>Juz</Text>
              <Text style={[s.indexColText, { flex: 1 }]}>Surah</Text>
              <Text style={[s.indexColText, { width: 44, textAlign: "center" }]}>Ayat</Text>
              <Text style={[s.indexColText, { width: 44, textAlign: "center" }]}>Hal.</Text>
            </View>

            <FlatList
              data={SURAH_META.filter((su) => {
                if (!indexSearch.trim()) return true;
                const q = indexSearch.toLowerCase();
                return (
                  su.english.toLowerCase().includes(q) ||
                  su.name.includes(indexSearch) ||
                  String(su.num) === q
                );
              })}
              keyExtractor={(item) => String(item.num)}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const pg = SURAH_PAGE[item.num] ?? 1;
                const isCurrentSurah =
                  data?.ayahs[0]?.surah.number === item.num;
                // Find the juz for this surah
                let juzNum = 0;
                for (let j = 30; j >= 1; j--) {
                  if (
                    JUZ_START_SURAH[j] &&
                    item.num >= JUZ_START_SURAH[j]
                  ) {
                    juzNum = j;
                    break;
                  }
                }
                // Only show juz number for the first surah in that juz
                const showJuz =
                  JUZ_START_SURAH[juzNum] === item.num;

                return (
                  <TouchableOpacity
                    style={[
                      s.indexRow,
                      isCurrentSurah && s.indexRowActive,
                      item.num % 2 === 0 && s.indexRowAlt,
                    ]}
                    onPress={() => {
                      setPage(pg);
                      setIndexVisible(false);
                      setIndexSearch("");
                    }}
                  >
                    <Text style={[s.indexJuz, !showJuz && { color: "transparent" }]}>
                      {juzNum}
                    </Text>
                    <View style={s.indexSurahCol}>
                      <Text style={s.indexSurahName}>
                        {item.num}. {item.english}
                      </Text>
                      <Text style={s.indexSurahMeta}>
                        {item.type === "Meccan" ? "Meccan" : "Medinan"} - {item.ayahs} Ayat
                      </Text>
                    </View>
                    <Text style={s.indexAyahCol}>{item.ayahs}</Text>
                    <Text style={s.indexPageCol}>{pg}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ===== Bookmarks Modal ===== */}
      <Modal
        visible={bookmarksVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBookmarksVisible(false)}
      >
        <View style={s.sliderOverlay}>
          <View style={s.bookmarkModal}>
            <View style={s.bookmarkHeader}>
              <Text style={s.bookmarkTitle}>Bookmark</Text>
              <TouchableOpacity
                onPress={() => setBookmarksVisible(false)}
              >
                <FontAwesome name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                s.bookmarkActionBtn,
                isBookmarked && { backgroundColor: M.bookmark + "20" },
              ]}
              onPress={toggleBookmark}
            >
              <FontAwesome
                name={isBookmarked ? "bookmark" : "bookmark-o"}
                size={18}
                color={isBookmarked ? M.bookmark : M.toolbarText}
              />
              <Text
                style={[
                  s.bookmarkActionText,
                  isBookmarked && { color: M.bookmark },
                ]}
              >
                {isBookmarked
                  ? "Hapus Bookmark Halaman Ini"
                  : "Bookmark Halaman Ini"}
              </Text>
            </TouchableOpacity>

            {bookmarks.length === 0 ? (
              <View style={s.bookmarkEmpty}>
                <FontAwesome
                  name="bookmark-o"
                  size={40}
                  color={Colors.border}
                />
                <Text style={s.bookmarkEmptyText}>
                  Belum ada bookmark
                </Text>
              </View>
            ) : (
              <FlatList
                data={bookmarks.sort((a, b) => a.page - b.page)}
                keyExtractor={(item) => String(item.page)}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      s.bookmarkRow,
                      item.page === page && s.bookmarkRowActive,
                    ]}
                    onPress={() => {
                      setPage(item.page);
                      setBookmarksVisible(false);
                    }}
                  >
                    <FontAwesome
                      name="bookmark"
                      size={16}
                      color={M.bookmark}
                    />
                    <View style={s.bookmarkInfo}>
                      <Text style={s.bookmarkSurah}>
                        {item.surahName}
                      </Text>
                      <Text style={s.bookmarkPage}>
                        Halaman {item.page}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteBookmark(item.page)}
                      hitSlop={{
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10,
                      }}
                    >
                      <FontAwesome
                        name="trash-o"
                        size={18}
                        color={Colors.error}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ===== Tajwid Legend Modal ===== */}
      <Modal
        visible={legendVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLegendVisible(false)}
      >
        <View style={s.sliderOverlay}>
          <View style={s.legendModal}>
            <View style={s.legendHeader}>
              <Text style={s.legendTitle}>Keterangan Warna Tajwid</Text>
              <TouchableOpacity onPress={() => setLegendVisible(false)}>
                <FontAwesome name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.values(TAJWID_RULES).map((r) => (
                <View key={r.name} style={s.legendRow}>
                  <View
                    style={[s.legendSwatch, { backgroundColor: r.color }]}
                  />
                  <View style={s.legendInfo}>
                    <Text style={s.legendName}>
                      {r.name}{" "}
                      <Text style={s.legendArabic}>{r.arabic}</Text>
                    </Text>
                    <Text style={s.legendDesc}>{r.description}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[
                s.legendToggleBtn,
                !showTajwid && { backgroundColor: M.border },
              ]}
              onPress={() => {
                setShowTajwid((v) => !v);
                setLegendVisible(false);
              }}
            >
              <Text style={s.legendToggleText}>
                {showTajwid ? "Matikan Tajwid" : "Nyalakan Tajwid"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== Audio Settings Modal ===== */}
      <Modal
        visible={audioSettingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAudioSettingsVisible(false)}
      >
        <View style={s.audioSettingsOverlay}>
          <View style={s.audioSettingsCard}>
            <View style={s.audioSettingsHeader}>
              <Text style={s.audioSettingsTitle}>Pengaturan Audio</Text>
              <TouchableOpacity onPress={() => setAudioSettingsVisible(false)}>
                <FontAwesome name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.audioSettingsSection}>Pengisi Suara (Qari)</Text>
              {AUDIO_EDITIONS.map((ed) => (
                <TouchableOpacity
                  key={ed.id}
                  style={[
                    s.audioEditionOption,
                    audioEdition === ed.id && s.audioEditionSelected,
                  ]}
                  onPress={() => setAudioEdition(ed.id)}
                >
                  <Text
                    style={[
                      s.audioEditionLabel,
                      audioEdition === ed.id && s.audioEditionLabelSelected,
                    ]}
                  >
                    {ed.label}
                  </Text>
                  {audioEdition === ed.id && (
                    <FontAwesome name="check" size={14} color={M.border} />
                  )}
                </TouchableOpacity>
              ))}

              <Text style={s.audioSettingsSection}>Perulangan Audio</Text>
              <Text style={s.audioRepeatHint}>Jumlah pengulangan per ayat</Text>
              <View style={s.audioRepeatRow}>
                {REPEAT_OPTIONS.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      s.audioRepeatChip,
                      repeatCount === n && s.audioRepeatChipSelected,
                    ]}
                    onPress={() => setRepeatCount(n)}
                  >
                    <Text
                      style={[
                        s.audioRepeatChipText,
                        repeatCount === n && s.audioRepeatChipTextSelected,
                      ]}
                    >
                      {n}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={readingConsentVisible}
        onClose={handleDeclineReading}
        onConfirm={handleStartReading}
        icon="book"
        type="primary"
        title={savedPosition ? "Lanjutkan Membaca?" : "Mulai Membaca?"}
        message={
          savedPosition
            ? `Terakhir Anda membaca ${savedPosition.surahName} halaman ${savedPosition.page}. Lanjutkan dari sana? Halaman yang dibaca akan dicatat ke Tilawah Harian setelah sesi membaca selesai.`
            : "Halaman yang Anda baca akan dicatat ke Tilawah Harian setelah Anda selesai membaca."
        }
        confirmText={savedPosition ? "Lanjutkan" : "Mulai Membaca"}
        cancelText="Nanti"
      />

      <ConfirmModal
        visible={finishConfirmVisible}
        onClose={handleSkipFinish}
        onConfirm={handleConfirmFinish}
        icon="check-circle"
        type="primary"
        title="Sudah Selesai Membaca?"
        message={`Anda membaca ${sessionPagesRef.current.size} halaman pada sesi ini. Simpan ke Tilawah Harian?`}
        confirmText="Ya, Selesai"
        cancelText="Belum"
      />
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================
const TOP_INSET = Platform.OS === "ios" ? 50 : StatusBar.currentHeight ?? 24;

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: M.headerBg,
  },

  // Top bar (replaces header — full screen)
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: M.headerBg,
    paddingTop: TOP_INSET,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: M.border + "40",
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
  },
  topBarSurah: {
    fontFamily: "AmiriQuran",
    fontSize: 15,
    fontWeight: "700",
    color: M.toolbarText,
  },
  topBarMeta: {
    fontSize: 12,
    color: M.toolbarText + "CC",
    marginTop: 2,
  },

  // Bookmark ribbon
  bookmarkRibbon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: M.bookmark + "15",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: M.bookmark + "30",
  },
  bookmarkRibbonText: {
    fontSize: 11,
    fontWeight: "600",
    color: M.bookmark,
  },

  // Loading
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
    fontSize: 13,
  },

  // Page wrapper
  pageOuter: {
    flex: 1,
    padding: 8,
  },
  pageTurnStage: {
    flex: 1,
    justifyContent: "center",
  },
  pageTurnShadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    borderRadius: 4,
  },
  pageBorder: {
    flex: 1,
    borderWidth: 2,
    borderColor: M.border,
    borderRadius: 4,
    backgroundColor: M.pageBg,
    overflow: "hidden",
    // minWidth: 450,
    // margin: "auto",
  },
  swipeHint: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // ===== Desktop Layout =====
  desktopLayout: {
    flex: 1,
  },
  // Panels are absolute so they overlay the mushaf — mushaf never shifts
  desktopLeftContainer: {
    position: "absolute" as const,
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row" as const,
    zIndex: 10,
  },
  desktopTranslationPanel: {
    width: 250,
    backgroundColor: "#F8FFF8",
  },
  desktopLeftToggle: {
    width: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: M.surahBg,
    borderRightWidth: 1,
    borderRightColor: M.border + "40",
  },
  desktopTranslationContent: {
    padding: 16,
    paddingBottom: 32,
  },
  desktopTranslationTitle: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: M.toolbarText,
    textAlign: "center",
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: M.border + "30",
  },
  desktopTranslationLoading: {
    paddingVertical: 40,
    alignItems: "center" as const,
  },
  desktopSurahHeader: {
    backgroundColor: M.surahBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    marginBottom: 6,
    alignItems: "center" as const,
  },
  desktopSurahHeaderText: {
    fontFamily: "AmiriQuran",
    fontSize: 13,
    fontWeight: "600" as const,
    color: M.surahDecor,
  },
  desktopTranslationAyah: {
    flexDirection: "row" as const,
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: M.border + "50",
    alignItems: "flex-start" as const,
  },
  desktopTranslationNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: M.surahDecor + "18",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginTop: 1,
    flexShrink: 0,
  },
  desktopTranslationNumText: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: M.surahDecor,
  },
  desktopTranslationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: M.text,
  },

  // Desktop: center mushaf page — fixed 553px width, book-page proportions
  desktopPageArea: {
    flex: 1,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: M.headerBg,
  },
  desktopPageTurnStage: {
    width: 560,
    flex: 1,
    maxHeight: 880,
    justifyContent: "center",
  },
  // Physical mushaf page shadow (book-page lift effect)
  desktopPageBorder: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  // Desktop: right panel container with toggle
  desktopRightContainer: {
    position: "absolute" as const,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row" as const,
    zIndex: 10,
  },
  desktopRightToggle: {
    width: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: M.surahBg,
    borderLeftWidth: 1,
    borderLeftColor: M.border + "40",
  },
  // Desktop: empty right area reserved for future video/zoom
  desktopRightPanel: {
    width: 300,
    backgroundColor: M.headerBg,
  },
  desktopSidebar: {
    width: 280,
    backgroundColor: M.headerBg,
    borderLeftWidth: 1,
    borderLeftColor: M.border + "30",
    flexDirection: "column" as const,
    flex: 1,
  },
  desktopSidebarTop: {
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: M.border + "25",
    alignItems: "center" as const,
    gap: 6,
  },
  desktopSidebarBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: M.border + "18",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    alignSelf: "flex-start" as const,
    marginBottom: 6,
  },
  desktopSidebarSurah: {
    fontFamily: "AmiriQuran",
    fontSize: 17,
    fontWeight: "700" as const,
    color: M.toolbarText,
    textAlign: "center" as const,
    lineHeight: 28,
  },
  desktopSidebarMeta: {
    fontSize: 12,
    color: M.toolbarText + "BB",
    textAlign: "center" as const,
    marginTop: 2,
  },
  desktopSidebarBookmarkBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: M.bookmark + "15",
    marginTop: 6,
    borderWidth: 1,
    borderColor: M.bookmark + "30",
  },
  desktopSidebarBookmarkText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: M.bookmark,
  },
  desktopSidebarAudioBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: M.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  desktopSidebarAudioText: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  desktopSidebarSection: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: M.toolbarText + "88",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  desktopSidebarTools: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  desktopSidebarToolBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 2,
  },
  desktopSidebarToolBtnActive: {
    backgroundColor: M.border + "18",
  },
  desktopSidebarToolIcon: {
    width: 28,
    alignItems: "center" as const,
  },
  desktopSidebarToolText: {
    fontSize: 14,
    color: M.toolbarText,
    fontWeight: "500" as const,
  },
  desktopSidebarNav: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderTopWidth: 1,
    borderTopColor: M.border + "25",
    padding: 10,
    gap: 4,
  },
  desktopSidebarNavBtn: {
    flex: 1,
    height: 52,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderRadius: 10,
    backgroundColor: M.surahBg,
    gap: 4,
  },
  desktopSidebarNavLabel: {
    fontSize: 9,
    color: M.toolbarText + "AA",
    fontWeight: "500" as const,
  },
  desktopSidebarPageBadge: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: M.border + "15",
    borderRadius: 10,
    minWidth: 52,
  },
  desktopSidebarPageNum: {
    fontFamily: "AmiriQuran",
    fontSize: 22,
    fontWeight: "bold" as const,
    color: M.toolbarText,
  },
  desktopSidebarPageLabel: {
    fontSize: 9,
    color: M.toolbarText + "99",
    marginTop: 1,
  },
  pageContent: {
    padding: 5,
    paddingTop: 8,
    paddingBottom: 24,
  },
  // Mushaf line-by-line text styles
  mushafLineText: {
    fontFamily: "AmiriQuran",
    color: M.text,
    textAlign: "center",
    writingDirection: "rtl",
    flexShrink: 0,
  },
  mushafLineActive: {
    backgroundColor: Colors.primaryLight + "30",
    borderRadius: 4,
  },
  mushafLineEndMarker: {
    fontFamily: "AmiriQuran",
    color: M.ayahMarker,
    fontWeight: "600" as const,
    bottom: 2
  },
  mushafLineWord: {
    fontFamily: "AmiriQuran",
    color: M.text,
  },
  mushafWordActive: {
    backgroundColor: Colors.primaryLight + "70",
    borderRadius: 2,
  },
  mushafImageContent: {
    padding: 0,
    margin: 0,
  },
  mushafPageImage: {
    width: "100%",
    aspectRatio: 0.703,
  },
  mushafImageLoadingOverlay: {
    position: "absolute" as const,
    top: 8,
    right: 8,
  },

  // Mushaf page header (juz · page · surah — like standard printed Mushaf)
  mushafPageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
  },
  mushafPageHeaderJuz: {
    fontFamily: "AmiriQuran",
    fontSize: 11,
    color: M.surahDecor,
    flex: 1,
    textAlign: "left",
  },
  mushafPageHeaderPage: {
    fontFamily: "AmiriQuran",
    fontSize: 12,
    color: M.text,
    fontWeight: "600",
    textAlign: "center",
    minWidth: 40,
  },
  mushafPageHeaderSurah: {
    fontFamily: "AmiriQuran",
    fontSize: 11,
    color: M.surahDecor,
    flex: 1,
    textAlign: "right",
  },
  mushafPageHeaderLine: {
    height: 1,
    backgroundColor: M.surahDecor,
    marginBottom: 10,
    opacity: 0.4,
  },

  // Surah header within page
  surahNameText: {
    fontFamily: "AmiriQuran",
    // fontSize: 16,
    color: M.surahDecor,
    textAlign: "center",
  },

  // Ornamental surah banner (double border + corner jewels + double hairline sides)
  surahBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
    gap: 8,
  },
  surahBannerSide: {
    flex: 1,
    height: 10,
    justifyContent: "center",
  },
  surahBannerSideLine: {
    height: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: M.surahDecor,
  },
  surahBannerBoxOuter: {
    borderWidth: 1.5,
    borderColor: M.surahDecor,
    borderRadius: 9,
    backgroundColor: M.surahBg,
    padding: 3,
  },
  surahBannerBoxInner: {
    borderWidth: 1,
    borderColor: M.surahDecor,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 1,
  },
  surahBannerCorner: {
    position: "absolute",
    width: 7,
    height: 7,
    backgroundColor: M.bookmark,
    borderRadius: 1.5,
    transform: [{ rotate: "45deg" }],
  },
  surahBannerCornerTL: { top: -4, left: -4 },
  surahBannerCornerTR: { top: -4, right: -4 },
  surahBannerCornerBL: { bottom: -4, left: -4 },
  surahBannerCornerBR: { bottom: -4, right: -4 },

  bismillah: {
    fontFamily: "AmiriQuran",
    // fontSize: 20,
    color: M.text,
    textAlign: "center",
    marginBottom: 5,
    lineHeight: 36,
  },

  // Continuous ayah text
  ayahText: {
    fontFamily: "AmiriQuran",
    fontSize: 22,
    lineHeight: 46,
    color: M.text,
    textAlign: "justify",
    writingDirection: "rtl",
  },
  marker: {
    fontSize: 16,
    color: M.ayahMarker,
    fontWeight: "600",
  },
  activeAyahText: {
    backgroundColor: Colors.primaryLight + "40",
  },
  activeMarker: {
    color: Colors.primary,
    fontWeight: "bold",
  },

  // Hizb inline marker (۞ rub el hizb — standard Mushaf style)
  hizbInline: {
    fontFamily: "AmiriQuran",
    fontSize: 22,
    lineHeight: 46,
    color: M.text,
  },

  // Audio floating bar — floats as its own pill just above the glass toolbar
  audioBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: M.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 20,
  },
  audioBarText: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  audioBarStop: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Bottom toolbar (cover page — kept as a solid full-width bar)
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: M.toolbarBg,
    paddingHorizontal: 4,
    paddingVertical: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
    borderTopWidth: 1,
    borderTopColor: M.border + "40",
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  toolBtn: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toolLabel: {
    fontSize: 9,
    color: M.toolbarText,
    marginTop: 2,
    fontWeight: "500",
  },

  // ===== Floating "glass" chrome (mobile reading view) =====
  // Reusable frosted-glass fill that sits behind icons/pills
  floatingGlassBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: Platform.OS === "android" ? "rgba(232,245,233,0.88)" : "rgba(232,245,233,0.55)",
  },

  // Top row holding the floating close button + info pill
  floatingTopRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 30,
  },
  floatingGlassBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingInfoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "72%",
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingInfoTextWrap: {
    flexShrink: 1,
  },
  floatingInfoSurah: {
    fontFamily: "AmiriQuran",
    fontSize: 13,
    fontWeight: "700",
    color: M.toolbarText,
  },
  floatingInfoMeta: {
    fontSize: 10,
    color: M.toolbarText + "CC",
    marginTop: 1,
  },

  // Bottom floating glass toolbar wrapper (positions the pill above safe area)
  toolbarFloatingWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 20,
  },
  toolbarFloating: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },

  // ===== Ayah Context Menu =====
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 6,
    width: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuAyahLabel: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: M.border,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
  },
  menuIcon: {
    width: 30,
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.text,
  },
  menuCancel: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },

  // ===== Translation / Tafsir info modals =====
  infoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  infoModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "60%",
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: Colors.text,
  },
  infoAyahLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  infoLoading: {
    paddingVertical: 32,
    alignItems: "center",
  },
  infoText: {
    fontSize: 15,
    lineHeight: 26,
    color: Colors.text,
  },

  // ===== Modal overlays =====
  sliderOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  // Slider panel
  sliderPanel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  sliderHandle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
  sliderTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  sliderInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sliderSurah: {
    fontSize: 14,
    fontWeight: "600",
    color: M.border,
    maxWidth: 120,
  },
  sliderPageNum: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
  },
  sliderJuz: {
    fontSize: 14,
    fontWeight: "600",
    color: M.border,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderRtl: {
    width: "100%",
    height: 40,
    transform: [{ scaleX: -1 }],
  },
  sliderRange: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sliderRangeText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Bookmarks modal
  bookmarkModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "70%",
  },
  bookmarkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  bookmarkTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: Colors.text,
  },
  bookmarkActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: M.headerBg,
    marginBottom: 16,
  },
  bookmarkActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: M.toolbarText,
  },
  bookmarkEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  bookmarkEmptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  bookmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bookmarkRowActive: {
    backgroundColor: M.bookmark + "10",
    borderRadius: 8,
  },
  bookmarkInfo: {
    flex: 1,
  },
  bookmarkSurah: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  bookmarkPage: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Legend Modal
  legendModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "70%",
  },
  legendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  legendTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: Colors.text,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  legendSwatch: {
    width: 18,
    height: 18,
    borderRadius: 4,
    marginRight: 12,
  },
  legendInfo: {
    flex: 1,
  },
  legendName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  legendArabic: {
    fontWeight: "400",
    color: Colors.textSecondary,
  },
  legendDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  legendToggleBtn: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  legendToggleText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },

  // ===== Cover Page =====
  coverContainer: {
    flex: 1,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    paddingTop: TOP_INSET + 10,
  },
  coverOuterBorder: {
    flex: 1,
    width: "100%",
    borderWidth: 3,
    borderColor: "#C5A645",
    borderRadius: 12,
    padding: 6,
  },
  coverInnerBorder: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#C5A645",
    borderRadius: 8,
    padding: 4,
  },
  coverContent: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#C5A64560",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  coverOrnamentTop: {
    fontSize: 24,
    color: "#C5A645",
    letterSpacing: 16,
    marginBottom: 32,
  },
  coverMedallion: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: "#C5A645",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1B5E2080",
    marginBottom: 28,
  },
  coverMedallionInner: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: "#C5A64580",
    justifyContent: "center",
    alignItems: "center",
  },
  coverArabicTitle: {
    fontFamily: "AmiriQuran",
    fontSize: 36,
    color: "#C5A645",
    textAlign: "center",
    lineHeight: 52,
  },
  coverLatinTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#C5A645",
    letterSpacing: 2,
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 14,
    color: "#C5A64599",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 32,
  },
  coverOrnamentBottom: {
    fontSize: 24,
    color: "#C5A645",
    letterSpacing: 16,
  },
  coverStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#C5A645",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 16,
    marginBottom: 16,
  },
  coverStartText: {
    color: "#1B5E20",
    fontSize: 16,
    fontWeight: "bold",
  },

  // ===== Main Index =====
  indexModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    overflow: "hidden",
  },
  indexHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: M.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: M.border + "30",
  },
  indexHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  indexTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: M.toolbarText,
  },
  indexSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    gap: 8,
  },
  indexSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },
  indexColHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#546E7A",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  indexColText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
  },
  indexRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  indexRowAlt: {
    backgroundColor: "#f8f8f8",
  },
  indexRowActive: {
    backgroundColor: M.border + "18",
  },
  indexJuz: {
    width: 36,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
    textAlign: "center",
  },
  indexSurahCol: {
    flex: 1,
    paddingHorizontal: 4,
  },
  indexSurahName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  indexSurahMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  indexAyahCol: {
    width: 44,
    fontSize: 13,
    color: Colors.text,
    textAlign: "center",
  },
  indexPageCol: {
    width: 44,
    fontSize: 13,
    fontWeight: "600",
    color: M.hizb,
    textAlign: "center",
  },
  audioSettingsOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  audioSettingsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "88%",
    maxHeight: "75%",
    padding: 18,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  audioSettingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  audioSettingsTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: M.toolbarText,
  },
  audioSettingsSection: {
    fontSize: 14,
    fontWeight: "600",
    color: M.toolbarText,
    marginTop: 14,
    marginBottom: 6,
  },
  audioEditionOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  audioEditionSelected: {
    backgroundColor: M.headerBg,
  },
  audioEditionLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  audioEditionLabelSelected: {
    fontSize: 14,
    color: M.toolbarText,
    fontWeight: "600",
  },
  audioRepeatHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  audioRepeatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  audioRepeatChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: M.border,
    backgroundColor: "#fff",
  },
  audioRepeatChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  audioRepeatChipText: {
    fontSize: 13,
    color: Colors.text,
  },
  audioRepeatChipTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
});
