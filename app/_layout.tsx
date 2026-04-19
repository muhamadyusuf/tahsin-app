import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
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
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sso-callback" options={{ headerShown: false }} />
          <Stack.Screen name="surah/[surahNumber]" options={{ headerShown: true }} />
          <Stack.Screen name="mushaf" options={{ headerShown: false }} />
          <Stack.Screen name="edit-profil" options={{ title: "Edit Profil", headerTintColor: Colors.primary }} />
          <Stack.Screen name="lembaga-pengajian" options={{ title: "Lembaga Pengajian", headerTintColor: Colors.primary }} />
          <Stack.Screen name="statistik" options={{ title: "Statistik", headerTintColor: Colors.primary }} />
          <Stack.Screen name="pengaturan" options={{ title: "Pengaturan", headerTintColor: Colors.primary }} />
          <Stack.Screen name="bantuan" options={{ title: "Bantuan", headerTintColor: Colors.primary }} />
        </Stack>
      </AuthProvider>
    </Providers>
  );
}
