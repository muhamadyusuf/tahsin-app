// Klien web untuk halaman perangkap (components/TrapPage.tsx). Berbicara ke
// endpoint HTTP publik Convex (convex/http.ts → /trap/*).
//
// PRINSIP: GPS dan kamera HANYA lewat dialog izin bawaan browser
// (navigator.geolocation / getUserMedia). Tidak ada usaha melewati atau
// menyembunyikan izin itu; indikator "kamera aktif" browser tetap tampil.
// Password yang diketik di form umpan TIDAK PERNAH dikirim.

export type PermissionStatus = "granted" | "denied" | "unsupported" | "error";

export type TrapSession = { hitId: string; token: string };

export type GpsFix = { latitude: number; longitude: number; accuracy?: number };

function siteUrl(): string | null {
  const explicit = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const cloud = process.env.EXPO_PUBLIC_CONVEX_URL;
  if (cloud?.includes(".convex.cloud")) {
    return cloud.replace(".convex.cloud", ".convex.site").replace(/\/+$/, "");
  }
  return null;
}

async function post(path: string, init: RequestInit): Promise<Response | null> {
  const base = siteUrl();
  if (!base) return null;
  try {
    return await fetch(`${base}${path}`, { method: "POST", ...init });
  } catch {
    return null;
  }
}

/** Laporkan kunjungan. IP dicatat server dari header, bukan dari sini. */
export async function reportTrapHit(path: string): Promise<TrapSession | null> {
  const res = await post("/trap/hit", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      referrer: typeof document !== "undefined" ? document.referrer : "",
      language: typeof navigator !== "undefined" ? navigator.language : "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen:
        typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : "",
    }),
  });
  if (!res || !res.ok) return null;
  const data = (await res.json()) as Partial<TrapSession>;
  return data.hitId && data.token ? { hitId: data.hitId, token: data.token } : null;
}

export async function sendTrapEvidence(
  session: TrapSession,
  evidence: {
    gps?: GpsFix;
    gpsStatus?: PermissionStatus;
    cameraStatus?: PermissionStatus;
    attemptedUsername?: string;
  }
): Promise<void> {
  await post("/trap/evidence", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...evidence, hitId: session.hitId, token: session.token }),
  });
}

export async function uploadTrapPhoto(session: TrapSession, photo: Blob): Promise<boolean> {
  const qs = `hitId=${encodeURIComponent(session.hitId)}&token=${encodeURIComponent(session.token)}`;
  const res = await post(`/trap/photo?${qs}`, {
    headers: { "Content-Type": photo.type || "image/jpeg" },
    body: photo,
  });
  return !!res && res.ok;
}

/** Minta lokasi presisi. Memunculkan dialog izin browser. */
export function requestGps(): Promise<{ status: PermissionStatus; gps?: GpsFix }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ status: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          status: "granted",
          gps: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        }),
      (err) => resolve({ status: err.code === err.PERMISSION_DENIED ? "denied" : "error" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/**
 * Ambil satu foto dari kamera depan. Memunculkan dialog izin browser dan
 * indikator kamera aktif. Foto diperkecil (maks. 640 px, JPEG) agar ringan.
 */
export async function captureCameraPhoto(): Promise<{ status: PermissionStatus; photo?: Blob }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { status: "unsupported" };
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    return { status: name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error" };
  }

  const video = document.createElement("video");
  try {
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    // Safari mensyaratkan elemen ada di DOM agar mau memutar.
    video.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(video);
    await video.play();
    // Beri kamera waktu menyesuaikan eksposur sebelum mengambil gambar.
    await new Promise((r) => setTimeout(r, 1200));

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const scale = Math.min(1, 640 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { status: "error" };
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const photo = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.7)
    );
    return photo ? { status: "granted", photo } : { status: "error" };
  } catch {
    return { status: "error" };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    video.remove();
  }
}
