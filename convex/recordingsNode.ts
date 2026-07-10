"use node";
// Transfer rekaman meeting dari Convex storage ke Google Drive memakai
// service account (tanpa OAuth interaktif). Konfigurasi lewat env deployment:
//
//   npx convex env set GDRIVE_SERVICE_ACCOUNT_EMAIL "xxx@yyy.iam.gserviceaccount.com"
//   npx convex env set GDRIVE_PRIVATE_KEY "-----BEGIN PRIVATE KEY-----\n..."
//   npx convex env set GDRIVE_FOLDER_ID "id-folder-drive"
//
// Folder Drive harus di-share ke email service account sebagai Editor.
// Bila env belum diset, rekaman ditandai "ready" dan diputar langsung dari
// Convex storage — fitur tetap berfungsi tanpa Google Drive.
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createSign } from "crypto";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  // Env var sering menyimpan newline sebagai literal "\n" — normalkan dulu.
  const signature = base64url(
    signer.sign(privateKey.replace(/\\n/g, "\n"))
  );
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Gagal mendapat token Google: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export const uploadToDrive = internalAction({
  args: { recordingId: v.id("meeting_recordings") },
  handler: async (ctx, args) => {
    const recording = await ctx.runQuery(internal.recordings.getInternal, {
      id: args.recordingId,
    });
    if (!recording || !recording.storageId) return null;

    const email = process.env.GDRIVE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GDRIVE_PRIVATE_KEY;
    const folderId = process.env.GDRIVE_FOLDER_ID;

    // Tanpa kredensial Drive: rekaman tetap tersedia dari Convex storage.
    if (!email || !privateKey || !folderId) {
      await ctx.runMutation(internal.recordings.patchInternal, {
        id: args.recordingId,
        status: "ready",
      });
      return null;
    }

    try {
      const blob = await ctx.storage.get(recording.storageId);
      if (!blob) throw new Error("File rekaman tidak ditemukan di storage");

      const token = await getAccessToken(email, privateKey);
      const ext = recording.mimeType.includes("mp4") ? "mp4" : "webm";
      const fileName = `rekaman-pertemuan-${recording.pertemuanId}-${recording.createdAt.slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;

      // Upload resumable: cocok untuk file besar (satu sesi, satu PUT).
      const initRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": recording.mimeType,
            "X-Upload-Content-Length": String(blob.size),
          },
          body: JSON.stringify({ name: fileName, parents: [folderId] }),
        }
      );
      if (!initRes.ok) {
        throw new Error(`Init upload gagal: ${initRes.status} ${await initRes.text()}`);
      }
      const sessionUrl = initRes.headers.get("Location");
      if (!sessionUrl) throw new Error("Google tidak mengembalikan URL sesi upload");

      const uploadRes = await fetch(sessionUrl, {
        method: "PUT",
        headers: { "Content-Type": recording.mimeType },
        body: blob,
      });
      if (!uploadRes.ok) {
        throw new Error(`Upload gagal: ${uploadRes.status} ${await uploadRes.text()}`);
      }
      const file = (await uploadRes.json()) as { id: string };

      // Beri akses "siapa pun dengan link boleh melihat" supaya santri &
      // ustadz bisa menonton tanpa harus punya akses folder.
      const permRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}/permissions?supportsAllDrives=true`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "reader", type: "anyone" }),
        }
      );
      if (!permRes.ok) {
        // Tidak fatal — file tetap ada, hanya aksesnya terbatas.
        console.warn("Gagal set permission Drive:", await permRes.text());
      }

      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?fields=webViewLink&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const meta = (await metaRes.json()) as { webViewLink?: string };

      await ctx.runMutation(internal.recordings.patchInternal, {
        id: args.recordingId,
        status: "ready",
        driveFileId: file.id,
        driveLink:
          meta.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
        clearStorage: true, // hemat storage Convex setelah aman di Drive
      });
    } catch (err) {
      // Gagal transfer ke Drive bukan berarti rekaman hilang — tetap bisa
      // diputar dari Convex storage.
      await ctx.runMutation(internal.recordings.patchInternal, {
        id: args.recordingId,
        status: "ready",
        error: `Transfer Google Drive gagal: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    return null;
  },
});
