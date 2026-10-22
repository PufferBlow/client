import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyIncomingCall, startRinging } from "./ring";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function fakeAudio() {
  const made = { oscillators: 0, closed: 0 };
  class FakeContext {
    currentTime = 0;
    state = "running";
    destination = {};
    createOscillator() {
      made.oscillators += 1;
      return { type: "", frequency: { value: 0 }, connect: (n: unknown) => n, start: () => undefined, stop: () => undefined };
    }
    createGain() {
      return { gain: { setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined }, connect: (n: unknown) => n };
    }
    resume = async () => undefined;
    close = async () => void (made.closed += 1, (this.state = "closed"));
  }
  vi.stubGlobal("AudioContext", FakeContext);
  return made;
}

describe("ringing", () => {
  it("rings at once, again every couple of seconds, and stops when told to", () => {
    vi.useFakeTimers();
    const made = fakeAudio();

    const stop = startRinging();
    expect(made.oscillators).toBe(2); // two tones per ring
    vi.advanceTimersByTime(4_000);
    expect(made.oscillators).toBe(6);

    stop();
    vi.advanceTimersByTime(10_000);
    expect(made.oscillators).toBe(6);
    expect(made.closed).toBe(1);
  });

  it("does nothing, quietly, where there is no Web Audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => startRinging()()).not.toThrow();
  });

  it("does nothing if the browser will not make an audio context", () => {
    vi.stubGlobal(
      "AudioContext",
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
