/**
 * AudioTab — Settings page > Voice pane.
 *
 * Reworked from the previous 644-line layout which had:
 *   - A gradient hero header with a giant mic icon + 4 "Quick Stats"
 *     tiles (Status / Input Volume / Quality / Mode).
 *   - 7 stacked sections each with their own coloured-icon header,
 *     leading to ~30+ controls visible plus ~10 status/stat tiles.
 *   - A separate "Device Status" section at the bottom that
 *     re-restated information already visible at the top of the page.
 *   - 3 large card-buttons for "Audio Quality" + 2 large card-buttons
 *     for the activation-mode picker. Both were strictly better as
 *     compact pill groups.
 *   - Cards-within-cards-within-cards (Input Settings → Microphone Setup
 *     → Volume Control → slider, ~120px of chrome to wrap one slider).
 *
 * New shape:
 *
 *   * Input — device select + refresh + mic-volume slider + three
 *     processing toggle rows. One section.
 *   * Output — output device select + output-volume slider +
 *     attachment-volume slider. One section.
 *   * Activation — mode pill (Voice activity / Push-to-talk) + the
 *     PTT key picker (only when PTT). One section.
 *   * Quality — single pill group inside a collapsible section.
 *   * Test — collapsible section containing the spectrum visualizer,
 *     input-level meter, and the three test buttons (Monitor / Mic /
 *     Speakers).
 *
 * Hook contract (`useSettingsAudio`) is unchanged — pure visual rework.
 */
import { useState, type ReactNode } from "react";
import { ModernSlider, ModernToggle } from "../../AudioControls";
import { useSettingsAudio } from "../useSettingsAudio";

interface AudioTabProps {
  audio: ReturnType<typeof useSettingsAudio>;
}

/**
 * Same collapsible-card helper as Appearance. Replicated here
 * intentionally so settings tabs stay independent (no shared
 * sub-component file just for this — the helper is tiny and the
 * two tabs evolve independently).
 */
function Section({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--color-hover)]"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {description}
            </p>
          )}
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="space-y-4 border-t border-[var(--color-border)] px-5 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * A toggle row: label + description on the left, modern toggle
 * right-aligned. Replaces the three big bordered toggle cards in
 * the previous "Audio Processing" grid.
 */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--color-text)]">{label}</div>
        <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{description}</div>
      </div>
      <ModernToggle checked={checked} onChange={onChange} size="medium" />
    </div>
  );
}

/**
 * A volume slider row. The previous version wrapped each slider in
 * its own bordered card with a coloured icon container and a
 * subtitle — ~120px of chrome per slider. This is just a label, the
 * slider, and the percentage readout, in ~60px.
 */
function VolumeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-sm font-medium text-[var(--color-text)]">{label}</label>
        <span className="font-mono text-xs text-[var(--color-text-muted)]">{value}%</span>
      </div>
      <ModernSlider
        value={value}
        onChange={onChange}
        min={0}
        max={100}
        size="medium"
        color="from-[var(--color-primary)] to-[var(--color-accent)]"
      />
    </div>
  );
}

