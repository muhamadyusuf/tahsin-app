import React from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

interface Props {
  videoId: string;
  style?: object;
}

export default function YouTubePlayer({ videoId, style }: Props) {
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;background:#000}iframe{width:100%;height:100%;border:none}</style></head><body><iframe src="${embedUrl}" allow="autoplay;fullscreen" allowfullscreen></iframe></body></html>`;

  return (
    <WebView
      source={{ html }}
      style={[styles.player, style]}
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
    />
  );
}

const styles = StyleSheet.create({
  player: {
    flex: 1,
    backgroundColor: "#000",
  },
});
