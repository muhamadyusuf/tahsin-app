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
  Dimensions,
  Image,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
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

const { width } = Dimensions.get("window");

// Quick access surahs
const POPULAR_SURAHS = [36, 67, 56, 18, 55, 1]; // Yasin, Al-Mulk, Al-Waqi'ah, Al-Kahf, Ar-Rahman, Al-Fatihah

type ScreenMode = "home" | "surah-list" | "hadis-search";

export default function TilawahScreen() {
  const router = useRouter();
  const { userData } = useAuthContext();
  const insets = useSafeAreaInsets();
  const appConfig = useQuery(api.appConfig.getPublicConfig, {});
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
    <View style={[styles.container, { backgroundColor: Colors.primary }]}>
      {/* Full-header background: covers sticky bar + scrollable header */}
      {headerImageUrl ? (
        <Image
          source={{ uri: headerImageUrl }}
          style={[StyleSheet.absoluteFillObject, { height: 230 }]}
          resizeMode="cover"
        />
      ) : null}
      {headerImageUrl ? (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.28)" }]} />
      ) : null}

      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        // contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── child 0: sticky search bar (top) ── */}
        <View style={[styles.stickySearchWrapper, { paddingTop: insets.top + 10 }]}>
          <View style={styles.stickySearchRow}>
            <TouchableOpacity
              style={styles.searchBarInner}
              onPress={() => setMode("surah-list")}
            >
              <FontAwesome name="search" size={16} color={Colors.textSecondary} />
              <Text style={styles.searchPlaceholder}>Cari surah...</Text>
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
            </TouchableOpacity>
          </View>
        </View>

        {/* ── child 1: scrollable header ── */}
        <View style={[styles.header, { paddingTop: 0 }]}>
          <View style={styles.headerContent}>
            {/* Greeting row */}
            {/* <View style={styles.headerTopRow}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.greeting}>Assalamu'alaikum 👋</Text>
                <Text style={styles.userName}>{firstName}</Text>
              </View>
            </View> */}

            {/* Sholat widget */}
            <TouchableOpacity
              style={styles.sholatWidget}
              onPress={() => setSholatModalVisible(true)}
              activeOpacity={0.8}
            >
              {/* Location row */}
              <View style={styles.sholatLocationRow}>
                <FontAwesome name="map-marker" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.sholatLocationText} numberOfLines={1}>
                  {locationResult
                    ? locationResult.displayName
                    : sholatLoading
                    ? "Mendeteksi lokasi..."
                    : sholatError
                    ? "Lokasi tidak tersedia"
                    : "Memuat lokasi..."}
                </Text>
              </View>

              {/* Prayer info */}
              {sholatLoading && !nextPrayer ? (
                <View style={styles.sholatLoadingRow}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                  <Text style={styles.sholatLoadingText}>Memuat jadwal...</Text>
                </View>
              ) : nextPrayer ? (
                <View style={styles.sholatInfoRow}>
                  <View>
                    <Text style={styles.sholatNextLabel}>Waktu Sholat Berikutnya</Text>
                    <View style={styles.sholatNextRow}>
                      <FontAwesome5 name="mosque" size={14} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.sholatNextName}>{nextPrayer.name}</Text>
                      <Text style={styles.sholatNextTime}>{nextPrayer.time}</Text>
                    </View>
                  </View>
                  <View style={styles.sholatCountdownBox}>
                    <Text style={styles.sholatCountdownValue}>{nextPrayer.timeLeft}</Text>
                    <Text style={styles.sholatCountdownLabel}>lagi</Text>
                  </View>
                </View>
              ) : sholatError ? (
                <TouchableOpacity onPress={() => loadSholatData()} style={styles.sholatErrorRow}>
                  <FontAwesome name="refresh" size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.sholatErrorText}>Ketuk untuk coba lagi</Text>
                </TouchableOpacity>
              ) : null}

              {/* Tap hint */}
              {sholatData && (
                <View style={styles.sholatTapHint}>
                  <Text style={styles.sholatTapHintText}>Lihat semua waktu sholat →</Text>
                </View>
              )}
              <br/>
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

      {/* Tilawah Harian Card */}
        <TouchableOpacity
          style={styles.tilawahBanner}
          onPress={() => router.push("/tilawah-harian")}
        >
          <View style={styles.tilawahBannerIcon}>
            <FontAwesome name="pencil-square-o" size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tilawahBannerTitle}>Tilawah Harian</Text>
            <Text style={styles.tilawahBannerSub}>
              Catat & lihat riwayat bacaan harianmu
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={14} color={Colors.primary} />
        </TouchableOpacity>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>
              Belajar Al-Qur'an{"\n"}Lebih Mudah!
            </Text>
            <Text style={styles.heroSubtitle}>
              Tilawah, Tahsin, dan Talaqi{"\n"}dalam satu aplikasi
            </Text>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => router.push("/mushaf")}
            >
              <Text style={styles.heroButtonText}>Buka Mushaf</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.heroIconWrap}>
            {/* <FontAwesome name="book" size={56} color="rgba(255,255,255,0.9)" /> */}
              <Image
                  source={require("@/assets/images/alquran-illustration.png")}
                  style={styles.alquranImage}
                  resizeMode="contain"
                />
          </View>
        </View>

        {/* Menu Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Menu Utama</Text>
        </View>
        <View style={styles.categoryGrid}>
          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => setMode("surah-list")}
          >
            <View style={[styles.categoryIcon, { backgroundColor: "#E8F5E9" }]}>
              <FontAwesome name="list" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.categoryLabel}>Daftar{"\n"}Surah</Text>
            <FontAwesome
              name="chevron-right"
              size={12}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/mushaf")}
          >
            <View style={[styles.categoryIcon, { backgroundColor: "#FFF3E0" }]}>
              <FontAwesome name="book" size={22} color="#E65100" />
            </View>
            <Text style={styles.categoryLabel}>Mushaf{"\n"}Al-Qur'an</Text>
            <FontAwesome
              name="chevron-right"
              size={12}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/(tabs)/tahsin")}
          >
            <View style={[styles.categoryIcon, { backgroundColor: "#E3F2FD" }]}>
              <FontAwesome name="graduation-cap" size={20} color="#1565C0" />
            </View>
            <Text style={styles.categoryLabel}>Tahsin{"\n"}Tilawah</Text>
            <FontAwesome
              name="chevron-right"
              size={12}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/(tabs)/talaqi")}
          >
            <View style={[styles.categoryIcon, { backgroundColor: "#FCE4EC" }]}>
              <FontAwesome name="users" size={20} color="#C62828" />
            </View>
            <Text style={styles.categoryLabel}>Talaqi{"\n"}Online</Text>
            <FontAwesome
              name="chevron-right"
              size={12}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/hadis")}
          >
            <View style={[styles.categoryIcon, { backgroundColor: "#EDE7F6" }]}>
              <FontAwesome name="book" size={20} color="#4527A0" />
            </View>
            <Text style={styles.categoryLabel}>Koleksi{"\n"}Hadis</Text>
            <FontAwesome
              name="chevron-right"
              size={12}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => router.push("/doa")}
          >
            <View style={[styles.categoryIcon, { backgroundColor: "#E8F5E9" }]}>
              <FontAwesome5 name="praying-hands" size={20} color="#2E7D32" />
            </View>
            <Text style={styles.categoryLabel}>Kumpulan{"\n"}Do'a</Text>
            <FontAwesome
              name="chevron-right"
              size={12}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Hadis Harian */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hadis Harian</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                setHadisSearch("");
                setHadisSearchResults([]);
                setMode("hadis-search");
              }}
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
        <br/>
        </View>
      </ScrollView>
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
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 52,
  },
  greeting: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 2,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarInHeader: {
    position: "absolute",
    right: 0,
    top: 0,
  },

  // ===== Sholat Widget =====
  sholatWidget: {
    // backgroundColor: "rgba(255,255,255,0.15)",
    // borderRadius: 14,
    padding: 12,
    // borderWidth: 1,
    // borderColor: "rgba(255,255,255,0.25)",
  },
  sholatLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  sholatLocationText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    flex: 1,
  },
  sholatLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  sholatLoadingText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  sholatInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sholatNextLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 3,
  },
  sholatNextRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sholatNextName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginRight: 8,
  },
  sholatNextTime: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  sholatCountdownBox: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sholatCountdownValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#fff",
  },
  sholatCountdownLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
  },
  sholatErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  sholatErrorText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  sholatTapHint: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  sholatTapHintText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
  },

  // ===== Sticky Search Bar =====
  stickySearchWrapper: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingBottom: 10,
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
    backgroundColor: "#f2f2f2",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  avatarCircleTop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImageTop: {
    width: 44,
    height: 44,
    borderRadius: 22,
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

  // ===== Hero Banner =====
  heroBanner: {
    marginHorizontal: 20,
    marginTop: 0,
    backgroundColor: Colors.primaryDark,
    borderRadius: 20,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    lineHeight: 24,
  },
  heroSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 6,
    lineHeight: 18,
  },
  alquranImage: {
    width: 120,
    height: 120,
  },
  heroButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginTop: 14,
  },
  heroButtonText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
  heroIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },

  // ===== Tilawah Harian Banner =====
  tilawahBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: -40,
    marginBottom: 15,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tilawahBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
  },
  tilawahBannerTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.text,
  },
  tilawahBannerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // ===== Section =====
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 24,
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
    gap: 10,
  },
  categoryCard: {
    width: (width - 48) / 2,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
    lineHeight: 18,
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
});
