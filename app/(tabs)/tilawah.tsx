import React, { useEffect, useState } from "react";
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
  Image
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import { getAllSurahs, Surah } from "@/lib/alquran-api";
import { useAuthContext } from "@/lib/auth-context";

const { width } = Dimensions.get("window");

// Quick access surahs
const POPULAR_SURAHS = [36, 67, 56, 18, 55, 1]; // Yasin, Al-Mulk, Al-Waqi'ah, Al-Kahf, Ar-Rahman, Al-Fatihah

type ScreenMode = "home" | "surah-list";

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

  useEffect(() => {
    loadSurahs();
  }, []);

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
    <View style={styles.container}>
      <View style={styles.headerShell}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}> 
          {headerImageUrl ? (
            <Image
              source={{ uri: headerImageUrl }}
              style={styles.headerImageBg}
              resizeMode="cover"
            />
          ) : null}
          <View
            style={[
              styles.headerOverlay,
              { backgroundColor: headerImageUrl ? "rgba(0,0,0,0.28)" : "transparent" },
            ]}
          />
          <View style={styles.headerContent}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.greeting}>Assalamu'alaikum 👋</Text>
              <Text style={styles.userName}>{firstName}</Text>
            </View>
            <TouchableOpacity
              style={[styles.avatarCircle, styles.avatarInHeader]}
              onPress={() => router.push("/(tabs)/profil")}
            >
              {userData?.avatarUrl ? (
              <Image
                source={{ uri: userData.avatarUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <FontAwesome name="user" size={40} color={Colors.primary} />
            )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => setMode("surah-list")}
        >
          <FontAwesome name="search" size={16} color={Colors.textSecondary} />
          <Text style={styles.searchPlaceholder}>Cari surah...</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: Colors.background }}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
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
    position: "relative",
    marginBottom: 40,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 34,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: "hidden",
    position: "relative",
  },
  headerImageBg: {
    ...StyleSheet.absoluteFillObject,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 35,
    zIndex: 2,
    position: "relative",
    minHeight: 44,
  },
  headerTextWrap: {
    alignItems: "center",
    marginTop: 50,
  },
  greeting: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 2,
    textAlign: "center",
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
  searchBar: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: -26,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 10,
  },
  searchPlaceholder: {
    color: Colors.textSecondary,
    fontSize: 15,
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
    marginTop: 20,
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
    fontFamily: "Amiri",
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
    fontFamily: "Amiri",
    fontSize: 20,
    color: Colors.text,
  },
});
