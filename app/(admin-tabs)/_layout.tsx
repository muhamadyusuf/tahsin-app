import { GlassTabBarBackground } from "@/components/GlassTabBarBackground";
import { useAuthContext } from "@/lib/auth-context";
import { Colors } from "@/lib/constants";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const { isLoading, isAuthenticated, isAdmin, role } = useAuthContext();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isAdmin) {
    return <Redirect href="/pilih-role" />;
  }

  // administrator manages the whole app; admin_pengajian (LKM) only manages
  // their own lembaga — different tab sets rather than shared screens with
  // hidden buttons, so an LKM admin never even lands on a global-scope screen.
  const isLembaga = role === "admin_pengajian";
  const hideTab = (visible: boolean) => (visible ? undefined : null);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.primaryDark,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "600",
        },
        tabBarBackground: () => <GlassTabBarBackground />,
        tabBarStyle: {
          position: "absolute",
          bottom: 10 + insets.bottom,
          left: 16,
          right: 16,
          height: 50,
          borderRadius: 30,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          borderTopColor: "transparent",
          paddingBottom: 0,
          paddingHorizontal: 0,
          ...(Platform.OS === "web"
            ? { maxWidth: 468, marginHorizontal: "auto" }
            : {}),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 8,
        },
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.textLight,
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          // Ditampilkan untuk administrator maupun admin_pengajian. Isi
          // dashboard menyesuaikan role (lihat dashboard.tsx): administrator
          // melihat data global, admin_pengajian hanya lembaganya sendiri.
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="anggota"
        options={{
          title: "Anggota",
          href: hideTab(isLembaga),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="users" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pengguna"
        options={{
          title: "Pengguna",
          href: hideTab(!isLembaga),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="users" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="kelas"
        options={{
          title: "Kelas",
          href: hideTab(isLembaga),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="graduation-cap" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="materi"
        options={{
          title: "Materi",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="book" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="lkm-saya"
        options={{
          title: "LKM Saya",
          href: hideTab(isLembaga),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="institution" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="lembaga"
        options={{
          title: "Lembaga",
          href: hideTab(!isLembaga),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="institution" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="monitoring"
        options={{
          title: "Monitoring",
          href: hideTab(!isLembaga),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="bar-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sub-bab"
        options={{
          title: "Sub-bab",
          href: hideTab(!isLembaga),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="sitemap" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ceramah"
        options={{
          title: "Ceramah",
          href: hideTab(!isLembaga),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="youtube-play" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
