# Keamanan — Tangsel Mengaji

Ringkasan audit keamanan, langkah operasional yang WAJIB dilakukan pemilik, dan
cara memakai halaman **Perangkap Keamanan**.

## 1. Langkah wajib (tidak bisa dilakukan lewat kode)

1. **Rotasi `CLERK_SECRET_KEY` produksi (`sk_live_…`).** Kunci ini tersimpan di
   `.env.production` dan `.env copy.production` di disk. Tidak ada di riwayat git,
   tetapi file itu sebelumnya tidak masuk `.gitignore` (sekarang sudah). Karena
   aplikasi client tidak memakai secret key, **hapus baris `CLERK_SECRET_KEY` dari
   kedua file** dan hapus file `.env copy.production`. Jika file itu pernah
   tersalin ke tempat lain (cloud sync, chat, backup), rotasi kuncinya di dashboard Clerk.
2. **Audit akun administrator di produksi** (celah `upsertUser` dulu mengizinkan
   siapa pun menjadi administrator hanya dengan mengirim email admin):
   ```bash
   npx convex run security:auditAdministrators --prod
   ```
   Setiap `clerkId` yang tidak Anda kenal harus diturunkan (`users.updateRole`)
   dan dicek di dashboard Clerk. Perhatikan juga dua akun dengan email admin yang sama.
3. **Pastikan JWT template Clerk bernama `convex` menyertakan klaim `email`** (dan
   `email_verified`). Promosi administrator otomatis sekarang HANYA memakai email
   dari token, bukan dari client. Tanpa klaim `email`, akun baru ber-email admin
   ditolak dengan pesan "Email administrator harus berasal dari token login…".
4. **Deploy backend ke produksi** (`npx convex deploy`, otomatis lewat build Vercel).
   Perbaikan backend baru berlaku setelah deploy.

## 2. Celah yang ditemukan & diperbaiki

| # | Tingkat | Celah | Perbaikan |
|---|---------|-------|-----------|
| 1 | Kritis | `users.upsertUser` memercayai `email` dari client → siapa pun bisa jadi administrator | Email hanya dari klaim JWT terverifikasi; email admin tanpa bukti ditolak |
| 2 | Tinggi | `adminPengajian.create` bisa dipakai user biasa → melewati approval, jadi staf, bisa membaca semua pengguna | Administrator saja |
| 3 | Tinggi | `appConfig.generateUploadUrl` tanpa login → siapa pun bisa unggah file ke storage | Administrator saja |
| 4 | Tinggi | Meeting: siapa pun yang login bisa join room, membaca peserta/chat, mengintip signal WebRTC, mengeluarkan/menyamar sebagai peserta lain | Cek keanggotaan kelas + sesi terikat ke pemilik |
| 5 | Tinggi | Rekaman meeting dapat dilihat semua user; unggah rekaman tanpa batas | Hanya pengelola/peserta kelas; unggah hanya staf, dicek tipe & ukuran |
| 6 | Tinggi | XSS: `/pdf-viewer?url=javascript:…` masuk ke `<iframe src>`; ID YouTube disisipkan ke HTML WebView tanpa validasi | Hanya https; ID YouTube divalidasi; server menolak skema selain https |
| 7 | Tinggi | Nilai/presensi talaqi dapat dibaca semua user dan ditulis pemilik LKM mana pun | Dibatasi ke pengelola kelas & santri sendiri |
| 8 | Sedang | `users.getById` mengirim email/telepon/clerkId ke semua user | Profil publik saja untuk non-staf |
| 9 | Sedang | Pemilik LKM A bisa memasukkan santri ke kelas LKM B; menunjuk ustadz lembaga lain | Validasi lintas-lembaga |
| 10 | Sedang | Pengusul materi bisa mengubah materi yang sudah disetujui tanpa review; LKM mana pun bisa mengubah kuis materi orang lain | Edit non-admin → kembali `pending`; kuis hanya oleh admin/pengusul materi |
| 11 | Sedang | Endpoint IoT: tanggal/halaman tidak divalidasi, tanpa rate limit; API key hanya via URL | Validasi, rate limit, dukung header `X-API-Key` |
| 12 | Sedang | Ngaji AI (API berbayar) tanpa batas ukuran/laju | Batas ukuran, format, 60 analisis/jam/user |
| 13 | Rendah | Skor leaderboard bisa dipalsukan; input tanpa batas panjang; halaman mushaf tak divalidasi | Validasi rentang & panjang |
| 14 | Config | `.env.production` (`sk_live`) tidak di-gitignore; tanpa header keamanan web | `.gitignore`, `.env.example`, header di `vercel.json` |

