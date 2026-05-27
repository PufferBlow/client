import { Link } from "react-router";
import { useTheme } from "../../components/ThemeProvider";
import { useState, useEffect } from "react";
import { UserCard } from "../../components/UserCard";
import { CroppableImage } from "../../components/CroppableImage";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/Button";
import { getHostPortFromStorage, setHostPortToStorage, useCurrentUserProfile, useUpdateUsername, useUpdateStatus, useUpdateBio, useUpdateAvatar, useUpdateBanner, useUpdatePassword, useResetAuthToken, useLogout, USER_QUERY_KEYS } from "../../services/user";
import { normalizeInstance, resolveInstance } from "../../services/instance";
import { useQueryClient } from '@tanstack/react-query';
import { User, Palette, Volume2, Server, Shield, Monitor } from 'lucide-react';
import { SettingsHeader } from "../settings/SettingsHeader";
import { SettingsSidebar } from "../settings/SettingsSidebar";
import type { SettingsTab, SettingsTabId } from "../settings/types";
import { useSettingsAudio } from "../settings/useSettingsAudio";
import { useSettingsProfile } from "../settings/useSettingsProfile";
import { ServerTab } from "../settings/tabs/ServerTab";
import { SecurityTab } from "../settings/tabs/SecurityTab";
import { AudioTab } from "../settings/tabs/AudioTab";
import { ProfileTab } from "../settings/tabs/ProfileTab";
import { AppearanceTab } from "../settings/tabs/AppearanceTab";
import { ClientTab } from "../settings/tabs/ClientTab";
import { useTrackLastRoute } from "../../utils/uiStatePersistence";

export default function Settings() {
  // Persist /settings as the last-visited route so reloading the app
  // brings the user back into the same area instead of marketing.
  useTrackLastRoute("/settings");
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
  const theme = useTheme();
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
    if (hash && ['profile', 'appearance', 'audio', 'server', 'security', 'client'].includes(hash)) {
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
    // Label is "Voice" (matches the user's mental model — they call
    // it the voice tab) but the id stays 'audio' so URL hashes
    // (`#audio`) and any persisted state keep resolving.
    { id: 'audio', label: 'Voice', icon: <Volume2 className="w-6 h-6" /> },
    { id: 'server', label: 'Server', icon: <Server className="w-6 h-6" /> },
    // Client tab — local device preferences (hardware acceleration,
    // auto-update, version readout). Sits next to Server (which
    // configures the home instance) so the two complementary
    // configurations are easy to find together. Monitor glyph reads
    // as "this device / display."
    { id: 'client', label: 'Client', icon: <Monitor className="w-6 h-6" /> },
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
              <AppearanceTab
                theme={theme}
                setMessage={setMessage}
                onOpenThemeNameModal={() =>
                  setThemeNameModal({
                    open: true,
                    value: theme.appearanceConfig.name || "",
                  })
                }
              />
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

            {activeTab === 'client' && (
              <ClientTab setMessage={setMessage} />
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
                  // Await the cleanup before navigating so cookies +
                  // storage are actually gone by the time `/login`
                  // loads. The previous setTimeout-then-navigate
                  // pattern raced the revoke + storage clears
                  // against the page transition and could leave
                  // node_session_token, the persisted query cache,
                  // and the in-flight refresh-token revoke hanging
                  // mid-flight.
                  //
                  // `window.location.href` (hard nav) is intentional
                  // — it forces a full app reload, which resets all
                  // React state, evicts the in-memory query cache
                  // again, and rehydrates from the now-empty
                  // PUFFERBLOW_QUERY_CACHE so the login page starts
                  // truly clean.
                  void logout().finally(() => {
                    window.location.href = '/login';
                  });
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
                  theme.setAppearanceConfig({ ...theme.appearanceConfig, name: trimmed });
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
                theme.setAppearanceConfig({ ...theme.appearanceConfig, name: trimmed });
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
