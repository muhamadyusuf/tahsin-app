import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { Colors } from "@/lib/constants";
import { DzikirItem } from "@/lib/dzikir-data";

/**
 * Daftar dzikir dengan penghitung pengulangan per butir.
 * Dipakai oleh menu Dzikir untuk menampilkan tiap kategori.
 */
export default function DzikirList({
  items,
  title,
  subtitle,
  icon,
  accent = Colors.primary,
}: {
  items: DzikirItem[];
  title: string;
  subtitle: string;
  icon: string;
  accent?: string;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const tap = useCallback((id: string, max: number) => {
    setCounts((prev) => {
      const cur = prev[id] ?? 0;
      const next = cur >= max ? 0 : cur + 1;
      return { ...prev, [id]: next };
    });
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { backgroundColor: accent + "1A" }]}>
        <View style={[styles.heroIcon, { backgroundColor: accent }]}>
          <FontAwesome name={icon as any} size={22} color="#fff" />
        </View>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSub}>{subtitle}</Text>
        <Text style={[styles.heroSource, { color: accent }]}>
          {items.length} dzikir shahih — sumber & derajat hadits tercantum di setiap butir
        </Text>
      </View>

      {items.map((d, i) => {
        const done = counts[d.id] ?? 0;
        const complete = done >= d.ulang;
        return (
          <View key={d.id} style={styles.card}>
            <View style={styles.head}>
              <View style={[styles.num, { backgroundColor: accent + "22" }]}>
                <Text style={[styles.numText, { color: accent }]}>{i + 1}</Text>
              </View>
              <Text style={styles.judul}>{d.judul}</Text>
              <View style={[styles.ulangBadge, { backgroundColor: accent }]}>
                <Text style={styles.ulangText}>{d.ulang}×</Text>
              </View>
            </View>

            {!!d.arab && <Text style={styles.arab}>{d.arab}</Text>}
            <Text style={styles.latin}>{d.latin}</Text>
            <Text style={styles.arti}>{d.terjemah}</Text>

            {!!d.fadhilah && (
              <View style={styles.fadhilah}>
                <FontAwesome name="star" size={11} color="#B8860B" />
                <Text style={styles.fadhilahText}>{d.fadhilah}</Text>
              </View>
            )}

            <View style={styles.sumberWrap}>
              <FontAwesome name="book" size={10} color={Colors.textSecondary} />
              <Text style={styles.sumber}>{d.sumber}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.counter,
                { borderColor: accent, backgroundColor: accent + "1A" },
                complete && { backgroundColor: accent },
              ]}
              onPress={() => tap(d.id, d.ulang)}
              activeOpacity={0.85}
            >
              <FontAwesome
                name={complete ? "check" : "hand-o-up"}
                size={13}
                color={complete ? "#fff" : accent}
              />
              <Text style={[styles.counterText, { color: complete ? "#fff" : accent }]}>
                {complete ? "Selesai" : `Baca  ${done} / ${d.ulang}`}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <Text style={styles.footNote}>
        Teks dihimpun dari kumpulan dzikir shahih (terutama Hishnul Muslim). Bila
        menemukan kekeliruan penulisan, mohon dikoreksi kepada pengelola.
      </Text>
    </ScrollView>
  );
}

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 2,
  elevation: 1,
} as const;

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  hero: { borderRadius: 16, padding: 18, alignItems: "center", marginBottom: 16 },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },
  heroSub: { fontSize: 12.5, color: Colors.textSecondary, textAlign: "center", marginTop: 4 },
  heroSource: { fontSize: 11.5, textAlign: "center", marginTop: 8, fontStyle: "italic" },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, ...CARD_SHADOW },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  numText: { fontSize: 12, fontWeight: "800" },
  judul: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.text },
  ulangBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  ulangText: { fontSize: 11, fontWeight: "700", color: "#fff" },

  arab: {
    fontSize: 25,
    color: Colors.text,
    fontFamily: "AmiriQuran",
    textAlign: "right",
    lineHeight: 52,
    marginBottom: 12,
  },
  latin: { fontSize: 13.5, color: Colors.primaryDark, fontStyle: "italic", lineHeight: 21, marginBottom: 8 },
  arti: { fontSize: 13.5, color: Colors.text, lineHeight: 21 },

  fadhilah: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FFF8E1",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  fadhilahText: { flex: 1, fontSize: 12, color: "#795548", lineHeight: 18 },

  sumberWrap: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 12 },
  sumber: { flex: 1, fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

  counter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  counterText: { fontSize: 13, fontWeight: "700" },

  footNote: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 8,
    paddingHorizontal: 8,
  },
});
