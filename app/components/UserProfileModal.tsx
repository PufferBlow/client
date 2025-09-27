import { useState, useEffect, useRef } from "react";

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
  triggerRect?: DOMRect | null;
  onSendMessage?: (userId: string) => void;
  onAddFriend?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
  onReport?: (userId: string) => void;
  onCopyUserId?: (userId: string) => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  user,
  currentUserId,
  position,
  triggerRect,
  onSendMessage,
  onAddFriend,
  onBlockUser,
  onReport,
  onCopyUserId
}: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'user-info' | 'mutual-servers'>('user-info');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  if (!isOpen || !user) return null;

  // Additional safety check - ensure user has required properties
  if (!user.id || !user.username || !user.discriminator) {
    console.error('UserProfileModal: Invalid user data provided', user);
    return null;
  }

  const isCurrentUser = user.id === currentUserId;
  const statusColors = {
    online: 'bg-green-500',
    idle: 'bg-gray-500',
    dnd: 'bg-red-500',
    offline: 'bg-red-500'
  };

  const statusText = {
    online: 'ONLINE',
    idle: 'INACTIVE',
    dnd: 'DO NOT DISTURB',
    offline: 'OFFLINE'
  };

  const modalStyle = position
    ? { left: `${position.x}px`, top: `${position.y}px` }
    : { bottom: '1rem', left: '0.5rem' };

  // Determine arrow direction based on modal position relative to trigger
  const getArrowStyle = () => {
    if (!position || !triggerRect) return '';

    const modalCenterX = position.x + 160; // Modal width is 320px (w-80), so center is at 160px
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;

    if (modalCenterX > triggerCenterX) {
      // Modal is to the right of trigger, arrow points left
      return 'absolute -left-2 top-6 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-800';
    } else {
      // Modal is to the left of trigger, arrow points right
      return 'absolute -right-2 top-6 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-800';
    }
  };

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
          {!isCurrentUser && (
            <div className="absolute top-2 right-2">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-white hover:bg-black hover:bg-opacity-20 rounded-full p-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {showMenu && (
                <div ref={menuRef} className="absolute top-8 right-0 bg-gray-700 border border-gray-600 rounded-md shadow-lg py-1 min-w-48 z-10">
                  {onCopyUserId && (
                    <button
                      onClick={() => {
                        onCopyUserId(user.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-600 transition-colors"
                    >
                      Copy user ID
                    </button>
                  )}
                  {onSendMessage && (
                    <button
                      onClick={() => {
                        onSendMessage(user.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-600 transition-colors"
                    >
                      Message
                    </button>
                  )}
                  {onReport && (
                    <button
                      onClick={() => {
                        onReport(user.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-900 hover:bg-opacity-20 transition-colors"
                    >
                      Report
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Arrow pointing to the user */}
          {position && (
            <div className={getArrowStyle()}></div>
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
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white">{user.username}</h2>
                {user.roles.includes('Admin') && (
                  <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-medium">ADMIN</span>
                )}
                {user.roles.includes('Moderator') && !user.roles.includes('Admin') && (
                  <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded font-medium">MOD</span>
                )}
              </div>
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
