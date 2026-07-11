import { useEffect } from "react";
import { useRouter, useRootNavigationState, type Href } from "expo-router";
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { useAuthContext } from "@/lib/auth-context";
import { Colors } from "@/lib/constants";

export default function Index() {
  const { isLoading, isAuthenticated, role } = useAuthContext();
  const router = useRouter();
  // router.replace yang dipanggil sebelum root navigator siap akan di-drop
  // diam-diam (terutama di web, tepat setelah replace dari sso-callback).
  // Tunggu sampai navigation state punya key sebelum mencoba redirect.
  const rootNavigationState = useRootNavigationState();
  const navReady = !!rootNavigationState?.key;

  useEffect(() => {
    if (isLoading || !navReady) return;

    let target: Href;
    let webPath: string;
    if (!isAuthenticated) {
      target = "/(auth)/login";
      webPath = "/login";
    } else if (!role) {
      target = "/pilih-role";
      webPath = "/pilih-role";
    } else if (role === "administrator" || role === "admin_pengajian") {
      target = "/(admin-tabs)/dashboard";
      webPath = "/dashboard";
    } else {
      target = "/(tabs)/tilawah";
      webPath = "/tilawah";
    }

    router.replace(target);

    // Kalau replace di atas tetap di-drop, coba ulang; di web, jalan
    // terakhirnya paksa full reload ke halaman tujuan. Interval otomatis
    // bersih saat navigasi berhasil karena index unmount.
    let attempts = 0;
    const retry = setInterval(() => {
      attempts += 1;
      if (attempts <= 2) {
        router.replace(target);
        return;
      }
      clearInterval(retry);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.replace(webPath);
      }
    }, 700);

    return () => clearInterval(retry);
  }, [isLoading, isAuthenticated, role, navReady, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tahsin</Text>
      <Text style={styles.subtitle}>Belajar Al-Qur'an</Text>
      <ActivityIndicator size="large" color={Colors.primary} style={styles.spinner} />
    </View>
  );
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
