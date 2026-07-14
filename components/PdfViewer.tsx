import React from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

interface Props {
  url: string;
  style?: object;
}

// Native (iOS/Android): render PDF lewat Google Docs viewer agar konsisten di
// kedua platform (Android WebView tidak bisa membuka PDF langsung). Berkas PDF
// harus dapat diakses publik.
export default function PdfViewer({ url, style }: Props) {
  const viewerUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(
    url
  )}`;
  return (
    <WebView
      source={{ uri: viewerUrl }}
      style={[styles.web, style]}
      originWhitelist={["*"]}
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
});
