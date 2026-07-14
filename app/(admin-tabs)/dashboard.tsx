import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthContext } from "@/lib/auth-context";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import { useClerk } from "@clerk/expo";
import ConfirmModal from "@/components/ConfirmModal";

export default function DashboardScreen() {
  const { userData } = useAuthContext();
  const router = useRouter();
  const { signOut } = useClerk();
  const [logoutModalVisible, setLogoutModalVisible] = React.useState(false);

  // Dashboard dipakai administrator (data global) maupun admin_pengajian
  // (hanya lembaganya sendiri). Percabangan berbasis role aktif.
  const isLembaga = userData?.role === "admin_pengajian";

  const handleLogout = async () => {
    setLogoutModalVisible(false);
    try {
      await signOut();
      router.replace("/");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Dipakai kedua role: hitungan materi (konten bersama) & lookup nama anggota.
  const allUsers = useQuery(api.users.listAll, {});
  const allMateri = useQuery(api.materi.list, { type: "tahsin" });
  const allUlumul = useQuery(api.materi.list, { type: "ulumul_quran" });
  const allFiqih = useQuery(api.materi.list, { type: "fiqih" });

  // --- Query khusus administrator (data global) ---
  const allLembaga = useQuery(
    api.adminPengajian.listAll,
    isLembaga ? "skip" : {}
  );
  const pendingLembagaRequests = useQuery(
    api.adminPengajianRequest.listByStatus,
    isLembaga ? "skip" : { status: "pending" }
  );

  // --- Query khusus admin_pengajian (dibatasi lembaga sendiri) ---
  const lembaga = useQuery(
    api.adminPengajian.getByUserId,
    isLembaga && userData?._id ? { userId: userData._id } : "skip"
  );
  const santriList = useQuery(
    api.santri.listByAdminPengajian,
    isLembaga && lembaga?._id ? { adminPengajianId: lembaga._id } : "skip"
  );
  const ustadzList = useQuery(
    api.ustadz.listByAdminPengajian,
    isLembaga && lembaga?._id ? { adminPengajianId: lembaga._id } : "skip"
  );
  const kelasList = useQuery(
    api.kelas.listByAdminPengajian,
    isLembaga && lembaga?._id ? { adminPengajianId: lembaga._id } : "skip"
  );
  const pendingJoinRequests = useQuery(
    api.lkmJoinRequest.listByAdminPengajian,
    isLembaga && lembaga?._id
      ? { adminPengajianId: lembaga._id, status: "pending" as const }
      : "skip"
  );

  // Anggota lembaga (santri + ustadz) beserta profil user-nya. Hanya user yang
  // sudah berafiliasi dengan lembaga ini yang ditampilkan — bukan seluruh user.
  const affiliatedMembers = React.useMemo(() => {
    if (!isLembaga || !allUsers) return [];
    const ustadzUserIds = new Set((ustadzList ?? []).map((u) => u.userId));
    const memberUserIds = new Set<string>([
      ...(santriList ?? []).map((s) => s.userId),
      ...ustadzUserIds,
    ]);
    return allUsers
      .filter((u) => memberUserIds.has(u._id))
      .map((u) => ({
        ...u,
        // Tampilkan sebagai ustadz bila punya keanggotaan ustadz di lembaga ini.
        displayRole: ustadzUserIds.has(u._id)
          ? ("ustadz" as const)
          : ("santri" as const),
      }));
  }, [isLembaga, allUsers, santriList, ustadzList]);

  const isLoadingCommon = !allMateri || !allUlumul || !allFiqih;

  const isLoading = isLembaga
    ? isLoadingCommon ||
      lembaga === undefined ||
      (!!lembaga &&
        (santriList === undefined ||
          ustadzList === undefined ||
          kelasList === undefined)) ||
      !allUsers
    : isLoadingCommon || !allUsers || !allLembaga;

  const stats = isLoading
    ? []
    : isLembaga
      ? [
          {
            icon: "users" as const,
            label: "Total Anggota",
            value: affiliatedMembers.length,
            color: "#1976D2",
            bg: "#E3F2FD",
          },
          {
            icon: "user-md" as const,
            label: "Ustadz",
            value: (ustadzList ?? []).length,
            color: "#7B1FA2",
            bg: "#F3E5F5",
          },
          {
            icon: "graduation-cap" as const,
            label: "Santri",
            value: (santriList ?? []).length,
            color: "#388E3C",
            bg: "#E8F5E9",
          },
          {
            icon: "graduation-cap" as const,
            label: "Kelas",
            value: (kelasList ?? []).length,
            color: "#00695C",
            bg: "#E0F2F1",
          },
          {
            icon: "user-plus" as const,
            label: "Pengajuan Baru",
            value: (pendingJoinRequests ?? []).length,
            color: "#F57C00",
            bg: "#FFF3E0",
          },
          {
            icon: "book" as const,
            label: "Materi Tahsin",
            value: allMateri!.length,
            color: "#C62828",
            bg: "#FFEBEE",
          },
        ]
      : [
          {
            icon: "users" as const,
            label: "Total Pengguna",
            value: allUsers!.length,
            color: "#1976D2",
            bg: "#E3F2FD",
          },
          {
            icon: "user-md" as const,
            label: "Ustadz",
            value: allUsers!.filter((u) => u.role === "ustadz").length,
            color: "#7B1FA2",
            bg: "#F3E5F5",
          },
          {
            icon: "graduation-cap" as const,
            label: "Santri",
            value: allUsers!.filter((u) => u.role === "santri").length,
            color: "#388E3C",
            bg: "#E8F5E9",
          },
          {
            icon: "book" as const,
            label: "Materi Tahsin",
            value: allMateri!.length,
            color: "#F57C00",
            bg: "#FFF3E0",
          },
          {
            icon: "star" as const,
            label: "Ulumul Quran",
            value: allUlumul!.length,
            color: "#C62828",
            bg: "#FFEBEE",
          },
          {
            icon: "balance-scale" as const,
            label: "Fiqih",
            value: allFiqih!.length,
            color: "#00695C",
            bg: "#E0F2F1",
          },
          {
            icon: "institution" as const,
            label: "Lembaga",
            value: allLembaga!.length,
            color: "#00695C",
            bg: "#E0F2F1",
          },
        ];

  // Aksi cepat admin_pengajian dibatasi: tanpa Approval LKM (lembaga baru),
  // tanpa Header Tilawah, dan tanpa Kelola Pengguna global — hanya anggota
  // lembaganya sendiri.
  const quickActions = isLembaga
    ? [
        {
          icon: "users" as const,
          label: "Kelola Anggota",
          onPress: () => router.push("/(admin-tabs)/anggota"),
        },
        {
          icon: "plus-circle" as const,
          label: "Tambah Materi",
          onPress: () => router.push("/materi-form"),
        },
        {
          icon: "check-square-o" as const,
          label:
            pendingJoinRequests && pendingJoinRequests.length > 0
              ? `Approval Santri (${pendingJoinRequests.length})`
              : "Approval Santri",
          // Persetujuan pengajuan santri gabung ditangani KelasAdminPanel yang
          // dirender oleh tab Kelas (bukan lkm-saya = profil lembaga).
          onPress: () => router.push("/(admin-tabs)/kelas"),
        },
        {
          icon: "graduation-cap" as const,
          label: "Kelola Kelas",
          onPress: () => router.push("/(admin-tabs)/kelas"),
        },
        {
          icon: "exchange" as const,
          label: "Ganti Role",
          onPress: () => router.push("/pilih-role"),
        },
      ]
    : [
        {
          icon: "user-plus" as const,
          label: "Kelola Pengguna",
          onPress: () => router.push("/(admin-tabs)/pengguna"),
        },
        {
          icon: "plus-circle" as const,
          label: "Tambah Materi",
          onPress: () => router.push("/materi-form"),
        },
        {
          icon: "institution" as const,
          label: "Tambah Lembaga",
          onPress: () => router.push("/lembaga-form"),
        },
        {
          icon: "check-square-o" as const,
          label:
            pendingLembagaRequests && pendingLembagaRequests.length > 0
              ? `Approval LKM (${pendingLembagaRequests.length})`
              : "Approval LKM",
          onPress: () => router.push("/admin-lembaga-requests"),
        },
        {
          icon: "bar-chart" as const,
          label: "Monitoring",
          onPress: () => router.push("/(admin-tabs)/monitoring"),
        },
        {
          icon: "picture-o" as const,
          label: "Header Tilawah",
          onPress: () => router.push("/tilawah-header-form"),
        },
        {
          icon: "exchange" as const,
          label: "Ganti Role",
          onPress: () => router.push("/pilih-role"),
        },
      ];

  return (
    <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={st.greeting}>Assalamu'alaikum,</Text>
          <Text style={st.userName}>{userData?.name ?? "Admin"}</Text>
          <Text style={st.roleBadge}>
            {userData?.role === "administrator"
              ? "Administrator"
              : "Admin Pengajian"}
          </Text>
        </View>
        <Pressable
          onPress={() => setLogoutModalVisible(true)}
          style={({ pressed }) => [st.logoutBtn, pressed && { opacity: 0.7 }]}
        >
          <FontAwesome name="sign-out" size={18} color={Colors.error} />
        </Pressable>
      </View>

      {/* Stats */}
      <Text style={st.sectionTitle}>Ringkasan Data</Text>
      {isLoading ? (
        <View style={st.loadWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <View style={st.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={st.statCard}>
              <View style={[st.statIcon, { backgroundColor: s.bg }]}>
                <FontAwesome name={s.icon} size={18} color={s.color} />
              </View>
              <Text style={st.statValue}>{s.value}</Text>
              <Text style={st.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <Text style={st.sectionTitle}>Aksi Cepat</Text>
      <View style={st.actionsRow}>
        {quickActions.map((a, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [st.actionCard, pressed && { opacity: 0.8 }]}
            onPress={a.onPress}
          >
            <View style={st.actionIcon}>
              <FontAwesome name={a.icon} size={20} color={Colors.primary} />
            </View>
            <Text style={st.actionLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Recent Users — administrator: seluruh pengguna; admin_pengajian:
          hanya anggota yang sudah berafiliasi dengan lembaganya. */}
      {(isLembaga ? affiliatedMembers.length > 0 : !!allUsers) && (
        <>
          <Text style={st.sectionTitle}>
            {isLembaga ? "Anggota Terbaru" : "Pengguna Terbaru"}
          </Text>
          {(isLembaga
            ? affiliatedMembers.map((m) => ({ ...m, role: m.displayRole }))
            : allUsers!
          )
            .slice(-5)
            .reverse()
            .map((u) => (
            <Pressable
              key={u._id}
              style={({ pressed }) => [st.userRow, pressed && { opacity: 0.7 }]}
              onPress={() =>
                router.push({ pathname: "/user-detail", params: { id: u._id } })
              }
            >
              <View style={st.avatar}>
                <Text style={st.avatarText}>
                  {u.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.userRowName}>{u.name}</Text>
                <Text style={st.userRowEmail}>{u.email}</Text>
              </View>
              <View
                style={[
                  st.roleTag,
                  {
                    backgroundColor:
                      u.role === "administrator"
                        ? "#FFEBEE"
                        : u.role === "ustadz"
                          ? "#F3E5F5"
                          : u.role === "admin_pengajian"
                            ? "#E3F2FD"
                            : "#E8F5E9",
                  },
                ]}
              >
                <Text
                  style={[
                    st.roleTagText,
                    {
                      color:
                        u.role === "administrator"
                          ? "#C62828"
                          : u.role === "ustadz"
                            ? "#7B1FA2"
                            : u.role === "admin_pengajian"
                              ? "#1565C0"
                              : "#2E7D32",
                    },
                  ]}
                >
                  {u.role}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      )}
      <ConfirmModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={handleLogout}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari panel admin?"
        confirmText="Keluar"
        type="danger"
        icon="sign-out"
      />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.primary,
    padding: 24,
    paddingTop: 56,
    paddingBottom: 28,
  },
  greeting: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  userName: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 2 },
  roleBadge: {
    fontSize: 12,
    color: Colors.primaryLight,
    fontWeight: "600",
    marginTop: 4,
  },
  logoutBtn: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  loadWrap: { padding: 40, alignItems: "center" },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    width: "31%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "800", color: Colors.text },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
  },

  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
  },
  actionCard: {
    width: "31%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.text,
    textAlign: "center",
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  userRowName: { fontSize: 14, fontWeight: "600", color: Colors.text },
  userRowEmail: { fontSize: 12, color: Colors.textSecondary },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleTagText: { fontSize: 10, fontWeight: "700" },
});
