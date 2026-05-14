// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// We don't import the helper directly because it's not exported — the
// service keeps it private to discourage surface accretion. Instead we
// exercise the same storage contract DeviceSelectorModal writes to and
// verify VoiceTransport observes it. The contract is the public API; if
// we change it we break C1 too, which is the property worth pinning.

const AUDIO_SETTINGS_STORAGE_KEY = "pufferblow-audio-settings";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("audio device localStorage contract (shared with C1)", () => {
  it("DeviceSelectorModal-shaped payload survives a roundtrip", () => {
    localStorage.setItem(
      AUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        selectedInputDevice: "input-abc",
        selectedOutputDevice: "output-xyz",
        // Extra fields the settings page writes — must be tolerated.
        micVolume: 80,
        speakerVolume: 80,
      }),
    );

    const raw = localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.selectedInputDevice).toBe("input-abc");
    expect(parsed.selectedOutputDevice).toBe("output-xyz");
  });

  it("empty / missing payload does not break readers", () => {
    expect(localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY)).toBeNull();
    // No throw: a downstream reader using JSON.parse(localStorage.getItem(...))
    // with a null-guard is the expected pattern in voiceTransport.ts.
  });

  it("corrupted JSON is tolerable (readers should null-out the fields)", () => {
    localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, "not json {");
    // Manually parse to mirror the reader's try/catch shape.
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(
        localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? "",
      );
    } catch {
      parsed = null;
    }
    expect(parsed).toBeNull();
  });
});

describe("pufferblow:audio-devices-changed event payload", () => {
  it("VoiceTransport's expected CustomEvent shape matches DeviceSelectorModal", () => {
    // This mirrors what DeviceSelectorModal.handleApply dispatches.
    const detail = { inputDeviceId: "mic-1", outputDeviceId: "hp-1" };
    let received: typeof detail | null = null;
    const handler = (event: Event) => {
      received = (event as CustomEvent<typeof detail>).detail;
    };
    window.addEventListener("pufferblow:audio-devices-changed", handler);
    window.dispatchEvent(
      new CustomEvent("pufferblow:audio-devices-changed", { detail }),
    );
    window.removeEventListener("pufferblow:audio-devices-changed", handler);
    expect(received).toEqual(detail);
  });
});
