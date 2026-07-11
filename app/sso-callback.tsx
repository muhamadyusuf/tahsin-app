import { Colors } from "@/lib/constants";
import { useAuth, useClerk } from "@clerk/expo";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates"; // Opsi ampuh untuk force reload
import { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function SSOCallbackScreen() {
  const clerk = useClerk();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const handled = useRef(false);
  const navigated = useRef(false);

  const navigateHome = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;

    // Di web, router.replace dari halaman OAuth callback di-drop oleh
    // navigator berapapun delay-nya (terbukti dari log "navigating home"
    // tanpa pindah halaman). Full reload ke "/" adalah jalur yang andal:
    // ClerkProvider bootstrap ulang dengan sesi yang baru aktif, lalu
    // index.tsx mengarahkan user sesuai role (tilawah/dashboard/pilih-role).
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.replace("/");
      return;
    }

    // Naikkan delay untuk memberi waktu Expo Router selesai memproses
    // deep link SSO dan Convex menerima JWT dari sesi terbaru Clerk.
    setTimeout(async () => {
      try {
        // Opsi 1: Hapus seluruh stack navigasi yang mungkin masih menggantung
        if (router.canDismiss()) {
          router.dismissAll();
        }
        router.replace("/tilawah");
        Updates.reloadAsync();

        // Opsi 2 (Force Reload): Jika index.tsx Anda masih nge-bug karena
        // Convex tidak kunjung merespon state baru, aktifkan baris di bawah.
        // Ini setara dengan melakukan hard-refresh pada aplikasi.
        // await Updates.reloadAsync();
      } catch (error) {
        console.error("Navigation error:", error);
        router.replace("/tilawah");
        Updates.reloadAsync();
      }
    }, 500); // Naikkan delay dari 100ms menjadi 500ms
  }, [router]);

  const navigateLogin = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.replace("/login");
      return;
    }
    setTimeout(() => {
      router.replace("/(auth)/login");
    }, 100);
  }, [router]);

  // Watch for auth state changes
  useEffect(() => {
    if (isSignedIn) {
      console.log("SSO callback: user is signed in, navigating home");
      navigateHome();
    }
  }, [isSignedIn, navigateHome]);

  useEffect(() => {
    if (!clerk.loaded || handled.current) return;
    handled.current = true;

    // Registrasi pertama via Google: Clerk menandai attempt sebagai
    // "transferable" (sign-in harus ditransfer jadi sign-up akun baru).
    // handleRedirectCallback tidak selalu menuntaskan transfer ini di
    // custom flow, jadi selesaikan manual lalu aktifkan sesinya.
    const completeTransferIfNeeded = async () => {
      const client = clerk.client;
      if (!client || clerk.session) return;

      if (client.signIn.firstFactorVerification.status === "transferable") {
        console.log("SSO transfer: sign-in transferable, creating new sign-up");
        const res = await client.signUp.create({ transfer: true });
        if (res.status === "complete" && res.createdSessionId) {
          console.log("SSO transfer: sign-up complete, activating session");
          await clerk.setActive({ session: res.createdSessionId });
        }
        return;
      }

      // Kebalikannya: mulai dari sign-up padahal akun sudah ada.
      if (
        client.signUp.verifications.externalAccount.status === "transferable"
      ) {
        console.log("SSO transfer: sign-up transferable, creating new sign-in");
        const res = await client.signIn.create({ transfer: true });
        if (res.status === "complete" && res.createdSessionId) {
          console.log("SSO transfer: sign-in complete, activating session");
          await clerk.setActive({ session: res.createdSessionId });
        }
      }
    };

    const handle = async () => {
      try {
        await clerk.handleRedirectCallback({
          signInForceRedirectUrl: "/tilawah",
          signInFallbackRedirectUrl: "/tilawah",
          signUpForceRedirectUrl: "/tilawah",
          signUpFallbackRedirectUrl: "/tilawah",
        });
      } catch (err) {
        console.error("SSO callback error:", err);
      }

      try {
        console.log("SSO transfer: checking if transfer is needed");
        await completeTransferIfNeeded();
      } catch (err) {
        console.error("SSO transfer error:", err);
      }

      // Tunggu sampai sesi Clerk benar-benar aktif sebelum pindah halaman.
      // Jangan pakai timeout buta: pembuatan akun pertama bisa lambat, dan
      // melempar user ke login sebelum sesi jadi membuat mereka "stuck".
      const startedAt = Date.now();
      const waitForSession = () => {
        if (navigated.current) return;
        if (clerk.session) {
          console.log("SSO session active, navigating home");
          navigateHome();
          return;
        }
        if (Date.now() - startedAt > 15000) {
          console.log(
            "SSO session not active after 15 seconds, navigating to login",
          );
          navigateLogin();
          return;
        }
        setTimeout(waitForSession, 250);
      };
      waitForSession();
    };

    handle();
  }, [clerk, clerk.loaded, navigateHome, navigateLogin]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Memproses login...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  text: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
