import { Platform, Dimensions } from "react-native";

// App-wide constants
export const APP_NAME = "Tahsin";
export const APP_VERSION = "1.0.0";

// Roles
export const ROLES = {
  ADMINISTRATOR: "administrator",
  ADMIN_PENGAJIAN: "admin_pengajian",
  USTADZ: "ustadz",
  SANTRI: "santri",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// Al-Quran API
export const QURAN_API_BASE = "https://api.alquran.cloud/v1";
export const QURAN_EDITION_ARABIC = "quran-uthmani";
export const QURAN_EDITION_TRANSLATION = "id.indonesian";
export const QURAN_EDITION_AUDIO = "ar.alafasy";

// Available audio editions (Qari/reciters)
export const AUDIO_EDITIONS = [
  { id: "ar.alafasy", label: "Mishary Rashid Alafasy" },
  { id: "ar.abdulbasitmurattal", label: "Abdul Basit (Murattal)" },
  { id: "ar.abdullahbasfar", label: "Abdullah Basfar" },
  { id: "ar.abdurrahmaansudais", label: "Abdurrahman As-Sudais" },
  { id: "ar.ahmedajamy", label: "Ahmed ibn Ali al-Ajamy" },
  { id: "ar.haboremahmoudalrushoud", label: "Al-Rushoud" },
  { id: "ar.husaborahme", label: "Al-Husory" },
  { id: "ar.maaborashooreee", label: "Al-Shatri" },
  { id: "ar.minaborashaawy", label: "Minshawy (Murattal)" },
  { id: "ar.saaborasheedi", label: "Saad Al-Ghamdi" },
] as const;

// Talaqi nilai options
export const NILAI_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

// Quiz passing grade (70%)
export const QUIZ_PASSING_GRADE = 0.7;

// Colors (Islamic deep-green / mushaf theme — krem hangat + hijau zamrud)
export const Colors = {
  primary: "#1F7A45",
  primaryDark: "#0F4A28",
  primaryLight: "#E3F1E8",
  primarySoft: "#F0F7F2",
  secondary: "#E8A33D",
  accent: "#E8A33D",
  background: "#F6F7F1",
  backgroundLight: "#FBFCF8",
  surface: "#FFFFFF",
  text: "#1E2B23",
  textPrimary: "#1E2B23",
  textSecondary: "#6F7F73",
  textLight: "#FFFFFF",
  border: "#E6EAE1",
  success: "#4CAF50",
  warning: "#FF9800",
  error: "#F44336",
  info: "#1F7A45",
  infoLight: "#E3F1E8",
};

// Talaqi types
export const TALAQI_TYPES = [
  { label: "Tahsin", value: "tahsin" },
  { label: "Muroja'ah", value: "murojaah" },
  { label: "Tahfidz", value: "tahfidz" },
] as const;

// Web Layout Constants
export const WEB_MAX_WIDTH = 500;

export const getDisplayWidth = () => {
  const { width } = Dimensions.get("window");
  return Platform.OS === "web" ? Math.min(width, WEB_MAX_WIDTH) : width;
};
