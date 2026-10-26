import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyIncomingCall, startCalling, startRinging } from "./ring";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function fakeAudio() {
  const made: { src: string; loop: boolean; plays: number; paused: boolean }[] = [];
  class FakeAudio {
    entry = { src: "", loop: false, plays: 0, paused: false };
    volume = 1;
    constructor(src: string) {
      this.entry.src = src;
      made.push(this.entry);
    }
    set loop(value: boolean) {
      this.entry.loop = value;
    }
    async play() {
      this.entry.plays += 1;
    }
    pause() {
      this.entry.paused = true;
    }
    removeAttribute() {}
    load() {}
  }
  vi.stubGlobal("Audio", FakeAudio);
  return made;
}

describe("ringing", () => {
  it("plays the ring on a loop until told to stop", () => {
    const made = fakeAudio();
    const stop = startRinging();
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ loop: true, plays: 1, paused: false });
    expect(made[0]!.src).toContain("ring");
    stop();
    expect(made[0]!.paused).toBe(true);
  });

  it("plays a different sound for a call you place", () => {
    const made = fakeAudio();
    startCalling()();
    expect(made[0]!.src).toContain("calling");
    expect(made[0]!.loop).toBe(true);
  });

  it("is silent when sounds are turned off", () => {
    const made = fakeAudio();
    localStorage.setItem("pb_sounds_off", "1");
    expect(() => startRinging()()).not.toThrow();
    expect(made).toHaveLength(0);
  });

  it("does nothing, quietly, where there is no audio or the browser refuses", () => {
    vi.stubGlobal("Audio", undefined);
    expect(() => startRinging()()).not.toThrow();
    vi.stubGlobal(
      "Audio",
      class {
        constructor() {
          throw new Error("blocked");
        }
      },
    );
    expect(() => startRinging()()).not.toThrow();
  });
});

describe("incoming call notification", () => {
  const stubNotification = (permission: string) => {
    const shown: { title: string; closed: boolean }[] = [];
    class FakeNotification {
      static permission = permission;
      onclick: (() => void) | null = null;
      private entry: { title: string; closed: boolean };
      constructor(title: string) {
        this.entry = { title, closed: false };
        shown.push(this.entry);
      }
      close() {
        this.entry.closed = true;
      }
    }
    vi.stubGlobal("Notification", FakeNotification);
    return shown;
  };
  const hidden = (value: boolean) => vi.spyOn(document, "hidden", "get").mockReturnValue(value);

  it("shows one when the window is in the background and notifications are allowed, and closes it with the call", () => {
    hidden(true);
    const shown = stubNotification("granted");
    const close = notifyIncomingCall("grace");
    expect(shown.map((n) => n.title)).toEqual(["grace is calling"]);
    close();
    expect(shown[0]!.closed).toBe(true);
  });

  it("stays quiet when the window is in front, or when notifications were not allowed", () => {
    hidden(false);
    const shown = stubNotification("granted");
    notifyIncomingCall("grace");
    hidden(true);
    stubNotification("default");
    notifyIncomingCall("grace");
    expect(shown).toHaveLength(0);
  });

  it("never throws if notifications are missing or broken", () => {
    hidden(true);
    vi.stubGlobal("Notification", undefined);
    expect(() => notifyIncomingCall("grace")()).not.toThrow();
  });
});
