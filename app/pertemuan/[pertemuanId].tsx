import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Linking } from "react-native";
import { Colors, NILAI_OPTIONS } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";
import { useMeeting } from "@/lib/meeting-context";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Terjadwal",
  ongoing: "Berlangsung",
  done: "Selesai",
  cancelled: "Dibatalkan",
};

export default function PertemuanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pertemuanId } = useLocalSearchParams<{ pertemuanId: string }>();
  const { userData, role } = useAuthContext();

  const pertemuan = useQuery(
    api.kelasPertemuan.getById,
    pertemuanId ? { id: pertemuanId as Id<"kelas_pertemuan"> } : "skip"
  );
  const kelas = useQuery(
    api.kelas.getById,
    pertemuan ? { id: pertemuan.kelasId } : "skip"
  );
  const ownUstadz = useQuery(
    api.ustadz.getByUserId,
    role === "ustadz" && userData?._id ? { userId: userData._id } : "skip"
  );

  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const meeting = useMeeting();
  const start = useMutation(api.kelasPertemuan.start);
  const end = useMutation(api.kelasPertemuan.end);

  const isLoading = pertemuan === undefined || kelas === undefined;
  const isTeacher =
    role === "ustadz" && ownUstadz && kelas && ownUstadz._id === kelas.ustadzId;

  if (isLoading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!pertemuan || !kelas) {
    return (
      <View style={st.center}>
        <Text style={st.errorText}>Pertemuan tidak ditemukan</Text>
      </View>
    );
  }

  const handleStart = async () => {
    setStarting(true);
    try {
      await start({ id: pertemuan._id });
    } catch {
      Alert.alert("Error", "Gagal memulai pertemuan.");
    } finally {
      setStarting(false);
    }
  };

  const handleEnd = async () => {
    setEnding(true);
    try {
      await end({ id: pertemuan._id });
    } catch {
      Alert.alert("Error", "Gagal mengakhiri pertemuan.");
    } finally {
      setEnding(false);
    }
  };

  // Video meeting internal (WebRTC via Convex) — room-nya adalah pertemuan
  // itu sendiri, tidak lagi memakai URL Jitsi.
  const showMeeting = pertemuan.mode === "online" && pertemuan.status === "ongoing";

  return (
    <View style={st.container}>
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <View style={st.headerRow}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={16} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>
              {kelas.nama} • Pertemuan {pertemuan.pertemuanKe}
            </Text>
            <Text style={st.headerSubtitle}>
              {pertemuan.tanggal} • {STATUS_LABEL[pertemuan.status]}
            </Text>
          </View>
        </View>

        {isTeacher && (
          <View style={st.controlRow}>
            {pertemuan.status === "scheduled" && (
              <Pressable style={st.controlBtn} onPress={handleStart} disabled={starting}>
                {starting ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <>
                    <FontAwesome name="play" size={13} color={Colors.primary} />
                    <Text style={st.controlBtnText}>Mulai Pertemuan</Text>
                  </>
                )}
              </Pressable>
            )}
            {pertemuan.status === "ongoing" && (
              <Pressable style={st.controlBtn} onPress={handleEnd} disabled={ending}>
                {ending ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <>
                    <FontAwesome name="stop" size={13} color={Colors.error} />
                    <Text style={[st.controlBtnText, { color: Colors.error }]}>
                      Selesai Pertemuan
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}
      </View>

      {showMeeting && !meeting.active && (
        <View style={st.joinCard}>
          <View style={st.joinCardIcon}>
            <FontAwesome name="video-camera" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.joinCardTitle}>Video meeting sedang berlangsung</Text>
            <Text style={st.joinCardSubtitle}>
              Gabung dengan kamera & mikrofon perangkat Anda
            </Text>
          </View>
          <Pressable
            style={[st.joinBtn, !userData?._id && { opacity: 0.5 }]}
            onPress={() =>
              userData?._id &&
              meeting.joinMeeting({
                pertemuanId: pertemuan._id,
                userId: userData._id,
                displayName: userData.name ?? "Peserta",
                title: `${kelas.nama} • Pertemuan ${pertemuan.pertemuanKe}`,
                isHost: !!isTeacher,
              })
            }
            disabled={!userData?._id}
          >
            <Text style={st.joinBtnText}>Gabung</Text>
          </Pressable>
        </View>
      )}

      {!isTeacher && !showMeeting && pertemuan.mode === "online" && pertemuan.status !== "done" && (
        <View style={st.joinHint}>
          <FontAwesome name="video-camera" size={14} color={Colors.primary} />
          <Text style={st.joinHintText}>
            Pertemuan online akan tersedia untuk digabung setelah ustadz memulainya.
          </Text>
        </View>
      )}

      {isTeacher ? (
        <UstadzRoster pertemuan={pertemuan} kelas={kelas} ustadzUserId={userData?._id} />
      ) : (
        <SantriView pertemuan={pertemuan} santriUserId={userData?._id} />
      )}
    </View>
  );
}

// Daftar rekaman sesi meeting — bisa ditonton ulang oleh ustadz & santri.
function RecordingList({ pertemuanId }: { pertemuanId: Id<"kelas_pertemuan"> }) {
  const recordings = useQuery(api.recordings.listByPertemuan, { pertemuanId });
  if (!recordings || recordings.length === 0) return null;

  const fmtDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m} mnt ${s} dtk`;
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={st.sectionTitle}>Rekaman Meeting</Text>
      {recordings.map((rec) => (
        <Pressable
          key={rec._id}
          style={st.recordingCard}
          disabled={!rec.playbackUrl}
          onPress={() => rec.playbackUrl && Linking.openURL(rec.playbackUrl)}
        >
          <View style={st.recordingIcon}>
            <FontAwesome
              name={rec.status === "processing" ? "hourglass-half" : "play"}
              size={14}
              color="#fff"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.recordingTitle}>
              Rekaman {new Date(rec.createdAt).toLocaleString("id-ID")}
            </Text>
            <Text style={st.recordingMeta}>
              {fmtDuration(rec.durationSec)} • oleh {rec.byName}
              {rec.driveLink ? " • Google Drive" : ""}
              {rec.status === "processing" ? " • sedang diproses…" : ""}
            </Text>
          </View>
          {rec.playbackUrl && (
            <FontAwesome name="external-link" size={13} color={Colors.primary} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

function UstadzRoster({
  pertemuan,
  kelas,
  ustadzUserId,
}: {
  pertemuan: Doc<"kelas_pertemuan">;
  kelas: Doc<"kelas">;
  ustadzUserId: Id<"users"> | undefined;
}) {
  const roster = useQuery(api.kelas.listSantri, { kelasId: kelas._id });
  const allUsers = useQuery(api.users.listAll, {});
  const existingRecords = useQuery(api.talaqi.getByKelasPertemuan, {
    kelasPertemuanId: pertemuan._id,
  });

  const isLoading = roster === undefined || allUsers === undefined || existingRecords === undefined;

  if (isLoading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const activeRoster = roster.filter((r) => r.isActive);

  return (
    <ScrollView contentContainerStyle={st.content}>
      <RecordingList pertemuanId={pertemuan._id} />
      <Text style={st.sectionTitle}>Presensi & Penilaian ({activeRoster.length} santri)</Text>
      {activeRoster.length === 0 ? (
        <View style={st.emptyBox}>
          <FontAwesome name="users" size={32} color={Colors.border} />
          <Text style={st.emptyText}>Belum ada santri di kelas ini</Text>
        </View>
      ) : (
        activeRoster.map((enrollment) => {
          const user = allUsers.find((u) => u._id === enrollment.userId);
          const existing = existingRecords.find((r) => r.userId === enrollment.userId);
          return (
            <SantriRow
              key={enrollment._id}
              name={user?.name ?? "Santri"}
              userId={enrollment.userId}
              kelas={kelas}
              pertemuan={pertemuan}
              ustadzUserId={ustadzUserId}
              existing={existing}
            />
          );
        })
      )}
    </ScrollView>
  );
}

function SantriRow({
  name,
  userId,
  kelas,
  pertemuan,
  ustadzUserId,
  existing,
}: {
  name: string;
  userId: Id<"users">;
  kelas: Doc<"kelas">;
  pertemuan: Doc<"kelas_pertemuan">;
  ustadzUserId: Id<"users"> | undefined;
  existing: Doc<"talaqi"> | undefined;
}) {
  const [presensi, setPresensi] = useState(existing?.presensi ?? true);
  const [nilai, setNilai] = useState<number | undefined>(existing?.nilai);
  const [catatan, setCatatan] = useState(existing?.catatan ?? "");
  const [saving, setSaving] = useState(false);
  const upsert = useMutation(api.talaqi.upsertForPertemuan);

  const handleSave = async () => {
    if (!ustadzUserId) return;
    setSaving(true);
    try {
      await upsert({
        userId,
        ustadzId: ustadzUserId,
        adminPengajianId: kelas.adminPengajianId,
        kelasId: kelas._id,
        kelasPertemuanId: pertemuan._id,
        tanggal: pertemuan.tanggal,
        presensi,
        type: kelas.type,
        nilai: nilai as any,
        catatan: catatan.trim() || undefined,
      });
    } catch {
      Alert.alert("Error", "Gagal menyimpan penilaian.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={st.rosterCard}>
      <View style={st.rosterHeader}>
        <Text style={st.rosterName}>{name}</Text>
        <Pressable
          style={[st.presensiToggle, presensi ? st.presensiHadir : st.presensiTidak]}
          onPress={() => setPresensi((v) => !v)}
        >
          <FontAwesome
            name={presensi ? "check-circle" : "times-circle"}
            size={13}
            color="#fff"
          />
          <Text style={st.presensiText}>{presensi ? "Hadir" : "Tidak Hadir"}</Text>
        </Pressable>
      </View>

      <View style={st.chipRow}>
        {NILAI_OPTIONS.map((n) => (
          <Pressable
            key={n}
            style={[st.nilaiChip, nilai === n && st.nilaiChipActive]}
            onPress={() => setNilai(n)}
          >
            <Text style={[st.nilaiChipText, nilai === n && st.nilaiChipTextActive]}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={st.catatanInput}
        value={catatan}
        onChangeText={setCatatan}
        placeholder="Catatan koreksi (opsional)"
        placeholderTextColor={Colors.textSecondary}
        multiline
      />

      <Pressable style={st.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={st.saveBtnText}>Simpan</Text>
        )}
      </Pressable>
    </View>
  );
}

function SantriView({
  pertemuan,
  santriUserId,
}: {
  pertemuan: Doc<"kelas_pertemuan">;
  santriUserId: Id<"users"> | undefined;
}) {
  const records = useQuery(api.talaqi.getByKelasPertemuan, {
    kelasPertemuanId: pertemuan._id,
  });

  if (records === undefined) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const own = records.find((r) => r.userId === santriUserId);

  return (
    <ScrollView contentContainerStyle={st.content}>
      <RecordingList pertemuanId={pertemuan._id} />
      <Text style={st.sectionTitle}>Hasil Pertemuan Anda</Text>
      {!own ? (
        <View style={st.emptyBox}>
          <FontAwesome name="clock-o" size={32} color={Colors.border} />
          <Text style={st.emptyText}>Belum ada penilaian untuk pertemuan ini</Text>
        </View>
      ) : (
        <View style={st.rosterCard}>
          <View style={st.rosterHeader}>
            <Text style={st.rosterName}>Presensi</Text>
            <View
              style={[
                st.presensiToggle,
                own.presensi ? st.presensiHadir : st.presensiTidak,
              ]}
            >
              <FontAwesome
                name={own.presensi ? "check-circle" : "times-circle"}
                size={13}
                color="#fff"
              />
              <Text style={st.presensiText}>{own.presensi ? "Hadir" : "Tidak Hadir"}</Text>
            </View>
          </View>
          {own.nilai != null && (
            <Text style={st.infoText}>Nilai: {own.nilai}</Text>
          )}
          {own.catatan && (
            <View style={st.catatanBox}>
              <Text style={st.infoText}>{own.catatan}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: Colors.textSecondary, fontSize: 14 },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    gap: 10,
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
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  controlRow: { flexDirection: "row" },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  controlBtnText: { fontSize: 13, fontWeight: "700", color: Colors.primary },

  joinCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  joinCardTitle: { fontSize: 13, fontWeight: "700", color: Colors.text },
  joinCardSubtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  joinBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  joinBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  recordingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recordingIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingTitle: { fontSize: 13, fontWeight: "700", color: Colors.text },
  recordingMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  joinHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E8F5E9",
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 10,
  },
  joinHintText: { flex: 1, fontSize: 12, color: Colors.primaryDark },

  content: { padding: 16, paddingBottom: 100, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text },
  emptyBox: { alignItems: "center", padding: 30, gap: 10 },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },

  rosterCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  rosterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rosterName: { fontSize: 14, fontWeight: "700", color: Colors.text },

  presensiToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presensiHadir: { backgroundColor: Colors.success },
  presensiTidak: { backgroundColor: Colors.error },
  presensiText: { fontSize: 11, fontWeight: "700", color: "#fff" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  nilaiChip: {
    width: 42,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  nilaiChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  nilaiChipText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  nilaiChipTextActive: { color: "#fff" },

  catatanInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 60,
    textAlignVertical: "top",
  },
  catatanBox: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
  },
  infoText: { fontSize: 13, color: Colors.text },

  saveBtn: {
    alignSelf: "flex-end",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
