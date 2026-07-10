import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Colors, TALAQI_TYPES } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

type Tab = "kelas" | "permintaan";

interface KelasAdminPanelProps {
  adminPengajianId: Id<"admin_pengajian">;
  onBack?: () => void;
}

export default function KelasAdminPanel({ adminPengajianId, onBack }: KelasAdminPanelProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData } = useAuthContext();
  const [tab, setTab] = useState<Tab>("kelas");

  const lembaga = useQuery(api.adminPengajian.getById, { id: adminPengajianId });
  const kelasList = useQuery(api.kelas.listByAdminPengajian, { adminPengajianId });
  const pendingRequests = useQuery(api.lkmJoinRequest.listByAdminPengajian, {
    adminPengajianId,
    status: "pending",
  });

  const isLoading = lembaga === undefined || kelasList === undefined || pendingRequests === undefined;

  if (isLoading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <View style={st.headerRow}>
          {onBack && (
            <Pressable style={st.backBtn} onPress={onBack}>
              <FontAwesome name="arrow-left" size={16} color="#fff" />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>{lembaga?.namaLembaga ?? "Kelola Kelas"}</Text>
            <Text style={st.headerSubtitle}>Kelola kelas & permintaan bergabung</Text>
          </View>
        </View>

        <View style={st.tabRow}>
          <Pressable
            style={[st.tabBtn, tab === "kelas" && st.tabBtnActive]}
            onPress={() => setTab("kelas")}
          >
            <Text style={[st.tabText, tab === "kelas" && st.tabTextActive]}>
              Kelas ({kelasList.length})
            </Text>
          </Pressable>
          <Pressable
            style={[st.tabBtn, tab === "permintaan" && st.tabBtnActive]}
            onPress={() => setTab("permintaan")}
          >
            <Text style={[st.tabText, tab === "permintaan" && st.tabTextActive]}>
              Permintaan ({pendingRequests.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {tab === "kelas" ? (
        <KelasTab
          kelasList={kelasList}
          adminPengajianId={adminPengajianId}
          router={router}
        />
      ) : (
        <PermintaanTab
          requests={pendingRequests}
          kelasList={kelasList}
          reviewerId={userData?._id}
        />
      )}
    </View>
  );
}

function KelasTab({
  kelasList,
  adminPengajianId,
  router,
}: {
  kelasList: Doc<"kelas">[];
  adminPengajianId: string;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <ScrollView contentContainerStyle={st.content}>
      {kelasList.length === 0 ? (
        <View style={st.emptyBox}>
          <FontAwesome name="users" size={32} color={Colors.border} />
          <Text style={st.emptyText}>Belum ada kelas</Text>
        </View>
      ) : (
        kelasList.map((kelas) => {
          const typeLabel = TALAQI_TYPES.find((t) => t.value === kelas.type)?.label ?? kelas.type;
          return (
            <Pressable
              key={kelas._id}
              style={st.kelasCard}
              onPress={() =>
                router.push({ pathname: "/kelas-form", params: { id: kelas._id } })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={st.kelasNama}>{kelas.nama}</Text>
                <Text style={st.kelasType}>
                  {typeLabel} • {kelas.modeDefault === "online" ? "Online" : "Offline"}
                  {kelas.jumlahPertemuan ? ` • ${kelas.jumlahPertemuan}x pertemuan` : ""}
                  {!kelas.isActive ? " • Nonaktif" : ""}
                </Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color={Colors.textSecondary} />
            </Pressable>
          );
        })
      )}

      <Pressable
        style={st.addBtn}
        onPress={() =>
          router.push({ pathname: "/kelas-form", params: { adminPengajianId } })
        }
      >
        <FontAwesome name="plus" size={16} color="#fff" />
        <Text style={st.addBtnText}>Tambah Kelas</Text>
      </Pressable>
    </ScrollView>
  );
}

function PermintaanTab({
  requests,
  kelasList,
  reviewerId,
}: {
  requests: Doc<"lkm_join_request">[];
  kelasList: Doc<"kelas">[];
  reviewerId: Id<"users"> | undefined;
}) {
  const approve = useMutation(api.lkmJoinRequest.approve);
  const reject = useMutation(api.lkmJoinRequest.reject);
  const allUsers = useQuery(api.users.listAll, {});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickedKelas, setPickedKelas] = useState<Record<string, Id<"kelas">>>({});

  const activeKelas = kelasList.filter((k) => k.isActive);

  const handleApprove = async (requestId: Id<"lkm_join_request">, defaultKelasId?: Id<"kelas">) => {
    const kelasId = pickedKelas[requestId] ?? defaultKelasId ?? activeKelas[0]?._id;
    if (!kelasId || !reviewerId) {
      Alert.alert("Error", "Pilih kelas untuk santri ini terlebih dahulu.");
      return;
    }
    setBusyId(requestId);
    try {
      await approve({ id: requestId, assignedKelasId: kelasId, reviewedBy: reviewerId });
    } catch (error) {
      Alert.alert("Gagal", error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (requestId: Id<"lkm_join_request">) => {
    if (!reviewerId) return;
    setBusyId(requestId);
    try {
      await reject({ id: requestId, reviewedBy: reviewerId });
    } catch (error) {
      Alert.alert("Gagal", error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={st.content}>
      {requests.length === 0 ? (
        <View style={st.emptyBox}>
          <FontAwesome name="inbox" size={32} color={Colors.border} />
          <Text style={st.emptyText}>Tidak ada permintaan bergabung</Text>
        </View>
      ) : (
        requests.map((req) => {
          const santriUser = allUsers?.find((u) => u._id === req.userId);
          const selectedKelasId = pickedKelas[req._id] ?? req.requestedKelasId ?? activeKelas[0]?._id;
          const busy = busyId === req._id;
          return (
            <View key={req._id} style={st.reqCard}>
              <Text style={st.reqName}>{santriUser?.name ?? "Santri"}</Text>
              <Text style={st.reqEmail}>{santriUser?.email}</Text>

              <Text style={st.label}>Tempatkan di Kelas</Text>
              <View style={st.chipRow}>
                {activeKelas.map((k) => (
                  <Pressable
                    key={k._id}
                    style={[st.chip, selectedKelasId === k._id && st.chipActive]}
                    onPress={() =>
                      setPickedKelas((prev) => ({ ...prev, [req._id]: k._id }))
                    }
                  >
                    <Text style={[st.chipText, selectedKelasId === k._id && st.chipTextActive]}>
                      {k.nama}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={st.reqActions}>
                <Pressable
                  style={[st.rejectBtn, busy && { opacity: 0.5 }]}
                  onPress={() => handleReject(req._id)}
                  disabled={busy}
                >
                  <Text style={st.rejectText}>Tolak</Text>
                </Pressable>
                <Pressable
                  style={[st.approveBtn, busy && { opacity: 0.5 }]}
                  onPress={() => handleApprove(req._id, req.requestedKelasId)}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={st.approveText}>Terima</Text>
                  )}
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    gap: 12,
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

  tabRow: { flexDirection: "row", gap: 8 },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  tabBtnActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  tabTextActive: { color: Colors.primary },

  content: { padding: 16, paddingBottom: 100, gap: 10 },
  emptyBox: { alignItems: "center", padding: 40, gap: 10 },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },

  kelasCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kelasNama: { fontSize: 14, fontWeight: "700", color: Colors.text },
  kelasType: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  addBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  reqCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  reqName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  reqEmail: { fontSize: 12, color: Colors.textSecondary },
  label: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary, marginTop: 10, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  chipTextActive: { color: "#fff" },

  reqActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  rejectBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  rejectText: { color: Colors.error, fontWeight: "700", fontSize: 13 },
  approveBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  approveText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
