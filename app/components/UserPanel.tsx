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

  const statusDotClass =
    status === 'online'
      ? 'bg-[var(--color-success)]'
      : status === 'idle'
        ? 'bg-[var(--color-warning)]'
        : status === 'dnd'
          ? 'bg-[var(--color-error)]'
          : 'bg-[var(--color-text-muted)]';

  return (
    <div ref={panelRef} className={`w-full ${className}`}>
      {voiceChannel && (
        <div className="px-2 pt-2">
          <div className="flex items-center justify-between rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-2 py-2">
            <div className="min-w-0 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]">
                <Volume2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[var(--color-text)]">{voiceChannel.channelName}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {voiceChannel.participants} participant{voiceChannel.participants !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <button
              onClick={voiceChannel.onDisconnect}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-error)]/40 bg-[var(--color-error)]/20 text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/30"
              title="Leave Voice Channel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className={`px-2 ${voiceChannel ? 'pb-2 pt-1' : 'py-2'}`}>
        <div className="flex h-14 w-full items-center gap-2 rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-2">
          <button
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[var(--color-hover)]"
            onClick={handleUserInfoClick}
            title="Open User Profile"
          >
            <div className="relative flex-shrink-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt={username}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-[var(--color-on-primary)] capitalize">
                  {username.charAt(0)}
                </div>
              )}
              <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-[var(--color-surface)] ${statusDotClass}`} />
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--color-text)]">{username}</div>
              <div className="truncate text-xs text-[var(--color-text-muted)]">{getStatusText(status)}</div>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              className={`pb-icon-btn h-8 w-8 rounded-md ${isMuted ? 'border border-[var(--color-error)]/40 bg-[var(--color-error)]/20 text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}`}
              title={`Microphone: ${isMuted ? 'Muted' : 'Unmuted'}`}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <button
              onClick={toggleDeafen}
              className={`relative pb-icon-btn h-8 w-8 rounded-md ${isDeafened ? 'border border-[var(--color-error)]/40 bg-[var(--color-error)]/20 text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}`}
              title={`Speakers: ${isDeafened ? 'Muted' : 'Unmuted'}`}
            >
              <Headphones className="h-4 w-4" />
              {isDeafened && <X className="absolute -right-0.5 -top-0.5 h-3 w-3" />}
            </button>

            <button
              onClick={() => onDeviceSelectorClick?.()}
              className="pb-icon-btn h-8 w-8 rounded-md text-[var(--color-text-secondary)]"
              title="Select Audio Devices"
            >
              <Volume2 className="h-4 w-4" />
            </button>

            <button
              onClick={() => onSettingsClick?.()}
              className="pb-icon-btn h-8 w-8 rounded-md text-[var(--color-text-secondary)]"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
