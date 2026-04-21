import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors, UserRole } from "@/lib/constants";

const ROLE_OPTIONS: { label: string; value: UserRole; color: string; bg: string }[] = [
  { label: "Administrator", value: "administrator", color: "#C62828", bg: "#FFEBEE" },
  { label: "Admin Pengajian", value: "admin_pengajian", color: "#1565C0", bg: "#E3F2FD" },
  { label: "Ustadz", value: "ustadz", color: "#7B1FA2", bg: "#F3E5F5" },
  { label: "Santri", value: "santri", color: "#2E7D32", bg: "#E8F5E9" },
];

export default function PenggunaScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<UserRole | null>(null);
  const [roleModal, setRoleModal] = useState<{
    userId: Id<"users">;
    name: string;
    currentRole: UserRole;
  } | null>(null);

  const allUsers = useQuery(api.users.listAll, {});
  const updateRole = useMutation(api.users.updateRole);

  const filtered = allUsers?.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const handleUpdateRole = async (userId: Id<"users">, role: UserRole) => {
    try {
      await updateRole({ userId, role });
      Alert.alert("Berhasil", "Role pengguna telah diubah.");
      setRoleModal(null);
    } catch {
      Alert.alert("Error", "Gagal mengubah role.");
    }
  };

  if (!allUsers) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      {/* Search */}
      <View style={st.searchRow}>
        <View style={st.searchWrap}>
          <FontAwesome name="search" size={14} color={Colors.textSecondary} />
          <TextInput
            style={st.searchInput}
            placeholder="Cari pengguna..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textSecondary}
          />
        </View>
      </View>

      {/* Role Filter */}
      <View style={st.filterRow}>
        <Pressable
          style={[st.filterChip, !filterRole && st.filterChipActive]}
          onPress={() => setFilterRole(null)}
        >
          <Text
            style={[
              st.filterChipText,
              !filterRole && st.filterChipTextActive,
            ]}
          >
            Semua ({allUsers.length})
          </Text>
        </Pressable>
        {ROLE_OPTIONS.map((r) => {
          const count = allUsers.filter((u) => u.role === r.value).length;
          return (
            <Pressable
              key={r.value}
              style={[
                st.filterChip,
                filterRole === r.value && st.filterChipActive,
              ]}
              onPress={() =>
                setFilterRole(filterRole === r.value ? null : r.value)
              }
            >
              <Text
                style={[
                  st.filterChipText,
                  filterRole === r.value && st.filterChipTextActive,
                ]}
              >
                {r.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 16 }}
        renderItem={({ item }) => {
          const roleInfo = ROLE_OPTIONS.find((r) => r.value === item.role);
          return (
            <Pressable
              style={({ pressed }) => [st.card, pressed && { opacity: 0.8 }]}
              onPress={() =>
                router.push({
                  pathname: "/user-detail",
                  params: { id: item._id },
                })
              }
            >
              <View style={st.cardRow}>
                <View style={st.avatar}>
                  <Text style={st.avatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.cardName}>{item.name}</Text>
                  <Text style={st.cardEmail}>{item.email}</Text>
                  {item.phone && (
                    <Text style={st.cardPhone}>{item.phone}</Text>
                  )}
                </View>
                <Pressable
                  style={[st.roleTag, { backgroundColor: roleInfo?.bg }]}
                  onPress={() =>
                    setRoleModal({
                      userId: item._id,
                      name: item.name,
                      currentRole: item.role as UserRole,
                    })
                  }
                >
                  <Text style={[st.roleTagText, { color: roleInfo?.color }]}>
                    {roleInfo?.label}
                  </Text>
                  <FontAwesome
                    name="pencil"
                    size={10}
                    color={roleInfo?.color}
                    style={{ marginLeft: 4 }}
                  />
                </Pressable>
              </View>
              <View style={st.cardFooter}>
                <Text style={st.cardStatus}>
                  {item.isActive ? "✅ Aktif" : "⛔ Nonaktif"}
                </Text>
                {item.location && (
                  <Text style={st.cardLoc}>📍 {item.location}</Text>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={st.empty}>
            <FontAwesome name="users" size={32} color={Colors.border} />
            <Text style={st.emptyText}>Tidak ada pengguna ditemukan</Text>
          </View>
        }
      />

      {/* Role Picker Modal */}
      <Modal
        visible={roleModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModal(null)}
      >
        <Pressable style={st.modalOverlay} onPress={() => setRoleModal(null)}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>Ubah Role</Text>
            <Text style={st.modalSubtitle}>{roleModal?.name}</Text>
            {ROLE_OPTIONS.map((r) => (
              <Pressable
                key={r.value}
                style={({ pressed }) => [
                  st.modalOption,
                  roleModal?.currentRole === r.value && {
                    backgroundColor: r.bg,
                    borderColor: r.color,
                  },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() =>
                  roleModal && handleUpdateRole(roleModal.userId, r.value)
                }
              >
                <Text
                  style={[
                    st.modalOptionText,
                    roleModal?.currentRole === r.value && { color: r.color },
                  ]}
                >
                  {r.label}
                </Text>
                {roleModal?.currentRole === r.value && (
                  <FontAwesome name="check" size={14} color={r.color} />
                )}
              </Pressable>
            ))}
            <Pressable
              style={st.modalCancel}
              onPress={() => setRoleModal(null)}
            >
              <Text style={st.modalCancelText}>Batal</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchRow: { padding: 16, paddingBottom: 8 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#fff",
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  filterChipTextActive: { color: "#fff" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: Colors.primary },
  cardName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  cardEmail: { fontSize: 12, color: Colors.textSecondary },
  cardPhone: { fontSize: 12, color: Colors.textSecondary },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleTagText: { fontSize: 10, fontWeight: "700" },
  cardFooter: {
    flexDirection: "row",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 16,
  },
  cardStatus: { fontSize: 12, color: Colors.textSecondary },
  cardLoc: { fontSize: 12, color: Colors.textSecondary },

  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  // Modal
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
    padding: 24,
    width: "100%",
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 18,
    marginTop: 4,
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  modalCancel: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
});
