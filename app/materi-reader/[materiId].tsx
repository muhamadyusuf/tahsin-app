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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors } from "@/lib/constants";

export default function MateriReaderScreen() {
  const { materiId } = useLocalSearchParams<{ materiId: string }>();
  const router = useRouter();

  const materi = useQuery(
    api.materi.getById,
    materiId ? { id: materiId as Id<"materi"> } : "skip"
  );

  // Siblings — used to compute the next materi in sequence
  const siblings = useQuery(
    api.materi.list,
    materi ? { type: materi.type, parentId: materi.parentId } : "skip"
  );

  const quizCounts = useQuery(
    api.quiz.getQuizCountsByMateriIds,
    materiId ? { materiIds: [materiId as Id<"materi">] } : "skip"
  );

  if (materi === undefined || siblings === undefined || quizCounts === undefined) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!materi) {
    return (
      <View style={st.center}>
        <FontAwesome name="exclamation-circle" size={36} color={Colors.textSecondary} />
        <Text style={st.empty}>Materi tidak ditemukan</Text>
      </View>
    );
  }

  // Determine next sibling
  const sortedSiblings = [...siblings].sort((a, b) => a.seq - b.seq);
  const currentIdx = sortedSiblings.findIndex((s) => s._id === materiId);
  const nextSibling =
    currentIdx >= 0 && currentIdx < sortedSiblings.length - 1
      ? sortedSiblings[currentIdx + 1]
      : null;

  const hasQuiz = (quizCounts[0]?.count ?? 0) > 0;
  const quizCount = quizCounts[0]?.count ?? 0;

  // Parse deskripsi into typed blocks (supports # H1, ## H2, body paragraphs)
  type Block =
    | { kind: "h1"; text: string }
    | { kind: "h2"; text: string }
    | { kind: "body"; text: string };

  const blocks: Block[] = [];
  const rawLines = (materi.deskripsi ?? "").split("\n");
  let buffer = "";

  const flushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed) blocks.push({ kind: "body", text: trimmed });
    buffer = "";
  };

  for (const line of rawLines) {
    if (line.startsWith("## ")) {
      flushBuffer();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("# ")) {
      flushBuffer();
      blocks.push({ kind: "h1", text: line.slice(2).trim() });
    } else if (line.trim() === "") {
      flushBuffer();
    } else {
      buffer += (buffer ? "\n" : "") + line;
    }
  }
  flushBuffer();

  const isEmpty = blocks.length === 0;

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Cover image */}
      {materi.urlCover ? (
        <Image source={{ uri: materi.urlCover }} style={st.cover} resizeMode="cover" />
      ) : null}

      {/* Title banner */}
      <View style={[st.titleBanner, materi.urlCover ? st.titleBannerNoCover : null]}>
        <View style={st.titleBadge}>
          <FontAwesome name="book" size={12} color={Colors.primary} />
          <Text style={st.titleBadgeText}>Sub-bab</Text>
        </View>
        <Text style={st.title}>{materi.judul}</Text>
      </View>

      {/* Content card */}
      <View style={st.contentCard}>
        {isEmpty ? (
          <View style={st.emptyContent}>
            <FontAwesome name="file-text-o" size={28} color={Colors.textSecondary} />
            <Text style={st.emptyContentText}>Isi materi belum ditambahkan.</Text>
          </View>
        ) : (
          blocks.map((block, i) => {
            if (block.kind === "h1") {
              return (
                <Text key={i} style={st.heading1}>
                  {block.text}
                </Text>
              );
            }
            if (block.kind === "h2") {
              return (
                <Text key={i} style={st.heading2}>
                  {block.text}
                </Text>
              );
            }
            return (
              <Text key={i} style={st.body}>
                {block.text}
              </Text>
            );
          })
        )}
      </View>

      {/* Video */}
      {materi.urlVideo ? (
        <TouchableOpacity
          style={st.videoRow}
          onPress={() => Linking.openURL(materi.urlVideo!)}
          activeOpacity={0.8}
        >
          <View style={st.videoIcon}>
            <FontAwesome name="play-circle" size={20} color={Colors.primary} />
          </View>
          <View style={st.videoText}>
            <Text style={st.videoTitle}>Video Penjelasan</Text>
            <Text style={st.videoSub}>Tonton untuk pemahaman lebih dalam</Text>
          </View>
          <FontAwesome name="external-link" size={13} color={Colors.textSecondary} />
        </TouchableOpacity>
      ) : null}

      {/* Quiz info / CTA */}
      {hasQuiz ? (
        <View style={st.quizBanner}>
          <View style={st.quizBannerLeft}>
            <View style={st.quizBannerIcon}>
              <FontAwesome name="pencil-square-o" size={20} color="#fff" />
            </View>
            <View>
              <Text style={st.quizBannerTitle}>Quiz tersedia</Text>
              <Text style={st.quizBannerSub}>{quizCount} pertanyaan</Text>
            </View>
          </View>
          <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.7)" />
        </View>
      ) : (
        <View style={st.noQuizBanner}>
          <FontAwesome name="info-circle" size={16} color={Colors.textSecondary} />
          <Text style={st.noQuizText}>
            Bank soal untuk sub-bab ini belum tersedia
          </Text>
        </View>
      )}

      {/* Next materi info */}
      {nextSibling ? (
        <View style={st.nextBanner}>
          <FontAwesome name="arrow-right" size={13} color={Colors.primary} />
          <Text style={st.nextBannerText} numberOfLines={1}>
            Berikutnya: {nextSibling.judul}
          </Text>
        </View>
      ) : null}

      {/* Bottom actions */}
      <View style={st.actions}>
        <TouchableOpacity
          style={st.btnBack}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <FontAwesome name="arrow-left" size={14} color={Colors.primary} />
          <Text style={st.btnBackText}>Kembali</Text>
        </TouchableOpacity>

        {hasQuiz ? (
          <TouchableOpacity
            style={st.btnQuiz}
            onPress={() =>
              router.push({
                pathname: "/quiz/[materiId]",
                params: {
                  materiId: materiId!,
                  materiTitle: materi.judul,
                  ...(nextSibling ? { nextMateriId: nextSibling._id } : {}),
                },
              })
            }
            activeOpacity={0.85}
          >
            <Text style={st.btnQuizText}>Mulai Quiz</Text>
            <FontAwesome name="arrow-right" size={14} color="#fff" />
          </TouchableOpacity>
        ) : nextSibling ? (
          <TouchableOpacity
            style={st.btnNext}
            onPress={() =>
              router.replace({
                pathname: "/materi-reader/[materiId]",
                params: { materiId: nextSibling._id },
              })
            }
            activeOpacity={0.85}
          >
            <Text style={st.btnNextText}>Materi Berikutnya</Text>
            <FontAwesome name="arrow-right" size={14} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.background,
  },
  empty: { fontSize: 15, color: Colors.textSecondary },

  // Cover
  cover: {
    width: "100%",
    height: 200,
  },

  // Title
  titleBanner: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  titleBannerNoCover: {
    // no extra styles needed, same appearance
  },
  titleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  titleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    lineHeight: 30,
  },

  // Content card
  contentCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  heading1: {
    fontSize: 19,
    fontWeight: "800",
    color: Colors.primaryDark,
    marginTop: 6,
  },
  heading2: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    paddingLeft: 10,
  },
  body: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 28,
    textAlign: "justify",
  },
  emptyContent: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  emptyContentText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },

  // Video
  videoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  videoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  videoText: { flex: 1 },
  videoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  videoSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Quiz banner
  quizBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
  },
  quizBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quizBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  quizBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  quizBannerSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },

  // No quiz banner
  noQuizBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noQuizText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Next-materi info strip
  nextBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nextBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primaryDark,
    fontWeight: "600",
  },

  // Actions
  actions: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 20,
  },
  btnBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  btnBackText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  btnQuiz: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
  },
  btnQuizText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  btnNext: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingVertical: 13,
  },
  btnNextText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
