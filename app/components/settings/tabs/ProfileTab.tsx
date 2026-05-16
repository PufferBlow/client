/**
 * ProfileTab — Settings page > Profile pane. Display name, status,
 * bio, avatar / banner uploaders, the avatar-kind / accent toggles
 * (ProfileAppearanceControls), and a live UserCard preview side
 * panel. Footer has Reset / Save Changes buttons that pull from
 * the mutation-pending flags in the parent.
 *
 * Most fields the tab needs come from useSettingsProfile, so the
 * tab takes the entire hook return as a single `profile` prop and
 * destructures it internally. currentUser and the "saving" flag
 * (rolled up from four mutation isPending flags) come in
 * separately — they don't live on the hook.
 *
 * The cache-invalidation step that runs after ProfileAppearanceControls
 * fires stays in the parent (it needs queryClient + USER_QUERY_KEYS),
 * so the tab just calls `onAppearanceChanged()`.
 */
import { Button } from "../../Button";
import { FileUploadInput } from "../../FileUploadInput";
import { UserCard } from "../../UserCard";
import { ProfileAppearanceControls } from "../ProfileAppearanceControls";
import { useCurrentUserProfile } from "../../../services/user";
import { useSettingsProfile } from "../useSettingsProfile";

interface ProfileTabProps {
  // currentUser comes straight from useCurrentUserProfile (a tanstack
  // query) — its shape is the runtime-massaged ApiUserProfile, not the
  // exported `UserProfile` interface, so we lean on the query's own
  // ReturnType to stay in sync with the source of truth.
  profile: ReturnType<typeof useSettingsProfile>;
  currentUser: ReturnType<typeof useCurrentUserProfile>['data'];
  isSavingProfile: boolean;
  onAppearanceChanged: () => void;
}

export function ProfileTab({
  profile,
  currentUser,
  isSavingProfile,
  onAppearanceChanged,
}: ProfileTabProps) {
  const {
    userStatus,
    setUserStatus,
    userBio,
    bioInputValue,
    setBioInputValue,
    setHasBioChanged,
    newUsername,
    setNewUsername,
    bannerPreview,
    setIsProfileModalOpen,
    hasProfileChanges,
    handleAvatarFileSubmit,
    handleAvatarUrlSubmit,
    handleBannerFileSubmit,
    handleBannerUrlSubmit,
    resetProfileForm,
    saveProfileChanges,
  } = profile;

  return (
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

            <ProfileAppearanceControls
              profile={currentUser as any}
              onAppearanceChanged={onAppearanceChanged}
            />

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
              disabled={isSavingProfile || !hasProfileChanges}
              loading={isSavingProfile}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
