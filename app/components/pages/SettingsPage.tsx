import { Link } from "react-router";
import { useTheme, themePresets } from "../../components/ThemeProvider";
import { useState, useEffect } from "react";
import { FileUploadInput } from "../../components/FileUploadInput";
import { UserCard } from "../../components/UserCard";
import { CroppableImage } from "../../components/CroppableImage";
import { ModernSlider, ModernToggle } from "../../components/AudioControls";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/Button";
import { getHostPortFromStorage, setHostPortToStorage, useCurrentUserProfile, useUpdateUsername, useUpdateStatus, useUpdateBio, useUpdateAvatar, useUpdateBanner, useUpdatePassword, useResetAuthToken, useLogout } from "../../services/user";
import { normalizeInstance, resolveInstance } from "../../services/instance";
import { useQueryClient } from '@tanstack/react-query';
import { User, Palette, Volume2, Server, Shield } from 'lucide-react';
import { SettingsHeader } from "../settings/SettingsHeader";
import { SettingsSidebar } from "../settings/SettingsSidebar";
import type { SettingsTab, SettingsTabId } from "../settings/types";
import { useSettingsAudio } from "../settings/useSettingsAudio";
import { useSettingsProfile } from "../settings/useSettingsProfile";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');

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
  const { appearanceConfig, setAppearanceConfig, exportConfig, importConfig, resetToPreset } = useTheme();
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [newHostPort, setNewHostPort] = useState('');
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const {
    userStatus,
    setUserStatus,
    userBio,
    bioInputValue,
    setBioInputValue,
    hasBioChanged,
    setHasBioChanged,
    newUsername,
    setNewUsername,
    bannerPreview,
    bannerFile,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isCroppingModalOpen,
    croppingImageType,
    croppingImageSrc,
    hasProfileChanges,
    handleAvatarFileSubmit,
    handleAvatarUrlSubmit,
    handleBannerFileSubmit,
    handleBannerUrlSubmit,
    handleCroppedImage,
    handleCroppingCancel,
    resetProfileForm,
    saveProfileChanges,
  } = useSettingsProfile({
    currentUser,
    queryClient,
    updateUsernameMutation,
    updateStatusMutation,
    updateBioMutation,
    updateAvatarMutation,
    updateBannerMutation,
    setMessage,
  });

  const {
    micVolume,
    setMicVolume,
    speakerVolume,
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
  } = useSettingsAudio({
    currentUser,
    setMessage,
  });

  // Set initial active tab based on URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['profile', 'appearance', 'audio', 'server', 'security'].includes(hash)) {
      setActiveTab(hash as any);
    }
  }, []);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const hostPort = getHostPortFromStorage() || '';

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

  const handleHostPortSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostPort.trim()) return;
    let normalizedInstance = '';
    try {
      normalizedInstance = normalizeInstance(newHostPort);
      resolveInstance(newHostPort);
    } catch {
      setMessage({ type: 'error', text: 'Invalid instance address. Use values like \'localhost:7575\', \'https://pufferblow.example\', or \'chat.example.com\'.' });
      return;
    }
    setHostPortToStorage(normalizedInstance);
    setMessage({ type: 'success', text: 'Home instance updated successfully. Changes will take effect on next login.' });
    setNewHostPort('');
  };

  // Handle loading timeout - prevent infinite loading and redirect to dashboard
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
            <span className="bg-[var(--color-error)] text-[var(--color-on-error)] text-xs px-1.5 py-0.5 rounded-full font-bold ml-auto">USER</span>
          </div>
        </div>
        <div className="flex-1 p-6 animate-pulse">
          <div className="h-8 bg-[var(--color-surface-tertiary)] rounded w-48 mb-6"></div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[var(--color-surface-secondary)] rounded-lg p-6 mb-6">
              <div className="h-6 bg-[var(--color-surface-tertiary)] rounded mb-4 w-48"></div>
              <div className="space-y-4">
                <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-full"></div>
                <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-3/4"></div>
                <div className="h-10 bg-[var(--color-surface-tertiary)] rounded w-32"></div>
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
          <div className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-8">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background)]">
                <svg className="w-8 h-8 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.6-.833-2.37 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">Failed to Load Settings</h1>
              <p className="text-lg text-[var(--color-text-secondary)] mb-4">
                There was an issue loading your profile information. This may be due to a network issue or expired session.
              </p>
              <Link
                to="/dashboard"
                className="inline-block w-full rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-6 py-3 font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
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
          <div className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-8">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background)]">
                <svg className="w-8 h-8 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">Loading Timeout</h1>
              <p className="text-lg text-[var(--color-text-secondary)] mb-4">
                Settings are taking too long to load. Please try again or go to dashboard.
              </p>
              <Link
                to="/dashboard"
                className="inline-block w-full rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-6 py-3 font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs: SettingsTab[] = [
    { id: 'profile', label: 'Profile', icon: <User className="w-6 h-6" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-6 h-6" /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-6 h-6" /> },
    { id: 'server', label: 'Server', icon: <Server className="w-6 h-6" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-6 h-6" /> },
  ];

  return (
    <>
      <div className="h-screen bg-[var(--color-background)] flex font-sans select-none relative overflow-hidden">
        <SettingsSidebar tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[var(--color-background)] overflow-hidden">
          <SettingsHeader
            title={tabs.find((tab) => tab.id === activeTab)?.label || "Settings"}
            message={message}
            onDismissMessage={() => setMessage(null)}
          />

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-[var(--color-background)]">
            {activeTab === 'profile' && (
              <div className="mx-auto max-w-6xl">
                <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="border-b border-[var(--color-border)] px-6 py-5">
                    <h2 className="text-xl font-semibold text-[var(--color-text)]">User Profile</h2>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Customize your profile to match how your account appears in servers and DMs.
                    </p>
                  </div>

                  <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="space-y-5">
                      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                        <div className="relative h-40 overflow-hidden border-b border-[var(--color-border)]">
                          {bannerPreview || currentUser?.banner_url ? (
                            <img
                              src={bannerPreview || currentUser?.banner_url || ''}
                              alt="Profile banner preview"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-[var(--color-surface-tertiary)]" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface)]/85 via-[var(--color-surface)]/35 to-transparent" />

                          <div className="absolute right-3 top-3">
                            <Button type="button" size="sm" variant="secondary" onClick={() => setIsProfileModalOpen(true)}>
                              Open Preview
                            </Button>
                          </div>

                          <div className="absolute bottom-3 left-4 flex items-end gap-3">
                            <div className="h-[72px] w-[72px] overflow-hidden rounded-full border-4 border-[var(--color-surface)] bg-[var(--color-surface-tertiary)]">
                              {currentUser?.avatar_url ? (
                                <img
                                  src={currentUser.avatar_url}
                                  alt="Profile avatar"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-[var(--color-primary)] text-xl font-bold text-[var(--color-on-primary)]">
                                  {(newUsername || currentUser?.username || 'U').charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="pb-1">
                              <div className="text-base font-semibold text-[var(--color-text)]">
                                {newUsername || currentUser?.username || 'Username'}
                              </div>
                              <div className="inline-flex items-center rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)]/90 px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                                {userStatus === 'dnd'
                                  ? 'Do Not Disturb'
                                  : userStatus === 'afk'
                                    ? 'AFK'
                                    : userStatus.charAt(0).toUpperCase() + userStatus.slice(1)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 p-4">
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                              Display Name
                            </label>
                            <input
                              type="text"
                              value={newUsername}
                              onChange={(e) => setNewUsername(e.target.value)}
                              placeholder={currentUser?.username || 'Enter username'}
                              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                              This is how your name appears in chats and member lists.
                            </p>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                              About Me
                            </label>
                            <textarea
                              rows={4}
                              value={bioInputValue}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setBioInputValue(newValue);
                                setHasBioChanged(newValue !== userBio);
                              }}
                              placeholder="Tell people what you are up to."
                              className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                              maxLength={500}
                            />
                            <div className="mt-1 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                              <span>Markdown and mentions are supported.</span>
                              <span>{bioInputValue.length}/500</span>
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                              Status
                            </label>
                            <select
                              value={userStatus}
                              onChange={(e) => setUserStatus(e.target.value as 'online' | 'offline' | 'idle' | 'afk' | 'dnd')}
                              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            >
                              <option value="online">Online</option>
                              <option value="afk">AFK</option>
                              <option value="idle">Idle</option>
                              <option value="dnd">Do Not Disturb</option>
                              <option value="offline">Invisible</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4">
                          <div className="mb-3">
                            <h3 className="text-sm font-semibold text-[var(--color-text)]">Avatar</h3>
                            <p className="text-xs text-[var(--color-text-muted)]">Upload or link a square profile picture (PNG/JPG/GIF).</p>
                          </div>
                          <FileUploadInput
                            label="Profile Avatar"
                            accept="image/*"
                            maxSize={5 * 1024 * 1024}
                            onFileSelected={(file) => { if (file) handleAvatarFileSubmit(file); }}
                            onUrlChange={(url) => handleAvatarUrlSubmit(url)}
                            currentFile={currentUser?.avatar_url || undefined}
                            placeholder="https://example.com/avatar.png"
                          />
                        </div>

                        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4">
                          <div className="mb-3">
                            <h3 className="text-sm font-semibold text-[var(--color-text)]">Banner</h3>
                            <p className="text-xs text-[var(--color-text-muted)]">Upload or link a wide banner image (GIF supported).</p>
                          </div>
                          <FileUploadInput
                            label="Profile Banner"
                            accept="image/*"
                            maxSize={10 * 1024 * 1024}
                            onFileSelected={(file) => { if (file) handleBannerFileSubmit(file); }}
                            onUrlChange={(url) => handleBannerUrlSubmit(url)}
                            currentFile={(currentUser as any)?.banner_url}
                            placeholder="https://example.com/banner.png"
                          />
                        </div>
                      </div>
                    </div>

                    <aside className="self-start lg:sticky lg:top-5">
                      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Live Preview</h3>
                          <button
                            onClick={() => setIsProfileModalOpen(true)}
                            className="text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                            type="button"
                          >
                            Popout
                          </button>
                        </div>

                        <div className="flex justify-center">
                          <UserCard
                            username={newUsername || currentUser?.username || 'Username'}
                            bio={bioInputValue || 'No bio set'}
                            roles={currentUser?.roles as any}
                            avatarUrl={currentUser?.avatar_url || undefined}
                            backgroundUrl={bannerPreview || currentUser?.banner_url || undefined}
                            status={
                              userStatus === 'online'
                                ? 'active'
                                : userStatus === 'offline'
                                  ? 'offline'
                                  : userStatus === 'afk'
                                    ? 'idle'
                                    : userStatus as 'idle' | 'dnd'
                            }
                            originServer={currentUser?.origin_server}
                            showOnlineIndicator={true}
                            isCompact={false}
                          />
                        </div>
                      </div>
                    </aside>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-secondary)]/60 px-5 py-4">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {hasProfileChanges ? 'You have unsaved profile changes.' : 'No pending profile changes.'}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={resetProfileForm}
                        disabled={!hasProfileChanges}
                      >
                        Reset
                      </Button>

                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => {
                          void saveProfileChanges();
                        }}
                        disabled={
                          updateUsernameMutation.isPending ||
                          updateBannerMutation.isPending ||
                          updateBioMutation.isPending ||
                          updateStatusMutation.isPending ||
                          !hasProfileChanges
                        }
                        loading={
                          updateUsernameMutation.isPending ||
                          updateBannerMutation.isPending ||
                          updateBioMutation.isPending ||
                          updateStatusMutation.isPending
                        }
                      >
                        Save Changes
                      </Button>
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
                              className="w-8 h-8 rounded-full border border-[var(--color-border-secondary)] flex-shrink-0"
                              style={{ backgroundColor: presetConfig.colors.primary }}
                            ></div>
                            <div className="text-left">
                              <div className="font-medium text-[var(--color-text)]">{presetName}</div>
                              <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                                Monochrome {presetName.toLowerCase().includes('dark') ? "dark" : "light"} preset
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
                            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] text-sm rounded-lg transition-colors"
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
                        <Button
                          type="button"
                          size="sm"
                          variant="success"
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
                        >
                          Import & Apply
                        </Button>
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
                    onClick={() => resetToPreset('Monochrome Dark')}
                    className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-secondary)] text-sm rounded transition-colors"
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
                    className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] text-sm rounded transition-colors"
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
            )}

            {activeTab === 'server' && (
              <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
                <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">Server Settings</h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text)]">Home Instance</h4>
                    <p className="mt-1 mb-4 text-sm text-[var(--color-text-secondary)]">Set the instance origin the client uses for API, websocket, and media requests.</p>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="currentHostPort" className="block text-sm font-medium text-[var(--color-text-secondary)]">Current Instance</label>
                        <input type="text" name="currentHostPort" id="currentHostPort" value={hostPort || 'No home instance configured'} className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm" readOnly />
                      </div>
                      <div>
                        <label htmlFor="newHostPort" className="block text-sm font-medium text-[var(--color-text-secondary)]">New Instance Address</label>
                        <input type="text" name="newHostPort" id="newHostPort" placeholder="localhost:7575, https://pb.example, or chat.example.com" value={newHostPort} onChange={e => setNewHostPort(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm" />
                      </div>
                      <Button
                        type="button"
                        onClick={handleHostPortSubmit}
                        disabled={!newHostPort.trim()}
                        variant="primary"
                      >
                        Update Instance
                      </Button>
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
                        <Button
                          type="button"
                          onClick={handlePasswordSubmit}
                          disabled={updatePasswordMutation.isPending}
                          loading={updatePasswordMutation.isPending}
                          variant="primary"
                        >
                          {updatePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                        </Button>
                      </div>
                    </div>

                    <div className="border-t border-[var(--color-border)] pt-6">
                      <h4 className="text-sm font-medium text-[var(--color-text)]">Authentication Token</h4>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Resetting your authentication token will log you out</p>
                      <div className="mt-3">
                        <Button type="button" onClick={() => setShowResetModal(true)} variant="danger">
                          Reset Auth Token
                        </Button>
                      </div>
                    </div>

                    <div className="border-t border-[var(--color-border)] pt-6">
                      <h4 className="text-sm font-medium text-[var(--color-text)]">Sign Out</h4>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Sign out of your account</p>
                      <div className="mt-3">
                        <Button
                          type="button"
                          onClick={() => {
                            logout();
                            setTimeout(() => window.location.href = '/login', 100);
                          }}
                          variant="danger"
                        >
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Modal
          isOpen={showResetModal}
          onClose={() => {
            if (resetAuthTokenMutation.isPending) return;
            setShowResetModal(false);
            setResetPassword('');
          }}
          title="Reset Authentication Token"
          description="Resetting your token signs you out of all devices and requires logging in again."
          widthClassName="max-w-md"
          footer={(
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowResetModal(false);
                  setResetPassword('');
                }}
                disabled={resetAuthTokenMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleResetAuthToken}
                disabled={!resetPassword.trim() || resetAuthTokenMutation.isPending}
                loading={resetAuthTokenMutation.isPending}
              >
                {resetAuthTokenMutation.isPending ? 'Resetting...' : 'Reset Token'}
              </Button>
            </div>
          )}
        >
          <div>
            <label htmlFor="resetPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Enter your current password
            </label>
            <input
              type="password"
              name="resetPassword"
              id="resetPassword"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text)] shadow-sm transition-all duration-200 placeholder-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:text-sm"
            />
          </div>
        </Modal>

        <Modal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          title="Profile Preview"
          widthClassName="max-w-lg"
        >
          <div className="flex justify-center">
            <UserCard
              username={newUsername || currentUser?.username || 'Username'}
              bio={bioInputValue || 'No bio set'}
              roles={currentUser?.roles as any}
              avatarUrl={currentUser?.avatar_url || undefined}
              backgroundUrl={bannerPreview || currentUser?.banner_url || undefined}
              status={
                userStatus === 'online'
                  ? 'active'
                  : userStatus === 'offline'
                    ? 'offline'
                    : userStatus === 'afk'
                      ? 'idle'
                      : userStatus as 'idle' | 'dnd'
              }
              originServer={currentUser?.origin_server}
              showOnlineIndicator={true}
              isCompact={false}
            />
          </div>
          <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
            This is how your profile appears to other users.
          </p>
        </Modal>

        <Modal
          isOpen={Boolean(isCroppingModalOpen && croppingImageSrc && croppingImageType)}
          onClose={() => {
            if (updateAvatarMutation.isPending || updateBannerMutation.isPending) {
              return;
            }
            handleCroppingCancel();
          }}
          title={`Crop ${croppingImageType === 'avatar' ? 'Avatar' : 'Banner'}`}
          widthClassName="max-w-xl"
        >
          {croppingImageSrc && croppingImageType ? (
            <CroppableImage
              imageSrc={croppingImageSrc}
              aspect={croppingImageType === 'avatar' ? 1 : 4}
              shape={croppingImageType === 'avatar' ? 'round' : 'rect'}
              onCropComplete={handleCroppedImage}
              onCancel={handleCroppingCancel}
              className="max-w-full"
            />
          ) : null}
        </Modal>
      </div>
    </>
  );
}
