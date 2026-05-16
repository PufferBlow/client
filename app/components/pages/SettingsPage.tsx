import { Link } from "react-router";
import { useTheme, themePresets } from "../../components/ThemeProvider";
import { useState, useEffect } from "react";
import { UserCard } from "../../components/UserCard";
import { CroppableImage } from "../../components/CroppableImage";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/Button";
import { getHostPortFromStorage, setHostPortToStorage, useCurrentUserProfile, useUpdateUsername, useUpdateStatus, useUpdateBio, useUpdateAvatar, useUpdateBanner, useUpdatePassword, useResetAuthToken, useLogout, USER_QUERY_KEYS } from "../../services/user";
import { normalizeInstance, resolveInstance } from "../../services/instance";
import { useQueryClient } from '@tanstack/react-query';
import { User, Palette, Volume2, Server, Shield } from 'lucide-react';
import { SettingsHeader } from "../settings/SettingsHeader";
import { SettingsSidebar } from "../settings/SettingsSidebar";
import type { SettingsTab, SettingsTabId } from "../settings/types";
import { useSettingsAudio } from "../settings/useSettingsAudio";
import { useSettingsProfile } from "../settings/useSettingsProfile";
import { ServerTab } from "../settings/tabs/ServerTab";
import { SecurityTab } from "../settings/tabs/SecurityTab";
import { AudioTab } from "../settings/tabs/AudioTab";
import { ProfileTab } from "../settings/tabs/ProfileTab";

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
  // Theme-naming modal — replaces window.prompt('Enter a name for your custom
  // theme:') so the rename uses themed inputs and keyboard handling like the
  // rest of the app.
  const [themeNameModal, setThemeNameModal] = useState<{ open: boolean; value: string }>({
    open: false,
    value: "",
  });

  const profile = useSettingsProfile({
    currentUser,
    queryClient,
    updateUsernameMutation,
    updateStatusMutation,
    updateBioMutation,
    updateAvatarMutation,
    updateBannerMutation,
    setMessage,
  });

  const audio = useSettingsAudio({
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

  const handleHostPortSubmit = async () => {
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
      <div className="h-full bg-[var(--color-background)] flex font-sans select-none relative overflow-hidden">
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
      <div className="h-full bg-[var(--color-background)] flex items-center justify-center p-4">
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
      <div className="h-full bg-[var(--color-background)] flex items-center justify-center p-4">
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
      <div className="h-full bg-[var(--color-background)] flex font-sans select-none relative overflow-hidden">
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
              <ProfileTab
                profile={profile}
                currentUser={currentUser}
                isSavingProfile={
                  updateUsernameMutation.isPending ||
                  updateBannerMutation.isPending ||
                  updateBioMutation.isPending ||
                  updateStatusMutation.isPending
                }
                onAppearanceChanged={() => {
                  // Invalidate the profile cache so the page picks
                  // up the new avatar_kind / accent_color / seed.
                  // The toggle endpoint doesn't return the full
                  // profile shape, so a refetch is the cleanest
                  // way to keep every consumer in sync.
                  void queryClient.invalidateQueries({
                    queryKey: USER_QUERY_KEYS.currentProfile(),
                  });
                }}
              />
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
                    onClick={() =>
                      setThemeNameModal({
                        open: true,
                        value: appearanceConfig.name || "",
                      })
                    }
                    className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] text-sm rounded transition-colors"
                  >
                    Save Custom Theme
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <AudioTab audio={audio} />
            )}

            {activeTab === 'server' && (
              <ServerTab
                hostPort={hostPort}
                newHostPort={newHostPort}
                setNewHostPort={setNewHostPort}
                onSubmit={handleHostPortSubmit}
              />
            )}

            {activeTab === 'security' && (
              <SecurityTab
                currentPassword={currentPassword}
                setCurrentPassword={setCurrentPassword}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                onUpdatePassword={handlePasswordSubmit}
                isUpdatingPassword={updatePasswordMutation.isPending}
                onOpenResetTokenModal={() => setShowResetModal(true)}
                onSignOut={() => {
                  logout();
                  setTimeout(() => (window.location.href = '/login'), 100);
                }}
              />
            )}
          </div>
        </div>

        <Modal
          isOpen={themeNameModal.open}
          onClose={() => setThemeNameModal({ open: false, value: "" })}
          title="Save Custom Theme"
          description="Give this theme a name so it shows up in your saved presets."
          widthClassName="max-w-md"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setThemeNameModal({ open: false, value: "" })}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  const trimmed = themeNameModal.value.trim();
                  if (!trimmed) return;
                  setAppearanceConfig({ ...appearanceConfig, name: trimmed });
                  setMessage({
                    type: "success",
                    text: `Theme named "${trimmed}" and saved!`,
                  });
                  setThemeNameModal({ open: false, value: "" });
                }}
                disabled={!themeNameModal.value.trim()}
              >
                Save
              </Button>
            </div>
          }
        >
          <input
            type="text"
            autoFocus
            value={themeNameModal.value}
            onChange={(e) =>
              setThemeNameModal((prev) => ({ ...prev, value: e.target.value }))
            }
            placeholder="My Nord remix"
            maxLength={64}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && themeNameModal.value.trim()) {
                const trimmed = themeNameModal.value.trim();
                setAppearanceConfig({ ...appearanceConfig, name: trimmed });
                setMessage({
                  type: "success",
                  text: `Theme named "${trimmed}" and saved!`,
                });
                setThemeNameModal({ open: false, value: "" });
              }
            }}
          />
        </Modal>

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
          isOpen={profile.isProfileModalOpen}
          onClose={() => profile.setIsProfileModalOpen(false)}
          title="Profile Preview"
          widthClassName="max-w-lg"
        >
          <div className="flex justify-center">
            <UserCard
              username={profile.newUsername || currentUser?.username || 'Username'}
              bio={profile.bioInputValue || 'No bio set'}
              roles={currentUser?.roles as any}
              avatarUrl={currentUser?.avatar_url || undefined}
              backgroundUrl={profile.bannerPreview || currentUser?.banner_url || undefined}
              status={
                profile.userStatus === 'online'
                  ? 'active'
                  : profile.userStatus === 'offline'
                    ? 'offline'
                    : profile.userStatus === 'afk'
                      ? 'idle'
                      : profile.userStatus as 'idle' | 'dnd'
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
          isOpen={Boolean(profile.isCroppingModalOpen && profile.croppingImageSrc && profile.croppingImageType)}
          onClose={() => {
            if (updateAvatarMutation.isPending || updateBannerMutation.isPending) {
              return;
            }
            profile.handleCroppingCancel();
          }}
          title={`Crop ${profile.croppingImageType === 'avatar' ? 'Avatar' : 'Banner'}`}
          widthClassName="max-w-xl"
        >
          {profile.croppingImageSrc && profile.croppingImageType ? (
            <CroppableImage
              imageSrc={profile.croppingImageSrc}
              aspect={profile.croppingImageType === 'avatar' ? 1 : 4}
              shape={profile.croppingImageType === 'avatar' ? 'round' : 'rect'}
              onCropComplete={profile.handleCroppedImage}
              onCancel={profile.handleCroppingCancel}
              className="max-w-full"
            />
          ) : null}
        </Modal>
      </div>
    </>
  );
}
