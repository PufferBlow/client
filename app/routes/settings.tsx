import type { Route } from "./+types/settings";
import { Link } from "react-router";
import { useTheme } from "../components/ThemeProvider";
import { useState, useEffect } from "react";
import { FileUploadInput } from "../components/FileUploadInput";
import { getHostPortFromStorage, setHostPortToStorage, useCurrentUserProfile, useUpdateUsername, useUpdateStatus, useUpdateAvatar, useUpdateBanner, useUpdatePassword, useResetAuthToken, useLogout } from "../services/user";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Settings - Pufferblow" },
    { name: "description", content: "Manage your Pufferblow account settings" },
  ];
}

export default function Settings() {
  // React Query hooks
  const { data: currentUser, isLoading: userLoading } = useCurrentUserProfile();
  const updateUsernameMutation = useUpdateUsername();
  const updateStatusMutation = useUpdateStatus();
  const updateAvatarMutation = useUpdateAvatar();
  const updateBannerMutation = useUpdateBanner();
  const updatePasswordMutation = useUpdatePassword();
  const resetAuthTokenMutation = useResetAuthToken();
  const { logout } = useLogout();
  const { setTheme } = useTheme();

  // Get current theme from localStorage without hook calls in conditional
  const getCurrentTheme = () => {
    if (typeof window === 'undefined') return 'dark'; // SSR fallback
    const savedTheme = localStorage.getItem('pufferblow-theme');
    if (!savedTheme || savedTheme === 'system') {
      return 'system';
    }
    return savedTheme;
  };
  const currentTheme = getCurrentTheme();

  // Show skeleton loading state
  if (userLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] animate-pulse">
        {/* Main Content */}
        <main className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Back Button Skeleton */}
          <div className="mb-6">
            <Link to="/dashboard" className="inline-flex items-center">
              <div className="w-5 h-5 bg-gray-600 rounded mr-2"></div>
              <div className="w-16 h-4 bg-gray-600 rounded"></div>
            </Link>
          </div>

          {/* Settings Banner Skeleton */}
          <div className="bg-[var(--color-surface)] shadow rounded-md p-6 mb-6">
            <div className="w-48 h-6 bg-gray-600 rounded mb-2"></div>
            <div className="w-72 h-4 bg-gray-700 rounded"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Skeleton */}
            <div className="lg:col-span-1">
              <nav className="space-y-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border-l-4 border-gray-600 px-3 py-2 flex items-center">
                    <div className="w-6 h-6 bg-gray-600 rounded mr-3"></div>
                    <div className="flex-1 h-4 bg-gray-600 rounded"></div>
                  </div>
                ))}
              </nav>
            </div>

            {/* Main Content Skeleton */}
            <div className="lg:col-span-3 space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[var(--color-surface)] shadow rounded-lg">
                  <div className="px-6 py-5 border-b border-gray-700">
                    <div className="w-48 h-6 bg-gray-600 rounded mb-2"></div>
                    <div className="w-64 h-4 bg-gray-700 rounded"></div>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <div className="space-y-2">
                      <div className="w-24 h-4 bg-gray-600 rounded"></div>
                      <div className="w-full h-10 bg-gray-700 rounded"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="w-20 h-4 bg-gray-600 rounded"></div>
                      <div className="w-full h-10 bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Local state
  const [activeSection, setActiveSection] = useState('profile');
  const [userStatus, setUserStatus] = useState<'online' | 'idle' | 'dnd'>('online');
  const [userBio, setUserBio] = useState('Building the future of decentralized messaging');
  const [bioInputValue, setBioInputValue] = useState('Building the future of decentralized messaging');
  const [hasBioChanged, setHasBioChanged] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<'online' | 'offline' | 'idle' | 'dnd'>('online');
  const [isDndModeEnabled, setIsDndModeEnabled] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [newHostPort, setNewHostPort] = useState('');

  // Audio settings state
  const [micVolume, setMicVolume] = useState(80);
  const [speakerVolume, setSpeakerVolume] = useState(80);
  const [isTestingMicrophone, setIsTestingMicrophone] = useState(false);
  const [isTestingSpeakers, setIsTestingSpeakers] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);

  const hostPort = getHostPortFromStorage() || 'localhost:7575';

  // Set current user status when user data loads
  useEffect(() => {
    if (currentUser) {
      // Map API status to UI status (offline/inactive states are no longer user-selectable)
      const statusMap = {
        'online': 'online' as const,
        'offline': 'online' as const, // Map offline to online since offline is not user-selectable
        'idle': 'idle' as const,
        'inactive': 'online' as const, // Map inactive to online
        'dnd': 'dnd' as const,
      };
      setUserStatus(statusMap[currentUser.status as keyof typeof statusMap] || 'online');
      setUserBio('Building the future of decentralized messaging');
      setBioInputValue('Building the future of decentralized messaging');
    }
  }, [currentUser]);

  // Load default status preference and DND mode
  useEffect(() => {
    const savedDefaultStatus = typeof window !== 'undefined' ?
      localStorage.getItem('pufferblow-default-status') as 'online' | 'offline' | 'idle' | 'dnd' || 'online'
      : 'online';
    setDefaultStatus(savedDefaultStatus);
    setIsDndModeEnabled(savedDefaultStatus === 'dnd');
  }, []);

  // Set initial active section based on URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['profile', 'appearance', 'audio', 'server', 'security'].includes(hash)) {
      setActiveSection(hash);
    }
  }, []);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Handle automatic offline status when tab/browser is not visible
  useEffect(() => {
    let previousStatus: 'online' | 'idle' | 'dnd' = userStatus;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Tab/window is hidden - set status to offline
        previousStatus = userStatus;
        if (updateStatusMutation.isIdle) {
          await updateStatusMutation.mutateAsync('offline');
        }
      } else {
        // Tab/window is visible again - restore previous status
        if (updateStatusMutation.isIdle) {
          await updateStatusMutation.mutateAsync(previousStatus);
        }
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userStatus, updateStatusMutation]);

  const changeSection = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || updateUsernameMutation.isPending) return;

    updateUsernameMutation.mutate(newUsername);
    setMessage({ type: 'success', text: 'Username updated successfully!' });
    setNewUsername('');
  };

  const handleStatusSubmit = async () => {
    if (updateStatusMutation.isPending) return;

    try {
      await updateStatusMutation.mutateAsync(userStatus);
      setMessage({ type: 'success', text: 'Status updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const handlePasswordSubmit = async () => {
    if (!currentPassword || !newPassword || newPassword !== confirmPassword || updatePasswordMutation.isPending) return;

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
    // Redirect after successful reset
    setTimeout(() => window.location.reload(), 2000);
  };

  const handleBioChange = (newBio: string) => {
    setUserBio(newBio);
    setBioInputValue(newBio);
    // TODO: Implement bio update API
    console.log('Bio changed to:', newBio);
  };

  const handleAvatarFileSubmit = async (file: File) => {
    if (!file || updateAvatarMutation.isPending) return;

    try {
      await updateAvatarMutation.mutateAsync(file);
      setMessage({ type: 'success', text: 'Avatar updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update avatar' });
    }
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
    if (!file || updateBannerMutation.isPending) return;

    try {
      await updateBannerMutation.mutateAsync(file);
      setMessage({ type: 'success', text: 'Banner updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update banner' });
    }
  };

  const handleBannerUrlSubmit = async (url: string) => {
    if (!url.trim() || updateBannerMutation.isPending) return;

    try {
      await updateBannerMutation.mutateAsync(url);
      setMessage({ type: 'success', text: 'Banner updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update banner' });
    }
  };

  const handleHostPortSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostPort.trim()) return;

    // Validate host:port format
    const hostPortRegex = /^([a-zA-Z0-9.-]+|\[[a-fA-F0-9:]+\]):(\d+)$/;
    if (!hostPortRegex.test(newHostPort)) {
      setMessage({ type: 'error', text: 'Invalid host:port format. Please use format like \'127.0.0.1:7575\' or \'localhost:7575\'' });
      return;
    }

    // Additional validation
    try {
      const testUrl = new URL(`http://${newHostPort}`);
      if (!testUrl.hostname || !testUrl.port) {
        throw new Error('Invalid host or port');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Invalid host:port format. Please ensure the host and port are valid.' });
      return;
    }

    // Save to localStorage
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

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      setMicrophoneStream(stream);

      // Create AudioContext for monitoring
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(context);

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;

      source.connect(analyser);

      // You could add visual feedback here by analyzing the frequency data
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / dataArray.length;

        // Visual feedback could be based on average volume
        if (isTestingMicrophone) {
          requestAnimationFrame(checkAudio);
        }
      };

      checkAudio();

      setMessage({ type: 'success', text: 'Microphone test started. Check your audio levels.' });

    } catch (error) {
      console.error('Microphone test failed:', error);
      setIsTestingMicrophone(false);

      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            setMessage({ type: 'error', text: 'Microphone access denied. Please allow microphone access in your browser settings.' });
            break;
          case 'NotFoundError':
            setMessage({ type: 'error', text: 'No microphone found. Please check your microphone connection.' });
            break;
          case 'NotReadableError':
            setMessage({ type: 'error', text: 'Microphone is already in use by another application.' });
            break;
          default:
            setMessage({ type: 'error', text: 'Microphone test failed. Please try again.' });
        }
      } else {
        setMessage({ type: 'error', text: 'Microphone test failed. Please try again.' });
      }
    }
  };

  const stopMicrophoneTest = () => {
    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => track.stop());
      setMicrophoneStream(null);
    }

    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
      setAudioContext(null);
    }

    setIsTestingMicrophone(false);
    setMessage({ type: 'success', text: 'Microphone test stopped.' });
  };

  const startSpeakerTest = async () => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(context);

      // Create an oscillator for test tone
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      // Configure test tone (1kHz sine wave)
      oscillator.frequency.setValueAtTime(1000, context.currentTime);
      oscillator.type = 'sine';

      // Set volume based on speaker slider
      gainNode.gain.setValueAtTime(speakerVolume / 100 * 0.1, context.currentTime);

      setGainNode(gainNode);
      oscillator.start();

      // Play for 3 seconds then stop automatically
      setTimeout(() => {
        oscillator.stop();
        if (context.state !== 'closed') {
          context.close();
          setAudioContext(null);
          setGainNode(null);
        }
        setIsTestingSpeakers(false);
        setMessage({ type: 'success', text: 'Speaker test completed.' });
      }, 3000);

      setMessage({ type: 'success', text: 'Playing test tone for 3 seconds...' });

    } catch (error) {
      console.error('Speaker test failed:', error);
      setIsTestingSpeakers(false);
      setMessage({ type: 'error', text: 'Speaker test failed. Please check your audio output settings.' });
    }
  };

  const stopSpeakerTest = () => {
    if (gainNode) {
      gainNode.gain.exponentialRampToValueAtTime(0.01, gainNode.context.currentTime + 0.1);
      setGainNode(null);
    }

    if (audioContext && audioContext.state === 'running') {
      setTimeout(() => {
        if (audioContext && audioContext.state !== 'closed') {
          audioContext.close();
          setAudioContext(null);
        }
      }, 100);
    }

    setIsTestingSpeakers(false);
    setMessage({ type: 'success', text: 'Speaker test stopped.' });
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Main Content */}
      <main className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
        <div className="px-4 py-6 sm:px-0">
          {/* Settings Navigation */}
          <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-md mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-2xl font-bold text-[var(--color-text)]">
                Account Settings
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Manage your account preferences and security settings.
              </p>
            </div>
          </div>

          {/* Error/Success Messages */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg border relative ${message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">{message.text}</div>
                <button
                  onClick={() => setMessage(null)}
                  className={`ml-4 p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}
                  aria-label="Close message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Settings Sidebar */}
            <div className="lg:col-span-1">
              <nav className="space-y-1">
                <button
                  onClick={() => changeSection('profile')}
                  className={`w-full text-left border-l-4 px-3 py-2 flex items-center text-sm font-medium transition-colors ${
                    activeSection === 'profile'
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <svg className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    activeSection === 'profile' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
                <button
                  onClick={() => changeSection('appearance')}
                  className={`w-full text-left border-l-4 px-3 py-2 flex items-center text-sm font-medium transition-colors ${
                    activeSection === 'appearance'
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <svg className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    activeSection === 'appearance' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                  </svg>
                  Appearance
                </button>
                <button
                  onClick={() => changeSection('audio')}
                  className={`w-full text-left border-l-4 px-3 py-2 flex items-center text-sm font-medium transition-colors ${
                    activeSection === 'audio'
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <svg className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    activeSection === 'audio' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19V12a9 9 0 0118 0v7M8.25 15H7.5a1.5 1.5 0 00-1.5 1.5v1.5A1.5 1.5 0 007.5 19h.75m0 0V15m0 0V12a4.5 4.5 0 011 2.25m0 0V15M21 15H16.5a1.5 1.5 0 00-1.5 1.5v1.5a1.5 1.5 0 001.5 1.5H21" />
                  </svg>
                  Audio
                </button>
                <button
                  onClick={() => changeSection('server')}
                  className={`w-full text-left border-l-4 px-3 py-2 flex items-center text-sm font-medium transition-colors ${
                    activeSection === 'server'
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <svg className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    activeSection === 'server' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                  Server
                </button>
                <button
                  onClick={() => changeSection('security')}
                  className={`w-full text-left border-l-4 px-3 py-2 flex items-center text-sm font-medium transition-colors ${
                    activeSection === 'security'
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <svg className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    activeSection === 'security' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Security
                </button>
              </nav>
            </div>

            {/* Settings Content */}
            <div className="lg:col-span-3">
              {/* Account Settings */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  {/* Change Username */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Change Username
                      </h3>
                      <form onSubmit={handleUsernameSubmit} className="space-y-4">
                        <div>
                          <label htmlFor="currentUsername" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                            Current Username
                          </label>
                          <input
                            type="text"
                            name="currentUsername"
                            id="currentUsername"
                            value={currentUser?.username || ''}
                            className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                            readOnly
                          />
                        </div>
                        <div>
                          <label htmlFor="newUsername" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                            New Username
                          </label>
                          <input
                            type="text"
                            name="newUsername"
                            id="newUsername"
                            placeholder="New username"
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={updateUsernameMutation.isPending}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                          >
                            {updateUsernameMutation.isPending ? 'Updating...' : 'Change Username'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>



                  {/* Account Status */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Account Status
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="accountStatus" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            Current Status
                          </label>
                          <div className="relative">
                            <select
                              id="accountStatus"
                              name="accountStatus"
                              value={userStatus}
                              onChange={e => setUserStatus(e.target.value as 'online' | 'idle' | 'dnd')}
                              className="mt-1 block w-full px-4 py-3 pr-10 border border-[var(--color-border)] rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-200 sm:text-sm appearance-none cursor-pointer hover:border-[var(--color-primary)]/50 hover:shadow-md focus:shadow-lg"
                            >
                              <option value="online">Online</option>
                              <option value="idle">Idle</option>
                              <option value="dnd">Do Not Disturb</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                              <svg className="w-5 h-5 text-[var(--color-text-secondary)] transition-transform duration-200 group-hover:text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleStatusSubmit}
                            disabled={updateStatusMutation.isPending}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                          >
                            {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Privacy Settings */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Privacy
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="max-w-lg">
                            <label htmlFor="dndMode" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              Do Not Disturb Mode
                            </label>
                            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                              Automatically set your status to Do Not Disturb when you log in to prevent notifications and unwanted contacts.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newDndMode = !isDndModeEnabled;
                              setIsDndModeEnabled(newDndMode);
                              setDefaultStatus(newDndMode ? 'dnd' : 'online');
                              if (typeof window !== 'undefined') {
                                localStorage.setItem('pufferblow-dnd-mode', newDndMode.toString());
                                localStorage.setItem('pufferblow-default-status', newDndMode ? 'dnd' : 'online');
                                setMessage({
                                  type: 'success',
                                  text: `Do Not Disturb mode ${newDndMode ? 'enabled' : 'disabled'}. Your default login status will now be ${newDndMode ? 'Do Not Disturb' : 'Online'}.`
                                });
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${
                              isDndModeEnabled ? 'bg-red-500' : 'bg-gray-300'
                            }`}
                            aria-pressed={isDndModeEnabled}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isDndModeEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        <div className="text-sm">
                          <p className="text-[var(--color-text-muted)]">
                            When enabled, you'll automatically be set to Do Not Disturb every time you log in, preventing annoying notifications and unwanted interactions.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Update Bio */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Update Bio
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="bio" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                            Bio
                          </label>
                          <textarea
                            id="bio"
                            name="bio"
                            rows={3}
                            value={bioInputValue}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setBioInputValue(newValue);
                              setHasBioChanged(newValue !== userBio);
                            }}
                            placeholder="Tell us about yourself..."
                            className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm resize-none"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (bioInputValue !== userBio) {
                                handleBioChange(bioInputValue);
                                setHasBioChanged(false);
                              }
                            }}
                            disabled={!hasBioChanged}
                            className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] ${
                              hasBioChanged
                                ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] animate-pulse'
                                : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] cursor-not-allowed'
                            }`}
                          >
                            Update Bio
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Change Avatar */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Change Avatar
                      </h3>
                      <FileUploadInput
                        label="Avatar"
                        accept="image/*"
                        maxSize={5 * 1024 * 1024} // 5MB
                        onFileSelected={(file) => {
                          if (file) {
                            handleAvatarFileSubmit(file);
                          }
                        }}
                        onUrlChange={(url) => {
                          handleAvatarUrlSubmit(url);
                        }}
                        currentFile={(currentUser as any)?.avatar}
                        placeholder="Enter image URL (e.g., https://example.com/avatar.jpg)"
                      />
                    </div>
                  </div>

                  {/* Change Banner */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Change Banner
                      </h3>
                      <FileUploadInput
                        label="Banner"
                        accept="image/*"
                        maxSize={5 * 1024 * 1024} // 5MB
                        onFileSelected={(file) => {
                          if (file) {
                            handleBannerFileSubmit(file);
                          }
                        }}
                        onUrlChange={(url) => {
                          handleBannerUrlSubmit(url);
                        }}
                        currentFile={undefined} // TODO: Add banner field to User model
                        placeholder="Enter banner image URL"
                      />
                    </div>
                  </div>

                </div>
              )}

              {/* Security Settings */}
              {activeSection === 'security' && (
                <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                      Security Settings
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)]">Change Password</h4>
                        <div className="mt-2 space-y-4">
                          <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              Current password
                            </label>
                            <input
                              type="password"
                              name="currentPassword"
                              id="currentPassword"
                              value={currentPassword}
                              onChange={e => setCurrentPassword(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                            />
                          </div>
                          <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              New password
                            </label>
                            <input
                              type="password"
                              name="newPassword"
                              id="newPassword"
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                            />
                          </div>
                          <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              Confirm password
                            </label>
                            <input
                              type="password"
                              name="confirmPassword"
                              id="confirmPassword"
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handlePasswordSubmit}
                            disabled={updatePasswordMutation.isPending}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                          >
                            {updatePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-[var(--color-border)] pt-6">
                        <h4 className="text-sm font-medium text-[var(--color-text)]">Two-Factor Authentication</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          Add an extra layer of security to your account.
                        </p>
                        <div className="mt-3">
                          <button
                            type="button"
                            className="inline-flex justify-center py-2 px-4 border border-[var(--color-border)] shadow-sm text-sm font-medium rounded-md text-[var(--color-text-secondary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
                          >
                            Enable 2FA
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-[var(--color-border)] pt-6">
                        <h4 className="text-sm font-medium text-[var(--color-text)]">Authentication Token</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          Resetting your authentication token will log you out of all devices. You'll need to log in again with your new token.
                        </p>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setShowResetModal(true)}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-error)] hover:bg-[var(--color-error)]/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-error)]"
                          >
                            Reset Auth Token
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-[var(--color-border)] pt-6">
                        <h4 className="text-sm font-medium text-[var(--color-text)]">Sign Out</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          Sign out of your account. You'll need to log in again to access your account.
                        </p>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              // Use React Query logout hook
                              logout();
                              // Redirect to login after clearing cache
                              setTimeout(() => window.location.href = '/login', 100);
                            }}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-error)] hover:bg-[var(--color-error)]/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-error)]"
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance Settings */}
              {activeSection === 'appearance' && (
                <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                      Appearance
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">Theme</h4>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                          Choose your preferred theme. Your choice will be saved automatically.
                        </p>
                        <div className="relative">
                          <select
                            value={currentTheme}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === 'system') {
                                if (typeof window !== 'undefined') {
                                  localStorage.removeItem('pufferblow-theme');
                                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                                  setTheme(systemTheme);
                                }
                              } else {
                                setTheme(value as 'light' | 'dark');
                              }
                            }}
                            className="block w-full px-4 py-3 pr-10 border border-[var(--color-border)] rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-200 sm:text-sm appearance-none cursor-pointer hover:border-[var(--color-primary)]/50 hover:shadow-md focus:shadow-lg"
                          >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="system">System</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                            <svg className="w-5 h-5 text-[var(--color-text-secondary)] transition-transform duration-200 group-hover:text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-xs text-[var(--color-text-muted)]">
                            Current theme: <span className="font-medium text-[var(--color-primary)] capitalize">{currentTheme}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Server Settings */}
              {activeSection === 'server' && (
                <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                      Server Settings
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)]">Server Host:Port</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)] mb-4">
                          Set the server host and port for API requests. This will take effect on your next login.
                        </p>
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="currentHostPort" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              Current Server
                            </label>
                            <input
                              type="text"
                              name="currentHostPort"
                              id="currentHostPort"
                              value={hostPort}
                              className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                              readOnly
                            />
                          </div>
                          <div>
                            <label htmlFor="newHostPort" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              New Server Host:Port
                            </label>
                            <input
                              type="text"
                              name="newHostPort"
                              id="newHostPort"
                              placeholder="127.0.0.1:7575"
                              value={newHostPort}
                              onChange={e => setNewHostPort(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                            />
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                              Format: host:port (e.g., 127.0.0.1:7575, localhost:7575)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleHostPortSubmit}
                            disabled={!newHostPort.trim()}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Update Server
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Audio Settings */}
              {activeSection === 'audio' && (
                <div className="space-y-6">
                  {/* Audio Quality */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Audio Quality
                      </h3>
                      <div className="space-y-6">
                        <div>
                          <label htmlFor="audioQuality" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            Voice Quality
                          </label>
                          <div className="relative">
                            <select
                              id="audioQuality"
                              name="audioQuality"
                              defaultValue="high"
                              className="mt-1 block w-full px-4 py-3 pr-10 border border-[var(--color-border)] rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-200 sm:text-sm appearance-none cursor-pointer hover:border-[var(--color-primary)]/50 hover:shadow-md focus:shadow-lg"
                            >
                              <option value="low">Low (8kbps)</option>
                              <option value="medium">Medium (16kbps)</option>
                              <option value="high">High (32kbps)</option>
                              <option value="ultra">Ultra (64kbps)</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                              <svg className="w-5 h-5 text-[var(--color-text-secondary)] transition-transform duration-200 group-hover:text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Higher quality uses more bandwidth but provides clearer audio.
                          </p>
                        </div>

                        <div>
                          <label htmlFor="sampleRate" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            Sample Rate
                          </label>
                          <div className="relative">
                            <select
                              id="sampleRate"
                              name="sampleRate"
                              defaultValue="48000"
                              className="mt-1 block w-full px-4 py-3 pr-10 border border-[var(--color-border)] rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-200 sm:text-sm appearance-none cursor-pointer hover:border-[var(--color-primary)]/50 hover:shadow-md focus:shadow-lg"
                            >
                              <option value="16000">16kHz</option>
                              <option value="24000">24kHz</option>
                              <option value="44100">44.1kHz</option>
                              <option value="48000">48kHz</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                              <svg className="w-5 h-5 text-[var(--color-text-secondary)] transition-transform duration-200 group-hover:text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
                          >
                            Save Audio Settings
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input/Output Settings */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Input & Output
                      </h3>
                      <div className="space-y-6">
                        <div>
                          <label htmlFor="inputDevice" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            Input Device (Microphone)
                          </label>
                          <div className="relative">
                            <select
                              id="inputDevice"
                              name="inputDevice"
                              defaultValue="default"
                              className="mt-1 block w-full px-4 py-3 pr-10 border border-[var(--color-border)] rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-200 sm:text-sm appearance-none cursor-pointer hover:border-[var(--color-primary)]/50 hover:shadow-md focus:shadow-lg"
                            >
                              <option value="default">System Default</option>
                              {/* Dynamic options would be populated from navigator.mediaDevices.enumerateDevices() */}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                              <svg className="w-5 h-5 text-[var(--color-text-secondary)] transition-transform duration-200 group-hover:text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="outputDevice" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            Output Device (Headphones/Speakers)
                          </label>
                          <div className="relative">
                            <select
                              id="outputDevice"
                              name="outputDevice"
                              defaultValue="default"
                              className="mt-1 block w-full px-4 py-3 pr-10 border border-[var(--color-border)] rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-200 sm:text-sm appearance-none cursor-pointer hover:border-[var(--color-primary)]/50 hover:shadow-md focus:shadow-lg"
                            >
                              <option value="default">System Default</option>
                              {/* Dynamic options would be populated from navigator.mediaDevices.enumerateDevices() */}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                              <svg className="w-5 h-5 text-[var(--color-text-secondary)] transition-transform duration-200 group-hover:text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
                          >
                            Apply Device Settings
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Audio Settings */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Advanced Audio Settings
                      </h3>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <label htmlFor="echoCancellation" className="block text-sm font-medium text-[var(--color-text)]">
                              Echo Cancellation
                            </label>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              Reduce echo and feedback in your voice
                            </p>
                          </div>
                          <button
                            type="button"
                            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                          >
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <label htmlFor="noiseSuppression" className="block text-sm font-medium text-[var(--color-text)]">
                              Noise Suppression
                            </label>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              Filter out background noise
                            </p>
                          </div>
                          <button
                            type="button"
                            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                          >
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <label htmlFor="automaticGainControl" className="block text-sm font-medium text-[var(--color-text)]">
                              Automatic Gain Control
                            </label>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              Automatically adjust microphone volume
                            </p>
                          </div>
                          <button
                            type="button"
                            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                          >
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Password Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-lg font-medium text-[var(--color-text)]">Confirm Password Reset</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Resetting your authentication token will log you out of all devices. You'll need to log in again with your new token. Please enter your current password to confirm.
              </p>
              <div>
                <label htmlFor="modalPassword" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  id="modalPassword"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-200"
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--color-border)] flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetPassword('');
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!resetPassword.trim()) return;
                  setShowResetModal(false);
                  await handleResetAuthToken();
                  setResetPassword('');
                }}
                disabled={!resetPassword.trim() || resetAuthTokenMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-error)] border border-transparent rounded-md hover:bg-[var(--color-error)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-error)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resetAuthTokenMutation.isPending ? 'Resetting...' : 'Reset Token'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
