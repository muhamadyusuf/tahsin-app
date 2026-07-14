import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";
import { LembagaForm } from "@/app/lembaga-form";

// "LKM Saya" — profil lembaga milik admin_pengajian. Form disematkan langsung di
// dalam tab (bukan redirect ke rute standalone) agar tab bar bawah tetap tampil.
export default function LkmSayaScreen() {
  const { userData } = useAuthContext();

  const lembaga = useQuery(
    api.adminPengajian.getByUserId,
    userData?._id ? { userId: userData._id } : "skip"
  );

  if (lembaga === undefined || !userData?._id) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={st.text}>Membuka profil lembaga...</Text>
      </View>
    );
  }

  // Sudah punya lembaga → mode edit; belum ada → mode buat baru untuk user ini.
  return lembaga ? (
    <LembagaForm id={lembaga._id} />
  ) : (
    <LembagaForm userId={userData._id} />
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  text: { color: Colors.textSecondary, fontSize: 13 },
});
