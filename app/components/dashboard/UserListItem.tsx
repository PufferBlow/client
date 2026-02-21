import React from "react";
import { useUserProfile } from "../../services/user";

export interface UserListItemProps {
  userId: string;
  username: string;
  status: string;
  isOwner: boolean;
  isAdmin: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function UserListItem({
  userId,
  username,
  status,
  isOwner,
  isAdmin,
  onClick
}: UserListItemProps) {
  const { data: userProfile } = useUserProfile(userId);
  const avatarUrl = userProfile?.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}&backgroundColor=5865f2`;

  return (
    <div
      className="flex items-center space-x-3 px-2 py-1.5 rounded-md hover:bg-[var(--color-hover)] cursor-pointer transition-colors border border-transparent"
      onClick={onClick}
    >
      <div className="relative">
        <img
          src={avatarUrl}
          alt={username}
          className="w-8 h-8 rounded-full border border-[var(--color-border)]"
        />
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[var(--color-surface)] ${status === "online" ? "bg-green-400" :
            status === "idle" ? "bg-yellow-400" :
              status === "dnd" ? "bg-red-400" :
                "bg-gray-500"
          }`}></div>
      </div>
      <div className="flex items-center space-x-2 flex-1">
        <span className="text-[var(--color-text)] text-sm font-medium select-text truncate">{username}</span>
        {isOwner && (
          <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">OWNER</span>
        )}
        {isAdmin && !isOwner && (
          <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
        )}
      </div>
    </div>
  );
}

export default UserListItem;
