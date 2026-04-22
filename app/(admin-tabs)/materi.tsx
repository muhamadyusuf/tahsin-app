import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";

type MateriType = "tahsin" | "ulumul_quran";

export default function MateriScreen() {
  const router = useRouter();
  const [activeType, setActiveType] = useState<MateriType>("tahsin");

  const materiList = useQuery(api.materi.list, { type: activeType });
  const materiIds = (materiList ?? []).map((item) => item._id);
  const quizCounts = useQuery(
    api.quiz.getQuizCountsByMateriIds,
    materiIds.length > 0 ? { materiIds } : "skip"
  );
  const removeMateri = useMutation(api.materi.remove);

  const quizCountMap = new Map((quizCounts ?? []).map((item) => [item.materiId, item.count]));

  const handleDelete = (id: string, judul: string) => {
    Alert.alert("Hapus Materi", `Yakin ingin menghapus "${judul}"?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await removeMateri({ id: id as any });
            Alert.alert("Berhasil", "Materi telah dihapus.");
          } catch {
            Alert.alert("Error", "Gagal menghapus materi.");
          }
        },
      },
    ]);
  };

  return (
    <View style={st.container}>
      {/* Type Tabs */}
      <View style={st.tabRow}>
        <Pressable
          style={[st.tab, activeType === "tahsin" && st.tabActive]}
          onPress={() => setActiveType("tahsin")}
        >
          <Text
            style={[
              st.tabText,
              activeType === "tahsin" && st.tabTextActive,
            ]}
          >
            Tahsin
          </Text>
        </Pressable>
        <Pressable
          style={[st.tab, activeType === "ulumul_quran" && st.tabActive]}
          onPress={() => setActiveType("ulumul_quran")}
        >
          <Text
            style={[
              st.tabText,
              activeType === "ulumul_quran" && st.tabTextActive,
            ]}
          >
            Ulumul Quran
          </Text>
        </Pressable>
      </View>

      <View style={st.guideCard}>
        <Text style={st.guideTitle}>Cara Input Quiz (Admin)</Text>
        <Text style={st.guideText}>1. Pilih materi/sub-bab di bawah</Text>
        <Text style={st.guideText}>2. Tekan tombol Quiz pada kartu materi</Text>
        <Text style={st.guideText}>3. Isi pertanyaan dan opsi jawaban lalu simpan</Text>
      </View>

      {!materiList ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={materiList.sort((a, b) => a.seq - b.seq)}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => {
            const quizCount = quizCountMap.get(item._id) ?? 0;
            return (
              <View style={st.card}>
                <View style={st.cardHeader}>
                  <View style={st.seqBadge}>
                    <Text style={st.seqText}>{item.seq}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.cardTitle}>{item.judul}</Text>
                    {item.deskripsi && (
                      <Text style={st.cardDesc} numberOfLines={2}>
                        {item.deskripsi}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      st.statusDot,
                      { backgroundColor: item.isShow ? Colors.success : Colors.error },
                    ]}
                  />
                </View>

                <View
                  style={st.cardMeta}
                >
                  {item.urlVideo && (
                    <View style={st.metaTag}>
                      <FontAwesome name="play-circle" size={12} color={Colors.info} />
                      <Text style={st.metaTagText}>Video</Text>
                    </View>
                  )}
                  {item.urlCover && (
                    <View style={st.metaTag}>
                      <FontAwesome name="image" size={12} color={Colors.warning} />
                      <Text style={st.metaTagText}>Cover</Text>
                    </View>
                  )}
                  <View style={st.metaTag}>
                    <FontAwesome name="question-circle" size={12} color={Colors.primary} />
                    <Text style={st.metaTagText}>Quiz {quizCount}</Text>
                  </View>
                  <Text style={st.visibilityText}>
                    {item.isShow ? "Tampil" : "Tersembunyi"}
                  </Text>
                </View>

                <View style={st.cardActions}>
                  <Pressable
                    style={({ pressed }) => [
                      st.actionBtn,
                      st.actionBtnSub,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/materi-detail",
                        params: { id: item._id, type: activeType },
                      })
                    }
                  >
                    <FontAwesome name="sitemap" size={13} color={Colors.info} />
                    <Text style={[st.actionBtnText, { color: Colors.info }]}>Sub-bab</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      st.actionBtn,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/materi-form",
                        params: { id: item._id, type: activeType },
                      })
                    }
                  >
                    <FontAwesome name="pencil" size={13} color={Colors.primary} />
                    <Text style={st.actionBtnText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      st.actionBtn,
                      st.actionBtnQuiz,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/quiz-manage",
                        params: { materiId: item._id },
                      })
                    }
                  >
                    <FontAwesome name="question-circle" size={13} color={Colors.primaryDark} />
                    <Text style={[st.actionBtnText, { color: Colors.primaryDark }]}>Quiz</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      st.actionBtn,
                      st.actionBtnDanger,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => handleDelete(item._id, item.judul)}
                  >
                    <FontAwesome name="trash-o" size={13} color={Colors.error} />
                    <Text style={[st.actionBtnText, { color: Colors.error }]}>Hapus</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={st.empty}>
              <FontAwesome name="book" size={32} color={Colors.border} />
              <Text style={st.emptyText}>Belum ada materi</Text>
            </View>
          }
        />
      )}

      {/* FAB Add */}
      <Pressable
        style={({ pressed }) => [st.fab, pressed && { opacity: 0.85 }]}
        onPress={() =>
          router.push({
            pathname: "/materi-form",
            params: { type: activeType },
          })
        }
      >
        <FontAwesome name="plus" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  tabRow: {
    flexDirection: "row",
    padding: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },

  guideCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    gap: 2,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  guideText: {
    fontSize: 12,
    color: Colors.primaryDark,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  seqBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  seqText: { fontSize: 13, fontWeight: "800", color: Colors.primary },
  cardTitle: { fontSize: 15, fontWeight: "600", color: Colors.text },
  cardDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },

  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  metaTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaTagText: { fontSize: 11, color: Colors.textSecondary },
  visibilityText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: "auto",
  },

  cardActions: {
    flexDirection: "row",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  actionBtnQuiz: {
    backgroundColor: "#DCEFE0",
  },
  actionBtnSub: {
    backgroundColor: "#E8F2FF",
  },
  actionBtnDanger: { backgroundColor: "#FFEBEE" },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});
