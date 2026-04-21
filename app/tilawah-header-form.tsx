import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";

import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";

export default function TilawahHeaderFormScreen() {
  const config = useQuery(api.appConfig.getPublicConfig, {});
  const upsert = useMutation(api.appConfig.upsertTilawahHeaderImage);

  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  useEffect(() => {
    if (config?.tilawahHeaderImageUrl !== undefined) {
      setUrl(config.tilawahHeaderImageUrl ?? "");
    }
  }, [config?.tilawahHeaderImageUrl]);

  const handlePickImage = async () => {
    setPickingImage(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Izin Diperlukan", "Izinkan akses galeri agar bisa upload gambar header.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.6,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const imageValue = asset.base64
        ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
        : asset.uri;

      if (asset.fileSize && asset.fileSize > 4 * 1024 * 1024) {
        Alert.alert(
          "Ukuran Gambar Besar",
          "Disarankan pilih gambar di bawah 4MB agar performa aplikasi tetap baik."
        );
      }

      setUrl(imageValue);
    } catch {
      Alert.alert("Error", "Gagal memilih gambar dari galeri.");
    } finally {
      setPickingImage(false);
    }
  };

  const handleSave = async () => {
    const trimmed = url.trim();
    const isHttpUrl = /^https?:\/\//i.test(trimmed);
    const isDataImage = /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(trimmed);
    if (trimmed.length > 0 && !isHttpUrl && !isDataImage) {
      Alert.alert(
        "Format Gambar Tidak Valid",
        "Gunakan URL gambar http/https atau pilih gambar langsung dari perangkat."
      );
      return;
    }

    setSaving(true);
    try {
      await upsert({
        tilawahHeaderImageUrl: trimmed.length > 0 ? trimmed : undefined,
      });
      Alert.alert("Berhasil", "Header Tilawah berhasil diperbarui.");
    } catch {
      Alert.alert("Error", "Gagal menyimpan konfigurasi header.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.heading}>Header Tilawah</Text>
      <Text style={st.subheading}>
        Atur gambar background header Tilawah agar tampil seperti banner aplikasi.
      </Text>

      <Pressable
        style={({ pressed }) => [
          st.pickBtn,
          pressed && { opacity: 0.85 },
          pickingImage && { opacity: 0.55 },
        ]}
        onPress={handlePickImage}
        disabled={pickingImage || saving || config === undefined}
      >
        {pickingImage ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <FontAwesome name="photo" size={16} color="#fff" />
            <Text style={st.pickText}>Upload Dari Perangkat</Text>
          </>
        )}
      </Pressable>

      <Text style={st.label}>URL Gambar Header</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://example.com/header-tilawah.jpg"
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        style={st.input}
      />

      <View style={st.previewCard}>
        <View style={st.previewHeader}>
          <FontAwesome name="image" size={14} color={Colors.primary} />
          <Text style={st.previewTitle}>Preview</Text>
        </View>
        {url.trim().length > 0 ? (
          <Image source={{ uri: url.trim() }} style={st.previewImage} resizeMode="cover" />
        ) : (
          <View style={st.previewEmpty}>
            <Text style={st.previewEmptyText}>Belum ada gambar. Header akan pakai warna hijau default.</Text>
          </View>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          st.saveBtn,
          pressed && { opacity: 0.85 },
          saving && { opacity: 0.55 },
        ]}
        onPress={handleSave}
        disabled={saving || config === undefined}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <FontAwesome name="check" size={16} color="#fff" />
            <Text style={st.saveText}>Simpan Konfigurasi</Text>
          </>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [st.resetBtn, pressed && { opacity: 0.85 }]}
        onPress={() => setUrl("")}
      >
        <FontAwesome name="eraser" size={14} color={Colors.textSecondary} />
        <Text style={st.resetText}>Kosongkan URL</Text>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: "800", color: Colors.text },
  subheading: {
    marginTop: 6,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 14,
  },
  pickBtn: {
    marginTop: 2,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  pickText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
  },
  previewCard: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  previewTitle: { fontSize: 13, fontWeight: "700", color: Colors.text },
  previewImage: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    backgroundColor: "#ECEFF1",
  },
  previewEmpty: {
    height: 110,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  previewEmptyText: {
    textAlign: "center",
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  saveBtn: {
    marginTop: 18,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  resetBtn: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resetText: { color: Colors.textSecondary, fontWeight: "600", fontSize: 13 },
});
