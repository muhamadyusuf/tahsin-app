import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import PdfViewer from "@/components/PdfViewer";

export default function PdfViewerScreen() {
  const { url } = useLocalSearchParams<{ url?: string; title?: string }>();

  if (!url) {
    return (
      <View style={styles.center}>
        <FontAwesome name="exclamation-circle" size={36} color={Colors.textSecondary} />
        <Text style={styles.empty}>Berkas tidak ditemukan</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PdfViewer url={url} style={{ flex: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.background,
  },
  empty: { fontSize: 15, color: Colors.textSecondary },
});
