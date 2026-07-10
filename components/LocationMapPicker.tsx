import React, { useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import { buildMapPickerHtml } from "@/lib/map-picker-html";

const DEFAULT_LAT = -2.5;
const DEFAULT_LNG = 118;

interface LocationMapPickerProps {
  visible: boolean;
  initialLatitude?: number;
  initialLongitude?: number;
  onClose: () => void;
  onConfirm: (latitude: number, longitude: number) => void;
}

export default function LocationMapPicker({
  visible,
  initialLatitude,
  initialLongitude,
  onClose,
  onConfirm,
}: LocationMapPickerProps) {
  const pickedRef = useRef({
    lat: initialLatitude ?? DEFAULT_LAT,
    lng: initialLongitude ?? DEFAULT_LNG,
  });
  const [pickedLabel, setPickedLabel] = useState(
    `${pickedRef.current.lat.toFixed(5)}, ${pickedRef.current.lng.toFixed(5)}`
  );

  const html = buildMapPickerHtml(
    initialLatitude ?? DEFAULT_LAT,
    initialLongitude ?? DEFAULT_LNG
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (typeof data.lat === "number" && typeof data.lng === "number") {
        pickedRef.current = { lat: data.lat, lng: data.lng };
        setPickedLabel(`${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`);
      }
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={st.container}>
        <View style={st.header}>
          <Pressable style={st.closeBtn} onPress={onClose}>
            <FontAwesome name="times" size={18} color={Colors.text} />
          </Pressable>
          <Text style={st.title}>Pilih Lokasi di Peta</Text>
          <View style={{ width: 32 }} />
        </View>

        <WebView
          key={`${initialLatitude}-${initialLongitude}`}
          source={{ html }}
          style={st.webview}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
        />

        <View style={st.footer}>
          <Text style={st.coordText}>{pickedLabel}</Text>
          <Pressable
            style={st.confirmBtn}
            onPress={() => onConfirm(pickedRef.current.lat, pickedRef.current.lng)}
          >
            <FontAwesome name="check" size={14} color="#fff" />
            <Text style={st.confirmText}>Gunakan Lokasi Ini</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: { width: 32, alignItems: "flex-start" },
  title: { fontSize: 16, fontWeight: "700", color: Colors.text },
  webview: { flex: 1 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  coordText: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  confirmBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
