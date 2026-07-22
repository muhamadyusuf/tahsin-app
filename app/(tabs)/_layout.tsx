import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { ActivityIndicator, Image, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassTabBarBackground } from "@/components/GlassTabBarBackground";
import { useAuthContext } from "@/lib/auth-context";
import { Colors } from "@/lib/constants";

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -3 }} {...props} />;
}

function ProfilTabBarIcon({
  avatarUrl,
  color,
}: {
  avatarUrl?: string;
  color: string;
}) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          marginBottom: -3,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
    );
  }
  return (
    <FontAwesome
      name="user"
      size={22}
      style={{ marginBottom: -3 }}
      color={color}
    />
  );
}

export default function TabLayout() {
  const { isLoading, isAuthenticated, isAdmin, userData } = useAuthContext();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isAdmin) {
    return <Redirect href="/(admin-tabs)/dashboard" />;
  }

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
        name="tilawah"
        options={{
          title: "Tilawah",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tarbiyah"
        options={{
          title: "Tarbiyah",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="graduation-cap" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="talaqi"
        options={{
          title: "Talaqi",
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => (
            <ProfilTabBarIcon avatarUrl={userData?.avatarUrl} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
