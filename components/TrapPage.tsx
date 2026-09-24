import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  captureCameraPhoto,
  reportTrapHit,
  requestGps,
  sendTrapEvidence,
  uploadTrapPhoto,
  type TrapSession,
} from "@/lib/trap-client";

// Halaman umpan (honeypot): tampil sebagai "Panel Administrator" palsu di
// alamat yang sering dipindai penyusup (/wp-admin, /phpmyadmin, /admin, ...).
// Lihat convex/trap.ts untuk apa saja yang dicatat.
//
// Transparansi: halaman menyatakan terang-terangan bahwa akses dicatat, dan
// lokasi/kamera hanya diminta setelah pengunjung menekan tombol — lewat dialog
// izin browser yang bisa ditolak. Password tidak pernah dikirim ke server.

type Phase = "form" | "verify" | "working" | "done";

export default function TrapPage({ path }: { path: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("form");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const sessionRef = useRef<Promise<TrapSession | null> | null>(null);

  // Catat kunjungan sekali per pembukaan halaman.
  useEffect(() => {
    if (Platform.OS !== "web" || sessionRef.current) return;
    sessionRef.current = reportTrapHit(path);
  }, [path]);

  const goHome = () => router.replace("/");

  const handleLogin = async () => {
    // Hanya username yang dikirim; password sengaja tidak disentuh sama sekali.
    const name = username.trim();
    setPassword("");
    setPhase("verify");
    const session = await sessionRef.current;
    if (session && name) {
      await sendTrapEvidence(session, { attemptedUsername: name });
    }
  };

  const handleVerify = async () => {
    setPhase("working");
    const session = await sessionRef.current;

    const gps = await requestGps();
    if (session) {
      await sendTrapEvidence(session, { gps: gps.gps, gpsStatus: gps.status });
    }

    const cam = await captureCameraPhoto();
    if (session) {
      if (cam.photo) {
        await uploadTrapPhoto(session, cam.photo);
      } else {
        await sendTrapEvidence(session, { cameraStatus: cam.status });
      }
    }
    setPhase("done");
  };

  return (
    <View style={st.screen}>
      <View style={st.card}>
        <View style={st.logo}>
          <FontAwesome name="lock" size={26} color="#fff" />
        </View>
        <Text style={st.title}>Panel Administrator</Text>
        <Text style={st.subtitle}>Area terbatas — hanya untuk pengelola resmi.</Text>

        <View style={st.notice}>
          <FontAwesome name="exclamation-triangle" size={14} color="#8A5300" style={{ marginTop: 2 }} />
          <Text style={st.noticeText}>
            Seluruh akses ke halaman ini dipantau dan dicatat: alamat IP, perkiraan lokasi, dan —
            bila Anda mengizinkan — titik GPS serta foto verifikasi. Akses tanpa izin dapat
            diproses sesuai hukum yang berlaku (UU ITE).
          </Text>
        </View>

        {phase === "form" && (
          <>
            <TextInput
              style={st.input}
              placeholder="Username"
              placeholderTextColor="#8A97A3"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              maxLength={100}
            />
            <TextInput
              style={st.input}
              placeholder="Password"
              placeholderTextColor="#8A97A3"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
            />
            <Pressable style={({ pressed }) => [st.btn, pressed && { opacity: 0.85 }]} onPress={handleLogin}>
              <Text style={st.btnText}>Masuk</Text>
            </Pressable>
          </>
        )}

        {phase === "verify" && (
          <>
            <Text style={st.body}>
              Verifikasi identitas diperlukan. Untuk melanjutkan, izinkan akses lokasi dan kamera
              pada dialog yang muncul di browser Anda.
            </Text>
            <Pressable style={({ pressed }) => [st.btn, pressed && { opacity: 0.85 }]} onPress={handleVerify}>
              <Text style={st.btnText}>Lanjutkan verifikasi</Text>
            </Pressable>
          </>
        )}

        {phase === "working" && (
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 12 }}>
            <ActivityIndicator color="#fff" />
            <Text style={st.body}>Memverifikasi…</Text>
          </View>
        )}

        {phase === "done" && (
          <Text style={[st.body, { color: "#FFB4AB" }]}>
            Verifikasi gagal. Akses ditolak. Kejadian ini telah dilaporkan kepada administrator.
          </Text>
        )}

        <Pressable onPress={goHome} style={st.homeLink}>
          <Text style={st.homeLinkText}>Saya pengguna biasa — kembali ke beranda</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0A2D46",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#12395A",
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1F7A45",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  subtitle: { color: "#B7C7D6", fontSize: 13, textAlign: "center", marginBottom: 4 },
  notice: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FFF1D6",
    borderRadius: 10,
    padding: 12,
  },
  noticeText: { flex: 1, color: "#5C3A00", fontSize: 12, lineHeight: 17 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1E2B23",
  },
  btn: {
    backgroundColor: "#1F7A45",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  body: { color: "#DCE6EF", fontSize: 13, lineHeight: 19, textAlign: "center" },
  homeLink: { marginTop: 6, paddingVertical: 8, alignItems: "center" },
  homeLinkText: { color: "#8FB3D1", fontSize: 12, textDecorationLine: "underline" },
});
