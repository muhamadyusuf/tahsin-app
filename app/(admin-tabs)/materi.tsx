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
import { useAuthContext } from "@/lib/auth-context";
import { Doc } from "@/convex/_generated/dataModel";
import ConfirmModal from "@/components/ConfirmModal";

type MateriType = "tahsin" | "ulumul_quran" | "fiqih";

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Persetujuan",
  approved: "Disetujui",
  rejected: "Ditolak",
};
const STATUS_COLOR: Record<string, string> = {
  pending: Colors.warning,
  approved: Colors.success,
  rejected: Colors.error,
};

function StatusBadge({ status }: { status?: string }) {
  const key = status ?? "approved";
  return (
    <View style={[st.statusBadge, { backgroundColor: STATUS_COLOR[key] }]}>
      <Text style={st.statusBadgeText}>{STATUS_LABEL[key]}</Text>
    </View>
  );
}

export default function MateriScreen() {
  const router = useRouter();
  const { userData, role } = useAuthContext();
  const isLembaga = role === "admin_pengajian";
  const [activeType, setActiveType] = useState<MateriType>("tahsin");
  const [onlyPending, setOnlyPending] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; judul: string } | null>(null);

  const adminList = useQuery(
    api.materi.listAllForType,
    !isLembaga ? { type: activeType } : "skip"
  );
  const ownSubmissions = useQuery(
    api.materi.listBySubmitter,
    isLembaga && userData?._id ? { submittedBy: userData._id } : "skip"
  );
  const approvedList = useQuery(
    api.materi.list,
    isLembaga ? { type: activeType } : "skip"
  );

  const removeMateri = useMutation(api.materi.remove);
  const approveMateri = useMutation(api.materi.approve);
  const rejectMateri = useMutation(api.materi.reject);

  const handleDelete = (id: string, judul: string) => {
    setItemToDelete({ id, judul });
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, judul } = itemToDelete;
    setDeleteModalVisible(false);
    setItemToDelete(null);
    try {
      await removeMateri({ id: id as any });
      Alert.alert("Berhasil", "Materi telah dihapus.");
    } catch {
      Alert.alert("Error", "Gagal menghapus materi.");
    }
  };

  const handleApprove = async (id: string) => {
    if (!userData?._id) return;
    try {
      await approveMateri({ id: id as any, reviewedBy: userData._id });
    } catch {
      Alert.alert("Error", "Gagal menyetujui materi.");
    }
  };

  const handleReject = async (id: string) => {
    if (!userData?._id) return;
    try {
      await rejectMateri({ id: id as any, reviewedBy: userData._id });
    } catch {
      Alert.alert("Error", "Gagal menolak materi.");
    }
  };

  if (isLembaga) {
    const ownFiltered = (ownSubmissions ?? []).filter((m) => m.type === activeType);
    const isLoading = ownSubmissions === undefined || approvedList === undefined;

    return (
      <View style={st.container}>
        <View style={st.tabRow}>
          <Pressable
            style={[st.tab, activeType === "tahsin" && st.tabActive]}
            onPress={() => setActiveType("tahsin")}
          >
            <Text style={[st.tabText, activeType === "tahsin" && st.tabTextActive]}>Tahsin</Text>
          </Pressable>
          <Pressable
            style={[st.tab, activeType === "ulumul_quran" && st.tabActive]}
            onPress={() => setActiveType("ulumul_quran")}
          >
            <Text style={[st.tabText, activeType === "ulumul_quran" && st.tabTextActive]}>
              Ulumul Quran
            </Text>
          </Pressable>
          <Pressable
            style={[st.tab, activeType === "fiqih" && st.tabActive]}
            onPress={() => setActiveType("fiqih")}
          >
            <Text style={[st.tabText, activeType === "fiqih" && st.tabTextActive]}>
              Fiqih
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={st.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={ownFiltered.sort((a, b) => a.seq - b.seq)}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            ListHeaderComponent={<Text style={st.sectionTitle}>Materi Saya</Text>}
            renderItem={({ item }) => (
              <View style={st.card}>
                <View style={st.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.cardTitle}>{item.judul}</Text>
                    {item.deskripsi && (
                      <Text style={st.cardDesc} numberOfLines={2}>
                        {item.deskripsi}
                      </Text>
                    )}
                  </View>
                  <StatusBadge status={item.status} />
                </View>
                {item.status === "rejected" && item.reviewNote && (
                  <Text style={st.rejectNote}>Catatan: {item.reviewNote}</Text>
                )}
                <View style={st.cardActions}>
                  <Pressable
                    style={st.actionBtn}
                    onPress={() =>
                      router.push({
                        pathname: "/materi-form",
                        params: { id: item._id, type: activeType },
                      })
                    }
                  >
                    <FontAwesome name="pencil" size={13} color={Colors.primary} />
                    <Text style={st.actionBtnText}>
                      {item.status === "rejected" ? "Perbaiki & Ajukan Ulang" : "Edit"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={st.empty}>
                <FontAwesome name="book" size={32} color={Colors.border} />
                <Text style={st.emptyText}>Belum ada materi yang Anda ajukan</Text>
              </View>
            }
            ListFooterComponent={
              <>
                <Text style={[st.sectionTitle, { marginTop: 16 }]}>Materi Tersedia (Disetujui)</Text>
                {(approvedList ?? []).map((item) => (
                  <View key={item._id} style={st.card}>
                    <Text style={st.cardTitle}>{item.judul}</Text>
                    {item.deskripsi && (
                      <Text style={st.cardDesc} numberOfLines={2}>
                        {item.deskripsi}
                      </Text>
                    )}
                  </View>
                ))}
                {(approvedList ?? []).length === 0 && (
                  <Text style={st.emptyText}>Belum ada materi yang disetujui</Text>
                )}
              </>
            }
          />
        )}

        <Pressable
          style={({ pressed }) => [st.fab, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: "/materi-form", params: { type: activeType } })}
        >
          <FontAwesome name="plus" size={22} color="#fff" />
        </Pressable>
      </View>
    );
  }

  const pendingCount = (adminList ?? []).filter((m) => m.status === "pending").length;
  const displayed = (adminList ?? []).filter((m) => (onlyPending ? m.status === "pending" : true));

  return (
    <View style={st.container}>
      <View style={st.tabRow}>
        <Pressable
          style={[st.tab, activeType === "tahsin" && st.tabActive]}
          onPress={() => setActiveType("tahsin")}
        >
          <Text style={[st.tabText, activeType === "tahsin" && st.tabTextActive]}>Tahsin</Text>
        </Pressable>
        <Pressable
          style={[st.tab, activeType === "ulumul_quran" && st.tabActive]}
          onPress={() => setActiveType("ulumul_quran")}
        >
          <Text style={[st.tabText, activeType === "ulumul_quran" && st.tabTextActive]}>
            Ulumul Quran
          </Text>
        </Pressable>
        <Pressable
          style={[st.tab, activeType === "fiqih" && st.tabActive]}
          onPress={() => setActiveType("fiqih")}
        >
          <Text style={[st.tabText, activeType === "fiqih" && st.tabTextActive]}>
            Fiqih
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[st.pendingFilter, onlyPending && st.pendingFilterActive]}
        onPress={() => setOnlyPending((v) => !v)}
      >
        <FontAwesome
          name="clock-o"
          size={13}
          color={onlyPending ? "#fff" : Colors.warning}
        />
        <Text style={[st.pendingFilterText, onlyPending && { color: "#fff" }]}>
          Menunggu Persetujuan ({pendingCount})
        </Text>
      </Pressable>

      {!adminList ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayed.sort((a, b) => a.seq - b.seq)}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <MateriCard
              item={item}
              router={router}
              activeType={activeType}
              onDelete={handleDelete}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
          ListEmptyComponent={
            <View style={st.empty}>
              <FontAwesome name="book" size={32} color={Colors.border} />
              <Text style={st.emptyText}>Belum ada materi</Text>
            </View>
          }
        />
      )}

      <Pressable
        style={({ pressed }) => [st.fab, pressed && { opacity: 0.85 }]}
        onPress={() => router.push({ pathname: "/materi-form", params: { type: activeType } })}
      >
        <FontAwesome name="plus" size={22} color="#fff" />
      </Pressable>

      <ConfirmModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={confirmDelete}
        title="Hapus Materi"
        message={`Yakin ingin menghapus "${itemToDelete?.judul}"? Tindakan ini akan menghapus materi dan seluruh sub-bab di dalamnya.`}
        confirmText="Hapus"
        type="danger"
        icon="trash"
      />
    </View>
  );
}

