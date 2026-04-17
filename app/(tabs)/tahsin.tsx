import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

// Placeholder BABs from the Tahsin book
const TAHSIN_BABS = [
  { id: 1, title: "Pendahuluan", icon: "book" as const, locked: false },
  { id: 2, title: "Pengantar Ilmu Tajwid", icon: "info-circle" as const, locked: true },
  { id: 3, title: "Tempat Keluarnya Huruf", icon: "comment" as const, locked: true },
  { id: 4, title: "Sifat-sifat Huruf", icon: "list" as const, locked: true },
  { id: 5, title: "Hukum Nun Mati & Tanwin", icon: "file-text" as const, locked: true },
  { id: 6, title: "Hukum Mim Mati", icon: "file-text" as const, locked: true },
  { id: 7, title: "Hukum Mim & Nun Bertasydid", icon: "file-text" as const, locked: true },
  { id: 8, title: "Hukum Alif Lam", icon: "file-text" as const, locked: true },
  { id: 9, title: "Hukum Mad", icon: "file-text" as const, locked: true },
  { id: 10, title: "Tafkhim & Tarqiq", icon: "file-text" as const, locked: true },
  { id: 11, title: "Idgham Mutamatsilain, Mutajanisain & Mutaqaribain", icon: "file-text" as const, locked: true },
  { id: 12, title: "Waqof & Pembagiannya", icon: "file-text" as const, locked: true },
  { id: 13, title: "Istilah-istilah Dalam Alquran", icon: "file-text" as const, locked: true },
  { id: 14, title: "Hamzah Qatha' & Hamzah Washal", icon: "file-text" as const, locked: true },
];

export default function TahsinScreen() {
  const { userData } = useAuthContext();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>Belajar Tahsin</Text>
        <Text style={styles.progressSubtitle}>
          Pedoman Dauroh Al-Qur'an
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "7%" }]} />
        </View>
        <Text style={styles.progressText}>1 dari 14 BAB</Text>
      </View>

      {/* BAB List */}
      {TAHSIN_BABS.map((bab, index) => (
        <TouchableOpacity
          key={bab.id}
          style={[styles.babCard, bab.locked && styles.babLocked]}
          disabled={bab.locked}
        >
          <View
            style={[
              styles.babIconContainer,
              bab.locked && styles.babIconLocked,
            ]}
          >
            {bab.locked ? (
              <FontAwesome name="lock" size={20} color={Colors.textSecondary} />
            ) : (
              <FontAwesome name={bab.icon} size={20} color={Colors.primary} />
            )}
          </View>
          <View style={styles.babInfo}>
            <Text style={styles.babNumber}>BAB {bab.id}</Text>
            <Text
              style={[styles.babTitle, bab.locked && styles.babTitleLocked]}
              numberOfLines={2}
            >
              {bab.title}
            </Text>
          </View>
          {!bab.locked && (
            <FontAwesome
              name="chevron-right"
              size={14}
              color={Colors.textSecondary}
            />
          )}
        </TouchableOpacity>
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
    paddingBottom: 100,
  },
  progressHeader: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.textLight,
  },
  progressSubtitle: {
    fontSize: 14,
    color: Colors.textLight,
    opacity: 0.8,
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 4,
    marginTop: 16,
  },
  progressFill: {
    height: 8,
    backgroundColor: Colors.textLight,
    borderRadius: 4,
  },
  progressText: {
    color: Colors.textLight,
    fontSize: 12,
    marginTop: 8,
    opacity: 0.8,
  },
  babCard: {
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
  babLocked: {
    opacity: 0.6,
  },
  babIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  babIconLocked: {
    backgroundColor: Colors.border,
  },
  babInfo: {
    flex: 1,
  },
  babNumber: {
    fontSize: 11,
    fontWeight: "bold",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  babTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    marginTop: 2,
  },
  babTitleLocked: {
    color: Colors.textSecondary,
  },
});
