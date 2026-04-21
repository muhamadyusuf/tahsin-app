import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors, UserRole } from "@/lib/constants";

const ROLE_OPTIONS: { label: string; value: UserRole; color: string; bg: string }[] = [
  { label: "Administrator", value: "administrator", color: "#C62828", bg: "#FFEBEE" },
  { label: "Admin Pengajian", value: "admin_pengajian", color: "#1565C0", bg: "#E3F2FD" },
  { label: "Ustadz", value: "ustadz", color: "#7B1FA2", bg: "#F3E5F5" },
  { label: "Santri", value: "santri", color: "#2E7D32", bg: "#E8F5E9" },
];

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [showUstadzModal, setShowUstadzModal] = useState(false);
  const [selectedLembagaId, setSelectedLembagaId] = useState<Id<"admin_pengajian"> | null>(null);
  const [spesialisasi, setSpesialisasi] = useState("");
  const [assigningUstadz, setAssigningUstadz] = useState(false);

  const user = useQuery(
    api.users.getById,
    id ? { userId: id as Id<"users"> } : "skip"
  );
  const updateRole = useMutation(api.users.updateRole);
  const createUstadz = useMutation(api.ustadz.create);

  const tilawah = useQuery(
    api.tilawah.getByUser,
    user ? { userId: user._id } : "skip"
  );
  const khatam = useQuery(
    api.tilawah.getKhatamProgress,
    user ? { userId: user._id } : "skip"
  );
  const adminPengajianProfile = useQuery(
    api.adminPengajian.getByUserId,
    user ? { userId: user._id } : "skip"
  );
  const ustadzProfile = useQuery(
    api.ustadz.getByUserId,
    user ? { userId: user._id } : "skip"
  );
  const allLembaga = useQuery(api.adminPengajian.listAll);

  if (!user) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const roleInfo = ROLE_OPTIONS.find((r) => r.value === user.role);
  const totalPages = tilawah?.reduce((s, t) => s + t.jumlahHalaman, 0) ?? 0;
  const ustadzLembaga = useMemo(() => {
    if (!ustadzProfile || !allLembaga) {
      return null;
    }
    return allLembaga.find((item) => item._id === ustadzProfile.adminPengajianId) ?? null;
  }, [ustadzProfile, allLembaga]);

  const changeRole = (newRole: UserRole) => {
    Alert.alert(
      "Ubah Role",
      `Ubah role ${user.name} menjadi ${newRole}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ubah",
          onPress: async () => {
            try {
              await updateRole({ userId: user._id, role: newRole });
              Alert.alert("Berhasil", "Role berhasil diubah.");
            } catch {
              Alert.alert("Error", "Gagal mengubah role.");
            }
          },
        },
      ]
    );
  };

  const handleAssignUstadz = async () => {
    if (!selectedLembagaId) {
      Alert.alert("Pilih Lembaga", "Silakan pilih lembaga pengajian terlebih dahulu.");
      return;
    }

    try {
      setAssigningUstadz(true);
      await createUstadz({
        userId: user._id,
        adminPengajianId: selectedLembagaId,
        spesialisasi: spesialisasi.trim() || undefined,
      });
      setShowUstadzModal(false);
      setSelectedLembagaId(null);
      setSpesialisasi("");
      Alert.alert("Berhasil", "Data ustadz berhasil dibuat.");
    } catch {
      Alert.alert("Error", "Gagal membuat data ustadz.");
    } finally {
      setAssigningUstadz(false);
    }
  };

  return (
    <>
      <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Profile Header */}
      <View style={st.header}>
        <View style={st.avatar}>
          <Text style={st.avatarText}>
            {user.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={st.name}>{user.name}</Text>
        <Text style={st.email}>{user.email}</Text>
        {user.phone && <Text style={st.phone}>📱 {user.phone}</Text>}
        {user.location && <Text style={st.location}>📍 {user.location}</Text>}
        <View style={[st.roleBadge, { backgroundColor: roleInfo?.bg }]}>
          <Text style={[st.roleBadgeText, { color: roleInfo?.color }]}>
            {roleInfo?.label}
          </Text>
        </View>
        <Text style={st.statusText}>
          {user.isActive ? "✅ Aktif" : "⛔ Nonaktif"}
        </Text>
      </View>

      {/* Stats */}
      <Text style={st.sectionTitle}>Statistik Tilawah</Text>
      <View style={st.statsRow}>
        <View style={st.statCard}>
          <Text style={st.statValue}>{tilawah?.length ?? 0}</Text>
          <Text style={st.statLabel}>Bacaan</Text>
        </View>
        <View style={st.statCard}>
          <Text style={st.statValue}>{totalPages}</Text>
          <Text style={st.statLabel}>Halaman</Text>
        </View>
        <View style={st.statCard}>
          <Text style={st.statValue}>{khatam?.khatamCount ?? 0}</Text>
          <Text style={st.statLabel}>Khatam</Text>
        </View>
      </View>

      {/* Role Management */}
      <Text style={st.sectionTitle}>Ubah Role</Text>
      <View style={st.roleGrid}>
        {ROLE_OPTIONS.map((r) => (
          <Pressable
            key={r.value}
            style={({ pressed }) => [
              st.roleCard,
              user.role === r.value && {
                borderColor: r.color,
                backgroundColor: r.bg,
              },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => changeRole(r.value)}
          >
            <Text
              style={[
                st.roleCardText,
                user.role === r.value && { color: r.color, fontWeight: "700" },
              ]}
            >
              {r.label}
            </Text>
            {user.role === r.value && (
              <FontAwesome name="check-circle" size={16} color={r.color} />
            )}
          </Pressable>
        ))}
      </View>

      {/* Role Data Setup */}
      <Text style={st.sectionTitle}>Setup Data Role</Text>
      <View style={st.roleGrid}>
        <View style={st.setupCard}>
          <Text style={st.setupTitle}>Admin Pengajian</Text>
          <Text style={st.setupText}>
            {adminPengajianProfile
              ? `Tersambung ke lembaga: ${adminPengajianProfile.namaLembaga}`
              : "Belum ada data admin pengajian untuk user ini."}
          </Text>
          {!adminPengajianProfile && (
            <Pressable
              style={({ pressed }) => [st.setupButton, pressed && { opacity: 0.8 }]}
              onPress={() =>
                router.push({
                  pathname: "/lembaga-form",
                  params: { userId: user._id },
                })
              }
            >
              <Text style={st.setupButtonText}>Buat Data Admin Pengajian</Text>
            </Pressable>
          )}
        </View>

        <View style={st.setupCard}>
          <Text style={st.setupTitle}>Ustadz</Text>
          <Text style={st.setupText}>
            {ustadzProfile
              ? `Terdaftar di ${ustadzLembaga?.namaLembaga ?? "Lembaga tidak ditemukan"}`
              : "Belum ada data ustadz untuk user ini."}
          </Text>
          {!ustadzProfile && (
            <Pressable
              style={({ pressed }) => [st.setupButton, pressed && { opacity: 0.8 }]}
              onPress={() => setShowUstadzModal(true)}
            >
              <Text style={st.setupButtonText}>Buat Data Ustadz</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Recent Tilawah */}
      {tilawah && tilawah.length > 0 && (
        <>
          <Text style={st.sectionTitle}>Riwayat Tilawah Terbaru</Text>
          {tilawah.slice(-10).reverse().map((t) => (
            <View key={t._id} style={st.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.historyName}>{t.suratName}</Text>
                <Text style={st.historyMeta}>
                  {t.tanggal} · Juz {t.juz} · {t.jumlahHalaman} hal
                </Text>
              </View>
              {t.isKhatam && (
                <View style={st.khatamTag}>
                  <Text style={st.khatamTagText}>Khatam</Text>
                </View>
              )}
            </View>
          ))}
        </>
      )}
      </ScrollView>

      <Modal
        visible={showUstadzModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUstadzModal(false)}
      >
        <Pressable style={st.modalOverlay} onPress={() => setShowUstadzModal(false)}>
          <Pressable style={st.modalCard} onPress={() => {}}>
            <Text style={st.modalTitle}>Buat Data Ustadz</Text>
            <Text style={st.modalSubtitle}>{user.name}</Text>

            <Text style={st.inputLabel}>Pilih Lembaga *</Text>
            <View style={st.optionWrap}>
              {allLembaga?.map((item) => (
                <Pressable
                  key={item._id}
                  style={({ pressed }) => [
                    st.optionItem,
                    selectedLembagaId === item._id && st.optionItemActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setSelectedLembagaId(item._id)}
                >
                  <Text
                    style={[
                      st.optionText,
                      selectedLembagaId === item._id && st.optionTextActive,
                    ]}
                  >
                    {item.namaLembaga}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={st.inputLabel}>Spesialisasi (opsional)</Text>
            <TextInput
              value={spesialisasi}
              onChangeText={setSpesialisasi}
              style={st.input}
              placeholder="Contoh: Tahsin, Tahfidz, Murojaah"
              placeholderTextColor={Colors.textSecondary}
            />

            <Pressable
              style={({ pressed }) => [
                st.primaryBtn,
                (!selectedLembagaId || assigningUstadz) && { opacity: 0.5 },
                pressed && selectedLembagaId && !assigningUstadz && { opacity: 0.85 },
              ]}
              onPress={handleAssignUstadz}
              disabled={!selectedLembagaId || assigningUstadz}
            >
              {assigningUstadz ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={st.primaryBtnText}>Simpan Data Ustadz</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    backgroundColor: "#fff",
    alignItems: "center",
    padding: 28,
    paddingTop: 20,
    gap: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: "800", color: Colors.primary },
  name: { fontSize: 20, fontWeight: "700", color: Colors.text },
  email: { fontSize: 14, color: Colors.textSecondary },
  phone: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  location: { fontSize: 13, color: Colors.textSecondary },
  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  roleBadgeText: { fontSize: 13, fontWeight: "700" },
  statusText: { fontSize: 13, marginTop: 8, color: Colors.textSecondary },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },

  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary },

  roleGrid: {
    paddingHorizontal: 16,
    gap: 8,
  },
  roleCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  roleCardText: { fontSize: 14, fontWeight: "500", color: Colors.text },

  setupCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  setupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  setupText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  setupButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  setupButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  modalSubtitle: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
  },
  optionWrap: {
    gap: 6,
  },
  optionItem: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionItemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  optionText: {
    fontSize: 13,
    color: Colors.text,
  },
  optionTextActive: {
    color: Colors.primaryDark,
    fontWeight: "700",
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  historyName: { fontSize: 14, fontWeight: "600", color: Colors.text },
  historyMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  khatamTag: {
    backgroundColor: "#FFF8E1",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#FFD54F",
  },
  khatamTagText: { fontSize: 10, fontWeight: "bold", color: "#FF8F00" },
});
