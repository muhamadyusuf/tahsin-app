import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { isSafeHttpsUrl } from "@/lib/safe-url";

interface Props {
  url: string;
  style?: object;
}

// Native (iOS/Android): render PDF lewat Google Docs viewer agar konsisten di
// kedua platform (Android WebView tidak bisa membuka PDF langsung). Berkas PDF
// harus dapat diakses publik.
export default function PdfViewer({ url, style }: Props) {
  // `url` bisa berasal dari parameter rute yang dibuat penyerang — hanya https.
  if (!isSafeHttpsUrl(url)) {
    return (
      <View style={[styles.web, styles.invalid, style]}>
        <Text style={styles.invalidText}>Tautan berkas tidak valid.</Text>
      </View>
    );
  }
  const viewerUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(
    url
  )}`;
  return (
    <WebView
      source={{ uri: viewerUrl }}
      style={[styles.web, style]}
      originWhitelist={["https://*"]}
      startInLoadingState
      javaScriptEnabled
      domStorageEnabled
      nestedScrollEnabled
      scalesPageToFit
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#fff" },
  invalid: { alignItems: "center", justifyContent: "center", padding: 24 },
  invalidText: { color: "#6F7F73", fontSize: 14 },
});
