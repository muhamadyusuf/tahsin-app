import { Tabs } from "expo-router";
import { Redirect } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

export default function TabsLayout() {
  const { isLoading, isAuthenticated, isAdmin } = useAuthContext();
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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: Colors.border,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerTitleStyle: { fontWeight: "700", color: Colors.text },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pengguna"
        options={{
          title: "Pengguna",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="users" size={size} color={color} />
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
        name="lembaga"
        options={{
          title: "Lembaga",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="institution" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="monitoring"
        options={{
          title: "Monitoring",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="bar-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sub-bab"
        options={{
          title: "Sub-bab",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="sitemap" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ceramah"
        options={{
          title: "Ceramah",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="youtube-play" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
