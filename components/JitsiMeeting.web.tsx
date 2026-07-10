import React from "react";
import { View } from "react-native";

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

  return (
    <View style={[{ flex: 1, backgroundColor: "#000" }, style]}>
      {/* @ts-ignore – iframe is valid in React Native Web */}
      <iframe
        src={src}
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        allowFullScreen
      />
    </View>
  );
}
