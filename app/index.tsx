import { Redirect } from "expo-router";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { useAuthContext } from "@/lib/auth-context";
import { Colors } from "@/lib/constants";

export default function Index() {
  const { isLoading, isAuthenticated, role } = useAuthContext();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Tahsin</Text>
        <Text style={styles.subtitle}>Belajar Al-Qur'an</Text>
        <ActivityIndicator size="large" color={Colors.primary} style={styles.spinner} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!role) {
    return <Redirect href="/pilih-role" />;
  }

  if (role === "administrator" || role === "admin_pengajian") {
    return <Redirect href="/(admin-tabs)/dashboard" />;
  }

  return <Redirect href="/(tabs)/tilawah" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: Colors.textLight,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textLight,
    opacity: 0.8,
    marginBottom: 40,
  },
  spinner: {
    marginTop: 20,
  },
});
