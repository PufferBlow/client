import { useEffect, useRef } from "react";

interface UserContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onViewProfile?: () => void;
  onSendMessage?: () => void;
  onAddFriend?: () => void;
  onMention?: () => void;
  onBlock?: () => void;
  onReport?: () => void;
  canBlock?: boolean;
  canReport?: boolean;
  isFriend?: boolean;
  isBlocked?: boolean;
}

export function UserContextMenu({
  isOpen,
  position,
  onClose,
  onViewProfile,
  onSendMessage,
  onAddFriend,
  onMention,
  onBlock,
  onReport,
  canBlock = true,
  canReport = true,
  isFriend = false,
  isBlocked = false
}: UserContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    { label: 'View Profile', icon: '👤', action: onViewProfile, show: !!onViewProfile },
    { label: 'Send Message', icon: '💬', action: onSendMessage, show: !!onSendMessage },
    { label: isFriend ? 'Remove Friend' : 'Add Friend', icon: isFriend ? '👥' : '➕', action: onAddFriend, show: !!onAddFriend },
    { label: 'Mention', icon: '@', action: onMention, show: !!onMention },
    { label: 'Block', icon: '🚫', action: onBlock, show: canBlock && !!onBlock && !isBlocked, danger: true },
    { label: 'Unblock', icon: '✅', action: onBlock, show: canBlock && !!onBlock && isBlocked },
    { label: 'Report', icon: '⚠️', action: onReport, show: canReport && !!onReport, danger: true },
  ].filter(item => item.show);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 min-w-48"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)', // Position above the click point
      }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.action?.();
            onClose();
          }}
          className={`w-full px-3 py-2 text-left text-sm flex items-center hover:bg-gray-700 transition-colors ${
            item.danger ? 'text-red-400 hover:bg-red-900 hover:bg-opacity-20' : 'text-gray-300'
          }`}
        >
          <span className="mr-3 text-base">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
