import { useEffect, useRef, useState } from "react";
import { logger } from "../../utils/logger";
import {
  AUDIO_MONITOR_FRAME_EVENT,
  isLiveAudioMonitorAvailable,
  releaseLiveAudioMonitor,
  requestLiveAudioMonitor,
} from "../../services/voiceTransport";

type MessageState = { type: "success" | "error"; text: string } | null;

export function useSettingsAudio({
  currentUser,
  setMessage,
}: {
  currentUser: any;
  setMessage: (message: MessageState) => void;
}) {
  const [micVolume, setMicVolume] = useState(80);
  const [speakerVolume, setSpeakerVolume] = useState(80);
  // Global playback volume applied to audio attachments in the message
  // stream (the inline player in AttachmentBubble). Separate from
  // speakerVolume because that one drives the live voice-call mix --
  // mixing those would mean changing one accidentally affects the
  // other. Persisted in the same localStorage blob so a single
  // settings page can manage everything audio-related.
  const [attachmentVolume, setAttachmentVolume] = useState(100);
  const [isTestingMicrophone, setIsTestingMicrophone] = useState(false);
  const [isTestingSpeakers, setIsTestingSpeakers] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState("");
  const [selectedOutputDevice, setSelectedOutputDevice] = useState("");
  const [inputLevel, setInputLevel] = useState(0);
  const [sensitivity, setSensitivity] = useState(-50);
  const [voiceActivityMode, setVoiceActivityMode] = useState<"voice" | "ptt">("voice");
  const [pttKey, setPttKey] = useState("Alt");
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(true);
  const [audioQuality, setAudioQuality] = useState<"good" | "better" | "best">("better");
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
  const [webAudioContext, setWebAudioContext] = useState<AudioContext | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(0));
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [inputGainNode, setInputGainNode] = useState<GainNode | null>(null);
  const [outputGainNode, setOutputGainNode] = useState<GainNode | null>(null);
  const [activeAudioContext, setActiveAudioContext] = useState<AudioContext | null>(null);
  // isPTTActive state lived here when the hook owned PTT; deleted along
  // with the dead keydown listener.

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedAudioSettings = localStorage.getItem("pufferblow-audio-settings");
    if (!savedAudioSettings) {
      return;
    }

    try {
      const audioSettings = JSON.parse(savedAudioSettings);
      setSelectedInputDevice(audioSettings.selectedInputDevice || "");
      setSelectedOutputDevice(audioSettings.selectedOutputDevice || "");
      setMicVolume(audioSettings.micVolume || 80);
      setSpeakerVolume(audioSettings.speakerVolume || 80);
      setSensitivity(audioSettings.sensitivity || -50);
      setVoiceActivityMode(audioSettings.voiceActivityMode || "voice");
      setPttKey(audioSettings.pttKey || "Alt");
      setNoiseSuppression(audioSettings.noiseSuppression ?? true);
      setEchoCancellation(audioSettings.echoCancellation ?? true);
      setAutoGainControl(audioSettings.autoGainControl ?? true);
      setAudioQuality(audioSettings.audioQuality || "better");
      // `attachmentVolume` may be missing in pre-migration blobs --
      // default to 100 (unattenuated) rather than 0 so existing users
      // don't suddenly play attachments at silence.
      if (typeof audioSettings.attachmentVolume === "number") {
        setAttachmentVolume(
          Math.min(100, Math.max(0, audioSettings.attachmentVolume)),
        );
      }
    } catch (error) {
      logger.ui.warn("Failed to load saved audio settings", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(
      "pufferblow-audio-settings",
      JSON.stringify({
        selectedInputDevice,
        selectedOutputDevice,
        micVolume,
        speakerVolume,
        attachmentVolume,
        sensitivity,
        voiceActivityMode,
        pttKey,
        noiseSuppression,
        echoCancellation,
        autoGainControl,
        audioQuality,
      }),
    );
    // Notify any live VoiceTransport so mid-call slider/PTT/quality flips
    // take effect without requiring a leave + rejoin. The transport
    // re-reads localStorage on the event — no payload needed.
    try {
      window.dispatchEvent(new CustomEvent("pufferblow:audio-settings-changed"));
    } catch {
      // CustomEvent unavailable in some sandboxes (test env, very old WebViews).
      // Non-fatal — the next call connect will pick up the latest values.
    }
  }, [
    selectedInputDevice,
    selectedOutputDevice,
    micVolume,
    speakerVolume,
    attachmentVolume,
    sensitivity,
    voiceActivityMode,
    pttKey,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    audioQuality,
  ]);

  // The Settings page used to mount a global keydown listener here that
  // fired a toast on every PTT press / release. That was the only thing
  // PTT did — the real audio track was never gated. Now that
  // voiceTransport owns PTT (installs its own listener when a call is
  // live and toggles the audio track's `enabled` flag), the toast-spam
  // listener is dead weight. Settings is purely a configuration surface.

  useEffect(() => {
    if (inputGainNode) {
      inputGainNode.gain.setValueAtTime(micVolume / 100, activeAudioContext?.currentTime || 0);
    }
  }, [activeAudioContext, inputGainNode, micVolume]);

  useEffect(() => {
    if (outputGainNode) {
      outputGainNode.gain.setValueAtTime(speakerVolume / 100, activeAudioContext?.currentTime || 0);
    }
  }, [activeAudioContext, outputGainNode, speakerVolume]);

  const createAudioContext = () => {
    if (activeAudioContext && activeAudioContext.state !== "closed") {
      return activeAudioContext;
    }

    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      setActiveAudioContext(context);
      return context;
    } catch (error) {
      logger.ui.error("Failed to create audio context", {
        error: error instanceof Error ? error.message : String(error),
      });
      setMessage({ type: "error", text: "Failed to initialize audio system" });
      return null;
    }
  };

  const getAudioConstraints = (): MediaTrackConstraints => {
    const constraints: MediaTrackConstraints = {
      sampleRate: audioQuality === "good" ? 44100 : audioQuality === "better" ? 48000 : 96000,
      sampleSize: audioQuality === "good" ? 16 : audioQuality === "better" ? 16 : 24,
      channelCount: 1,
      echoCancellation,
      noiseSuppression,
      autoGainControl,
    };

    if (selectedInputDevice) {
      constraints.deviceId = selectedInputDevice;
    }

    return constraints;
  };

  const createGainNodes = (context: AudioContext) => {
    const inputGain = context.createGain();
    const outputGain = context.createGain();
    inputGain.gain.setValueAtTime(micVolume / 100, context.currentTime);
    outputGain.gain.setValueAtTime(speakerVolume / 100, context.currentTime);
    setInputGainNode(inputGain);
    setOutputGainNode(outputGain);
    return { inputGain, outputGain };
  };

  const setupAudioRouting = async (stream: MediaStream) => {
    const context = createAudioContext();
    if (!context) {
      return null;
    }

    const { inputGain } = createGainNodes(context);
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    setAudioAnalyser(analyser);
    source.connect(inputGain);
    inputGain.connect(analyser);
    return { source, analyser };
  };

  const startAudioAnalysis = () => {
    if (!audioAnalyser) {
      logger.ui.warn("Audio analyser not available for analysis");
      return;
    }

    const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
    const updateAnalysis = () => {
      if (!audioAnalyser || !isTestingMicrophone) {
        return;
      }

      try {
        audioAnalyser.getByteFrequencyData(dataArray);
        const avgLevel = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setInputLevel(avgLevel / 255);
        setFrequencyData(new Uint8Array([...dataArray]));
        if (isTestingMicrophone) {
          requestAnimationFrame(updateAnalysis);
        }
      } catch (error) {
        logger.ui.warn("Audio analysis error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    updateAnalysis();
  };

  const startMicrophoneTest = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMessage({ type: "error", text: "Microphone access is not supported in this browser." });
        return;
      }

      if (currentStream) {
        stopMicrophoneTest();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints() });
      setCurrentStream(stream);
      setMicrophoneStream(stream);
      await setupAudioRouting(stream);
      startAudioAnalysis();
      // First successful getUserMedia on this page transitions the
      // permission state from "prompt" to "granted" — browsers
      // SHOULD fire `devicechange` on that transition (which the
      // mount-time listener handles), but some don't. Belt-and-
      // braces: refresh manually so device labels populate
      // immediately after the test starts.
      void refreshDevices(true);
      setMessage({ type: "success", text: "Microphone test started with current audio settings." });
    } catch (error) {
      setIsTestingMicrophone(false);
      setMessage({ type: "error", text: "Failed to start microphone test. Check permissions and device availability." });
      logger.ui.error("Microphone test error", { error: error instanceof Error ? error.message : String(error) });
    }
  };

  const stopMicrophoneTest = () => {
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
      setCurrentStream(null);
    }

    if (activeAudioContext && activeAudioContext.state !== "closed") {
      void activeAudioContext.close();
      setActiveAudioContext(null);
      setAudioAnalyser(null);
      setInputGainNode(null);
      setOutputGainNode(null);
    }

    setFrequencyData(new Uint8Array(32));
    setInputLevel(0);
    setMicVolume(80);
    setIsTestingMicrophone(false);
    if (microphoneStream) {
      setMicrophoneStream(null);
    }
    setMessage({ type: "success", text: "Microphone test stopped." });
  };

  const startSpeakerTest = async () => {
    try {
      const context = createAudioContext();
      if (!context) {
        setMessage({ type: "error", text: "Failed to initialize audio system." });
        return;
      }

      const { outputGain } = createGainNodes(context);
      const oscillator = context.createOscillator();
      oscillator.connect(outputGain);

      // Route the test tone through an off-screen <audio> element
      // so the output is bound to `selectedOutputDevice` via
      // `setSinkId` — otherwise `context.destination` always plays
      // through the system default, which made the speaker test
      // ignore the dropdown selection above it (the whole point
      // of the test is to verify THAT sink, not the system one).
      //
      // Fallback: browsers that don't expose `setSinkId` (Firefox,
      // Safari) silently fall back to the system default — same
      // behaviour they had before, no regression.
      const mediaDest = context.createMediaStreamDestination();
      outputGain.connect(mediaDest);
      const sink = document.createElement("audio");
      sink.srcObject = mediaDest.stream;
      sink.autoplay = true;
      // Hidden but still in the DOM so the browser actually plays it.
      sink.style.position = "absolute";
      sink.style.left = "-9999px";
      sink.style.top = "0";
      document.body.appendChild(sink);

      type SinkableAudio = HTMLAudioElement & {
        setSinkId?: (sinkId: string) => Promise<void>;
      };
      const sinkable = sink as SinkableAudio;
      if (selectedOutputDevice && typeof sinkable.setSinkId === "function") {
        try {
          await sinkable.setSinkId(selectedOutputDevice);
        } catch (error) {
          logger.ui.warn("Speaker test setSinkId failed", {
            sinkId: selectedOutputDevice,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      oscillator.frequency.setValueAtTime(1000, context.currentTime);
      oscillator.type = "sine";
      oscillator.start();
      setAudioContext(context);

      // Tear-down helper used by both the timeout and the catch
      // path. Idempotent — safe to call from either side.
      const cleanup = () => {
        try {
          oscillator.stop();
        } catch {
          // Already stopped.
        }
        try {
          sink.pause();
          sink.srcObject = null;
        } catch {
          // Defensive.
        }
        if (sink.parentNode) {
          sink.parentNode.removeChild(sink);
        }
        if (context.state !== "closed") {
          void context.close();
        }
        setAudioContext(null);
        setOutputGainNode(null);
        setIsTestingSpeakers(false);
      };

      setTimeout(() => {
        try {
          cleanup();
        } catch (error) {
          logger.ui.warn("Speaker test cleanup warning", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        setMessage({ type: "success", text: "Speaker test completed." });
      }, 3000);

      setMessage({ type: "success", text: "Playing test tone for 3 seconds..." });
    } catch (error) {
      setIsTestingSpeakers(false);
      setMessage({ type: "error", text: "Failed to start speaker test. Check output device and permissions." });
      logger.ui.error("Speaker test error", { error: error instanceof Error ? error.message : String(error) });
    }
  };

  const stopSpeakerTest = () => {
    if (audioContext) {
      try {
        if (audioContext.state === "running") {
          void audioContext.close();
        }
      } catch (error) {
        logger.ui.warn("Speaker test stop warning", { error: error instanceof Error ? error.message : String(error) });
      }
      setAudioContext(null);
    }

    if (outputGainNode) {
      try {
        outputGainNode.gain.exponentialRampToValueAtTime(0.01, activeAudioContext?.currentTime || 0);
      } catch (error) {
        logger.ui.warn("Output gain ramp warning", { error: error instanceof Error ? error.message : String(error) });
      }
      setOutputGainNode(null);
    }

    if (activeAudioContext && activeAudioContext !== audioContext) {
      try {
        void activeAudioContext.close();
        setActiveAudioContext(null);
      } catch (error) {
        logger.ui.warn("Active context cleanup warning", { error: error instanceof Error ? error.message : String(error) });
      }
    }

    setIsTestingSpeakers(false);
    setMessage({ type: "success", text: "Speaker test stopped." });
  };

  /**
   * Enumerate both input + output devices.
   *
   * `enumerateDevices` returns devices regardless of permission,
   * BUT browsers redact the device `.label` field until the page
   * has been granted `getUserMedia` for that kind at least once.
   * So a first call from a page that's never asked returns
   * entries like ``{ deviceId: 'abc...', label: '' }``, which
   * renders as "Default device" / empty in the picker.
   *
   * Solution: this function always enumerates and stores the
   * result. Three triggers re-run it:
   *
   *   1. Initial mount — sets the device list with whatever
   *      labels are available (none until the page has a track).
   *   2. After any successful getUserMedia call (mic test, call
   *      connect, listener start) — the second pass returns
   *      proper labels because the permission grant is now live.
   *   3. `navigator.mediaDevices.devicechange` events — picks
   *      up hot-plug + unplug + system default changes.
   *
   * The `silent` arg lets internal callers refresh without
   * surfacing a toast; the user-pressed Refresh button still
   * confirms with a count message.
   */
  const refreshDevices = async (silent = false) => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === "audioinput");
      const audioOutputs = devices.filter((device) => device.kind === "audiooutput");
      setInputDevices(audioInputs);
      setOutputDevices(audioOutputs);
      if (!silent) {
        setMessage({
          type: "success",
          text: `Found ${audioInputs.length} input ${audioInputs.length === 1 ? "device" : "devices"} and ${audioOutputs.length} output ${audioOutputs.length === 1 ? "device" : "devices"}.`,
        });
      }
    } catch {
      if (!silent) {
        setMessage({ type: "error", text: "Failed to enumerate audio devices" });
      }
    }
  };

  // Backward-compat alias — earlier UI code only knew about input
  // refresh. Kept so the Settings → Voice tab keeps working
  // without a sweep. New callers should use refreshDevices.
  const refreshInputDevices = refreshDevices;

  /**
   * Initial enumeration + change-event subscription.
   *
   * Pass 1 fires at mount and populates the picker with whatever
   * the browser will share without an active permission. If the
   * page has been granted mic access in a prior session, labels
   * come through; otherwise we get a "device exists, name
   * unknown" entry. Either is better than an empty dropdown.
   *
   * The `devicechange` listener picks up subsequent additions /
   * removals (USB headset plug, Bluetooth pair) AND — crucially —
   * the relabel that happens after the FIRST successful
   * getUserMedia: browsers fire `devicechange` when the permission
   * state transitions, so the picker repopulates automatically
   * without callers needing to thread re-enumeration into every
   * getUserMedia call site.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.mediaDevices) return;
    void refreshDevices(true);
    const handler = () => {
      void refreshDevices(true);
    };
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscription handle for the live-call audio monitor (when a
  // voice call is active and we're tapping its stream instead of
  // running our own getUserMedia). Cleaned up by stopListening.
  const liveMonitorUnsubRef = useRef<(() => void) | null>(null);

  const startListening = async () => {
    try {
      // Path A: a voice call is active. Subscribe to the transport's
      // live monitor — single mic capture is shared between the
      // call and the settings meter. Avoids duplicating
      // getUserMedia + DSP pipelines, and lets the user see their
      // own input as the peer hears it.
      if (isLiveAudioMonitorAvailable()) {
        requestLiveAudioMonitor();
        const handler = (event: Event) => {
          const detail = (event as CustomEvent<{
            frequencyData: Uint8Array;
            inputLevel: number;
          }>).detail;
          if (!detail) return;
          setFrequencyData(detail.frequencyData);
          setInputLevel(detail.inputLevel);
        };
        window.addEventListener(AUDIO_MONITOR_FRAME_EVENT, handler);
        liveMonitorUnsubRef.current = () => {
          window.removeEventListener(AUDIO_MONITOR_FRAME_EVENT, handler);
          releaseLiveAudioMonitor();
        };
        setIsListening(true);
        setMessage({
          type: "success",
          text: "Listening to your call audio. Speak normally to see the levels above.",
        });
        return;
      }

      // Path B: no live call. Acquire a private mic capture for the
      // monitor — same code path that was here before. The user
      // explicitly toggled "Start monitor" so the permission
      // prompt isn't surprising.
      const context = new AudioContext();
      setWebAudioContext(context);

      const analyser = context.createAnalyser();
      analyser.fftSize = 64;
      setAudioAnalyser(analyser);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
      });

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      setIsListening(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateSpectrum = () => {
        if (analyser && isListening) {
          analyser.getByteFrequencyData(dataArray);
          const avgLevel = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setInputLevel(avgLevel / 255);
          setFrequencyData(new Uint8Array([...dataArray]));
          requestAnimationFrame(updateSpectrum);
        }
      };
      updateSpectrum();

      setMessage({ type: "success", text: "Listening to microphone... Check the audio levels above." });
    } catch {
      setMessage({ type: "error", text: "Failed to start microphone monitoring" });
    }
  };

  const stopListening = () => {
    setIsListening(false);
    // Live-call subscription path (Path A above) — release the
    // refcounted monitor and detach the frame listener.
    if (liveMonitorUnsubRef.current) {
      liveMonitorUnsubRef.current();
      liveMonitorUnsubRef.current = null;
    }
    // Private getUserMedia path (Path B above) — tear down the
    // AudioContext. The mic stream's tracks were owned by the
    // source node; closing the context releases them.
    if (webAudioContext) {
      void webAudioContext.close();
      setWebAudioContext(null);
      setAudioAnalyser(null);
    }
    setFrequencyData(new Uint8Array(32));
  };

  return {
    micVolume,
    setMicVolume,
    speakerVolume,
    setSpeakerVolume,
    attachmentVolume,
    setAttachmentVolume,
    isTestingMicrophone,
    setIsTestingMicrophone,
    isTestingSpeakers,
    setIsTestingSpeakers,
    inputDevices,
    setInputDevices,
    outputDevices,
    setOutputDevices,
    selectedInputDevice,
    setSelectedInputDevice,
    selectedOutputDevice,
    setSelectedOutputDevice,
    inputLevel,
    sensitivity,
    setSensitivity,
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
  };
}
