import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";

type StatusFilter = "pending" | "approved" | "rejected";

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pending: { label: "Menunggu", color: "#F57C00", bg: "#FFF3E0" },
  approved: { label: "Disetujui", color: "#2E7D32", bg: "#E8F5E9" },
  rejected: { label: "Ditolak", color: "#C62828", bg: "#FFEBEE" },
};

export default function AdminLembagaRequestsScreen() {
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{
    id: Id<"admin_pengajian_request">;
    name: string;
  } | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const requests = useQuery(api.adminPengajianRequest.listByStatus, {
    status: filter,
  });
  const approveRequest = useMutation(api.adminPengajianRequest.approve);
  const rejectRequest = useMutation(api.adminPengajianRequest.reject);

  const handleApprove = (id: Id<"admin_pengajian_request">, name: string) => {
    Alert.alert(
      "Setujui Pengajuan",
      `Setujui ${name} menjadi admin pengajian? Lembaga akan dibuat otomatis.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Setujui",
          onPress: async () => {
            setBusyId(id);
            try {
              await approveRequest({ id });
              Alert.alert("Berhasil", "Pengajuan disetujui & lembaga dibuat.");
            } catch (error) {
              Alert.alert(
                "Gagal",
                error instanceof Error ? error.message : "Terjadi kesalahan"
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await rejectRequest({
        id: rejectTarget.id,
        reviewNote: rejectNote.trim() || undefined,
      });
      setRejectTarget(null);
      setRejectNote("");
    } catch (error) {
      Alert.alert(
        "Gagal",
        error instanceof Error ? error.message : "Terjadi kesalahan"
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={st.container}>
      <View style={st.tabRow}>
        {(["pending", "approved", "rejected"] as StatusFilter[]).map((s) => (
          <Pressable
            key={s}
            style={[st.tab, filter === s && st.tabActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[st.tabText, filter === s && st.tabTextActive]}>
              {STATUS_META[s].label}
            </Text>
          </Pressable>
        ))}
      </View>

      {requests === undefined ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={[...requests].sort(
            (a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0)
          )}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          renderItem={({ item }) => {
            const busy = busyId === item._id;
            const meta = STATUS_META[item.status];
            return (
              <View style={st.card}>
                <View style={st.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.lembagaName}>{item.namaLembaga}</Text>
                    <Text style={st.applicant}>
                      {item.userName} · {item.userEmail}
                    </Text>
                    <Text style={st.meta}>
                      {item.kota}, {item.provinsi}
                    </Text>
                    {item.alamat ? (
                      <Text style={st.meta}>{item.alamat}</Text>
                    ) : null}
                  </View>
                  <View style={[st.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[st.statusBadgeText, { color: meta.color }]}>
                      {meta.label}
                    </Text>
                  </View>
                </View>

                {item.fotoUrl ? (
                  <Image
                    source={{ uri: item.fotoUrl }}
                    style={st.foto}
                    resizeMode="cover"
                  />
                ) : null}

                {item.status === "rejected" && item.reviewNote ? (
                  <Text style={st.rejectNote}>Catatan: {item.reviewNote}</Text>
                ) : null}

                {item.status === "pending" && (
                  <View style={st.actions}>
                    <Pressable
                      style={[st.actionBtn, st.rejectBtn, busy && { opacity: 0.5 }]}
                      disabled={busy}
                      onPress={() =>
                        setRejectTarget({ id: item._id, name: item.userName })
                      }
                    >
                      <FontAwesome name="times" size={13} color={Colors.error} />
                      <Text style={[st.actionText, { color: Colors.error }]}>
                        Tolak
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[st.actionBtn, st.approveBtn, busy && { opacity: 0.5 }]}
                      disabled={busy}
                      onPress={() => handleApprove(item._id, item.userName)}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <FontAwesome name="check" size={13} color="#fff" />
                          <Text style={[st.actionText, { color: "#fff" }]}>
                            Setujui
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={st.empty}>
              <FontAwesome name="inbox" size={32} color={Colors.border} />
              <Text style={st.emptyText}>
                Tidak ada pengajuan {STATUS_META[filter].label.toLowerCase()}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={rejectTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <View style={st.modalOverlay}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>Tolak Pengajuan</Text>
            <Text style={st.modalSubtitle}>{rejectTarget?.name}</Text>
            <TextInput
              style={st.modalInput}
              value={rejectNote}
              onChangeText={setRejectNote}
              placeholder="Alasan penolakan (opsional)"
              placeholderTextColor={Colors.textSecondary}
              multiline
            />
            <View style={st.modalActions}>
              <Pressable
                style={st.modalCancel}
                onPress={() => {
                  setRejectTarget(null);
                  setRejectNote("");
                }}
              >
                <Text style={st.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable style={st.modalConfirm} onPress={submitReject}>
                <Text style={st.modalConfirmText}>Tolak</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  tabRow: { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  lembagaName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  applicant: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  meta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  foto: { width: "100%", height: 130, borderRadius: 10, backgroundColor: "#ECEFF1" },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: "700" },
  rejectNote: { fontSize: 12, color: Colors.error },

  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveBtn: { backgroundColor: Colors.primary },
  rejectBtn: { backgroundColor: "#FFEBEE" },
  actionText: { fontSize: 13, fontWeight: "700" },

  empty: { alignItems: "center", padding: 48, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: Colors.text, textAlign: "center" },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: Colors.error,
  },
  modalConfirmText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
