import { useEffect, useRef } from "react";

interface MessageContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onReact?: () => void;
  onCopyLink?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canPin?: boolean;
}

export function MessageContextMenu({
  isOpen,
  position,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onCopyLink,
  canEdit = false,
  canDelete = false,
  canPin = false
}: MessageContextMenuProps) {
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
    { label: 'Reply', icon: '↩️', action: onReply, show: !!onReply },
    { label: 'Edit', icon: '✏️', action: onEdit, show: canEdit && !!onEdit },
    { label: 'Delete', icon: '🗑️', action: onDelete, show: canDelete && !!onDelete, danger: true },
    { label: 'Pin Message', icon: '📌', action: onPin, show: canPin && !!onPin },
    { label: 'Add Reaction', icon: '😀', action: onReact, show: !!onReact },
    { label: 'Copy Message Link', icon: '🔗', action: onCopyLink, show: !!onCopyLink },
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
