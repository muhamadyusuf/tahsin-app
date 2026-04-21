import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

export default function LembagaFormScreen() {
  const { id, userId } = useLocalSearchParams<{ id?: string; userId?: string }>();
  const router = useRouter();
  const { userData } = useAuthContext();
  const isEdit = !!id;

  const existing = useQuery(
    api.adminPengajian.getById,
    id ? { id: id as Id<"admin_pengajian"> } : "skip"
  );
  const createLembaga = useMutation(api.adminPengajian.create);
  const updateLembaga = useMutation(api.adminPengajian.update);

  const [namaLembaga, setNamaLembaga] = useState("");
  const [alamat, setAlamat] = useState("");
  const [kota, setKota] = useState("");
  const [provinsi, setProvinsi] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existing) {
      setNamaLembaga(existing.namaLembaga);
      setAlamat(existing.alamat ?? "");
      setKota(existing.kota);
      setProvinsi(existing.provinsi);
      setIsActive(existing.isActive);
    }
  }, [existing]);

  const handleSubmit = async () => {
    if (!namaLembaga.trim() || !kota.trim() || !provinsi.trim()) {
      Alert.alert("Error", "Nama lembaga, kota, dan provinsi wajib diisi.");
      return;
    }
    if (!userData) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateLembaga({
          id: id as Id<"admin_pengajian">,
          namaLembaga: namaLembaga.trim(),
          alamat: alamat.trim() || undefined,
          kota: kota.trim(),
          provinsi: provinsi.trim(),
          isActive,
        });
        Alert.alert("Berhasil", "Lembaga berhasil diperbarui.");
      } else {
        const targetUserId = (userId as Id<"users"> | undefined) ?? userData._id;
        await createLembaga({
          userId: targetUserId,
          namaLembaga: namaLembaga.trim(),
          alamat: alamat.trim() || undefined,
          kota: kota.trim(),
          provinsi: provinsi.trim(),
        });
        Alert.alert("Berhasil", "Lembaga berhasil ditambahkan.");
      }
      router.back();
    } catch {
      Alert.alert("Error", "Gagal menyimpan data lembaga.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isEdit && !existing) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={st.heading}>
        {isEdit ? "Edit Lembaga" : "Tambah Lembaga Baru"}
      </Text>

      <Text style={st.label}>Nama Lembaga *</Text>
      <TextInput
        style={st.input}
        value={namaLembaga}
        onChangeText={setNamaLembaga}
        placeholder="Nama lembaga pengajian"
        placeholderTextColor={Colors.textSecondary}
      />

      <Text style={st.label}>Alamat</Text>
      <TextInput
        style={[st.input, { height: 70, textAlignVertical: "top" }]}
        value={alamat}
        onChangeText={setAlamat}
        placeholder="Alamat lengkap (opsional)"
        placeholderTextColor={Colors.textSecondary}
        multiline
      />

      <Text style={st.label}>Kota *</Text>
      <TextInput
        style={st.input}
        value={kota}
        onChangeText={setKota}
        placeholder="Nama kota"
        placeholderTextColor={Colors.textSecondary}
      />

      <Text style={st.label}>Provinsi *</Text>
      <TextInput
        style={st.input}
        value={provinsi}
        onChangeText={setProvinsi}
        placeholder="Nama provinsi"
        placeholderTextColor={Colors.textSecondary}
      />

      {isEdit && (
        <View style={st.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Status Aktif</Text>
            <Text style={st.switchHint}>
              {isActive ? "Lembaga aktif" : "Lembaga nonaktif"}
            </Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: "#ddd", true: Colors.primaryLight }}
            thumbColor={isActive ? Colors.primary : "#f4f3f4"}
          />
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          st.submitBtn,
          pressed && { opacity: 0.85 },
          submitting && { opacity: 0.5 },
        ]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <FontAwesome name="check" size={16} color="#fff" />
            <Text style={st.submitBtnText}>
              {isEdit ? "Simpan Perubahan" : "Tambah Lembaga"}
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  submitBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 28,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
