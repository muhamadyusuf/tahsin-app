import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { Colors } from "@/lib/constants";

interface ApiInfo {
  name: string;
  description: string;
  baseUrl: string;
  usedFor: string;
  icon: keyof typeof FontAwesome.glyphMap;
}

const API_LIST: ApiInfo[] = [
  {
    name: "Al-Quran Cloud API",
    description: "API Al-Quran open-source yang menyediakan data teks, terjemahan, dan audio Al-Quran.",
    baseUrl: "https://api.alquran.cloud/v1",
    usedFor: "Mushaf Al-Quran, teks ayat, terjemahan, dan audio tilawah",
    icon: "book",
  },
  {
    name: "eQuran Sholat API",
    description: "API jadwal sholat berdasarkan koordinat lokasi pengguna di Indonesia.",
    baseUrl: "https://equran.id/api/v2/shalat",
    usedFor: "Jadwal waktu sholat harian",
    icon: "clock-o",
  },
  {
    name: "eQuran Do'a API",
    description: "API kumpulan do'a sehari-hari beserta teks Arab, transliterasi, dan terjemahan.",
    baseUrl: "https://equran.id/api/doa",
    usedFor: "Koleksi do'a sehari-hari",
    icon: "heart",
  },
  {
    name: "MyQuran Hadis API",
    description: "API kumpulan hadis dari berbagai kitab hadis dengan teks Arab dan terjemahan Indonesia.",
    baseUrl: "https://api.myquran.com/v3/hadis",
    usedFor: "Konten hadis pilihan",
    icon: "list",
  },
  {
    name: "Nominatim (OpenStreetMap)",
    description: "API geocoding gratis dari OpenStreetMap untuk mengubah koordinat GPS menjadi nama lokasi.",
    baseUrl: "https://nominatim.openstreetmap.org",
    usedFor: "Deteksi nama kota untuk jadwal sholat",
    icon: "map-marker",
  },
  {
    name: "Convex",
    description: "Backend-as-a-Service real-time yang digunakan sebagai database dan server aplikasi.",
    baseUrl: "https://convex.dev",
    usedFor: "Database pengguna, materi, tilawah, talaqi, dan quiz",
    icon: "database",
  },
  {
    name: "Clerk",
    description: "Layanan autentikasi dan manajemen pengguna yang aman dengan dukungan SSO.",
    baseUrl: "https://clerk.com",
    usedFor: "Login, registrasi, dan manajemen sesi pengguna",
    icon: "lock",
  },
];

export default function InfoApiScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>
        Berikut adalah daftar API dan layanan eksternal yang digunakan dalam aplikasi ini.
      </Text>

      {API_LIST.map((api, index) => (
        <View key={index} style={styles.apiCard}>
          <View style={styles.apiHeader}>
            <View style={styles.apiIconContainer}>
              <FontAwesome name={api.icon} size={20} color={Colors.primary} />
            </View>
            <Text style={styles.apiName}>{api.name}</Text>
          </View>

          <Text style={styles.apiDescription}>{api.description}</Text>

          <View style={styles.apiDetail}>
            <Text style={styles.apiDetailLabel}>Base URL</Text>
            <TouchableOpacity onPress={() => Linking.openURL(api.baseUrl)}>
              <Text style={styles.apiUrl}>{api.baseUrl}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.apiDetail}>
            <Text style={styles.apiDetailLabel}>Digunakan untuk</Text>
            <Text style={styles.apiDetailValue}>{api.usedFor}</Text>
          </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.text,
  },
  headerRight: {
    width: 36,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  apiCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  apiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  apiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  apiName: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.text,
    flex: 1,
  },
  apiDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 10,
  },
  apiDetail: {
    marginTop: 6,
  },
  apiDetailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  apiUrl: {
    fontSize: 13,
    color: Colors.primary,
    textDecorationLine: "underline",
  },
  apiDetailValue: {
    fontSize: 13,
    color: Colors.text,
  },
});
