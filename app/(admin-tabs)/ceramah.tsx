import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import ConfirmModal from "@/components/ConfirmModal";
import { useAuthContext } from "@/lib/auth-context";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#\s]+)/,
    /youtube\.com\/shorts\/([^&?#\s]+)/,
    /youtube\.com\/live\/([^&?#\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

type VideoDoc = {
  _id: Id<"ceramah_video">;
  judul: string;
  deskripsi?: string;
  youtubeUrl: string;
  isLive: boolean;
  isActive: boolean;
  createdAt: string;
};

type FormState = {
  judul: string;
  deskripsi: string;
  youtubeUrl: string;
  isLive: boolean;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  judul: "",
  deskripsi: "",
  youtubeUrl: "",
  isLive: false,
  isActive: true,
};

export default function CeramahAdminScreen() {
  const insets = useSafeAreaInsets();
  const { userData } = useAuthContext();
  const videos = useQuery(api.ceramahVideo.listAllVideos, {});
  const addVideo = useMutation(api.ceramahVideo.addVideo);
  const updateVideo = useMutation(api.ceramahVideo.updateVideo);
  const deleteVideo = useMutation(api.ceramahVideo.deleteVideo);

  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<VideoDoc | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<Id<"ceramah_video"> | null>(null);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (item: VideoDoc) => {
    setEditTarget(item);
    setForm({
      judul: item.judul,
      deskripsi: item.deskripsi ?? "",
      youtubeUrl: item.youtubeUrl,
      isLive: item.isLive,
      isActive: item.isActive,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.judul.trim()) {
      Alert.alert("Validasi", "Judul wajib diisi.");
      return;
    }
    if (!form.youtubeUrl.trim()) {
      Alert.alert("Validasi", "URL YouTube wajib diisi.");
      return;
    }
    if (!extractYouTubeId(form.youtubeUrl.trim())) {
      Alert.alert("Validasi", "URL YouTube tidak valid. Gunakan format:\nhttps://youtube.com/watch?v=...\nhttps://youtu.be/...\nhttps://youtube.com/live/...");
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        await updateVideo({
          id: editTarget._id,
          judul: form.judul.trim(),
          deskripsi: form.deskripsi.trim() || undefined,
          youtubeUrl: form.youtubeUrl.trim(),
          isLive: form.isLive,
          isActive: form.isActive,
        });
      } else {
        if (!userData?._id) throw new Error("User tidak ditemukan");
        await addVideo({
          judul: form.judul.trim(),
          deskripsi: form.deskripsi.trim() || undefined,
          youtubeUrl: form.youtubeUrl.trim(),
          isLive: form.isLive,
          postedBy: userData._id,
        });
      }
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert("Gagal", err?.message ?? "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteVideo({ id: deleteTargetId });
    } catch (err: any) {
      Alert.alert("Gagal", err?.message ?? "Terjadi kesalahan");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleToggleActive = async (item: VideoDoc) => {
    try {
      await updateVideo({ id: item._id, isActive: !item.isActive });
    } catch (err: any) {
      Alert.alert("Gagal", err?.message ?? "Terjadi kesalahan");
    }
  };

  const renderItem = ({ item }: { item: VideoDoc }) => {
    const videoId = extractYouTubeId(item.youtubeUrl);
    const thumbUri = videoId
      ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      : null;

    return (
      <View style={styles.card}>
        {thumbUri && (
          <Image source={{ uri: thumbUri }} style={styles.cardThumb} resizeMode="cover" />
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            {item.isLive && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            )}
            {!item.isActive && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Nonaktif</Text>
              </View>
            )}
            <Text style={styles.cardTitle} numberOfLines={2}>{item.judul}</Text>
          </View>
          {item.deskripsi ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.deskripsi}</Text>
          ) : null}
          <Text style={styles.cardUrl} numberOfLines={1}>{item.youtubeUrl}</Text>

          <View style={styles.cardActions}>
            <View style={styles.activeToggleRow}>
              <Text style={styles.activeToggleLabel}>Aktif</Text>
              <Switch
                value={item.isActive}
                onValueChange={() => handleToggleActive(item)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={item.isActive ? Colors.primary : "#aaa"}
              />
            </View>
            <View style={styles.cardBtns}>
              <TouchableOpacity
                style={[styles.cardBtn, { backgroundColor: "#E3F2FD" }]}
                onPress={() => openEdit(item)}
              >
                <FontAwesome name="pencil" size={14} color="#1976D2" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cardBtn, { backgroundColor: "#FFEBEE" }]}
                onPress={() => setDeleteTargetId(item._id)}
              >
                <FontAwesome name="trash" size={14} color="#C62828" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Ceramah Video</Text>
          <Text style={styles.headerSub}>Kelola video ceramah YouTube</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <FontAwesome name="plus" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {videos === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.center}>
          <FontAwesome name="youtube-play" size={48} color={Colors.primaryLight} />
          <Text style={styles.emptyText}>Belum ada video ceramah</Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd}>
            <Text style={styles.emptyAddBtnText}>+ Tambah Video</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={videos as VideoDoc[]}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editTarget ? "Edit Video" : "Tambah Video Ceramah"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <FontAwesome name="times" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Judul *</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Kajian Tafsir Juz 1"
                value={form.judul}
                onChangeText={(t) => setForm((f) => ({ ...f, judul: t }))}
                placeholderTextColor={Colors.textSecondary}
              />

              <Text style={styles.inputLabel}>Deskripsi</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Deskripsi singkat ceramah (opsional)"
                value={form.deskripsi}
                onChangeText={(t) => setForm((f) => ({ ...f, deskripsi: t }))}
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>URL YouTube *</Text>
              <TextInput
                style={styles.input}
                placeholder="https://youtube.com/watch?v=... atau https://youtu.be/..."
                value={form.youtubeUrl}
                onChangeText={(t) => setForm((f) => ({ ...f, youtubeUrl: t }))}
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
              />

              {/* Preview thumbnail */}
              {extractYouTubeId(form.youtubeUrl) ? (
                <View style={styles.previewBox}>
                  <Image
                    source={{
                      uri: `https://img.youtube.com/vi/${extractYouTubeId(form.youtubeUrl)}/mqdefault.jpg`,
                    }}
                    style={styles.previewThumb}
                    resizeMode="cover"
                  />
                  <Text style={styles.previewLabel}>Preview thumbnail</Text>
                </View>
              ) : null}

              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.inputLabel}>Video Live</Text>
                  <Text style={styles.toggleHint}>
                    Aktifkan jika ini adalah siaran langsung (live streaming)
                  </Text>
                </View>
                <Switch
                  value={form.isLive}
                  onValueChange={(v) => setForm((f) => ({ ...f, isLive: v }))}
                  trackColor={{ false: Colors.border, true: "#FFCDD2" }}
                  thumbColor={form.isLive ? "#E53935" : "#aaa"}
                />
              </View>

              {editTarget && (
                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.inputLabel}>Aktif (Tampil ke User)</Text>
                  </View>
                  <Switch
                    value={form.isActive}
                    onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={form.isActive ? Colors.primary : "#aaa"}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editTarget ? "Simpan Perubahan" : "Tambah Video"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        visible={deleteTargetId !== null}
        title="Hapus Video"
        message="Video ceramah ini akan dihapus permanen. Lanjutkan?"
        confirmText="Hapus"
        cancelText="Batal"
        confirmColor="#C62828"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  emptyAddBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  // ===== Header =====
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.text,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  // ===== List Card =====
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  cardThumb: {
    width: "100%",
    height: 160,
    backgroundColor: "#f0f0f0",
  },
  cardBody: {
    padding: 14,
  },
  cardTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    flex: 1,
  },
  liveBadge: {
    backgroundColor: "#E53935",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  inactiveBadge: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inactiveBadgeText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  cardUrl: {
    fontSize: 11,
    color: Colors.primary,
    marginBottom: 10,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  activeToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeToggleLabel: {
    fontSize: 13,
    color: Colors.text,
  },
  cardBtns: {
    flexDirection: "row",
    gap: 8,
  },
  cardBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  // ===== Modal =====
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
  },

  // ===== Form =====
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: "top",
  },
  previewBox: {
    marginTop: 10,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
  },
  previewThumb: {
    width: "100%",
    height: 150,
    backgroundColor: "#f0f0f0",
  },
  previewLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toggleHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    maxWidth: "80%",
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 8,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
