import React from "react";
import {
  createFallbackAvatarUrl,
  getResolvedRoleNames,
  useUserProfile,
} from "../../services/user";

export interface UserListItemProps {
  userId: string;
  username: string;
  status: string;
  roleNames?: string[];
  onClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function UserListItem({
  userId,
  username,
  status,
  roleNames = [],
  onClick,
  onContextMenu,
}: UserListItemProps) {
  const { data: userProfile } = useUserProfile(userId);
  const avatarUrl = userProfile?.avatar_url || createFallbackAvatarUrl(username);
  const effectiveRoleNames = roleNames.length > 0 ? roleNames : getResolvedRoleNames(userProfile);

  return (
    <div
      className="flex items-center space-x-3 px-2 py-1.5 rounded-md hover:bg-[var(--color-hover)] cursor-pointer transition-colors border border-transparent"
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="relative">
        <img
          src={avatarUrl}
          alt={username}
          className="w-8 h-8 rounded-full border border-[var(--color-border)]"
        />
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[var(--color-surface)] ${status === "online" ? "bg-[var(--color-success)]" :
            status === "idle" ? "bg-[var(--color-warning)]" :
              status === "dnd" ? "bg-[var(--color-error)]" :
                "bg-[var(--color-text-muted)]"
          }`}></div>
      </div>
      <div className="flex items-center space-x-2 flex-1">
        <span className="text-[var(--color-text)] text-sm font-medium select-text truncate">{username}</span>
        {effectiveRoleNames.slice(0, 2).map((roleName) => (
          <span
            key={roleName}
            className="bg-[var(--color-surface-tertiary)] text-[var(--color-text)] text-xs px-1.5 py-0.5 rounded font-medium"
          >
            {roleName.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

export default UserListItem;
