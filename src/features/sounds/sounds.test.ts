import { afterEach, describe, expect, it, vi } from "vitest";
import { playSound, setSoundsEnabled, SOUNDS, soundsEnabled } from "./sounds";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("sounds", () => {
  it("has a file for every sound the app makes", () => {
    expect(Object.keys(SOUNDS).sort()).toEqual(["accept", "calling", "end", "join", "leave", "ping", "ring"]);
    for (const url of Object.values(SOUNDS)) expect(url).toMatch(/\.ogg$/);
  });

  it("plays one once, at a gentle volume", () => {
    const played: { src: string; volume: number }[] = [];
    vi.stubGlobal(
      "Audio",
      class {
        volume = 1;
        constructor(public src: string) {}
        async play() {
          played.push({ src: this.src, volume: this.volume });
        }
      },
    );
    playSound("ping");
    expect(played).toHaveLength(1);
    expect(played[0]!.src).toBe(SOUNDS.ping);
    expect(played[0]!.volume).toBeLessThan(1);
  });

  it("can be turned off, and remembers it", () => {
    expect(soundsEnabled()).toBe(true);
    setSoundsEnabled(false);
    expect(soundsEnabled()).toBe(false);
    const audio = vi.fn();
    vi.stubGlobal("Audio", audio);
    playSound("ping");
    expect(audio).not.toHaveBeenCalled();
    setSoundsEnabled(true);
    expect(soundsEnabled()).toBe(true);
  });

  it("does not throw when playback is refused", async () => {
    vi.stubGlobal(
      "Audio",
      class {
        play() {
          return Promise.reject(new Error("NotAllowedError"));
        }
      },
    );
    expect(() => playSound("accept")).not.toThrow();
    await Promise.resolve();
  });
});