export function AudioTab({ audio }: AudioTabProps) {
  const {
    micVolume,
    setMicVolume,
    speakerVolume,
    attachmentVolume,
    setAttachmentVolume,
    setSpeakerVolume,
    isTestingMicrophone,
    setIsTestingMicrophone,
    isTestingSpeakers,
    setIsTestingSpeakers,
    inputDevices,
    outputDevices,
    selectedInputDevice,
    setSelectedInputDevice,
    selectedOutputDevice,
    setSelectedOutputDevice,
    inputLevel,
    voiceActivityMode,
    setVoiceActivityMode,
    pttKey,
    setPttKey,
    noiseSuppression,
    setNoiseSuppression,
    echoCancellation,
    setEchoCancellation,
    autoGainControl,
    setAutoGainControl,
    audioQuality,
    setAudioQuality,
    isListening,
    frequencyData,
    startMicrophoneTest,
    stopMicrophoneTest,
    startSpeakerTest,
    stopSpeakerTest,
    refreshInputDevices,
    startListening,
    stopListening,
  } = audio;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ── Input ───────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Input</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Microphone, sensitivity, and audio processing.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="audio-input-device" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              Microphone
            </label>
            <div className="flex gap-2">
              <select
                id="audio-input-device"
                value={selectedInputDevice}
                onChange={(e) => setSelectedInputDevice(e.target.value)}
                className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              >
                <option value="">Default device</option>
                {inputDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { void refreshInputDevices(); }}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                title="Rescan for connected devices"
              >
                Refresh
              </button>
            </div>
          </div>

          <VolumeRow label="Input volume" value={micVolume} onChange={setMicVolume} />

          <div className="grid gap-2 sm:grid-cols-1">
            <ToggleRow
              label="Noise suppression"
              description="Filter steady background noise"
              checked={noiseSuppression}
              onChange={setNoiseSuppression}
            />
            <ToggleRow
              label="Echo cancellation"
              description="Remove echo from your own speakers"
              checked={echoCancellation}
              onChange={setEchoCancellation}
            />
            <ToggleRow
              label="Auto gain control"
              description="Even out volume across loud and quiet sources"
              checked={autoGainControl}
              onChange={setAutoGainControl}
            />
          </div>
        </div>
      </div>

      {/* ── Output ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Output</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Speakers, headphones, and playback volumes.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="audio-output-device" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              Output device
            </label>
            <select
              id="audio-output-device"
              value={selectedOutputDevice}
              onChange={(e) => setSelectedOutputDevice(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            >
              <option value="">Default device</option>
              {outputDevices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Output device ${index + 1}`}
                </option>
              ))}
            </select>
          </div>

          <VolumeRow label="Output volume" value={speakerVolume} onChange={setSpeakerVolume} />

          {/* Attachment volume is independent from voice-call output so
              changing one doesn't affect the other. The per-player
              slider in AttachmentBubble writes to the same setting, so
              changes anywhere update everywhere. */}
          <VolumeRow
            label="Audio attachment volume"
            value={attachmentVolume}
            onChange={setAttachmentVolume}
          />
        </div>
      </div>

      {/* ── Activation ──────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Activation</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            When Pufferblow opens your mic.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-1.5 text-sm font-medium text-[var(--color-text)]">Mode</div>
            <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-0.5">
              {([
                { value: "voice", label: "Voice activity" },
                { value: "ptt", label: "Push-to-talk" },
              ] as const).map((opt) => {
                const isActive = voiceActivityMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVoiceActivityMode(opt.value)}
                    className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
              {voiceActivityMode === "voice"
                ? "Your mic opens automatically when you speak."
                : "Your mic stays muted until you hold the bound key."}
            </p>
          </div>

          {voiceActivityMode === "ptt" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
                Push-to-talk key
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={pttKey}
                  onChange={(e) => setPttKey(e.target.value)}
                  className="w-16 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-center font-mono text-sm text-[var(--color-text)]"
                  placeholder="Key"
                  maxLength={1}
                />
                <span className="text-xs text-[var(--color-text-secondary)]">or</span>
                <select
                  value={pttKey}
                  onChange={(e) => setPttKey(e.target.value)}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)]"
                >
                  <option value="Alt">Alt</option>
                  <option value="Control">Ctrl</option>
                  <option value="Shift">Shift</option>
                  <option value=" ">Space</option>
                  <option value="f">F</option>
                  <option value="g">G</option>
                  <option value="h">H</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Quality (collapsible) ───────────────────────────────── */}
      <Section title="Quality" description={`Currently: ${audioQuality === "good" ? "Good (~64 kbps)" : audioQuality === "better" ? "Better (~128 kbps)" : "Best (~256 kbps)"}.`}>
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-0.5">
          {([
            { value: "good", label: "Good", hint: "~64 kbps" },
            { value: "better", label: "Better", hint: "~128 kbps" },
            { value: "best", label: "Best", hint: "~256 kbps" },
          ] as const).map((opt) => {
            const isActive = audioQuality === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAudioQuality(opt.value)}
                title={opt.hint}
                className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Higher quality uses more bandwidth. Pick "Good" on a flaky connection.
        </p>
      </Section>

      {/* ── Test (collapsible) ──────────────────────────────────── */}
      <Section title="Test" description="Verify your setup before joining a voice channel.">
        <div className="space-y-4">
          {/* Live spectrum + input-level meter, side by side */}
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3">
            <div className="flex h-16 items-end justify-center gap-px">
              {Array.from(frequencyData, (value, index) => (
                <div
                  key={index}
                  className="w-0.5 rounded-sm bg-[var(--color-primary)] transition-all duration-75"
                  style={{
                    height: `${Math.max(4, (value / 255) * 100)}%`,
                    opacity: isListening ? 1 : 0.25,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
              {isListening ? "Monitoring…" : "Not active"}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs text-[var(--color-text-secondary)]">Input level</span>
              <span className="font-mono text-xs text-[var(--color-text-muted)]">{Math.round(inputLevel * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
              <div
                className={`h-full transition-all duration-200 ${
                  inputLevel > 0.3 ? "bg-[var(--color-error)]" :
                  inputLevel > 0.1 ? "bg-[var(--color-warning)]" :
                  "bg-[var(--color-success)]"
                }`}
                style={{ width: `${inputLevel * 100}%` }}
              />
            </div>
          </div>

          {/* Test buttons — compact pills instead of three full-width
              bars across a grid. Active states use the same red-mark
              destructive style as elsewhere when the test is running. */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (isListening) stopListening();
                else void startListening();
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isListening
                  ? "bg-[var(--color-error)] text-[var(--color-on-error)] hover:bg-[var(--color-error)]/90"
                  : "border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-hover)]"
              }`}
            >
              {isListening ? "Stop monitor" : "Start monitor"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isTestingMicrophone) {
                  stopMicrophoneTest();
                  setIsTestingMicrophone(false);
                } else {
                  setIsTestingMicrophone(true);
                  startMicrophoneTest();
                }
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isTestingMicrophone
                  ? "bg-[var(--color-error)] text-[var(--color-on-error)] hover:bg-[var(--color-error)]/90"
                  : "border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-hover)]"
              }`}
            >
              {isTestingMicrophone ? "Stop mic test" : "Test mic"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isTestingSpeakers) {
                  stopSpeakerTest();
                  setIsTestingSpeakers(false);
                } else {
                  setIsTestingSpeakers(true);
                  startSpeakerTest();
                }
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isTestingSpeakers
                  ? "bg-[var(--color-error)] text-[var(--color-on-error)] hover:bg-[var(--color-error)]/90"
                  : "border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-hover)]"
              }`}
            >
              {isTestingSpeakers ? "Stop speaker test" : "Test speakers"}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}
