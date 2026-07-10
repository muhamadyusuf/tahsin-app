import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery } from "convex/react";
import * as Location from "expo-location";

import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import WilayahPickerModal from "@/components/WilayahPickerModal";

type Coords = { latitude: number; longitude: number };

const getWebCoords = (): Promise<Coords> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });

export default function TalaqiLkmListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [wilayahModalVisible, setWilayahModalVisible] = useState(false);
  const [manualSearch, setManualSearch] = useState<{ provinsi: string; kota: string } | null>(
    null
  );

  const requestLocation = async () => {
    setLocLoading(true);
    setLocError(null);
    try {
      if (Platform.OS === "web") {
        const webCoords = await getWebCoords();
        setCoords(webCoords);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError("Izin lokasi diperlukan untuk mencari LKM terdekat");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setLocError("Gagal mendapatkan lokasi. Coba lagi.");
    } finally {
      setLocLoading(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const nearby = useQuery(
    api.lkmJoinRequest.listNearby,
    coords && !manualSearch
      ? { latitude: coords.latitude, longitude: coords.longitude }
      : "skip"
  );

  const manualResults = useQuery(
    api.adminPengajian.listByKota,
    manualSearch ? { kota: manualSearch.kota } : "skip"
  );

  const isLoading =
    !manualSearch &&
    (locLoading || (!!coords && nearby === undefined));

  const isManualLoading = !!manualSearch && manualResults === undefined;

  const results = manualSearch ? manualResults ?? [] : nearby ?? [];

  return (
    <View style={st.container}>
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <View style={st.headerRow}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={16} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>LKM Terdekat</Text>
            <Text style={st.headerSubtitle}>
              Pilih lembaga kursus mengaji untuk bergabung
            </Text>
          </View>
          <View style={st.headerIcon}>
            <FontAwesome name="map-marker" size={18} color="#fff" />
          </View>
        </View>
      </View>

      {locError && !manualSearch ? (
        <View style={st.center}>
          <FontAwesome name="exclamation-circle" size={36} color={Colors.error} />
          <Text style={st.errorText}>{locError}</Text>
          <Pressable style={st.retryBtn} onPress={requestLocation}>
            <Text style={st.retryText}>Coba Lagi</Text>
          </Pressable>
          <Pressable style={st.manualBtn} onPress={() => setWilayahModalVisible(true)}>
            <FontAwesome name="search" size={13} color={Colors.primary} />
            <Text style={st.manualBtnText}>Cari Manual (Provinsi & Kota)</Text>
          </Pressable>
        </View>
      ) : isLoading || isManualLoading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.loadingText}>
            {manualSearch ? "Mencari LKM..." : "Mencari LKM di sekitar Anda..."}
          </Text>
        </View>
      ) : (
        <>
          {manualSearch && (
            <View style={st.manualBanner}>
              <FontAwesome name="map-marker" size={13} color={Colors.primary} />
              <Text style={st.manualBannerText}>
                {manualSearch.kota}, {manualSearch.provinsi}
              </Text>
              <Pressable onPress={() => setWilayahModalVisible(true)}>
                <Text style={st.manualBannerChange}>Ganti</Text>
              </Pressable>
              {coords && !locError && (
                <Pressable onPress={() => setManualSearch(null)}>
                  <Text style={st.manualBannerChange}>Pakai Lokasi</Text>
                </Pressable>
              )}
            </View>
          )}
          <FlatList
            data={results}
            keyExtractor={(item) => item._id}
            contentContainerStyle={st.listContent}
            renderItem={({ item }) => {
              const distanceKm = (item as { distanceKm?: number }).distanceKm;
              return (
                <Pressable
                  style={({ pressed }) => [st.card, pressed && { opacity: 0.85 }]}
                  onPress={() =>
                    router.push({
                      pathname: "/talaqi-lkm/[adminPengajianId]",
                      params: { adminPengajianId: item._id },
                    })
                  }
                >
                  {item.fotoUrl ? (
                    <Image source={{ uri: item.fotoUrl }} style={st.cardIcon} resizeMode="cover" />
                  ) : (
                    <View style={st.cardIcon}>
                      <FontAwesome name="institution" size={20} color={Colors.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={st.cardTitle}>{item.namaLembaga}</Text>
                    <Text style={st.cardLoc}>
                      {item.kota}, {item.provinsi}
                    </Text>
                    {distanceKm !== undefined && (
                      <Text style={st.cardDistance}>
                        {distanceKm < 1
                          ? `${Math.round(distanceKm * 1000)} m`
                          : `${distanceKm.toFixed(1)} km`}{" "}
                        dari lokasi Anda
                      </Text>
                    )}
                  </View>
                  <FontAwesome name="chevron-right" size={14} color={Colors.textSecondary} />
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={st.center}>
                <FontAwesome name="institution" size={36} color={Colors.border} />
                <Text style={st.emptyText}>
                  {manualSearch
                    ? "Belum ada LKM terdaftar di kota ini"
                    : "Belum ada LKM terdaftar di sekitar lokasi Anda"}
                </Text>
              </View>
            }
          />
        </>
      )}

      <WilayahPickerModal
        visible={wilayahModalVisible}
        initialProvinsi={manualSearch?.provinsi}
        onClose={() => setWilayahModalVisible(false)}
        onSelect={(provinsi, kota) => {
          setManualSearch({ provinsi, kota });
          setWilayahModalVisible(false);
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  errorText: { color: Colors.text, fontSize: 14, textAlign: "center" },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
  emptyText: { color: Colors.textSecondary, fontSize: 14, textAlign: "center" },
  manualBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  manualBtnText: { color: Colors.primary, fontWeight: "700", fontSize: 13 },
  manualBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F1F8E9",
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  manualBannerText: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.text },
  manualBannerChange: { fontSize: 12, fontWeight: "700", color: Colors.primary, marginLeft: 10 },

  listContent: { padding: 16, paddingBottom: 100, gap: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: Colors.text },
  cardLoc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardDistance: { fontSize: 12, color: Colors.primary, fontWeight: "600", marginTop: 4 },
});
