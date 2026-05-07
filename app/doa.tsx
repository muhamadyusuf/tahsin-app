import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import { getAllDoa, DoaItem } from "@/lib/doa-api";
import { useRouter } from "expo-router";
import FontAwesome5 from "@expo/vector-icons/build/FontAwesome5";

type Mode = "home" | "group" | "detail" | "search";

export default function DoaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("home");
  const [allDoa, setAllDoa] = useState<DoaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Group mode
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  // Detail mode
  const [selectedDoa, setSelectedDoa] = useState<DoaItem | null>(null);
  const [previousMode, setPreviousMode] = useState<Mode>("home");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadAllDoa();
  }, []);

  const loadAllDoa = async () => {
    try {
      setLoading(true);
      const data = await getAllDoa();
      setAllDoa(data);
    } catch {
      Alert.alert("Gagal", "Tidak dapat memuat daftar do'a. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, DoaItem[]>();
    for (const doa of allDoa) {
      const list = map.get(doa.grup) ?? [];
      list.push(doa);
      map.set(doa.grup, list);
    }
    return map;
  }, [allDoa]);

  const groupList = useMemo(() => Array.from(groups.keys()), [groups]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allDoa.filter(
      (d) =>
        d.nama.toLowerCase().includes(q) ||
        d.idn.toLowerCase().includes(q) ||
        d.tr.toLowerCase().includes(q) ||
        d.grup.toLowerCase().includes(q)
    );
  }, [allDoa, searchQuery]);

  const openDetail = useCallback((doa: DoaItem, from: Mode) => {
    setPreviousMode(from);
    setSelectedDoa(doa);
    setMode("detail");
  }, []);

  const openGroup = useCallback((group: string) => {
    setSelectedGroup(group);
    setMode("group");
  }, []);

  const handleBack = () => {
    if (mode === "detail") {
      setMode(previousMode);
      return;
    }
    if (mode === "group" || mode === "search") {
      setSearchQuery("");
      setMode("home");
      return;
    }
    router.back();
  };

  const renderHeader = (title: string, showSearch = false) => (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + 8 },
      ]}
    >
      <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
        <FontAwesome name="arrow-left" size={16} color={Colors.textLight} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      {showSearch ? (
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => {
            setMode("search");
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }}
        >
          <FontAwesome name="search" size={16} color={Colors.textLight} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerAction} />
      )}
    </View>
  );

  // ── LOADING ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader("Kumpulan Do'a")}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat do'a...</Text>
        </View>
      </View>
    );
  }

  // ── DETAIL ────────────────────────────────────────────────
  if (mode === "detail" && selectedDoa) {
    return (
      <View style={styles.container}>
        {renderHeader(selectedDoa.nama)}
        <ScrollView
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grupBadgeWrap}>
            <Text style={styles.grupBadge}>{selectedDoa.grup}</Text>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.arabText}>{selectedDoa.ar}</Text>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.trLabel}>Latin</Text>
            <Text style={styles.trText}>{selectedDoa.tr}</Text>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.trLabel}>Artinya</Text>
            <Text style={styles.idnText}>{selectedDoa.idn}</Text>
          </View>

          {!!selectedDoa.tentang && (
            <View style={[styles.detailCard, styles.tentangCard]}>
              <Text style={styles.tentangLabel}>Keterangan</Text>
              <Text style={styles.tentangText}>{selectedDoa.tentang}</Text>
            </View>
          )}

          {selectedDoa.tag.length > 0 && (
            <View style={styles.tagWrap}>
              {selectedDoa.tag.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── GROUP ─────────────────────────────────────────────────
  if (mode === "group") {
    const groupDoa = groups.get(selectedGroup) ?? [];
    return (
      <View style={styles.container}>
        {renderHeader(selectedGroup)}
        <FlatList
          data={groupDoa}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.doaCard}
              onPress={() => openDetail(item, "group")}
            >
              <View style={styles.doaCardInner}>
                <View style={styles.doaNum}>
                  <Text style={styles.doaNumText}>{item.id}</Text>
                </View>
                <View style={styles.doaInfo}>
                  <Text style={styles.doaName}>{item.nama}</Text>
                  <Text style={styles.doaArabic} numberOfLines={2}>
                    {item.ar}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={12} color={Colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // ── SEARCH ────────────────────────────────────────────────
  if (mode === "search") {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <FontAwesome name="arrow-left" size={16} color={Colors.textLight} />
          </TouchableOpacity>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Cari do'a..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => setSearchQuery("")}
            >
              <FontAwesome name="times" size={16} color={Colors.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {searchQuery.trim().length === 0 ? (
          <View style={styles.center}>
            <FontAwesome name="search" size={40} color={Colors.border} />
            <Text style={styles.emptyTitle}>Ketik untuk mencari do'a</Text>
            <Text style={styles.emptyDesc}>Cari berdasarkan nama, terjemahan, atau kelompok</Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.center}>
            <FontAwesome name="frown-o" size={40} color={Colors.border} />
            <Text style={styles.emptyTitle}>Do'a tidak ditemukan</Text>
            <Text style={styles.emptyDesc}>Coba kata kunci lain</Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.doaCard}
                onPress={() => openDetail(item, "search")}
              >
                <View style={styles.doaCardInner}>
                  <View style={styles.doaNum}>
                    <Text style={styles.doaNumText}>{item.id}</Text>
                  </View>
                  <View style={styles.doaInfo}>
                    <Text style={styles.doaName}>{item.nama}</Text>
                    <Text style={styles.doaGrup}>{item.grup}</Text>
                    <Text style={styles.doaArabic} numberOfLines={1}>
                      {item.ar}
                    </Text>
                  </View>
                  <FontAwesome name="chevron-right" size={12} color={Colors.textSecondary} />
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ── HOME ─────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {renderHeader("Kumpulan Do'a", true)}
      <ScrollView
        contentContainerStyle={styles.homeContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero banner */}
        <View style={styles.heroBanner}>
          <FontAwesome5 name="praying-hands" size={36} color={Colors.primary} style={styles.heroIcon} />
          <Text style={styles.heroTitle}>Kumpulan Do'a Harian</Text>
          <Text style={styles.heroSubtitle}>
            {allDoa.length} do'a dari Hisnul Muslim &amp; sumber shahih lainnya
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Kelompok Do'a</Text>

        {groupList.map((group) => {
          const count = groups.get(group)?.length ?? 0;
          return (
            <TouchableOpacity
              key={group}
              style={styles.groupCard}
              onPress={() => openGroup(group)}
            >
              <View style={styles.groupIcon}>
                <FontAwesome name="star-o" size={18} color={Colors.primary} />
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group}</Text>
                <Text style={styles.groupCount}>{count} do'a</Text>
              </View>
              <FontAwesome name="chevron-right" size={12} color={Colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
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
    gap: 8,
    paddingHorizontal: 32,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textLight,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textLight,
    paddingVertical: 0,
  },

  // Home
  homeContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroBanner: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  heroIcon: {
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 12,
  },

  // Group card
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    gap: 12,
  },
  groupIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  groupCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Doa list
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  doaCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  doaCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  doaNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  doaNumText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  doaInfo: {
    flex: 1,
  },
  doaName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  doaGrup: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 1,
  },
  doaArabic: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
    fontFamily: "System",
    textAlign: "right",
    lineHeight: 22,
  },

  // Detail
  detailContent: {
    padding: 16,
    paddingBottom: 40,
  },
  grupBadgeWrap: {
    marginBottom: 12,
  },
  grupBadge: {
    fontSize: 12,
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    fontWeight: "600",
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  arabText: {
    fontSize: 26,
    color: Colors.text,
    textAlign: "right",
    lineHeight: 48,
    fontFamily: "System",
  },
  trLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  trText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
    fontStyle: "italic",
  },
  idnText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  tentangCard: {
    backgroundColor: "#F9FBE7",
  },
  tentangLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#558B2F",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tentangText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Tags
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  tagChip: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600",
  },

  // Empty
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
