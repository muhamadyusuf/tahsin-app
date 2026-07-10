// Shim WebRTC untuk Android/iOS di atas react-native-webrtc.
// Padanan web ada di lib/webrtc.web.ts — keduanya mengekspor API yang sama
// (lihat lib/webrtc-types.ts) sehingga logika meeting cukup ditulis sekali.
import React from "react";
import { View } from "react-native";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices as rnMediaDevices,
} from "react-native-webrtc";
import type {
  PeerConnectionLike,
  StreamLike,
  VideoViewProps,
} from "./webrtc-types";

let InCallManager: any = null;
try {
  InCallManager = require("react-native-incall-manager").default;
} catch {}

export const canSwitchCamera = true;
// Share layar penuh di Android butuh foreground service MediaProjection dan
// di iOS butuh Broadcast Upload Extension — belum dikonfigurasi, jadi fitur
// share layar hanya diaktifkan di web untuk saat ini.
export const canShareScreen = false;
// Perekaman sesi (canvas + MediaRecorder) hanya tersedia di web.
export const canRecord = false;

export function createPeerConnection(config: {
  iceServers: object[];
}): PeerConnectionLike {
  return new RTCPeerConnection(config as any) as unknown as PeerConnectionLike;
}

export const mediaDevices = {
  getUserMedia: async (constraints: object): Promise<StreamLike> => {
    const stream = await rnMediaDevices.getUserMedia(constraints as any);
    return stream as unknown as StreamLike;
  },
  getDisplayMedia: async (): Promise<StreamLike> => {
    throw new Error("Share layar belum tersedia di aplikasi mobile");
  },
};

export function toSessionDescription(init: { type: string; sdp: string }) {
  return new RTCSessionDescription(init as any) as any;
}

export function toIceCandidate(init: object) {
  return new RTCIceCandidate(init as any) as any;
}

// Rutekan audio ke speaker & jaga sesi audio tetap hidup selama meeting
// (default iOS memakai earpiece seperti telepon biasa).
export function startAudioSession() {
  try {
    InCallManager?.start({ media: "video" });
    InCallManager?.setForceSpeakerphoneOn(true);
  } catch {}
}

export function stopAudioSession() {
  try {
    InCallManager?.setForceSpeakerphoneOn(false);
    InCallManager?.stop();
  } catch {}
}

export function switchCamera(stream: StreamLike | null) {
  if (!stream) return;
  for (const track of stream.getVideoTracks()) {
    (track as any)._switchCamera?.();
  }
}

export function VideoView({
  stream,
  style,
  mirror,
  objectFit = "cover",
}: VideoViewProps) {
  if (!stream) return <View style={style} />;
  return (
    <RTCView
      streamURL={(stream as any).toURL()}
      style={style as any}
      mirror={!!mirror}
      objectFit={objectFit}
      zOrder={0}
    />
  );
}
