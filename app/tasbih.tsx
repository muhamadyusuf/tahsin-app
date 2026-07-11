import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Platform,
  Alert,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, {
  Circle,
  Ellipse,
  Defs,
  RadialGradient,
  Stop,
  Line,
  Path,
  G,
} from "react-native-svg";

import { Colors } from "@/lib/constants";
import {
  TASBIH_DESIGNS,
  DEFAULT_DESIGN_ID,
  TasbihDesign,
} from "@/lib/tasbih-designs";
import { TASBIH_DZIKIR_PRESETS } from "@/lib/dzikir-data";

// ── Persistence keys ─────────────────────────────────────────────────────────
const K_COUNT = "tasbih:count";
const K_LAPS = "tasbih:laps";
const K_TOTAL = "tasbih:total";
const K_DESIGN = "tasbih:design";
const K_PRESET = "tasbih:preset";
const K_VIBRATE = "tasbih:vibrate";

// ─────────────────────────────────────────────────────────────────────────────
// Komponen visual tasbih fisik (SVG)
// ─────────────────────────────────────────────────────────────────────────────
const BEAD_COUNT = 33;
const VB_W = 300;
const VB_H = 380;
const CX = 150;
const CY = 158;
const RX = 116;
const RY = 126;

function TasbihBeads({
  design,
  count,
}: {
  design: TasbihDesign;
  count: number;
}) {
  // Manik yang sedang "aktif" (mengikuti hitungan) — memberi kesan
  // manik yang baru saja digeser di antara jari.
  const activeIndex = count > 0 ? (count - 1) % BEAD_COUNT : -1;

  const beads = useMemo(() => {
    const arr: { x: number; y: number; idx: number }[] = [];
    // Slot 0 (paling bawah) disediakan untuk manik imam, jadi manik biasa
    // menempati slot 1..BEAD_COUNT.
    const slots = BEAD_COUNT + 1;
    for (let k = 1; k <= BEAD_COUNT; k++) {
      const angle = (k / slots) * 2 * Math.PI;
      const x = CX + RX * Math.sin(angle);
      const y = CY + RY * Math.cos(angle);
      arr.push({ x, y, idx: k - 1 });
    }
    return arr;
  }, []);

  const imamX = CX;
  const imamY = CY + RY;

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <RadialGradient id="bead" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor={design.beadLight} />
          <Stop offset="1" stopColor={design.beadDark} />
        </RadialGradient>
        <RadialGradient id="beadActive" cx="0.35" cy="0.28" r="0.9">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.45" stopColor={design.beadLight} />
          <Stop offset="1" stopColor={design.beadDark} />
        </RadialGradient>
        <RadialGradient id="imam" cx="0.35" cy="0.3" r="0.85">
          <Stop offset="0" stopColor={design.beadLight} />
          <Stop offset="1" stopColor={design.imam} />
        </RadialGradient>
      </Defs>

      {/* Benang tasbih */}
      <Ellipse
        cx={CX}
        cy={CY}
        rx={RX}
        ry={RY}
        stroke={design.thread}
        strokeWidth={2}
        fill="none"
      />

      {/* Manik-manik */}
      {beads.map((b) => {
        const isActive = b.idx === activeIndex;
        const r = isActive ? 13.5 : 10.5;
        return (
          <G key={b.idx}>
            <Circle
              cx={b.x}
              cy={b.y}
              r={r}
              fill={isActive ? "url(#beadActive)" : "url(#bead)"}
              stroke={design.thread}
              strokeWidth={0.6}
            />
          </G>
        );
      })}

      {/* Sambungan benang ke manik imam */}
      <Line
        x1={CX}
        y1={CY + RY - 6}
        x2={imamX}
        y2={imamY}
        stroke={design.thread}
        strokeWidth={2}
      />

      {/* Manik imam (penanda) */}
      <Circle
        cx={imamX}
        cy={imamY}
        r={16}
        fill="url(#imam)"
        stroke={design.thread}
        strokeWidth={1}
      />
      <Ellipse
        cx={imamX}
        cy={imamY - 20}
        rx={6}
        ry={9}
        fill="url(#imam)"
        stroke={design.thread}
        strokeWidth={0.8}
      />

      {/* Tassel / rumbai */}
      <Line x1={imamX} y1={imamY + 14} x2={imamX} y2={imamY + 30} stroke={design.tassel} strokeWidth={3} />
      <Path
        d={`M ${imamX - 12} ${imamY + 30} Q ${imamX} ${imamY + 26} ${imamX + 12} ${imamY + 30} L ${imamX + 9} ${imamY + 40} Q ${imamX} ${imamY + 44} ${imamX - 9} ${imamY + 40} Z`}
        fill={design.tassel}
      />
      {[-8, -4, 0, 4, 8].map((dx) => (
        <Line
          key={dx}
          x1={imamX + dx}
          y1={imamY + 40}
          x2={imamX + dx * 1.4}
          y2={imamY + 66}
          stroke={design.tassel}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen utama
// ─────────────────────────────────────────────────────────────────────────────
export default function TasbihScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Tasbih state
  const [count, setCount] = useState(0);
  const [laps, setLaps] = useState(0);
  const [total, setTotal] = useState(0);
  const [designId, setDesignId] = useState(DEFAULT_DESIGN_ID);
  const [presetIdx, setPresetIdx] = useState(0);
  const [vibrate, setVibrate] = useState(true);
  const [showDesigns, setShowDesigns] = useState(false);
  const loadedRef = useRef(false);

  const design =
    TASBIH_DESIGNS.find((d) => d.id === designId) ?? TASBIH_DESIGNS[0];
  const preset = TASBIH_DZIKIR_PRESETS[presetIdx];
  const target = preset.target;

  // Muat state tersimpan
  useEffect(() => {
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          K_COUNT,
          K_LAPS,
          K_TOTAL,
          K_DESIGN,
          K_PRESET,
          K_VIBRATE,
        ]);
        const map = Object.fromEntries(entries);
        if (map[K_COUNT] != null) setCount(parseInt(map[K_COUNT]!, 10) || 0);
        if (map[K_LAPS] != null) setLaps(parseInt(map[K_LAPS]!, 10) || 0);
        if (map[K_TOTAL] != null) setTotal(parseInt(map[K_TOTAL]!, 10) || 0);
        if (map[K_DESIGN]) setDesignId(map[K_DESIGN]!);
        if (map[K_PRESET] != null) {
          const i = parseInt(map[K_PRESET]!, 10);
          if (i >= 0 && i < TASBIH_DZIKIR_PRESETS.length) setPresetIdx(i);
        }
        if (map[K_VIBRATE] != null) setVibrate(map[K_VIBRATE] === "1");
      } catch {
        // abaikan, gunakan default
      } finally {
        loadedRef.current = true;
      }
    })();
  }, []);

  // Simpan perubahan (setelah load awal)
  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.multiSet([
      [K_COUNT, String(count)],
      [K_LAPS, String(laps)],
      [K_TOTAL, String(total)],
    ]).catch(() => {});
  }, [count, laps, total]);

  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(K_DESIGN, designId).catch(() => {});
  }, [designId]);

  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(K_PRESET, String(presetIdx)).catch(() => {});
  }, [presetIdx]);

  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(K_VIBRATE, vibrate ? "1" : "0").catch(() => {});
  }, [vibrate]);

  const buzz = useCallback(
    (ms: number) => {
      if (!vibrate || Platform.OS === "web") return;
      try {
        Vibration.vibrate(ms);
      } catch {
        // sebagian perangkat tidak mendukung
      }
    },
    [vibrate]
  );

  const handleTap = useCallback(() => {
    setCount((c) => {
      const next = c + 1;
      if (next >= target) {
        // Satu putaran selesai
        setLaps((l) => l + 1);
        buzz(120);
        setTotal((t) => t + 1);
        return 0;
      }
      buzz(15);
      setTotal((t) => t + 1);
      return next;
    });
  }, [target, buzz]);

  const handleReset = useCallback(() => {
    Alert.alert(
      "Reset Hitungan",
      "Kembalikan hitungan dan putaran ke nol? Total keseluruhan tetap tersimpan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            setCount(0);
            setLaps(0);
            buzz(30);
          },
        },
      ]
    );
  }, [buzz]);

  const changePreset = useCallback(() => {
    setPresetIdx((i) => (i + 1) % TASBIH_DZIKIR_PRESETS.length);
    setCount(0);
  }, []);

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <FontAwesome name="arrow-left" size={16} color={Colors.textLight} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Tasbih Digital</Text>
      <View style={styles.headerAction} />
    </View>
  );

  const renderTasbih = () => (
    <ScrollView
      contentContainerStyle={styles.tasbihScroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Dzikir aktif */}
      <TouchableOpacity style={styles.dzikirSelector} onPress={changePreset} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          {preset.arab ? (
            <Text style={styles.dzikirArab}>{preset.arab}</Text>
          ) : null}
          <Text style={styles.dzikirLatin}>{preset.latin}</Text>
          {preset.arti ? <Text style={styles.dzikirArti}>{preset.arti}</Text> : null}
        </View>
        <View style={styles.dzikirSwap}>
          <FontAwesome name="exchange" size={13} color={Colors.primary} />
          <Text style={styles.dzikirSwapText}>Ganti</Text>
        </View>
      </TouchableOpacity>

      {/* Panel tasbih fisik */}
      <View style={[styles.tasbihPanel, { backgroundColor: design.bgTop }]}>
        <View style={styles.panelStatsRow}>
          <View style={styles.panelStat}>
            <Text style={[styles.panelStatVal, { color: design.onBg }]}>{laps}</Text>
            <Text style={[styles.panelStatLbl, { color: design.onBg }]}>Putaran</Text>
          </View>
          <View style={styles.panelStat}>
            <Text style={[styles.panelStatVal, { color: design.onBg }]}>{target}</Text>
            <Text style={[styles.panelStatLbl, { color: design.onBg }]}>Target</Text>
          </View>
          <View style={styles.panelStat}>
            <Text style={[styles.panelStatVal, { color: design.onBg }]}>{total}</Text>
            <Text style={[styles.panelStatLbl, { color: design.onBg }]}>Total</Text>
          </View>
        </View>

        <Pressable
          style={styles.beadsArea}
          onPress={handleTap}
          android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
        >
          <View style={styles.beadsSvgWrap}>
            <TasbihBeads design={design} count={count} />
          </View>
          {/* Angka hitungan di tengah loop */}
          <View style={styles.counterCenter} pointerEvents="none">
            <Text style={[styles.counterNum, { color: design.onBg }]}>{count}</Text>
            <Text style={[styles.counterOf, { color: design.onBg }]}>/ {target}</Text>
          </View>
        </Pressable>

        <Text style={[styles.tapHint, { color: design.onBg }]}>
          Ketuk area tasbih untuk menghitung
        </Text>
      </View>

      {/* Kontrol */}
      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={() => setVibrate((v) => !v)}>
          <FontAwesome
            name={vibrate ? "bell" : "bell-slash-o"}
            size={16}
            color={Colors.primary}
          />
          <Text style={styles.ctrlLabel}>{vibrate ? "Getar Aktif" : "Getar Mati"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => setShowDesigns((s) => !s)}
        >
          <FontAwesome name="paint-brush" size={15} color={Colors.primary} />
          <Text style={styles.ctrlLabel}>Desain</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.ctrlBtn, styles.ctrlReset]} onPress={handleReset}>
          <FontAwesome name="refresh" size={15} color={Colors.error} />
          <Text style={[styles.ctrlLabel, { color: Colors.error }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Pemilih desain */}
      {showDesigns && (
        <View style={styles.designPicker}>
          <Text style={styles.designTitle}>Pilih Desain Tasbih</Text>
          <View style={styles.designGrid}>
            {TASBIH_DESIGNS.map((d) => {
              const selected = d.id === designId;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.designCard, selected && styles.designCardSel]}
                  onPress={() => setDesignId(d.id)}
                >
                  <View style={styles.designSwatchRow}>
                    <View style={[styles.swatch, { backgroundColor: d.beadLight }]} />
                    <View style={[styles.swatch, { backgroundColor: d.beadDark }]} />
                    <View style={[styles.swatch, { backgroundColor: d.tassel }]} />
                  </View>
                  <Text style={styles.designName} numberOfLines={1}>
                    {d.nama}
                  </Text>
                  {selected && (
                    <View style={styles.designCheck}>
                      <FontAwesome name="check-circle" size={16} color={Colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderTasbih()}
    </View>
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: Colors.textLight },
  headerAction: { width: 36, height: 36 },

  // Tasbih
  tasbihScroll: { padding: 16, paddingBottom: 40 },
  dzikirSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    ...CARD_SHADOW,
  },
  dzikirArab: {
    fontSize: 24,
    color: Colors.text,
    fontFamily: "Amiri",
    textAlign: "right",
    lineHeight: 42,
    marginBottom: 4,
  },
  dzikirLatin: { fontSize: 15, fontWeight: "700", color: Colors.primary },
  dzikirArti: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  dzikirSwap: { alignItems: "center", gap: 3, marginLeft: 10 },
  dzikirSwapText: { fontSize: 11, color: Colors.primary, fontWeight: "600" },

  tasbihPanel: {
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    marginBottom: 16,
    ...CARD_SHADOW,
  },
  panelStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 8,
  },
  panelStat: { alignItems: "center" },
  panelStatVal: { fontSize: 20, fontWeight: "800" },
  panelStatLbl: { fontSize: 11, opacity: 0.8, marginTop: 1 },

  beadsArea: {
    width: "100%",
    aspectRatio: VB_W / VB_H,
    maxWidth: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  beadsSvgWrap: { ...StyleSheet.absoluteFillObject },
  counterCenter: {
    position: "absolute",
    top: "26%",
    alignItems: "center",
    justifyContent: "center",
  },
  counterNum: { fontSize: 64, fontWeight: "900", lineHeight: 68 },
  counterOf: { fontSize: 15, fontWeight: "600", opacity: 0.7, marginTop: -2 },
  tapHint: { fontSize: 12, opacity: 0.75, marginTop: 4 },

  controlRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  ctrlBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#fff",
    paddingVertical: 13,
    borderRadius: 12,
    ...CARD_SHADOW,
  },
  ctrlReset: { backgroundColor: "#FDECEA" },
  ctrlLabel: { fontSize: 12.5, fontWeight: "600", color: Colors.primary },

  // Design picker
  designPicker: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    ...CARD_SHADOW,
  },
  designTitle: { fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 12 },
  designGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  designCard: {
    width: "31%",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 10,
    alignItems: "center",
    backgroundColor: Colors.backgroundLight,
  },
  designCardSel: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  designSwatchRow: { flexDirection: "row", gap: 3, marginBottom: 8 },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 0.5, borderColor: "rgba(0,0,0,0.15)" },
  designName: { fontSize: 11, fontWeight: "600", color: Colors.text, textAlign: "center" },
  designCheck: { position: "absolute", top: 4, right: 4 },

});
