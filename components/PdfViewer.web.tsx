import React from "react";
import { View, Text } from "react-native";
import { isSafeHttpsUrl } from "@/lib/safe-url";

interface Props {
  url: string;
  style?: object;
}

// Web: browser bisa merender PDF langsung di dalam iframe.
export default function PdfViewer({ url, style }: Props) {
  // KEAMANAN: `url` bisa berasal dari parameter rute (/pdf-viewer?url=...) yang
  // dibuat penyerang. `javascript:` di <iframe src> akan dieksekusi dalam origin
  // aplikasi (XSS), jadi hanya https yang boleh dirender.
  if (!isSafeHttpsUrl(url)) {
    return (
      <View style={[{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, style]}>
        <Text style={{ color: "#6F7F73", fontSize: 14 }}>Tautan berkas tidak valid.</Text>
      </View>
    );
  }
  return (
    <View style={[{ flex: 1, backgroundColor: "#fff" }, style]}>
      {/* @ts-ignore – iframe valid di React Native Web */}
      <iframe
        src={url}
        style={{ width: "100%", height: "100%", border: "none" }}
        title="PDF"
        referrerPolicy="no-referrer"
      />
    </View>
  );
}
