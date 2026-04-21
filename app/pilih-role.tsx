import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors, ROLES, UserRole } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

const ROLE_META: Record<UserRole, { label: string; icon: React.ComponentProps<typeof FontAwesome>["name"] }> = {
  [ROLES.ADMINISTRATOR]: { label: "Administrator", icon: "shield" },
  [ROLES.ADMIN_PENGAJIAN]: { label: "Admin Pengajian", icon: "institution" },
  [ROLES.USTADZ]: { label: "Ustadz", icon: "graduation-cap" },
  [ROLES.SANTRI]: { label: "Santri", icon: "book" },
};

export default function PilihRoleScreen() {
  const router = useRouter();
  const { isLoading, isAuthenticated, role, availableRoles, switchRole } =
    useAuthContext();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(role);
  const [submitting, setSubmitting] = useState(false);

  const sortedRoles = useMemo(() => {
    const baseOrder: UserRole[] = [
      ROLES.ADMINISTRATOR,
      ROLES.ADMIN_PENGAJIAN,
      ROLES.USTADZ,
      ROLES.SANTRI,
    ];
    return [...availableRoles].sort(
      (a, b) => baseOrder.indexOf(a) - baseOrder.indexOf(b)
    );
  }, [availableRoles]);

  const goToRoleHome = (targetRole: UserRole) => {
    if (targetRole === ROLES.ADMINISTRATOR || targetRole === ROLES.ADMIN_PENGAJIAN) {
      router.replace("/(admin-tabs)/dashboard");
      return;
    }
    router.replace("/(tabs)/tilawah");
  };

  const submitRole = async () => {
    if (!selectedRole) {
      return;
    }
    try {
      setSubmitting(true);
      await switchRole(selectedRole);
      goToRoleHome(selectedRole);
    } catch {
      Alert.alert("Gagal", "Tidak dapat mengganti role. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (sortedRoles.length <= 1 && sortedRoles[0]) {
    const nextPath =
      sortedRoles[0] === ROLES.ADMINISTRATOR ||
      sortedRoles[0] === ROLES.ADMIN_PENGAJIAN
        ? "/(admin-tabs)/dashboard"
        : "/(tabs)/tilawah";
    return <Redirect href={nextPath} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pilih Role Aktif</Text>
      <Text style={styles.subtitle}>
        Anda memiliki lebih dari satu role. Pilih mode aplikasi yang ingin digunakan.
      </Text>

      <View style={styles.cardList}>
        {sortedRoles.map((item) => {
          const meta = ROLE_META[item];
          const selected = selectedRole === item;
          return (
            <Pressable
              key={item}
              style={({ pressed }) => [
                styles.roleCard,
                selected && styles.roleCardSelected,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setSelectedRole(item)}
            >
              <View style={styles.roleIconWrap}>
                <FontAwesome name={meta.icon} size={20} color={Colors.primary} />
              </View>
              <Text style={styles.roleLabel}>{meta.label}</Text>
              {selected && <FontAwesome name="check-circle" size={20} color={Colors.primary} />}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          (!selectedRole || submitting) && styles.submitButtonDisabled,
          pressed && selectedRole && !submitting && { opacity: 0.85 },
        ]}
        onPress={submitRole}
        disabled={!selectedRole || submitting}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.submitText}>Masuk Dengan Role Ini</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  cardList: {
    gap: 10,
  },
  roleCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  roleCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  roleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  roleLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
