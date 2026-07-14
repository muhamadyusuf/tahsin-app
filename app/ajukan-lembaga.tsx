import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";
import WilayahPickerModal from "@/components/WilayahPickerModal";
import LocationMapPicker from "@/components/LocationMapPicker";

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ComponentProps<typeof FontAwesome>["name"] }
> = {
  pending: { label: "Menunggu Persetujuan", color: "#F57C00", bg: "#FFF3E0", icon: "clock-o" },
  approved: { label: "Disetujui", color: "#2E7D32", bg: "#E8F5E9", icon: "check-circle" },
  rejected: { label: "Ditolak", color: "#C62828", bg: "#FFEBEE", icon: "times-circle" },
};

export default function AjukanLembagaScreen() {
  const router = useRouter();
  const { userData } = useAuthContext();

  const myRequests = useQuery(
    api.adminPengajianRequest.getMine,
    userData?._id ? { userId: userData._id } : "skip"
  );
  const ownLembaga = useQuery(
    api.adminPengajian.getByUserId,
    userData?._id ? { userId: userData._id } : "skip"
  );
  const createRequest = useMutation(api.adminPengajianRequest.create);

  const [namaLembaga, setNamaLembaga] = useState("");
  const [alamat, setAlamat] = useState("");
  const [kota, setKota] = useState("");
  const [provinsi, setProvinsi] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [fotoUrl, setFotoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [wilayahModalVisible, setWilayahModalVisible] = useState(false);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);

  const pendingRequest = myRequests?.find((r) => r.status === "pending");
  const latestRequest = myRequests
    ? [...myRequests].sort(
        (a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0)
      )[0]
    : undefined;

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      if (Platform.OS === "web") {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          Alert.alert("Error", "Geolocation tidak didukung browser ini.");
          return;
        }
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLatitude(pos.coords.latitude);
              setLongitude(pos.coords.longitude);
              resolve();
            },
            () => {
              Alert.alert("Error", "Gagal mendapatkan lokasi.");
              resolve();
            },
            { enableHighAccuracy: false, timeout: 10000 }
          );
        });
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Izin Diperlukan", "Izinkan akses lokasi untuk deteksi otomatis.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(position.coords.latitude);
      setLongitude(position.coords.longitude);
    } catch {
      Alert.alert("Error", "Gagal mendeteksi lokasi.");
    } finally {
      setDetectingLocation(false);
    }
  };

  const handlePickImage = async () => {
    setPickingImage(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Izin Diperlukan", "Izinkan akses galeri agar bisa upload gambar lembaga.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const imageValue = asset.base64
        ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
        : asset.uri;
      setFotoUrl(imageValue);
    } catch {
      Alert.alert("Error", "Gagal memilih gambar dari galeri.");
    } finally {
      setPickingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!namaLembaga.trim() || !kota.trim() || !provinsi.trim()) {
      Alert.alert("Error", "Nama lembaga, kota, dan provinsi wajib diisi.");
      return;
    }
    if (!userData) return;

    setSubmitting(true);
    try {
      await createRequest({
        userId: userData._id,
        namaLembaga: namaLembaga.trim(),
        alamat: alamat.trim() || undefined,
        kota: kota.trim(),
        provinsi: provinsi.trim(),
        latitude,
        longitude,
        fotoUrl: fotoUrl.trim() || undefined,
      });
      Alert.alert(
        "Pengajuan Terkirim",
        "Pengajuan Anda menunggu persetujuan administrator."
      );
      router.back();
    } catch (error) {
      Alert.alert(
        "Gagal",
        error instanceof Error ? error.message : "Gagal mengirim pengajuan."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (myRequests === undefined || ownLembaga === undefined) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Sudah menjadi admin pengajian.
  if (ownLembaga) {
    return (
      <View style={st.center}>
        <FontAwesome name="check-circle" size={44} color={Colors.success} />
        <Text style={st.doneTitle}>Anda sudah menjadi Admin Pengajian</Text>
        <Text style={st.doneText}>Lembaga: {ownLembaga.namaLembaga}</Text>
        <Pressable style={st.doneBtn} onPress={() => router.back()}>
          <Text style={st.doneBtnText}>Kembali</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {latestRequest && (
        <View
          style={[
            st.statusBanner,
            { backgroundColor: STATUS_META[latestRequest.status].bg },
          ]}
        >
          <FontAwesome
            name={STATUS_META[latestRequest.status].icon}
            size={16}
            color={STATUS_META[latestRequest.status].color}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                st.statusTitle,
                { color: STATUS_META[latestRequest.status].color },
              ]}
            >
              Pengajuan {STATUS_META[latestRequest.status].label}
            </Text>
            <Text style={st.statusSub}>{latestRequest.namaLembaga}</Text>
            {latestRequest.status === "rejected" && latestRequest.reviewNote && (
              <Text style={st.statusNote}>
                Catatan: {latestRequest.reviewNote}
              </Text>
            )}
          </View>
        </View>
      )}

      {pendingRequest ? (
        <View style={st.infoBox}>
          <Text style={st.infoText}>
            Pengajuan Anda sedang ditinjau administrator. Anda dapat mengajukan
            kembali setelah pengajuan ini diproses.
          </Text>
        </View>
      ) : (
        <>
          <Text style={st.heading}>Ajukan Jadi Admin Pengajian</Text>
          <Text style={st.subheading}>
            Lengkapi data lembaga. Setelah disetujui administrator, Anda dapat
            beralih ke mode Admin Pengajian lewat "Pilih Role Aktif".
          </Text>

          <Text style={st.label}>Foto Lembaga</Text>
          <Pressable
            style={({ pressed }) => [st.pickImageBtn, pressed && { opacity: 0.85 }]}
            onPress={handlePickImage}
            disabled={pickingImage}
          >
            {pickingImage ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="photo" size={16} color="#fff" />
                <Text style={st.pickImageText}>Upload Dari Perangkat</Text>
              </>
            )}
          </Pressable>
          {fotoUrl.trim().length > 0 ? (
            <View style={st.imagePreviewWrap}>
              <Image source={{ uri: fotoUrl.trim() }} style={st.imagePreview} resizeMode="cover" />
              <Pressable style={st.removeImageBtn} onPress={() => setFotoUrl("")}>
                <FontAwesome name="trash" size={12} color={Colors.error} />
                <Text style={st.removeImageText}>Hapus Foto</Text>
              </Pressable>
            </View>
          ) : null}

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

          <Text style={st.label}>Provinsi & Kota/Kabupaten *</Text>
          <Pressable style={st.dropdownBtn} onPress={() => setWilayahModalVisible(true)}>
            <FontAwesome name="map-marker" size={14} color={Colors.primary} />
            <Text style={st.dropdownText}>
              {kota && provinsi ? `${kota}, ${provinsi}` : "Pilih provinsi & kota/kabupaten"}
            </Text>
            <FontAwesome name="chevron-down" size={12} color={Colors.textSecondary} />
          </Pressable>

          <Text style={st.label}>Titik Lokasi (Geotagging)</Text>
          <View style={st.locationRow}>
            <Pressable
              style={[st.locationBtn, detectingLocation && { opacity: 0.6 }]}
              onPress={handleDetectLocation}
              disabled={detectingLocation}
            >
              {detectingLocation ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <FontAwesome name="location-arrow" size={14} color={Colors.primary} />
              )}
              <Text style={st.locationBtnText}>Deteksi Lokasi Saya</Text>
            </Pressable>
            <Pressable style={st.locationBtn} onPress={() => setMapPickerVisible(true)}>
              <FontAwesome name="map" size={14} color={Colors.primary} />
              <Text style={st.locationBtnText}>Pilih di Peta</Text>
            </Pressable>
          </View>
          <Text style={st.coordHint}>
            {latitude !== undefined && longitude !== undefined
              ? `Koordinat: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
              : "Belum ada koordinat lokasi"}
          </Text>

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
                <FontAwesome name="paper-plane" size={16} color="#fff" />
                <Text style={st.submitBtnText}>Kirim Pengajuan</Text>
              </>
            )}
          </Pressable>
        </>
      )}

      <WilayahPickerModal
        visible={wilayahModalVisible}
        initialProvinsi={provinsi}
        onClose={() => setWilayahModalVisible(false)}
        onSelect={(selectedProvinsi, selectedKabkota) => {
          setProvinsi(selectedProvinsi);
          setKota(selectedKabkota);
        }}
      />

      <LocationMapPicker
        visible={mapPickerVisible}
        initialLatitude={latitude}
        initialLongitude={longitude}
        onClose={() => setMapPickerVisible(false)}
        onConfirm={(lat, lng) => {
          setLatitude(lat);
          setLongitude(lng);
          setMapPickerVisible(false);
        }}
      />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
  },

  heading: { fontSize: 20, fontWeight: "700", color: Colors.text, marginTop: 8 },
  subheading: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 6,
  },

  statusBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  statusTitle: { fontSize: 14, fontWeight: "700" },
  statusSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusNote: { fontSize: 12, color: Colors.error, marginTop: 4 },

  infoBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  doneTitle: { fontSize: 16, fontWeight: "700", color: Colors.text, marginTop: 6 },
  doneText: { fontSize: 13, color: Colors.textSecondary },
  doneBtn: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

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

  pickImageBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  pickImageText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  imagePreviewWrap: { marginTop: 10, gap: 8 },
  imagePreview: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    backgroundColor: "#ECEFF1",
  },
  removeImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  removeImageText: { color: Colors.error, fontSize: 12, fontWeight: "600" },

  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownText: { flex: 1, fontSize: 14, color: Colors.text },

  locationRow: { flexDirection: "row", gap: 10 },
  locationBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  locationBtnText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  coordHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 8 },

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
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
