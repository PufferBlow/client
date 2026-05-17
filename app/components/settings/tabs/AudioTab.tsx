/**
 * AudioTab — Settings page > Audio pane. Wraps the whole audio
 * configuration UI: input/output device pickers, mic and speaker
 * volume, audio processing toggles, voice-activity / PTT mode,
 * audio-quality preset, a live spectrum analyzer + input level
 * meter, and test buttons for monitoring / mic / speakers.
 *
 * Every piece of state and every handler the tab uses comes from
 * `useSettingsAudio`. Rather than fan out 40-something individual
 * props, the parent threads the entire hook return through as one
 * `audio` prop — the tab destructures it locally. This keeps the
 * SettingsPage wiring trivial (one line) and means adding a new
 * audio field to the hook doesn't require touching the prop list.
 */
import { ModernSlider, ModernToggle } from "../../AudioControls";
import { useSettingsAudio } from "../useSettingsAudio";

interface AudioTabProps {
  audio: ReturnType<typeof useSettingsAudio>;
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-xl border border-[var(--color-border)] p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--color-on-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text)]">Audio Settings</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">Configure your microphone and audio experience</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--color-surface)]/50 rounded-lg p-3 border border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-secondary)]">Status</div>
            <div className={`text-sm font-medium ${selectedInputDevice ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
              {selectedInputDevice ? 'Ready' : 'Default'}
            </div>
          </div>
          <div className="bg-[var(--color-surface)]/50 rounded-lg p-3 border border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-secondary)]">Input Volume</div>
            <div className="text-sm font-medium text-[var(--color-text)]">{micVolume}%</div>
          </div>
          <div className="bg-[var(--color-surface)]/50 rounded-lg p-3 border border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-secondary)]">Quality</div>
            <div className="text-sm font-medium text-[var(--color-text)]">
              {audioQuality === 'good' ? 'Good' : audioQuality === 'better' ? 'Better' : 'Best'}
            </div>
          </div>
          <div className="bg-[var(--color-surface)]/50 rounded-lg p-3 border border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-secondary)]">Mode</div>
            <div className="text-sm font-medium text-[var(--color-text)]">
              {voiceActivityMode === 'voice' ? 'Voice Act.' : 'Push-to-Talk'}
            </div>
          </div>
        </div>
      </div>

      {/* Input Settings Card */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="p-6 border-b border-[var(--color-border)]">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Microphone Setup</h3>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Device Selection */}
          <div className="bg-[var(--color-background)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="flex items-center space-x-3 mb-4">
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <label className="text-sm font-medium text-[var(--color-text)]">Input Device</label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <select
                  value={selectedInputDevice}
                  onChange={(e) => setSelectedInputDevice(e.target.value)}
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all duration-200 text-sm"
                >
                  <option value="">🎙️ Default Device</option>
                  {inputDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      🎙️ {device.label || `Microphone ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  onClick={() => {
                    void refreshInputDevices();
                  }}
                  className="w-full px-4 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] rounded-lg font-medium transition-colors text-sm flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {/* Volume Control */}
          <div className="bg-[var(--color-background)] rounded-xl p-6 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-[var(--color-text)]">Input Volume</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Adjust microphone sensitivity</p>
              </div>
            </div>

            <ModernSlider
              value={micVolume}
              onChange={setMicVolume}
              min={0}
              max={100}
              size="large"
              color="from-[var(--color-primary)] to-[var(--color-accent)]"
            />

            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-3">
              <span>Muted</span>
              <span>Optimal</span>
              <span>Max</span>
            </div>
          </div>

          {/* Audio Processing Toggles */}
          <div className="bg-[var(--color-background)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="flex items-center space-x-3 mb-4">
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2M7 5h10M7 5a2 2 0 012-2h6a2 2 0 012 2m0 0v2a2 2 0 01-2 2M9 5a2 2 0 012-2h2a2 2 0 012 2m0 0v2M9 5v2m0-2h6" />
              </svg>
              <label className="text-sm font-medium text-[var(--color-text)]">Audio Processing</label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                <div className="flex-1">
                  <div className="font-medium text-[var(--color-text)] text-sm">Noise Suppression</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Filter background noise</div>
                </div>
                <ModernToggle
                  checked={noiseSuppression}
                  onChange={setNoiseSuppression}
                  size="medium"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                <div className="flex-1">
                  <div className="font-medium text-[var(--color-text)] text-sm">Echo Cancellation</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Remove echo feedback</div>
                </div>
                <ModernToggle
                  checked={echoCancellation}
                  onChange={setEchoCancellation}
                  size="medium"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                <div className="flex-1">
                  <div className="font-medium text-[var(--color-text)] text-sm">Auto Gain Control</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Dynamic volume adjustment</div>
                </div>
                <ModernToggle
                  checked={autoGainControl}
                  onChange={setAutoGainControl}
                  size="medium"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Activity & Push-to-Talk */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-medium text-[var(--color-text)]">Voice Activity & Push-to-Talk</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Configure how Pufferblow detects when you're speaking</p>
        </div>

        <div className="p-6 space-y-6">
          {/* PTT vs Voice Activity */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Voice Activation Mode</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setVoiceActivityMode('voice')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  voiceActivityMode === 'voice'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                <div className="text-left">
                  <div className="font-medium text-[var(--color-text)]">Voice Activity</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">Speak to activate transmission</div>
                </div>
              </button>

              <button
                onClick={() => setVoiceActivityMode('ptt')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  voiceActivityMode === 'ptt'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                <div className="text-left">
                  <div className="font-medium text-[var(--color-text)]">Push-to-Talk</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">Hold key to transmit</div>
                </div>
              </button>
            </div>
          </div>

          {/* PTT Key Configuration */}
          {voiceActivityMode === 'ptt' && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Push-to-Talk Key
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={pttKey}
                  onChange={(e) => setPttKey(e.target.value)}
                  className="px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-center font-mono w-16"
                  placeholder="Key"
                  maxLength={1}
                />
                <span className="text-sm text-[var(--color-text-secondary)]">or</span>
                <select
                  value={pttKey}
                  onChange={(e) => setPttKey(e.target.value)}
                  className="px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)]"
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

      {/* Audio Quality */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-medium text-[var(--color-text)]">Audio Quality</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Choose your preferred audio quality settings</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Quality Preset</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setAudioQuality('good')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  audioQuality === 'good'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                <div className="text-center">
                  <div className="font-medium text-[var(--color-text)]">Good</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">~64 kbps</div>
                </div>
              </button>

              <button
                onClick={() => setAudioQuality('better')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  audioQuality === 'better'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                <div className="text-center">
                  <div className="font-medium text-[var(--color-text)]">Better</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">~128 kbps</div>
                </div>
              </button>

              <button
                onClick={() => setAudioQuality('best')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  audioQuality === 'best'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                <div className="text-center">
                  <div className="font-medium text-[var(--color-text)]">Best</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">~256 kbps</div>
                </div>
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-3">
              Higher quality uses more bandwidth but provides better voice clarity
            </p>
          </div>
        </div>
      </div>

      {/* Output Settings */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-medium text-[var(--color-text)]">Output Settings</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Configure speakers and sound output</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Output Device Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
              Output Device (Speakers/Headphones)
            </label>
            <select
              value={selectedOutputDevice}
              onChange={(e) => setSelectedOutputDevice(e.target.value)}
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all duration-200"
            >
              <option value="">Default Device</option>
              {outputDevices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Output Device ${index + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Output Volume */}
          <div className="bg-[var(--color-background)] rounded-xl p-6 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">Output Volume</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Adjust speaker output level</p>
              </div>
            </div>

            <ModernSlider
              value={speakerVolume}
              onChange={setSpeakerVolume}
              min={0}
              max={100}
              size="large"
              color="from-[var(--color-primary)] to-[var(--color-accent)]"
            />

            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-3">
              <span>Muted</span>
              <span>Moderate</span>
              <span>Max</span>
            </div>
          </div>

          {/* Audio Attachment Volume -- global playback level for the
              inline audio players in the message stream. Independent of
              voice-call output so adjusting one doesn't affect the
              other. The per-player slider in AttachmentBubble writes to
              the same setting, so changes anywhere update everywhere. */}
          <div className="bg-[var(--color-background)] rounded-xl p-6 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">Audio Attachment Volume</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Default playback level for audio files shared in chat</p>
              </div>
            </div>

            <ModernSlider
              value={attachmentVolume}
              onChange={setAttachmentVolume}
              min={0}
              max={100}
              size="large"
              color="from-[var(--color-primary)] to-[var(--color-accent)]"
            />

            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-3">
              <span>Muted</span>
              <span>Moderate</span>
              <span>Max</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Audio Monitor */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-medium text-[var(--color-text)]">Audio Monitor</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Test and monitor your audio setup</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Visual Spectrum Analyzer */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Audio Visualization</h4>
            <div className="bg-[var(--color-background)] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="flex items-center justify-center space-x-1 h-20">
                {Array.from(frequencyData, (value, index) => (
                  <div
                    key={index}
                    className="bg-[var(--color-primary)] w-1 rounded-sm transition-all duration-75"
                    style={{
                      height: `${Math.max(4, (value / 255) * 100)}%`,
                      opacity: isListening ? 1 : 0.3
                    }}
                  ></div>
                ))}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] text-center mt-2">
                {isListening ? 'Listening...' : 'Not active'}
              </div>
            </div>
          </div>

          {/* Input Level Meter */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Input Level</h4>
            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-[var(--color-background)] rounded-full h-4 border border-[var(--color-border)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    inputLevel > 0.3 ? 'bg-[var(--color-error)]' :
                    inputLevel > 0.1 ? 'bg-[var(--color-warning)]' :
                    'bg-[var(--color-success)]'
                  }`}
                  style={{ width: `${inputLevel * 100}%` }}
                ></div>
              </div>
              <span className="text-sm font-mono text-[var(--color-text-secondary)] w-12 text-center">
                {Math.round(inputLevel * 100)}%
              </span>
            </div>
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>

          {/* Test Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                if (isListening) {
                  stopListening();
                } else {
                  void startListening();
                }
              }}
              className={`py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                isListening
                  ? 'bg-[var(--color-error)] hover:bg-[var(--color-error)]/90 text-[var(--color-on-error)]'
                  : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)]'
              }`}
            >
              {isListening ? 'Stop Monitoring' : 'Start Monitoring'}
            </button>

            <button
              onClick={() => {
                if (isTestingMicrophone) {
                  stopMicrophoneTest();
                  setIsTestingMicrophone(false);
                } else {
                  setIsTestingMicrophone(true);
                  startMicrophoneTest();
                }
              }}
              className={`py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                isTestingMicrophone
                  ? 'bg-[var(--color-error)] hover:bg-[var(--color-error)]/90 text-[var(--color-on-error)]'
                  : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)]'
              }`}
            >
              {isTestingMicrophone ? 'Stop Mic Test' : 'Test Microphone'}
            </button>

            <button
              onClick={() => {
                if (isTestingSpeakers) {
                  stopSpeakerTest();
                  setIsTestingSpeakers(false);
                } else {
                  setIsTestingSpeakers(true);
                  startSpeakerTest();
                }
              }}
              className={`py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                isTestingSpeakers
                  ? 'bg-[var(--color-error)] hover:bg-[var(--color-error)]/90 text-[var(--color-on-error)]'
                  : 'bg-[var(--color-success)] hover:bg-[var(--color-success)]/90 text-[var(--color-on-success)]'
              }`}
            >
              {isTestingSpeakers ? 'Stop Speaker Test' : 'Test Speakers'}
            </button>
          </div>
        </div>
      </div>

      {/* Status & Info */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-6">
        <h3 className="text-lg font-medium text-[var(--color-text)] mb-4">Device Status</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Input Device</span>
              <span className={`text-sm font-medium ${selectedInputDevice ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
                {selectedInputDevice ? 'Connected' : 'Default'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Output Device</span>
              <span className={`text-sm font-medium ${selectedOutputDevice ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
                {selectedOutputDevice ? 'Connected' : 'Default'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Voice Mode</span>
              <span className="text-sm font-medium text-[var(--color-text)]">
                {voiceActivityMode === 'voice' ? 'Voice Activity' : `Push-to-Talk (${pttKey})`}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Audio Quality</span>
              <span className="text-sm font-medium text-[var(--color-text)]">
                {audioQuality === 'good' ? 'Good' : audioQuality === 'better' ? 'Better' : 'Best'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Noise Suppression</span>
              <span className={`text-sm font-medium ${noiseSuppression ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
                {noiseSuppression ? 'On' : 'Off'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Echo Cancellation</span>
              <span className={`text-sm font-medium ${echoCancellation ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
                {echoCancellation ? 'On' : 'Off'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            💡 <strong>Tip:</strong> Adjust sensitivity for your environment. Test your setup regularly to ensure optimal voice quality.
          </p>
        </div>
      </div>
    </div>
  );
}
