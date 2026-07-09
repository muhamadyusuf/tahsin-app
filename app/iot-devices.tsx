import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
  Share,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Constants from "expo-constants";
import ConfirmModal from "@/components/ConfirmModal";

function getSiteUrl(): string {
  const url =
    (process.env.EXPO_PUBLIC_CONVEX_SITE_URL as string | undefined) ??
    (Constants.expoConfig?.extra?.convexSiteUrl as string | undefined) ??
    "";
  return url;
}

export default function IotDevicesScreen() {
  const { userData } = useAuthContext();
  const devices = useQuery(
    api.iotDevices.listDevices,
    userData?._id ? { userId: userData._id } : "skip"
  );
  const registerDevice = useMutation(api.iotDevices.registerDevice);
  const removeDevice = useMutation(api.iotDevices.removeDevice);
  const setDeviceActive = useMutation(api.iotDevices.setDeviceActive);

  const [deviceName, setDeviceName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [newDevice, setNewDevice] = useState<{ deviceName: string; apiKey: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: any; name: string } | null>(null);

  const siteUrl = getSiteUrl();

  const handleRegister = async () => {
    if (!userData?._id) return;
    if (!deviceName.trim()) {
      Alert.alert("Peringatan", "Masukkan nama perangkat terlebih dahulu.");
      return;
    }
    setRegistering(true);
    try {
      const device = await registerDevice({
        userId: userData._id,
        deviceName: deviceName.trim(),
      });
      setDeviceName("");
      if (device) {
        setNewDevice({ deviceName: device.deviceName, apiKey: device.apiKey });
      }
    } catch {
      Alert.alert("Gagal", "Tidak bisa mendaftarkan perangkat. Coba lagi.");
    } finally {
      setRegistering(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeDevice({ id: deleteTarget.id });
    } catch {
      Alert.alert("Gagal", "Tidak bisa menghapus perangkat.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const shareApiKey = async (apiKey: string) => {
    try {
      await Share.share({ message: apiKey });
    } catch {}
  };

  if (!userData) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Register form */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Sambungkan Perangkat IoT</Text>
          <Text style={st.cardSub}>
            Daftarkan perangkat untuk sinkronisasi dua arah: perangkat dapat
            melaporkan halaman yang dibaca, dan membaca posisi bacaan
            terakhir dari aplikasi.
          </Text>
          <TextInput
            style={st.input}
            placeholder="Nama perangkat, cth: Meja Belajar"
            placeholderTextColor={Colors.textSecondary}
            value={deviceName}
            onChangeText={setDeviceName}
          />
          <TouchableOpacity
            style={[st.registerBtn, registering && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={registering}
          >
            {registering ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <FontAwesome name="plus-circle" size={16} color="#fff" />
                <Text style={st.registerBtnText}>Daftarkan Perangkat</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Device list */}
        <Text style={st.sectionLabel}>Perangkat Terhubung</Text>
        {devices === undefined ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
        ) : devices.length === 0 ? (
          <View style={st.emptyBox}>
            <FontAwesome name="microchip" size={36} color={Colors.textSecondary} />
            <Text style={st.emptyText}>Belum ada perangkat terhubung.</Text>
          </View>
        ) : (
          devices.map((d) => (
            <View key={d._id} style={st.deviceCard}>
              <View style={st.deviceRow}>
                <View style={st.deviceIcon}>
                  <FontAwesome name="microchip" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.deviceName}>{d.deviceName}</Text>
                  <Text style={st.deviceMeta}>
                    {d.isActive ? "Aktif" : "Nonaktif"}
                    {d.lastSeenAt ? ` · terakhir terhubung ${new Date(d.lastSeenAt).toLocaleString("id-ID")}` : " · belum pernah terhubung"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDeviceActive({ id: d._id, isActive: !d.isActive })}
                  style={({ pressed }) => [st.iconBtn, pressed && { opacity: 0.5 }]}
                >
                  <FontAwesome
                    name={d.isActive ? "toggle-on" : "toggle-off"}
                    size={22}
                    color={d.isActive ? Colors.primary : Colors.textSecondary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setDeleteTarget({ id: d._id, name: d.deviceName })}
                  style={({ pressed }) => [st.iconBtn, pressed && { opacity: 0.5 }]}
                >
                  <FontAwesome name="trash-o" size={18} color="#C62828" />
                </Pressable>
              </View>
              <View style={st.apiKeyRow}>
                <Text style={st.apiKeyText} numberOfLines={1}>{d.apiKey}</Text>
                <Pressable onPress={() => shareApiKey(d.apiKey)} style={({ pressed }) => [st.iconBtn, pressed && { opacity: 0.5 }]}>
                  <FontAwesome name="share-square-o" size={16} color={Colors.primary} />
                </Pressable>
              </View>
            </View>
          ))
        )}

        {/* API docs */}
        <Text style={st.sectionLabel}>Dokumentasi API Perangkat</Text>
        <View style={st.card}>
          <Text style={st.docLabel}>Lapor halaman dibaca (device → app)</Text>
          <Text style={st.docCode}>
            POST {siteUrl || "<EXPO_PUBLIC_CONVEX_SITE_URL>"}/iot/page-read{"\n"}
            Body: {"{"} "apiKey": "...", "page": 595 {"}"}
          </Text>
          <Text style={[st.docLabel, { marginTop: 14 }]}>Ambil posisi bacaan terakhir (app → device)</Text>
          <Text style={st.docCode}>
            GET {siteUrl || "<EXPO_PUBLIC_CONVEX_SITE_URL>"}/iot/position?apiKey=...
          </Text>
        </View>
      </ScrollView>

      {/* New API key modal */}
      <Modal visible={newDevice !== null} transparent animationType="fade" onRequestClose={() => setNewDevice(null)}>
        <Pressable style={st.overlay} onPress={() => setNewDevice(null)}>
          <Pressable style={st.modalCard} onPress={() => {}}>
            <FontAwesome name="check-circle" size={32} color={Colors.primary} style={{ alignSelf: "center", marginBottom: 8 }} />
            <Text style={st.modalTitle}>Perangkat "{newDevice?.deviceName}" terdaftar</Text>
            <Text style={st.modalSub}>
              Simpan API Key ini di perangkat IoT Anda. Kunci ini hanya perlu
              disalin sekali.
            </Text>
            <View style={st.apiKeyBox}>
              <Text style={st.apiKeyBoxText} selectable>{newDevice?.apiKey}</Text>
            </View>
            <TouchableOpacity
              style={st.copyBtn}
              onPress={() => newDevice && shareApiKey(newDevice.apiKey)}
            >
              <FontAwesome name="share-square-o" size={14} color="#fff" />
              <Text style={st.copyBtnText}>Bagikan API Key</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.doneBtn} onPress={() => setNewDevice(null)}>
              <Text style={st.doneBtnText}>Selesai</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Hapus Perangkat"
        message={`Yakin ingin memutus perangkat "${deleteTarget?.name}"? Perangkat tidak akan bisa mengirim data lagi sampai didaftarkan ulang.`}
        confirmText="Hapus"
        type="danger"
        icon="trash"
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: "bold", color: Colors.text, marginBottom: 6 },
  cardSub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 14 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
  },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  registerBtnText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  emptyBox: { alignItems: "center", paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  deviceCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  deviceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  deviceIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  deviceName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  deviceMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  iconBtn: { padding: 8 },
  apiKeyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  apiKeyText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  docLabel: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 6 },
  docCode: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    lineHeight: 18,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 22,
    width: "100%",
    maxWidth: 380,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: Colors.text, textAlign: "center", marginBottom: 6 },
  modalSub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", marginBottom: 14, lineHeight: 18 },
  apiKeyBox: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  apiKeyBoxText: {
    fontSize: 13,
    color: Colors.text,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    textAlign: "center",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 10,
  },
  copyBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  doneBtn: { alignItems: "center", paddingVertical: 8 },
  doneBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
});
