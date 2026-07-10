// Logika video meeting internal (pengganti Jitsi): WebRTC full-mesh dengan
// Convex sebagai signaling. Setiap peserta terhubung langsung peer-to-peer ke
// peserta lain — tidak ada server media pihak ketiga dan tidak ada batas
// jumlah peserta dari vendor. Berjalan di web, Android, dan iOS lewat shim
// lib/webrtc(.web).tsx.
//
// Fitur host (ustadz): mute paksa peserta, minta peserta unmute (peserta
// mengonfirmasi lewat banner — mic tidak pernah dinyalakan diam-diam),
// share layar (web), dan merekam sesi (web) yang otomatis diunggah ke
// Google Drive lewat convex/recordings*.ts.
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  createPeerConnection,
  mediaDevices,
  startAudioSession,
  stopAudioSession,
  switchCamera as shimSwitchCamera,
  toIceCandidate,
  toSessionDescription,
} from "@/lib/webrtc";
import {
  recorderAvailable,
  startRecorder,
  RecorderEntry,
  RecorderHandle,
} from "@/lib/meeting-recorder";
import type {
  PeerConnectionLike,
  StreamLike,
  TrackLike,
} from "@/lib/webrtc-types";

const HEARTBEAT_MS = 10_000;

// STUN publik cukup untuk mayoritas jaringan. Untuk jaringan ketat (NAT
// simetris/firewall kampus), isi TURN sendiri lewat env agar koneksi tetap
// tembus: EXPO_PUBLIC_TURN_URL (boleh dipisah koma), EXPO_PUBLIC_TURN_USERNAME,
// EXPO_PUBLIC_TURN_CREDENTIAL.
function buildIceServers(): object[] {
  const servers: object[] = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
  ];
  const turnUrl = process.env.EXPO_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(",").map((u) => u.trim()),
      username: process.env.EXPO_PUBLIC_TURN_USERNAME,
      credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

// Batasi bitrate video per peer supaya topologi mesh tetap ringan saat
// pesertanya banyak (10 peserta ≈ 9 x 350kbps uplink).
async function capVideoBitrate(pc: PeerConnectionLike) {
  try {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== "video") continue;
      const params = sender.getParameters();
      const encodings =
        params.encodings && params.encodings.length > 0
          ? params.encodings
          : [{}];
      encodings[0].maxBitrate = 350_000;
      await sender.setParameters({ ...params, encodings });
    }
  } catch {
    // setParameters tidak wajib berhasil — kualitas hanya tidak di-cap.
  }
}

function makeSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

type CtrlCommand = { action: "mute" | "unmute-request" };

export type MeetingPhase = "preparing" | "joined" | "error";
export type RecordingState = "idle" | "recording" | "uploading";

export type MeetingParticipant = Doc<"meeting_participants">;

