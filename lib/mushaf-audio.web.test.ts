import { beforeEach, describe, expect, test, vi } from "vitest";
import { AyahAudioPlayer } from "./mushaf-audio.web";

// HTMLAudioElement tiruan untuk environment non-DOM (edge-runtime).
class FakeAudioElement {
  static instances: FakeAudioElement[] = [];

  src = "";
  currentTime = 0;
  preload = "";
  paused = true;
  playMock: () => Promise<void>;

  private listeners = new Map<string, Set<() => void>>();

  constructor() {
    FakeAudioElement.instances.push(this);
    this.playMock = () => {
      this.paused = false;
      return Promise.resolve();
    };
  }

  addEventListener(type: string, cb: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }

  emit(type: string) {
    this.listeners.get(type)?.forEach((cb) => cb());
  }

  play(): Promise<void> {
    return this.playMock();
  }

  pause() {
    this.paused = true;
  }
}

beforeEach(() => {
  FakeAudioElement.instances = [];
  (globalThis as any).Audio = FakeAudioElement;
});

describe("AyahAudioPlayer (web)", () => {
  test("memakai ulang SATU elemen audio untuk play berantai", async () => {
    const player = new AyahAudioPlayer();
    await player.play("https://a/1.mp3", () => {});
    await player.play("https://a/2.mp3", () => {});

    // Kunci perbaikan: tidak ada elemen baru per ayat, sehingga browser HP
    // tidak memblokir play() lanjutan dengan autoplay policy.
    expect(FakeAudioElement.instances).toHaveLength(1);
    expect(FakeAudioElement.instances[0].src).toBe("https://a/2.mp3");
  });

  test("repeat URI yang sama tidak mengganti src, hanya reset posisi", async () => {
    const player = new AyahAudioPlayer();
    await player.play("https://a/1.mp3", () => {});
    const el = FakeAudioElement.instances[0];
    el.currentTime = 12;

    await player.play("https://a/1.mp3", () => {});
    expect(el.src).toBe("https://a/1.mp3");
    expect(el.currentTime).toBe(0);
  });

  test("onEnded dipanggil saat elemen mengirim event ended", async () => {
    const player = new AyahAudioPlayer();
    const onEnded = vi.fn();
    await player.play("https://a/1.mp3", onEnded);

    FakeAudioElement.instances[0].emit("ended");
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  test("stop() mem-pause dan menekan callback onEnded", async () => {
    const player = new AyahAudioPlayer();
    const onEnded = vi.fn();
    await player.play("https://a/1.mp3", onEnded);

    await player.stop();
    const el = FakeAudioElement.instances[0];
    expect(el.paused).toBe(true);

    el.emit("ended");
    expect(onEnded).not.toHaveBeenCalled();
  });

  test("AbortError dari play() ditelan (disela play berikutnya)", async () => {
    const player = new AyahAudioPlayer();
    await player.play("https://a/1.mp3", () => {});
    FakeAudioElement.instances[0].playMock = () =>
      Promise.reject(new DOMException("interrupted", "AbortError"));

    await expect(
      player.play("https://a/2.mp3", () => {}),
    ).resolves.toBeUndefined();
  });

  test("error lain dari play() tetap dilempar", async () => {
    const player = new AyahAudioPlayer();
    await player.play("https://a/1.mp3", () => {});
    FakeAudioElement.instances[0].playMock = () =>
      Promise.reject(new DOMException("blocked", "NotAllowedError"));

    await expect(player.play("https://a/2.mp3", () => {})).rejects.toThrow(
      "blocked",
    );
  });
});
