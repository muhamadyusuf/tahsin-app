import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Dimensions,
  Switch,
  Pressable,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAllSurahs, Surah } from "@/lib/alquran-api";
import { getJuzForSurah } from "@/lib/surah-juz";

const { width } = Dimensions.get("window");

/* ── helpers ────────────────────────────────────────── */

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
};

const dayName = (iso: string) => {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[new Date(iso).getDay()];
};

/* ── component ──────────────────────────────────────── */

export default function TilawahHarianScreen() {
  const router = useRouter();
  const { userData } = useAuthContext();

  // Convex
  const tilawahList = useQuery(
    api.tilawah.getByUser,
    userData?._id ? { userId: userData._id } : "skip"
  );
  const khatamProgress = useQuery(
    api.tilawah.getKhatamProgress,
    userData?._id ? { userId: userData._id } : "skip"
  );
  const createTilawah = useMutation(api.tilawah.create);
  const removeTilawah = useMutation(api.tilawah.remove);
  const updateTilawah = useMutation(api.tilawah.update);

  // Surah list (for picker)
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [surahsLoading, setSurahsLoading] = useState(true);
  useEffect(() => {
    getAllSurahs()
      .then(setSurahs)
      .catch(() => {})
      .finally(() => setSurahsLoading(false));
  }, []);

  // Form state
  const [tanggal, setTanggal] = useState(todayISO());
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);
  const [availableJuz, setAvailableJuz] = useState<number[]>([]);
  const [jumlahHalaman, setJumlahHalaman] = useState("");
  const [surahPickerVisible, setSurahPickerVisible] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isKhatam, setIsKhatam] = useState(false);

  // Edit modal state
  const [editItem, setEditItem] = useState<any>(null);
  const [editJuz, setEditJuz] = useState("");
  const [editHalaman, setEditHalaman] = useState("");
  const [editKhatam, setEditKhatam] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Auto-set juz when surah changes
  useEffect(() => {
    if (selectedSurah) {
      const juzList = getJuzForSurah(selectedSurah.number);
      setAvailableJuz(juzList);
      setSelectedJuz(juzList.length === 1 ? juzList[0] : null);
    } else {
      setAvailableJuz([]);
      setSelectedJuz(null);
    }
  }, [selectedSurah]);

  // Date navigation
  const shiftDate = (days: number) => {
    const d = new Date(tanggal);
    d.setDate(d.getDate() + days);
    setTanggal(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  };

  /* ── derived data ───────────────────────────────── */

  const history = useMemo(() => {
    if (!tilawahList) return [];
    const sorted = [...tilawahList].sort(
      (a, b) => b.tanggal.localeCompare(a.tanggal) || b._creationTime - a._creationTime
    );
    return sorted;
  }, [tilawahList]);

  // Group by date for display
  const grouped = useMemo(() => {
    const map = new Map<string, typeof history>();
    for (const item of history) {
      const arr = map.get(item.tanggal) || [];
      arr.push(item);
      map.set(item.tanggal, arr);
    }
    return Array.from(map.entries()); // [[date, items[]], ...]
  }, [history]);

  // Stats
  const stats = useMemo(() => {
    if (!tilawahList) return { today: 0, week: 0, month: 0, total: 0 };
    const now = new Date();
    const todayStr = todayISO();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    let today = 0, week = 0, month = 0, total = 0;
    for (const t of tilawahList) {
      total += t.jumlahHalaman;
      if (t.tanggal === todayStr) today += t.jumlahHalaman;
      if (t.tanggal >= weekAgo.toISOString().slice(0, 10)) week += t.jumlahHalaman;
      if (t.tanggal >= monthStart) month += t.jumlahHalaman;
    }
    return { today, week, month, total };
  }, [tilawahList]);

  /* ── actions ────────────────────────────────────── */

  const handleSubmit = async () => {
    if (!userData?._id) return;
    if (!selectedSurah) {
      Alert.alert("Peringatan", "Pilih surah terlebih dahulu.");
      return;
    }
    if (availableJuz.length > 1 && !selectedJuz) {
      Alert.alert("Peringatan", "Pilih juz terlebih dahulu.");
      return;
    }
    const pages = parseFloat(jumlahHalaman);
    if (!pages || pages <= 0 || pages > 604) {
      Alert.alert("Peringatan", "Masukkan jumlah halaman yang valid.");
      return;
    }

    setSubmitting(true);
    try {
      await createTilawah({
        userId: userData._id,
        tanggal,
        suratNumber: selectedSurah.number,
        suratName: selectedSurah.englishName,
        juz: selectedJuz ?? availableJuz[0] ?? 0,
        jumlahHalaman: pages,
        isKhatam,
      });
      // Reset form (keep date)
      setSelectedSurah(null);
      setSelectedJuz(null);
      setJumlahHalaman("");

      if (isKhatam) {
        setIsKhatam(false);
        Alert.alert(
          "Alhamdulillah! Khatam! 🎉",
          `Selamat, khatam Anda telah dicatat!\n\nSemoga Allah menerima tilawah Anda.`,
          [{ text: "Aamiin" }]
        );
      } else {
        Alert.alert("Berhasil", "Tilawah harian berhasil disimpan!");
      }
    } catch {
      Alert.alert("Gagal", "Tidak bisa menyimpan data. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: any) => {
    if (Platform.OS === "web") {
        if (window.confirm("Yakin ingin menghapus data ini?")) {
            await removeTilawah({ id });
        }
    } else {
        Alert.alert("Hapus Tilawah", "Yakin ingin menghapus data ini?", [
        { text: "Batal", style: "cancel" },
        {
            text: "Hapus",
            style: "destructive",
            onPress: async () => {
            try {
                await removeTilawah({ id });
            } catch (e) {
                Alert.alert("Gagal", "Tidak bisa menghapus data.");
            }
            },
        },
        ]);
    }
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditJuz(item.juz ? String(item.juz) : "");
    setEditHalaman(String(item.jumlahHalaman));
    setEditKhatam(!!item.isKhatam);
  };

  const closeEdit = () => {
    setEditItem(null);
    setEditJuz("");
    setEditHalaman("");
    setEditKhatam(false);
  };

  const handleEdit = async () => {
    if (!editItem) return;
    const pages = parseFloat(editHalaman);
    if (!pages || pages <= 0 || pages > 604) {
      Alert.alert("Peringatan", "Masukkan jumlah halaman yang valid.");
      return;
    }
    setEditSubmitting(true);
    try {
      await updateTilawah({
        id: editItem._id,
        juz: editJuz ? parseFloat(editJuz) : 0,
        jumlahHalaman: pages,
        isKhatam: editKhatam,
      });
      closeEdit();
      Alert.alert("Berhasil", "Data tilawah berhasil diperbarui.");
    } catch {
      Alert.alert("Gagal", "Tidak bisa memperbarui data.");
    } finally {
      setEditSubmitting(false);
    }
  };

  /* ── surah picker ───────────────────────────────── */

  const filteredSurahs = useMemo(() => {
    if (!surahSearch.trim()) return surahs;
    const q = surahSearch.toLowerCase();
    return surahs.filter(
      (s) =>
        s.englishName.toLowerCase().includes(q) ||
        s.number.toString().includes(q)
    );
  }, [surahs, surahSearch]);

  /* ── render ─────────────────────────────────────── */

  if (!userData) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Khatam Progress ────────────────────── */}
        {khatamProgress && (
          <View style={st.khatamCard}>
            <View style={st.khatamHeader}>
              <View style={st.khatamIconWrap}>
                <FontAwesome
                  name="star"
                  size={20}
                  color={khatamProgress.khatamCount > 0 ? "#FF8F00" : "#ccc"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.khatamTitle}>
                  {khatamProgress.khatamCount > 0
                    ? `Khatam ${khatamProgress.khatamCount}x`
                    : "Belum Khatam"}
                </Text>
                <Text style={st.khatamSub}>
                  {khatamProgress.khatamCount > 0
                    ? "Alhamdulillah, terus istiqomah!"
                    : "Tandai khatam saat menyimpan tilawah"}
                </Text>
              </View>
              {khatamProgress.khatamCount > 0 && (
                <View style={st.khatamBadge}>
                  <Text style={st.khatamBadgeText}>
                    {khatamProgress.khatamCount}x
                  </Text>
                </View>
              )}
            </View>
            {khatamProgress.khatamList.length > 0 && (
              <View style={st.khatamHistoryRow}>
                {khatamProgress.khatamList.map((k: any) => (
                  <View key={k._id} style={st.khatamHistoryChip}>
                    <FontAwesome name="check-circle" size={12} color={Colors.primary} />
                    <Text style={st.khatamHistoryText}>
                      Ke-{k.khatamKe} · {formatDate(k.completedAt)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Stats Cards ─────────────────────────── */}
        <View style={st.statsRow}>
          <View style={st.statCard}>
            <FontAwesome name="sun-o" size={18} color="#FF8F00" />
            <Text style={st.statValue}>{stats.today}</Text>
            <Text style={st.statLabel}>Hari Ini</Text>
          </View>
          <View style={st.statCard}>
            <FontAwesome name="calendar" size={18} color={Colors.primary} />
            <Text style={st.statValue}>{stats.week}</Text>
            <Text style={st.statLabel}>7 Hari</Text>
          </View>
          <View style={st.statCard}>
            <FontAwesome name="calendar-check-o" size={18} color="#1565C0" />
            <Text style={st.statValue}>{stats.month}</Text>
            <Text style={st.statLabel}>Bulan Ini</Text>
          </View>
          <View style={st.statCard}>
            <FontAwesome name="book" size={18} color="#C62828" />
            <Text style={st.statValue}>{stats.total}</Text>
            <Text style={st.statLabel}>Total</Text>
          </View>
        </View>

        {/* ── Input Form ──────────────────────────── */}
        <View style={st.formCard}>
          <Text style={st.formTitle}>Catat Tilawah Harian</Text>

          {/* Date picker row */}
          <Text style={st.label}>Tanggal</Text>
          <View style={st.dateRow}>
            <TouchableOpacity onPress={() => shiftDate(-1)} style={st.dateArrow}>
              <FontAwesome name="chevron-left" size={14} color={Colors.primary} />
            </TouchableOpacity>
            <View style={st.dateCenter}>
              <Text style={st.dateText}>{dayName(tanggal)}, {formatDate(tanggal)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => shiftDate(1)}
              style={st.dateArrow}
              disabled={tanggal >= todayISO()}
            >
              <FontAwesome
                name="chevron-right"
                size={14}
                color={tanggal >= todayISO() ? "#ccc" : Colors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Surah picker */}
          <Text style={st.label}>Surah</Text>
          <TouchableOpacity
            style={st.pickerBtn}
            onPress={() => setSurahPickerVisible(true)}
          >
            <Text
              style={[
                st.pickerText,
                !selectedSurah && { color: Colors.textSecondary },
              ]}
            >
              {selectedSurah
                ? `${selectedSurah.number}. ${selectedSurah.englishName}`
                : "Pilih surah..."}
            </Text>
            <FontAwesome name="chevron-down" size={12} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Juz & Pages */}
          <View style={st.twoCol}>
            <View style={st.col}>
              <Text style={st.label}>Juz</Text>
              {availableJuz.length === 0 ? (
                <View style={[st.input, { justifyContent: "center" }]}>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
                    Pilih surah dulu
                  </Text>
                </View>
              ) : availableJuz.length === 1 ? (
                <View style={[st.input, { justifyContent: "center" }]}>
                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: "600" }}>
                    Juz {availableJuz[0]}
                  </Text>
                </View>
              ) : (
                <View style={st.juzChipRow}>
                  {availableJuz.map((j) => (
                    <TouchableOpacity
                      key={j}
                      style={[
                        st.juzChip,
                        selectedJuz === j && st.juzChipActive,
                      ]}
                      onPress={() => setSelectedJuz(j)}
                    >
                      <Text
                        style={[
                          st.juzChipText,
                          selectedJuz === j && st.juzChipTextActive,
                        ]}
                      >
                        {j}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={st.col}>
              <Text style={st.label}>Jumlah Halaman</Text>
              <TextInput
                style={st.input}
                placeholder="Cth: 5"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
                value={jumlahHalaman}
                onChangeText={setJumlahHalaman}
              />
            </View>
          </View>

          {/* Khatam toggle */}
          <View style={st.khatamToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.khatamToggleLabel}>Tandai Khatam</Text>
              <Text style={st.khatamToggleSub}>
                Aktifkan jika ini bacaan terakhir khatam Anda
              </Text>
            </View>
            <Switch
              value={isKhatam}
              onValueChange={setIsKhatam}
              trackColor={{ false: "#ddd", true: Colors.primaryLight }}
              thumbColor={isKhatam ? Colors.primary : "#f4f3f4"}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[st.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <FontAwesome name="plus-circle" size={16} color="#fff" />
                <Text style={st.submitText}>Simpan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── History ─────────────────────────────── */}
        <View style={st.historyHeader}>
          <FontAwesome name="history" size={16} color={Colors.text} />
          <Text style={st.historyTitle}>Riwayat Tilawah</Text>
        </View>

        {tilawahList === undefined ? (
          <ActivityIndicator
            size="small"
            color={Colors.primary}
            style={{ marginTop: 20 }}
          />
        ) : grouped.length === 0 ? (
          <View style={st.emptyBox}>
            <FontAwesome name="inbox" size={40} color={Colors.textSecondary} />
            <Text style={st.emptyText}>Belum ada riwayat tilawah.</Text>
            <Text style={st.emptySubText}>
              Mulai catat tilawah harianmu di atas!
            </Text>
          </View>
        ) : (
          grouped.map(([date, items]) => {
            const totalPages = items.reduce((s, i) => s + i.jumlahHalaman, 0);
            return (
              <View key={date} style={st.dateGroup}>
                <View style={st.dateGroupHeader}>
                  <Text style={st.dateGroupTitle}>
                    {dayName(date)}, {formatDate(date)}
                  </Text>
                  <Text style={st.dateGroupBadge}>{totalPages} hal</Text>
                </View>
                {items.map((item) => (
                  <View key={item._id} style={st.historyCard}>
                    <View style={st.historyIcon}>
                      <FontAwesome
                        name={item.isKhatam ? "star" : "book"}
                        size={16}
                        color={item.isKhatam ? "#FF8F00" : Colors.primary}
                      />
                    </View>
                    <View style={st.historyInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={st.historyName}>{item.suratName}</Text>
                        {item.isKhatam && (
                          <View style={st.khatamMiniTag}>
                            <Text style={st.khatamMiniTagText}>Khatam</Text>
                          </View>
                        )}
                      </View>
                      <Text style={st.historyMeta}>
                        {item.juz ? `Juz ${item.juz} · ` : ""}
                        {item.jumlahHalaman} halaman
                      </Text>
                    </View>
                    <View style={st.historyActions}>
                      <Pressable
                        onPress={() => openEdit(item)}
                        style={({ pressed }) => [
                          st.actionBtn,
                          pressed && { opacity: 0.5 },
                        ]}
                      >
                        <FontAwesome name="pencil" size={15} color={Colors.primary} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDelete(item._id)}
                        style={({ pressed }) => [
                          st.actionBtn,
                          pressed && { opacity: 0.5 },
                        ]}
                      >
                        <FontAwesome name="trash-o" size={15} color="#C62828" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Surah Picker Modal ────────────────────── */}
      <Modal
        visible={surahPickerVisible}
        animationType="slide"
        onRequestClose={() => setSurahPickerVisible(false)}
      >
        <View style={st.modalContainer}>
          <View style={st.modalHeader}>
            <Text style={st.modalTitle}>Pilih Surah</Text>
            <TouchableOpacity onPress={() => setSurahPickerVisible(false)}>
              <FontAwesome name="times" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={st.modalSearch}>
            <FontAwesome name="search" size={14} color={Colors.textSecondary} />
            <TextInput
              style={st.modalSearchInput}
              placeholder="Cari surah..."
              placeholderTextColor={Colors.textSecondary}
              value={surahSearch}
              onChangeText={setSurahSearch}
              autoFocus
            />
          </View>
          {surahsLoading ? (
            <ActivityIndicator
              size="large"
              color={Colors.primary}
              style={{ marginTop: 40 }}
            />
          ) : (
            <FlatList
              data={filteredSurahs}
              keyExtractor={(item) => item.number.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    st.surahRow,
                    selectedSurah?.number === item.number && st.surahRowActive,
                  ]}
                  onPress={() => {
                    setSelectedSurah(item);
                    setSurahPickerVisible(false);
                    setSurahSearch("");
                  }}
                >
                  <View style={st.surahNum}>
                    <Text style={st.surahNumText}>{item.number}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.surahRowName}>{item.englishName}</Text>
                    <Text style={st.surahRowMeta}>
                      {item.englishNameTranslation} · {item.numberOfAyahs} ayat
                    </Text>
                  </View>
                  <Text style={st.surahRowArabic}>{item.name}</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </View>
      </Modal>

      {/* ── Edit Modal ─────────────────────────────── */}
      <Modal
        visible={editItem !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <Pressable style={st.editOverlay} onPress={closeEdit}>
          <Pressable style={st.editCard} onPress={() => {}}>
            <Text style={st.editTitle}>Edit Tilawah</Text>

            <Text style={st.editLabel}>Surah</Text>
            <Text style={st.editValue}>{editItem?.suratName}</Text>

            <Text style={st.editLabel}>Juz</Text>
            <TextInput
              style={st.editInput}
              keyboardType="number-pad"
              value={editJuz}
              onChangeText={setEditJuz}
              placeholder="Juz"
            />

            <Text style={st.editLabel}>Jumlah Halaman</Text>
            <TextInput
              style={st.editInput}
              keyboardType="number-pad"
              value={editHalaman}
              onChangeText={setEditHalaman}
              placeholder="Halaman"
            />

            <View style={st.editKhatamRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.editLabel}>Tandai Khatam</Text>
              </View>
              <Switch
                value={editKhatam}
                onValueChange={setEditKhatam}
                trackColor={{ false: "#ddd", true: Colors.primaryLight }}
                thumbColor={editKhatam ? Colors.primary : "#f4f3f4"}
              />
            </View>

            <View style={st.editBtnRow}>
              <Pressable
                style={({ pressed }) => [
                  st.editCancelBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={closeEdit}
              >
                <Text style={st.editCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  st.editSaveBtn,
                  pressed && { opacity: 0.7 },
                  editSubmitting && { opacity: 0.5 },
                ]}
                onPress={handleEdit}
                disabled={editSubmitting}
              >
                <Text style={st.editSaveText}>
                  {editSubmitting ? "Menyimpan..." : "Simpan"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ── styles ─────────────────────────────────────────── */

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Stats
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Form
  formCard: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 10,
    overflow: "hidden",
  },
  dateArrow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateCenter: {
    flex: 1,
    alignItems: "center",
  },
  dateText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerText: {
    fontSize: 14,
    color: Colors.text,
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  col: { flex: 1 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },

  // History
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: Colors.text,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  emptySubText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  dateGroup: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  dateGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dateGroupTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  dateGroupBadge: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  historyInfo: { flex: 1 },
  historyName: {
    fontWeight: "600",
    color: Colors.text,
  },
  historyMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Surah picker modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 56,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.text,
  },
  modalSearch: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 10,
    fontSize: 14,
    color: Colors.text,
  },
  surahRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  surahRowActive: {
    backgroundColor: Colors.primaryLight,
  },
  surahNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  surahNumText: {
    fontSize: 13,
    fontWeight: "bold",
    color: Colors.primaryDark,
  },
  surahRowName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  surahRowMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  surahRowArabic: {
    fontFamily: "AmiriQuran",
    fontSize: 20,
    color: Colors.text,
    marginLeft: 8,
  },

  // Khatam card
  khatamCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  khatamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  khatamIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFF8E1",
    justifyContent: "center",
    alignItems: "center",
  },
  khatamTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.text,
  },
  khatamSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  khatamBadge: {
    backgroundColor: "#FFF8E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FFD54F",
  },
  khatamBadgeText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FF8F00",
  },
  khatamHistoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  khatamHistoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F5E9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  khatamHistoryText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: "600",
  },

  // Juz chips
  juzChipRow: {
    flexDirection: "row",
    gap: 8,
  },
  juzChip: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  juzChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  juzChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  juzChipTextActive: {
    color: Colors.primaryDark,
  },

  // Khatam toggle
  khatamToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#FFE082",
  },
  khatamToggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  khatamToggleSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Action buttons in history card
  historyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
  },

  // Edit modal
  editOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  editCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 380,
  },
  editTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 16,
    textAlign: "center",
  },
  editLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: 10,
  },
  editValue: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 4,
  },
  editInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: "#FAFAFA",
  },
  editKhatamRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 8,
  },
  editBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  editCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  editSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  editSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },

  // Khatam mini tag in history
  khatamMiniTag: {
    backgroundColor: "#FFF8E1",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#FFD54F",
  },
  khatamMiniTagText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FF8F00",
  },
});
