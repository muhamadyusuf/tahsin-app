// Tipe struktural minimal yang dipenuhi baik oleh react-native-webrtc (native)
// maupun WebRTC bawaan browser (web). Dipakai useMeetingRoom & MeetingRoom
// supaya satu logika meeting berjalan di kedua platform lewat shim
// lib/webrtc.ts (native) dan lib/webrtc.web.ts (web).
import type { StyleProp, ViewStyle } from "react-native";

export type TrackLike = {
  kind: string;
  enabled: boolean;
  stop: () => void;
};

export type StreamLike = {
  id: string;
  getTracks: () => TrackLike[];
  getAudioTracks: () => TrackLike[];
  getVideoTracks: () => TrackLike[];
};

export type SessionDescriptionLike = { type: string; sdp: string };

export type PeerConnectionLike = {
  createOffer: (options?: object) => Promise<SessionDescriptionLike>;
  createAnswer: () => Promise<SessionDescriptionLike>;
  setLocalDescription: (desc: SessionDescriptionLike) => Promise<void>;
  setRemoteDescription: (desc: SessionDescriptionLike) => Promise<void>;
  addIceCandidate: (candidate: object) => Promise<void>;
  addTrack: (track: TrackLike, stream: StreamLike) => unknown;
  getSenders: () => Array<{
    track: TrackLike | null;
    getParameters: () => { encodings?: Array<Record<string, unknown>> };
    setParameters: (p: object) => Promise<void>;
    replaceTrack: (track: TrackLike | null) => Promise<void>;
  }>;
  close: () => void;
  localDescription: SessionDescriptionLike | null;
  remoteDescription: SessionDescriptionLike | null;
  signalingState: string;
  iceConnectionState: string;
  onicecandidate: ((event: { candidate: object | null }) => void) | null;
  ontrack: ((event: { streams: StreamLike[] }) => void) | null;
  oniceconnectionstatechange: (() => void) | null;
};

export type VideoViewProps = {
  stream: StreamLike | null;
  style?: StyleProp<ViewStyle>;
  /** Cerminkan video (untuk kamera depan sendiri). */
  mirror?: boolean;
  /** Matikan audio elemen video — dipakai preview lokal di web agar tidak echo. */
  muted?: boolean;
  objectFit?: "cover" | "contain";
};
