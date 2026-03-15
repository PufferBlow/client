import { useEffect, useState } from "react";
import { logger } from "../../utils/logger";

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
  const [isPTTActive, setIsPTTActive] = useState(false);

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
        sensitivity,
        voiceActivityMode,
        pttKey,
        noiseSuppression,
        echoCancellation,
        autoGainControl,
        audioQuality,
      }),
    );
  }, [
    selectedInputDevice,
    selectedOutputDevice,
    micVolume,
    speakerVolume,
    sensitivity,
    voiceActivityMode,
    pttKey,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    audioQuality,
  ]);

  useEffect(() => {
    if (voiceActivityMode !== "ptt" || !pttKey) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === pttKey.toLowerCase() && !isPTTActive) {
        setIsPTTActive(true);
        setMessage({ type: "success", text: "PTT activated - audio transmission enabled" });
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === pttKey.toLowerCase() && isPTTActive) {
        setIsPTTActive(false);
        setMessage({ type: "success", text: "PTT released - audio transmission disabled" });
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPTTActive, pttKey, setMessage, voiceActivityMode]);

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
      outputGain.connect(context.destination);
      oscillator.frequency.setValueAtTime(1000, context.currentTime);
      oscillator.type = "sine";
      oscillator.start();
      setAudioContext(context);

      setTimeout(() => {
        try {
          oscillator.stop();
          if (context.state !== "closed") {
            void context.close();
          }
          setAudioContext(null);
          setOutputGainNode(null);
        } catch (error) {
          logger.ui.warn("Speaker test cleanup warning", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        setIsTestingSpeakers(false);
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

  const refreshInputDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === "audioinput");
      setInputDevices(audioInputs);
      setMessage({ type: "success", text: `Found ${audioInputs.length} audio input devices` });
    } catch {
      setMessage({ type: "error", text: "Failed to enumerate audio devices" });
    }
  };

  const startListening = async () => {
    try {
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
