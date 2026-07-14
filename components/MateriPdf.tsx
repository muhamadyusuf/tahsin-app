import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { Colors } from "@/lib/constants";
import PdfViewer from "@/components/PdfViewer";

interface Props {
  url: string;
  title?: string;
}

// Menampilkan berkas PDF materi seperti halaman buku: pratinjau inline +
// tombol buka layar penuh untuk membaca nyaman.
export default function MateriPdf({ url, title }: Props) {
  const router = useRouter();

  const openFullscreen = () =>
    router.push({
      pathname: "/pdf-viewer",
      params: { url, title: title ?? "Berkas Materi" },
    });

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <FontAwesome name="book" size={16} color={Colors.primary} />
          <Text style={styles.headerText}>Berkas Materi (PDF)</Text>
        </View>
        <Pressable style={styles.fullBtn} onPress={openFullscreen}>
          <FontAwesome name="expand" size={12} color={Colors.primary} />
          <Text style={styles.fullBtnText}>Layar Penuh</Text>
        </Pressable>
      </View>

      <View style={styles.frame}>
        <PdfViewer url={url} style={{ flex: 1 }} />
        <View style={styles.tapHint} pointerEvents="none">
          <Text style={styles.tapHintText}>
            Geser untuk membaca · "Layar Penuh" untuk tampilan buku
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { fontSize: 14, fontWeight: "700", color: Colors.text },
  fullBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  fullBtnText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  frame: {
    width: "100%",
    height: 460,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#fff",
  },
  tapHint: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 6,
    alignItems: "center",
  },
  tapHintText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
