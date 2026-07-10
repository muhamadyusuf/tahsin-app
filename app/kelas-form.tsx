import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors, TALAQI_TYPES } from "@/lib/constants";

const HARI_LABEL = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

type JadwalRow = { hari: 0 | 1 | 2 | 3 | 4 | 5 | 6; jamMulai: string; jamSelesai: string };

export default function KelasFormScreen() {
  const { id, adminPengajianId } = useLocalSearchParams<{
    id?: string;
    adminPengajianId?: string;
  }>();
  const router = useRouter();
  const isEdit = !!id;

  const existing = useQuery(
    api.kelas.getById,
    id ? { id: id as Id<"kelas"> } : "skip"
  );
  const existingJadwal = useQuery(
    api.kelas.listJadwal,
    id ? { kelasId: id as Id<"kelas"> } : "skip"
  );
  const ustadzList = useQuery(
    api.ustadz.listByAdminPengajian,
    adminPengajianId || existing?.adminPengajianId
      ? {
          adminPengajianId: (adminPengajianId ??
            existing?.adminPengajianId) as Id<"admin_pengajian">,
        }
      : "skip"
  );
  const allUsers = useQuery(api.users.listAll, {});

  const createKelas = useMutation(api.kelas.create);
  const updateKelas = useMutation(api.kelas.update);
  const setJadwal = useMutation(api.kelas.setJadwal);

  const [nama, setNama] = useState("");
  const [type, setType] = useState<"tahsin" | "murojaah" | "tahfidz">("tahsin");
  const [modeDefault, setModeDefault] = useState<"online" | "offline">("offline");
  const [ustadzId, setUstadzId] = useState<Id<"ustadz"> | null>(null);
  const [silabus, setSilabus] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [jadwal, setJadwalRows] = useState<JadwalRow[]>([]);
  const [jumlahPertemuan, setJumlahPertemuan] = useState("8");
  const [tanggalMulai, setTanggalMulai] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existing) {
      setNama(existing.nama);
      setType(existing.type);
      setModeDefault(existing.modeDefault);
      setUstadzId(existing.ustadzId);
      setSilabus(existing.silabus ?? "");
      setIsActive(existing.isActive);
    }
  }, [existing]);

  useEffect(() => {
    if (existingJadwal) {
      setJadwalRows(
        existingJadwal.map((j) => ({
          hari: j.hari,
          jamMulai: j.jamMulai,
          jamSelesai: j.jamSelesai,
        }))
      );
    }
  }, [existingJadwal]);

  const addJadwalRow = () => {
    setJadwalRows((prev) => [...prev, { hari: 1, jamMulai: "16:00", jamSelesai: "17:30" }]);
  };

  const removeJadwalRow = (index: number) => {
    setJadwalRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateJadwalRow = (index: number, patch: Partial<JadwalRow>) => {
    setJadwalRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleSubmit = async () => {
    if (!nama.trim() || !ustadzId) {
      Alert.alert("Error", "Nama kelas dan ustadz wajib diisi.");
      return;
    }
    const targetAdminPengajianId = (adminPengajianId ??
      existing?.adminPengajianId) as Id<"admin_pengajian"> | undefined;
    if (!targetAdminPengajianId) return;

    if (!isEdit) {
      const jumlahNum = parseInt(jumlahPertemuan, 10);
      if (!jumlahNum || jumlahNum <= 0) {
        Alert.alert("Error", "Jumlah pertemuan harus lebih dari 0.");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalMulai)) {
        Alert.alert("Error", "Tanggal mulai harus format YYYY-MM-DD.");
        return;
      }
      if (jadwal.length === 0) {
        Alert.alert("Error", "Tambahkan minimal satu jadwal pertemuan.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateKelas({
          id: id as Id<"kelas">,
          nama: nama.trim(),
          type,
          modeDefault,
          ustadzId,
          silabus: silabus.trim() || undefined,
          isActive,
        });
        await setJadwal({ kelasId: id as Id<"kelas">, jadwal });
        Alert.alert("Berhasil", "Kelas berhasil diperbarui.");
      } else {
        await createKelas({
          adminPengajianId: targetAdminPengajianId,
          ustadzId,
          nama: nama.trim(),
          type,
          modeDefault,
          silabus: silabus.trim() || undefined,
          jumlahPertemuan: parseInt(jumlahPertemuan, 10),
          tanggalMulai,
          jadwal,
        });
        Alert.alert("Berhasil", "Kelas berhasil ditambahkan.");
      }
      router.back();
    } catch {
      Alert.alert("Error", "Gagal menyimpan data kelas.");
    } finally {
      setSubmitting(false);
    }
  };

  if ((isEdit && (!existing || existingJadwal === undefined)) || ustadzList === undefined || allUsers === undefined) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={st.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={st.heading}>{isEdit ? "Edit Kelas" : "Tambah Kelas Baru"}</Text>

      <Text style={st.label}>Nama Kelas *</Text>
      <TextInput
        style={st.input}
        value={nama}
        onChangeText={setNama}
        placeholder="Contoh: Tahsin Kelas Pagi"
        placeholderTextColor={Colors.textSecondary}
      />

      <Text style={st.label}>Jenis</Text>
      <View style={st.chipRow}>
        {TALAQI_TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[st.chip, type === t.value && st.chipActive]}
            onPress={() => setType(t.value as typeof type)}
          >
            <Text style={[st.chipText, type === t.value && st.chipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={st.label}>Mode Pelaksanaan</Text>
      <View style={st.chipRow}>
        {(["offline", "online"] as const).map((m) => (
          <Pressable
            key={m}
            style={[st.chip, modeDefault === m && st.chipActive]}
            onPress={() => setModeDefault(m)}
          >
            <Text style={[st.chipText, modeDefault === m && st.chipTextActive]}>
              {m === "online" ? "Online" : "Offline"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={st.label}>Ustadz Pengampu *</Text>
      <View style={st.chipRow}>
        {ustadzList.length === 0 ? (
          <Text style={st.emptyText}>Belum ada ustadz terdaftar di lembaga ini</Text>
        ) : (
          ustadzList.map((u) => {
            const user = allUsers.find((usr) => usr._id === u.userId);
            return (
              <Pressable
                key={u._id}
                style={[st.chip, ustadzId === u._id && st.chipActive]}
                onPress={() => setUstadzId(u._id)}
              >
                <Text style={[st.chipText, ustadzId === u._id && st.chipTextActive]}>
                  {user?.name ?? "Ustadz"}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      <Text style={st.label}>Silabus</Text>
      <TextInput
        style={[st.input, { height: 80, textAlignVertical: "top" }]}
        value={silabus}
        onChangeText={setSilabus}
        placeholder="Ringkasan materi/silabus kelas (opsional)"
        placeholderTextColor={Colors.textSecondary}
        multiline
      />

      {!isEdit && (
        <>
          <Text style={st.label}>Jumlah Pertemuan *</Text>
          <TextInput
            style={st.input}
            value={jumlahPertemuan}
            onChangeText={setJumlahPertemuan}
            placeholder="8"
            keyboardType="number-pad"
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={st.label}>Tanggal Mulai *</Text>
          <TextInput
            style={st.input}
            value={tanggalMulai}
            onChangeText={setTanggalMulai}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textSecondary}
          />
          <Text style={st.hint}>
            Jadwal pertemuan akan dibuat otomatis mengikuti jadwal mingguan di bawah,
            dimulai dari tanggal ini.
          </Text>
        </>
      )}

      <View style={st.jadwalHeader}>
        <Text style={st.label}>Jadwal Mingguan</Text>
        <Pressable style={st.addJadwalBtn} onPress={addJadwalRow}>
          <FontAwesome name="plus" size={12} color={Colors.primary} />
          <Text style={st.addJadwalText}>Tambah</Text>
        </Pressable>
      </View>

      {jadwal.map((row, index) => (
        <View key={index} style={st.jadwalRow}>
          <View style={st.chipRow}>
            {HARI_LABEL.map((label, hariIdx) => (
              <Pressable
                key={hariIdx}
                style={[st.dayChip, row.hari === hariIdx && st.chipActive]}
                onPress={() => updateJadwalRow(index, { hari: hariIdx as JadwalRow["hari"] })}
              >
                <Text style={[st.chipText, row.hari === hariIdx && st.chipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={st.timeRow}>
            <TextInput
              style={[st.input, st.timeInput]}
              value={row.jamMulai}
              onChangeText={(v) => updateJadwalRow(index, { jamMulai: v })}
              placeholder="16:00"
              placeholderTextColor={Colors.textSecondary}
            />
            <Text style={st.timeSep}>-</Text>
            <TextInput
              style={[st.input, st.timeInput]}
              value={row.jamSelesai}
              onChangeText={(v) => updateJadwalRow(index, { jamSelesai: v })}
              placeholder="17:30"
              placeholderTextColor={Colors.textSecondary}
            />
            <Pressable style={st.removeBtn} onPress={() => removeJadwalRow(index)}>
              <FontAwesome name="trash" size={14} color={Colors.error} />
            </Pressable>
          </View>
        </View>
      ))}

      {isEdit && (
        <View style={st.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Status Aktif</Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: "#ddd", true: Colors.primaryLight }}
            thumbColor={isActive ? Colors.primary : "#f4f3f4"}
          />
        </View>
      )}

      <Pressable
        style={({ pressed }) => [st.submitBtn, pressed && { opacity: 0.85 }, submitting && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <FontAwesome name="check" size={16} color="#fff" />
            <Text style={st.submitBtnText}>{isEdit ? "Simpan Perubahan" : "Tambah Kelas"}</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 20, fontWeight: "700", color: Colors.text, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
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
  emptyText: { fontSize: 13, color: Colors.textSecondary },
  hint: { fontSize: 11, color: Colors.textSecondary, marginTop: 6, lineHeight: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayChip: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  chipTextActive: { color: "#fff" },

  jadwalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  addJadwalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addJadwalText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  jadwalRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeInput: { flex: 1, paddingVertical: 8 },
  timeSep: { color: Colors.textSecondary },
  removeBtn: { padding: 8 },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },

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
