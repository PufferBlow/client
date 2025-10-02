import React from 'react';

interface UserPanelProps {
  username: string;
  avatar?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  onClick?: () => void;
  onSettingsClick?: () => void;
  className?: string;
}

export function UserPanel({
  username,
  avatar,
  status,
  onClick,
  onSettingsClick,
  className = ""
}: UserPanelProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'idle': return 'Idle';
      case 'dnd': return 'Do Not Disturb';
      default: return 'Offline';
    }
  };

  return (
    <div
      className={`flex items-center space-x-3 px-3 py-2 bg-gray-800 rounded-lg shadow-lg border border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer ${className}`}
      onClick={onClick}
      title="User Settings"
    >
      <div className="relative flex-shrink-0">
        {avatar ? (
          <img
            src={avatar}
            alt={username}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold capitalize">{username.charAt(0)}</span>
          </div>
        )}
        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${getStatusColor(status)}`}></div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">{username}</div>
        <div className="text-gray-400 text-xs capitalize truncate">{status.replace('_', ' ')}</div>
      </div>

      <div className="flex items-center space-x-1 flex-shrink-0">
        {/* Microphone Button */}
        <button
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 transition-colors group"
          title="Microphone: Muted"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-4 h-4 text-red-500 group-hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12l4 4m0 0l-4 4m4-4H12" />
          </svg>
        </button>

        {/* Headphones Button */}
        <button
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 transition-colors group"
          title="Headphones"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 0V3m9 9V3m-9 9h9m-9 9V3" />
          </svg>
        </button>

        {/* Settings Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSettingsClick?.();
          }}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 transition-colors group"
          title="User Settings"
        >
          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
