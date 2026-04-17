import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";

export default function UlumulQuranScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerCard}>
        <FontAwesome name="lightbulb-o" size={32} color={Colors.textLight} />
        <Text style={styles.headerTitle}>Ulumul Qur'an</Text>
        <Text style={styles.headerSubtitle}>
          Ilmu-ilmu tentang Al-Qur'an
        </Text>
      </View>

      {/* Coming Soon */}
      <View style={styles.comingSoon}>
        <FontAwesome name="clock-o" size={48} color={Colors.textSecondary} />
        <Text style={styles.comingTitle}>Segera Hadir</Text>
        <Text style={styles.comingSubtitle}>
          Materi Ulumul Qur'an sedang dalam proses penyusunan.
          {"\n"}Nantikan update selanjutnya!
        </Text>
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
  },
  comingSoon: {
    alignItems: "center",
    paddingVertical: 60,
  },
  comingTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.text,
    marginTop: 16,
  },
  comingSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 32,
  },
});