Test regresi tiap celah ada di `convex/security.test.ts` (dibuktikan gagal pada
kode lama). Jalankan: `npm test`.

## 3. Risiko yang belum diubah (perlu keputusan produk)

- **Staf berlaku global.** `isStaff` (ustadz / pemilik LKM mana pun) dapat membaca
  data tilawah, progres, dan talaqi santri lembaga lain, serta `users.listAll`
  (email & telepon semua pengguna). Sebaiknya dibatasi per lembaga — butuh perubahan
  alur di beberapa layar.
- **Kunci jawaban kuis dikirim ke client** (`poin` pada opsi) dan `isCorrect`
  dinilai client; santri yang teliti bisa memanipulasi nilai kuis.
- **reCAPTCHA hanya di client** (login web); tidak menghalangi pemanggilan Clerk langsung.
- **Rekaman di Google Drive diberi akses "siapa pun dengan link"** (`recordingsNode.ts`).
- **CSP penuh belum dipasang** (rawan merusak Clerk/reCAPTCHA/YouTube); yang dipasang
  baru `frame-ancestors`, `object-src`, `base-uri`, `form-action`.
- Daftar `ADMIN_EMAILS` tertanam di kode; lebih baik dipindah ke env Convex.

## 4. Perangkap keamanan (honeypot)

**Cara kerja.** Alamat yang sering dipindai penyusup namun tidak pernah ditautkan
aplikasi (`/admin`, `/wp-admin`, `/phpmyadmin`, `/.env`, `/.git`, `*.php`, dst — daftar
di `lib/trap-paths.ts`) menampilkan "Panel Administrator" palsu (`components/TrapPage.tsx`).
Setiap kunjungan dicatat oleh backend (`convex/trap.ts`, endpoint `/trap/*` di `convex/http.ts`):

| Data | Sumber |
|------|--------|
| Alamat IP | Header permintaan di server (tidak bisa dipalsukan lewat body; `X-Forwarded-For` palsu dibuang Cloudflare — sudah diuji) |
| Perkiraan lokasi | Geo-IP (kota/ISP; akurasi tingkat kota — hanya perkiraan) |
| Titik GPS | Hanya bila pengunjung menekan "Izinkan" di dialog lokasi browser |
| Foto | Hanya bila pengunjung menekan "Izinkan" di dialog kamera browser |
| Username yang dicoba | Form login umpan. **Password tidak pernah dikirim/disimpan.** |

**Melihat laporan:** login sebagai administrator → Dashboard → **Perangkap Keamanan**
(`/admin-perangkap`): daftar kunjungan, IP (salin), lokasi + tautan peta, foto, dan
tombol tandai-ditinjau/hapus. Lencana jumlah "baru" tampil di dashboard.

**Batasan yang disengaja & perlu Anda ketahui**
- Bot/scanner biasa hanya meninggalkan IP + path + User-Agent (mereka tidak menekan
  "Izinkan"). Foto & GPS hanya didapat dari manusia yang mau mengikuti verifikasi —
  browser SELALU meminta izin dan menampilkan indikator kamera; itu tidak dan tidak
  boleh dilewati.
- Halaman umpan menyatakan terang-terangan bahwa akses dicatat. Itu disengaja:
  foto wajah dan lokasi termasuk data pribadi (UU PDP No. 27/2022), dan
  pemberitahuan yang jelas melindungi Anda secara hukum. Data hanya dapat dibaca
  administrator dan **dihapus otomatis setelah 90 hari** (`RETENTION_DAYS`).
- Administrator/pengelola yang login tidak dicatat saat membuka alamat umpan.
- IP bukan identitas: bisa VPN/proxy/CGNAT. Gunakan sebagai petunjuk, bukan bukti tunggal.
- Pembatasan laju: 40 kunjungan/jam per IP dan 600/jam global agar tabel tidak dibanjiri.
- Untuk memblokir IP secara nyata, pakai Vercel Firewall / Cloudflare WAF; aplikasi ini hanya mencatat.
