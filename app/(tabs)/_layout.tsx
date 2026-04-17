import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs, Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuthContext } from "@/lib/auth-context";
import { Colors } from "@/lib/constants";

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const { isLoading, isAuthenticated } = useAuthContext();

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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
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
          tabBarIcon: ({ color }) => <TabBarIcon name="book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tahsin"
        options={{
          title: "Tahsin",
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
        name="ulumul-quran"
        options={{
          title: "Ulumul Qur'an",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="lightbulb-o" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
