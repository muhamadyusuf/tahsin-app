import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Colors, TALAQI_TYPES } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

const HARI_LABEL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Terjadwal",
  ongoing: "Berlangsung",
  done: "Selesai",
  cancelled: "Dibatalkan",
};
const STATUS_COLOR: Record<string, string> = {
  scheduled: Colors.textSecondary,
  ongoing: Colors.success,
  done: Colors.primary,
  cancelled: Colors.error,
};

export default function KelasDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { kelasId } = useLocalSearchParams<{ kelasId: string }>();
  const { userData, role } = useAuthContext();
  const [editingPertemuan, setEditingPertemuan] = useState<Doc<"kelas_pertemuan"> | null>(null);

  const kelas = useQuery(
    api.kelas.getById,
    kelasId ? { id: kelasId as Id<"kelas"> } : "skip"
  );
  const jadwal = useQuery(
    api.kelas.listJadwal,
    kelasId ? { kelasId: kelasId as Id<"kelas"> } : "skip"
  );
  const pertemuanList = useQuery(
    api.kelasPertemuan.listByKelas,
    kelasId ? { kelasId: kelasId as Id<"kelas"> } : "skip"
  );
  const ownUstadz = useQuery(
    api.ustadz.getByUserId,
    role === "ustadz" && userData?._id ? { userId: userData._id } : "skip"
  );

  const isLoading =
    kelas === undefined || jadwal === undefined || pertemuanList === undefined;

  const isTeacher = role === "ustadz" && ownUstadz && kelas && ownUstadz._id === kelas.ustadzId;

  if (isLoading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!kelas) {
    return (
      <View style={st.center}>
        <Text style={st.errorText}>Kelas tidak ditemukan</Text>
      </View>
    );
  }

  const typeLabel = TALAQI_TYPES.find((t) => t.value === kelas.type)?.label ?? kelas.type;

  return (
    <View style={st.container}>
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <View style={st.headerRow}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={16} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>{kelas.nama}</Text>
            <Text style={st.headerSubtitle}>
              {typeLabel} • {kelas.modeDefault === "online" ? "Online" : "Offline"}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={st.content}>
        {kelas.silabus && (
          <View style={st.infoCard}>
            <Text style={st.infoLabel}>Silabus</Text>
            <Text style={st.infoText}>{kelas.silabus}</Text>
          </View>
        )}

        {jadwal.length > 0 && (
          <View style={st.infoCard}>
            <Text style={st.infoLabel}>Jadwal Mingguan</Text>
            <Text style={st.infoText}>
              {jadwal.map((j) => `${HARI_LABEL[j.hari]} ${j.jamMulai}-${j.jamSelesai}`).join(", ")}
            </Text>
          </View>
        )}

        <Text style={st.sectionTitle}>Pertemuan ({pertemuanList.length})</Text>

        {pertemuanList.length === 0 ? (
          <View style={st.emptyBox}>
            <FontAwesome name="calendar-o" size={32} color={Colors.border} />
            <Text style={st.emptyText}>Belum ada pertemuan terjadwal</Text>
          </View>
        ) : (
          pertemuanList.map((p) => (
            <Pressable
              key={p._id}
              style={st.pertemuanCard}
              onPress={() => router.push({ pathname: "/pertemuan/[pertemuanId]", params: { pertemuanId: p._id } })}
            >
              <View style={st.pertemuanBadge}>
                <Text style={st.pertemuanBadgeText}>{p.pertemuanKe}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.pertemuanTanggal}>{p.tanggal}</Text>
                <Text style={st.pertemuanMode}>
                  {p.mode === "online" ? "Online" : "Offline"}
                </Text>
              </View>
              <View
                style={[st.statusBadge, { backgroundColor: STATUS_COLOR[p.status] }]}
              >
                <Text style={st.statusBadgeText}>{STATUS_LABEL[p.status]}</Text>
              </View>
              {isTeacher && (
                <Pressable style={st.editBtn} onPress={() => setEditingPertemuan(p)}>
                  <FontAwesome name="pencil" size={13} color={Colors.primary} />
                </Pressable>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>

      {editingPertemuan && (
        <EditPertemuanModal
          pertemuan={editingPertemuan}
          onClose={() => setEditingPertemuan(null)}
        />
      )}
    </View>
  );
}

function EditPertemuanModal({
  pertemuan,
  onClose,
}: {
  pertemuan: Doc<"kelas_pertemuan">;
  onClose: () => void;
}) {
  const [tanggal, setTanggal] = useState(pertemuan.tanggal);
  const [mode, setMode] = useState<"online" | "offline">(pertemuan.mode);
  const [saving, setSaving] = useState(false);
  const update = useMutation(api.kelasPertemuan.update);

  const handleSave = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      Alert.alert("Error", "Tanggal harus format YYYY-MM-DD.");
      return;
    }
    setSaving(true);
    try {
      await update({ id: pertemuan._id, tanggal, mode });
      onClose();
    } catch {
      Alert.alert("Error", "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.modalOverlay}>
        <View style={st.modalSheet}>
          <Text style={st.modalTitle}>Edit Pertemuan {pertemuan.pertemuanKe}</Text>

          <Text style={st.infoLabel}>Tanggal</Text>
          <TextInput
            style={st.input}
            value={tanggal}
            onChangeText={setTanggal}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={[st.infoLabel, { marginTop: 12 }]}>Mode</Text>
          <View style={st.chipRow}>
            {(["offline", "online"] as const).map((m) => (
              <Pressable
                key={m}
                style={[st.chip, mode === m && st.chipActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[st.chipText, mode === m && st.chipTextActive]}>
                  {m === "online" ? "Online" : "Offline"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={st.modalActions}>
            <Pressable style={st.modalCancelBtn} onPress={onClose}>
              <Text style={st.modalCancelText}>Batal</Text>
            </Pressable>
            <Pressable style={st.modalSaveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={st.modalSaveText}>Simpan</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: Colors.textSecondary, fontSize: 14 },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  content: { padding: 16, paddingBottom: 100, gap: 10 },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoLabel: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary, marginBottom: 4 },
  infoText: { fontSize: 13, color: Colors.text, lineHeight: 20 },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, marginTop: 8 },
  emptyBox: { alignItems: "center", padding: 30, gap: 10 },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },

  pertemuanCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pertemuanBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  pertemuanBadgeText: { fontSize: 13, fontWeight: "800", color: Colors.primary },
  pertemuanTanggal: { fontSize: 14, fontWeight: "700", color: Colors.text },
  pertemuanMode: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  editBtn: { padding: 8 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 14 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  chipTextActive: { color: "#fff" },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalCancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: { color: Colors.textSecondary, fontWeight: "700" },
  modalSaveBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  modalSaveText: { color: "#fff", fontWeight: "700" },
});
