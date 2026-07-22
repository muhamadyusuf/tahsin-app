// Pemutar audio ayat berurutan (versi native, memakai expo-av).
// Versi web ada di mushaf-audio.web.ts — Metro otomatis memilih file .web.ts
// saat build untuk web.
import { Audio } from "expo-av";

/**
 * Pemutar audio satu-ayat-per-satu dengan callback saat ayat selesai.
 * Dipakai MushafView untuk mode "Putar Semua" / "Putar Dari Sini" agar
 * bisa lanjut ke ayat berikutnya secara berantai.
 */
export class AyahAudioPlayer {
  private sound: Audio.Sound | null = null;

  /** Putar `uri`; `onEnded` dipanggil saat audio selesai alami (bukan karena stop()). */
  async play(uri: string, onEnded: () => void): Promise<void> {
    await this.stop();
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true },
    );
    this.sound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        onEnded();
      }
    });
  }

  /** Hentikan pemutaran dan lepas resource. Tidak memicu onEnded. */
  async stop(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch {}
      this.sound = null;
    }
  }
}
