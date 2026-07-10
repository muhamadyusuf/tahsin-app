import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";
import KelasAdminPanel from "@/components/KelasAdminPanel";
import FontAwesome from "@expo/vector-icons/FontAwesome";

export default function KelasTabScreen() {
  const { userData } = useAuthContext();

  const lembaga = useQuery(
    api.adminPengajian.getByUserId,
    userData?._id ? { userId: userData._id } : "skip"
  );

  if (lembaga === undefined) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!lembaga) {
    return (
      <View style={st.center}>
        <FontAwesome name="institution" size={32} color={Colors.border} />
        <Text style={st.emptyText}>Profil lembaga belum dibuat</Text>
      </View>
    );
  }

  return <KelasAdminPanel adminPengajianId={lembaga._id} />;
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },
});
