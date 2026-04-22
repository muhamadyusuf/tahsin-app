import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors } from "@/lib/constants";

export default function MateriReaderScreen() {
  const { materiId } = useLocalSearchParams<{ materiId: string }>();

  const materi = useQuery(
    api.materi.getById,
    materiId ? { id: materiId as Id<"materi"> } : "skip"
  );

  if (materi === undefined) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!materi) {
    return (
      <View style={st.center}>
        <Text style={st.empty}>Materi tidak ditemukan</Text>
      </View>
    );
  }

  const pages = (materi.deskripsi ?? "")
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      {materi.urlCover ? (
        <Image source={{ uri: materi.urlCover }} style={st.cover} resizeMode="cover" />
      ) : null}

      <View style={st.titleWrap}>
        <Text style={st.title}>{materi.judul}</Text>
        <Text style={st.subtitle}>Mode baca buku</Text>
      </View>

      {pages.length === 0 ? (
        <View style={st.pageCard}>
          <Text style={st.pageText}>Materi ini belum memiliki isi bacaan.</Text>
        </View>
      ) : (
        pages.map((page, index) => (
          <View key={`${materi._id}-page-${index}`} style={st.pageCard}>
            <Text style={st.pageNumber}>Halaman {index + 1}</Text>
            <Text style={st.pageText}>{page}</Text>
          </View>
        ))
      )}

      {materi.urlVideo ? (
        <TouchableOpacity
          style={st.videoBtn}
          onPress={() => Linking.openURL(materi.urlVideo!)}
        >
          <FontAwesome name="play-circle" size={16} color="#fff" />
          <Text style={st.videoBtnText}>Tonton Video Materi</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EFE8D8" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { color: Colors.textSecondary },
  cover: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    marginBottom: 12,
  },
  titleWrap: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#3E2F1C",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6D5C45",
    fontStyle: "italic",
  },
  pageCard: {
    backgroundColor: "#FFF9ED",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E7DCC5",
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  pageNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8B6F47",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pageText: {
    fontSize: 16,
    color: "#3E2F1C",
    lineHeight: 28,
  },
  videoBtn: {
    marginTop: 4,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
  },
  videoBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
