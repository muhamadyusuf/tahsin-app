import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import {
  ArbainItem,
  BmItem,
  PerawiInfo,
  PerawiHadisItem,
  HadisSearchItem,
  HadisData,
  getAllArbain,
  getArbainByNo,
  getBmByNo,
  getPerawiList,
  getHadisByPerawi,
  searchHadis,
  getHadisById,
} from "@/lib/hadis-api";

type Mode =
  | "home"
  | "arbain-list"
  | "arbain-detail"
  | "bm"
  | "perawi-select"
  | "perawi-hadis"
  | "search"
  | "search-detail";

const BM_MAX = 1597;
const ARBAIN_MAX = 42;

// Warna per kategori
const CATEGORY_COLORS = {
  arbain: { bg: "#E8F5E9", icon: Colors.primary, badge: "#C8E6C9" },
  bm: { bg: "#FFF3E0", icon: "#E65100", badge: "#FFE0B2" },
  perawi: { bg: "#EDE7F6", icon: "#4527A0", badge: "#D1C4E9" },
};

export default function HadisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("home");

  // ── Arbain state ──────────────────────────────────────────
  const [arbainList, setArbainList] = useState<ArbainItem[]>([]);
  const [arbainLoading, setArbainLoading] = useState(false);
  const [currentArbain, setCurrentArbain] = useState<ArbainItem | null>(null);

  // ── Bulughul Maram state ──────────────────────────────────
  const [bmData, setBmData] = useState<BmItem | null>(null);
  const [bmNo, setBmNo] = useState(1);
  const [bmInput, setBmInput] = useState("1");
  const [bmLoading, setBmLoading] = useState(false);

  // ── Search state ───────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HadisSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalPages, setSearchTotalPages] = useState(1);
  const [searchDetail, setSearchDetail] = useState<HadisData | null>(null);
  const [searchDetailLoading, setSearchDetailLoading] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // ── Perawi state ───────────────────────────────────────────
  const [perawiList, setPerawiList] = useState<PerawiInfo[]>([]);
  const [perawiLoading, setPerawiLoading] = useState(false);
  const [selectedPerawi, setSelectedPerawi] = useState<PerawiInfo | null>(null);
  const [perawiHadis, setPerawiHadis] = useState<PerawiHadisItem | null>(null);
  const [perawiNo, setPerawiNo] = useState(1);
  const [perawiInput, setPerawiInput] = useState("1");
  const [perawiHadisLoading, setPerawiHadisLoading] = useState(false);

  // ── Load Arbain list ──────────────────────────────────────
  const loadArbainList = async () => {
    if (arbainList.length > 0) {
      setMode("arbain-list");
      return;
    }
    setArbainLoading(true);
    try {
      const data = await getAllArbain();
      setArbainList(data);
      setMode("arbain-list");
    } catch {
      Alert.alert("Gagal", "Tidak dapat memuat daftar Hadis Arbain");
    } finally {
      setArbainLoading(false);
    }
  };

  // ── Open Arbain detail ────────────────────────────────────
  const openArbainDetail = (item: ArbainItem) => {
    setCurrentArbain(item);
    setMode("arbain-detail");
  };

  const navArbain = async (direction: "prev" | "next") => {
    if (!currentArbain) return;
    const current = parseInt(currentArbain.no);
    const next =
      direction === "next"
        ? Math.min(current + 1, ARBAIN_MAX)
        : Math.max(current - 1, 1);
    if (next === current) return;
    // Try from cached list first
    const cached = arbainList.find((a) => parseInt(a.no) === next);
    if (cached) {
      setCurrentArbain(cached);
      return;
    }
    setArbainLoading(true);
    try {
      const data = await getArbainByNo(next);
      setCurrentArbain(data);
    } catch {
      Alert.alert("Gagal", "Tidak dapat memuat hadis");
    } finally {
      setArbainLoading(false);
    }
  };

  // ── Load Bulughul Maram ───────────────────────────────────
  const loadBm = async (no: number) => {
    setBmLoading(true);
    try {
      const data = await getBmByNo(no);
      setBmData(data);
      setBmNo(no);
      setBmInput(no.toString());
    } catch {
      Alert.alert("Gagal", "Tidak dapat memuat hadis");
    } finally {
      setBmLoading(false);
    }
  };

  const openBm = async () => {
    setMode("bm");
    if (!bmData) await loadBm(1);
  };

  const handleBmGo = () => {
    const n = parseInt(bmInput);
    if (isNaN(n) || n < 1 || n > BM_MAX) {
      Alert.alert("Nomor tidak valid", `Masukkan nomor 1 – ${BM_MAX}`);
      return;
    }
    loadBm(n);
  };

  // ── Load Perawi list ──────────────────────────────────────
  const openPerawi = async () => {
    setMode("perawi-select");
    if (perawiList.length > 0) return;
    setPerawiLoading(true);
    try {
      const data = await getPerawiList();
      setPerawiList(data);
    } catch {
      Alert.alert("Gagal", "Tidak dapat memuat daftar perawi");
    } finally {
      setPerawiLoading(false);
    }
  };

  const selectPerawi = async (perawi: PerawiInfo) => {
    setSelectedPerawi(perawi);
    setPerawiNo(1);
    setPerawiInput("1");
    setMode("perawi-hadis");
    await loadPerawiHadis(perawi.slug, 1);
  };

  const loadPerawiHadis = async (slug: string, no: number) => {
    setPerawiHadisLoading(true);
    try {
      const data = await getHadisByPerawi(slug, no);
      setPerawiHadis(data);
      setPerawiNo(no);
      setPerawiInput(no.toString());
    } catch {
      Alert.alert("Gagal", "Tidak dapat memuat hadis");
    } finally {
      setPerawiHadisLoading(false);
    }
  };

  const handlePerawiGo = () => {
    if (!selectedPerawi) return;
    const n = parseInt(perawiInput);
    if (isNaN(n) || n < 1 || n > selectedPerawi.total) {
      Alert.alert(
        "Nomor tidak valid",
        `Masukkan nomor 1 – ${selectedPerawi.total}`
      );
      return;
    }
    loadPerawiHadis(selectedPerawi.slug, n);
  };

  // ── Search handlers ──────────────────────────────────────
  const handleSearch = async (keyword: string, page = 1) => {
    if (!keyword.trim()) return;
    setSearchLoading(true);
    try {
      const result = await searchHadis(keyword.trim(), page, 10);
      if (page === 1) {
        setSearchResults(result.hadis);
      } else {
        setSearchResults((prev) => [...prev, ...result.hadis]);
      }
      setSearchPage(page);
      setSearchTotalPages(result.paging.total_pages);
    } catch {
      Alert.alert("Gagal", "Tidak dapat melakukan pencarian");
    } finally {
      setSearchLoading(false);
    }
  };

  const openSearchDetail = async (item: HadisSearchItem) => {
    setSearchDetailLoading(true);
    setMode("search-detail");
    try {
      const data = await getHadisById(item.id);
      setSearchDetail(data);
    } catch {
      Alert.alert("Gagal", "Tidak dapat memuat detail hadis");
    } finally {
      setSearchDetailLoading(false);
    }
  };

  const openSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchPage(1);
    setMode("search");
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // ── Back handler ──────────────────────────────────────────
  const handleBack = () => {
    if (mode === "home") {
      router.back();
    } else if (mode === "arbain-detail") {
      setMode("arbain-list");
    } else if (mode === "perawi-hadis") {
      setMode("perawi-select");
    } else if (mode === "search-detail") {
      setMode("search");
    } else {
      setMode("home");
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  const renderHeader = (title: string, withSearch = false) => (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
        <FontAwesome name="arrow-left" size={18} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      {withSearch ? (
        <TouchableOpacity onPress={openSearch} style={styles.backBtn}>
          <FontAwesome name="search" size={18} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 36 }} />
      )}
    </View>
  );

  // ── SEARCH ─────────────────────────────────────────────────
  if (mode === "search") {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <FontAwesome name="arrow-left" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={styles.searchInputWrapper}>
            <FontAwesome name="search" size={14} color="rgba(255,255,255,0.7)" />
            <TextInput
              ref={searchInputRef}
              style={styles.searchHeaderInput}
              placeholder="Cari kata kunci hadis..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={() => handleSearch(searchQuery)}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  searchInputRef.current?.focus();
                }}
              >
                <FontAwesome name="times-circle" size={14} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => handleSearch(searchQuery)}
            style={styles.searchHeaderBtn}
            disabled={!searchQuery.trim() || searchLoading}
          >
            <Text style={styles.searchHeaderBtnText}>Cari</Text>
          </TouchableOpacity>
        </View>

        {searchLoading && searchPage === 1 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : searchResults.length === 0 && searchQuery.trim() ? (
          <View style={styles.center}>
            <FontAwesome name="search" size={44} color={Colors.primaryLight} />
            <Text style={styles.emptyText}>Tidak ada hasil untuk</Text>
            <Text style={styles.emptyQuery}>"{searchQuery}"</Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.center}>
            <FontAwesome name="search" size={44} color={Colors.primaryLight} />
            <Text style={styles.emptyText}>Ketik kata kunci lalu tekan Cari</Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            style={{ backgroundColor: Colors.background }}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={() => {
              if (searchPage < searchTotalPages && !searchLoading) {
                handleSearch(searchQuery, searchPage + 1);
              }
            }}
            onEndReachedThreshold={0.3}
            ListHeaderComponent={
              <Text style={styles.searchResultCount}>
                Ditemukan hasil pencarian untuk "{searchQuery}"
              </Text>
            }
            ListFooterComponent={
              searchLoading ? (
                <ActivityIndicator
                  size="small"
                  color={Colors.primary}
                  style={{ paddingVertical: 16 }}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultCard}
                onPress={() => openSearchDetail(item)}
              >
                <View style={styles.searchResultBadge}>
                  <Text style={styles.searchResultBadgeText}>#{item.id}</Text>
                </View>
                <Text style={styles.searchResultText} numberOfLines={3}>
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

  // ── SEARCH DETAIL ─────────────────────────────────────────
  if (mode === "search-detail") {
    return (
      <View style={styles.container}>
        {renderHeader("Detail Hadis")}
        <ScrollView
          style={{ backgroundColor: Colors.background }}
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}
        >
          {searchDetailLoading || !searchDetail ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.detailCard}>
              {searchDetail.takhrij || searchDetail.grade ? (
                <View style={styles.detailBadgeRow}>
                  {searchDetail.takhrij ? (
                    <View style={styles.detailBadge}>
                      <Text style={styles.detailBadgeText}>{searchDetail.takhrij}</Text>
                    </View>
                  ) : null}
                  {searchDetail.grade ? (
                    <View style={[styles.detailBadge, { backgroundColor: "#FFF3E0" }]}>
                      <Text style={[styles.detailBadgeText, { color: "#E65100" }]}>
                        {searchDetail.grade}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.arabText}>{searchDetail.text.ar}</Text>
              <View style={styles.divider} />
              <Text style={styles.indoText}>{searchDetail.text.id}</Text>
              {searchDetail.hikmah ? (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.hikmahLabel}>Hikmah</Text>
                  <Text style={styles.hikmahText}>{searchDetail.hikmah}</Text>
                </>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── HOME ──────────────────────────────────────────────────
  if (mode === "home") {
    return (
      <View style={styles.container}>
        {renderHeader("Hadis", true)}
        <ScrollView
          style={{ backgroundColor: Colors.background }}
          contentContainerStyle={styles.homeContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.homeSubtitle}>
            Pilih koleksi hadis yang ingin dibaca
          </Text>

          {/* Arbain */}
          <TouchableOpacity
            style={styles.categoryCard}
            onPress={loadArbainList}
            disabled={arbainLoading}
          >
            <View
              style={[
                styles.categoryIconBox,
                { backgroundColor: CATEGORY_COLORS.arbain.bg },
              ]}
            >
              {arbainLoading ? (
                <ActivityIndicator
                  size="small"
                  color={CATEGORY_COLORS.arbain.icon}
                />
              ) : (
                <FontAwesome
                  name="book"
                  size={28}
                  color={CATEGORY_COLORS.arbain.icon}
                />
              )}
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>Hadis Arbain Nawawi</Text>
              <Text style={styles.categoryDesc}>
                42 hadis pilihan Imam Nawawi, mencakup pokok-pokok agama Islam
              </Text>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: CATEGORY_COLORS.arbain.badge },
                ]}
              >
                <Text
                  style={[
                    styles.categoryBadgeText,
                    { color: CATEGORY_COLORS.arbain.icon },
                  ]}
                >
                  42 Hadis
                </Text>
              </View>
            </View>
            <FontAwesome
              name="chevron-right"
              size={14}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Bulughul Maram */}
          <TouchableOpacity style={styles.categoryCard} onPress={openBm}>
            <View
              style={[
                styles.categoryIconBox,
                { backgroundColor: CATEGORY_COLORS.bm.bg },
              ]}
            >
              <FontAwesome
                name="archive"
                size={28}
                color={CATEGORY_COLORS.bm.icon}
              />
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>Bulughul Maram</Text>
              <Text style={styles.categoryDesc}>
                Kitab hadis fikih karya Ibnu Hajar Al-Asqalani
              </Text>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: CATEGORY_COLORS.bm.badge },
                ]}
              >
                <Text
                  style={[
                    styles.categoryBadgeText,
                    { color: CATEGORY_COLORS.bm.icon },
                  ]}
                >
                  1.597 Hadis
                </Text>
              </View>
            </View>
            <FontAwesome
              name="chevron-right"
              size={14}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {/* 9 Perawi */}
          <TouchableOpacity style={styles.categoryCard} onPress={openPerawi}>
            <View
              style={[
                styles.categoryIconBox,
                { backgroundColor: CATEGORY_COLORS.perawi.bg },
              ]}
            >
              <FontAwesome
                name="users"
                size={26}
                color={CATEGORY_COLORS.perawi.icon}
              />
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>9 Perawi (Kutubut Tis'ah)</Text>
              <Text style={styles.categoryDesc}>
                Bukhari, Muslim, Abu Dawud, Tirmidzi, Nasai, Ibnu Majah, Ahmad,
                Malik, Darimi
              </Text>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: CATEGORY_COLORS.perawi.badge },
                ]}
              >
                <Text
                  style={[
                    styles.categoryBadgeText,
                    { color: CATEGORY_COLORS.perawi.icon },
                  ]}
                >
                  9 Perawi
                </Text>
              </View>
            </View>
            <FontAwesome
              name="chevron-right"
              size={14}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── ARBAIN LIST ───────────────────────────────────────────
  if (mode === "arbain-list") {
    return (
      <View style={styles.container}>
        {renderHeader("Hadis Arbain Nawawi")}
        {arbainLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={arbainList}
            style={{ backgroundColor: Colors.background }}
            keyExtractor={(item) => item.no}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listCard}
                onPress={() => openArbainDetail(item)}
              >
                <View style={styles.listNumber}>
                  <Text style={styles.listNumberText}>{item.no}</Text>
                </View>
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle}>{item.judul}</Text>
                  <Text style={styles.listPreview} numberOfLines={2}>
                    {item.indo}
                  </Text>
                </View>
                <FontAwesome
                  name="chevron-right"
                  size={12}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ── ARBAIN DETAIL ─────────────────────────────────────────
  if (mode === "arbain-detail" && currentArbain) {
    const no = parseInt(currentArbain.no);
    return (
      <View style={styles.container}>
        {renderHeader(`Hadis #${currentArbain.no} — ${currentArbain.judul}`)}
        <ScrollView
          style={{ backgroundColor: Colors.background }}
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailCard}>
            <View style={styles.detailBadgeRow}>
              <View style={styles.detailBadge}>
                <Text style={styles.detailBadgeText}>
                  Hadis #{currentArbain.no}
                </Text>
              </View>
              <Text style={styles.detailJudul}>{currentArbain.judul}</Text>
            </View>
            <Text style={styles.arabText}>{currentArbain.arab}</Text>
            <View style={styles.divider} />
            <Text style={styles.indoText}>{currentArbain.indo}</Text>

            {/* Navigation */}
            <View style={styles.navRow}>
              <TouchableOpacity
                style={[styles.navBtn, no <= 1 && styles.navBtnDisabled]}
                onPress={() => navArbain("prev")}
                disabled={no <= 1 || arbainLoading}
              >
                <FontAwesome
                  name="chevron-left"
                  size={13}
                  color={no <= 1 ? Colors.textSecondary : Colors.primary}
                />
                <Text
                  style={[
                    styles.navBtnText,
                    no <= 1 && { color: Colors.textSecondary },
                  ]}
                >
                  Sebelumnya
                </Text>
              </TouchableOpacity>

              {arbainLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.navCounter}>
                  {no} / {ARBAIN_MAX}
                </Text>
              )}

              <TouchableOpacity
                style={[
                  styles.navBtn,
                  no >= ARBAIN_MAX && styles.navBtnDisabled,
                ]}
                onPress={() => navArbain("next")}
                disabled={no >= ARBAIN_MAX || arbainLoading}
              >
                <Text
                  style={[
                    styles.navBtnText,
                    no >= ARBAIN_MAX && { color: Colors.textSecondary },
                  ]}
                >
                  Berikutnya
                </Text>
                <FontAwesome
                  name="chevron-right"
                  size={13}
                  color={
                    no >= ARBAIN_MAX ? Colors.textSecondary : Colors.primary
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── BULUGHUL MARAM ────────────────────────────────────────
  if (mode === "bm") {
    return (
      <View style={styles.container}>
        {renderHeader("Bulughul Maram")}
        <ScrollView
          style={{ backgroundColor: Colors.background }}
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Number input */}
          <View style={styles.jumpRow}>
            <TextInput
              style={styles.jumpInput}
              value={bmInput}
              onChangeText={setBmInput}
              keyboardType="number-pad"
              returnKeyType="go"
              onSubmitEditing={handleBmGo}
              placeholder={`1 – ${BM_MAX}`}
              placeholderTextColor={Colors.textSecondary}
            />
            <TouchableOpacity style={styles.jumpBtn} onPress={handleBmGo}>
              <Text style={styles.jumpBtnText}>Buka</Text>
            </TouchableOpacity>
          </View>

          {bmLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : bmData ? (
            <View style={styles.detailCard}>
              <View style={styles.detailBadgeRow}>
                <View
                  style={[
                    styles.detailBadge,
                    { backgroundColor: CATEGORY_COLORS.bm.badge },
                  ]}
                >
                  <Text
                    style={[
                      styles.detailBadgeText,
                      { color: CATEGORY_COLORS.bm.icon },
                    ]}
                  >
                    Hadis #{bmData.no}
                  </Text>
                </View>
              </View>
              <Text style={styles.arabText}>{bmData.ar}</Text>
              <View style={styles.divider} />
              <Text style={styles.indoText}>{bmData.id}</Text>

              {/* Navigation */}
              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[
                    styles.navBtn,
                    bmNo <= 1 && styles.navBtnDisabled,
                  ]}
                  onPress={() => loadBm(bmNo - 1)}
                  disabled={bmNo <= 1 || bmLoading}
                >
                  <FontAwesome
                    name="chevron-left"
                    size={13}
                    color={bmNo <= 1 ? Colors.textSecondary : Colors.primary}
                  />
                  <Text
                    style={[
                      styles.navBtnText,
                      bmNo <= 1 && { color: Colors.textSecondary },
                    ]}
                  >
                    Sebelumnya
                  </Text>
                </TouchableOpacity>

                <Text style={styles.navCounter}>
                  {bmNo} / {BM_MAX}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.navBtn,
                    bmNo >= BM_MAX && styles.navBtnDisabled,
                  ]}
                  onPress={() => loadBm(bmNo + 1)}
                  disabled={bmNo >= BM_MAX || bmLoading}
                >
                  <Text
                    style={[
                      styles.navBtnText,
                      bmNo >= BM_MAX && { color: Colors.textSecondary },
                    ]}
                  >
                    Berikutnya
                  </Text>
                  <FontAwesome
                    name="chevron-right"
                    size={13}
                    color={
                      bmNo >= BM_MAX ? Colors.textSecondary : Colors.primary
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  // ── PERAWI SELECT ─────────────────────────────────────────
  if (mode === "perawi-select") {
    return (
      <View style={styles.container}>
        {renderHeader("Pilih Perawi")}
        {perawiLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={perawiList}
            style={{ backgroundColor: Colors.background }}
            keyExtractor={(item) => item.slug}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.perawiCard}
                onPress={() => selectPerawi(item)}
              >
                <View style={styles.perawiIconBox}>
                  <FontAwesome
                    name="user-circle"
                    size={28}
                    color={CATEGORY_COLORS.perawi.icon}
                  />
                </View>
                <View style={styles.perawiInfo}>
                  <Text style={styles.perawiName}>Imam {item.name}</Text>
                  <Text style={styles.perawiTotal}>
                    {item.total.toLocaleString("id-ID")} hadis
                  </Text>
                </View>
                <FontAwesome
                  name="chevron-right"
                  size={12}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ── PERAWI HADIS ──────────────────────────────────────────
  if (mode === "perawi-hadis" && selectedPerawi) {
    return (
      <View style={styles.container}>
        {renderHeader(`Imam ${selectedPerawi.name}`)}
        <ScrollView
          style={{ backgroundColor: Colors.background }}
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Number input */}
          <View style={styles.jumpRow}>
            <TextInput
              style={styles.jumpInput}
              value={perawiInput}
              onChangeText={setPerawiInput}
              keyboardType="number-pad"
              returnKeyType="go"
              onSubmitEditing={handlePerawiGo}
              placeholder={`1 – ${selectedPerawi.total}`}
              placeholderTextColor={Colors.textSecondary}
            />
            <TouchableOpacity
              style={[
                styles.jumpBtn,
                { backgroundColor: CATEGORY_COLORS.perawi.icon },
              ]}
              onPress={handlePerawiGo}
            >
              <Text style={styles.jumpBtnText}>Buka</Text>
            </TouchableOpacity>
          </View>

          {perawiHadisLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : perawiHadis ? (
            <View style={styles.detailCard}>
              <View style={styles.detailBadgeRow}>
                <View
                  style={[
                    styles.detailBadge,
                    { backgroundColor: CATEGORY_COLORS.perawi.badge },
                  ]}
                >
                  <Text
                    style={[
                      styles.detailBadgeText,
                      { color: CATEGORY_COLORS.perawi.icon },
                    ]}
                  >
                    {selectedPerawi.name} #{perawiHadis.number}
                  </Text>
                </View>
              </View>
              <Text style={styles.arabText}>{perawiHadis.arab}</Text>
              <View style={styles.divider} />
              <Text style={styles.indoText}>{perawiHadis.id}</Text>

              {/* Navigation */}
              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[
                    styles.navBtn,
                    perawiNo <= 1 && styles.navBtnDisabled,
                  ]}
                  onPress={() =>
                    loadPerawiHadis(selectedPerawi.slug, perawiNo - 1)
                  }
                  disabled={perawiNo <= 1 || perawiHadisLoading}
                >
                  <FontAwesome
                    name="chevron-left"
                    size={13}
                    color={
                      perawiNo <= 1 ? Colors.textSecondary : Colors.primary
                    }
                  />
                  <Text
                    style={[
                      styles.navBtnText,
                      perawiNo <= 1 && { color: Colors.textSecondary },
                    ]}
                  >
                    Sebelumnya
                  </Text>
                </TouchableOpacity>

                <Text style={styles.navCounter}>
                  {perawiNo} / {selectedPerawi.total.toLocaleString("id-ID")}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.navBtn,
                    perawiNo >= selectedPerawi.total && styles.navBtnDisabled,
                  ]}
                  onPress={() =>
                    loadPerawiHadis(selectedPerawi.slug, perawiNo + 1)
                  }
                  disabled={
                    perawiNo >= selectedPerawi.total || perawiHadisLoading
                  }
                >
                  <Text
                    style={[
                      styles.navBtnText,
                      perawiNo >= selectedPerawi.total && {
                        color: Colors.textSecondary,
                      },
                    ]}
                  >
                    Berikutnya
                  </Text>
                  <FontAwesome
                    name="chevron-right"
                    size={13}
                    color={
                      perawiNo >= selectedPerawi.total
                        ? Colors.textSecondary
                        : Colors.primary
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return null;
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
    paddingVertical: 40,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    backgroundColor: Colors.primary,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginHorizontal: 8,
  },

  // ── Home ─────────────────────────────────────────────────
  homeContent: {
    padding: 20,
    paddingBottom: 40,
  },
  homeSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  categoryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 4,
  },
  categoryDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // ── List ─────────────────────────────────────────────────
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  listNumber: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  listNumberText: {
    fontSize: 13,
    fontWeight: "bold",
    color: Colors.primaryDark,
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 3,
  },
  listPreview: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },

  // ── Perawi select ────────────────────────────────────────
  perawiCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  perawiIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: CATEGORY_COLORS.perawi.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  perawiInfo: {
    flex: 1,
  },
  perawiName: {
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.text,
  },
  perawiTotal: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
  },

  // ── Detail / Number jump ─────────────────────────────────
  detailContent: {
    padding: 16,
    paddingBottom: 40,
  },
  jumpRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  jumpInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  jumpBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  jumpBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  detailBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  detailBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  detailBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  detailJudul: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  arabText: {
    fontFamily: "AmiriQuran",
    fontSize: 22,
    color: Colors.text,
    textAlign: "right",
    lineHeight: 42,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  indoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  navBtnDisabled: {
    backgroundColor: "#F0F0F0",
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  navCounter: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },

  // ── Search ───────────────────────────────────────────────
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    marginHorizontal: 8,
  },
  searchHeaderInput: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
    paddingVertical: 0,
  },
  searchHeaderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 8,
  },
  searchHeaderBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  emptyQuery: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    textAlign: "center",
    marginTop: 4,
  },
  searchResultCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
    fontStyle: "italic",
  },
  searchResultCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  searchResultBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  searchResultBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: Colors.primaryDark,
  },
  searchResultText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  hikmahLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 6,
  },
  hikmahText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
