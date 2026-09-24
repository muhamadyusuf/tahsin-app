import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";

const KONTRIBUTOR_DATA = [
  {
    singkatan: "PCNU",
    nama: "Pengurus Cabang Nahdlatul Ulama (PCNU) Kota Tangerang Selatan",
    deskripsi:
      "Pengurus Cabang Nahdlatul Ulama (PCNU) Kota Tangerang Selatan merupakan kepengurusan Nahdlatul Ulama di tingkat kota yang menaungi kegiatan keagamaan dan dakwah di Kota Tangerang Selatan.",
  },
  {
    singkatan: "FSPP",
    nama: "Forum Silaturahmi Pondok Pesantren (FSPP) Kota Tangerang Selatan",
    deskripsi:
      "Forum Silaturahmi Pondok Pesantren (FSPP) Kota Tangerang Selatan merupakan wadah silaturahmi dan koordinasi antar pondok pesantren di Kota Tangerang Selatan.",
  },
];

export default function KontributorScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header info */}
      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <FontAwesome name="handshake-o" size={26} color={Colors.primary} />
        </View>
        <Text style={styles.infoTitle}>Kontributor</Text>
        <Text style={styles.infoDesc}>
          Tangsel Mengaji hadir berkat kontribusi lembaga-lembaga berikut.
        </Text>
      </View>

      {/* Daftar kontributor */}
      {KONTRIBUTOR_DATA.map((item) => (
        <View key={item.singkatan} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.singkatan}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.nama}</Text>
          </View>
          <Text style={styles.cardDesc}>{item.deskripsi}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  infoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 6,
  },
  infoDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    lineHeight: 20,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
