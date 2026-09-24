import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ConfirmModal from "@/components/ConfirmModal";
import { useAuthContext } from "@/lib/auth-context";
import { Colors } from "@/lib/constants";

// Laporan perangkap keamanan: siapa saja yang membuka halaman umpan
// (/wp-admin, /phpmyadmin, ...), lengkap dengan IP, lokasi, dan foto bila
// pengunjung mengizinkan. Data dibuat oleh convex/trap.ts + components/TrapPage.tsx.
// Hanya administrator — dijaga juga di server (trap.listHits).

type Filter = "semua" | "baru" | "foto" | "gps";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "baru", label: "Baru" },
  { key: "foto", label: "Ada foto" },
  { key: "gps", label: "Ada GPS" },
];

function mapsUrl(lat: number, lon: number) {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

function osmEmbedUrl(lat: number, lon: number) {
  const d = 0.005;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d},${lat - d},${lon + d},${lat + d}&layer=mapnik&marker=${lat},${lon}`;
}

function formatWhen(ms: number) {
  const diffMin = Math.round((Date.now() - ms) / 60000);
  const abs = new Date(ms).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (diffMin < 1) return `Baru saja · ${abs}`;
  if (diffMin < 60) return `${diffMin} mnt lalu · ${abs}`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} jam lalu · ${abs}`;
  return abs;
}

const PERMISSION_LABEL: Record<string, string> = {
  granted: "diizinkan",
  denied: "ditolak",
  unsupported: "tidak didukung",
  error: "gagal",
};

