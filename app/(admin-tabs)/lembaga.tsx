import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import ConfirmModal from "@/components/ConfirmModal";

export default function LembagaScreen() {
  const router = useRouter();
  const lembagaList = useQuery(api.adminPengajian.listAll);
  const allUsers = useQuery(api.users.listAll, {});
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: Id<"admin_pengajian">;
    nama: string;
  } | null>(null);
  const deleteLembaga = useMutation(api.adminPengajian.remove);

  const handleDelete = (id: Id<"admin_pengajian">, nama: string) => {
    setItemToDelete({ id, nama });
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, nama } = itemToDelete;
    setDeleteModalVisible(false);
    setItemToDelete(null);
    try {
      await deleteLembaga({ id });
      Alert.alert("Berhasil", `Lembaga "${nama}" telah dihapus.`);
    } catch (e: any) {
      Alert.alert("Gagal", e.message ?? "Terjadi kesalahan saat menghapus");
    }
  };

  if (!lembagaList || !allUsers) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <FlatList
        data={lembagaList}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={({ item }) => {
          const admin = allUsers.find((u) => u._id === item.userId);
          return (
            <View style={st.card}>
              <View style={st.cardHeader}>
                {item.fotoUrl ? (
                  <Image source={{ uri: item.fotoUrl }} style={st.iconWrap} resizeMode="cover" />
                ) : (
                  <View style={st.iconWrap}>
                    <FontAwesome
                      name="institution"
                      size={18}
                      color={Colors.primary}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={st.cardTitle}>{item.namaLembaga}</Text>
                  <Text style={st.cardLoc}>
                    📍 {item.kota}, {item.provinsi}
                  </Text>
                </View>
                <View
                  style={[
                    st.statusBadge,
                    {
                      backgroundColor: item.isActive
                        ? "#E8F5E9"
                        : "#FFEBEE",
                    },
                  ]}
                >
                  <Text
                    style={[
                      st.statusText,
                      {
                        color: item.isActive ? Colors.success : Colors.error,
                      },
                    ]}
                  >
                    {item.isActive ? "Aktif" : "Nonaktif"}
                  </Text>
                </View>
              </View>

              {item.alamat && (
                <Text style={st.alamat}>{item.alamat}</Text>
              )}

              <View style={st.adminRow}>
                <FontAwesome
                  name="user"
                  size={12}
                  color={Colors.textSecondary}
                />
                <Text style={st.adminText}>
                  Admin: {admin?.name ?? "Unknown"}
                </Text>
              </View>

              <View style={st.cardActions}>
                <Pressable
                  style={st.actionBtn}
                  onPress={() =>
                    router.push({
                      pathname: "/lembaga-form",
                      params: { id: item._id },
                    })
                  }
                >
                  <FontAwesome name="pencil" size={13} color={Colors.primary} />
                  <Text style={st.actionBtnText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={st.actionBtn}
                  onPress={() =>
                    router.push({
                      pathname: "/kelas-admin/[adminPengajianId]",
                      params: { adminPengajianId: item._id },
                    })
                  }
                >
                  <FontAwesome name="users" size={13} color={Colors.primary} />
                  <Text style={st.actionBtnText}>Kelola Kelas</Text>
                </Pressable>
                <Pressable
                  style={[st.actionBtn, st.actionBtnDanger]}
                  onPress={() => handleDelete(item._id, item.namaLembaga)}
                >
                  <FontAwesome name="trash-o" size={13} color={Colors.error} />
                  <Text style={[st.actionBtnText, { color: Colors.error }]}>Hapus</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={st.empty}>
            <FontAwesome name="institution" size={32} color={Colors.border} />
            <Text style={st.emptyText}>Belum ada lembaga</Text>
          </View>
        }
      />

      <Pressable
        style={({ pressed }) => [st.fab, pressed && { opacity: 0.85 }]}
        onPress={() => router.push("/lembaga-form")}
      >
        <FontAwesome name="plus" size={22} color="#fff" />
      </Pressable>

      <ConfirmModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={confirmDelete}
        title="Hapus Lembaga"
        message={`Yakin ingin menghapus "${itemToDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        type="danger"
        icon="trash"
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: Colors.text },
  cardLoc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  alamat: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
    paddingLeft: 52,
  },
  adminRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingLeft: 52,
  },
  adminText: { fontSize: 12, color: Colors.textSecondary },

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
