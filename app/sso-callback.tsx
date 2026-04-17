import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useClerk } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Colors } from "@/lib/constants";

export default function SSOCallbackScreen() {
  const clerk = useClerk();
  const router = useRouter();

  useEffect(() => {
    if (!clerk.loaded) return;

    clerk
      .handleRedirectCallback({
        afterSignInUrl: "/",
        afterSignUpUrl: "/",
      })
      .catch((err: any) => {
        console.error("SSO callback error:", err);
        router.replace("/login");
      });
  }, [clerk.loaded]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
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
});