export default function AdminPerangkapScreen() {
  const { userData } = useAuthContext();
  const [filter, setFilter] = useState<Filter>("semua");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"trap_hits"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mapOpenId, setMapOpenId] = useState<string | null>(null);

  const hits = useQuery(api.trap.listHits, { limit: 200 });
  const setStatus = useMutation(api.trap.setStatus);
  const removeHit = useMutation(api.trap.remove);

  type Hit = NonNullable<typeof hits>[number];

  const ipCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of hits ?? []) map.set(h.ip, (map.get(h.ip) ?? 0) + 1);
    return map;
  }, [hits]);

  const filtered = useMemo(() => {
    const list = hits ?? [];
    switch (filter) {
      case "baru":
        return list.filter((h) => h.status === "baru");
      case "foto":
        return list.filter((h) => h.photoUrl);
      case "gps":
        return list.filter((h) => h.gps);
      default:
        return list;
    }
  }, [hits, filter]);

  const copyIp = async (h: Hit) => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(h.ip);
      } else {
        await Share.share({ message: h.ip });
      }
      setCopiedId(h._id);
      setTimeout(() => setCopiedId((cur) => (cur === h._id ? null : cur)), 1500);
    } catch {
      // dibatalkan pengguna / clipboard ditolak — abaikan
    }
  };

  if (userData && userData.role !== "administrator") {
    return (
      <View style={st.center}>
        <FontAwesome name="lock" size={32} color={Colors.border} />
        <Text style={st.emptyText}>Halaman ini hanya untuk administrator.</Text>
      </View>
    );
  }

  if (hits === undefined) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const total = hits.length;
  const uniqueIps = ipCounts.size;
  const withPhoto = hits.filter((h) => h.photoUrl).length;
  const withGps = hits.filter((h) => h.gps).length;
  const unseen = hits.filter((h) => h.status === "baru").length;

  const renderHit = ({ item: h }: { item: Hit }) => {
    const isNew = h.status === "baru";
    const geo = h.geoIp;
    const geoText = geo
      ? [geo.city, geo.region, geo.country].filter(Boolean).join(", ")
      : null;
    const mapPoint = h.gps
      ? { lat: h.gps.latitude, lon: h.gps.longitude, precise: true }
      : geo?.latitude !== undefined && geo?.longitude !== undefined
        ? { lat: geo.latitude, lon: geo.longitude, precise: false }
        : null;
    const sameIp = ipCounts.get(h.ip) ?? 1;
    const mapOpen = mapOpenId === h._id;

    return (
      <View style={[st.card, isNew && st.cardNew]}>
        {/* Baris judul */}
        <View style={st.rowBetween}>
          <Text style={st.path} numberOfLines={1}>
            {h.path}
          </Text>
          <View style={[st.tag, isNew ? st.tagNew : st.tagSeen]}>
            <Text style={[st.tagText, { color: isNew ? "#B45309" : "#2E7D32" }]}>
              {isNew ? "BARU" : "DITINJAU"}
            </Text>
          </View>
        </View>
        <Text style={st.when}>{formatWhen(h._creationTime)}</Text>

        {/* IP */}
        <View style={st.ipRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>ALAMAT IP</Text>
            <Text style={st.ip} selectable>
              {h.ip}
            </Text>
            {sameIp > 1 && (
              <Text style={st.hint}>{sameIp} kunjungan dari IP ini</Text>
            )}
          </View>
          <Pressable style={st.smallBtn} onPress={() => copyIp(h)}>
            <FontAwesome name={copiedId === h._id ? "check" : "copy"} size={12} color={Colors.primary} />
            <Text style={st.smallBtnText}>{copiedId === h._id ? "Tersalin" : "Salin"}</Text>
          </Pressable>
        </View>

        {/* Lokasi */}
        <View style={st.block}>
          <Text style={st.label}>LOKASI</Text>
          {h.gps ? (
            <Text style={st.value} selectable>
              GPS: {h.gps.latitude.toFixed(5)}, {h.gps.longitude.toFixed(5)}
              {h.gps.accuracy !== undefined ? ` (±${Math.round(h.gps.accuracy)} m)` : ""}
            </Text>
          ) : (
            <Text style={st.hint}>
              GPS: {h.gpsStatus ? PERMISSION_LABEL[h.gpsStatus] ?? h.gpsStatus : "belum diminta"}
            </Text>
          )}
          {geoText ? (
            <Text style={st.value}>
              Perkiraan dari IP: {geoText}
              {geo?.isp ? ` · ${geo.isp}` : ""}
            </Text>
          ) : (
            <Text style={st.hint}>Perkiraan dari IP: belum tersedia</Text>
          )}
          {mapPoint && (
            <View style={st.btnRow}>
              <Pressable
                style={st.smallBtn}
                onPress={() => Linking.openURL(mapsUrl(mapPoint.lat, mapPoint.lon))}
              >
                <FontAwesome name="map-marker" size={13} color={Colors.primary} />
                <Text style={st.smallBtnText}>
                  Buka peta {mapPoint.precise ? "" : "(perkiraan)"}
                </Text>
              </Pressable>
              {Platform.OS === "web" && (
                <Pressable
                  style={st.smallBtn}
                  onPress={() => setMapOpenId(mapOpen ? null : h._id)}
                >
                  <FontAwesome name={mapOpen ? "chevron-up" : "chevron-down"} size={11} color={Colors.primary} />
                  <Text style={st.smallBtnText}>{mapOpen ? "Tutup peta" : "Lihat di sini"}</Text>
                </Pressable>
              )}
            </View>
          )}
          {mapPoint && mapOpen && Platform.OS === "web" && (
            <View style={st.mapWrap}>
              {/* @ts-ignore – iframe valid di React Native Web */}
              <iframe
                src={osmEmbedUrl(mapPoint.lat, mapPoint.lon)}
                style={{ width: "100%", height: "100%", border: "none" }}
                title="Peta lokasi"
              />
            </View>
          )}
        </View>

        {/* Foto */}
        <View style={st.block}>
          <Text style={st.label}>FOTO</Text>
          {h.photoUrl ? (
            <Pressable onPress={() => setPhotoUrl(h.photoUrl)} style={st.photoWrap}>
              <Image source={{ uri: h.photoUrl }} style={st.photo} resizeMode="cover" />
              <View style={st.photoZoom}>
                <FontAwesome name="search-plus" size={12} color="#fff" />
              </View>
            </Pressable>
          ) : (
            <Text style={st.hint}>
              Kamera: {h.cameraStatus ? PERMISSION_LABEL[h.cameraStatus] ?? h.cameraStatus : "belum diminta"} — tidak ada foto
            </Text>
          )}
        </View>

        {/* Rincian teknis */}
        <View style={st.block}>
          <Text style={st.label}>RINCIAN</Text>
          {h.attemptedUsername && (
            <Text style={st.value}>
              Username dicoba: <Text style={st.mono}>{h.attemptedUsername}</Text>
            </Text>
          )}
          {h.userAgent && <Text style={st.hint}>{h.userAgent}</Text>}
          <Text style={st.hint}>
            {[h.language, h.timezone, h.screen].filter(Boolean).join(" · ") || "—"}
          </Text>
          {h.referrer ? <Text style={st.hint}>Referrer: {h.referrer}</Text> : null}
          {h.forwardedFor && h.forwardedFor !== h.ip ? (
            <Text style={st.hint}>X-Forwarded-For: {h.forwardedFor}</Text>
          ) : null}
        </View>

        {/* Aksi */}
        <View style={st.actions}>
          <Pressable
            style={st.actionBtn}
            onPress={() => setStatus({ id: h._id, status: isNew ? "ditinjau" : "baru" })}
          >
            <FontAwesome name={isNew ? "check" : "undo"} size={12} color={Colors.primary} />
            <Text style={st.actionText}>{isNew ? "Tandai ditinjau" : "Tandai baru"}</Text>
          </Pressable>
          <Pressable style={[st.actionBtn, st.actionDanger]} onPress={() => setDeleteId(h._id)}>
            <FontAwesome name="trash" size={13} color={Colors.error} />
            <Text style={[st.actionText, { color: Colors.error }]}>Hapus</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={st.container}>
      <FlatList
        data={filtered}
        keyExtractor={(h) => h._id}
        renderItem={renderHit}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <View style={st.summary}>
              {[
                { label: "Kunjungan", value: total },
                { label: "IP unik", value: uniqueIps },
                { label: "Ada foto", value: withPhoto },
                { label: "Ada GPS", value: withGps },
                { label: "Belum ditinjau", value: unseen },
              ].map((s) => (
                <View key={s.label} style={st.summaryItem}>
                  <Text style={st.summaryValue}>{s.value}</Text>
                  <Text style={st.summaryLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={st.filterRow}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  style={[st.chip, filter === f.key && st.chipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[st.chipText, filter === f.key && st.chipTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={st.policy}>
              Data berisi informasi pribadi (IP, lokasi, foto): hanya administrator yang dapat
              melihat, dan otomatis dihapus setelah 90 hari. Lokasi GPS & foto hanya ada bila
              pengunjung mengizinkannya di browser.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={st.empty}>
            <FontAwesome name="shield" size={32} color={Colors.border} />
            <Text style={st.emptyText}>
              {total === 0
                ? "Belum ada yang terperangkap. Perangkap aktif di /admin, /wp-admin, /phpmyadmin, /.env, dan alamat sejenis."
                : "Tidak ada catatan untuk filter ini."}
            </Text>
          </View>
        }
      />

      {/* Foto ukuran penuh */}
      <Modal visible={photoUrl !== null} transparent animationType="fade" onRequestClose={() => setPhotoUrl(null)}>
        <Pressable style={st.photoOverlay} onPress={() => setPhotoUrl(null)}>
          {photoUrl && <Image source={{ uri: photoUrl }} style={st.photoFull} resizeMode="contain" />}
          <Text style={st.photoClose}>Ketuk untuk menutup</Text>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await removeHit({ id: deleteId });
          setDeleteId(null);
        }}
        title="Hapus catatan?"
        message="Catatan beserta foto dan datanya akan dihapus permanen."
        confirmText="Hapus"
        type="danger"
        icon="trash"
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },

  summary: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 18, fontWeight: "700", color: Colors.primaryDark },
  summaryLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: "center" },

  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  chipTextActive: { color: "#fff" },

  policy: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16, marginBottom: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardNew: { borderColor: "#F5B041", borderLeftWidth: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  path: { flex: 1, fontSize: 15, fontWeight: "700", color: Colors.text, fontFamily: Platform.select({ web: "monospace", default: undefined }) },
  when: { fontSize: 12, color: Colors.textSecondary, marginTop: -6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagNew: { backgroundColor: "#FFF3E0" },
  tagSeen: { backgroundColor: "#E8F5E9" },
  tagText: { fontSize: 10, fontWeight: "700" },

  ipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ip: { fontSize: 18, fontWeight: "700", color: Colors.primaryDark, fontFamily: Platform.select({ web: "monospace", default: undefined }) },
  label: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary, letterSpacing: 0.6, marginBottom: 2 },
  block: { gap: 2, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  value: { fontSize: 13, color: Colors.text },
  hint: { fontSize: 12, color: Colors.textSecondary },
  mono: { fontFamily: Platform.select({ web: "monospace", default: undefined }), fontWeight: "700" },

  btnRow: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  smallBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },
  mapWrap: { height: 200, borderRadius: 10, overflow: "hidden", marginTop: 8, backgroundColor: Colors.border },

  photoWrap: { width: 140, height: 105, borderRadius: 10, overflow: "hidden", marginTop: 4 },
  photo: { width: "100%", height: "100%", backgroundColor: Colors.border },
  photoZoom: {
    position: "absolute",
    right: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    padding: 5,
  },

  actions: { flexDirection: "row", gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  actionDanger: { backgroundColor: "#FFEBEE" },
  actionText: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  empty: { alignItems: "center", padding: 32, gap: 12 },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 19 },

  photoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  photoFull: { width: "100%", height: "80%" },
  photoClose: { color: "#fff", fontSize: 12, opacity: 0.8 },
});
