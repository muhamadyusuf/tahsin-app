import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import { getAllSurahs, Surah } from "@/lib/alquran-api";
type ViewMode = "surah" | "mushaf";

export default function TilawahScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>("surah");
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filtered, setFiltered] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
      console.log("Loaded surahs:", data);
      setSurahs(data);
      setFiltered(data);
    } catch (error) {
      console.error("Failed to load surahs:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderSurah = ({ item }: { item: Surah }) => (
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
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat daftar surah...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mode Switcher */}
      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "surah" && styles.modeBtnActive]}
          onPress={() => setMode("surah")}
        >
          <FontAwesome
            name="list"
            size={14}
            color={mode === "surah" ? Colors.textLight : Colors.primary}
          />
          <Text
            style={[
              styles.modeText,
              mode === "surah" && styles.modeTextActive,
            ]}
          >
            Daftar Surah
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "mushaf" && styles.modeBtnActive]}
          onPress={() => setMode("mushaf")}
        >
          <FontAwesome
            name="book"
            size={14}
            color={mode === "mushaf" ? Colors.textLight : Colors.primary}
          />
          <Text
            style={[
              styles.modeText,
              mode === "mushaf" && styles.modeTextActive,
            ]}
          >
            Mushaf
          </Text>
        </TouchableOpacity>
      </View>

      {mode === "surah" ? (
        <>
          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari surah..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          {/* Surah List */}
          <FlatList
            data={filtered}
            renderItem={renderSurah}
            keyExtractor={(item) => item.number.toString()}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        <View style={styles.mushafLaunch}>
          <FontAwesome name="book" size={60} color={Colors.primary} />
          <Text style={styles.mushafTitle}>Mushaf Al-Quran</Text>
          <Text style={styles.mushafDesc}>Baca Al-Quran dalam tampilan mushaf lengkap</Text>
          <TouchableOpacity
            style={styles.mushafBtn}
            onPress={() => router.push("/mushaf")}
          >
            <FontAwesome name="book" size={18} color={Colors.textLight} />
            <Text style={styles.mushafBtnText}>Buka Mushaf</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modeContainer: {
    flexDirection: "row",
    padding: 12,
    paddingBottom: 0,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  modeTextActive: {
    color: Colors.textLight,
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
  searchContainer: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  surahCard: {
    backgroundColor: Colors.surface,
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
    fontSize: 20,
    color: Colors.text,
    fontWeight: "500",
  },
  mushafLaunch: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  mushafTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.text,
    marginTop: 8,
  },
  mushafDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  mushafBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  mushafBtnText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: "bold",
  },
});
