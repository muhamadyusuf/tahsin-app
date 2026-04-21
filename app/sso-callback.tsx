import { useEffect, useRef, useCallback } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useClerk, useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Colors } from "@/lib/constants";

export default function SSOCallbackScreen() {
  const clerk = useClerk();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const handled = useRef(false);
  const navigated = useRef(false);

  const navigateHome = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    // Defer navigation to avoid concurrent rendering conflicts
    setTimeout(() => {
      router.replace("/(tabs)/tilawah");
    }, 100);
  }, [router]);

  const navigateLogin = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    setTimeout(() => {
      router.replace("/(auth)/login");
    }, 100);
  }, [router]);

  // Watch for auth state changes
  useEffect(() => {
    if (isSignedIn) {
      navigateHome();
    }
  }, [isSignedIn, navigateHome]);

  useEffect(() => {
    if (!clerk.loaded || handled.current) return;
    handled.current = true;

    const handle = async () => {
      try {
        await clerk.handleRedirectCallback({
          signInForceRedirectUrl: "/",
          signInFallbackRedirectUrl: "/",
          signUpForceRedirectUrl: "/",
          signUpFallbackRedirectUrl: "/",
        });
        // Give Clerk a moment to update auth state
        setTimeout(() => {
          if (!navigated.current) {
            navigateHome();
          }
        }, 500);
      } catch (err: any) {
        console.error("SSO callback error:", err);
        // Wait and check auth state before redirecting to login
        setTimeout(() => {
          if (!navigated.current) {
            navigateLogin();
          }
        }, 1000);
      }
    };

    handle();
  }, [clerk.loaded, navigateHome, navigateLogin]);

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
