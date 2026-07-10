import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import { getProvinsi, getKabKota } from "@/lib/sholat-api";

interface WilayahPickerModalProps {
  visible: boolean;
  initialProvinsi?: string;
  onClose: () => void;
  onSelect: (provinsi: string, kabkota: string) => void;
}

export default function WilayahPickerModal({
  visible,
  initialProvinsi,
  onClose,
  onSelect,
}: WilayahPickerModalProps) {
  const [mode, setMode] = useState<"provinsi" | "kabkota">("provinsi");
  const [provinsiList, setProvinsiList] = useState<string[]>([]);
  const [kabkotaList, setKabkotaList] = useState<string[]>([]);
  const [selectedProvinsi, setSelectedProvinsi] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMode("provinsi");
    setSelectedProvinsi(initialProvinsi ?? "");
    (async () => {
      setLoading(true);
      try {
        const list = await getProvinsi();
        setProvinsiList(list);
      } catch {
        setProvinsiList([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSelectProvinsi = async (provinsi: string) => {
    setSelectedProvinsi(provinsi);
    setMode("kabkota");
    setLoading(true);
    try {
      const list = await getKabKota(provinsi);
      setKabkotaList(list);
    } catch {
      setKabkotaList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectKabkota = (kabkota: string) => {
    onSelect(selectedProvinsi, kabkota);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.sheet}>
          {mode === "provinsi" ? (
            <>
              <View style={st.header}>
                <Text style={st.title}>Pilih Provinsi</Text>
                <TouchableOpacity style={st.closeBtn} onPress={onClose}>
                  <FontAwesome name="times" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {loading ? (
                <View style={st.loadingBox}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={st.loadingText}>Memuat provinsi...</Text>
                </View>
              ) : (
                <ScrollView style={st.scroll} showsVerticalScrollIndicator={false}>
                  {provinsiList.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={st.item}
                      onPress={() => handleSelectProvinsi(p)}
                    >
                      <Text style={st.itemText}>{p}</Text>
                      <FontAwesome name="chevron-right" size={12} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                  {provinsiList.length === 0 && (
                    <Text style={st.emptyText}>Gagal memuat daftar provinsi</Text>
                  )}
                </ScrollView>
              )}
            </>
          ) : (
            <>
              <View style={st.header}>
                <TouchableOpacity style={st.backBtn} onPress={() => setMode("provinsi")}>
                  <FontAwesome name="arrow-left" size={16} color={Colors.primary} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={st.title}>Pilih Kab/Kota</Text>
                  <Text style={st.subtitle}>{selectedProvinsi}</Text>
                </View>
                <TouchableOpacity style={st.closeBtn} onPress={onClose}>
                  <FontAwesome name="times" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {loading ? (
                <View style={st.loadingBox}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={st.loadingText}>Memuat kota...</Text>
                </View>
              ) : (
                <ScrollView style={st.scroll} showsVerticalScrollIndicator={false}>
                  {kabkotaList.map((k) => (
                    <TouchableOpacity
                      key={k}
                      style={st.item}
                      onPress={() => handleSelectKabkota(k)}
                    >
                      <Text style={st.itemText}>{k}</Text>
                      <FontAwesome name="chevron-right" size={12} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                  {kabkotaList.length === 0 && (
                    <Text style={st.emptyText}>Gagal memuat daftar kota</Text>
                  )}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: "85%",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: 4 },
  backBtn: { padding: 4 },
  loadingBox: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 13, color: Colors.textSecondary },
  scroll: { marginTop: 12, maxHeight: 380 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: Colors.backgroundLight,
  },
  itemText: { fontSize: 14, color: Colors.text, flex: 1 },
  emptyText: { textAlign: "center", fontSize: 13, color: Colors.textSecondary, paddingVertical: 20 },
});
