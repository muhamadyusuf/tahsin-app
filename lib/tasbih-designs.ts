// Pilihan desain tasbih fisik. Setiap desain menentukan warna manik,
// benang, tassel (rumbai), dan manik imam agar tampilan menyerupai
// tasbih sungguhan yang digenggam.

export type TasbihDesign = {
  id: string;
  nama: string;
  /** Warna dasar manik (bagian gelap gradasi) */
  beadDark: string;
  /** Warna terang manik (pusat gradasi / kilau) */
  beadLight: string;
  /** Warna benang penghubung */
  thread: string;
  /** Warna manik imam (manik besar penanda) */
  imam: string;
  /** Warna rumbai / tassel */
  tassel: string;
  /** Warna latar panel (gradasi atas) */
  bgTop: string;
  /** Warna latar panel (gradasi bawah) */
  bgBottom: string;
  /** Warna teks di atas panel */
  onBg: string;
};

export const TASBIH_DESIGNS: TasbihDesign[] = [
  {
    id: "kayu",
    nama: "Kayu Kokka",
    beadDark: "#5D3A1A",
    beadLight: "#A9713E",
    thread: "#3E2712",
    imam: "#4A2E14",
    tassel: "#7A4B22",
    bgTop: "#F3E4D2",
    bgBottom: "#E4CBAE",
    onBg: "#4A2E14",
  },
  {
    id: "giok",
    nama: "Giok Hijau",
    beadDark: "#1B5E4A",
    beadLight: "#54C79E",
    thread: "#0E3A2C",
    imam: "#14483A",
    tassel: "#1F7A5E",
    bgTop: "#DDF3EA",
    bgBottom: "#BFE6D6",
    onBg: "#14483A",
  },
  {
    id: "kristal",
    nama: "Kristal Biru",
    beadDark: "#1E4E79",
    beadLight: "#7EC8F5",
    thread: "#12324F",
    imam: "#17405F",
    tassel: "#2E6FA3",
    bgTop: "#E3F1FB",
    bgBottom: "#C6E2F5",
    onBg: "#17405F",
  },
  {
    id: "mutiara",
    nama: "Mutiara Putih",
    beadDark: "#C9C2D6",
    beadLight: "#FFFFFF",
    thread: "#9A93AB",
    imam: "#B0A8C2",
    tassel: "#C9C2D6",
    bgTop: "#F7F5FB",
    bgBottom: "#E7E3F0",
    onBg: "#5A5470",
  },
  {
    id: "oniks",
    nama: "Oniks Hitam",
    beadDark: "#111114",
    beadLight: "#4B4B57",
    thread: "#000000",
    imam: "#1C1C22",
    tassel: "#2C2C34",
    bgTop: "#E7E7EC",
    bgBottom: "#CFCFD8",
    onBg: "#1C1C22",
  },
  {
    id: "emas",
    nama: "Emas Klasik",
    beadDark: "#8A6A1E",
    beadLight: "#F4D06A",
    thread: "#5E4712",
    imam: "#7A5C16",
    tassel: "#C9A83C",
    bgTop: "#FBF3DC",
    bgBottom: "#F1E1B6",
    onBg: "#6B4F12",
  },
  {
    id: "rose",
    nama: "Rose Quartz",
    beadDark: "#A85068",
    beadLight: "#F7B8C9",
    thread: "#7C3A4C",
    imam: "#8E4358",
    tassel: "#C56C84",
    bgTop: "#FBEAF0",
    bgBottom: "#F3D3DE",
    onBg: "#7C3A4C",
  },
  {
    id: "amber",
    nama: "Amber Madu",
    beadDark: "#B5651D",
    beadLight: "#F5B65B",
    thread: "#7E440F",
    imam: "#8E4F13",
    tassel: "#C9812E",
    bgTop: "#FBEEDB",
    bgBottom: "#F3DBB6",
    onBg: "#7E440F",
  },
];

export const DEFAULT_DESIGN_ID = "kayu";
