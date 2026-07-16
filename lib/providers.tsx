import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Colors } from "./constants";
import { ReCaptchaProvider } from "./recaptcha";

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL as string
);

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string;

if (!publishableKey) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

// On web, ClerkProvider downloads its own SDK bundle from Clerk's servers at
// runtime instead of shipping it in our build — so a cold load with no
// network rejects with this error before Clerk (and everything gated behind
// it) can render at all. That rejection escapes React's render-phase error
// boundaries, so we catch it globally and swap in a friendly retry screen
// instead of letting the raw error crash the page.
function isClerkLoadFailure(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const err = reason as { code?: string; message?: string };
  return (
    err.code === "failed_to_load_clerk_js" ||
    !!err.message?.includes("Failed to load Clerk JS")
  );
}

function ClerkLoadGate({ children }: { children: React.ReactNode }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isClerkLoadFailure(event.reason)) {
        event.preventDefault();
        setFailed(true);
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  if (failed) {
    return (
      <View style={styles.offlineContainer}>
        <Text style={styles.offlineTitle}>Tidak Ada Koneksi Internet</Text>
        <Text style={styles.offlineDesc}>
          Masuk ke aplikasi memerlukan koneksi internet. Sambungkan kembali
          perangkat Anda, lalu coba lagi.
        </Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => window.location.reload()}
        >
          <Text style={styles.retryButtonText}>Coba Lagi</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkLoadGate>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ReCaptchaProvider>
            {children}
          </ReCaptchaProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </ClerkLoadGate>
  );
}

const styles = StyleSheet.create({
  offlineContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: Colors.background,
    gap: 12,
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  offlineDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: Colors.textLight,
    fontSize: 15,
    fontWeight: "600",
  },
});
