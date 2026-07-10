import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors, TALAQI_TYPES } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

const HARI_LABEL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function KelasJadwalText({ kelasId }: { kelasId: Id<"kelas"> }) {
  const jadwal = useQuery(api.kelas.listJadwal, { kelasId });
  if (jadwal === undefined) return null;
  if (jadwal.length === 0) return <Text style={st.kelasJadwal}>Jadwal belum diatur</Text>;
  return (
    <Text style={st.kelasJadwal}>
      {jadwal
        .map((j) => `${HARI_LABEL[j.hari]} ${j.jamMulai}-${j.jamSelesai}`)
        .join(", ")}
    </Text>
  );
}

export default function LkmDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { adminPengajianId } = useLocalSearchParams<{ adminPengajianId: string }>();
  const { userData } = useAuthContext();

  const [selectedKelasId, setSelectedKelasId] = useState<Id<"kelas"> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lembaga = useQuery(
    api.adminPengajian.getById,
    adminPengajianId ? { id: adminPengajianId as Id<"admin_pengajian"> } : "skip"
  );
  const kelasList = useQuery(
    api.kelas.listByAdminPengajian,
    adminPengajianId
      ? { adminPengajianId: adminPengajianId as Id<"admin_pengajian"> }
      : "skip"
  );
  const myRequests = useQuery(
    api.lkmJoinRequest.getBySantri,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const createRequest = useMutation(api.lkmJoinRequest.create);

  const activeKelas = (kelasList ?? []).filter((k) => k.isActive);
  const pendingRequest = (myRequests ?? []).find(
    (r) => r.adminPengajianId === adminPengajianId && r.status === "pending"
  );

  const isLoading = lembaga === undefined || kelasList === undefined || myRequests === undefined;

  const handleSubmit = async () => {
    if (!userData?._id || !adminPengajianId) return;
    setSubmitting(true);
    try {
      await createRequest({
        userId: userData._id,
        adminPengajianId: adminPengajianId as Id<"admin_pengajian">,
        requestedKelasId: selectedKelasId ?? undefined,
      });
      Alert.alert(
        "Permintaan Terkirim",
        "Permintaan bergabung telah dikirim. Menunggu verifikasi dari LKM."
      );
    } catch (error) {
      Alert.alert("Gagal", error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!lembaga) {
    return (
      <View style={st.center}>
        <Text style={st.errorText}>Lembaga tidak ditemukan</Text>
      </View>
    );
  }

  return (
    <View style={st.container}>
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <View style={st.headerRow}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={16} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>{lembaga.namaLembaga}</Text>
            <Text style={st.headerSubtitle}>
              {lembaga.kota}, {lembaga.provinsi}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={st.content}>
        {lembaga.fotoUrl && (
          <Image source={{ uri: lembaga.fotoUrl }} style={st.lembagaFoto} resizeMode="cover" />
        )}
        {lembaga.alamat && <Text style={st.alamat}>{lembaga.alamat}</Text>}

        {pendingRequest ? (
          <View style={st.pendingBox}>
            <FontAwesome name="clock-o" size={20} color={Colors.secondary} />
            <Text style={st.pendingText}>
              Permintaan bergabung Anda sedang menunggu verifikasi LKM
            </Text>
          </View>
        ) : (
          <>
            <Text style={st.sectionTitle}>Pilih Kelas</Text>
            {activeKelas.length === 0 ? (
              <Text style={st.emptyText}>Belum ada kelas tersedia di LKM ini</Text>
            ) : (
              activeKelas.map((kelas) => {
                const typeLabel =
                  TALAQI_TYPES.find((t) => t.value === kelas.type)?.label ?? kelas.type;
                const selected = selectedKelasId === kelas._id;
                return (
                  <Pressable
                    key={kelas._id}
                    style={[st.kelasCard, selected && st.kelasCardSelected]}
                    onPress={() => setSelectedKelasId(selected ? null : kelas._id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={st.kelasNama}>{kelas.nama}</Text>
                      <Text style={st.kelasType}>
                        {typeLabel} • {kelas.modeDefault === "online" ? "Online" : "Offline"}
                      </Text>
                      <KelasJadwalText kelasId={kelas._id} />
                    </View>
                    {selected && (
                      <FontAwesome name="check-circle" size={20} color={Colors.primary} />
                    )}
                  </Pressable>
                );
              })
            )}

            <Pressable
              style={[st.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={st.submitText}>
                  {selectedKelasId ? "Kirim Permintaan Bergabung" : "Biarkan LKM Menentukan Kelas"}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
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
  lembagaFoto: {
    width: "100%",
    height: 160,
    borderRadius: 14,
    backgroundColor: "#ECEFF1",
    marginBottom: 4,
  },
  alamat: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 4 },
  emptyText: { fontSize: 13, color: Colors.textSecondary },

  pendingBox: {
    backgroundColor: "#FFF3E0",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#FFCC80",
  },
  pendingText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 },

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
  kelasCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#F1F8E9",
  },
  kelasNama: { fontSize: 14, fontWeight: "700", color: Colors.text },
  kelasType: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  kelasJadwal: { fontSize: 12, color: Colors.primary, marginTop: 4 },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