function MateriCard({
  item,
  router,
  activeType,
  onDelete,
  onApprove,
  onReject,
}: {
  item: Doc<"materi">;
  router: ReturnType<typeof useRouter>;
  activeType: MateriType;
  onDelete: (id: string, judul: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isPending = item.status === "pending";
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
        <StatusBadge status={item.status} />
      </View>

      {isPending ? (
        <View style={st.cardActions}>
          <Pressable
            style={[st.actionBtn, st.actionBtnDanger]}
            onPress={() => onReject(item._id)}
          >
            <FontAwesome name="times" size={13} color={Colors.error} />
            <Text style={[st.actionBtnText, { color: Colors.error }]}>Tolak</Text>
          </Pressable>
          <Pressable style={st.actionBtn} onPress={() => onApprove(item._id)}>
            <FontAwesome name="check" size={13} color={Colors.primary} />
            <Text style={st.actionBtnText}>Setujui</Text>
          </Pressable>
        </View>
      ) : (
        <View style={st.cardActions}>
          <Pressable
            style={[st.actionBtn, st.actionBtnSub]}
            onPress={() =>
              router.push({ pathname: "/materi-detail", params: { id: item._id, type: activeType } })
            }
          >
            <FontAwesome name="sitemap" size={13} color={Colors.info} />
            <Text style={[st.actionBtnText, { color: Colors.info }]}>Sub-bab</Text>
          </Pressable>
          <Pressable
            style={st.actionBtn}
            onPress={() => router.push({ pathname: "/materi-form", params: { id: item._id, type: activeType } })}
          >
            <FontAwesome name="pencil" size={13} color={Colors.primary} />
            <Text style={st.actionBtnText}>Edit</Text>
          </Pressable>
          <Pressable
            style={[st.actionBtn, st.actionBtnDanger]}
            onPress={() => onDelete(item._id, item.judul)}
          >
            <FontAwesome name="trash-o" size={13} color={Colors.error} />
            <Text style={[st.actionBtnText, { color: Colors.error }]}>Hapus</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  tabRow: { flexDirection: "row", padding: 16, paddingBottom: 8, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },

  pendingFilter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#FFF3E0",
    borderWidth: 1,
    borderColor: "#FFCC80",
  },
  pendingFilterActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  pendingFilterText: { fontSize: 12, fontWeight: "700", color: Colors.warning },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 8 },

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

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  rejectNote: { fontSize: 12, color: Colors.error, marginTop: 8 },

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
  actionBtnSub: { backgroundColor: "#E8F2FF" },
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
