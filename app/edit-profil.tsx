import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

export default function EditProfilScreen() {
  const router = useRouter();
  const { userData } = useAuthContext();
  const updateProfile = useMutation(api.users.updateProfile);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userData) {
      setName(userData.name || "");
      setPhone(userData.phone || "");
      setLocation(userData.location || "");
    }
  }, [userData]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Nama tidak boleh kosong");
      return;
    }
    if (!userData?._id) return;

    try {
      setSaving(true);
      await updateProfile({
        userId: userData._id,
        name: name.trim(),
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
      });
      Alert.alert("Berhasil", "Profil berhasil diperbarui", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Gagal", err.message || "Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <FontAwesome name="user" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.email}>{userData?.email}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Nama Lengkap</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Masukkan nama lengkap"
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={styles.label}>Nomor Telepon</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Contoh: 08123456789"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Lokasi / Alamat</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={location}
            onChangeText={setLocation}
            placeholder="Kota atau alamat lengkap"
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome name="check" size={16} color="#fff" />
              <Text style={styles.saveButtonText}>Simpan Perubahan</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  email: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  form: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    textAlignVertical: "top",
    minHeight: 80,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
