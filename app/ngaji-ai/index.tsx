import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";
import { getAllSurahs, Surah } from "@/lib/alquran-api";

type SurahSummary = {
  surahNumber: number;
  totalScore: number;
  ayahDone: number;
  totalAyahs: number;
  lastAyahNumber: number;
};

export default function NgajiAiListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [searchText, setSearchText] = useState("");

  const summaries = useQuery(
    api.ngajiAi.getMySummaries,
    userData?._id ? { userId: userData._id } : "skip"
  );

  useEffect(() => {
    (async () => {
      try {
        const list = await getAllSurahs();
        setSurahs(list);
      } catch (error) {
        console.error("Failed to load surah list", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summaryMap = useMemo(() => {
    const map = new Map<number, SurahSummary>();
    (summaries ?? []).forEach((s) => map.set(s.surahNumber, s));
    return map;
  }, [summaries]);

  const overall = useMemo(() => {
    const list = summaries ?? [];
    const ayahDone = list.reduce((acc, s) => acc + s.ayahDone, 0);
    const totalScore = list.reduce((acc, s) => acc + s.totalScore, 0);
    return {
      surahCount: list.length,
      ayahDone,
      avgScore: ayahDone > 0 ? Math.round(totalScore / ayahDone) : 0,
    };
  }, [summaries]);

  const filteredSurahs = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter(
      (s) =>
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation.toLowerCase().includes(q) ||
        s.number.toString() === q
    );
  }, [searchText, surahs]);

  const renderSurah = ({ item }: { item: Surah }) => {
    const summary = summaryMap.get(item.number);
    const avg = summary && summary.ayahDone > 0
      ? Math.round(summary.totalScore / summary.ayahDone)
      : null;
    const progress = summary
      ? Math.min(1, summary.ayahDone / item.numberOfAyahs)
      : 0;

    return (
      <Pressable
        style={st.surahItem}
        onPress={() => router.push(`/ngaji-ai/${item.number}`)}
      >
        <View style={st.numberBadge}>
          <Text style={st.numberText}>{item.number}</Text>
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <View style={st.surahTitleRow}>
            <Text style={st.surahName}>{item.englishName}</Text>
            <Text style={st.surahArabic}>{item.name.replace("سُورَةُ ", "")}</Text>
          </View>
          <Text style={st.surahMeta}>
            {item.englishNameTranslation} • {item.numberOfAyahs} ayat •{" "}
            {item.revelationType === "Meccan" ? "Makkiyah" : "Madaniyah"}
          </Text>
          {summary ? (
            <View style={st.progressRow}>
              <View style={st.progressTrack}>
                <View style={[st.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={st.progressText}>
                {summary.ayahDone}/{item.numberOfAyahs} ayat
              </Text>
            </View>
          ) : null}
        </View>

        <View style={st.scoreBadge}>
          <FontAwesome
            name="star"
            size={12}
            color={avg !== null ? "#F9A825" : Colors.border}
          />
          <Text style={[st.scoreText, avg === null && { color: Colors.textSecondary }]}>
            {avg !== null ? avg : "-"}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={st.container}>
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <View style={st.headerRow}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={16} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>Ngaji AI</Text>
            <Text style={st.headerSubtitle}>
              Rekam bacaanmu per ayat, dapatkan koreksi dari AI
            </Text>
          </View>
          <View style={st.headerIcon}>
            <FontAwesome name="microphone" size={18} color="#fff" />
          </View>
        </View>

        <View style={st.statsRow}>
          <View style={st.statItem}>
            <Text style={st.statValue}>{overall.surahCount}</Text>
            <Text style={st.statLabel}>Surah dilatih</Text>
          </View>
          <View style={st.statDivider} />
          <View style={st.statItem}>
            <Text style={st.statValue}>{overall.ayahDone}</Text>
            <Text style={st.statLabel}>Ayat dinilai</Text>
          </View>
          <View style={st.statDivider} />
          <View style={st.statItem}>
            <Text style={st.statValue}>{overall.avgScore}</Text>
            <Text style={st.statLabel}>Rata-rata skor</Text>
          </View>
        </View>

        <View style={st.searchBox}>
          <FontAwesome name="search" size={14} color={Colors.textSecondary} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Cari nama surah atau nomor"
            placeholderTextColor={Colors.textSecondary}
            style={st.searchInput}
          />
          {searchText.length > 0 ? (
            <Pressable onPress={() => setSearchText("")}>
              <FontAwesome name="times-circle" size={16} color={Colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.loadingText}>Memuat daftar surah...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSurahs}
          keyExtractor={(item) => String(item.number)}
          renderItem={renderSurah}
          contentContainerStyle={st.listContent}
          ListEmptyComponent={
            <Text style={st.emptyText}>Surah tidak ditemukan.</Text>
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingVertical: 10,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginVertical: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  surahItem: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  numberBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "45deg" }],
  },
  numberText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primaryDark,
    transform: [{ rotate: "-45deg" }],
  },
  surahTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  surahName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  surahArabic: {
    fontSize: 16,
    color: Colors.primaryDark,
    fontFamily: "AmiriQuran",
  },
  surahMeta: {
    fontSize: 11.5,
    color: Colors.textSecondary,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 999,
  },
  progressText: {
    fontSize: 10.5,
    color: Colors.textSecondary,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.backgroundLight,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
});
