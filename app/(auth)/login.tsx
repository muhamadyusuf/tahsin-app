import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSSO, useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Colors } from "@/lib/constants";

let useSignInWithGoogle: any;
if (Platform.OS !== "web") {
  useSignInWithGoogle =
    require("@clerk/expo/google").useSignInWithGoogle;
}

export default function LoginScreen() {
  const nativeGoogle = Platform.OS !== "web" ? useSignInWithGoogle() : null;
  const { startSSOFlow } = useSSO();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (isSignedIn) {
    return null;
  }

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      if (Platform.OS === "web") {
        // Web: use Clerk SSO OAuth redirect flow
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy: "oauth_google",
        });

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.replace("/");
        }
      } else {
        // Native: use native Google Sign-In
        const { createdSessionId, setActive } =
          await nativeGoogle.startGoogleAuthenticationFlow();

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.replace("/");
        }
      }
    } catch (err: any) {
      if (err.code === "SIGN_IN_CANCELLED" || err.code === "-5") {
        return;
      }
      Alert.alert(
        "Gagal Masuk",
        err.message || "Terjadi kesalahan saat login dengan Google"
      );
      console.error("Google sign-in error:", JSON.stringify(err, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.appName}>Tahsin</Text>
          <Text style={styles.tagline}>Belajar Al-Qur'an dengan Benar</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Selamat Datang</Text>
          <Text style={styles.subtitle}>
            Masuk dengan akun Google untuk melanjutkan
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              loading && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>
                  Masuk dengan Google
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  appName: {
    fontSize: 48,
    fontWeight: "bold",
    color: Colors.textLight,
  },
  tagline: {
    fontSize: 16,
    color: Colors.textLight,
    opacity: 0.8,
    marginTop: 8,
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  googleButton: {
    backgroundColor: "#4285F4",
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  googleIcon: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 28,
    height: 28,
    textAlign: "center",
    lineHeight: 28,
    borderRadius: 4,
    overflow: "hidden",
  },
  googleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
