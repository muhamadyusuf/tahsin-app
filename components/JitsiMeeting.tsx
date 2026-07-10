import React from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

interface Props {
  meetingUrl: string;
  displayName?: string;
  style?: object;
}

export default function JitsiMeeting({ meetingUrl, displayName, style }: Props) {
  const nameParam = displayName
    ? `#userInfo.displayName="${encodeURIComponent(displayName)}"`
    : "";
  const src = `${meetingUrl}${nameParam}`;
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;background:#000}iframe{width:100%;height:100%;border:none}</style></head><body><iframe src="${src}" allow="camera;microphone;fullscreen;display-capture;autoplay" allowfullscreen></iframe></body></html>`;

  return (
    <WebView
      source={{ html }}
      style={[styles.player, style]}
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={["*"]}
    />
  );
}

const styles = StyleSheet.create({
  player: {
    flex: 1,
    backgroundColor: "#000",
  },
});
