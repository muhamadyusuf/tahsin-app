import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import YouTubePlayer from "@/components/YouTubePlayer";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { api } from "@/convex/_generated/api";
import { Colors, getDisplayWidth } from "@/lib/constants";
import { extractYouTubeId } from "@/lib/youtube";
import { getAllSurahs, Surah } from "@/lib/alquran-api";
import { useAuthContext } from "@/lib/auth-context";
import {
  HadisData,
  HadisSearchItem,
  getRandomHadis,
  getNextHadis,
  getPrevHadis,
  getHadisById,
  searchHadis,
} from "@/lib/hadis-api";
import {
  detectLocation,
  getSholatTimes,
  getNextPrayer,
  getProvinsi,
  getKabKota,
  saveLocation,
  loadSavedLocation,
  PRAYER_DISPLAY,
  LocationResult,
  SholatData,
  SholatJadwal,
  NextPrayer,
} from "@/lib/sholat-api";
import * as Location from "expo-location";
import Svg, { Circle, Line, Text as SvgText, G, Polygon } from "react-native-svg";
import { getQiblaData, bearingToCardinal, QiblaData } from "@/lib/qibla-api";
import { DZIKIR_PAGI } from "@/lib/dzikir-data";

const width = getDisplayWidth();

// Quick access surahs
const POPULAR_SURAHS = [36, 67, 56, 18, 55, 1]; // Yasin, Al-Mulk, Al-Waqi'ah, Al-Kahf, Ar-Rahman, Al-Fatihah

// Target tilawah harian default (halaman) — dipakai untuk progress di beranda
const DAILY_TILAWAH_TARGET = 20;

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Hitung streak harian (hari berurutan dengan catatan tilawah, berakhir hari ini/kemarin)
function computeStreak(dates: string[]): number {
  const unique = Array.from(new Set(dates)).sort().reverse();
  if (unique.length === 0) return 0;
  const today = todayISO();
  const yesterday = new Date(Date.now() - 86400000);
  const yesterdayISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (unique[0] !== today && unique[0] !== yesterdayISO) return 0;
  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1] + "T00:00:00");
    const curr = new Date(unique[i] + "T00:00:00");
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

// Teks relatif sederhana untuk tanggal ISO (YYYY-MM-DD)
function relativeDateText(iso: string): string {
  const today = todayISO();
  if (iso === today) return "hari ini";
  const diff = Math.round(
    (new Date(today + "T00:00:00").getTime() - new Date(iso + "T00:00:00").getTime()) / 86400000
  );
  if (diff === 1) return "kemarin";
  return `${diff} hari yang lalu`;
}



