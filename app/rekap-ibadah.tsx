import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery, useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useAuthContext } from "@/lib/auth-context";
import { Colors } from "@/lib/constants";
import { DZIKIR_KATEGORI } from "@/lib/dzikir-data";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const DEFAULT_TASBIH_TARGET = 100;
const DEFAULT_DZIKIR_TARGET = ["pagi", "petang"];
const TASBIH_TARGET_PRESETS = [33, 100, 300, 500, 1000];

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fmt(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function labelTanggal(d: Date) {
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`;
}
/** Metadata bulan berdasarkan offset dari bulan berjalan (0 = bulan ini). */
function monthMeta(offset: number) {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() - offset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const p = String(month + 1).padStart(2, "0");
  return {
    year,
    month,
    key: `${year}-${p}`,
    label: `${BULAN_FULL[month]} ${year}`,
    daysInMonth: new Date(year, month + 1, 0).getDate(),
    firstWeekday: new Date(year, month, 1).getDay(),
  };
}

type TasbihRow = { tanggal: string; dzikirId: string; dzikirLabel: string; jumlah: number; putaran: number };
type DzikirRow = { tanggal: string; kategoriId: string; kategoriLabel: string; itemId: string; itemJudul: string };

export default function RekapIbadahScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData } = useAuthContext();
  const uid = userData?._id;

  const [period, setPeriod] = useState<"minggu" | "bulan">("minggu");
  const [monthOffset, setMonthOffset] = useState(0);
  const [editVisible, setEditVisible] = useState(false);

  const tasbih = useQuery(api.dzikir.getTasbihHistory, uid ? { userId: uid } : "skip") as TasbihRow[] | undefined;
  const dzikir = useQuery(api.dzikir.getDzikirHistory, uid ? { userId: uid } : "skip") as DzikirRow[] | undefined;
  const target = useQuery(api.dzikir.getTarget, uid ? { userId: uid } : "skip");
  const setTarget = useMutation(api.dzikir.setTarget);

  const meta = monthMeta(monthOffset);
  const monthTasbih = useQuery(
    api.dzikir.getTasbihByMonth,
    uid && period === "bulan" ? { userId: uid, bulan: meta.key } : "skip"
  ) as TasbihRow[] | undefined;
  const monthDzikir = useQuery(
    api.dzikir.getDzikirByMonth,
    uid && period === "bulan" ? { userId: uid, bulan: meta.key } : "skip"
  ) as DzikirRow[] | undefined;

  const today = ymd(new Date());
  const tasbihTarget = target?.tasbihTarget ?? DEFAULT_TASBIH_TARGET;
  const dzikirTargetKat = target?.dzikirKategori ?? DEFAULT_DZIKIR_TARGET;

  const rekap = useMemo(() => {
    if (!tasbih || !dzikir) return null;

    const tasbihToday = tasbih.filter((r) => r.tanggal === today);
    const tasbihTodayJumlah = tasbihToday.reduce((s, r) => s + r.jumlah, 0);
    const tasbihTodayPutaran = tasbihToday.reduce((s, r) => s + r.putaran, 0);

    const dzikirTodayByKat = new Map<string, number>();
    for (const r of dzikir) {
      if (r.tanggal !== today) continue;
      dzikirTodayByKat.set(r.kategoriId, (dzikirTodayByKat.get(r.kategoriId) ?? 0) + 1);
    }

    const days: { tanggal: string; label: string; jumlah: number; items: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = ymd(d);
      const jumlah = tasbih.filter((r) => r.tanggal === key).reduce((s, r) => s + r.jumlah, 0);
      const items = dzikir.filter((r) => r.tanggal === key).length;
      days.push({ tanggal: key, label: labelTanggal(d), jumlah, items });
    }
    const maxJumlah = Math.max(1, ...days.map((d) => d.jumlah));

    const activeDates = new Set<string>();
    for (const r of tasbih) if (r.jumlah > 0) activeDates.add(r.tanggal);
    for (const r of dzikir) activeDates.add(r.tanggal);
    let streak = 0;
    const cur = new Date();
    if (!activeDates.has(ymd(cur))) cur.setDate(cur.getDate() - 1);
    while (activeDates.has(ymd(cur))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    return {
      tasbihToday,
      tasbihTodayJumlah,
      tasbihTodayPutaran,
      dzikirTodayByKat,
      days,
      maxJumlah,
      streak,
      totalTasbihAll: tasbih.reduce((s, r) => s + r.jumlah, 0),
      totalDzikirAll: dzikir.length,
      katSelesaiToday: dzikirTodayByKat.size,
    };
  }, [tasbih, dzikir, today]);

  // Data bulanan (kalender)
  const bulanan = useMemo(() => {
    if (period !== "bulan" || !monthTasbih || !monthDzikir) return null;
    const jumlahByDate = new Map<string, number>();
    for (const r of monthTasbih) jumlahByDate.set(r.tanggal, (jumlahByDate.get(r.tanggal) ?? 0) + r.jumlah);
    const itemsByDate = new Map<string, number>();
    for (const r of monthDzikir) itemsByDate.set(r.tanggal, (itemsByDate.get(r.tanggal) ?? 0) + 1);

    const cells: ({ day: number; tanggal: string; jumlah: number; items: number } | null)[] = [];
    for (let i = 0; i < meta.firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= meta.daysInMonth; d++) {
      const tanggal = `${meta.key}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, tanggal, jumlah: jumlahByDate.get(tanggal) ?? 0, items: itemsByDate.get(tanggal) ?? 0 });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const totalJumlah = monthTasbih.reduce((s, r) => s + r.jumlah, 0);
    const totalItems = monthDzikir.length;
    const activeDays = new Set<string>();
    for (const [t, j] of jumlahByDate) if (j > 0) activeDays.add(t);
    for (const t of itemsByDate.keys()) activeDays.add(t);
    const targetMetDays = Array.from(jumlahByDate.values()).filter((j) => j >= tasbihTarget).length;

    return { cells, totalJumlah, totalItems, activeDays: activeDays.size, targetMetDays };
  }, [period, monthTasbih, monthDzikir, meta.firstWeekday, meta.daysInMonth, meta.key, tasbihTarget]);

  const openEdit = () => setEditVisible(true);

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <FontAwesome name="arrow-left" size={16} color={Colors.textLight} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Rekap Ibadah</Text>
      <TouchableOpacity style={styles.headerAction} onPress={openEdit}>
        <FontAwesome name="bullseye" size={16} color={Colors.textLight} />
      </TouchableOpacity>
    </View>
  );

  if (!userData) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.center}>
          <FontAwesome name="user-o" size={40} color={Colors.border} />
          <Text style={styles.emptyText}>Silakan masuk untuk melihat rekap ibadah Anda.</Text>
        </View>
      </View>
    );
  }

  if (!rekap) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat rekap...</Text>
        </View>
      </View>
    );
  }

  // Target harian — progres hari ini
  const tasbihPct = Math.min(100, Math.round((rekap.tasbihTodayJumlah / tasbihTarget) * 100));
  const katDoneCount = dzikirTargetKat.filter((id) => {
    const kat = DZIKIR_KATEGORI.find((k) => k.id === id);
    if (!kat) return false;
    return (rekap.dzikirTodayByKat.get(id) ?? 0) >= kat.items.length;
  }).length;

  return (
    <View style={styles.container}>
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Stat ringkas */}
        <View style={styles.statRow}>
          <View style={[styles.statCard, { backgroundColor: "#E8F5E9" }]}>
            <FontAwesome name="fire" size={18} color="#2E7D32" />
            <Text style={styles.statVal}>{rekap.streak}</Text>
            <Text style={styles.statLbl}>Hari beruntun</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#E0F2F1" }]}>
            <FontAwesome name="circle-o-notch" size={18} color="#00695C" />
            <Text style={styles.statVal}>{fmt(rekap.totalTasbihAll)}</Text>
            <Text style={styles.statLbl}>Total tasbih</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#E1F5FE" }]}>
            <FontAwesome name="check-circle" size={18} color="#0277BD" />
            <Text style={styles.statVal}>{rekap.totalDzikirAll}</Text>
            <Text style={styles.statLbl}>Dzikir selesai</Text>
          </View>
        </View>

        {/* Target harian */}
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionTitle}>Target Harian</Text>
          <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
            <FontAwesome name="pencil" size={12} color={Colors.primary} />
            <Text style={styles.editBtnText}>Ubah</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <View style={styles.targetRow}>
            <FontAwesome name="circle-o-notch" size={15} color={Colors.primary} />
            <Text style={styles.targetLabel}>Tasbih</Text>
            <Text style={styles.targetVal}>
              {fmt(rekap.tasbihTodayJumlah)} / {fmt(tasbihTarget)}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${tasbihPct}%`, backgroundColor: Colors.primary }]} />
          </View>
          {tasbihPct >= 100 && (
            <Text style={styles.targetDone}>✓ Target tasbih hari ini tercapai</Text>
          )}

          <View style={[styles.targetRow, { marginTop: 16 }]}>
            <FontAwesome name="book" size={15} color="#0277BD" />
            <Text style={styles.targetLabel}>Dzikir</Text>
            <Text style={styles.targetVal}>
              {katDoneCount} / {dzikirTargetKat.length} kategori
            </Text>
          </View>
          <View style={styles.chipWrap}>
            {dzikirTargetKat.length === 0 ? (
              <Text style={styles.emptyInline}>Belum ada kategori dzikir yang ditargetkan.</Text>
            ) : (
              dzikirTargetKat.map((id) => {
                const kat = DZIKIR_KATEGORI.find((k) => k.id === id);
                if (!kat) return null;
                const done = (rekap.dzikirTodayByKat.get(id) ?? 0) >= kat.items.length;
                return (
                  <View
                    key={id}
                    style={[styles.katChip, done ? { backgroundColor: kat.warna } : { borderColor: kat.warna, borderWidth: 1 }]}
                  >
                    <FontAwesome
                      name={done ? "check" : "circle-o"}
                      size={11}
                      color={done ? "#fff" : kat.warna}
                    />
                    <Text style={[styles.katChipText, { color: done ? "#fff" : kat.warna }]}>{kat.nama.replace("Dzikir ", "")}</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Toggle periode */}
        <View style={styles.periodToggle}>
          {(["minggu", "bulan"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p === "minggu" ? "Mingguan" : "Bulanan"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {period === "minggu" ? (
          <>
            {/* Tasbih hari ini */}
            <Text style={styles.sectionTitle}>Tasbih Hari Ini</Text>
            <View style={styles.card}>
              <View style={styles.todayHeadRow}>
                <View>
                  <Text style={styles.bigNum}>{fmt(rekap.tasbihTodayJumlah)}</Text>
                  <Text style={styles.bigNumLbl}>total hitungan</Text>
                </View>
                <View style={styles.putaranBox}>
                  <Text style={styles.putaranNum}>{rekap.tasbihTodayPutaran}</Text>
                  <Text style={styles.putaranLbl}>putaran</Text>
                </View>
              </View>
              {rekap.tasbihToday.length === 0 ? (
                <Text style={styles.emptyInline}>Belum ada tasbih hari ini.</Text>
              ) : (
                <View style={styles.breakdown}>
                  {rekap.tasbihToday
                    .slice()
                    .sort((a, b) => b.jumlah - a.jumlah)
                    .map((r) => (
                      <View key={r.dzikirId} style={styles.breakRow}>
                        <Text style={styles.breakLabel} numberOfLines={1}>{r.dzikirLabel}</Text>
                        <Text style={styles.breakVal}>
                          {fmt(r.jumlah)}
                          {r.putaran > 0 ? `  ·  ${r.putaran}×` : ""}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
            </View>

            {/* Dzikir hari ini per kategori */}
            <Text style={styles.sectionTitle}>
              Dzikir Hari Ini ({rekap.katSelesaiToday}/{DZIKIR_KATEGORI.length} kategori)
            </Text>
            <View style={styles.card}>
              {DZIKIR_KATEGORI.map((k) => {
                const done = rekap.dzikirTodayByKat.get(k.id) ?? 0;
                const total = k.items.length;
                const pct = Math.min(100, Math.round((done / total) * 100));
                const complete = done >= total;
                return (
                  <View key={k.id} style={styles.katRow}>
                    <View style={[styles.katIcon, { backgroundColor: k.warna + "1A" }]}>
                      <FontAwesome name={k.icon as any} size={13} color={k.warna} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.katLabelRow}>
                        <Text style={styles.katName} numberOfLines={1}>{k.nama}</Text>
                        <Text style={[styles.katCount, complete && { color: k.warna, fontWeight: "800" }]}>
                          {done}/{total}{complete ? "  ✓" : ""}
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: k.warna }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* 7 hari terakhir */}
            <Text style={styles.sectionTitle}>7 Hari Terakhir</Text>
            <View style={styles.card}>
              {rekap.days.map((d, idx) => (
                <View key={d.tanggal} style={styles.dayRow}>
                  <Text style={[styles.dayLabel, idx === 0 && { fontWeight: "800", color: Colors.primary }]}>
                    {idx === 0 ? "Hari ini" : d.label}
                  </Text>
                  <View style={styles.dayBarWrap}>
                    <View
                      style={[
                        styles.dayBar,
                        { width: `${Math.round((d.jumlah / rekap.maxJumlah) * 100)}%` },
                        d.jumlah === 0 && { width: 3, backgroundColor: Colors.border },
                      ]}
                    />
                  </View>
                  <Text style={styles.dayStat}>
                    {d.jumlah > 0 ? fmt(d.jumlah) : "–"}
                    {d.items > 0 ? `  ·  ${d.items} dzikir` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Navigasi bulan */}
            <View style={styles.monthNav}>
              <TouchableOpacity style={styles.monthNavBtn} onPress={() => setMonthOffset((o) => o + 1)}>
                <FontAwesome name="chevron-left" size={14} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{meta.label}</Text>
              <TouchableOpacity
                style={[styles.monthNavBtn, monthOffset === 0 && styles.monthNavBtnDisabled]}
                onPress={() => setMonthOffset((o) => Math.max(0, o - 1))}
                disabled={monthOffset === 0}
              >
                <FontAwesome name="chevron-right" size={14} color={monthOffset === 0 ? Colors.border : Colors.primary} />
              </TouchableOpacity>
            </View>

            {!bulanan ? (
              <View style={[styles.card, { alignItems: "center", paddingVertical: 28 }]}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : (
              <>
                <View style={styles.monthStatRow}>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatVal}>{fmt(bulanan.totalJumlah)}</Text>
                    <Text style={styles.monthStatLbl}>hitungan tasbih</Text>
                  </View>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatVal}>{bulanan.totalItems}</Text>
                    <Text style={styles.monthStatLbl}>dzikir selesai</Text>
                  </View>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatVal}>{bulanan.activeDays}</Text>
                    <Text style={styles.monthStatLbl}>hari aktif</Text>
                  </View>
                </View>

                {/* Kalender */}
                <View style={styles.card}>
                  <View style={styles.calWeekHead}>
                    {HARI.map((h) => (
                      <Text key={h} style={styles.calWeekHeadText}>{h}</Text>
                    ))}
                  </View>
                  <View style={styles.calGrid}>
                    {bulanan.cells.map((c, i) => {
                      if (!c) return <View key={`e${i}`} style={styles.calCell} />;
                      const isToday = c.tanggal === today;
                      const met = c.jumlah >= tasbihTarget && tasbihTarget > 0;
                      const some = c.jumlah > 0 || c.items > 0;
                      const bg = met ? Colors.primary : some ? Colors.primaryLight : "transparent";
                      const fg = met ? "#fff" : some ? Colors.primaryDark : Colors.textSecondary;
                      return (
                        <View key={c.tanggal} style={styles.calCell}>
                          <View style={[styles.calDay, { backgroundColor: bg }, isToday && styles.calDayToday]}>
                            <Text style={[styles.calDayText, { color: fg }]}>{c.day}</Text>
                            {c.items > 0 && <View style={[styles.calDot, { backgroundColor: met ? "#fff" : "#0277BD" }]} />}
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Legenda */}
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendBox, { backgroundColor: Colors.primaryLight }]} />
                      <Text style={styles.legendText}>Ada aktivitas</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendBox, { backgroundColor: Colors.primary }]} />
                      <Text style={styles.legendText}>Target tercapai</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: "#0277BD" }]} />
                      <Text style={styles.legendText}>Dzikir</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.motivBox}>
                  <FontAwesome name="bullseye" size={13} color="#B8860B" />
                  <Text style={styles.motivText}>
                    Target tasbih tercapai pada {bulanan.targetMetDays} hari di bulan {meta.label}.
                  </Text>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <TargetEditor
        visible={editVisible}
        initialTasbih={tasbihTarget}
        initialKategori={dzikirTargetKat}
        onClose={() => setEditVisible(false)}
        onSave={(t, k) => {
          if (uid) setTarget({ userId: uid, tasbihTarget: t, dzikirKategori: k }).catch(() => {});
          setEditVisible(false);
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal pengaturan target harian
// ─────────────────────────────────────────────────────────────────────────────
function TargetEditor({
  visible,
  initialTasbih,
  initialKategori,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialTasbih: number;
  initialKategori: string[];
  onClose: () => void;
  onSave: (tasbih: number, kategori: string[]) => void;
}) {
  const [tasbih, setTasbih] = useState(initialTasbih);
  const [kategori, setKategori] = useState<string[]>(initialKategori);

  // Sinkronkan saat modal dibuka dengan nilai terkini.
  React.useEffect(() => {
    if (visible) {
      setTasbih(initialTasbih);
      setKategori(initialKategori);
    }
  }, [visible, initialTasbih, initialKategori]);

  const toggleKat = (id: string) =>
    setKategori((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Target Harian</Text>

          <Text style={styles.modalLabel}>Target hitungan tasbih / hari</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => setTasbih((t) => Math.max(1, t - 33))}
            >
              <FontAwesome name="minus" size={14} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.stepperVal}>{fmt(tasbih)}</Text>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => setTasbih((t) => t + 33)}>
              <FontAwesome name="plus" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.presetRow}>
            {TASBIH_TARGET_PRESETS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.presetChip, tasbih === p && styles.presetChipActive]}
                onPress={() => setTasbih(p)}
              >
                <Text style={[styles.presetText, tasbih === p && styles.presetTextActive]}>{fmt(p)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.modalLabel, { marginTop: 18 }]}>Kategori dzikir yang ditargetkan tuntas</Text>
          <View style={styles.katSelectWrap}>
            {DZIKIR_KATEGORI.map((k) => {
              const on = kategori.includes(k.id);
              return (
                <TouchableOpacity
                  key={k.id}
                  style={[styles.katSelect, on ? { backgroundColor: k.warna, borderColor: k.warna } : { borderColor: Colors.border }]}
                  onPress={() => toggleKat(k.id)}
                >
                  <FontAwesome name={k.icon as any} size={12} color={on ? "#fff" : k.warna} />
                  <Text style={[styles.katSelectText, { color: on ? "#fff" : Colors.text }]}>
                    {k.nama.replace("Dzikir ", "")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSave} onPress={() => onSave(tasbih, kategori)}>
              <Text style={styles.modalSaveText}>Simpan Target</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 2,
  elevation: 1,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, paddingHorizontal: 32 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: Colors.textLight },
  headerAction: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },

  scroll: { padding: 16, paddingBottom: 40 },

  statRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", gap: 4 },
  statVal: { fontSize: 20, fontWeight: "800", color: Colors.text },
  statLbl: { fontSize: 10.5, color: Colors.textSecondary, textAlign: "center" },

  sectionHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 10 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  editBtnText: { fontSize: 12.5, fontWeight: "600", color: Colors.primary },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 20, ...CARD_SHADOW },

  targetRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  targetLabel: { flex: 1, fontSize: 13.5, fontWeight: "600", color: Colors.text },
  targetVal: { fontSize: 13, fontWeight: "700", color: Colors.text },
  targetDone: { fontSize: 11.5, color: Colors.primary, fontWeight: "600", marginTop: 6 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  katChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  katChipText: { fontSize: 11.5, fontWeight: "600" },

  periodToggle: { flexDirection: "row", backgroundColor: "#ECEFF1", borderRadius: 10, padding: 3, marginBottom: 16 },
  periodBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  periodBtnActive: { backgroundColor: "#fff", ...CARD_SHADOW },
  periodText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  periodTextActive: { color: Colors.primary },

  todayHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  bigNum: { fontSize: 34, fontWeight: "900", color: Colors.primary, lineHeight: 38 },
  bigNumLbl: { fontSize: 12, color: Colors.textSecondary },
  putaranBox: { alignItems: "center", backgroundColor: Colors.primaryLight, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  putaranNum: { fontSize: 20, fontWeight: "800", color: Colors.primaryDark },
  putaranLbl: { fontSize: 11, color: Colors.primaryDark },

  emptyInline: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 4, fontStyle: "italic" },
  breakdown: { marginTop: 14, gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  breakRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  breakLabel: { flex: 1, fontSize: 13, color: Colors.text },
  breakVal: { fontSize: 13, fontWeight: "700", color: Colors.primary },

  katRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  katIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  katLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  katName: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.text },
  katCount: { fontSize: 12, color: Colors.textSecondary, marginLeft: 8 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "#EEEEEE", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },

  dayRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  dayLabel: { width: 66, fontSize: 12, color: Colors.textSecondary },
  dayBarWrap: { flex: 1, height: 10, justifyContent: "center" },
  dayBar: { height: 10, borderRadius: 5, backgroundColor: Colors.primary, minWidth: 3 },
  dayStat: { width: 92, textAlign: "right", fontSize: 11, color: Colors.textSecondary },

  // Bulanan
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  monthNavBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center", ...CARD_SHADOW,
  },
  monthNavBtnDisabled: { opacity: 0.5 },
  monthLabel: { fontSize: 15, fontWeight: "700", color: Colors.text },
  monthStatRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  monthStat: { flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 12, alignItems: "center", ...CARD_SHADOW },
  monthStatVal: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  monthStatLbl: { fontSize: 10.5, color: Colors.textSecondary, marginTop: 2, textAlign: "center" },

  calWeekHead: { flexDirection: "row", marginBottom: 6 },
  calWeekHeadText: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  calDay: { flex: 1, borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 2 },
  calDayToday: { borderWidth: 2, borderColor: Colors.secondary },
  calDayText: { fontSize: 12.5, fontWeight: "600" },
  calDot: { width: 4, height: 4, borderRadius: 2 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendBox: { width: 12, height: 12, borderRadius: 3 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 11, color: Colors.textSecondary },

  motivBox: { flexDirection: "row", gap: 10, backgroundColor: "#FFF8E1", borderRadius: 12, padding: 14 },
  motivText: { flex: 1, fontSize: 12.5, color: "#795548", lineHeight: 19 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: Colors.text, marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 10 },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  stepperBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  stepperVal: { fontSize: 26, fontWeight: "900", color: Colors.primary, minWidth: 90, textAlign: "center" },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" },
  presetChip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  presetChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  presetText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  presetTextActive: { color: "#fff" },
  katSelectWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  katSelect: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  katSelectText: { fontSize: 12.5, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: "#ECEFF1", alignItems: "center" },
  modalCancelText: { fontSize: 14, fontWeight: "700", color: Colors.textSecondary },
  modalSave: { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center" },
  modalSaveText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
