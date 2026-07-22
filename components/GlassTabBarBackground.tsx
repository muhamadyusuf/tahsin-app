import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";

export function GlassTabBarBackground() {
  return (
    <BlurView
      intensity={55}
      tint="light"
      style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: 30,
        overflow: "hidden",
        backgroundColor:
          Platform.OS === "android"
            ? "rgba(246,247,241,0.92)"
            : "rgba(246,247,241,0.55)",
      }}
    />
  );
}
