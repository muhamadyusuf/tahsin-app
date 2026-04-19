import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  StatusBar,
  Image,
} from "react-native";
import { useClerk, useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";
import GoogleIcon from "@/components/GoogleIcon";

let useSignInWithGoogle: any;
if (Platform.OS !== "web") {
  useSignInWithGoogle =
    require("@clerk/expo/google").useSignInWithGoogle;
}

const { width, height } = Dimensions.get("window");

export default function LoginScreen() {
  const nativeGoogle = Platform.OS !== "web" ? useSignInWithGoogle() : null;
  const clerk = useClerk();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (isSignedIn) {
    router.replace("/(tabs)/tilawah");
    return null;
  }

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      if (Platform.OS === "web") {
        if (!clerk.client?.signIn) return;
        await clerk.client.signIn.create({
          strategy: "oauth_google",
          redirectUrl: window.location.origin + "/sso-callback",
          actionCompleteRedirectUrl: window.location.origin + "/",
        });
        const { externalVerificationRedirectURL } =
          clerk.client.signIn.firstFactorVerification;
        if (externalVerificationRedirectURL) {
          window.location.href =
            externalVerificationRedirectURL.toString();
        }
      } else {
        const { createdSessionId, setActive } =
          await nativeGoogle.startGoogleAuthenticationFlow();

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.replace("/(tabs)/tilawah");
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
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Hero Area */}
      <View style={styles.heroArea}>
        <Image
          source={require("@/assets/images/login-illustration.png")}
          style={styles.heroImage}
          resizeMode="contain"
        />
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        <View style={styles.pill} />

        <Text style={styles.title}>Tahsin</Text>
        <Text style={styles.subtitle}>
          Belajar membaca Al-Qur'an dengan{"\n"}tajwid yang benar
        </Text>

        {/* Feature pills */}
        <View style={styles.featureRow}>
          <View style={styles.featurePill}>
            <FontAwesome name="book" size={12} color={Colors.primary} />
            <Text style={styles.featurePillText}>Tilawah</Text>
          </View>
          <View style={styles.featurePill}>
            <FontAwesome name="graduation-cap" size={12} color={Colors.primary} />
            <Text style={styles.featurePillText}>Tahsin</Text>
          </View>
          <View style={styles.featurePill}>
            <FontAwesome name="users" size={12} color={Colors.primary} />
            <Text style={styles.featurePillText}>Talaqi</Text>
          </View>
        </View>

        {/* Google Sign In Button */}
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
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <View style={styles.googleIconWrap}>
                <GoogleIcon size={20} />
              </View>
              <Text style={styles.googleButtonText}>Masuk dengan Google</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.terms}>
          Dengan masuk, Anda menyetujui{"\n"}ketentuan penggunaan aplikasi
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },

  // ===== Hero =====
  heroArea: {
    flex: 1.2,
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "hidden",
  },
  heroImage: {
    width: width * 0.85,
    height: width * 0.65,
  },

  // ===== Content =====
  contentArea: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  pill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featurePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },

  // ===== Google Button =====
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: "100%",
    gap: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  googleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  googleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  terms: {
    marginTop: 16,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
});
