import React, { useState } from 'react';
import { Image as ImageIcon, Palette, Shuffle, User as UserIcon } from 'lucide-react';

import {
  ACCENT_COLOR_PALETTE,
  createIdenticonUrl,
  updateProfileAppearance,
  type ApiUserProfile,
} from '../../services/user';
import { getAuthTokenFromCookies } from '../../services/user';
import { getHostPortFromStorage, getHostPortFromCookies } from '../../services/user';
import { useToast } from '../Toast';

interface ProfileAppearanceControlsProps {
  /**
   * Currently-loaded profile. We read avatar_kind / banner_kind /
   * accent_color / avatar_seed from this snapshot for the UI state,
   * and call ``onAppearanceChanged`` after the mutation lands so the
   * parent can refetch / invalidate any cached profile data.
   */
  profile: ApiUserProfile | undefined;
  onAppearanceChanged?: () => void;
}

/**
 * Avatar mode + banner color picker for the profile settings page.
 * Wraps the new /api/v1/users/profile/appearance endpoint.
 *
 * Layout:
 *  - Avatar mode row: two radio-style buttons (Identicon / Custom image)
 *    and a "Shuffle" button when Identicon is selected
 *  - Banner mode row: same shape (Solid color / Custom image)
 *  - When Banner mode = solid, a 4x4 swatch grid renders below
 *
 * File upload UI lives in the parent (FileUploadInput) — this component
 * intentionally doesn't own it. Uploading auto-flips the kind to
 * 'image' on the server side; this component covers the OTHER half
 * (swapping back to identicon/solid, color picking, shuffling).
 */
export function ProfileAppearanceControls({
  profile,
  onAppearanceChanged,
}: ProfileAppearanceControlsProps) {
  const showToast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const avatarKind: 'identicon' | 'image' = profile?.avatar_kind ?? 'identicon';
  const bannerKind: 'solid' | 'image' = profile?.banner_kind ?? 'solid';
  const accentColor = profile?.accent_color ?? '#6366f1';
  const avatarSeed = profile?.avatar_seed ?? profile?.user_id ?? profile?.username ?? 'user';

  const apply = async (body: {
    avatar_kind?: 'identicon' | 'image';
    banner_kind?: 'solid' | 'image';
    accent_color?: string;
    shuffle_avatar_seed?: boolean;
  }) => {
    const authToken = getAuthTokenFromCookies();
    const hostPort = getHostPortFromStorage() || getHostPortFromCookies();
    if (!authToken || !hostPort) {
      showToast('Sign in again to update your appearance.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await updateProfileAppearance(hostPort, authToken, body);
      if (!response.success) {
        showToast(response.error || 'Could not update appearance.', 'error');
        return;
      }
      onAppearanceChanged?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-[var(--color-text-secondary)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Appearance</h3>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Choose between the auto-generated identicon and a custom upload
        for your avatar, and between a solid color and a custom banner image.
      </p>

      {/* Avatar mode */}
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          Avatar
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void apply({ avatar_kind: 'identicon' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              avatarKind === 'identicon'
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-hover)]'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            Identicon
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void apply({ avatar_kind: 'image' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              avatarKind === 'image'
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-hover)]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Custom image
          </button>
          {avatarKind === 'identicon' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void apply({ shuffle_avatar_seed: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
              title="Generate a different identicon"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Shuffle
            </button>
          )}
        </div>
        {avatarKind === 'identicon' && (
          <div className="flex items-center gap-3 pt-2">
            <img
              src={createIdenticonUrl(avatarSeed, { backgroundColor: accentColor })}
              alt="Identicon preview"
              className="w-14 h-14 rounded-full border border-[var(--color-border)]"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              This is your default avatar. Switch to <em>Custom image</em> to
              upload a photo, or click <em>Shuffle</em> to roll a new one.
            </p>
          </div>
        )}
      </div>

      {/* Banner mode */}
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          Banner
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void apply({ banner_kind: 'solid' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              bannerKind === 'solid'
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-hover)]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            Solid color
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void apply({ banner_kind: 'image' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              bannerKind === 'image'
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-hover)]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Custom image
          </button>
        </div>

        {bannerKind === 'solid' && (
          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-8 gap-2 max-w-md">
              {ACCENT_COLOR_PALETTE.map((color) => {
                const isSelected = color.toLowerCase() === accentColor.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void apply({ accent_color: color })}
                    aria-label={`Use ${color} as banner color`}
                    title={color}
                    className={`w-8 h-8 rounded-md border-2 transition-transform ${
                      isSelected
                        ? 'border-[var(--color-text)] scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                );
              })}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              This color also tints your identicon background, so your
              avatar and banner stay visually paired.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileAppearanceControls;
