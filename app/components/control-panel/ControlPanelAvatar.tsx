/**
 * ControlPanelAvatar — small avatar component used throughout the control
 * panel. Falls back to initials when no avatar URL is present or the image
 * fails to load.
 */
import { useState } from "react";
import { convertToFullStorageUrl } from "../../services/apiClient";

export const getControlPanelAvatarLabel = (username: string) =>
  username
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '?';

export function ControlPanelAvatar({
  username,
  avatarUrl,
  className,
}: {
  username: string;
  avatarUrl?: string | null;
  className: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedAvatarUrl = avatarUrl ? convertToFullStorageUrl(avatarUrl) : null;

  if (resolvedAvatarUrl && !imageFailed) {
    return (
      <img
        src={resolvedAvatarUrl}
        alt={username}
        onError={() => setImageFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-[var(--color-surface-secondary)] text-xs font-semibold text-[var(--color-text)]`}
      aria-label={`${username} avatar placeholder`}
    >
      {getControlPanelAvatarLabel(username)}
    </div>
  );
}
