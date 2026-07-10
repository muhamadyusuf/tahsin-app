// Shim WebRTC untuk web di atas API bawaan browser.
// Padanan native ada di lib/webrtc.tsx — keduanya mengekspor API yang sama
// (lihat lib/webrtc-types.ts) sehingga logika meeting cukup ditulis sekali.
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import type {
  PeerConnectionLike,
  StreamLike,
  VideoViewProps,
} from "./webrtc-types";

// Browser tidak menyediakan API ganti kamera depan/belakang yang seragam;
// tombol flip disembunyikan di web.
export const canSwitchCamera = false;
export const canShareScreen = true;
export const canRecord = true;

export function createPeerConnection(config: {
  iceServers: object[];
}): PeerConnectionLike {
  return new RTCPeerConnection(
    config as RTCConfiguration
  ) as unknown as PeerConnectionLike;
}

export const mediaDevices = {
  getUserMedia: async (constraints: object): Promise<StreamLike> => {
    const stream = await navigator.mediaDevices.getUserMedia(
      constraints as MediaStreamConstraints
    );
    return stream as unknown as StreamLike;
  },
  getDisplayMedia: async (): Promise<StreamLike> => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 12 } },
      audio: false,
    });
    return stream as unknown as StreamLike;
  },
};

export function toSessionDescription(init: { type: string; sdp: string }) {
  return init;
}

export function toIceCandidate(init: object) {
  return init;
}

export function startAudioSession() {}

export function stopAudioSession() {}

export function switchCamera(_stream: StreamLike | null) {}

export function VideoView({
  stream,
  style,
  mirror,
  muted,
  objectFit = "cover",
}: VideoViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = (stream as unknown as MediaStream) ?? null;
    }
  }, [stream]);

  return (
    <View style={[{ overflow: "hidden" }, style]}>
      {stream && (
        // @ts-ignore — elemen DOM valid di react-native-web
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={!!muted}
          style={{
            width: "100%",
            height: "100%",
            objectFit,
            transform: mirror ? "scaleX(-1)" : undefined,
            backgroundColor: "#000",
          }}
        />
      )}
    </View>
  );
}
