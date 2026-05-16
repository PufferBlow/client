/**
 * UserProfileModal — compact popover used by MembersTab and RecentActivity to
 * show a quick read of a user (avatar, username, bio, joined date) without
 * navigating away.
 */
import { useUserProfile } from "../../services/user";
import { ControlPanelAvatar } from "./ControlPanelAvatar";

export function UserProfileModal({
  isOpen,
  onClose,
  user,
  currentUserId,
  position,
  triggerRect
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  currentUserId: string;
  position?: { x: number; y: number };
  triggerRect?: DOMRect | null;
}) {
  const profileUserId = user?.id || user?.user_id || "";
  const { data: fetchedUser } = useUserProfile(profileUserId);

  if (!isOpen || !user) return null;

  // Merge the seed (from the caller) with the freshly fetched profile. Only
  // fields the API actually returned populate; we deliberately do NOT invent
  // a `joinedAt` of "today" when the field is missing — `null` lets the
  // template hide that row entirely instead of flashing a lie.
  const displayUser = fetchedUser
    ? {
        ...user,
        ...fetchedUser,
        id: fetchedUser.id || fetchedUser.user_id || user.id,
        username: fetchedUser.username || user.username,
        bio: fetchedUser.bio || user.bio || null,
        joinedAt:
          fetchedUser.joinedAt ||
          fetchedUser.created_at ||
          user.joinedAt ||
          null,
        avatar_url: fetchedUser.avatar_url ?? user.avatar_url ?? null,
        avatar: fetchedUser.avatar ?? user.avatar ?? null,
      }
    : {
        ...user,
        bio: user.bio || null,
        joinedAt: user.joinedAt || null,
      };

  const joinedDate = (() => {
    if (!displayUser.joinedAt) return null;
    const d = new Date(displayUser.joinedAt);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
  })();

  return (
    <div
      className="fixed z-50 bg-[var(--color-surface)] rounded-lg shadow-lg border border-[var(--color-border)] py-2 w-64"
      style={{
        left: position?.x || '50%',
        top: position?.y || '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)'
      }}
    >
      <div className="px-4 py-2">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-3">
          <ControlPanelAvatar
            username={displayUser.username}
            avatarUrl={displayUser.avatar_url || displayUser.avatar}
            className="h-8 w-8 rounded-full border border-[var(--color-border)]"
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[var(--color-text)] truncate">{displayUser.username}</div>
            {displayUser.bio && (
              <div className="text-xs text-[var(--color-text-secondary)] truncate">{displayUser.bio}</div>
            )}
          </div>
        </div>

        {/* Joined date — only when the server actually returned it. */}
        {joinedDate && (
          <div className="text-xs text-[var(--color-text-muted)] pb-2">
            Joined {joinedDate}
          </div>
        )}
        {/*
         * Note: "Start Conversation" and "Add Friend" buttons used to live
         * here but were stubs — no DM or friendship service exists. Removed
         * rather than shown disabled, because for moderators the modal is
         * informational only and there's no useful action to surface yet.
         */}
      </div>
    </div>
  );
}
