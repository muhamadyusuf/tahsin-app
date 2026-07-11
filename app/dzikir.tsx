import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useAuthContext } from "@/lib/auth-context";
import { Colors } from "@/lib/constants";
import { DZIKIR_KATEGORI, DzikirKategori } from "@/lib/dzikir-data";
import DzikirList from "@/components/DzikirList";

/** Tanggal lokal dalam format YYYY-MM-DD. */
function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function DzikirScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<DzikirKategori | null>(null);
  const { userData } = useAuthContext();

  // Butir dzikir yang sudah diselesaikan hari ini (untuk menandai progres).
  const selesaiHariIni = useQuery(
    api.dzikir.getDzikirSelesaiByDate,
    userData?._id ? { userId: userData._id, tanggal: todayStr() } : "skip"
  );
  const completedIds = selected
    ? (selesaiHariIni ?? [])
        .filter((r) => r.kategoriId === selected.id)
        .map((r) => r.itemId)
    : [];

  const handleBack = () => {
    if (selected) {
      setSelected(null);
      return;
    }
    router.back();
  };

  const renderHeader = (title: string) => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
        <FontAwesome name="arrow-left" size={16} color={Colors.textLight} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity
        style={styles.headerAction}
        onPress={() => router.push("/rekap-ibadah")}
      >
        <FontAwesome name="bar-chart" size={16} color={Colors.textLight} />
      </TouchableOpacity>
    </View>
  );

  // ── DETAIL KATEGORI ────────────────────────────────────────────────────────
  if (selected) {
    return (
      <View style={styles.container}>
        {renderHeader(selected.nama)}
        <DzikirList
          items={selected.items}
          title={selected.nama}
          subtitle={selected.deskripsi}
          icon={selected.icon}
          accent={selected.warna}
          userId={userData?._id}
          kategoriId={selected.id}
          kategoriLabel={selected.nama}
          completedIds={completedIds}
        />
      </View>
    );
  }

  // ── HOME (DAFTAR KATEGORI) ─────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {renderHeader("Dzikir")}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <FontAwesome name="book" size={30} color={Colors.primary} />
          <Text style={styles.heroTitle}>Kumpulan Dzikir Harian</Text>
          <Text style={styles.heroSub}>
            Dzikir yang sering diamalkan umat, lengkap dengan sumber & derajat keshahihannya
          </Text>
        </View>

        {DZIKIR_KATEGORI.map((k) => (
          <TouchableOpacity
            key={k.id}
            style={styles.catCard}
            activeOpacity={0.85}
            onPress={() => setSelected(k)}
          >
            <View style={[styles.catIcon, { backgroundColor: k.warna + "1A" }]}>
              <FontAwesome name={k.icon as any} size={20} color={k.warna} />
            </View>
            <View style={styles.catInfo}>
              <Text style={styles.catName}>{k.nama}</Text>
              <Text style={styles.catDesc}>{k.deskripsi}</Text>
            </View>
            <View style={styles.catMeta}>
              <Text style={[styles.catCount, { color: k.warna }]}>{k.items.length}</Text>
              <FontAwesome name="chevron-right" size={12} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.footNote}>
          Sumber utama: Hishnul Muslim (Sa'id bin 'Ali al-Qahthani) yang menghimpun
          dzikir dari Al-Qur'an dan hadits shahih/hasan.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

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
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: Colors.textLight },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  scroll: { padding: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  heroTitle: { fontSize: 18, fontWeight: "700", color: Colors.primaryDark, marginTop: 10 },
  heroSub: { fontSize: 12.5, color: Colors.textSecondary, textAlign: "center", marginTop: 4 },

  catCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  catIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  catInfo: { flex: 1 },
  catName: { fontSize: 14.5, fontWeight: "700", color: Colors.text },
  catDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  catMeta: { alignItems: "center", flexDirection: "row", gap: 8 },
  catCount: { fontSize: 15, fontWeight: "800" },

  footNote: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 12,
    paddingHorizontal: 8,
  },
});
