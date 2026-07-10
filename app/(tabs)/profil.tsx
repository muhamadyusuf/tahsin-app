import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useClerk } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors, ROLES } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";
import ConfirmModal from "@/components/ConfirmModal";

const ROLE_LABELS: Record<string, string> = {
  [ROLES.ADMINISTRATOR]: "Administrator",
  [ROLES.ADMIN_PENGAJIAN]: "Admin Pengajian",
  [ROLES.USTADZ]: "Ustadz",
  [ROLES.SANTRI]: "Santri",
};

export default function ProfilScreen() {
  const { userData, role, hasMultipleRoles, isAdmin } = useAuthContext();
  const { signOut } = useClerk();
  const router = useRouter();

  const [logoutModalVisible, setLogoutModalVisible] = React.useState(false);

  const santriProfile = useQuery(
    api.santri.getByUserId,
    role === "santri" && userData?._id ? { userId: userData._id } : "skip"
  );
  const affiliatedLembagaId = santriProfile?.adminPengajianId ?? userData?.adminPengajianId;
  const lembaga = useQuery(
    api.adminPengajian.getById,
    affiliatedLembagaId ? { id: affiliatedLembagaId } : "skip"
  );

  const doLogout = async () => {
    setLogoutModalVisible(false);
    try {
      await signOut();
      router.replace("/");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {userData?.avatarUrl ? (
            <Image
              source={{ uri: userData.avatarUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <FontAwesome name="user" size={40} color={Colors.primary} />
          )}
        </View>
        <Text style={styles.name}>{userData?.name ?? "User"}</Text>
        <Text style={styles.email}>{userData?.email ?? ""}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {ROLE_LABELS[role ?? "santri"] ?? "Santri"}
          </Text>
        </View>
        {lembaga && (
          <View style={styles.lembagaRow}>
            <FontAwesome name="building" size={12} color={Colors.textSecondary} />
            <Text style={styles.lembagaText}>{lembaga.namaLembaga}</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Tilawah</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>0%</Text>
          <Text style={styles.statLabel}>Tahsin</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Talaqi</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/edit-profil")}>
          <FontAwesome name="edit" size={18} color={Colors.primary} />
          <Text style={styles.menuText}>Edit Profil</Text>
          <FontAwesome
            name="chevron-right"
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>

        {role === "santri" && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/lembaga-pengajian")}>
            <FontAwesome name="building" size={18} color={Colors.primary} />
            <Text style={styles.menuText}>Lembaga Pengajian</Text>
            <FontAwesome
              name="chevron-right"
              size={14}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/statistik")}>
          <FontAwesome name="bar-chart" size={18} color={Colors.primary} />
          <Text style={styles.menuText}>Statistik</Text>
          <FontAwesome
            name="chevron-right"
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/pengaturan")}>
          <FontAwesome name="cog" size={18} color={Colors.primary} />
          <Text style={styles.menuText}>Pengaturan</Text>
          <FontAwesome
            name="chevron-right"
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>

        {hasMultipleRoles && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/pilih-role")}>
            <FontAwesome name="exchange" size={18} color={Colors.primary} />
            <Text style={styles.menuText}>Pilih Role Aktif</Text>
            <FontAwesome
              name="chevron-right"
              size={14}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        {isAdmin && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/(admin-tabs)/dashboard")}>
            <FontAwesome name="dashboard" size={18} color={Colors.primary} />
            <Text style={styles.menuText}>Panel Admin</Text>
            <FontAwesome
              name="chevron-right"
              size={14}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/info-api")}>
          <FontAwesome name="plug" size={18} color={Colors.primary} />
          <Text style={styles.menuText}>Informasi API</Text>
          <FontAwesome
            name="chevron-right"
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/bantuan")}>
          <FontAwesome
            name="question-circle"
            size={18}
            color={Colors.primary}
          />
          <Text style={styles.menuText}>Bantuan</Text>
          <FontAwesome
            name="chevron-right"
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <FontAwesome name="sign-out" size={18} color={Colors.error} />
        <Text style={styles.logoutText}>Keluar</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>Tahsin v1.0.0</Text>

      <ConfirmModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={doLogout}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari aplikasi?"
        confirmText="Keluar"
        type="danger"
        icon="sign-out"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.text,
  },
  email: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  roleBadge: {
    marginTop: 12,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    color: Colors.primaryDark,
    fontWeight: "bold",
    fontSize: 12,
  },
  lembagaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  lembagaText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  menuSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.error,
  },
  version: {
    textAlign: "center",
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 20,
  },
});
