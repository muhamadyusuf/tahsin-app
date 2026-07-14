import React from "react";
import { View } from "react-native";

interface Props {
  url: string;
  style?: object;
}

// Web: browser bisa merender PDF langsung di dalam iframe.
export default function PdfViewer({ url, style }: Props) {
  return (
    <View style={[{ flex: 1, backgroundColor: "#fff" }, style]}>
      {/* @ts-ignore – iframe valid di React Native Web */}
      <iframe
        src={url}
        style={{ width: "100%", height: "100%", border: "none" }}
        title="PDF"
      />
    </View>
  );
}
