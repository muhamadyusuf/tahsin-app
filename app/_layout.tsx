import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { Providers } from "@/lib/providers";
import { AuthProvider } from "@/lib/auth-context";
import { Colors } from "@/lib/constants";

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
        </Stack>
      </AuthProvider>
    </Providers>
  );
}
