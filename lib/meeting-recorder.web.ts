// Perekam sesi meeting (khusus web): menggambar semua video peserta ke satu
// canvas grid + mencampur seluruh audio lewat WebAudio, lalu merekamnya dengan
// MediaRecorder menjadi satu file webm. Berdiri sendiri dari UI — elemen
// <video> dibuat offscreen di modul ini, jadi tidak bergantung pada DOM React.
import type { StreamLike } from "./webrtc-types";

export const recorderAvailable = true;

export type RecorderEntry = {
  key: string;
  label: string;
  stream: StreamLike;
};

export type RecorderHandle = {
  updateStreams: (entries: RecorderEntry[]) => void;
  stop: () => Promise<{ blob: Blob; durationSec: number; mimeType: string }>;
};

const WIDTH = 1280;
const HEIGHT = 720;
const DRAW_INTERVAL_MS = 125; // 8 fps — cukup untuk dokumentasi kelas

type Slot = {
  video: HTMLVideoElement;
  label: string;
  audioSource: MediaStreamAudioSourceNode | null;
};

export function startRecorder(entries: RecorderEntry[]): RecorderHandle {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx2d = canvas.getContext("2d")!;

  const audioCtx = new AudioContext();
  const audioDest = audioCtx.createMediaStreamDestination();

  const slots = new Map<string, Slot>();

  const attach = (entry: RecorderEntry) => {
    const media = entry.stream as unknown as MediaStream;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = media;
    void video.play().catch(() => {});

    let audioSource: MediaStreamAudioSourceNode | null = null;
    if (media.getAudioTracks().length > 0) {
      try {
        audioSource = audioCtx.createMediaStreamSource(media);
        audioSource.connect(audioDest);
      } catch {}
    }
    slots.set(entry.key, { video, label: entry.label, audioSource });
  };

  const detach = (key: string) => {
    const slot = slots.get(key);
    if (!slot) return;
    slots.delete(key);
    try {
      slot.audioSource?.disconnect();
    } catch {}
    slot.video.srcObject = null;
  };

  for (const entry of entries) attach(entry);

  const draw = () => {
    ctx2d.fillStyle = "#111418";
    ctx2d.fillRect(0, 0, WIDTH, HEIGHT);
    const items = Array.from(slots.values());
    if (items.length === 0) return;
    const cols = items.length <= 1 ? 1 : items.length <= 4 ? 2 : 3;
    const rows = Math.ceil(items.length / cols);
    const cellW = WIDTH / cols;
    const cellH = HEIGHT / rows;
    items.forEach((slot, i) => {
      const x = (i % cols) * cellW;
      const y = Math.floor(i / cols) * cellH;
      const vw = slot.video.videoWidth;
      const vh = slot.video.videoHeight;
      if (vw > 0 && vh > 0) {
        // cover: isi sel penuh dengan crop di tengah
        const scale = Math.max(cellW / vw, cellH / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        ctx2d.save();
        ctx2d.beginPath();
        ctx2d.rect(x, y, cellW, cellH);
        ctx2d.clip();
        ctx2d.drawImage(slot.video, x + (cellW - dw) / 2, y + (cellH - dh) / 2, dw, dh);
        ctx2d.restore();
      } else {
        ctx2d.fillStyle = "#1C2128";
        ctx2d.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);
      }
      ctx2d.fillStyle = "rgba(0,0,0,0.55)";
      ctx2d.fillRect(x + 8, y + cellH - 30, Math.min(slot.label.length * 9 + 16, cellW - 16), 22);
      ctx2d.fillStyle = "#fff";
      ctx2d.font = "13px sans-serif";
      ctx2d.fillText(slot.label, x + 14, y + cellH - 14, cellW - 28);
    });
  };
  const drawTimer = setInterval(draw, DRAW_INTERVAL_MS);

  const canvasStream = canvas.captureStream(1000 / DRAW_INTERVAL_MS);
  const mixed = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
    ? "video/webm;codecs=vp8,opus"
    : "video/webm";
  const recorder = new MediaRecorder(mixed, {
    mimeType,
    videoBitsPerSecond: 900_000,
    audioBitsPerSecond: 96_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(1000);
  const startedAt = Date.now();

  return {
    updateStreams: (next: RecorderEntry[]) => {
      const nextKeys = new Set(next.map((e) => e.key));
      for (const key of Array.from(slots.keys())) {
        if (!nextKeys.has(key)) detach(key);
      }
      for (const entry of next) {
        if (!slots.has(entry.key)) attach(entry);
      }
    },
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.onstop = () => {
          clearInterval(drawTimer);
          for (const key of Array.from(slots.keys())) detach(key);
          for (const track of mixed.getTracks()) track.stop();
          void audioCtx.close().catch(() => {});
          resolve({
            blob: new Blob(chunks, { type: mimeType.split(";")[0] }),
            durationSec: Math.round((Date.now() - startedAt) / 1000),
            mimeType: mimeType.split(";")[0],
          });
        };
        recorder.onerror = (e) => reject(e);
        try {
          recorder.stop();
        } catch (err) {
          reject(err);
        }
      }),
  };
}
