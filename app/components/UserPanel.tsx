import React, { useState, useRef } from 'react';
import { useToast } from '../components/Toast';
import { Mic, MicOff, Headphones, Settings, X, Volume2 } from 'lucide-react';

interface UserPanelProps {
  username: string;
  avatar?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  onClick?: (event: React.MouseEvent) => void;
  onDeviceSelectorClick?: () => void;
  onSettingsClick?: () => void;
  className?: string;
  voiceChannel?: {
    channelName: string;
    participants: number;
    onDisconnect: () => void;
  };
}

export function UserPanel({
  username,
  avatar,
  status,
  onClick,
  onDeviceSelectorClick,
  onSettingsClick,
  className = "",
  voiceChannel
}: UserPanelProps) {
  const showToast = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    showToast(isMuted ? 'Microphone unmuted' : 'Microphone muted', 'success');
  };

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    if (newDeafened) {
      setIsMuted(true);
    }
    showToast(newDeafened ? 'Speakers/headphones muted' : 'Speakers/headphones unmuted', 'success');
  };

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

  const handleUserInfoClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent event bubbling
    onClick?.(event);
  };

  return (
    <div className={`relative rounded-2xl shadow-lg shadow-black/50 bg-gradient-to-r from-slate-900/90 to-slate-800/90 backdrop-blur-sm border border-white/20 hover:border-white/30 transition-all duration-300 hover:shadow-xl hover:shadow-black/60 ${className}`}>
      {/* Voice Channel Indicator */}
      {voiceChannel && (
        <div className="px-4 pt-4">
          <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30 rounded-lg p-3 relative">
            {/* Voice Indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <Volume2 className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{voiceChannel.channelName}</div>
                  <div className="text-red-400 text-xs">
                    {voiceChannel.participants} participant{voiceChannel.participants !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Disconnect Button */}
              <button
                onClick={voiceChannel.onDisconnect}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-red-600 hover:bg-red-700 transition-colors duration-200 group"
                title="Leave Voice Channel"
              >
                <X className="w-5 h-5 text-white group-hover:text-red-100 transition-colors duration-200" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center px-4 py-3">
        {/* Clickable User Info Area */}
        <div
          className="flex items-center space-x-4 flex-1 min-w-0 cursor-pointer hover:bg-[--color-hover] rounded-xl p-3 -m-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          onClick={handleUserInfoClick}
          title="Open User Profile"
        >
          <div className="relative flex-shrink-0 group">
            {avatar ? (
              <div className="relative">
                <img
                  src={avatar}
                  alt={username}
                  className="w-10 h-10 rounded-full ring-2 ring-[--color-border] group-hover:ring-[--color-primary] transition-all duration-300 shadow-lg shadow-[--color-shadow]"
                />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[--color-surface] ${getStatusColor(status)} ring-1 ring-[--color-surface] shadow-sm animate-pulse`}></div>
              </div>
            ) : (
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-[--color-primary] to-[--color-accent] rounded-full flex items-center justify-center ring-2 ring-[--color-border] group-hover:ring-[--color-primary] transition-all duration-300 shadow-lg shadow-[--color-shadow]">
                  <span className="text-white text-sm font-bold capitalize">{username.charAt(0)}</span>
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[--color-surface] ${getStatusColor(status)} ring-1 ring-[--color-surface] shadow-sm animate-pulse`}></div>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-bold truncate group-hover:text-blue-300 transition-colors duration-200 drop-shadow-sm">{username}</div>
            <div className="text-white/90 text-xs capitalize truncate group-hover:text-white transition-colors duration-200">{status.replace('_', ' ')}</div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center space-x-4 flex-shrink-0 ml-6">
          {/* Microphone Button */}
          <button
            onClick={toggleMute}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 group ${
              isMuted
                ? 'hover:bg-red-500/20 ring-1 ring-red-500/30'
                : 'hover:bg-[--color-hover] hover:shadow-lg hover:shadow-[--color-primary]/20'
            }`}
            title={`Microphone: ${isMuted ? 'Muted' : 'Unmuted'}`}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5 text-red-500 group-hover:text-red-400 transition-colors duration-200" />
            ) : (
              <Mic className="w-5 h-5 text-[--color-info] group-hover:text-[--color-info]-hover transition-colors duration-200" />
            )}
          </button>

          {/* Deafen Button */}
          <button
            onClick={toggleDeafen}
            className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 group ${
              isDeafened
                ? 'hover:bg-red-500/20 ring-1 ring-red-500/30'
                : 'hover:bg-[--color-hover] hover:shadow-lg hover:shadow-[--color-primary]/20'
            }`}
            title={`Speakers: ${isDeafened ? 'Muted' : 'Unmuted'}`}
          >
            {isDeafened && (
              <div className="absolute -inset-1 rounded-full ring-2 ring-red-500/50 animate-pulse"></div>
            )}
            <div className="relative">
              <Headphones className={`w-5 h-5 transition-colors duration-200 ${
                isDeafened
                  ? 'text-red-500 group-hover:text-red-400'
                  : 'text-[--color-text-secondary] group-hover:text-[--color-text]'
              }`} />
            </div>
            {isDeafened && (
              <X className="absolute top-0 right-0 w-3 h-3 text-red-500 group-hover:text-red-400" />
            )}
          </button>

          {/* Audio Settings Button */}
          <button
            onClick={() => onDeviceSelectorClick?.()}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[--color-hover] hover:shadow-lg hover:shadow-[--color-primary]/20 transition-all duration-300 hover:scale-110 active:scale-95 group"
            title="Select Audio Devices"
          >
            <Settings className="w-5 h-5 text-[--color-text-secondary] group-hover:text-[--color-text] transition-colors duration-200" />
          </button>

            {/* Settings Button */}
            <button
              onClick={() => onSettingsClick?.()}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[--color-hover] hover:shadow-lg hover:shadow-[--color-primary]/20 transition-all duration-300 hover:scale-110 active:scale-95 group"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-[--color-text-secondary] group-hover:text-[--color-text] transition-colors duration-200" />
            </button>
        </div>
      </div>
    </div>
  );
}
