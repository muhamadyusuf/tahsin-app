// Stub perekam untuk Android/iOS — perekaman sesi hanya tersedia di web
// (lihat lib/meeting-recorder.web.ts). Ustadz yang ingin merekam cukup
// membuka meeting dari browser.
import type { StreamLike } from "./webrtc-types";

export const recorderAvailable = false;

export type RecorderEntry = {
  key: string;
  label: string;
  stream: StreamLike;
};

export type RecorderHandle = {
  updateStreams: (entries: RecorderEntry[]) => void;
  stop: () => Promise<{ blob: Blob; durationSec: number; mimeType: string }>;
};

export function startRecorder(_entries: RecorderEntry[]): RecorderHandle {
  throw new Error("Perekaman sesi hanya tersedia di web");
}
