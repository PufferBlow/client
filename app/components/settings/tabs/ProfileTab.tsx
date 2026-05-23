/**
 * ProfileTab — Settings page > Profile pane.
 *
 * Layout shape:
 *
 *   ┌──────────────────────────────────────────┐
 *   │  Banner (hover → "Change banner" overlay)│
 *   │   ⊕ Avatar overlay (hover → "Change")   │
 *   ├──────────────────────────────────────────┤
 *   │  Display name        [inline input]      │
 *   │  About me            [textarea]          │
 *   │  Status              [AFK] [DND]         │
 *   │  Appearance          [<colour picker>]   │
 *   └──────────────────────────────────────────┘
 *      ─ unsaved hint ─       [Reset] [Save]
 *
 * Reworked from the previous two-column layout with a sticky
 * UserCard sidebar + separate Avatar/Banner cards. That version
 * was tedious because:
 *
 *   * Two competing previews (banner-overlay + sidebar UserCard)
 *     pulled the eye in two directions.
 *   * Avatar and Banner were two big bordered sub-cards each with
 *     their own header + caption — ~200px of vertical chrome for
 *     two file pickers.
 *   * Status was a `<select>` with two options — strictly worse
 *     than two inline pill buttons.
 *   * Form fields lived INSIDE the banner-overlay card. Visually
 *     nested — looked like configuration of the preview, not of
 *     the user's profile.
 *
 * The hook contract (`useSettingsProfile`) is unchanged — this is
 * a pure visual rework.
 */
import { useRef } from "react";
import { Button } from "../../Button";
import { ProfileAppearanceControls } from "../ProfileAppearanceControls";
import { useCurrentUserProfile } from "../../../services/user";
import { useSettingsProfile } from "../useSettingsProfile";

interface ProfileTabProps {
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
    handleBannerFileSubmit,
    resetProfileForm,
    saveProfileChanges,
  } = profile;

  // Hidden file inputs the "Change avatar" / "Change banner" hover
  // overlays trigger. Inline file inputs were too noisy — we only
  // need the picker, not a labelled card around it.
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {/* ── Preview header ────────────────────────────────────────
            Single combined banner + avatar block, hover-to-edit.
            Replaces both the old in-tab banner card AND the
            separate sticky UserCard sidebar. Click the "Open
            Preview" affordance for the full UserCard popout. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            className="group relative block h-40 w-full overflow-hidden border-b border-[var(--color-border)]"
            aria-label="Change banner"
          >
            {bannerPreview || currentUser?.banner_url ? (
              <img
                src={bannerPreview || currentUser?.banner_url || ''}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-[var(--color-surface-tertiary)]" />
            )}
            <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/40 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                Change banner
              </span>
            </div>
          </button>

          {/* Avatar — overlaps the banner edge by 24px so the chip
              reads as "you, on your banner" without a sub-card. */}
          <div className="absolute -bottom-10 left-5 flex items-end gap-3">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="group relative h-20 w-20 overflow-hidden rounded-full border-4 border-[var(--color-surface)] bg-[var(--color-surface-tertiary)]"
              aria-label="Change avatar"
            >
              {currentUser?.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--color-primary)] text-2xl font-bold text-[var(--color-on-primary)]">
                  {(newUsername || currentUser?.username || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                Change
              </div>
            </button>
          </div>

          {/* "Open Preview" — gives access to the full UserCard popout
              for users who want to verify how their card renders
              outside the form context. Moved from the sticky
              sidebar to a single corner control. */}
          <div className="absolute right-3 top-3">
            <Button type="button" size="sm" variant="secondary" onClick={() => setIsProfileModalOpen(true)}>
              Open preview
            </Button>
          </div>
        </div>

        {/* ── Form ──────────────────────────────────────────────────
            Single column. Padded enough at the top to clear the
            avatar overlap. Each field is one row — no nested cards. */}
        <div className="space-y-6 px-6 pb-6 pt-14">
          <div>
            <label htmlFor="profile-display-name" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              Display name
            </label>
            <input
              id="profile-display-name"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={currentUser?.username || 'Enter username'}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              How your name appears in chats and member lists.
            </p>
          </div>

          <div>
            <label htmlFor="profile-bio" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              About me
            </label>
            <textarea
              id="profile-bio"
              rows={3}
              value={bioInputValue}
              onChange={(e) => {
                const newValue = e.target.value;
                setBioInputValue(newValue);
                setHasBioChanged(newValue !== userBio);
              }}
              placeholder="Tell people what you are up to."
              className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              maxLength={500}
            />
            <div className="mt-1 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              <span>Markdown and mentions are supported.</span>
              <span>{bioInputValue.length}/500</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              Status
            </label>
            {/* Pill row replaces the previous `<select>` with two
                options. Pills make the choice visible at a glance
                and remove one extra click per change.

                Why only AFK / DND?
                  - AUTO statuses (online / idle / offline) are
                    driven by the dashboard activity loop and would
                    fight any explicit pick. The picker is for
                    intent ("I'm here but don't ping me"), not for
                    overriding presence detection. */}
            <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-0.5">
              {([
                { value: 'afk', label: 'AFK', description: 'Away from keyboard' },
                { value: 'dnd', label: 'Do Not Disturb', description: 'Suppress non-mention pings' },
              ] as const).map((opt) => {
                const isActive = userStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUserStatus(opt.value)}
                    title={opt.description}
                    className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Appearance controls — avatar-kind toggle + accent picker.
              Kept in its own block because it writes immediately on
              change (different commit model than the rest of the
              form). Anchoring it under a clear "Appearance" heading
              makes that contract visible without code-reading. */}
          <div className="border-t border-[var(--color-border)] pt-6">
            <h3 className="mb-3 text-sm font-medium text-[var(--color-text)]">Appearance</h3>
            <ProfileAppearanceControls
              profile={currentUser as any}
              onAppearanceChanged={onAppearanceChanged}
            />
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Appearance changes save automatically. The fields above wait for the Save button below.
            </p>
          </div>
        </div>

        {/* ── Footer: save / reset ─────────────────────────────────
            Same hint + buttons pattern as before; now the only
            place the eye lands for "did my edits go through." */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-secondary)]/60 px-6 py-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            {hasProfileChanges ? 'You have unsaved changes.' : 'All changes saved.'}
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

      {/* Hidden file inputs powering the avatar/banner overlays. The
          handlers route through the same submit functions the old
          `<FileUploadInput>` sub-cards used, so the upload pipeline
          (resize, format detection, error toasts) is unchanged. */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAvatarFileSubmit(file);
          // Reset value so picking the same file again still fires onChange.
          e.target.value = '';
        }}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleBannerFileSubmit(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
