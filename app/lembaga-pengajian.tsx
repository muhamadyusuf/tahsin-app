import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

export default function LembagaPengajianScreen() {
  const { userData } = useAuthContext();

  // Fetch all available lembaga pengajian
  const lembagaList = useQuery(api.adminPengajian.listAll);

  // Fetch user's current lembaga if santri has one
  const currentLembaga = useQuery(
    api.adminPengajian.getById,
    userData?.adminPengajianId
      ? { id: userData.adminPengajianId }
      : "skip"
  );

  if (lembagaList === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat data lembaga...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Current lembaga */}
      {currentLembaga ? (
        <View style={styles.currentCard}>
          <View style={styles.currentBadge}>
            <FontAwesome name="check-circle" size={14} color={Colors.primary} />
            <Text style={styles.currentBadgeText}>Lembaga Anda</Text>
          </View>
          <Text style={styles.currentName}>{currentLembaga.namaLembaga}</Text>
          {currentLembaga.alamat && (
            <Text style={styles.currentAddr}>{currentLembaga.alamat}</Text>
          )}
          <View style={styles.locationRow}>
            <FontAwesome name="map-marker" size={14} color={Colors.textSecondary} />
            <Text style={styles.locationText}>
              {currentLembaga.kota}, {currentLembaga.provinsi}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <FontAwesome name="building-o" size={32} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Belum terdaftar di lembaga</Text>
          <Text style={styles.emptyDesc}>
            Hubungi admin lembaga pengajian Anda untuk didaftarkan
          </Text>
        </View>
      )}

      {/* All lembaga list */}
      <Text style={styles.sectionTitle}>Daftar Lembaga Pengajian</Text>

      {lembagaList.length === 0 ? (
        <View style={styles.emptyList}>
          <Text style={styles.emptyListText}>Belum ada lembaga terdaftar</Text>
        </View>
      ) : (
        <FlatList
          data={lembagaList}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.lembagaCard,
                item._id === userData?.adminPengajianId && styles.lembagaActive,
              ]}
            >
              <View style={styles.lembagaIcon}>
                <FontAwesome name="building" size={20} color={Colors.primary} />
              </View>
              <View style={styles.lembagaInfo}>
                <Text style={styles.lembagaName}>{item.namaLembaga}</Text>
                <View style={styles.locationRow}>
                  <FontAwesome
                    name="map-marker"
                    size={12}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.lembagaLocation}>
                    {item.kota}, {item.provinsi}
                  </Text>
                </View>
              </View>
              {item._id === userData?.adminPengajianId && (
                <FontAwesome
                  name="check-circle"
                  size={20}
                  color={Colors.primary}
                />
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  currentCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  currentName: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 4,
  },
  currentAddr: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 12,
  },
  emptyList: {
    padding: 20,
    alignItems: "center",
  },
  emptyListText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  lembagaCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  lembagaActive: {
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: "#F1F8E9",
  },
  lembagaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  lembagaInfo: {
    flex: 1,
    gap: 4,
  },
  lembagaName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  lembagaLocation: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