export function useMeetingRoom({
  pertemuanId,
  userId,
  name,
  isHost,
}: {
  pertemuanId: Id<"kelas_pertemuan">;
  userId: Id<"users">;
  name: string;
  isHost: boolean;
}) {
  const [sessionId] = useState(makeSessionId);
  const [phase, setPhase] = useState<MeetingPhase>("preparing");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<StreamLike | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, StreamLike>
  >({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [recState, setRecState] = useState<RecordingState>("idle");
  // Host meminta peserta ini menyalakan mikrofon — tampilkan banner
  // konfirmasi (mic tidak pernah dinyalakan tanpa persetujuan peserta).
  const [unmuteRequested, setUnmuteRequested] = useState(false);
  // Dinaikkan saat sebuah koneksi peer gagal supaya effect pengelola peer
  // berjalan lagi dan membangun ulang koneksinya.
  const [retryTick, setRetryTick] = useState(0);

  const pcsRef = useRef<Map<string, PeerConnectionLike>>(new Map());
  const pendingIceRef = useRef<Map<string, object[]>>(new Map());
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const localStreamRef = useRef<StreamLike | null>(null);
  const screenStreamRef = useRef<StreamLike | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const micOnRef = useRef(true);
  const camOnRef = useRef(true);
  const screenOnRef = useRef(false);
  const recOnRef = useRef(false);
  const leftRef = useRef(false);

  const joinMut = useMutation(api.meeting.join);
  const heartbeatMut = useMutation(api.meeting.heartbeat);
  const leaveMut = useMutation(api.meeting.leave);
  const signalMut = useMutation(api.meeting.signal);
  const consumeMut = useMutation(api.meeting.consumeSignals);
  const uploadUrlMut = useMutation(api.recordings.generateUploadUrl);
  const finalizeRecMut = useMutation(api.recordings.finalize);

  const joined = phase === "joined";
  const participants = useQuery(
    api.meeting.participants,
    joined ? { pertemuanId } : "skip"
  );
  const signals = useQuery(
    api.meeting.signalsFor,
    joined ? { pertemuanId, sessionId } : "skip"
  );

  const sendHeartbeat = useCallback(() => {
    if (leftRef.current) return;
    void heartbeatMut({
      pertemuanId,
      sessionId,
      userId,
      name,
      micOn: micOnRef.current,
      camOn: camOnRef.current,
      isHost,
      screenOn: screenOnRef.current,
      recOn: recOnRef.current,
    }).catch(() => {});
  }, [pertemuanId, sessionId, userId, name, isHost, heartbeatMut]);

  const closePeer = useCallback((remoteSession: string) => {
    const pc = pcsRef.current.get(remoteSession);
    if (pc) {
      pcsRef.current.delete(remoteSession);
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.oniceconnectionstatechange = null;
        pc.close();
      } catch {}
    }
    pendingIceRef.current.delete(remoteSession);
    setRemoteStreams((prev) => {
      if (!(remoteSession in prev)) return prev;
      const next = { ...prev };
      delete next[remoteSession];
      return next;
    });
  }, []);

  // Membuat RTCPeerConnection ke satu peserta lain dan mendaftarkannya ke map
  // SECARA SINKRON, supaya effect peserta & handler signal tidak pernah
  // membuat dua koneksi ke session yang sama.
  const createPeerFor = useCallback(
    (remoteSession: string): PeerConnectionLike => {
      const pc = createPeerConnection({ iceServers: buildIceServers() });
      pcsRef.current.set(remoteSession, pc);

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }
      void capVideoBitrate(pc);

      // Sedang share layar? Kirim track layar (bukan kamera) ke peer baru.
      const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
      if (screenOnRef.current && screenTrack) {
        for (const sender of pc.getSenders()) {
          if (sender.track?.kind === "video") {
            void sender.replaceTrack(screenTrack).catch(() => {});
          }
        }
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate || leftRef.current) return;
        void signalMut({
          pertemuanId,
          fromSession: sessionId,
          toSession: remoteSession,
          kind: "ice",
          payload: JSON.stringify(event.candidate),
        }).catch(() => {});
      };
      pc.ontrack = (event) => {
        const remote = event.streams?.[0];
        if (!remote) return;
        setRemoteStreams((prev) =>
          prev[remoteSession] === remote
            ? prev
            : { ...prev, [remoteSession]: remote }
        );
      };
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if ((state === "failed" || state === "closed") && !leftRef.current) {
          closePeer(remoteSession);
          setRetryTick((t) => t + 1);
        }
      };
      return pc;
    },
    [pertemuanId, sessionId, signalMut, closePeer]
  );

  const flushPendingIce = useCallback(
    async (remoteSession: string, pc: PeerConnectionLike) => {
      const pending = pendingIceRef.current.get(remoteSession);
      if (!pending) return;
      pendingIceRef.current.delete(remoteSession);
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(toIceCandidate(candidate));
        } catch {}
      }
    },
    []
  );

  // ---- Join: ambil kamera/mikrofon lalu daftar ke room ----
  useEffect(() => {
    let cancelled = false;
    leftRef.current = false;
    (async () => {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 },
          },
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        startAudioSession();
        await joinMut({ pertemuanId, sessionId, userId, name, isHost });
        if (!cancelled) setPhase("joined");
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            "Tidak bisa mengakses kamera/mikrofon. Pastikan izin kamera dan mikrofon sudah diberikan untuk aplikasi ini."
          );
          setPhase("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      leftRef.current = true;
      // Rekaman yang masih berjalan saat unmount tak terduga dibuang —
      // alur normal berhenti dulu lewat stopRecording() sebelum keluar.
      if (recorderRef.current) {
        void recorderRef.current.stop().catch(() => {});
        recorderRef.current = null;
      }
      for (const [session] of pcsRef.current) {
        const pc = pcsRef.current.get(session);
        try {
          pc?.close();
        } catch {}
      }
      pcsRef.current.clear();
      pendingIceRef.current.clear();
      const screen = screenStreamRef.current;
      if (screen) {
        for (const track of screen.getTracks()) track.stop();
        screenStreamRef.current = null;
      }
      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
        localStreamRef.current = null;
      }
      stopAudioSession();
      void leaveMut({ pertemuanId, sessionId }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pertemuanId, sessionId]);

  // ---- Heartbeat agar baris peserta tidak dianggap terputus ----
  useEffect(() => {
    if (!joined) return;
    const timer = setInterval(sendHeartbeat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [joined, sendHeartbeat]);

  // ---- Kelola koneksi peer mengikuti daftar peserta ----
  // Aturan deterministik anti-glare: untuk tiap pasangan, sessionId yang lebih
  // kecil (urutan string) yang membuat offer; sisi lain menunggu offer masuk.
  useEffect(() => {
    if (!joined || !participants || !localStreamRef.current) return;

    const remoteSessions = new Set(
      participants
        .filter((p) => p.sessionId !== sessionId)
        .map((p) => p.sessionId)
    );

    for (const existing of Array.from(pcsRef.current.keys())) {
      if (!remoteSessions.has(existing)) closePeer(existing);
    }

    for (const remoteSession of remoteSessions) {
      if (pcsRef.current.has(remoteSession)) continue;
      const pc = createPeerFor(remoteSession);
      const isCaller = sessionId < remoteSession;
      if (!isCaller) continue; // tunggu offer dari sisi lain
      void (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const local = pc.localDescription ?? offer;
          await signalMut({
            pertemuanId,
            fromSession: sessionId,
            toSession: remoteSession,
            kind: "offer",
            payload: JSON.stringify({ type: local.type, sdp: local.sdp }),
          });
        } catch {
          closePeer(remoteSession);
        }
      })();
    }
  }, [
    joined,
    participants,
    retryTick,
    localStream,
    sessionId,
    pertemuanId,
    createPeerFor,
    closePeer,
    signalMut,
  ]);

  // ---- Perintah moderasi dari host ----
  const handleCtrl = useCallback(
    (cmd: CtrlCommand) => {
      if (cmd.action === "mute") {
        const stream = localStreamRef.current;
        if (stream) {
          for (const track of stream.getAudioTracks()) track.enabled = false;
        }
        micOnRef.current = false;
        setMicOn(false);
        setUnmuteRequested(false);
        sendHeartbeat();
      } else if (cmd.action === "unmute-request") {
        if (!micOnRef.current) setUnmuteRequested(true);
      }
    },
    [sendHeartbeat]
  );

  // ---- Proses signal masuk (offer/answer/ICE/ctrl) ----
  useEffect(() => {
    if (!signals || signals.length === 0 || leftRef.current) return;
    const fresh = signals.filter(
      (s) => !processedSignalsRef.current.has(s._id)
    );
    if (fresh.length === 0) return;
    for (const s of fresh) processedSignalsRef.current.add(s._id);

    void (async () => {
      for (const s of fresh) {
        if (leftRef.current) break;
        try {
          if (s.kind === "offer") {
            // Offer baru menggantikan koneksi lama (mis. sisi lain rejoin
            // setelah koneksinya gagal) — mulai dari peer connection bersih.
            if (pcsRef.current.has(s.fromSession)) closePeer(s.fromSession);
            const pc = createPeerFor(s.fromSession);
            await pc.setRemoteDescription(
              toSessionDescription(JSON.parse(s.payload))
            );
            await flushPendingIce(s.fromSession, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const local = pc.localDescription ?? answer;
            await signalMut({
              pertemuanId,
              fromSession: sessionId,
              toSession: s.fromSession,
              kind: "answer",
              payload: JSON.stringify({ type: local.type, sdp: local.sdp }),
            });
          } else if (s.kind === "answer") {
            const pc = pcsRef.current.get(s.fromSession);
            if (pc && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(
                toSessionDescription(JSON.parse(s.payload))
              );
              await flushPendingIce(s.fromSession, pc);
            }
          } else if (s.kind === "ice") {
            const candidate = JSON.parse(s.payload) as object;
            const pc = pcsRef.current.get(s.fromSession);
            if (pc && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(toIceCandidate(candidate));
              } catch {}
            } else {
              // Kandidat datang sebelum offer/answer diterapkan — antre dulu.
              const queue = pendingIceRef.current.get(s.fromSession) ?? [];
              queue.push(candidate);
              pendingIceRef.current.set(s.fromSession, queue);
            }
          } else if (s.kind === "ctrl") {
            handleCtrl(JSON.parse(s.payload) as CtrlCommand);
          }
        } catch {
          // Signal rusak/kedaluwarsa tidak boleh menghentikan signal lain.
        }
      }
      void consumeMut({ ids: fresh.map((s) => s._id) }).catch(() => {});
    })();
  }, [
    signals,
    sessionId,
    pertemuanId,
    createPeerFor,
    closePeer,
    flushPendingIce,
    handleCtrl,
    signalMut,
    consumeMut,
  ]);

  // ---- Kontrol dasar ----
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOnRef.current;
    for (const track of stream.getAudioTracks()) track.enabled = next;
    micOnRef.current = next;
    setMicOn(next);
    if (next) setUnmuteRequested(false);
    sendHeartbeat();
  }, [sendHeartbeat]);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOnRef.current;
    for (const track of stream.getVideoTracks()) track.enabled = next;
    camOnRef.current = next;
    setCamOn(next);
    sendHeartbeat();
  }, [sendHeartbeat]);

  const switchCamera = useCallback(() => {
    shimSwitchCamera(localStreamRef.current);
  }, []);

  const acceptUnmute = useCallback(() => {
    setUnmuteRequested(false);
    if (!micOnRef.current) toggleMic();
  }, [toggleMic]);

  const dismissUnmute = useCallback(() => setUnmuteRequested(false), []);

  // ---- Aksi host: mute / minta unmute peserta lain ----
  const sendCtrl = useCallback(
    (toSession: string, cmd: CtrlCommand) => {
      void signalMut({
        pertemuanId,
        fromSession: sessionId,
        toSession,
        kind: "ctrl",
        payload: JSON.stringify(cmd),
      }).catch(() => {});
    },
    [pertemuanId, sessionId, signalMut]
  );

  const hostMute = useCallback(
    (toSession: string) => sendCtrl(toSession, { action: "mute" }),
    [sendCtrl]
  );
  const hostRequestUnmute = useCallback(
    (toSession: string) => sendCtrl(toSession, { action: "unmute-request" }),
    [sendCtrl]
  );

  // ---- Share layar (web): ganti track video kamera → layar ----
  const stopScreenShare = useCallback(() => {
    const screen = screenStreamRef.current;
    screenStreamRef.current = null;
    screenOnRef.current = false;
    setScreenOn(false);
    if (screen) {
      for (const track of screen.getTracks()) track.stop();
    }
    const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    for (const pc of pcsRef.current.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind === "video" || sender.track === null) {
          void sender.replaceTrack(camTrack).catch(() => {});
        }
      }
    }
    sendHeartbeat();
  }, [sendHeartbeat]);

  const startScreenShare = useCallback(async () => {
    if (screenOnRef.current) return;
    const screen = await mediaDevices.getDisplayMedia();
    const screenTrack = screen.getVideoTracks()[0];
    if (!screenTrack) return;
    screenStreamRef.current = screen;
    screenOnRef.current = true;
    setScreenOn(true);
    for (const pc of pcsRef.current.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind === "video") {
          void sender.replaceTrack(screenTrack).catch(() => {});
        }
      }
    }
    // User mengakhiri share dari UI browser (tombol "Stop sharing").
    (screenTrack as TrackLike & { onended?: () => void }).onended = () => {
      if (screenOnRef.current) stopScreenShare();
    };
    sendHeartbeat();
  }, [stopScreenShare, sendHeartbeat]);

  const toggleScreenShare = useCallback(async () => {
    if (screenOnRef.current) {
      stopScreenShare();
    } else {
      try {
        await startScreenShare();
      } catch {
        // User membatalkan dialog pilih layar — bukan error.
      }
    }
  }, [startScreenShare, stopScreenShare]);

  // ---- Rekam sesi (web) → unggah → Google Drive ----
  const buildRecorderEntries = useCallback((): RecorderEntry[] => {
    const entries: RecorderEntry[] = [];
    const localShown = screenStreamRef.current ?? localStreamRef.current;
    if (localShown && localStreamRef.current) {
      // Track audio diambil dari mic; video dari layar bila sedang share.
      entries.push({ key: "local", label: name, stream: localStreamRef.current });
      if (screenStreamRef.current) {
        entries.push({
          key: "local-screen",
          label: `${name} (layar)`,
          stream: screenStreamRef.current,
        });
      }
    }
    const byId = new Map(
      (participants ?? []).map((p) => [p.sessionId, p.name] as const)
    );
    for (const [session, stream] of Object.entries(remoteStreams)) {
      entries.push({
        key: session,
        label: byId.get(session) ?? "Peserta",
        stream,
      });
    }
    return entries;
  }, [name, participants, remoteStreams]);

  const startRecording = useCallback(() => {
    if (!recorderAvailable || recorderRef.current) return;
    try {
      recorderRef.current = startRecorder(buildRecorderEntries());
      recOnRef.current = true;
      setRecState("recording");
      sendHeartbeat();
    } catch {
      recorderRef.current = null;
    }
  }, [buildRecorderEntries, sendHeartbeat]);

  // Peserta datang/pergi selama rekaman → perbarui komposisi rekaman.
  useEffect(() => {
    if (recorderRef.current && recState === "recording") {
      recorderRef.current.updateStreams(buildRecorderEntries());
    }
  }, [recState, buildRecorderEntries, screenOn]);

  const stopRecording = useCallback(async (): Promise<boolean> => {
    const recorder = recorderRef.current;
    if (!recorder) return true;
    recorderRef.current = null;
    recOnRef.current = false;
    setRecState("uploading");
    sendHeartbeat();
    try {
      const { blob, durationSec, mimeType } = await recorder.stop();
      const uploadUrl = await uploadUrlMut({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: blob,
      });
      if (!res.ok) throw new Error(`Upload gagal (${res.status})`);
      const { storageId } = (await res.json()) as {
        storageId: Id<"_storage">;
      };
      await finalizeRecMut({
        pertemuanId,
        byUserId: userId,
        byName: name,
        storageId,
        mimeType,
        sizeBytes: blob.size,
        durationSec,
      });
      setRecState("idle");
      return true;
    } catch {
      setRecState("idle");
      return false;
    }
  }, [pertemuanId, userId, name, uploadUrlMut, finalizeRecMut, sendHeartbeat]);

  return {
    sessionId,
    phase,
    errorMsg,
    localStream,
    // Preview lokal: layar saat share, selain itu kamera.
    localPreviewStream: screenOn ? screenStreamRef.current : localStream,
    remoteStreams,
    participants: participants ?? [],
    micOn,
    camOn,
    screenOn,
    recState,
    unmuteRequested,
    toggleMic,
    toggleCam,
    switchCamera,
    toggleScreenShare,
    startRecording,
    stopRecording,
    acceptUnmute,
    dismissUnmute,
    hostMute,
    hostRequestUnmute,
  };
}
