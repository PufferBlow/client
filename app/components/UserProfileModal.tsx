import { useState } from "react";

interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  bio?: string;
  joinedAt: string;
  roles: string[];
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  currentUserId: string;
  position?: { x: number; y: number };
  onSendMessage?: (userId: string) => void;
  onAddFriend?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  user,
  currentUserId,
  position,
  onSendMessage,
  onAddFriend,
  onBlockUser
}: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'user-info' | 'mutual-servers'>('user-info');

  if (!isOpen || !user) return null;

  const isCurrentUser = user.id === currentUserId;
  const statusColors = {
    online: 'bg-green-500',
    idle: 'bg-yellow-500',
    dnd: 'bg-red-500',
    offline: 'bg-gray-500'
  };

  const statusText = {
    online: 'Online',
    idle: 'Idle',
    dnd: 'Do Not Disturb',
    offline: 'Offline'
  };

  const modalStyle = position
    ? { left: `${position.x}px`, top: `${position.y}px` }
    : { bottom: '1rem', left: '0.5rem' };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-gray-800 rounded-lg w-80 max-h-[70vh] overflow-hidden shadow-2xl border border-gray-700"
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        {/* Header with gradient and close button */}
        <div className="relative">
          <div className="h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-lg"></div>
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-white hover:bg-black hover:bg-opacity-20 rounded-full p-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Arrow pointing to the user */}
          {position && (
            <div className="absolute -left-2 top-6 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-800"></div>
          )}
        </div>

        {/* Avatar and Basic Info */}
        <div className="px-6 pb-4">
          <div className="flex items-end -mt-8 mb-4">
            <div className="relative">
              <div className="w-20 h-20 bg-gray-600 rounded-full border-4 border-gray-800 flex items-center justify-center">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-full h-full rounded-full"
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${statusColors[user.status]} rounded-full border-4 border-gray-800`}></div>
            </div>
            <div className="ml-4 flex-1">
              <h2 className="text-xl font-bold text-white">{user.username}</h2>
            </div>
          </div>

          {/* Status */}
          <div className="mb-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 ${statusColors[user.status]} rounded-full mr-2`}></div>
              <span className="text-gray-300 text-sm">{statusText[user.status]}</span>
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">About Me</h3>
              <p className="text-gray-100 text-sm">{user.bio}</p>
            </div>
          )}



          {/* Joined Date */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Joined</h3>
            <p className="text-gray-100 text-sm">
              {new Date(user.joinedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          {/* Action Buttons */}
          {!isCurrentUser && (
            <div className="flex space-x-2">
              {onSendMessage && (
                <button
                  onClick={() => onSendMessage(user.id)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Send Message
                </button>
              )}
              {onAddFriend && (
                <button
                  onClick={() => onAddFriend(user.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Add Friend
                </button>
              )}
              {onBlockUser && (
                <button
                  onClick={() => onBlockUser(user.id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Block
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
