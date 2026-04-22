import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";

export default function MateriDetailScreen() {
  const { id, type } = useLocalSearchParams<{
    id?: string;
    type?: string;
  }>();
  const router = useRouter();

  const materi = useQuery(
    api.materi.getById,
    id ? { id: id as Id<"materi"> } : "skip"
  );

  const subBabList = useQuery(
    api.materi.getChildren,
    id ? { parentId: id as Id<"materi"> } : "skip"
  );

  const removeMateri = useMutation(api.materi.remove);

  const handleDelete = (subBabId: string, subBabJudul: string) => {
    if (Platform.OS === "web") {
        if (window.confirm(`Yakin ingin menghapus "${subBabJudul}"?`)) {
            removeMateri({ id: subBabId as any });
        }
    } else {
        Alert.alert("Hapus Sub-bab", `Yakin ingin menghapus "${subBabJudul}"?`, [
        { text: "Batal", style: "cancel" },
        {
            text: "Hapus",
            style: "destructive",
            onPress: async () => {
                try {
                    await removeMateri({ id: subBabId as any });
                    Alert.alert("Berhasil", "Sub-bab telah dihapus.");
                } catch {
                    Alert.alert("Error", "Gagal menghapus sub-bab.");
                }
            },
        },
        ]);
    }
  };

  if (!materi) {
    return (
      <View style={st.container}>
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  const sortedSubBab = (subBabList ?? []).sort((a, b) => a.seq - b.seq);

  return (
    <View style={st.container}>

      {/* Materi Info Card */}
      <View style={st.materiCard}>
        <View style={st.seqBadge}>
          <Text style={st.seqText}>{materi.seq}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.materiTitle}>{materi.judul}</Text>
          {materi.deskripsi && (
            <Text style={st.materiDesc} numberOfLines={2}>
              {materi.deskripsi}
            </Text>
          )}
        </View>
        <View
          style={[
            st.statusDot,
            {
              backgroundColor: materi.isShow ? Colors.success : Colors.error,
            },
          ]}
        />
      </View>

      {/* Sub-bab Section Title */}
      <View style={st.sectionHeader}>
        <FontAwesome name="list" size={16} color={Colors.primary} />
        <Text style={st.sectionTitle}>
          Daftar Sub-bab ({sortedSubBab.length})
        </Text>
      </View>

      {/* Sub-bab List */}
      {subBabList === null ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : sortedSubBab.length === 0 ? (
        <View style={st.emptyContainer}>
          <FontAwesome
            name="folder-open"
            size={48}
            color={Colors.textSecondary}
          />
          <Text style={st.emptyText}>Belum ada sub-bab</Text>
          <Text style={st.emptySubText}>
            Tekan tombol "Tambah Sub-bab" untuk membuat
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedSubBab}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={st.subBabCard}>
              <View style={st.subBabHeader}>
                <View style={st.subSeqBadge}>
                  <Text style={st.subSeqText}>{item.seq}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.subBabTitle}>{item.judul}</Text>
                  {item.deskripsi && (
                    <Text style={st.subBabDesc} numberOfLines={2}>
                      {item.deskripsi}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    st.statusDot,
                    {
                      backgroundColor: item.isShow
                        ? Colors.success
                        : Colors.error,
                    },
                  ]}
                />
              </View>

              <View style={st.subBabMeta}>
                {item.urlVideo && (
                  <View style={st.metaTag}>
                    <FontAwesome
                      name="play-circle"
                      size={11}
                      color={Colors.info}
                    />
                    <Text style={st.metaTagText}>Video</Text>
                  </View>
                )}
                {item.urlCover && (
                  <View style={st.metaTag}>
                    <FontAwesome
                      name="image"
                      size={11}
                      color={Colors.warning}
                    />
                    <Text style={st.metaTagText}>Cover</Text>
                  </View>
                )}
                <Text style={st.visibilityText}>
                  {item.isShow ? "Tampil" : "Tersembunyi"}
                </Text>
              </View>

              <View style={st.subBabActions}>
                <Pressable
                  style={({ pressed }) => [
                    st.actionBtn,
                    st.actionBtnQuiz,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/quiz-manage",
                      params: {
                        materiId: item._id,
                      },
                    })
                  }
                >
                  <FontAwesome
                    name="question-circle"
                    size={13}
                    color={Colors.primaryDark}
                  />
                  <Text
                    style={[
                      st.actionBtnText,
                      { color: Colors.primaryDark },
                    ]}
                  >
                    Quiz
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    st.actionBtn,
                    st.actionBtnEdit,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/materi-form",
                      params: {
                        id: item._id,
                        type: type,
                      },
                    })
                  }
                >
                  <FontAwesome
                    name="pencil"
                    size={13}
                    color={Colors.primary}
                  />
                  <Text
                    style={[
                      st.actionBtnText,
                      { color: Colors.primary },
                    ]}
                  >
                    Edit
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    st.actionBtn,
                    st.actionBtnDelete,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() =>
                    handleDelete(item._id, item.judul)
                  }
                >
                  <FontAwesome
                    name="trash"
                    size={13}
                    color={Colors.error}
                  />
                  <Text
                    style={[
                      st.actionBtnText,
                      { color: Colors.error },
                    ]}
                  >
                    Hapus
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Floating Add Button */}
      <View style={st.floatingButtonContainer}>
        <Pressable
          style={({ pressed }) => [
            st.floatingButton,
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
          onPress={() =>
            router.push({
              pathname: "/materi-form",
              params: {
                type: type,
                parentId: id,
              },
            })
          }
        >
          <FontAwesome name="plus" size={24} color="#fff" />
          <Text style={st.floatingButtonText}>Tambah Sub-bab</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.primary,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  materiCard: {
    margin: 16,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  seqBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
  },
  seqText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
  materiTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  materiDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 8,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginTop: 16,
    textAlign: "center",
  },
  emptySubText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  subBabCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  subBabHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  subSeqBadge: {
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 8,
    marginTop: 2,
  },
  subSeqText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.info,
  },
  subBabTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  subBabDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  subBabMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  metaTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaTagText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  visibilityText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginLeft: "auto",
  },
  subBabActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionBtnEdit: {
    backgroundColor: Colors.primary + "15",
    borderColor: Colors.primary + "40",
  },
  actionBtnDelete: {
    backgroundColor: Colors.error + "15",
    borderColor: Colors.error + "40",
  },
  actionBtnQuiz: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryDark + "40",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  floatingButtonContainer: {
    position: "absolute",
    bottom: 20,
    right: 16,
    left: 16,
  },
  floatingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
