import React, { useCallback, useEffect, useRef, useState } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import {
  Colors,
  QURAN_API_BASE,
  QURAN_EDITION_AUDIO,
  QURAN_EDITION_TRANSLATION,
  AUDIO_EDITIONS,
} from "@/lib/constants";
import { getPageData, PageData, PageAyah } from "@/lib/alquran-api";
import { colorizeArabicText, TAJWID_RULES } from "@/lib/tajwid";

const COVER_PAGE = 0;

const TOTAL_PAGES = 604;
const BOOKMARKS_KEY = "mushaf_bookmarks";
const TAFSIR_EDITION = "id.jalalayn";
const REPEAT_OPTIONS = [1, 2, 3, 5, 10];

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
} {
  const hizb = Math.ceil(hizbQuarter / 4);
  const quarter = ((hizbQuarter - 1) % 4) + 1;
  const qLabels = ["", "¼", "½", "¾"];
  const label =
    quarter === 1
      ? `Hizb ${hizb}`
      : `Hizb ${hizb} ${qLabels[quarter - 1]}`;
  return { hizb, quarter, label };
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
const SURAH_META: { num: number; name: string; english: string; type: string; ayahs: number }[] = [
  {num:1,name:"الفاتحة",english:"Al-Fatihah",type:"Meccan",ayahs:7},
  {num:2,name:"البقرة",english:"Al-Baqarah",type:"Medinan",ayahs:286},
  {num:3,name:"آل عمران",english:"Ali 'Imran",type:"Medinan",ayahs:200},
  {num:4,name:"النساء",english:"An-Nisa'",type:"Medinan",ayahs:176},
  {num:5,name:"المائدة",english:"Al-Ma'idah",type:"Medinan",ayahs:120},
  {num:6,name:"الأنعام",english:"Al-An'am",type:"Meccan",ayahs:165},
  {num:7,name:"الأعراف",english:"Al-A'raf",type:"Meccan",ayahs:206},
  {num:8,name:"الأنفال",english:"Al-Anfal",type:"Medinan",ayahs:75},
  {num:9,name:"التوبة",english:"At-Taubah",type:"Medinan",ayahs:129},
  {num:10,name:"يونس",english:"Yunus",type:"Meccan",ayahs:109},
  {num:11,name:"هود",english:"Hood",type:"Meccan",ayahs:123},
  {num:12,name:"يوسف",english:"Yusuf",type:"Meccan",ayahs:111},
  {num:13,name:"الرعد",english:"Ar-Ra'd",type:"Medinan",ayahs:43},
  {num:14,name:"إبراهيم",english:"Ibrahim",type:"Meccan",ayahs:52},
  {num:15,name:"الحجر",english:"Al-Hijr",type:"Meccan",ayahs:99},
  {num:16,name:"النحل",english:"An-Nahl",type:"Meccan",ayahs:128},
  {num:17,name:"الإسراء",english:"Al-Isra",type:"Meccan",ayahs:111},
  {num:18,name:"الكهف",english:"Al-Kahf",type:"Meccan",ayahs:110},
  {num:19,name:"مريم",english:"Maryam",type:"Meccan",ayahs:98},
  {num:20,name:"طه",english:"Ta-Ha",type:"Meccan",ayahs:135},
  {num:21,name:"الأنبياء",english:"Al-Anbiya",type:"Meccan",ayahs:112},
  {num:22,name:"الحج",english:"Al-Hajj",type:"Medinan",ayahs:78},
  {num:23,name:"المؤمنون",english:"Al-Mu'minun",type:"Meccan",ayahs:118},
  {num:24,name:"النور",english:"An-Nur",type:"Medinan",ayahs:64},
  {num:25,name:"الفرقان",english:"Al-Furqan",type:"Meccan",ayahs:77},
  {num:26,name:"الشعراء",english:"Ash-Shu'ara",type:"Meccan",ayahs:227},
  {num:27,name:"النمل",english:"An-Naml",type:"Meccan",ayahs:93},
  {num:28,name:"القصص",english:"Al-Qasas",type:"Meccan",ayahs:88},
  {num:29,name:"العنكبوت",english:"Al-Ankabut",type:"Meccan",ayahs:69},
  {num:30,name:"الروم",english:"Ar-Rum",type:"Meccan",ayahs:60},
  {num:31,name:"لقمان",english:"Luqman",type:"Meccan",ayahs:34},
  {num:32,name:"السجدة",english:"As-Sajdah",type:"Meccan",ayahs:30},
  {num:33,name:"الأحزاب",english:"Al-Ahzab",type:"Medinan",ayahs:73},
  {num:34,name:"سبأ",english:"Saba",type:"Meccan",ayahs:54},
  {num:35,name:"فاطر",english:"Fatir",type:"Meccan",ayahs:45},
  {num:36,name:"يس",english:"Ya-Sin",type:"Meccan",ayahs:83},
  {num:37,name:"الصافات",english:"As-Saffat",type:"Meccan",ayahs:182},
  {num:38,name:"ص",english:"Sad",type:"Meccan",ayahs:88},
  {num:39,name:"الزمر",english:"Az-Zumar",type:"Meccan",ayahs:75},
  {num:40,name:"غافر",english:"Ghafir",type:"Meccan",ayahs:85},
  {num:41,name:"فصلت",english:"Fussilat",type:"Meccan",ayahs:54},
  {num:42,name:"الشورى",english:"Ash-Shura",type:"Meccan",ayahs:53},
  {num:43,name:"الزخرف",english:"Az-Zukhruf",type:"Meccan",ayahs:89},
  {num:44,name:"الدخان",english:"Ad-Dukhan",type:"Meccan",ayahs:59},
  {num:45,name:"الجاثية",english:"Al-Jathiyah",type:"Meccan",ayahs:37},
  {num:46,name:"الأحقاف",english:"Al-Ahqaf",type:"Meccan",ayahs:35},
  {num:47,name:"محمد",english:"Muhammad",type:"Medinan",ayahs:38},
  {num:48,name:"الفتح",english:"Al-Fath",type:"Medinan",ayahs:29},
  {num:49,name:"الحجرات",english:"Al-Hujurat",type:"Medinan",ayahs:18},
  {num:50,name:"ق",english:"Qaf",type:"Meccan",ayahs:45},
  {num:51,name:"الذاريات",english:"Adh-Dhariyat",type:"Meccan",ayahs:60},
  {num:52,name:"الطور",english:"At-Tur",type:"Meccan",ayahs:49},
  {num:53,name:"النجم",english:"An-Najm",type:"Meccan",ayahs:62},
  {num:54,name:"القمر",english:"Al-Qamar",type:"Meccan",ayahs:55},
  {num:55,name:"الرحمن",english:"Ar-Rahman",type:"Medinan",ayahs:78},
  {num:56,name:"الواقعة",english:"Al-Waqi'ah",type:"Meccan",ayahs:96},
  {num:57,name:"الحديد",english:"Al-Hadid",type:"Medinan",ayahs:29},
  {num:58,name:"المجادلة",english:"Al-Mujadilah",type:"Medinan",ayahs:22},
  {num:59,name:"الحشر",english:"Al-Hashr",type:"Medinan",ayahs:24},
  {num:60,name:"الممتحنة",english:"Al-Mumtahanah",type:"Medinan",ayahs:13},
  {num:61,name:"الصف",english:"As-Saff",type:"Medinan",ayahs:14},
  {num:62,name:"الجمعة",english:"Al-Jumu'ah",type:"Medinan",ayahs:11},
  {num:63,name:"المنافقون",english:"Al-Munafiqun",type:"Medinan",ayahs:11},
  {num:64,name:"التغابن",english:"At-Taghabun",type:"Medinan",ayahs:18},
  {num:65,name:"الطلاق",english:"At-Talaq",type:"Medinan",ayahs:12},
  {num:66,name:"التحريم",english:"At-Tahrim",type:"Medinan",ayahs:12},
  {num:67,name:"الملك",english:"Al-Mulk",type:"Meccan",ayahs:30},
  {num:68,name:"القلم",english:"Al-Qalam",type:"Meccan",ayahs:52},
  {num:69,name:"الحاقة",english:"Al-Haqqah",type:"Meccan",ayahs:52},
  {num:70,name:"المعارج",english:"Al-Ma'arij",type:"Meccan",ayahs:44},
  {num:71,name:"نوح",english:"Nuh",type:"Meccan",ayahs:28},
  {num:72,name:"الجن",english:"Al-Jinn",type:"Meccan",ayahs:28},
  {num:73,name:"المزمل",english:"Al-Muzzammil",type:"Meccan",ayahs:20},
  {num:74,name:"المدثر",english:"Al-Muddathir",type:"Meccan",ayahs:56},
  {num:75,name:"القيامة",english:"Al-Qiyamah",type:"Meccan",ayahs:40},
  {num:76,name:"الإنسان",english:"Al-Insan",type:"Medinan",ayahs:31},
  {num:77,name:"المرسلات",english:"Al-Mursalat",type:"Meccan",ayahs:50},
  {num:78,name:"النبأ",english:"An-Naba",type:"Meccan",ayahs:40},
  {num:79,name:"النازعات",english:"An-Nazi'at",type:"Meccan",ayahs:46},
  {num:80,name:"عبس",english:"'Abasa",type:"Meccan",ayahs:42},
  {num:81,name:"التكوير",english:"At-Takwir",type:"Meccan",ayahs:29},
  {num:82,name:"الانفطار",english:"Al-Infitar",type:"Meccan",ayahs:19},
  {num:83,name:"المطففين",english:"Al-Mutaffifin",type:"Meccan",ayahs:36},
  {num:84,name:"الانشقاق",english:"Al-Inshiqaq",type:"Meccan",ayahs:25},
  {num:85,name:"البروج",english:"Al-Buruj",type:"Meccan",ayahs:22},
  {num:86,name:"الطارق",english:"At-Tariq",type:"Meccan",ayahs:17},
  {num:87,name:"الأعلى",english:"Al-A'la",type:"Meccan",ayahs:19},
  {num:88,name:"الغاشية",english:"Al-Ghashiyah",type:"Meccan",ayahs:26},
  {num:89,name:"الفجر",english:"Al-Fajr",type:"Meccan",ayahs:30},
  {num:90,name:"البلد",english:"Al-Balad",type:"Meccan",ayahs:20},
  {num:91,name:"الشمس",english:"Ash-Shams",type:"Meccan",ayahs:15},
  {num:92,name:"الليل",english:"Al-Layl",type:"Meccan",ayahs:21},
  {num:93,name:"الضحى",english:"Ad-Duha",type:"Meccan",ayahs:11},
  {num:94,name:"الشرح",english:"Ash-Sharh",type:"Meccan",ayahs:8},
  {num:95,name:"التين",english:"At-Tin",type:"Meccan",ayahs:8},
  {num:96,name:"العلق",english:"Al-'Alaq",type:"Meccan",ayahs:19},
  {num:97,name:"القدر",english:"Al-Qadr",type:"Meccan",ayahs:5},
  {num:98,name:"البينة",english:"Al-Bayyinah",type:"Medinan",ayahs:8},
  {num:99,name:"الزلزلة",english:"Az-Zalzalah",type:"Medinan",ayahs:8},
  {num:100,name:"العاديات",english:"Al-'Adiyat",type:"Meccan",ayahs:11},
  {num:101,name:"القارعة",english:"Al-Qari'ah",type:"Meccan",ayahs:11},
  {num:102,name:"التكاثر",english:"At-Takathur",type:"Meccan",ayahs:8},
  {num:103,name:"العصر",english:"Al-'Asr",type:"Meccan",ayahs:3},
  {num:104,name:"الهمزة",english:"Al-Humazah",type:"Meccan",ayahs:9},
  {num:105,name:"الفيل",english:"Al-Fil",type:"Meccan",ayahs:5},
  {num:106,name:"قريش",english:"Quraysh",type:"Meccan",ayahs:4},
  {num:107,name:"الماعون",english:"Al-Ma'un",type:"Meccan",ayahs:7},
  {num:108,name:"الكوثر",english:"Al-Kawthar",type:"Meccan",ayahs:3},
  {num:109,name:"الكافرون",english:"Al-Kafirun",type:"Meccan",ayahs:6},
  {num:110,name:"النصر",english:"An-Nasr",type:"Medinan",ayahs:3},
  {num:111,name:"المسد",english:"Al-Masad",type:"Meccan",ayahs:5},
  {num:112,name:"الإخلاص",english:"Al-Ikhlas",type:"Meccan",ayahs:4},
  {num:113,name:"الفلق",english:"Al-Falaq",type:"Meccan",ayahs:5},
  {num:114,name:"الناس",english:"An-Nas",type:"Meccan",ayahs:6},
];

// Juz → starting surah number (approximate, for display in index)
const JUZ_START_SURAH: Record<number, number> = {
  1:1,2:2,3:2,4:3,5:4,6:4,7:5,8:6,9:7,10:8,11:9,12:11,13:12,14:15,15:17,
  16:18,17:21,18:23,19:25,20:27,21:29,22:33,23:36,24:39,25:41,26:46,27:51,
  28:58,29:67,30:78,
};

export default function MushafView({ initialPage = 0 }: Props) {
  const router = useRouter();
  const [page, setPage] = useState(
    Math.max(COVER_PAGE, Math.min(TOTAL_PAGES, initialPage))
  );
  const isCover = page === COVER_PAGE;
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTajwid, setShowTajwid] = useState(true);
  const [legendVisible, setLegendVisible] = useState(false);

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

  const cache = useRef<Record<number, PageData>>({});

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

  useEffect(() => {
    if (page >= 1) load(page);
  }, [page, load]);

  useEffect(() => {
    if (page >= 1 && page > 1) preload(page - 1);
    if (page < TOTAL_PAGES) preload(page + 1);
    // Preload page 1 when on cover
    if (page === COVER_PAGE) preload(1);
  }, [page, preload]);

  // Keep repeatCountRef in sync
  useEffect(() => {
    repeatCountRef.current = repeatCount;
  }, [repeatCount]);

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

    return groups.map((g, gi) => (
      <View key={`g-${gi}`}>
        {g.startsNewSurah && (
          <View style={s.surahBlock}>
            <View style={s.surahDecorLine} />
            <View style={s.surahNameBox}>
              <Text style={s.surahNameText}>{g.surahName}</Text>
            </View>
            <View style={s.surahDecorLine} />
          </View>
        )}
        {g.startsNewSurah && g.surahNumber !== 9 && g.surahNumber !== 1 && (
          <Text style={s.bismillah}>
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
                {showHizbMark && (
                  <Text style={s.hizbInline}>
                    {" ۞ " + getHizbInfo(a.hizbQuarter).label + " "}
                  </Text>
                )}
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
    ));
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
          <View style={[s.toolbar, { backgroundColor: "#1B5E20" }]}>
            <TouchableOpacity
              style={s.navBtn}
              onPress={() => setPage(1)}
            >
              <FontAwesome name="chevron-left" size={16} color="#E8F5E9" />
            </TouchableOpacity>
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
          {/* Top bar with back button */}
          <View style={s.topBar}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => router.back()}
            >
              <FontAwesome name="arrow-left" size={18} color={M.toolbarText} />
            </TouchableOpacity>
            <View style={s.topBarCenter}>
              <Text style={s.topBarSurah} numberOfLines={1}>
                {surahNames.join(" · ")}
              </Text>
              <Text style={s.topBarMeta}>
                Hal. {page} · Juz {juz}
                {hizbInfo ? ` · ${hizbInfo.label}` : ""}
              </Text>
            </View>
            <TouchableOpacity style={s.backBtn} onPress={toggleBookmark}>
              <FontAwesome
                name={isBookmarked ? "bookmark" : "bookmark-o"}
                size={18}
                color={isBookmarked ? M.bookmark : M.toolbarText}
              />
            </TouchableOpacity>
          </View>

          {/* Bookmark ribbon indicator */}
          {isBookmarked && (
            <View style={s.bookmarkRibbon}>
              <FontAwesome name="bookmark" size={16} color={M.bookmark} />
              <Text style={s.bookmarkRibbonText}>Batas Baca</Text>
            </View>
          )}

          {/* Page content area */}
          {loading ? (
            <View style={s.loading}>
              <ActivityIndicator size="large" color={M.border} />
              <Text style={s.loadingText}>Memuat halaman {page}...</Text>
            </View>
          ) : (
            <View style={s.pageOuter}>
              <View style={s.pageBorder}>
                <ScrollView
                  contentContainerStyle={s.pageContent}
                  showsVerticalScrollIndicator={false}
                >
                  {renderContent()}
                </ScrollView>
              </View>
            </View>
          )}

      {/* Audio floating bar */}
      {(playingAyahIdx !== null || audioLoading) && (
        <View style={s.audioBar}>
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

      {/* Bottom navigation bar — RTL: left=next, right=prev */}
      <View style={s.toolbar}>
        <TouchableOpacity
          style={s.navBtn}
          onPress={() => setPage((p) => Math.min(TOTAL_PAGES, p + 1))}
          disabled={page >= TOTAL_PAGES}
        >
          <FontAwesome
            name="chevron-left"
            size={16}
            color={page >= TOTAL_PAGES ? "#ccc" : M.toolbarText}
          />
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={s.toolBtn}
          onPress={() => {
            setSliderValue(page);
            setSliderVisible(true);
          }}
        >
          <FontAwesome name="sliders" size={15} color={M.toolbarText} />
          <Text style={s.toolLabel}>Halaman</Text>
        </TouchableOpacity> */}

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
          onPress={() => setPage((p) => Math.max(COVER_PAGE, p - 1))}
          disabled={page <= COVER_PAGE}
        >
          <FontAwesome
            name="chevron-right"
            size={16}
            color={page <= COVER_PAGE ? "#ccc" : M.toolbarText}
          />
        </TouchableOpacity>
      </View>
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
  pageContent: {
    padding: 16,
    paddingBottom: 24,
  },

  // Surah header within page
  surahBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
    gap: 8,
  },
  surahDecorLine: {
    flex: 1,
    height: 2,
    backgroundColor: M.surahDecor,
    borderRadius: 1,
  },
  surahNameBox: {
    backgroundColor: M.surahBg,
    borderWidth: 1.5,
    borderColor: M.surahDecor,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  surahNameText: {
    fontSize: 16,
    fontWeight: "700",
    color: M.surahDecor,
    textAlign: "center",
  },
  bismillah: {
    fontSize: 20,
    color: M.text,
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 36,
  },

  // Continuous ayah text
  ayahText: {
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

  // Hizb inline marker
  hizbInline: {
    fontSize: 13,
    color: M.hizb,
    fontWeight: "bold",
    backgroundColor: M.hizb + "15",
    borderRadius: 4,
  },

  // Audio floating bar
  audioBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: M.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
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

  // Bottom toolbar
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
    fontSize: 36,
    fontWeight: "700",
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
