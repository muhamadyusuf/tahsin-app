import React from "react";
import { View } from "react-native";

interface Props {
  videoId: string;
  style?: object;
}

export default function YouTubePlayer({ videoId, style }: Props) {
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;

  return (
    <View style={[{ flex: 1, backgroundColor: "#000" }, style]}>
      {/* @ts-ignore – iframe is valid in React Native Web */}
      <iframe
        src={embedUrl}
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </View>
  );
}
