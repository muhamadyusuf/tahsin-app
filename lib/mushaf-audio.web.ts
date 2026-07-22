// Pemutar audio ayat berurutan (khusus web).
//
// Kenapa tidak pakai expo-av seperti versi native? expo-av di web membuat
// HTMLAudioElement BARU untuk setiap Audio.Sound.createAsync(). Browser HP
// (Safari iOS, Chrome Android) memblokir play() pada elemen media baru yang
// belum pernah "dibuka" oleh gestur pengguna (autoplay policy) — akibatnya
// ayat pertama berbunyi, tapi lanjutan otomatis ke ayat berikutnya diam-diam
// ditolak (NotAllowedError). Browser desktop lebih longgar sehingga masalah
// ini hanya terlihat di HP.
//
// Solusinya: memakai SATU HTMLAudioElement yang dipakai ulang. Elemen yang
// sudah pernah di-play lewat gestur pengguna tetap "terbuka", sehingga ganti
// src + play() berikutnya diizinkan tanpa gestur baru — teknik standar untuk
// playlist audio di web mobile.
export class AyahAudioPlayer {
  private el: HTMLAudioElement | null = null;
  private onEnded: (() => void) | null = null;

  private getEl(): HTMLAudioElement {
    if (!this.el) {
      const el = new Audio();
      el.preload = "auto";
      el.addEventListener("ended", () => {
        const cb = this.onEnded;
        if (cb) cb();
      });
      this.el = el;
    }
    return this.el;
  }

  /** Putar `uri`; `onEnded` dipanggil saat audio selesai alami (bukan karena stop()). */
  async play(uri: string, onEnded: () => void): Promise<void> {
    const el = this.getEl();
    this.onEnded = onEnded;
    if (el.src !== uri) {
      el.src = uri;
    }
    el.currentTime = 0;
    try {
      await el.play();
    } catch (e: unknown) {
      // AbortError = play() ini disela oleh play() berikutnya (mis. tap cepat
      // berturut-turut). Bukan kegagalan nyata — jangan diteruskan agar state
      // pemutar tidak ikut ter-reset.
      if (e instanceof DOMException && e.name === "AbortError") return;
      throw e;
    }
  }

  /** Hentikan pemutaran. Tidak memicu onEnded; elemen tetap dipakai ulang. */
  async stop(): Promise<void> {
    this.onEnded = null;
    this.el?.pause();
  }
}
