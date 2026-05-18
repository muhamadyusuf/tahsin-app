import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, View, StyleSheet } from "react-native";
import "react-native-reanimated";

import { Providers } from "@/lib/providers";
import { AuthProvider } from "@/lib/auth-context";
import { Colors, WEB_MAX_WIDTH } from "@/lib/constants";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    AmiriQuran: require("../assets/fonts/AmiriQuran-Regular.ttf"),
    Amiri: require("../assets/fonts/Amiri-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <Providers>
      <AuthProvider>
        <StatusBar style="light" backgroundColor="#2E7D32" />
        <View style={styles.rootContainer}>
          <View style={styles.contentContainer}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(admin-tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="pilih-role" options={{ title: "Pilih Role", headerTintColor: Colors.primary }} />
              <Stack.Screen name="sso-callback" options={{ headerShown: false }} />
              <Stack.Screen name="surah/[surahNumber]" options={{ headerShown: true }} />
              <Stack.Screen name="mushaf" options={{ headerShown: false }} />
              <Stack.Screen name="edit-profil" options={{ title: "Edit Profil", headerTintColor: Colors.primary }} />
              <Stack.Screen name="lembaga-pengajian" options={{ title: "Lembaga Pengajian", headerTintColor: Colors.primary }} />
              <Stack.Screen name="statistik" options={{ title: "Statistik", headerTintColor: Colors.primary }} />
              <Stack.Screen name="pengaturan" options={{ title: "Pengaturan", headerTintColor: Colors.primary }} />
              <Stack.Screen name="bantuan" options={{ title: "Bantuan", headerTintColor: Colors.primary }} />
              <Stack.Screen name="materi/[materiId]" options={{ title: "Detail Materi", headerTintColor: Colors.primary }} />
              <Stack.Screen name="materi-reader/[materiId]" options={{ title: "Baca Materi", headerTintColor: Colors.primary }} />
              <Stack.Screen name="quiz/[materiId]" options={{ title: "Kuis", headerTintColor: Colors.primary }} />
              <Stack.Screen name="tilawah-harian" options={{ title: "Tilawah Harian", headerTintColor: Colors.primary }} />
              <Stack.Screen name="tilawah-header-form" options={{ title: "Header Tilawah", headerTintColor: Colors.primary }} />
              <Stack.Screen name="materi-form" options={{ title: "Form Materi", headerTintColor: Colors.primary }} />
              <Stack.Screen name="quiz-form" options={{ title: "Form Kuis", headerTintColor: Colors.primary }} />
              <Stack.Screen name="quiz-manage" options={{ title: "Kelola Quiz", headerTintColor: Colors.primary }} />
              <Stack.Screen name="lembaga-form" options={{ title: "Form Lembaga", headerTintColor: Colors.primary }} />
              <Stack.Screen name="user-detail" options={{ title: "Detail Pengguna", headerTintColor: Colors.primary }} />
              <Stack.Screen name="hadis" options={{ headerShown: false }} />
              <Stack.Screen name="doa" options={{ headerShown: false }} />
            </Stack>
          </View>
        </View>
      </AuthProvider>
    </Providers>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#E0E0E0" : Colors.background,
  },
  contentContainer: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? WEB_MAX_WIDTH : "100%",
    alignSelf: "center",
    backgroundColor: Colors.background,
    ...(Platform.OS === "web"
      ? {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 10,
          marginVertical: 0,
          borderRadius: 0,
          overflow: "hidden",
        }
      : {}),
  },
});
