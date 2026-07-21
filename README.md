# Tahsin

Aplikasi pembelajaran Al-Qur'an berbasis mobile-first yang membantu pengguna belajar membaca dan mentadaburi Al-Qur'an dengan benar. Dibangun dengan React Native (Expo) dan Convex.

## Fitur

- **Mushaf Digital** — Membaca Al-Qur'an digital dengan tracking progress
- **Tilawah Harian** — Catatan tilawah harian dan progress khatam
- **Talaqi** — Sesi mentoring mengaji一对一 dengan ustadz
- **Kelas** — Kelas terstruktur (Tahsin / Murojaah / Tahfidz) dengan jadwal dan materi
- **Ngaji AI** — Evaluasi bacaan Al-Qur'an dengan AI per kata dan per huruf
- **Tarbiyah** — Materi edukasi Tahsin, Ulumul Qur'an, dan Fiqih
- **Kuis** — Latihan soal pilihan ganda & essay
- **Dzikir & Tasbih** — Dzikir harian dan penghitung tasbih digital
- **Sambung Ayat** — Game tebak sambung ayat
- **Video Meeting** — Kelas online via WebRTC dengan rekaman
- **IoT Devices** — Integrasi device fisik untuk tracking bacaan mushaf

## Peran Pengguna

| Peran | Deskripsi |
|---|---|
| **Administrator** | Super admin aplikasi |
| **Admin Pengajian** | Pengelola lembaga/pengajian |
| **Ustadz** | Pengajar kelas |
| **Santri** | Siswa/pembelajar |

## Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | React Native, Expo SDK 54, Expo Router 6 |
| **Styling** | NativeWind (Tailwind CSS) |
| **Backend/Database** | Convex (realtime backend-as-a-service) |
| **Auth** | Clerk (email + Google SSO) |
| **Video** | WebRTC (mesh topology) |
| **Storage** | Convex Storage + Google Drive |
| **Testing** | Vitest + convex-test |
| **Web** | Vercel (static export) |

## Struktur Direktori

```
├── app/                     # Expo Router pages
├── components/              # Komponen UI reusable
├── convex/                  # Backend (schema + server functions)
├── lib/                     # Shared utilities & context
├── constants/               # Tema & konstanta
├── assets/                  # Fonts, images, sounds
└── ...
```

## Memulai

```bash
npm install
npx convex dev        # Jalankan backend Convex
npx expo start        # Jalankan Expo dev server
```

## Scripts

| Script | Perintah |
|---|---|
| `npm start` | Expo dev server |
| `npm run ios` | iOS simulator |
| `npm run android` | Android emulator |
| `npm run web` | Browser |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Vitest |
| `npm run build:web` | Build web static |
