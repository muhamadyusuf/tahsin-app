import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors, APP_VERSION } from "@/lib/constants";

export default function PengaturanScreen() {
  const [notifikasi, setNotifikasi] = useState(true);
  const [tilawahReminder, setTilawahReminder] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleClearCache = () => {
    Alert.alert(
      "Hapus Cache",
      "Apakah Anda yakin ingin menghapus cache aplikasi?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: () => {
            Alert.alert("Berhasil", "Cache berhasil dihapus");
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Notifikasi */}
      <Text style={styles.sectionLabel}>Notifikasi</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <FontAwesome name="bell" size={18} color={Colors.primary} />
            <Text style={styles.settingText}>Notifikasi</Text>
          </View>
          <Switch
            value={notifikasi}
            onValueChange={setNotifikasi}
            trackColor={{ true: Colors.primaryLight, false: Colors.border }}
            thumbColor={notifikasi ? Colors.primary : "#ccc"}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <FontAwesome name="clock-o" size={18} color={Colors.primary} />
            <Text style={styles.settingText}>Pengingat Tilawah</Text>
          </View>
          <Switch
            value={tilawahReminder}
            onValueChange={setTilawahReminder}
            trackColor={{ true: Colors.primaryLight, false: Colors.border }}
            thumbColor={tilawahReminder ? Colors.primary : "#ccc"}
          />
        </View>
      </View>

      {/* Tampilan */}
      <Text style={styles.sectionLabel}>Tampilan</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <FontAwesome name="moon-o" size={18} color={Colors.primary} />
            <Text style={styles.settingText}>Mode Gelap</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={(val) => {
              setDarkMode(val);
              Alert.alert("Info", "Fitur Mode Gelap akan segera tersedia");
              setDarkMode(false);
            }}
            trackColor={{ true: Colors.primaryLight, false: Colors.border }}
            thumbColor={darkMode ? Colors.primary : "#ccc"}
          />
        </View>
      </View>

      {/* Data */}
      <Text style={styles.sectionLabel}>Data</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.settingRow} onPress={handleClearCache}>
          <View style={styles.settingInfo}>
            <FontAwesome name="trash-o" size={18} color={Colors.error} />
            <Text style={styles.settingText}>Hapus Cache</Text>
          </View>
          <FontAwesome
            name="chevron-right"
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Tentang */}
      <Text style={styles.sectionLabel}>Tentang</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <FontAwesome name="info-circle" size={18} color={Colors.primary} />
            <Text style={styles.settingText}>Versi Aplikasi</Text>
          </View>
          <Text style={styles.versionText}>v{APP_VERSION}</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() =>
            Linking.openURL("https://tahsin.singkat.in")
          }
        >
          <View style={styles.settingInfo}>
            <FontAwesome name="globe" size={18} color={Colors.primary} />
            <Text style={styles.settingText}>Website</Text>
          </View>
          <FontAwesome
            name="external-link"
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingText: {
    fontSize: 15,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  versionText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
