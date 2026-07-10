import React, { useEffect } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";
export default function LkmSayaScreen() {
  const router = useRouter();
  const { userData } = useAuthContext();

  const lembaga = useQuery(
    api.adminPengajian.getByUserId,
    userData?._id ? { userId: userData._id } : "skip"
  );

  useEffect(() => {
    if (lembaga) {
      router.replace({ pathname: "/lembaga-form", params: { id: lembaga._id } });
    } else if (lembaga === null && userData?._id) {
      router.replace({ pathname: "/lembaga-form", params: { userId: userData._id } });
    }
  }, [lembaga, userData?._id, router]);

  return (
    <View style={st.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={st.text}>Membuka profil lembaga...</Text>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  text: { color: Colors.textSecondary, fontSize: 13 },
});
