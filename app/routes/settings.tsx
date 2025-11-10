import type { Route } from "./+types/settings";
import { Link } from "react-router";
import { useTheme, themePresets, type AppearanceConfig } from "../components/ThemeProvider";
import { useState, useEffect } from "react";
import { FileUploadInput } from "../components/FileUploadInput";
import { UserCard } from "../components/UserCard";
import { CroppableImage } from "../components/CroppableImage";
import { ModernSlider, ModernToggle, AudioTestButton, AudioLevelMeter, SpectrumAnalyzer, DeviceCard } from "../components/AudioControls";
import { getHostPortFromStorage, setHostPortToStorage, useCurrentUserProfile, useUpdateUsername, useUpdateStatus, useUpdateBio, useUpdateAvatar, useUpdateBanner, useUpdatePassword, useResetAuthToken, useLogout } from "../services/user";
import { useQueryClient } from '@tanstack/react-query';
import { User, Palette, Volume2, Server, Shield, ArrowLeft } from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'audio' | 'server' | 'security'>('profile');

  // React Query hooks - must be called before any early returns
  const queryClient = useQueryClient();
  const { data: currentUser, isLoading: userLoading, error: userError } = useCurrentUserProfile();
  const updateUsernameMutation = useUpdateUsername();
  const updateStatusMutation = useUpdateStatus();
  const updateBioMutation = useUpdateBio();
  const updateAvatarMutation = useUpdateAvatar();
  const updateBannerMutation = useUpdateBanner();
  const updatePasswordMutation = useUpdatePassword();
  const resetAuthTokenMutation = useResetAuthToken();
  const { logout } = useLogout();
  const { setTheme, appearanceConfig, setAppearanceConfig, exportConfig, importConfig, resetToPreset } = useTheme();

  // Get current theme from localStorage
  const getCurrentTheme = () => {
    if (typeof window === 'undefined') return 'dark'; // SSR fallback
    const savedTheme = localStorage.getItem('pufferblow-theme');
    if (!savedTheme || savedTheme === 'system') {
      return 'system';
    }
    return savedTheme;
  };
  const currentTheme = getCurrentTheme();

  // Local state - must be called before any conditional returns
  const [userStatus, setUserStatus] = useState<'online' | 'offline' | 'idle' | 'dnd'>('online');
  const [userBio, setUserBio] = useState('');
  const [bioInputValue, setBioInputValue] = useState('');
  const [hasBioChanged, setHasBioChanged] = useState(false);
  const [isDndModeEnabled, setIsDndModeEnabled] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [newHostPort, setNewHostPort] = useState('');
  const [micVolume, setMicVolume] = useState(80);
  const [speakerVolume, setSpeakerVolume] = useState(80);
  const [isTestingMicrophone, setIsTestingMicrophone] = useState(false);
  const [isTestingSpeakers, setIsTestingSpeakers] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Image cropping state
  const [isCroppingModalOpen, setIsCroppingModalOpen] = useState(false);
  const [croppingImageType, setCroppingImageType] = useState<'avatar' | 'banner' | null>(null);
  const [croppingImageSrc, setCroppingImageSrc] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // Audio Settings State
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState<string>('');
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('');
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [sensitivity, setSensitivity] = useState<number>(-50);
  const [voiceActivityMode, setVoiceActivityMode] = useState<'voice' | 'ptt'>('voice');
  const [pttKey, setPttKey] = useState<string>('Alt');
  const [noiseSuppression, setNoiseSuppression] = useState<boolean>(true);
  const [echoCancellation, setEchoCancellation] = useState<boolean>(true);
  const [autoGainControl, setAutoGainControl] = useState<boolean>(true);
  const [audioQuality, setAudioQuality] = useState<'good' | 'better' | 'best'>('better');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingAnimation, setRecordingAnimation] = useState<boolean>(false);
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
  const [webAudioContext, setWebAudioContext] = useState<AudioContext | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(0));
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [inputGainNode, setInputGainNode] = useState<GainNode | null>(null);
  const [outputGainNode, setOutputGainNode] = useState<GainNode | null>(null);
  const [activeAudioContext, setActiveAudioContext] = useState<AudioContext | null>(null);
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);

  // Load initial data and set loading to false
  useEffect(() => {
    const loadData = async () => {
      if (currentUser) {
        if (currentUser.about) {
          setUserBio(currentUser.about);
          setBioInputValue(currentUser.about);
        }
      }
      if (typeof window !== 'undefined') {
        const savedDefaultStatus = localStorage.getItem('pufferblow-default-status') as 'online' | 'offline' | 'idle' | 'dnd' || 'online';
        setIsDndModeEnabled(savedDefaultStatus === 'dnd');

        // Load audio settings
        const savedAudioSettings = localStorage.getItem('pufferblow-audio-settings');
        if (savedAudioSettings) {
          try {
            const audioSettings = JSON.parse(savedAudioSettings);
            setSelectedInputDevice(audioSettings.selectedInputDevice || '');
            setSelectedOutputDevice(audioSettings.selectedOutputDevice || '');
            setMicVolume(audioSettings.micVolume || 80);
            setSpeakerVolume(audioSettings.speakerVolume || 80);
            setSensitivity(audioSettings.sensitivity || -50);
            setVoiceActivityMode(audioSettings.voiceActivityMode || 'voice');
            setPttKey(audioSettings.pttKey || 'Alt');
            setNoiseSuppression(audioSettings.noiseSuppression ?? true);
            setEchoCancellation(audioSettings.echoCancellation ?? true);
            setAutoGainControl(audioSettings.autoGainControl ?? true);
            setAudioQuality(audioSettings.audioQuality || 'better');
          } catch (error) {
            console.warn('Failed to load saved audio settings:', error);
          }
        }
      }
    };
    loadData();
  }, [currentUser]);

  // Set initial active tab based on URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['profile', 'appearance', 'audio', 'server', 'security'].includes(hash)) {
      setActiveTab(hash as any);
    }
  }, []);

  // Save audio settings to localStorage whenever they change
  useEffect(() => {
    const audioSettings = {
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
      audioQuality
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('pufferblow-audio-settings', JSON.stringify(audioSettings));
    }
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
    audioQuality
  ]);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Create audio context when needed
  const createAudioContext = (): AudioContext | null => {
    if (activeAudioContext && activeAudioContext.state !== 'closed') {
      return activeAudioContext;
    }

    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      setActiveAudioContext(context);
      return context;
    } catch (error) {
      console.error('Failed to create audio context:', error);
      setMessage({ type: 'error', text: 'Failed to initialize audio system' });
      return null;
    }
  };

  // Get audio constraints based on current settings
  const getAudioConstraints = () => {
    const constraints: MediaTrackConstraints = {
      sampleRate: audioQuality === 'good' ? 44100 : audioQuality === 'better' ? 48000 : 96000,
      sampleSize: audioQuality === 'good' ? 16 : audioQuality === 'better' ? 16 : 24,
      channelCount: 1, // Mono for communication
      echoCancellation: echoCancellation,
      noiseSuppression: noiseSuppression,
      autoGainControl: autoGainControl
    };

    if (selectedInputDevice) {
      constraints.deviceId = selectedInputDevice;
    }

    return constraints;
  };

  // Create gain nodes for volume control
  const createGainNodes = (context: AudioContext) => {
    const inputGain = context.createGain();
    const outputGain = context.createGain();

    // Apply volume settings
    inputGain.gain.setValueAtTime(micVolume / 100, context.currentTime);
    outputGain.gain.setValueAtTime(speakerVolume / 100, context.currentTime);

    setInputGainNode(inputGain);
    setOutputGainNode(outputGain);

    return { inputGain, outputGain };
  };

  // Setup audio routing for monitoring
  const setupAudioRouting = async (stream: MediaStream) => {
    const context = createAudioContext();
    if (!context) return null;

    const { inputGain } = createGainNodes(context);

    // Create nodes
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    setAudioAnalyser(analyser);

    // Setup routing: source -> input gain -> analyser
    source.connect(inputGain);
    inputGain.connect(analyser);

    return { source, analyser };
  };

  // Push-to-Talk keyboard handlers
  useEffect(() => {
    if (voiceActivityMode !== 'ptt' || !pttKey) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === pttKey.toLowerCase() && !isPTTActive) {
        setIsPTTActive(true);
        setMessage({ type: 'success', text: 'PTT activated - audio transmission enabled' });
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === pttKey.toLowerCase() && isPTTActive) {
        setIsPTTActive(false);
        setMessage({ type: 'success', text: 'PTT released - audio transmission disabled' });
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [voiceActivityMode, pttKey, isPTTActive]);

  // Update volume levels when sliders change
  useEffect(() => {
    if (inputGainNode) {
      inputGainNode.gain.setValueAtTime(micVolume / 100, activeAudioContext?.currentTime || 0);
    }
  }, [micVolume, inputGainNode, activeAudioContext]);

  useEffect(() => {
    if (outputGainNode) {
      outputGainNode.gain.setValueAtTime(speakerVolume / 100, activeAudioContext?.currentTime || 0);
    }
  }, [speakerVolume, outputGainNode, activeAudioContext]);

  const hostPort = getHostPortFromStorage() || 'localhost:7575';

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || updateUsernameMutation.isPending) return;

    // Optimistic update
    const originalData = currentUser;
    if (currentUser) {
      // Temporarily update the query cache
      queryClient.setQueryData(['user', 'profile', 'current'], {
        ...currentUser,
        username: newUsername.trim()
      });
    }

    try {
      await updateUsernameMutation.mutateAsync(newUsername);
      setMessage({ type: 'success', text: 'Username updated successfully!' });
      setNewUsername('');
    } catch (error) {
      // Revert on error
      if (originalData) {
        queryClient.setQueryData(['user', 'profile', 'current'], originalData);
      }
      setMessage({ type: 'error', text: 'Failed to update username' });
    }
  };

  const handleStatusSubmit = async () => {
    if (updateStatusMutation.isPending) return;

    // Optimistic update
    const originalStatus = currentUser?.status;
    if (currentUser) {
      queryClient.setQueryData(['user', 'profile', 'current'], {
        ...currentUser,
        status: userStatus
      });
    }

    try {
      await updateStatusMutation.mutateAsync(userStatus);
      setMessage({ type: 'success', text: 'Status updated successfully!' });
    } catch (error) {
      // Revert on error
      if (currentUser && originalStatus) {
        queryClient.setQueryData(['user', 'profile', 'current'], {
          ...currentUser,
          status: originalStatus
        });
      }
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const handleBioChange = async () => {
    if (updateBioMutation.isPending || !hasBioChanged) return;

    // Optimistic update
    const originalBio = currentUser?.about;
    if (currentUser) {
      queryClient.setQueryData(['user', 'profile', 'current'], {
        ...currentUser,
        about: bioInputValue
      });
    }

    try {
      await updateBioMutation.mutateAsync(bioInputValue);
      setMessage({ type: 'success', text: 'Bio updated successfully!' });
      setHasBioChanged(false);
    } catch (error) {
      // Revert on error
      if (currentUser && originalBio !== undefined) {
        queryClient.setQueryData(['user', 'profile', 'current'], {
          ...currentUser,
          about: originalBio
        });
      }
      setMessage({ type: 'error', text: 'Failed to update bio' });
    }
  };

  const handlePasswordSubmit = async () => {
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) return;
    updatePasswordMutation.mutate({
      new_password: newPassword,
      old_password: currentPassword
    });
    setMessage({ type: 'success', text: 'Password updated successfully!' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleResetAuthToken = async () => {
    if (!resetPassword || resetAuthTokenMutation.isPending) return;
    resetAuthTokenMutation.mutate(resetPassword);
    setMessage({ type: 'success', text: 'Auth token reset successfully!' });
    setResetPassword('');
    setShowResetModal(false);
  };

  const handleAvatarFileSubmit = async (file: File) => {
    if (!file) return;

    // Store the file and open cropping modal
    setSelectedImageFile(file);
    setCroppingImageType('avatar');
    setCroppingImageSrc(URL.createObjectURL(file));
    setIsCroppingModalOpen(true);
  };

  const handleAvatarUrlSubmit = async (url: string) => {
    if (!url.trim() || updateAvatarMutation.isPending) return;
    try {
      await updateAvatarMutation.mutateAsync(url);
      setMessage({ type: 'success', text: 'Avatar updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update avatar' });
    }
  };

  const handleBannerFileSubmit = async (file: File) => {
    if (!file) return;

    // Store the file and open cropping modal
    setSelectedImageFile(file);
    setCroppingImageType('banner');
    setCroppingImageSrc(URL.createObjectURL(file));
    setIsCroppingModalOpen(true);
  };

  const handleBannerUrlSubmit = async (url: string) => {
    if (!url.trim() || updateBannerMutation.isPending) return;

    // Set preview immediately for URL inputs
    setBannerPreview(url.trim());
  };

  // Handle cropped image (converted from blob to file)
  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!croppingImageType) return;

    // Convert blob to File object
    const file = new File([croppedBlob], `${croppingImageType}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });

    if (croppingImageType === 'avatar') {
      try {
        await updateAvatarMutation.mutateAsync(file);
        setMessage({ type: 'success', text: 'Avatar updated successfully!' });
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to update avatar' });
      }
    } else if (croppingImageType === 'banner') {
      try {
        setBannerFile(file);
        // Create object URL for immediate preview
        const objectUrl = URL.createObjectURL(file);
        setBannerPreview(objectUrl);

        setMessage({ type: 'success', text: 'Banner updated successfully!' });
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to update banner' });
      }
    }

    // Close modal and clean up
    setIsCroppingModalOpen(false);
    setCroppingImageSrc(null);
    setSelectedImageFile(null);
    setCroppingImageType(null);
  };

  const handleCroppingCancel = () => {
    setIsCroppingModalOpen(false);
    setCroppingImageSrc(null);
    setSelectedImageFile(null);
    setCroppingImageType(null);
  };

  const handleHostPortSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostPort.trim()) return;
    const hostPortRegex = /^([a-zA-Z0-9.-]+|\[[a-fA-F0-9:]+\]):(\d+)$/;
    if (!hostPortRegex.test(newHostPort)) {
      setMessage({ type: 'error', text: 'Invalid host:port format. Please use format like \'127.0.0.1:7575\' or \'localhost:7575\'' });
      return;
    }
    try {
      const testUrl = new URL(`http://${newHostPort}`);
      if (!testUrl.hostname || !testUrl.port) {
        throw new Error('Invalid host or port');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Invalid host:port format. Please ensure the host and port are valid.' });
      return;
    }
    setHostPortToStorage(newHostPort);
    setMessage({ type: 'success', text: 'Server host:port updated successfully. Changes will take effect on next login.' });
    setNewHostPort('');
  };

  // Audio testing functions
  const startMicrophoneTest = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMessage({ type: 'error', text: 'Microphone access is not supported in this browser.' });
        return;
      }

      // Stop any existing test first
      if (currentStream) {
        stopMicrophoneTest();
      }

      // Get microphone access with current constraints
      const constraints = getAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      setCurrentStream(stream);
      setMicrophoneStream(stream);

      // Setup audio routing
      await setupAudioRouting(stream);

      // Start real-time analysis
      startAudioAnalysis();

      setMessage({ type: 'success', text: 'Microphone test started with current audio settings.' });
    } catch (error) {
      setIsTestingMicrophone(false);
      setMessage({ type: 'error', text: 'Failed to start microphone test. Check permissions and device availability.' });
      console.error('Microphone test error:', error);
    }
  };

  const stopMicrophoneTest = () => {
    if (currentStream) {
      currentStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
      setCurrentStream(null);
    }

    // Clean up audio context and routing
    if (activeAudioContext && activeAudioContext.state !== 'closed') {
      activeAudioContext.close();
      setActiveAudioContext(null);
      setAudioAnalyser(null);
      setInputGainNode(null);
      setOutputGainNode(null);
    }

    // Reset visualization data
    setFrequencyData(new Uint8Array(32));
    setInputLevel(0);
    setMicVolume(80); // Reset to default

    setIsTestingMicrophone(false);
    if (microphoneStream) {
      setMicrophoneStream(null);
    }
    setMessage({ type: 'success', text: 'Microphone test stopped.' });
  };

  const startSpeakerTest = async () => {
    try {
      const context = createAudioContext();
      if (!context) {
        setMessage({ type: 'error', text: 'Failed to initialize audio system.' });
        return;
      }

      const { outputGain } = createGainNodes(context);

      // Create oscillator for test tone
      const oscillator = context.createOscillator();
      oscillator.connect(outputGain);

      // Also connect to audio destination for output
      outputGain.connect(context.destination);

      oscillator.frequency.setValueAtTime(1000, context.currentTime); // 1kHz test tone
      oscillator.type = 'sine';

      // Start the tone
      oscillator.start();

      // Store reference for cleanup
      setAudioContext(context as any);

      // Stop after 3 seconds
      setTimeout(() => {
        try {
          oscillator.stop();
          if (context.state !== 'closed') {
            context.close();
          }
          setAudioContext(null);
          setOutputGainNode(null);
        } catch (error) {
          console.warn('Speaker test cleanup warning:', error);
        }
        setIsTestingSpeakers(false);
        setMessage({ type: 'success', text: 'Speaker test completed.' });
      }, 3000);

      setMessage({ type: 'success', text: 'Playing test tone for 3 seconds...' });
    } catch (error) {
      setIsTestingSpeakers(false);
      setMessage({ type: 'error', text: 'Failed to start speaker test. Check output device and permissions.' });
      console.error('Speaker test error:', error);
    }
  };

  const stopSpeakerTest = () => {
    if (audioContext) {
      try {
        if (audioContext.state === 'running') {
          // Try to stop any oscillators connected to the context
          audioContext.close();
        }
      } catch (error) {
        console.warn('Speaker test stop warning:', error);
      }
      setAudioContext(null);
    }

    if (outputGainNode) {
      try {
        outputGainNode.gain.exponentialRampToValueAtTime(0.01, activeAudioContext?.currentTime || 0);
      } catch (error) {
        console.warn('Output gain ramp warning:', error);
      }
      setOutputGainNode(null);
    }

    if (activeAudioContext && activeAudioContext !== audioContext) {
      try {
        activeAudioContext.close();
        setActiveAudioContext(null);
      } catch (error) {
        console.warn('Active context cleanup warning:', error);
      }
    }

    setIsTestingSpeakers(false);
    setMessage({ type: 'success', text: 'Speaker test stopped.' });
  };

  // Real-time audio analysis function
  const startAudioAnalysis = () => {
    if (!audioAnalyser) {
      console.warn('Audio analyser not available for analysis');
      return;
    }

    const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);

    const updateAnalysis = () => {
      if (!audioAnalyser || !isTestingMicrophone) return;

      try {
        audioAnalyser.getByteFrequencyData(dataArray);

        // Calculate average input level
        const avgLevel = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setInputLevel(avgLevel / 255);

        // Update frequency data for visualization
        setFrequencyData(new Uint8Array([...dataArray]));

        // Continue analysis loop
        if (isTestingMicrophone) {
          requestAnimationFrame(updateAnalysis);
        }
      } catch (error) {
        console.warn('Audio analysis error:', error);
      }
    };

    updateAnalysis();
  };

  // Handle loading timeout - prevent infinite loading and redirect to dashboard
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  useEffect(() => {
    if (userLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
        // Redirect to dashboard if settings take too long to load
        if (typeof window !== 'undefined') {
          window.location.href = '/dashboard';
        }
      }, 5000); // 5 second timeout for settings

      return () => clearTimeout(timer);
    }
  }, [userLoading]);

  // Handle error state - redirect to dashboard if profile fetch fails
  useEffect(() => {
    if (userError) {
      // Redirect to dashboard on profile error
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    }
  }, [userError]);

  // Show skeleton loading state
  if (userLoading) {
    return (
      <div className="h-screen bg-[var(--color-background)] flex font-sans select-none relative overflow-hidden">
        {/* Nord-themed Sidebar Skeleton */}
        <div className="w-64 bg-[var(--color-background-secondary)] border-r border-[var(--color-border)] flex flex-col">
          <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 bg-[var(--color-background-tertiary)]">
            <div className="w-8 h-8 bg-[var(--color-accent)] rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-background)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-[var(--color-text)] font-semibold text-sm ml-2">User Settings</span>
            <span className="bg-[var(--color-error)] text-white text-xs px-1.5 py-0.5 rounded-full font-bold ml-auto">USER</span>
          </div>
        </div>
        <div className="flex-1 p-6 animate-pulse">
          <div className="h-8 bg-gray-600 rounded w-48 mb-6"></div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-700 rounded-lg p-6 mb-6">
              <div className="h-6 bg-gray-600 rounded mb-4 w-48"></div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-600 rounded w-full"></div>
                <div className="h-4 bg-gray-600 rounded w-3/4"></div>
                <div className="h-10 bg-gray-600 rounded w-32"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show error state - redirect to dashboard if profile fetch fails
  if (userError) {
    return (
      <div className="h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl p-8 border border-[var(--color-border)]">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.6-.833-2.37 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">Failed to Load Settings</h1>
              <p className="text-lg text-[var(--color-text-secondary)] mb-4">
                There was an issue loading your profile information. This may be due to a network issue or expired session.
              </p>
              <Link
                to="/dashboard"
                className="inline-block w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-accent-hover)] text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading timeout error
  if (loadingTimeout) {
    return (
      <div className="h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl p-8 border border-[var(--color-border)]">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">Loading Timeout</h1>
              <p className="text-lg text-[var(--color-text-secondary)] mb-4">
                Settings are taking too long to load. Please try again or go to dashboard.
              </p>
              <Link
                to="/dashboard"
                className="inline-block w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-accent-hover)] text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User className="w-6 h-6" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-6 h-6" /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-6 h-6" /> },
    { id: 'server', label: 'Server', icon: <Server className="w-6 h-6" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-6 h-6" /> },
  ];

  return (
    <>
      <div className="h-screen bg-[var(--color-background)] flex font-sans select-none relative overflow-hidden">
        {/* Nord-themed Sidebar */}
        <div className="w-64 bg-[var(--color-background-secondary)] border-r border-[var(--color-border)] flex flex-col">
          {/* User Settings Header */}
          <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 bg-[var(--color-background-tertiary)]">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[var(--color-accent)] rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-[var(--color-background)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-[var(--color-text)] font-semibold text-sm">User Settings</span>
            </div>
            <div className="ml-auto">
              <span className="bg-[var(--color-error)] text-[var(--color-background)] text-xs px-1.5 py-0.5 rounded-full font-bold">USER</span>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="flex-1 overflow-y-auto py-3">
            <div className="px-2">
              {/* Settings Section */}
              <div className="mb-6">
                <div className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Account Settings
                </div>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full px-3 py-2 mb-1 rounded-md flex items-center space-x-3 transition-all duration-200 cursor-pointer text-left ${activeTab === tab.id
                        ? 'bg-[var(--color-active)] text-[var(--color-text)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                      }`}
                  >
                    <div className={`transition-colors ${activeTab === tab.id ? 'text-[var(--color-primary)]' : ''}`}>
                      {tab.icon}
                    </div>
                    <span className="font-medium text-sm">{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="ml-auto w-1 h-6 bg-[var(--color-primary)] rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Back to Dashboard Button */}
          <Link
            to="/dashboard"
            className="m-2 p-2 hover:bg-[var(--color-hover)] rounded-lg transition-all duration-200 flex items-center space-x-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer"
            title="Back to Dashboard"
          >
            <div className="w-8 h-8 flex items-center justify-center ml-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <span className="font-medium text-sm">Back to Dashboard</span>
          </Link>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[var(--color-background)] overflow-hidden">
          {/* Header */}
          <div className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-6 flex-shrink-0">
            <div className="flex items-center space-x-4">
              <h1 className="text-[var(--color-text)] font-semibold text-base">
                {tabs.find(tab => tab.id === activeTab)?.label}
              </h1>

              {/* Error/Success Messages */}
              {message && (
                <div className={`ml-auto px-4 py-2 rounded-lg border text-sm ${message.type === 'success' ? 'bg-green-900/20 text-green-400 border-green-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">{message.text}</div>
                    <button
                      onClick={() => setMessage(null)}
                      className={`ml-4 p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
                      aria-label="Close message"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-[var(--color-background)]">
            {activeTab === 'profile' && (
              <div className="max-w-7xl mx-auto">
                {/* Profile Update Section - Discord Style */}
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] overflow-hidden">
                  <div className="p-6 border-b border-[var(--color-border)]">
                    <h2 className="text-xl font-semibold text-[var(--color-text)]">Update Profile</h2>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      Edit your profile information and see a preview of how it will appear to others.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[600px]">
                    {/* Profile Preview - Left Side */}
                    <div className="lg:col-span-1 border-r border-[var(--color-border)] bg-[var(--color-background-secondary)] flex items-center justify-center p-8">
                      <div className="w-full max-w-sm">
                        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4 text-center">
                          Profile Preview
                        </h3>
                        <UserCard
                          username={newUsername || currentUser?.username || 'Username'}
                          bio={bioInputValue || 'No bio set'}
                          roles={currentUser?.roles as any}
                          avatarUrl={currentUser?.avatar_url || undefined}
                          backgroundUrl={bannerPreview || currentUser?.banner_url || undefined}
                          status={userStatus === 'online' ? 'active' : userStatus === 'offline' ? 'offline' : userStatus as 'idle' | 'dnd'}
                          originServer={currentUser?.origin_server}
                          showOnlineIndicator={true}
                          isCompact={false}
                        />
                      </div>
                    </div>

                    {/* Edit Controls - Right Side */}
                    <div className="lg:col-span-2 p-6 space-y-6">
                      {/* Username */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                          Username
                        </label>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Enter username"
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all duration-200"
                        />
                      </div>

                      {/* About/Bio */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                          About
                        </label>
                        <textarea
                          rows={4}
                          value={bioInputValue}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            setBioInputValue(newValue);
                            setHasBioChanged(newValue !== userBio);
                          }}
                          placeholder="Tell others about yourself..."
                          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] resize-none transition-all duration-200"
                          maxLength={500}
                        />
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          You can @mention other users and use markdown. {bioInputValue.length}/500
                        </p>
                      </div>

                      {/* Avatar */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                          Avatar
                        </label>
                        <FileUploadInput
                          label="Upload Avatar"
                          accept="image/*"
                          maxSize={5 * 1024 * 1024}
                          onFileSelected={(file) => { if (file) handleAvatarFileSubmit(file); }}
                          onUrlChange={(url) => handleAvatarUrlSubmit(url)}
                          currentFile={currentUser?.avatar_url || undefined}
                          placeholder="Enter image URL or upload file"
                        />
                      </div>

                      {/* Banner */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                          Banner
                        </label>
                        <FileUploadInput
                          label="Upload Banner"
                          accept="image/*"
                          maxSize={10 * 1024 * 1024}
                          onFileSelected={(file) => { if (file) handleBannerFileSubmit(file); }}
                          onUrlChange={(url) => handleBannerUrlSubmit(url)}
                          currentFile={(currentUser as any)?.banner_url}
                          placeholder="Enter image URL or upload file"
                        />
                      </div>

                      {/* Account Status */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                          Account Status
                        </label>
                          <select
                            value={userStatus}
                            onChange={(e) => setUserStatus(e.target.value as 'online' | 'offline' | 'idle' | 'dnd')}
                            className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all duration-200"
                        >
                          <option value="online">Online</option>
                          <option value="idle">Idle</option>
                          <option value="dnd">Do Not Disturb</option>
                          <option value="offline">Invisible</option>
                        </select>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--color-border)]">
                        <button
                          onClick={() => {
                            setNewUsername('');
                            setBioInputValue(userBio);
                            setUserStatus('online');
                            setHasBioChanged(false);
                            setBannerFile(null);
                            setBannerPreview(null);
                          }}
                          className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Reset Changes
                        </button>
                        <button
                          onClick={async () => {
                            // Handle username update
                            if (newUsername.trim() && !updateUsernameMutation.isPending) {
                              await handleUsernameSubmit({ preventDefault: () => {} } as React.FormEvent);
                            }

                            // Handle banner update if there are changes
                            if ((bannerFile || bannerPreview) && bannerPreview !== currentUser?.banner_url) {
                              try {
                                if (bannerFile) {
                                  // For file uploads, use the File object
                                  await updateBannerMutation.mutateAsync(bannerFile);
                                } else if (bannerPreview && !bannerPreview.startsWith('blob:')) {
                                  // For URL inputs, use the URL string
                                  await updateBannerMutation.mutateAsync(bannerPreview);
                                }
                                setMessage({ type: 'success', text: 'Banner updated successfully!' });
                                setBannerPreview(null); // Clear preview since it's now saved
                                setBannerFile(null); // Clear the stored file
                              } catch (error) {
                                setMessage({ type: 'error', text: 'Failed to update banner' });
                              }
                            }

                            // Handle bio change
                            if (hasBioChanged && !updateBioMutation.isPending) {
                              await handleBioChange();
                            }
                          }}
                          disabled={
                            updateUsernameMutation.isPending ||
                            updateBannerMutation.isPending ||
                            updateBioMutation.isPending ||
                            (!newUsername.trim() && !bannerPreview && !hasBioChanged)
                          }
                          className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                        >
                          {(updateUsernameMutation.isPending || updateBannerMutation.isPending || updateBioMutation.isPending) ? 'Updating...' : 'Update Profile'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                {/* Preset Themes Section */}
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                  <div className="p-6 border-b border-[var(--color-border)]">
                    <h3 className="text-lg font-medium text-[var(--color-text)]">Preset Themes</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">Choose from built-in themes or create your own</p>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(themePresets).map(([presetName, presetConfig]) => (
                        <button
                          key={presetName}
                          onClick={() => resetToPreset(presetName)}
                          className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                            appearanceConfig.name === presetName
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                              : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-8 h-8 rounded-full border-2 border-white/20 flex-shrink-0"
                              style={{ backgroundColor: presetConfig.colors.primary }}
                            ></div>
                            <div className="text-left">
                              <div className="font-medium text-[var(--color-text)]">{presetName}</div>
                              <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                                Nord-inspired {presetName.toLowerCase().includes('dark') ? 'dark' : 'light'} theme
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-[var(--color-text)]">Current Theme</h4>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                            {appearanceConfig.name || 'Custom Theme'}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              const configJson = exportConfig();
                              navigator.clipboard.writeText(configJson).then(() => {
                                setMessage({ type: 'success', text: 'Theme configuration copied to clipboard!' });
                              }).catch(() => {
                                setMessage({ type: 'error', text: 'Failed to copy to clipboard. Try exporting manually.' });
                              });
                            }}
                            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded-lg transition-colors"
                          >
                            Export Theme
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Color Customization */}
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                  <div className="p-6 border-b border-[var(--color-border)]">
                    <h3 className="text-lg font-medium text-[var(--color-text)]">Customize Colors</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">Fine-tune every aspect of your theme</p>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Background Colors */}
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Background Layer</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {([
                          { key: 'background', label: 'Main Background' },
                          { key: 'background-secondary', label: 'Secondary Background' },
                          { key: 'background-tertiary', label: 'Tertiary Background' }
                        ] as const).map(({ key, label }) => (
                          <div key={key} className="space-y-2">
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                              {label}
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                              />
                              <input
                                type="text"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Surface Colors */}
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Surface Layer</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {([
                          { key: 'surface', label: 'Primary Surface' },
                          { key: 'surface-secondary', label: 'Secondary Surface' },
                          { key: 'surface-tertiary', label: 'Tertiary Surface' }
                        ] as const).map(({ key, label }) => (
                          <div key={key} className="space-y-2">
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                              {label}
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                              />
                              <input
                                type="text"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Text Colors */}
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Text Colors</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {([
                          { key: 'text', label: 'Primary Text' },
                          { key: 'text-secondary', label: 'Secondary Text' },
                          { key: 'text-tertiary', label: 'Tertiary Text' },
                          { key: 'text-muted', label: 'Muted Text' }
                        ] as const).map(({ key, label }) => (
                          <div key={key} className="space-y-2">
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                              {label}
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                              />
                              <input
                                type="text"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Brand Colors */}
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Brand Colors</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {([
                          { key: 'primary', label: 'Primary' },
                          { key: 'primary-hover', label: 'Primary Hover' },
                          { key: 'secondary', label: 'Secondary' },
                          { key: 'secondary-hover', label: 'Secondary Hover' }
                        ] as const).map(({ key, label }) => (
                          <div key={key} className="space-y-2">
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                              {label}
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                              />
                              <input
                                type="text"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Accent & Status Colors */}
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Accent & Status</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {([
                          { key: 'accent', label: 'Accent' },
                          { key: 'accent-hover', label: 'Accent Hover' },
                          { key: 'success', label: 'Success' },
                          { key: 'warning', label: 'Warning' }
                        ] as const).map(({ key, label }) => (
                          <div key={key} className="space-y-2">
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                              {label}
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                              />
                              <input
                                type="text"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        {([
                          { key: 'error', label: 'Error' },
                          { key: 'info', label: 'Info' },
                          { key: 'border', label: 'Border' },
                          { key: 'border-secondary', label: 'Border Secondary' }
                        ] as const).map(({ key, label }) => (
                          <div key={key} className="space-y-2">
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                              {label}
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                              />
                              <input
                                type="text"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Interactive Elements */}
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Interactive Elements</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {([
                          { key: 'hover', label: 'Hover' },
                          { key: 'active', label: 'Active' },
                          { key: 'focus', label: 'Focus' },
                          { key: 'shadow', label: 'Shadow' }
                        ] as const).map(({ key, label }) => (
                          <div key={key} className="space-y-2">
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                              {label}
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                              />
                              <input
                                type="text"
                                value={appearanceConfig.colors[key]}
                                onChange={(e) => setAppearanceConfig({
                                  ...appearanceConfig,
                                  colors: { ...appearanceConfig.colors, [key]: e.target.value }
                                })}
                                className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fonts Customization */}
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                  <div className="p-6 border-b border-[var(--color-border)]">
                    <h3 className="text-lg font-medium text-[var(--color-text)]">Typography</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">Customize fonts for your theme</p>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        Sans Serif Font Family
                      </label>
                      <textarea
                        value={appearanceConfig.fonts.sans}
                        onChange={(e) => setAppearanceConfig({
                          ...appearanceConfig,
                          fonts: { ...appearanceConfig.fonts, sans: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] text-sm font-mono"
                        rows={2}
                        placeholder="font-family stack for sans-serif fonts"
                      />
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Include fallback fonts: e.g., "Custom Sans, Inter, Helvetica, Arial, sans-serif"
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        Monospace Font Family
                      </label>
                      <textarea
                        value={appearanceConfig.fonts.mono}
                        onChange={(e) => setAppearanceConfig({
                          ...appearanceConfig,
                          fonts: { ...appearanceConfig.fonts, mono: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] text-sm font-mono"
                        rows={2}
                        placeholder="font-family stack for monospace fonts"
                      />
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Include fallback fonts: e.g., "JetBrains Mono, Fira Code, Consolas, monospace"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Layout & Display Options */}
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                  <div className="p-6 border-b border-[var(--color-border)]">
                    <h3 className="text-lg font-medium text-[var(--color-text)]">Layout & Display</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">Customize the visual layout and sizing</p>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* View Mode */}
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">View Mode</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <button
                            onClick={() => setAppearanceConfig({
                              ...appearanceConfig,
                              layout: { ...appearanceConfig.layout, viewMode: 'default' }
                            })}
                            className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                              appearanceConfig.layout.viewMode === 'default'
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                            }`}
                          >
                            <div className="font-medium text-[var(--color-text)] text-left">Default</div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Standard Discord-like layout with full timestamps</div>
                          </button>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => setAppearanceConfig({
                              ...appearanceConfig,
                              layout: { ...appearanceConfig.layout, viewMode: 'compact' }
                            })}
                            className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                              appearanceConfig.layout.viewMode === 'compact'
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                            }`}
                          >
                            <div className="font-medium text-[var(--color-text)] text-left">Compact</div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Minimal layout with reduced spacing</div>
                          </button>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => setAppearanceConfig({
                              ...appearanceConfig,
                              layout: { ...appearanceConfig.layout, viewMode: 'cozy' }
                            })}
                            className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                              appearanceConfig.layout.viewMode === 'cozy'
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                            }`}
                          >
                            <div className="font-medium text-[var(--color-text)] text-left">Cozy</div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Comfortable layout with generous spacing</div>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Message Size */}
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Message Size</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <button
                            onClick={() => setAppearanceConfig({
                              ...appearanceConfig,
                              layout: { ...appearanceConfig.layout, messageSize: 'small' }
                            })}
                            className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                              appearanceConfig.layout.messageSize === 'small'
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                            }`}
                          >
                            <div className="font-medium text-[var(--color-text)] text-left">Small</div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Compact messages</div>
                          </button>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => setAppearanceConfig({
                              ...appearanceConfig,
                              layout: { ...appearanceConfig.layout, messageSize: 'medium' }
                            })}
                            className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                              appearanceConfig.layout.messageSize === 'medium'
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                            }`}
                          >
                            <div className="font-medium text-[var(--color-text)] text-left">Medium</div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Balanced size</div>
                          </button>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => setAppearanceConfig({
                              ...appearanceConfig,
                              layout: { ...appearanceConfig.layout, messageSize: 'large' }
                            })}
                            className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                              appearanceConfig.layout.messageSize === 'large'
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                            }`}
                          >
                            <div className="font-medium text-[var(--color-text)] text-left">Large</div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Larger messages</div>
                          </button>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => setAppearanceConfig({
                              ...appearanceConfig,
                              layout: { ...appearanceConfig.layout, messageSize: 'extra-large' }
                            })}
                            className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                              appearanceConfig.layout.messageSize === 'extra-large'
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                            }`}
                          >
                            <div className="font-medium text-[var(--color-text)] text-left">Extra Large</div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Very large messages</div>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Message Spacing */}
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Message Spacing</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <button
                            onClick={() => setAppearanceConfig({
                              ...appearanceConfig,
                              layout: { ...appearanceConfig.layout, messageSpacing: 'tight' }
                            })}
                            className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                              appearanceConfig.layout.messageSpacing === 'tight'
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                            }`}
                          >
                            <div className="font-medium text-[var(--color-text)] text-left">Tight</div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Minimal spacing between messages</div>
                          </button>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => setAppearanceConfig({
                              ...appearanceConfig,
                              layout: { ...appearanceConfig.layout, messageSpacing: 'normal' }
                            })}
                            className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                              appearanceConfig.layout.messageSpacing === 'normal'
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                            }`}
                          >
                            <div className="font-medium text-[var(--color-text)] text-left">Normal</div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Standard spacing</div>
                          </button>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => setAppearanceConfig({
                              ...appearanceConfig,
                              layout: { ...appearanceConfig.layout, messageSpacing: 'loose' }
                            })}
                            className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                              appearanceConfig.layout.messageSpacing === 'loose'
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                            }`}
                          >
                            <div className="font-medium text-[var(--color-text)] text-left">Loose</div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Extra spacing for better readability</div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Import/Export Section */}
                <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                  <div className="p-6 border-b border-[var(--color-border)]">
                    <h3 className="text-lg font-medium text-[var(--color-text)]">Import/Export</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">Share your themes with others</p>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        Import Theme JSON
                      </label>
                      <textarea
                        id="importThemeJson"
                        placeholder='Paste theme JSON here...'
                        className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] text-sm font-mono h-32"
                      />
                      <div className="mt-3 flex space-x-2">
                        <button
                          onClick={() => {
                            const textarea = document.getElementById('importThemeJson') as HTMLTextAreaElement;
                            const jsonString = textarea.value.trim();
                            if (jsonString) {
                              if (importConfig(jsonString)) {
                                setMessage({ type: 'success', text: 'Theme imported successfully!' });
                                textarea.value = '';
                              } else {
                                setMessage({ type: 'error', text: 'Invalid theme configuration. Please check the JSON format.' });
                              }
                            }
                          }}
                          className="px-4 py-2 bg-[var(--color-success)] hover:bg-green-600 text-white text-sm rounded transition-colors"
                        >
                          Import & Apply
                        </button>
                        <button
                          onClick={() => {
                            const textarea = document.getElementById('importThemeJson') as HTMLTextAreaElement;
                            textarea.value = '';
                          }}
                          className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-sm rounded transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--color-border)]">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Tip: Theme files use the .pufferblow-theme extension. Export your current theme and share it with other users!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => resetToPreset('Nord Dark')}
                    className="px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm rounded transition-colors"
                  >
                    Reset to Default
                  </button>
                  <button
                    onClick={() => {
                      const configName = prompt('Enter a name for your custom theme:');
                      if (configName?.trim()) {
                        setAppearanceConfig({
                          ...appearanceConfig,
                          name: configName.trim()
                        });
                        setMessage({ type: 'success', text: `Theme named "${configName.trim()}" and saved!` });
                      }
                    }}
                    className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded transition-colors"
                  >
                    Save Custom Theme
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-6 max-w-6xl mx-auto">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-xl border border-[var(--color-border)] p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <div className={`text-sm font-medium ${selectedInputDevice ? 'text-green-400' : 'text-yellow-400'}`}>
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
                            onClick={async () => {
                              try {
                                const devices = await navigator.mediaDevices.enumerateDevices();
                                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                                setInputDevices(audioInputs);
                                setMessage({ type: 'success', text: `Found ${audioInputs.length} audio input devices` });
                              } catch (error) {
                                setMessage({ type: 'error', text: 'Failed to enumerate audio devices' });
                              }
                            }}
                            className="w-full px-4 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center space-x-2"
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
                        <div>
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
                              inputLevel > 0.3 ? 'bg-red-500' :
                              inputLevel > 0.1 ? 'bg-yellow-500' :
                              'bg-green-500'
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
                        onClick={async () => {
                          if (isListening) {
                            setIsListening(false);
                            if (webAudioContext) {
                              webAudioContext.close();
                              setWebAudioContext(null);
                              setAudioAnalyser(null);
                            }
                            setFrequencyData(new Uint8Array(32));
                          } else {
                            try {
                              const context = new AudioContext();
                              setWebAudioContext(context);

                              const analyser = context.createAnalyser();
                              analyser.fftSize = 64;
                              setAudioAnalyser(analyser);

                              const stream = await navigator.mediaDevices.getUserMedia({
                                audio: {
                                  echoCancellation: echoCancellation,
                                  noiseSuppression: noiseSuppression,
                                  autoGainControl: autoGainControl
                                }
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

                              setMessage({ type: 'success', text: 'Listening to microphone... Check the audio levels above.' });
                            } catch (error) {
                              setMessage({ type: 'error', text: 'Failed to start microphone monitoring' });
                            }
                          }
                        }}
                        className={`py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                          isListening
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white'
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
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
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
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
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
                        <span className={`text-sm font-medium ${selectedInputDevice ? 'text-green-400' : 'text-yellow-400'}`}>
                          {selectedInputDevice ? 'Connected' : 'Default'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--color-text-secondary)]">Output Device</span>
                        <span className={`text-sm font-medium ${selectedOutputDevice ? 'text-green-400' : 'text-yellow-400'}`}>
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
                        <span className={`text-sm font-medium ${noiseSuppression ? 'text-green-400' : 'text-gray-400'}`}>
                          {noiseSuppression ? 'On' : 'Off'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--color-text-secondary)]">Echo Cancellation</span>
                        <span className={`text-sm font-medium ${echoCancellation ? 'text-green-400' : 'text-gray-400'}`}>
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
            )}

            {activeTab === 'server' && (
              <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
                <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">Server Settings</h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text)]">Server Host:Port</h4>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)] mb-4">Set the server host and port for API requests</p>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="currentHostPort" className="block text-sm font-medium text-[var(--color-text-secondary)]">Current Server</label>
                        <input type="text" name="currentHostPort" id="currentHostPort" value={hostPort} className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm" readOnly />
                      </div>
                      <div>
                        <label htmlFor="newHostPort" className="block text-sm font-medium text-[var(--color-text-secondary)]">New Server Host:Port</label>
                        <input type="text" name="newHostPort" id="newHostPort" placeholder="127.0.0.1:7575" value={newHostPort} onChange={e => setNewHostPort(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm" />
                      </div>
                      <button type="button" onClick={handleHostPortSubmit} disabled={!newHostPort.trim()} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed">
                        Update Server
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
                  <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">Security Settings</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)]">Change Password</h4>
                      <div className="mt-2 space-y-4">
                        <div>
                          <label htmlFor="currentPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">Current password</label>
                          <input type="password" name="currentPassword" id="currentPassword" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm" />
                        </div>
                        <div>
                          <label htmlFor="newPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">New password</label>
                          <input type="password" name="newPassword" id="newPassword" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm" />
                        </div>
                        <div>
                          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">Confirm password</label>
                          <input type="password" name="confirmPassword" id="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm" />
                        </div>
                        <button type="button" onClick={handlePasswordSubmit} disabled={updatePasswordMutation.isPending} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50">
                          {updatePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-[var(--color-border)] pt-6">
                      <h4 className="text-sm font-medium text-[var(--color-text)]">Authentication Token</h4>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Resetting your authentication token will log you out</p>
                      <div className="mt-3">
                        <button type="button" onClick={() => setShowResetModal(true)} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-error)] hover:bg-[var(--color-error)]/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-error)]">
                          Reset Auth Token
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-[var(--color-border)] pt-6">
                      <h4 className="text-sm font-medium text-[var(--color-text)]">Sign Out</h4>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Sign out of your account</p>
                      <div className="mt-3">
                        <button type="button" onClick={() => {
                          logout();
                          setTimeout(() => window.location.href = '/login', 100);
                        }} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-error)] hover:bg-[var(--color-error)]/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-error)]">
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reset Auth Token Modal */}
        {showResetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--color-surface)] rounded-lg p-6 max-w-md w-full mx-4 border border-[var(--color-border)]">
              <h3 className="text-lg font-medium text-[var(--color-text)] mb-4">Reset Authentication Token</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Resetting your authentication token will log you out of all devices. You will need to log in again.
                This action cannot be undone.
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="resetPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">Enter your current password</label>
                  <input type="password" name="resetPassword" id="resetPassword" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm" />
                </div>
                <div className="flex justify-end space-x-2">
                  <button type="button" onClick={() => {
                    setShowResetModal(false);
                    setResetPassword('');
                  }} className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Cancel
                  </button>
                  <button type="button" onClick={handleResetAuthToken} disabled={!resetPassword.trim() || resetAuthTokenMutation.isPending} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-error)] hover:bg-[var(--color-error)]/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-error)] disabled:opacity-50">
                    {resetAuthTokenMutation.isPending ? 'Resetting...' : 'Reset Token'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Preview Modal */}
        {isProfileModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-background)] rounded-2xl shadow-2xl w-full max-w-lg mx-auto border border-[var(--color-border)]">
              <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[var(--color-text)]">Profile Preview</h3>
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] p-2 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <div className="flex justify-center">
                  <UserCard
                    username={newUsername || currentUser?.username || 'Username'}
                    bio={bioInputValue || 'No bio set'}
                    roles={currentUser?.roles as any}
                    avatarUrl={currentUser?.avatar_url || undefined}
                    backgroundUrl={bannerPreview || currentUser?.banner_url || undefined}
                    status={userStatus === 'online' ? 'active' : userStatus === 'offline' ? 'offline' : userStatus as 'idle' | 'dnd'}
                    originServer={currentUser?.origin_server}
                    showOnlineIndicator={true}
                    isCompact={false}
                  />
                </div>
                <div className="mt-6 text-center">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    This is how your profile will appear to others on Pufferblow
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image Cropping Modal */}
        {isCroppingModalOpen && croppingImageSrc && croppingImageType && (
          <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-background)] rounded-2xl shadow-2xl w-full max-w-xl mx-auto border border-[var(--color-border)]">
              <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[var(--color-text)]">
                  Crop {croppingImageType === 'avatar' ? 'Avatar' : 'Banner'}
                </h3>
                <button
                  onClick={handleCroppingCancel}
                  disabled={updateAvatarMutation.isPending || updateBannerMutation.isPending}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] p-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <CroppableImage
                  imageSrc={croppingImageSrc}
                  aspect={croppingImageType === 'avatar' ? 1 : 4} // Square for avatar, wide for banner
                  shape={croppingImageType === 'avatar' ? 'round' : 'rect'}
                  onCropComplete={handleCroppedImage}
                  onCancel={handleCroppingCancel}
                  className="max-w-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
