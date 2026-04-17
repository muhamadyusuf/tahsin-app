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

export default function TalaqiScreen() {
  const { userData, role } = useAuthContext();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <FontAwesome name="users" size={32} color={Colors.textLight} />
        <Text style={styles.headerTitle}>Talaqi</Text>
        <Text style={styles.headerSubtitle}>
          {role === "ustadz"
            ? "Beri penilaian pada santri"
            : "Riwayat belajar dengan ustadz"}
        </Text>
      </View>

      {/* Empty State */}
      <View style={styles.emptyState}>
        <FontAwesome
          name="calendar-o"
          size={48}
          color={Colors.textSecondary}
        />
        <Text style={styles.emptyTitle}>Belum Ada Riwayat</Text>
        <Text style={styles.emptySubtitle}>
          {role === "ustadz"
            ? "Mulai beri penilaian pada santri Anda"
            : "Riwayat talaqi akan muncul setelah sesi bersama ustadz"}
        </Text>

        {role === "santri" && !userData?.adminPengajianId && (
          <TouchableOpacity style={styles.selectButton}>
            <Text style={styles.selectButtonText}>
              Pilih Lembaga Pengajian
            </Text>
          </TouchableOpacity>
        )}

        {role === "ustadz" && (
          <TouchableOpacity style={styles.addButton}>
            <FontAwesome name="plus" size={16} color={Colors.textLight} />
            <Text style={styles.addButtonText}>Tambah Sesi Talaqi</Text>
          </TouchableOpacity>
        )}
      </View>
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
  headerCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.textLight,
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textLight,
    opacity: 0.8,
    marginTop: 4,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 32,
  },
  selectButton: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  selectButtonText: {
    color: Colors.textLight,
    fontWeight: "bold",
    fontSize: 14,
  },
  addButton: {
    marginTop: 24,
    backgroundColor: Colors.success,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addButtonText: {
    color: Colors.textLight,
    fontWeight: "bold",
    fontSize: 14,
  },
});
