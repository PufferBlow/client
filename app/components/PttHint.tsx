/**
 * Floating "Hold KEY to talk" chip rendered while a voice call is
 * active and the user has push-to-talk activation enabled.
 *
 * The actual mute / unmute logic lives in the voice transport's PTT
 * listener — this component is purely visual. It shows the user
 * which key to hold and pulses when they press it, so a PTT-mode
 * user navigating around the dashboard doesn't lose track of
 * whether they're transmitting.
 *
 * Auto-hides when:
 *   * No call is active (no live monitor source registered)
 *   * Activation mode is voice-activity (not PTT)
 *   * The user has explicitly muted themselves (the chip would
 *     be misleading — pressing PTT while muted does nothing)
 *
 * Polls the persisted settings every few seconds rather than
 * subscribing to the `pufferblow:audio-settings-changed` event:
 * the chip only needs to know "PTT or not" and "which key,"
 * neither of which changes every frame. The poll is cheap (a
 * single localStorage read).
 */
import { useEffect, useState } from "react";

import {
  AUDIO_SETTINGS_CHANGED_EVENT,
  isLiveAudioMonitorAvailable,
  readPersistedAudioSettings,
} from "../services/voiceTransport";

interface PttHintProps {
  /** Whether the user has self-muted. The hint hides while muted —
   *  PTT doesn't override a mute, so showing the chip would
   *  misrepresent what holding the key actually does. */
  isMuted?: boolean;
}

export function PttHint({ isMuted = false }: PttHintProps) {
  const [activationMode, setActivationMode] = useState<"voice" | "ptt">("voice");
  const [pttKey, setPttKey] = useState("Alt");
  const [callActive, setCallActive] = useState(false);
  const [isKeyDown, setIsKeyDown] = useState(false);

  // ── Settings sync ──────────────────────────────────────────
  // Read at mount + on every `audio-settings-changed` event.
  // Cheap enough that we don't need to memo or debounce.
  useEffect(() => {
    const refresh = () => {
      const persisted = readPersistedAudioSettings();
      setActivationMode(persisted.voiceActivityMode);
      setPttKey(persisted.pttKey || "Alt");
    };
    refresh();
    if (typeof window === "undefined") return;
    window.addEventListener(AUDIO_SETTINGS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AUDIO_SETTINGS_CHANGED_EVENT, refresh);
  }, []);

  // ── Call-active polling ────────────────────────────────────
  // The voice transport registers + unregisters its monitor slot
  // on connect / disconnect, so we poll that as a proxy for "is
  // there a call?" 1-second cadence is fine — call connect /
  // disconnect is a multi-second event from the user's
  // perspective.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setCallActive(isLiveAudioMonitorAvailable());
    refresh();
    const id = window.setInterval(refresh, 1000);
    return () => window.clearInterval(id);
  }, []);

  // ── PTT key state for the pulse animation ──────────────────
  // We listen separately from the voice transport's own PTT
  // listener (which actually toggles transmit). Two listeners
  // on the same key is fine; they don't interact. We use
  // `key === pttKey` (case-insensitive) for the match — the
  // user's choice in Settings is the canonical name.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activationMode !== "ptt") return;
    const normalizedTarget = pttKey.toLowerCase();
    const matches = (evt: KeyboardEvent) =>
      evt.key.toLowerCase() === normalizedTarget ||
      evt.code.toLowerCase() === normalizedTarget;
    const onDown = (e: KeyboardEvent) => {
      if (matches(e)) setIsKeyDown(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (matches(e)) setIsKeyDown(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    // Page blur / tab switch — release the visual state so it
    // doesn't stick on if the user alt-tabs while holding the key.
    const onBlur = () => setIsKeyDown(false);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [activationMode, pttKey]);

  // Render guards — return null in all the cases where the hint
  // would mislead the user.
  if (!callActive) return null;
  if (activationMode !== "ptt") return null;
  if (isMuted) return null;

  // Format the key for display: single-letter keys uppercase,
  // multi-char names (Alt, Control, Shift) capitalised.
  const displayKey = pttKey.length === 1 ? pttKey.toUpperCase() : pttKey;

  return (
    <div
      role="status"
      aria-live="polite"
      // Bottom-center of the viewport; out of the way of the
      // bottom-right toast surface and the rail's left edge.
      // z-50 puts it above message rows but below modals
      // (which the Modal component uses z-50+ for backdrop).
      className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
    >
      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg transition-all duration-150 ${
          isKeyDown
            ? "border-[var(--color-success)] bg-[var(--color-success)]/15 text-[var(--color-success)]"
            : "border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
        }`}
      >
        {/* Mic glyph — solid when transmitting, hollow when idle.
            The two states match the success/neutral palette of the
            chip so the colour reinforces the meaning. */}
        <svg
          className="h-3.5 w-3.5"
          fill={isKeyDown ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
        <span>
          {isKeyDown ? "Talking" : "Hold"}
          {!isKeyDown && (
            <span className="ml-1 inline-flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text)]">
              {displayKey}
            </span>
          )}
          {!isKeyDown && " to talk"}
        </span>
      </div>
    </div>
  );
}
