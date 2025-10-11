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
  onReport?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canPin?: boolean;
  canReport?: boolean;
  customCopyLinkLabel?: string;
  customReportLabel?: string;
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
  onReport,
  canEdit = false,
  canDelete = false,
  canPin = false,
  canReport = true,
  customCopyLinkLabel,
  customReportLabel
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

  // Calculate adjusted position to stay within viewport bounds
  const getAdjustedPosition = () => {
    const menuWidth = 192; // w-48 = 12rem = 192px
    const menuHeight = 200; // Approximate height
    const gap = 8;

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Check horizontal bounds
    if (position.x + menuWidth / 2 > window.innerWidth) {
      // Menu would extend beyond right edge, position from right
      adjustedX = window.innerWidth - menuWidth - gap;
    } else if (position.x - menuWidth / 2 < 0) {
      // Menu would extend beyond left edge, position from left
      adjustedX = gap;
    } else {
      // Center on click point
      adjustedX = position.x - menuWidth / 2;
    }

    // Check vertical bounds - prefer above, fallback below
    if (position.y - menuHeight - gap < 0) {
      // Not enough space above, position below
      adjustedY = position.y + gap;
    } else {
      // Position above
      adjustedY = position.y - menuHeight - gap;
    }

    // Ensure menu doesn't go off bottom
    if (adjustedY + menuHeight > window.innerHeight) {
      adjustedY = window.innerHeight - menuHeight - gap;
    }

    return { x: adjustedX, y: adjustedY };
  };

  const adjustedPosition = getAdjustedPosition();

  const menuItems = [
    {
      label: 'Reply',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      ),
      action: onReply,
      show: !!onReply
    },
    {
      label: 'Edit',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      action: onEdit,
      show: canEdit && !!onEdit
    },
    {
      label: 'Delete',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      action: onDelete,
      show: canDelete && !!onDelete,
      danger: true
    },
    {
      label: 'Pin Message',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
      action: onPin,
      show: canPin && !!onPin
    },
    {
      label: 'Add Reaction',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H13m-3 3.5a.5.5 0 11-1 0 .5.5 0 011 0zM16 7a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      action: onReact,
      show: !!onReact
    },
    {
      label: customCopyLinkLabel || 'Copy Message Link',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      action: onCopyLink,
      show: !!onCopyLink
    },
    {
      label: customReportLabel || 'Report',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      action: onReport,
      show: canReport && !!onReport,
      danger: true
    },
  ].filter(item => item.show);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px] z-40" onClick={onClose} />

      <div
        ref={menuRef}
        className="fixed z-50 bg-gray-900/95 border border-gray-600/50 rounded-xl shadow-2xl py-2 min-w-48 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent backdrop-blur-md transform animate-in slide-in-from-top-2 fade-in duration-200"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              item.action?.();
              onClose();
            }}
            className={`w-full px-4 py-2.5 text-left text-sm flex items-center hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-purple-600/20 hover:text-blue-300 transition-all duration-300 group relative border-l-2 border-transparent hover:border-l-blue-500/50 ${
              item.danger
                ? 'text-red-400 hover:bg-gradient-to-r hover:from-red-600/20 hover:to-red-700/20 hover:text-red-300 hover:border-l-red-500/50'
                : 'text-gray-300 hover:text-white'
            }`}
            title={item.label}
          >
            <span className={`mr-3 text-base transition-all duration-300 ${item.danger ? 'group-hover:text-red-300 group-hover:scale-110' : 'group-hover:text-blue-300 group-hover:scale-110'}`}>
              {item.icon}
            </span>
            <span className="truncate font-medium">{item.label}</span>
            {item.danger && (
              <div className="w-1 h-1 bg-red-500/60 rounded-full ml-auto mt-1 animate-pulse" />
            )}
          </button>
        ))}
      </div>
    </>
  );
}
