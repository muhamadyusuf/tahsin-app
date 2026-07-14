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
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

type Tab = "santri" | "ustadz";

export default function AnggotaScreen() {
  const { userData } = useAuthContext();
  const [tab, setTab] = useState<Tab>("santri");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const lembaga = useQuery(
    api.adminPengajian.getByUserId,
    userData?._id ? { userId: userData._id } : "skip"
  );
  const santriListRaw = useQuery(
    api.santri.listByAdminPengajian,
    lembaga?._id ? { adminPengajianId: lembaga._id } : "skip"
  );
  const ustadzListRaw = useQuery(
    api.ustadz.listByAdminPengajian,
    lembaga?._id ? { adminPengajianId: lembaga._id } : "skip"
  );
  const allUsers = useQuery(api.users.listAll, {});

  const createUstadz = useMutation(api.ustadz.create);

  const isLoading =
    lembaga === undefined ||
    allUsers === undefined ||
    (!!lembaga?._id && (santriListRaw === undefined || ustadzListRaw === undefined));

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
        <FontAwesome name="institution" size={32} color={Colors.border} />
        <Text style={st.emptyText}>Profil lembaga belum dibuat</Text>
      </View>
    );
  }

  const santriList = santriListRaw ?? [];
  const ustadzList = ustadzListRaw ?? [];
  const ustadzUserIds = new Set(ustadzList.map((u) => u.userId));

  const handleJadikanUstadz = (targetUserId: Id<"users">, name: string) => {
    Alert.alert(
      "Jadikan Ustadz",
      `Jadikan ${name} sebagai ustadz di lembaga ini?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Jadikan Ustadz",
          onPress: async () => {
            setBusyUserId(targetUserId);
            try {
              // Cukup buat keanggotaan ustadz. Role "ustadz" otomatis tersedia
              // bagi user (lihat getAvailableRoles) tanpa menimpa role aktif
              // mereka — mereka bisa beralih sendiri lewat "Pilih Role Aktif".
              await createUstadz({ userId: targetUserId, adminPengajianId: lembaga._id });
            } catch (error) {
              Alert.alert("Gagal", error instanceof Error ? error.message : "Terjadi kesalahan");
            } finally {
              setBusyUserId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={st.container}>
      <View style={st.tabRow}>
        <Pressable
          style={[st.tabBtn, tab === "santri" && st.tabBtnActive]}
          onPress={() => setTab("santri")}
        >
          <Text style={[st.tabText, tab === "santri" && st.tabTextActive]}>
            Santri ({santriList.length})
          </Text>
        </Pressable>
        <Pressable
          style={[st.tabBtn, tab === "ustadz" && st.tabBtnActive]}
          onPress={() => setTab("ustadz")}
        >
          <Text style={[st.tabText, tab === "ustadz" && st.tabTextActive]}>
            Ustadz ({ustadzList.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={st.content}>
        {tab === "santri" ? (
          santriList.length === 0 ? (
            <View style={st.emptyBox}>
              <FontAwesome name="user-o" size={32} color={Colors.border} />
              <Text style={st.emptyText}>Belum ada santri terafiliasi</Text>
            </View>
          ) : (
            santriList.map((santri) => {
              const user = allUsers.find((u) => u._id === santri.userId);
              const isUstadz = ustadzUserIds.has(santri.userId);
              const busy = busyUserId === santri.userId;
              return (
                <View key={santri._id} style={st.card}>
                  <View style={st.cardIcon}>
                    <FontAwesome name="user" size={16} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.cardName}>{user?.name ?? "Santri"}</Text>
                    <Text style={st.cardSub}>{user?.email}</Text>
                  </View>
                  {!isUstadz && user && (
                    <Pressable
                      style={[st.promoteBtn, busy && { opacity: 0.5 }]}
                      onPress={() => handleJadikanUstadz(user._id, user.name)}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator color={Colors.primary} size="small" />
                      ) : (
                        <Text style={st.promoteText}>Jadikan Ustadz</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })
          )
        ) : ustadzList.length === 0 ? (
          <View style={st.emptyBox}>
            <FontAwesome name="user-md" size={32} color={Colors.border} />
            <Text style={st.emptyText}>Belum ada ustadz di lembaga ini</Text>
          </View>
        ) : (
          ustadzList.map((ustadz) => {
            const user = allUsers.find((u) => u._id === ustadz.userId);
            return (
              <View key={ustadz._id} style={st.card}>
                <View style={st.cardIcon}>
                  <FontAwesome name="user-md" size={16} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.cardName}>{user?.name ?? "Ustadz"}</Text>
                  <Text style={st.cardSub}>{ustadz.spesialisasi ?? user?.email}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },

  tabRow: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },

  content: { padding: 16, paddingTop: 8, paddingBottom: 100, gap: 10 },
  emptyBox: { alignItems: "center", padding: 40, gap: 10 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  cardName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  promoteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  promoteText: { fontSize: 11, fontWeight: "700", color: Colors.primary },
});
