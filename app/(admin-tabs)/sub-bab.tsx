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
import { Id } from "@/convex/_generated/dataModel";

type MateriType = "tahsin" | "ulumul_quran";

interface MateriWithChildren {
  _id: Id<"materi">;
  _creationTime: number;
  seq: number;
  judul: string;
  deskripsi?: string;
  urlCover?: string;
  urlVideo?: string;
  isShow: boolean;
  type: MateriType;
  parentId?: Id<"materi">;
  children: MateriWithChildren[];
}

export default function SubBabScreen() {
  const router = useRouter();
  const [activeType, setActiveType] = useState<MateriType>("tahsin");
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

  const allMateri = useQuery(api.materi.listAllByType, { type: activeType });
  const removeMateri = useMutation(api.materi.remove);

  // Build hierarchical structure
  const buildHierarchy = (items: any[]): MateriWithChildren[] => {
    const map = new Map<string, MateriWithChildren>();
    const roots: MateriWithChildren[] = [];

    // Create map of all items
    items.forEach((item) => {
      map.set(item._id, { ...item, children: [] });
    });

    // Link children to parents
    items.forEach((item) => {
      if (item.parentId) {
        const parent = map.get(item.parentId);
        if (parent) {
          parent.children.push(map.get(item._id)!);
        }
      } else {
        roots.push(map.get(item._id)!);
      }
    });

    // Sort children
    roots.forEach((root) => {
      root.children.sort((a, b) => a.seq - b.seq);
    });

    return roots.sort((a, b) => a.seq - b.seq);
  };

  const handleDeleteSubBab = (id: string, judul: string) => {
    Alert.alert("Hapus Sub-bab", `Yakin ingin menghapus "${judul}"?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await removeMateri({ id: id as any });
            Alert.alert("Berhasil", "Sub-bab telah dihapus.");
          } catch {
            Alert.alert("Error", "Gagal menghapus sub-bab.");
          }
        },
      },
    ]);
  };

  const hierarchyData = allMateri ? buildHierarchy(allMateri) : null;
  const isExpanded = (parentId: string) => expandedParentId === parentId;

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
        <Text style={st.guideTitle}>Kelola Sub-bab</Text>
        <Text style={st.guideText}>Tekan pada nama bab untuk membuka/tutup daftar sub-bab</Text>
        <Text style={st.guideText}>Gunakan tombol Quiz, Edit, dan Hapus untuk mengelola sub-bab</Text>
      </View>

      {!hierarchyData ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : hierarchyData.length === 0 ? (
        <View style={st.center}>
          <Text style={st.emptyText}>Belum ada materi untuk tipe ini</Text>
        </View>
      ) : (
        <FlatList
          data={hierarchyData}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item: parentMateri }) => {
            const expanded = isExpanded(parentMateri._id);
            const hasChildren = parentMateri.children.length > 0;

            return (
              <View style={st.parentCard}>
                {/* Parent Header */}
                <Pressable
                  style={({ pressed }) => [
                    st.parentHeader,
                    pressed && { backgroundColor: Colors.primaryLight },
                  ]}
                  onPress={() =>
                    setExpandedParentId(expanded ? null : parentMateri._id)
                  }
                >
                  <View
                    style={[
                      st.expandIcon,
                      {
                        transform: [
                          {
                            rotate: expanded ? "90deg" : "0deg",
                          },
                        ],
                      },
                    ]}
                  >
                    <FontAwesome
                      name="chevron-right"
                      size={16}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={st.seqBadge}>
                      <Text style={st.seqText}>{parentMateri.seq}</Text>
                    </View>
                    <Text style={st.parentTitle}>{parentMateri.judul}</Text>
                    {parentMateri.deskripsi && (
                      <Text style={st.parentDesc} numberOfLines={1}>
                        {parentMateri.deskripsi}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      st.statusDot,
                      {
                        backgroundColor: parentMateri.isShow
                          ? Colors.success
                          : Colors.error,
                      },
                    ]}
                  />
                </Pressable>

                {/* Sub-bab List */}
                {expanded && (
                  <View style={st.subBabContainer}>
                    {hasChildren ? (
                      <>
                        {parentMateri.children.map((subBab) => (
                          <View key={subBab._id} style={st.subBabCard}>
                            <View style={st.subBabHeader}>
                              <View style={st.subSeqBadge}>
                                <Text style={st.subSeqText}>{subBab.seq}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={st.subBabTitle}>{subBab.judul}</Text>
                                {subBab.deskripsi && (
                                  <Text
                                    style={st.subBabDesc}
                                    numberOfLines={2}
                                  >
                                    {subBab.deskripsi}
                                  </Text>
                                )}
                              </View>
                              <View
                                style={[
                                  st.statusDot,
                                  {
                                    backgroundColor: subBab.isShow
                                      ? Colors.success
                                      : Colors.error,
                                  },
                                ]}
                              />
                            </View>

                            <View style={st.subBabMeta}>
                              {subBab.urlVideo && (
                                <View style={st.metaTag}>
                                  <FontAwesome
                                    name="play-circle"
                                    size={11}
                                    color={Colors.info}
                                  />
                                  <Text
                                    style={st.metaTagText}
                                  >
                                    Video
                                  </Text>
                                </View>
                              )}
                              {subBab.urlCover && (
                                <View style={st.metaTag}>
                                  <FontAwesome
                                    name="image"
                                    size={11}
                                    color={Colors.warning}
                                  />
                                  <Text
                                    style={st.metaTagText}
                                  >
                                    Cover
                                  </Text>
                                </View>
                              )}
                              <Text style={st.visibilityText}>
                                {subBab.isShow ? "Tampil" : "Tersembunyi"}
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
                                    params: { materiId: subBab._id },
                                  })
                                }
                              >
                                <FontAwesome
                                  name="question-circle"
                                  size={12}
                                  color={Colors.primaryDark}
                                />
                                <Text
                                  style={[
                                    st.actionBtnText,
                                    { color: Colors.primaryDark, fontSize: 12 },
                                  ]}
                                >
                                  Quiz
                                </Text>
                              </Pressable>

                              <Pressable
                                style={({ pressed }) => [
                                  st.actionBtn,
                                  pressed && { opacity: 0.7 },
                                ]}
                                onPress={() =>
                                  router.push({
                                    pathname: "/materi-form",
                                    params: {
                                      id: subBab._id,
                                      type: activeType,
                                    },
                                  })
                                }
                              >
                                <FontAwesome
                                  name="pencil"
                                  size={12}
                                  color={Colors.primary}
                                />
                                <Text
                                  style={[
                                    st.actionBtnText,
                                    { fontSize: 12 },
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
                                  handleDeleteSubBab(subBab._id, subBab.judul)
                                }
                              >
                                <FontAwesome
                                  name="trash"
                                  size={12}
                                  color={Colors.error}
                                />
                                <Text
                                  style={[
                                    st.actionBtnText,
                                    { color: Colors.error, fontSize: 12 },
                                  ]}
                                >
                                  Hapus
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </>
                    ) : (
                      <View style={st.noSubBabContainer}>
                        <Text style={st.noSubBabText}>
                          Belum ada sub-bab
                        </Text>
                      </View>
                    )}

                    {/* Add Sub-bab Button */}
                    <Pressable
                      style={({ pressed }) => [
                        st.addSubBabBtn,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/materi-form",
                          params: {
                            type: activeType,
                            parentId: parentMateri._id,
                          },
                        })
                      }
                    >
                      <FontAwesome
                        name="plus"
                        size={14}
                        color={Colors.info}
                      />
                      <Text style={[st.actionBtnText, { color: Colors.info }]}>
                        Tambah Sub-bab
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  guideCard: {
    margin: 12,
    padding: 12,
    backgroundColor: Colors.infoLight,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  guideText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  parentCard: {
    marginBottom: 12,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  parentHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.surface,
  },
  expandIcon: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  parentTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginTop: 4,
  },
  parentDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  seqBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  seqText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
  subBabContainer: {
    padding: 12,
    backgroundColor: Colors.backgroundLight,
  },
  subBabCard: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  subBabHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginTop: 6,
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
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
    backgroundColor: Colors.primary + "10",
  },
  actionBtnDelete: {
    borderColor: Colors.error + "40",
    backgroundColor: Colors.error + "10",
  },
  actionBtnQuiz: {
    borderColor: Colors.primaryDark + "40",
    backgroundColor: Colors.primaryLight,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
    marginLeft: 4,
  },
  noSubBabContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  noSubBabText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  addSubBabBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.info + "60",
    backgroundColor: Colors.info + "15",
  },
});