function QiblaCompassLive({
  bearing,
  deviceHeading,
  compassAvailable,
}: {
  bearing: number;
  deviceHeading: number | null;
  compassAvailable: boolean;
}) {
  const SIZE = 280;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const OUTER_R = SIZE / 2 - 3;
  const RING_R = OUTER_R - 18;
  const TIP_Y = CY - RING_R + 14;

  // Initialize needle to static bearing so it shows qibla even without compass
  const needleAnim = useRef(new Animated.Value(bearing)).current;
  const roseAnim = useRef(new Animated.Value(0)).current;
  const prevNeedle = useRef(bearing);
  const prevRose = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const diff = deviceHeading != null ? ((bearing - deviceHeading + 360) % 360) : null;
  const isAligned = diff != null && (diff < 12 || diff > 348);
  const turnDeg = diff != null ? (diff <= 180 ? Math.round(diff) : Math.round(360 - diff)) : 0;
  const turnDir = diff != null && diff <= 180 ? "kanan" : "kiri";

  const animStyle = (anim: Animated.Value) => ({
    transform: [{
      rotate: anim.interpolate({
        inputRange: [-7200, 7200],
        outputRange: ["-7200deg", "7200deg"],
        extrapolate: "extend",
      }),
    }],
  });

  useEffect(() => {
    if (deviceHeading == null) return;
    const rawN = bearing - deviceHeading;
    const dN = ((rawN - prevNeedle.current + 540) % 360) - 180;
    prevNeedle.current += dN;
    const rawR = -deviceHeading;
    const dR = ((rawR - prevRose.current + 540) % 360) - 180;
    prevRose.current += dR;
    Animated.spring(needleAnim, { toValue: prevNeedle.current, useNativeDriver: false, damping: 18, stiffness: 100, mass: 0.6 }).start();
    Animated.spring(roseAnim, { toValue: prevRose.current, useNativeDriver: false, damping: 18, stiffness: 100, mass: 0.6 }).start();
  }, [deviceHeading, bearing]);

  useEffect(() => {
    if (isAligned) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 700, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: false }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [isAligned]);

  const absLayer = { position: "absolute" as const, top: 0, left: 0, width: SIZE, height: SIZE };

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: SIZE, height: SIZE }}>

        {/* ── Layer 1: Fixed outer ring + degree ticks ── */}
        <Svg width={SIZE} height={SIZE} style={absLayer}>
          <Circle cx={CX} cy={CY} r={OUTER_R} fill="#E8F5E9" stroke="#A5D6A7" strokeWidth={2} />
          {Array.from({ length: 36 }, (_, i) => {
            const deg = i * 10;
            const rad = (deg - 90) * (Math.PI / 180);
            const isMajor = deg % 30 === 0;
            return (
              <Line key={deg}
                x1={CX + Math.cos(rad) * (OUTER_R - 2)} y1={CY + Math.sin(rad) * (OUTER_R - 2)}
                x2={CX + Math.cos(rad) * (OUTER_R - (isMajor ? 14 : 7))} y2={CY + Math.sin(rad) * (OUTER_R - (isMajor ? 14 : 7))}
                stroke={isMajor ? "#558B2F" : "#AED581"} strokeWidth={isMajor ? 2.5 : 1}
              />
            );
          })}
          <Circle cx={CX} cy={CY} r={RING_R} fill="#FAFAFA" stroke="#C8E6C9" strokeWidth={1.5} />
        </Svg>

        {/* ── Layer 2: Animated compass rose (N/S/T/B rotate with world) ── */}
        <Animated.View style={[absLayer, animStyle(roseAnim)]}>
          <Svg width={SIZE} height={SIZE}>
            {Array.from({ length: 8 }, (_, i) => {
              const deg = i * 45;
              const rad = (deg - 90) * (Math.PI / 180);
              const isMajor = deg % 90 === 0;
              return (
                <Line key={deg}
                  x1={CX + Math.cos(rad) * (RING_R - 2)} y1={CY + Math.sin(rad) * (RING_R - 2)}
                  x2={CX + Math.cos(rad) * (RING_R - (isMajor ? 22 : 14))} y2={CY + Math.sin(rad) * (RING_R - (isMajor ? 22 : 14))}
                  stroke={isMajor ? "#2E7D32" : "#81C784"} strokeWidth={isMajor ? 3.5 : 1.5}
                />
              );
            })}
            <SvgText x={CX} y={CY - RING_R + 28} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#C62828">U</SvgText>
            <SvgText x={CX} y={CY + RING_R - 6} textAnchor="middle" fontSize="15" fill="#546E7A">S</SvgText>
            <SvgText x={CX + RING_R - 10} y={CY + 6} textAnchor="middle" fontSize="15" fill="#546E7A">T</SvgText>
            <SvgText x={CX - RING_R + 10} y={CY + 6} textAnchor="middle" fontSize="15" fill="#546E7A">B</SvgText>
          </Svg>
        </Animated.View>

        {/* ── Layer 3: Animated qibla needle ── */}
        <Animated.View style={[absLayer, animStyle(needleAnim)]}>
          <Svg width={SIZE} height={SIZE}>
            {/* Needle body */}
            <Line x1={CX} y1={CY + 52} x2={CX} y2={TIP_Y + 28} stroke="#2E7D32" strokeWidth={5} strokeLinecap="round" />
            {/* Head arrowhead */}
            <Polygon points={`${CX},${TIP_Y} ${CX - 14},${TIP_Y + 30} ${CX + 14},${TIP_Y + 30}`} fill="#2E7D32" />
            {/* Tail */}
            <Polygon points={`${CX},${CY + 62} ${CX - 8},${CY + 52} ${CX + 8},${CY + 52}`} fill="#9E9E9E" />
            {/* Ka'bah marker circle at tip */}
            <Circle cx={CX} cy={TIP_Y + 8} r={13} fill="#1B5E20" />
            <Circle cx={CX} cy={TIP_Y + 8} r={6} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
          </Svg>
        </Animated.View>

        {/* ── Layer 4: Fixed center pin ── */}
        <Svg width={SIZE} height={SIZE} style={absLayer}>
          <Circle cx={CX} cy={CY} r={18} fill="#1B5E20" />
          <Circle cx={CX} cy={CY} r={11} fill="#fff" />
          <Circle cx={CX} cy={CY} r={5} fill="#2E7D32" />
        </Svg>

        {/* ── Layer 5: Alignment pulse ring ── */}
        {isAligned && (
          <Animated.View style={[absLayer, { transform: [{ scale: pulseAnim }] }]}>
            <Svg width={SIZE} height={SIZE}>
              <Circle cx={CX} cy={CY} r={OUTER_R - 1} fill="none" stroke="#4CAF50" strokeWidth={5} strokeOpacity={0.5} />
            </Svg>
          </Animated.View>
        )}
      </View>

      {/* Status badge */}
      {deviceHeading != null ? (
        <View style={[styles.qiblaAlignBadge, isAligned && styles.qiblaAlignBadgeActive]}>
          {isAligned
            ? <FontAwesome name="check-circle" size={16} color="#fff" />
            : <FontAwesome5 name="directions" size={16} color={Colors.primary} />}
          <Text style={[styles.qiblaAlignText, isAligned && styles.qiblaAlignTextActive]}>
            {isAligned ? "Anda Menghadap Kiblat ✓" : `Putar ${turnDeg}° ke ${turnDir}`}
          </Text>
        </View>
      ) : (
        <View style={styles.qiblaNoCompassBadge}>
          {!compassAvailable ? (
            <>
              <FontAwesome name="info-circle" size={13} color={Colors.textSecondary} />
              <Text style={styles.qiblaNoCompassText}>
                {Platform.OS === "web" ? "Kompas tidak tersedia, lihat sudut di bawah" : "Sensor kompas tidak ditemukan"}
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.qiblaNoCompassText}>Menunggu kompas...</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

type ScreenMode = "home" | "surah-list" | "hadis-search";

export default function TilawahScreen() {
  const router = useRouter();
  const { userData } = useAuthContext();
  const insets = useSafeAreaInsets();
  const appConfig = useQuery(api.appConfig.getPublicConfig, {});
  const ceramahVideos = useQuery(api.ceramahVideo.listActiveVideos, {});
  const userId = userData?._id;
  const readingPosition = useQuery(
    api.mushafProgress.getReadingPosition,
    userId ? { userId } : "skip"
  );
  const todayTilawah = useQuery(
    api.tilawah.getByDate,
    userId ? { userId, tanggal: todayISO() } : "skip"
  );
  const tilawahHistory = useQuery(
    api.tilawah.getByUser,
    userId ? { userId } : "skip"
  );
  const dzikirDoneToday = useQuery(
    api.dzikir.getDzikirSelesaiByDate,
    userId ? { userId, tanggal: todayISO() } : "skip"
  );
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filtered, setFiltered] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ScreenMode>("home");
  const [hadis, setHadis] = useState<HadisData | null>(null);
  const [hadisLoading, setHadisLoading] = useState(false);
  const [hadisSearch, setHadisSearch] = useState("");
  const [hadisSearchResults, setHadisSearchResults] = useState<HadisSearchItem[]>([]);
  const [hadisSearchLoading, setHadisSearchLoading] = useState(false);
  const [hadisSearchPage, setHadisSearchPage] = useState(1);
  const [hadisSearchTotalPages, setHadisSearchTotalPages] = useState(1);

  // Sholat state
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [sholatData, setSholatData] = useState<SholatData | null>(null);
  const [todayJadwal, setTodayJadwal] = useState<SholatJadwal | null>(null);
  const [nextPrayer, setNextPrayer] = useState<NextPrayer | null>(null);
  const [sholatLoading, setSholatLoading] = useState(false);
  const [sholatError, setSholatError] = useState<string | null>(null);
  const [sholatModalVisible, setSholatModalVisible] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual location picker state
  const [pickerMode, setPickerMode] = useState<"jadwal" | "provinsi" | "kabkota">("jadwal");
  const [provinsiList, setProvinsiList] = useState<string[]>([]);
  const [kabkotaList, setKabkotaList] = useState<string[]>([]);
  const [pickerSelectedProvinsi, setPickerSelectedProvinsi] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);

  // Qibla state
  const [qiblaModalVisible, setQiblaModalVisible] = useState(false);
  const [qiblaData, setQiblaData] = useState<QiblaData | null>(null);
  const [qiblaLoading, setQiblaLoading] = useState(false);
  const [qiblaError, setQiblaError] = useState<string | null>(null);
  const [qiblaCoords, setQiblaCoords] = useState<{ lat: number; lon: number } | null>(null);
  // Live compass heading
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [compassAvailable, setCompassAvailable] = useState(true);
  const headingSubRef = useRef<{ remove: () => void } | null>(null);
  const webOrientationHandlerRef = useRef<((e: Event) => void) | null>(null);
  const webCompassReceivedRef = useRef(false);

  // Ceramah video player state
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<{ youtubeUrl: string; judul: string; isLive: boolean } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mushaf mode chooser (per surah vs mushaf full)
  const [mushafModalVisible, setMushafModalVisible] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSurahs();
    loadRandomHadis();
    loadSholatData();
  }, []);

  // Update countdown every minute
  useEffect(() => {
    if (!todayJadwal) return;
    const tick = () => {
      const next = getNextPrayer(todayJadwal, new Date());
      setNextPrayer(next);
    };
    tick();
    countdownRef.current = setInterval(tick, 60_000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [todayJadwal]);

  useEffect(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      setFiltered(
        surahs.filter(
          (s) =>
            s.englishName.toLowerCase().includes(q) ||
            s.englishNameTranslation.toLowerCase().includes(q) ||
            s.number.toString().includes(q)
        )
      );
    } else {
      setFiltered(surahs);
    }
  }, [search, surahs]);

  const loadSurahs = async () => {
    try {
      const data = await getAllSurahs();
      setSurahs(data);
      setFiltered(data);
    } catch (error) {
      console.error("Failed to load surahs:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRandomHadis = async () => {
    setHadisLoading(true);
    try {
      const data = await getRandomHadis();
      setHadis(data);
    } catch (error) {
      console.error("Failed to load hadis:", error);
    } finally {
      setHadisLoading(false);
    }
  };

  const applyLocation = async (loc: LocationResult) => {
    setLocationResult(loc);
    const now = new Date();
    const data = await getSholatTimes(loc.provinsi, loc.kabkota, now.getMonth() + 1, now.getFullYear());
    setSholatData(data);
    const todayDate = now.getDate();
    const today =
      data.jadwal?.find((j) => {
        const d = String(j.tanggal ?? j.date ?? "");
        return d.includes(String(todayDate)) || d.startsWith(String(todayDate).padStart(2, "0"));
      }) ??
      data.jadwal?.[todayDate - 1] ??
      null;
    setTodayJadwal(today);
  };

  const loadSholatData = async (forcedLoc?: LocationResult) => {
    setSholatLoading(true);
    setSholatError(null);
    try {
      let loc: LocationResult | undefined = forcedLoc;

      // 1. Use forced location (manual pick or re-detect)
      if (!loc) {
        // 2. Try saved location from storage
        const saved = await loadSavedLocation();
        if (saved) loc = saved;
      }
      if (!loc) {
        // 3. Try GPS auto-detect
        const detected = await detectLocation();
        if (detected) {
          loc = detected;
          await saveLocation(loc);
        }
      }
      if (!loc) {
        setSholatError("Lokasi tidak ditemukan. Pilih lokasi manual.");
        return;
      }
      await applyLocation(loc);
    } catch (err) {
      console.error("Failed to load sholat:", err);
      setSholatError("Gagal memuat jadwal sholat");
    } finally {
      setSholatLoading(false);
    }
  };

  const handleAutoDetect = async () => {
    setSholatModalVisible(false);
    setSholatLoading(true);
    setSholatError(null);
    try {
      const loc = await detectLocation();
      if (!loc) {
        setSholatError("Gagal mendeteksi lokasi. Pilih lokasi manual.");
        return;
      }
      await saveLocation(loc);
      await applyLocation(loc);
    } catch {
      setSholatError("Gagal mendeteksi lokasi");
    } finally {
      setSholatLoading(false);
    }
  };

  const openManualPicker = async () => {
    setPickerMode("provinsi");
    if (provinsiList.length === 0) {
      setPickerLoading(true);
      try {
        const list = await getProvinsi();
        setProvinsiList(list);
      } catch {
        setProvinsiList([]);
      } finally {
        setPickerLoading(false);
      }
    }
  };

  const handleSelectProvinsi = async (provinsi: string) => {
    setPickerSelectedProvinsi(provinsi);
    setPickerMode("kabkota");
    setPickerLoading(true);
    try {
      const list = await getKabKota(provinsi);
      setKabkotaList(list);
    } catch {
      setKabkotaList([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const handleSelectKabkota = async (kabkota: string) => {
    const loc: LocationResult = {
      provinsi: pickerSelectedProvinsi,
      kabkota,
      displayName: kabkota,
    };
    await saveLocation(loc);
    setPickerMode("jadwal");
    setSholatModalVisible(false);
    await loadSholatData(loc);
  };

  const getWebCoords = (): Promise<{ latitude: number; longitude: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator?.geolocation) {
        reject(new Error("Geolocation tidak didukung browser ini."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    });

  const loadQiblaData = async () => {
    setQiblaLoading(true);
    setQiblaError(null);
    let latitude: number;
    let longitude: number;

    // ── Step 1: get coordinates ──
    try {
      if (Platform.OS === "web") {
        const coords = await getWebCoords();
        latitude = coords.latitude;
        longitude = coords.longitude;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setQiblaError("Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan perangkat.");
          setQiblaLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }
    } catch (err: any) {
      console.error("Qibla geolocation error:", err);
      const isWeb = Platform.OS === "web";
      const isDenied =
        err?.code === 1 ||
        String(err?.message).toLowerCase().includes("denied") ||
        String(err?.message).toLowerCase().includes("permission");
      setQiblaError(
        isDenied
          ? isWeb
            ? "Akses lokasi ditolak. Izinkan akses lokasi di browser lalu coba lagi."
            : "Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan perangkat."
          : isWeb
            ? "Gagal mendapatkan lokasi dari browser. Coba reload halaman."
            : "Gagal mendapatkan lokasi. Pastikan GPS aktif."
      );
      setQiblaLoading(false);
      return;
    }

    // ── Step 2: calculate bearing locally (no API needed) ──
    setQiblaCoords({ lat: latitude, lon: longitude });
    const data = getQiblaData(latitude, longitude);
    setQiblaData(data);
    setQiblaLoading(false);
  };

  // ── Compass heading watch ──
  const stopHeadingWatch = () => {
    if (Platform.OS === "web") {
      if (webOrientationHandlerRef.current) {
        window.removeEventListener("deviceorientationabsolute", webOrientationHandlerRef.current as any, true);
        window.removeEventListener("deviceorientation", webOrientationHandlerRef.current as any, true);
        webOrientationHandlerRef.current = null;
      }
    } else {
      headingSubRef.current?.remove();
      headingSubRef.current = null;
    }
    setDeviceHeading(null);
  };

  const startHeadingWatch = async () => {
    setCompassAvailable(true);
    webCompassReceivedRef.current = false;

    if (Platform.OS === "web") {
      // iOS 13+ requires explicit permission for DeviceOrientationEvent
      if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
        try {
          const perm = await (DeviceOrientationEvent as any).requestPermission();
          if (perm !== "granted") { setCompassAvailable(false); return; }
        } catch { setCompassAvailable(false); return; }
      }
      const handler = (e: Event) => {
        const ev = e as DeviceOrientationEvent;
        let heading: number | null = null;
        // iOS Safari: webkitCompassHeading gives magnetic-north heading directly
        if ((ev as any).webkitCompassHeading != null && (ev as any).webkitCompassHeading >= 0) {
          heading = (ev as any).webkitCompassHeading;
        // Android Chrome: alpha with absolute=true is degrees from magnetic north
        } else if (ev.alpha != null) {
          heading = (360 - ev.alpha + 360) % 360;
        }
        if (heading != null) {
          webCompassReceivedRef.current = true;
          setDeviceHeading(heading);
        }
      };
      window.addEventListener("deviceorientationabsolute", handler as any, true);
      window.addEventListener("deviceorientation", handler as any, true);
      webOrientationHandlerRef.current = handler as any;
      // After 3 s with no data → compass unavailable (desktop browser)
      setTimeout(() => {
        if (!webCompassReceivedRef.current) setCompassAvailable(false);
      }, 3000);
    } else {
      try {
        const sub = await Location.watchHeadingAsync((h) => {
          const heading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          setDeviceHeading(heading);
        });
        headingSubRef.current = sub;
      } catch {
        setCompassAvailable(false);
      }
    }
  };

  // Start/stop compass when qibla modal opens/closes
  useEffect(() => {
    if (!qiblaModalVisible || !qiblaData) return;
    startHeadingWatch();
    return () => {
      if (Platform.OS === "web") {
        if (webOrientationHandlerRef.current) {
          window.removeEventListener("deviceorientationabsolute", webOrientationHandlerRef.current as any, true);
          window.removeEventListener("deviceorientation", webOrientationHandlerRef.current as any, true);
          webOrientationHandlerRef.current = null;
        }
      } else {
        headingSubRef.current?.remove();
        headingSubRef.current = null;
      }
      setDeviceHeading(null);
    };
  }, [qiblaModalVisible, !!qiblaData]);

  const handleNextHadis = async () => {
    if (!hadis) return;
    setHadisLoading(true);
    try {
      const data = await getNextHadis(hadis.id);
      setHadis(data);
    } catch (error) {
      console.error("Failed to load next hadis:", error);
    } finally {
      setHadisLoading(false);
    }
  };

  const handlePrevHadis = async () => {
    if (!hadis) return;
    setHadisLoading(true);
    try {
      const data = await getPrevHadis(hadis.id);
      setHadis(data);
    } catch (error) {
      console.error("Failed to load prev hadis:", error);
    } finally {
      setHadisLoading(false);
    }
  };

  const handleHadisSearch = async (keyword: string, page = 1) => {
    if (!keyword.trim()) return;
    setHadisSearchLoading(true);
    try {
      const result = await searchHadis(keyword.trim(), page, 10);
      if (page === 1) {
        setHadisSearchResults(result.hadis);
      } else {
        setHadisSearchResults((prev) => [...prev, ...result.hadis]);
      }
      setHadisSearchPage(page);
      setHadisSearchTotalPages(result.paging.total_pages);
    } catch (error) {
      console.error("Failed to search hadis:", error);
    } finally {
      setHadisSearchLoading(false);
    }
  };

  const handleSelectSearchResult = async (item: HadisSearchItem) => {
    setMode("home");
    setHadisLoading(true);
    try {
      const data = await getHadisById(item.id);
      setHadis(data);
    } catch (error) {
      console.error("Failed to load hadis by id:", error);
    } finally {
      setHadisLoading(false);
    }
  };

  const getPopularSurahs = () =>
    POPULAR_SURAHS.map((num) => surahs.find((s) => s.number === num)).filter(
      Boolean
    ) as Surah[];

  const firstName = userData?.name?.split(" ")[0] || "Pengguna";
  const headerImageUrl = appConfig?.tilawahHeaderImageUrl;

  // ── Data turunan untuk kartu-kartu beranda ──
  const todayPages = (todayTilawah ?? []).reduce(
    (sum, t) => sum + (t.jumlahHalaman ?? 0),
    0
  );
  const tilawahPercent = Math.min(
    Math.round((todayPages / DAILY_TILAWAH_TARGET) * 100),
    100
  );
  const streakDays = computeStreak(
    (tilawahHistory ?? []).map((t) => t.tanggal)
  );
  const lastTilawah = tilawahHistory
    ? [...tilawahHistory].sort((a, b) =>
        b.tanggal === a.tanggal
          ? b._creationTime - a._creationTime
          : b.tanggal.localeCompare(a.tanggal)
      )[0]
    : undefined;
  const dzikirPagiDone = (dzikirDoneToday ?? []).filter(
    (d) => d.kategoriId === "pagi"
  ).length;
  const dzikirPagiTotal = DZIKIR_PAGI.length;

  // Progres menuju waktu sholat berikutnya (0..1 antara waktu sholat sebelumnya & berikutnya)
  const prayerProgress = (() => {
    if (!todayJadwal) return 0;
    const keys = ["subuh", "dzuhur", "ashar", "maghrib", "isya"] as const;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const toMin = (s?: string) => {
      if (!s) return null;
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m;
    };
    const times = keys
      .map((k) => toMin(todayJadwal[k] as string | undefined))
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    if (times.length === 0) return 0;
    const next = times.find((t) => t > nowMin);
    if (next == null) return 1; // semua waktu sudah lewat
    const prevIdx = times.indexOf(next) - 1;
    const prev = prevIdx >= 0 ? times[prevIdx] : next - 90; // sebelum Subuh: asumsikan awal 90 mnt
    return Math.min(Math.max((nowMin - prev) / (next - prev), 0), 1);
  })();

  const searchBgColor = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: ["transparent", Colors.background],
    extrapolate: "clamp",
  });
  const searchBorderRadius = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 18],
    extrapolate: "clamp",
  });
  const searchShadowOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 0.09],
    extrapolate: "clamp",
  });
  const searchElevation = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 6],
    extrapolate: "clamp",
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat daftar surah...</Text>
      </View>
    );
  }

  if (mode === "hadis-search") {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.listHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => setMode("home")}>
            <FontAwesome name="arrow-left" size={20} color={Colors.textLight} />
          </TouchableOpacity>
          <Text style={styles.listHeaderTitle}>Cari Hadis</Text>
          <View style={{ width: 20 }} />
        </View>

        {/* Search input */}
        <View style={styles.searchContainerList}>
          <FontAwesome
            name="search"
            size={16}
            color={Colors.textSecondary}
            style={{ marginRight: 10 }}
          />
          <TextInput
            style={styles.searchInputList}
            placeholder="Ketik kata kunci hadis..."
            value={hadisSearch}
            onChangeText={setHadisSearch}
            placeholderTextColor={Colors.textSecondary}
            returnKeyType="search"
            onSubmitEditing={() => handleHadisSearch(hadisSearch)}
            autoFocus
          />
          {hadisSearch.length > 0 && (
            <TouchableOpacity
              onPress={() => handleHadisSearch(hadisSearch)}
              style={styles.hadisSearchBtn}
            >
              <Text style={styles.hadisSearchBtnText}>Cari</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {hadisSearchLoading && hadisSearchPage === 1 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : hadisSearchResults.length === 0 && hadisSearch.trim() ? (
          <View style={styles.center}>
            <FontAwesome name="search" size={40} color={Colors.primaryLight} />
            <Text style={[styles.loadingText, { marginTop: 16 }]}>
              Tidak ada hasil untuk "{hadisSearch}"
            </Text>
          </View>
        ) : (
          <FlatList
            data={hadisSearchResults}
            style={{ backgroundColor: Colors.background }}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onEndReached={() => {
              if (hadisSearchPage < hadisSearchTotalPages && !hadisSearchLoading) {
                handleHadisSearch(hadisSearch, hadisSearchPage + 1);
              }
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              hadisSearchLoading ? (
                <ActivityIndicator
                  size="small"
                  color={Colors.primary}
                  style={{ paddingVertical: 16 }}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.hadisSearchResultCard}
                onPress={() => handleSelectSearchResult(item)}
              >
                <View style={styles.hadisSearchResultBadge}>
                  <Text style={styles.hadisSearchResultBadgeText}>#{item.id}</Text>
                </View>
                <Text style={styles.hadisSearchResultText} numberOfLines={3}>
                  {item.text}
                </Text>
                <FontAwesome
                  name="chevron-right"
                  size={12}
                  color={Colors.textSecondary}
                  style={{ marginTop: 4 }}
                />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  if (mode === "surah-list") {
    return (
      <View style={styles.container}>
        {/* Header bar */}
        <View style={[styles.listHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => setMode("home")}>
            <FontAwesome name="arrow-left" size={20} color={Colors.textLight} />
          </TouchableOpacity>
          <Text style={styles.listHeaderTitle}>Daftar Surah</Text>
          <View style={{ width: 20 }} />
        </View>

        {/* Search */}
        <View style={styles.searchContainerList}>
          <FontAwesome
            name="search"
            size={16}
            color={Colors.textSecondary}
            style={{ marginRight: 10 }}
          />
          <TextInput
            style={styles.searchInputList}
            placeholder="Cari surah..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        {/* Surah list */}
        <FlatList
          data={filtered}
          style={{ backgroundColor: Colors.background }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.surahCard}
              onPress={() =>
                router.push({
                  pathname: "/surah/[surahNumber]",
                  params: {
                    surahNumber: item.number.toString(),
                    surahName: item.englishName,
                  },
                })
              }
            >
              <View style={styles.surahNumber}>
                <Text style={styles.surahNumberText}>{item.number}</Text>
              </View>
              <View style={styles.surahInfo}>
                <Text style={styles.surahEnglish}>{item.englishName}</Text>
                <Text style={styles.surahTranslation}>
                  {item.englishNameTranslation} • {item.numberOfAyahs} ayat
                </Text>
              </View>
              <Text style={styles.surahArabic}>{item.name}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.number.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  // HOME mode
  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <StatusBar style="dark" backgroundColor={Colors.background} />
      {/* Full-header background: covers sticky bar + scrollable header */}
      {headerImageUrl ? (
        <Image
          source={{ uri: headerImageUrl }}
          style={[StyleSheet.absoluteFillObject, { height: 250 }]}
          resizeMode="cover"
        />
      ) : null}
      {headerImageUrl ? (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(246,247,241,0.35)" }]} />
      ) : null}

      <Animated.ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* ── child 0: sticky search bar (top) ── */}
        <Animated.View
          style={[
            styles.stickySearchWrapper,
            {
              paddingTop: insets.top + 10,
              backgroundColor: searchBgColor,
              borderBottomLeftRadius: searchBorderRadius,
              borderBottomRightRadius: searchBorderRadius,
              shadowOpacity: searchShadowOpacity,
              elevation: searchElevation,
            },
          ]}
        >
          <View style={styles.stickySearchRow}>
            <TouchableOpacity
              style={styles.searchBarInner}
              onPress={() => setMode("surah-list")}
            >
              <FontAwesome name="search" size={16} color={Colors.textSecondary} />
              <Text style={styles.searchPlaceholder}>Cari surat, ayat, topik...</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarCircleTop}
              onPress={() => router.push("/(tabs)/profil")}
            >
              {userData?.avatarUrl ? (
                <Image source={{ uri: userData.avatarUrl }} style={styles.avatarImageTop} />
              ) : (
                <FontAwesome name="user" size={20} color={Colors.primary} />
              )}
              <View style={styles.avatarOnlineDot} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── child 1: scrollable header ── */}
        <View style={[styles.header, { paddingTop: 4 }]}>
          <View style={styles.headerContent}>
            {/* Greeting row */}
            <View style={styles.greetingWrap}>
              <Text style={styles.greeting}>Assalamu'alaikum,</Text>
              <View style={styles.greetingNameRow}>
                <Text style={styles.userName}>{firstName}</Text>
                <FontAwesome name="leaf" size={20} color={Colors.primary} style={{ marginLeft: 8, marginTop: 6 }} />
              </View>
              <Text style={styles.greetingSub}>
                Semangat hari ini, untuk menjadi lebih dekat dengan Al-Qur'an
              </Text>
            </View>

            {/* Kartu waktu sholat */}
            <TouchableOpacity
              style={styles.prayerCard}
              onPress={() => setSholatModalVisible(true)}
              activeOpacity={0.85}
            >
              <View style={styles.prayerIconBox}>
                <FontAwesome5 name="mosque" size={20} color={Colors.primary} />
              </View>

              {sholatLoading && !nextPrayer ? (
                <View style={styles.prayerLoadingRow}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.prayerLoadingText}>Memuat jadwal...</Text>
                </View>
              ) : nextPrayer ? (
                <>
                  <View style={styles.prayerInfoWrap}>
                    <Text style={styles.prayerName}>{nextPrayer.name}</Text>
                    <Text style={styles.prayerTimeBig}>{nextPrayer.time}</Text>
                    <View style={styles.prayerLocationRow}>
                      <FontAwesome name="map-marker" size={10} color={Colors.textSecondary} />
                      <Text style={styles.prayerLocationText} numberOfLines={1}>
                        {locationResult ? locationResult.displayName : "Lokasi tidak tersedia"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.prayerRightWrap}>
                    <Text style={styles.prayerCountdownText}>{nextPrayer.timeLeft} lagi</Text>
                    <View style={styles.prayerProgressTrack}>
                      <View
                        style={[
                          styles.prayerProgressFill,
                          { width: `${Math.round(prayerProgress * 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                </>
              ) : sholatError ? (
                <View style={styles.prayerLoadingRow}>
                  <FontAwesome name="map-marker" size={13} color={Colors.primary} />
                  <Text style={styles.prayerLoadingText}>
                    Jadwal tidak tersedia — ketuk untuk atur lokasi
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── child 2: main content ── */}
        <View style={{ backgroundColor: Colors.background }}>
      <Modal
        visible={sholatModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPickerMode("jadwal");
          setSholatModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>

            {/* ===== JADWAL VIEW ===== */}
            {pickerMode === "jadwal" && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Jadwal Sholat</Text>
                    <View style={styles.modalLocationRow}>
                      <FontAwesome name="map-marker" size={12} color={Colors.primary} />
                      <Text style={styles.modalLocationText}>
                        {locationResult?.displayName ?? "Lokasi belum diset"}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSholatModalVisible(false)}
                  >
                    <FontAwesome name="times" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {todayJadwal && (
                  <Text style={styles.modalDateText}>
                    {new Date().toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                )}

                {!todayJadwal && sholatError && (
                  <View style={styles.modalEmptyBox}>
                    <FontAwesome name="exclamation-circle" size={32} color={Colors.primaryLight} />
                    <Text style={styles.modalEmptyText}>{sholatError}</Text>
                  </View>
                )}

                {todayJadwal && (
                  <View style={styles.prayerList}>
                    {PRAYER_DISPLAY.map(({ key, label }) => {
                      const time = todayJadwal?.[key] as string | undefined;
                      const isNext = nextPrayer?.key === key;
                      return (
                        <View
                          key={key}
                          style={[
                            styles.prayerRow,
                            isNext && styles.prayerRowActive,
                          ]}
                        >
                          <View style={[styles.prayerIconWrap, isNext && styles.prayerIconWrapActive]}>
                            <FontAwesome5
                              name="mosque"
                              size={14}
                              color={isNext ? "#fff" : Colors.primary}
                            />
                          </View>
                          <Text style={[styles.prayerLabel, isNext && styles.prayerLabelActive]}>
                            {label}
                          </Text>
                          <Text style={[styles.prayerTime, isNext && styles.prayerTimeActive]}>
                            {time ?? "-"}
                          </Text>
                          {isNext && (
                            <View style={styles.prayerBadge}>
                              <Text style={styles.prayerBadgeText}>{nextPrayer.timeLeft} lagi</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, styles.modalActionBtnSecondary]}
                    onPress={handleAutoDetect}
                  >
                    <FontAwesome name="location-arrow" size={13} color={Colors.primary} />
                    <Text style={[styles.modalActionBtnText, { color: Colors.primary }]}>
                      Deteksi Otomatis
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, styles.modalActionBtnPrimary]}
                    onPress={openManualPicker}
                  >
                    <FontAwesome name="map-marker" size={13} color="#fff" />
                    <Text style={[styles.modalActionBtnText, { color: "#fff" }]}>
                      Pilih Manual
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ===== PROVINSI PICKER ===== */}
            {pickerMode === "provinsi" && (
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.pickerBackBtn}
                    onPress={() => setPickerMode("jadwal")}
                  >
                    <FontAwesome name="arrow-left" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { flex: 1, marginLeft: 10 }]}>Pilih Provinsi</Text>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => { setPickerMode("jadwal"); setSholatModalVisible(false); }}
                  >
                    <FontAwesome name="times" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {pickerLoading ? (
                  <View style={styles.pickerLoading}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.pickerLoadingText}>Memuat provinsi...</Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.pickerScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {provinsiList.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={styles.pickerItem}
                        onPress={() => handleSelectProvinsi(p)}
                      >
                        <Text style={styles.pickerItemText}>{p}</Text>
                        <FontAwesome name="chevron-right" size={12} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    ))}
                    {provinsiList.length === 0 && (
                      <Text style={styles.pickerEmptyText}>Gagal memuat daftar provinsi</Text>
                    )}
                  </ScrollView>
                )}
              </>
            )}

            {/* ===== KABKOTA PICKER ===== */}
            {pickerMode === "kabkota" && (
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.pickerBackBtn}
                    onPress={() => setPickerMode("provinsi")}
                  >
                    <FontAwesome name="arrow-left" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.modalTitle}>Pilih Kab/Kota</Text>
                    <Text style={styles.pickerSubtitle}>{pickerSelectedProvinsi}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => { setPickerMode("jadwal"); setSholatModalVisible(false); }}
                  >
                    <FontAwesome name="times" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {pickerLoading ? (
                  <View style={styles.pickerLoading}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.pickerLoadingText}>Memuat kota...</Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.pickerScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {kabkotaList.map((k) => (
                      <TouchableOpacity
                        key={k}
                        style={[
                          styles.pickerItem,
                          locationResult?.kabkota === k && styles.pickerItemActive,
                        ]}
                        onPress={() => handleSelectKabkota(k)}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            locationResult?.kabkota === k && styles.pickerItemTextActive,
                          ]}
                        >
                          {k}
                        </Text>
                        {locationResult?.kabkota === k ? (
                          <FontAwesome name="check" size={12} color={Colors.primary} />
                        ) : (
                          <FontAwesome name="chevron-right" size={12} color={Colors.textSecondary} />
                        )}
                      </TouchableOpacity>
                    ))}
                    {kabkotaList.length === 0 && (
                      <Text style={styles.pickerEmptyText}>Gagal memuat daftar kota</Text>
                    )}
                  </ScrollView>
                )}
              </>
            )}

          </View>
        </View>
      </Modal>

      {/* ===== Qibla Modal ===== */}
      {Platform.OS !== "web" && <Modal
        visible={qiblaModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQiblaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingBottom: 20, maxHeight: "93%" }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Arah Kiblat</Text>
                {qiblaCoords && (
                  <Text style={styles.modalLocationText}>
                    {qiblaCoords.lat.toFixed(4)}, {qiblaCoords.lon.toFixed(4)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setQiblaModalVisible(false)}
              >
                <FontAwesome name="times" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Body */}
            {qiblaLoading ? (
              <View style={styles.qiblaCenter}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.qiblaLoadingText}>Mendeteksi lokasi...</Text>
              </View>
            ) : qiblaError ? (
              <View style={styles.qiblaCenter}>
                <FontAwesome name="exclamation-circle" size={36} color="#EF5350" />
                <Text style={styles.qiblaErrorText}>{qiblaError}</Text>
                <TouchableOpacity style={styles.qiblaRetryBtn} onPress={loadQiblaData}>
                  <FontAwesome name="refresh" size={13} color="#fff" />
                  <Text style={styles.qiblaRetryBtnText}>Coba Lagi</Text>
                </TouchableOpacity>
              </View>
            ) : qiblaData && qiblaData.bearing != null ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                {/* Live compass */}
                <View style={styles.qiblaCompassWrap}>
                  <QiblaCompassLive
                    bearing={qiblaData.bearing}
                    deviceHeading={deviceHeading}
                    compassAvailable={compassAvailable}
                  />
                </View>

                {/* Bearing info */}
                <View style={styles.qiblaBearingRow}>
                  <View style={styles.qiblaBearingBox}>
                    <Text style={styles.qiblaBearingValue}>
                      {qiblaData.bearing.toFixed(1)}°
                    </Text>
                    <Text style={styles.qiblaBearingLabel}>dari Utara</Text>
                  </View>
                  <View style={styles.qiblaCardinalBox}>
                    <Text style={styles.qiblaCardinalValue}>
                      {bearingToCardinal(qiblaData.bearing)}
                    </Text>
                    <Text style={styles.qiblaCardinalLabel}>arah kiblat</Text>
                  </View>
                </View>

                {/* Web desktop: static instruction */}
                {(Platform.OS === "web" && !compassAvailable) && (
                  <View style={styles.qiblaInstructionBox}>
                    <FontAwesome name="info-circle" size={15} color={Colors.primary} style={{ marginTop: 1 }} />
                    <Text style={styles.qiblaInstructionText}>
                      Hadapkan diri ke arah{" "}
                      <Text style={{ fontWeight: "700" }}>{qiblaData.bearing.toFixed(0)}° dari Utara</Text>
                      {" "}({bearingToCardinal(qiblaData.bearing)}). Gunakan kompas fisik untuk menentukan Utara terlebih dahulu.
                    </Text>
                  </View>
                )}

                {/* Re-detect button */}
                <TouchableOpacity style={styles.qiblaRedetectBtn} onPress={loadQiblaData}>
                  <FontAwesome name="location-arrow" size={13} color={Colors.primary} />
                  <Text style={styles.qiblaRedetectText}>Deteksi Ulang Lokasi</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>}

      {/* ===== Lanjut Bacaan (hero hijau) ===== */}
        {readingPosition ? (
          <View style={styles.lanjutCard}>
            <View style={styles.lanjutBadgeRow}>
              <View style={styles.lanjutBadge}>
                <View style={styles.lanjutBadgeDot} />
                <Text style={styles.lanjutBadgeText}>LANJUTKAN</Text>
              </View>
              <FontAwesome name="bookmark-o" size={18} color="rgba(255,255,255,0.85)" />
            </View>
            <View style={styles.lanjutBody}>
              <View style={styles.lanjutTextWrap}>
                <Text style={styles.lanjutTitle}>Lanjut Bacaan</Text>
                <Text style={styles.lanjutSurah}>QS. {readingPosition.surahName}</Text>
                <Text style={styles.lanjutMeta}>
                  Halaman {readingPosition.page} • Juz {readingPosition.juz}
                </Text>
                <TouchableOpacity
                  style={styles.lanjutButton}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: "/mushaf",
                      params: { page: String(readingPosition.page) },
                    })
                  }
                >
                  <Text style={styles.lanjutButtonText}>Lanjut Membaca</Text>
                  <FontAwesome name="arrow-right" size={13} color={Colors.primaryDark} />
                </TouchableOpacity>
              </View>
              <Image
                source={require("@/assets/images/alquran-illustration.png")}
                style={styles.lanjutImage}
                resizeMode="contain"
              />
            </View>
          </View>
        ) : (
          <View style={styles.lanjutCard}>
            <View style={styles.lanjutBody}>
              <View style={styles.lanjutTextWrap}>
                <Text style={styles.lanjutTitle}>
                  Belajar Al-Qur'an{"\n"}Lebih Mudah!
                </Text>
                <Text style={styles.lanjutMeta}>
                  Tilawah, Tahsin, dan Talaqi dalam satu aplikasi
                </Text>
                <TouchableOpacity
                  style={styles.lanjutButton}
                  activeOpacity={0.85}
                  onPress={() => router.push("/mushaf")}
                >
                  <Text style={styles.lanjutButtonText}>Buka Mushaf</Text>
                  <FontAwesome name="arrow-right" size={13} color={Colors.primaryDark} />
                </TouchableOpacity>
              </View>
              <Image
                source={require("@/assets/images/alquran-illustration.png")}
                style={styles.lanjutImage}
                resizeMode="contain"
              />
            </View>
          </View>
        )}

        {/* ===== Progress & Streak ===== */}
        <View style={styles.progressRow}>
          <TouchableOpacity
            style={styles.progressCard}
            activeOpacity={0.85}
            onPress={() => router.push("/tilawah-harian")}
          >
            <View style={styles.progressHeaderRow}>
              <View style={styles.progressIconBox}>
                <FontAwesome name="book" size={14} color={Colors.primary} />
              </View>
              <Text style={styles.progressCardTitle} numberOfLines={2}>
                Progress Tilawah Hari Ini
              </Text>
            </View>
            <View style={styles.progressValueRow}>
              <Text style={styles.progressValueBig}>{todayPages}</Text>
              <Text style={styles.progressValueSep}> / {DAILY_TILAWAH_TARGET}</Text>
              <Text style={styles.progressValueUnit}> halaman</Text>
            </View>
            <View style={styles.progressBarRow}>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${tilawahPercent}%` }]}
                />
              </View>
              <Text style={styles.progressPercent}>{tilawahPercent}%</Text>
            </View>
            <Text style={styles.progressHint} numberOfLines={1}>
              {todayPages >= DAILY_TILAWAH_TARGET
                ? "MasyaAllah! Target hari ini tercapai"
                : `Teruskan! ${DAILY_TILAWAH_TARGET - todayPages} halaman lagi untuk target hari ini`}
            </Text>
          </TouchableOpacity>

          <View style={styles.streakCard}>
            <View style={styles.progressHeaderRow}>
              <FontAwesome name="fire" size={16} color={Colors.accent} />
              <Text style={styles.progressCardTitle}>Streak Harian</Text>
            </View>
            <View style={styles.progressValueRow}>
              <Text style={styles.progressValueBig}>{streakDays}</Text>
              <Text style={styles.progressValueUnit}> hari</Text>
            </View>
            <View style={styles.streakBadge}>
              <FontAwesome name="sun-o" size={16} color={Colors.accent} />
            </View>
            <Text style={styles.progressHint} numberOfLines={2}>
              {streakDays > 0
                ? "Semangat! Pertahankan kebiasaan baik ini"
                : "Mulai catat tilawahmu hari ini"}
            </Text>
          </View>
        </View>

        {/* Menu Utama — grid hijau seragam */}
        <View style={styles.categoryGrid}>
          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => setMushafModalVisible(true)}
          >
            <View style={styles.categoryIcon}>
              <FontAwesome name="book" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.categoryLabel}>Mushaf{"\n"}Al-Qur'an</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/hadis")}
          >
            <View style={styles.categoryIcon}>
              <FontAwesome name="list-alt" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.categoryLabel}>Koleksi{"\n"}Hadis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/doa")}
          >
            <View style={styles.categoryIcon}>
              <FontAwesome5 name="praying-hands" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.categoryLabel}>Untaian{"\n"}Do'a</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/sambung-ayat")}
          >
            <View style={styles.categoryIcon}>
              <FontAwesome name="puzzle-piece" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.categoryLabel}>Sambung{"\n"}Ayat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/tasbih")}
          >
            <View style={styles.categoryIcon}>
              <FontAwesome name="circle-o-notch" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.categoryLabel}>Tasbih{"\n"}Digital</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/dzikir")}
          >
            <View style={styles.categoryIcon}>
              <FontAwesome name="leaf" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.categoryLabel}>Dzikir{"\n"}Harian</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/tarbiyah/tahsin")}
          >
            <View style={styles.categoryIcon}>
              <FontAwesome name="graduation-cap" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.categoryLabel}>Tajwid{"\n"}Dasar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/(tabs)/talaqi")}
          >
            <View style={styles.categoryIcon}>
              <FontAwesome name="pencil-square-o" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.categoryLabel}>Catatan{"\n"}Talaqi</Text>
          </TouchableOpacity>

          {Platform.OS !== "web" && (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => {
                setQiblaModalVisible(true);
                if (!qiblaData && !qiblaLoading) loadQiblaData();
              }}
            >
              <View style={styles.categoryIcon}>
                <FontAwesome name="compass" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.categoryLabel}>Arah{"\n"}Kiblat</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ===== Target Hari Ini ===== */}
        <View style={styles.targetCard}>
          <View style={styles.targetHeaderRow}>
            <View style={styles.targetHeaderLeft}>
              <View style={styles.targetIconBox}>
                <FontAwesome name="bullseye" size={14} color={Colors.primary} />
              </View>
              <Text style={styles.targetTitle}>Target Hari Ini</Text>
            </View>
            <FontAwesome name="chevron-right" size={13} color={Colors.textSecondary} />
          </View>
          <View style={styles.targetItemsRow}>
            <TouchableOpacity
              style={styles.targetItem}
              activeOpacity={0.8}
              onPress={() => router.push("/tilawah-harian")}
            >
              <View style={styles.targetItemIcon}>
                <FontAwesome name="book" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.targetItemLabel}>Tilawah</Text>
              <Text style={styles.targetItemValue}>
                {todayPages} / {DAILY_TILAWAH_TARGET} halaman
              </Text>
              <View style={styles.targetItemTrack}>
                <View
                  style={[styles.targetItemFill, { width: `${tilawahPercent}%` }]}
                />
              </View>
            </TouchableOpacity>

            <View style={styles.targetDivider} />

            <TouchableOpacity
              style={styles.targetItem}
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/tarbiyah")}
            >
              <View style={styles.targetItemIcon}>
                <Text style={styles.targetItemArab}>ي</Text>
              </View>
              <Text style={styles.targetItemLabel}>Tajwid</Text>
              <Text style={styles.targetItemValue} numberOfLines={1}>
                Pelajari idzhar
              </Text>
              <View style={styles.targetItemTrack}>
                <View style={[styles.targetItemFill, { width: "35%" }]} />
              </View>
            </TouchableOpacity>

            <View style={styles.targetDivider} />

            <TouchableOpacity
              style={styles.targetItem}
              activeOpacity={0.8}
              onPress={() => router.push("/dzikir")}
            >
              <View style={styles.targetItemIcon}>
                <FontAwesome name="leaf" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.targetItemLabel}>Dzikir Pagi</Text>
              <Text style={styles.targetItemValue}>
                {dzikirPagiDone} / {dzikirPagiTotal} dzikir
              </Text>
              <View style={styles.targetItemTrack}>
                <View
                  style={[
                    styles.targetItemFill,
                    {
                      width: `${Math.min(
                        Math.round((dzikirPagiDone / Math.max(dzikirPagiTotal, 1)) * 100),
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== Lanjut Terakhir ===== */}
        {lastTilawah && (
          <TouchableOpacity
            style={styles.lastReadCard}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/surah/[surahNumber]",
                params: {
                  surahNumber: String(lastTilawah.suratNumber),
                  surahName: lastTilawah.suratName,
                },
              })
            }
          >
            <View style={styles.lastReadLeft}>
              <View style={styles.lastReadIconBox}>
                <FontAwesome name="clock-o" size={18} color={Colors.accent} />
              </View>
              <View style={styles.lastReadTextWrap}>
                <Text style={styles.lastReadLabel}>Lanjut Terakhir</Text>
                <Text style={styles.lastReadSurah}>QS. {lastTilawah.suratName}</Text>
                <Text style={styles.lastReadMeta}>
                  {lastTilawah.jumlahHalaman} halaman • Juz {lastTilawah.juz}
                </Text>
                <Text style={styles.lastReadTime}>
                  Terakhir dibaca {relativeDateText(lastTilawah.tanggal)}
                </Text>
              </View>
            </View>
            <View style={styles.lastReadButton}>
              <Text style={styles.lastReadButtonText}>Lanjutkan</Text>
              <FontAwesome name="chevron-right" size={11} color={Colors.primary} />
            </View>
          </TouchableOpacity>
        )}

        {/* ===== Ceramah Video Section ===== */}
        {ceramahVideos && ceramahVideos.length > 0 && (() => {
          const liveVideos = ceramahVideos.filter((v) => v.isLive);
          const regularVideos = ceramahVideos.filter((v) => !v.isLive);
          const featuredLive = liveVideos[0] ?? null;
          return (
            <>
              {/* Featured Live Video */}
              {featuredLive && (() => {
                const videoId = extractYouTubeId(featuredLive.youtubeUrl);
                const thumbUri = videoId
                  ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                  : null;
                return (
                  <View style={styles.ceramahSection}>
                    <View style={styles.sectionHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={styles.liveDot} />
                        <Text style={styles.sectionTitle}>Siaran Langsung</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.featuredLiveCard}
                      activeOpacity={0.9}
                      onPress={() => {
                        setSelectedVideo({ youtubeUrl: featuredLive.youtubeUrl, judul: featuredLive.judul, isLive: true });
                        setIsFullscreen(false);
                        setVideoModalVisible(true);
                      }}
                    >
                      {thumbUri ? (
                        <Image source={{ uri: thumbUri }} style={styles.featuredLiveThumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.featuredLiveThumb, { backgroundColor: "#1a1a1a" }]} />
                      )}
                      <View style={styles.featuredLiveOverlay}>
                        <View style={styles.liveBadgeRow}>
                          <View style={styles.liveBadge}>
                            <View style={styles.liveBadgeDot} />
                            <Text style={styles.liveBadgeText}>LIVE</Text>
                          </View>
                        </View>
                        <View style={styles.featuredLivePlayBtn}>
                          <FontAwesome name="play-circle" size={56} color="rgba(255,255,255,0.92)" />
                        </View>
                        <View style={styles.featuredLiveInfo}>
                          <Text style={styles.featuredLiveTitle} numberOfLines={2}>
                            {featuredLive.judul}
                          </Text>
                          {featuredLive.deskripsi ? (
                            <Text style={styles.featuredLiveDesc} numberOfLines={1}>
                              {featuredLive.deskripsi}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {/* Regular Videos List */}
              {regularVideos.length > 0 && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Video Ceramah</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.ceramahScroll}
                  >
                    {regularVideos.map((item) => {
                      const videoId = extractYouTubeId(item.youtubeUrl);
                      const thumbUri = videoId
                        ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
                        : null;
                      return (
                        <TouchableOpacity
                          key={item._id}
                          style={styles.ceramahCard}
                          activeOpacity={0.85}
                          onPress={() => {
                            setSelectedVideo({ youtubeUrl: item.youtubeUrl, judul: item.judul, isLive: false });
                            setIsFullscreen(false);
                            setVideoModalVisible(true);
                          }}
                        >
                          <View style={styles.ceramahThumbWrap}>
                            {thumbUri ? (
                              <Image source={{ uri: thumbUri }} style={styles.ceramahThumb} resizeMode="cover" />
                            ) : (
                              <View style={[styles.ceramahThumb, { backgroundColor: "#1a1a1a" }]} />
                            )}
                            <View style={styles.ceramahPlayOverlay}>
                              <FontAwesome name="play-circle" size={30} color="rgba(255,255,255,0.88)" />
                            </View>
                          </View>
                          <Text style={styles.ceramahCardTitle} numberOfLines={2}>
                            {item.judul}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </>
          );
        })()}

        {/* Hadis Harian */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hadis Harian</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push("/hadis")}
            >
              <FontAwesome name="search" size={16} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={loadRandomHadis} disabled={hadisLoading}>
              <FontAwesome name="refresh" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.hadisCard}>
          {hadisLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ paddingVertical: 24 }} />
          ) : hadis ? (
            <>
              {hadis.grade || hadis.takhrij ? (
                <View style={styles.hadisMetaRow}>
                  {hadis.takhrij ? (
                    <View style={styles.hadisMetaBadge}>
                      <Text style={styles.hadisMetaText}>{hadis.takhrij}</Text>
                    </View>
                  ) : null}
                  {hadis.grade ? (
                    <View style={[styles.hadisMetaBadge, styles.hadisGradeBadge]}>
                      <Text style={styles.hadisMetaText}>{hadis.grade}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.hadisArab}>{hadis.text.ar}</Text>
              <View style={styles.hadisDivider} />
              <Text style={styles.hadisIndo}>{hadis.text.id}</Text>
              <View style={styles.hadisNav}>
                <TouchableOpacity style={styles.hadisNavBtn} onPress={handlePrevHadis}>
                  <FontAwesome name="chevron-left" size={13} color={Colors.primary} />
                  <Text style={styles.hadisNavText}>Sebelumnya</Text>
                </TouchableOpacity>
                <Text style={styles.hadisId}>#{hadis.id}</Text>
                <TouchableOpacity style={styles.hadisNavBtn} onPress={handleNextHadis}>
                  <Text style={styles.hadisNavText}>Berikutnya</Text>
                  <FontAwesome name="chevron-right" size={13} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.hadisError}>Gagal memuat hadis</Text>
          )}
        </View>

        {/* Popular Surahs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Surah Populer</Text>
          <TouchableOpacity onPress={() => setMode("surah-list")}>
            <Text style={styles.viewAll}>Lihat semua →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.popularScroll}
        >
          {getPopularSurahs().map((surah) => (
            <TouchableOpacity
              key={surah.number}
              style={styles.popularCard}
              onPress={() =>
                router.push({
                  pathname: "/surah/[surahNumber]",
                  params: {
                    surahNumber: surah.number.toString(),
                    surahName: surah.englishName,
                  },
                })
              }
            >
              <View style={styles.popularTop}>
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>{surah.number}</Text>
                </View>
                <FontAwesome name="play-circle" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.popularArabic}>{surah.name}</Text>
              <Text style={styles.popularName}>{surah.englishName}</Text>
              <Text style={styles.popularMeta}>
                {surah.numberOfAyahs} ayat
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ height: 16 }} />
        </View>
      </Animated.ScrollView>

      {/* ===== YouTube Video Player Modal ===== */}
      <Modal
        visible={videoModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setVideoModalVisible(false);
          setIsFullscreen(false);
        }}
        supportedOrientations={["portrait", "landscape"]}
      >
        <View style={[styles.videoModalContainer, isFullscreen && styles.videoModalFullscreen]}>
          {/* Header bar */}
          {!isFullscreen && (
            <View style={[styles.videoModalHeader, { paddingTop: 48 }]}>
              <TouchableOpacity
                style={styles.videoModalCloseBtn}
                onPress={() => { setVideoModalVisible(false); setIsFullscreen(false); }}
              >
                <FontAwesome name="arrow-left" size={18} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.videoModalTitle} numberOfLines={1}>
                {selectedVideo?.judul ?? ""}
              </Text>
              {selectedVideo?.isLive && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveBadgeDot} />
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.videoModalFullscreenBtn}
                onPress={() => setIsFullscreen(true)}
              >
                <FontAwesome name="expand" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Player */}
          <View style={isFullscreen ? styles.videoPlayerFullscreen : styles.videoPlayer}>
            {selectedVideo && (() => {
              const videoId = extractYouTubeId(selectedVideo.youtubeUrl);
              if (!videoId) return (
                <View style={styles.videoPlayerError}>
                  <FontAwesome name="exclamation-circle" size={32} color="#aaa" />
                  <Text style={{ color: "#aaa", marginTop: 8 }}>URL YouTube tidak valid</Text>
                </View>
              );
              return <YouTubePlayer videoId={videoId} style={{ flex: 1 }} />;
            })()}
          </View>

          {/* Fullscreen exit button */}
          {isFullscreen && (
            <TouchableOpacity
              style={styles.videoExitFullscreenBtn}
              onPress={() => setIsFullscreen(false)}
            >
              <FontAwesome name="compress" size={18} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Video info (non-fullscreen) */}
          {!isFullscreen && selectedVideo && (
            <View style={styles.videoInfoArea}>
              <Text style={styles.videoInfoTitle}>{selectedVideo.judul}</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* ===== Mushaf mode chooser ===== */}
      <Modal
        visible={mushafModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMushafModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Mushaf Al-Qur'an</Text>
                <Text style={styles.modalDateText}>Pilih cara membaca Al-Qur'an</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setMushafModalVisible(false)}
              >
                <FontAwesome name="times" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.mushafChoiceCard}
              onPress={() => {
                setMushafModalVisible(false);
                setMode("surah-list");
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.mushafChoiceIcon, { backgroundColor: "#E8F5E9" }]}>
                <FontAwesome name="list" size={22} color={Colors.primary} />
              </View>
              <View style={styles.mushafChoiceTextWrap}>
                <Text style={styles.mushafChoiceTitle}>Per Surah</Text>
                <Text style={styles.mushafChoiceDesc}>
                  Pilih surah dari daftar untuk dibaca
                </Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mushafChoiceCard}
              onPress={() => {
                setMushafModalVisible(false);
                router.push("/mushaf");
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.mushafChoiceIcon, { backgroundColor: "#FFF3E0" }]}>
                <FontAwesome name="book" size={22} color="#E65100" />
              </View>
              <View style={styles.mushafChoiceTextWrap}>
                <Text style={styles.mushafChoiceTitle}>Mushaf Full</Text>
                <Text style={styles.mushafChoiceDesc}>
                  Baca mushaf lengkap per halaman
                </Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: Colors.primary,
  },
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

  // ===== Header =====
  headerShell: {
    // kept for reference, no longer used
  },
  header: {
    backgroundColor: "transparent",
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
  },
  headerImageBg: {
    ...StyleSheet.absoluteFillObject,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    zIndex: 2,
    position: "relative",
  },
  greetingWrap: {
    marginTop: 6,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: "500",
  },
  greetingNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userName: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.primaryDark,
    marginTop: 2,
  },
  greetingSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 260,
  },

  // ===== Kartu Waktu Sholat =====
  prayerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: "#0F4A28",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  prayerIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  prayerLoadingRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  prayerLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  prayerInfoWrap: {
    flex: 1,
  },
  prayerName: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  prayerTimeBig: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 1,
  },
  prayerLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  prayerLocationText: {
    fontSize: 10,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  prayerRightWrap: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
  },
  prayerCountdownText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  prayerProgressTrack: {
    width: 110,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight,
    overflow: "hidden",
  },
  prayerProgressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },

  // ===== Sticky Search Bar =====
  stickySearchWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  stickySearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBarInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    shadowColor: "#0F4A28",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  avatarCircleTop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarImageTop: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarOnlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#34C759",
    borderWidth: 2,
    borderColor: "#fff",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  searchPlaceholder: {
    color: Colors.textSecondary,
    fontSize: 15,
  },

  // ===== Sholat Modal =====
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
  },
  modalLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  modalLocationText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "600",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalDateText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 16,
    marginTop: 2,
  },
  modalEmptyBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  modalEmptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  prayerList: {
    gap: 8,
    marginBottom: 20,
  },
  prayerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.backgroundLight,
    gap: 12,
  },
  prayerRowActive: {
    backgroundColor: Colors.primary,
  },
  prayerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  prayerIconWrapActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  prayerLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  prayerLabelActive: {
    color: "#fff",
  },
  prayerTime: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  prayerTimeActive: {
    color: "#fff",
  },
  prayerBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  prayerBadgeText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalActionBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  modalActionBtnSecondary: {
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    backgroundColor: "#fff",
  },
  modalActionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // ===== Mushaf mode chooser =====
  mushafChoiceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: Colors.backgroundLight,
    marginTop: 12,
  },
  mushafChoiceIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  mushafChoiceTextWrap: {
    flex: 1,
  },
  mushafChoiceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  mushafChoiceDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // ===== Location Picker =====
  pickerBackBtn: {
    padding: 4,
  },
  pickerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pickerLoading: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  pickerLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pickerScroll: {
    marginTop: 12,
    maxHeight: 380,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: Colors.backgroundLight,
  },
  pickerItemActive: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  pickerItemText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  pickerItemTextActive: {
    color: Colors.primaryDark,
    fontWeight: "600",
  },
  pickerEmptyText: {
    textAlign: "center",
    fontSize: 13,
    color: Colors.textSecondary,
    paddingVertical: 20,
  },

  // ===== Lanjut Bacaan (hero hijau) =====
  lanjutCard: {
    marginHorizontal: 20,
    marginTop: 4,
    backgroundColor: Colors.primaryDark,
    borderRadius: 22,
    padding: 20,
    overflow: "hidden",
    shadowColor: "#0F4A28",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  lanjutBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  lanjutBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  lanjutBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7BE495",
  },
  lanjutBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#DFF3E5",
    letterSpacing: 1,
  },
  lanjutBody: {
    flexDirection: "row",
    alignItems: "center",
  },
  lanjutTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  lanjutTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 30,
  },
  lanjutSurah: {
    fontSize: 15,
    color: "rgba(255,255,255,0.92)",
    marginTop: 6,
    fontWeight: "600",
  },
  lanjutMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 3,
    lineHeight: 18,
  },
  lanjutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignSelf: "flex-start",
    marginTop: 16,
  },
  lanjutButtonText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
  lanjutImage: {
    width: 130,
    height: 130,
    marginRight: -14,
    marginBottom: -14,
  },

  // ===== Progress & Streak =====
  progressRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 14,
    gap: 12,
  },
  progressCard: {
    flex: 1.35,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0F4A28",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  streakCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0F4A28",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  progressHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  progressCardTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 16,
  },
  progressValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 12,
  },
  progressValueBig: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.text,
  },
  progressValueSep: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 4,
  },
  progressValueUnit: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  progressBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primaryLight,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  progressHint: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 10,
    lineHeight: 14,
  },
  streakBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FBF3E2",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  // ===== Section =====
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
  },
  viewAll: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "600",
  },

  // ===== Category Grid =====
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    marginTop: 16,
    gap: 10,
  },
  categoryCard: {
    width: (width - 48) / 4 - 5, // 4 columns with 14px horizontal padding and 10px gap
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    shadowColor: "#0F4A28",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.text,
    lineHeight: 15,
    textAlign: "center",
  },

  // ===== Target Hari Ini =====
  targetCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0F4A28",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  targetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  targetHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  targetIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  targetTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  targetItemsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  targetItem: {
    flex: 1,
    alignItems: "flex-start",
    gap: 4,
    paddingHorizontal: 4,
  },
  targetItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  targetItemArab: {
    fontFamily: "AmiriQuran",
    fontSize: 18,
    color: Colors.primary,
  },
  targetItemLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
  },
  targetItemValue: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  targetItemTrack: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight,
    overflow: "hidden",
    marginTop: 4,
  },
  targetItemFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  targetDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },

  // ===== Lanjut Terakhir =====
  lastReadCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: "#FDF9EF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1E7CE",
  },
  lastReadLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  lastReadIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FBF3E2",
    justifyContent: "center",
    alignItems: "center",
  },
  lastReadTextWrap: {
    flex: 1,
  },
  lastReadLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  lastReadSurah: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 1,
  },
  lastReadMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  lastReadTime: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  lastReadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#EFE3C8",
    marginLeft: 10,
  },
  lastReadButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },

  // ===== Popular Surahs =====
  popularScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  popularCard: {
    width: 140,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  popularTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  popularBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.primaryDark,
  },
  popularArabic: {
    fontFamily: "AmiriQuran",
    fontSize: 20,
    color: Colors.text,
    marginBottom: 4,
  },
  popularName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  popularMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // ===== Surah List Mode =====
  listHeader: {
    backgroundColor: Colors.primary,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listHeaderTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  searchContainerList: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInputList: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  surahCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  surahNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  surahNumberText: {
    color: Colors.primaryDark,
    fontWeight: "bold",
    fontSize: 14,
  },
  surahInfo: {
    flex: 1,
  },
  surahEnglish: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  surahTranslation: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  surahArabic: {
    fontFamily: "AmiriQuran",
    fontSize: 20,
    color: Colors.text,
  },

  // ===== Hadis Harian =====
  hadisCard: {
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  hadisArab: {
    fontFamily: "AmiriQuran",
    fontSize: 22,
    color: Colors.text,
    textAlign: "right",
    lineHeight: 40,
  },
  hadisDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  hadisIndo: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  hadisNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  hadisNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  hadisNavText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600",
  },
  hadisId: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  hadisError: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: 16,
  },
  hadisMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  hadisMetaBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hadisGradeBadge: {
    backgroundColor: "#FFF3E0",
  },
  hadisMetaText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: "600",
  },

  // ===== Hadis Search Results =====
  hadisSearchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  hadisSearchBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  hadisSearchResultCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  hadisSearchResultBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  hadisSearchResultBadgeText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: "bold",
  },
  hadisSearchResultText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
    flex: 1,
  },

  // ===== Qibla =====
  qiblaCenter: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  qiblaLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  qiblaErrorText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  qiblaRetryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  qiblaRetryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  qiblaCompassWrap: {
    alignItems: "center",
    marginVertical: 12,
  },
  qiblaBearingRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  qiblaBearingBox: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  qiblaBearingValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.primaryDark,
  },
  qiblaBearingLabel: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2,
  },
  qiblaCardinalBox: {
    flex: 1,
    backgroundColor: "#E8EAF6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  qiblaCardinalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#283593",
  },
  qiblaCardinalLabel: {
    fontSize: 11,
    color: "#3949AB",
    marginTop: 2,
  },
  qiblaInstructionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.backgroundLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  qiblaInstructionText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  qiblaRedetectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    backgroundColor: "#fff",
  },
  qiblaRedetectText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  // Alignment badge (live compass)
  qiblaAlignBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  qiblaAlignBadgeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  qiblaAlignText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  qiblaAlignTextActive: {
    color: "#fff",
  },
  qiblaNoCompassBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qiblaNoCompassText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },

  // ===== Ceramah Video Section =====
  ceramahSection: {
    marginBottom: 4,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E53935",
  },
  // Featured live card
  featuredLiveCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
    backgroundColor: "#000",
  },
  featuredLiveThumb: {
    width: "100%",
    height: 200,
  },
  featuredLiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "space-between",
    padding: 14,
  },
  liveBadgeRow: {
    flexDirection: "row",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E53935",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
    alignSelf: "flex-start",
  },
  liveBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  featuredLivePlayBtn: {
    alignSelf: "center",
    marginTop: -20,
  },
  featuredLiveInfo: {
    gap: 3,
  },
  featuredLiveTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 20,
  },
  featuredLiveDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  // Regular video horizontal list
  ceramahScroll: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 4,
  },
  ceramahCard: {
    width: 170,
    gap: 8,
  },
  ceramahThumbWrap: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  ceramahThumb: {
    width: 170,
    height: 96,
  },
  ceramahPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  ceramahCardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
    lineHeight: 18,
  },

  // ===== Video Player Modal =====
  videoModalContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoModalFullscreen: {
    flex: 1,
  },
  videoModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#111",
    gap: 10,
  },
  videoModalCloseBtn: {
    padding: 4,
  },
  videoModalTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  videoModalFullscreenBtn: {
    padding: 4,
  },
  videoPlayer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
  },
  videoPlayerFullscreen: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoPlayerError: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  videoExitFullscreenBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    padding: 10,
  },
  videoInfoArea: {
    padding: 16,
    backgroundColor: "#111",
    flex: 1,
  },
  videoInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 22,
  },
});
