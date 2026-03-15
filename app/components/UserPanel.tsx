import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router';
import { Mic, MicOff, Headphones, Settings, X, Volume2, ChevronDown } from 'lucide-react';

interface UserPanelProps {
  username: string;
  avatar?: string;
  status: 'online' | 'idle' | 'afk' | 'dnd' | 'offline';
  onClick?: (event: React.MouseEvent) => void;
  onDeviceSelectorClick?: () => void;
  onStatusChange?: (status: 'online' | 'idle' | 'afk' | 'dnd' | 'offline') => void;
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
  onStatusChange,
  className = "",
  voiceChannel
}: UserPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  useEffect(() => {
    if (!statusMenuOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setStatusMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [statusMenuOpen]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    if (newDeafened) {
      setIsMuted(true);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'idle': return 'Idle';
      case 'afk': return 'Away';
      case 'dnd': return 'Do Not Disturb';
      default: return 'Offline';
    }
  };

  const statusOptions: Array<{
    value: 'online' | 'idle' | 'afk' | 'dnd' | 'offline';
    label: string;
    toneClass: string;
  }> = [
    { value: 'online', label: 'Online', toneClass: 'bg-[var(--color-success)]' },
    { value: 'idle', label: 'Idle', toneClass: 'bg-[var(--color-warning)]' },
    { value: 'afk', label: 'Away', toneClass: 'bg-[var(--color-info)]' },
    { value: 'dnd', label: 'Do Not Disturb', toneClass: 'bg-[var(--color-error)]' },
    { value: 'offline', label: 'Offline', toneClass: 'bg-[var(--color-text-muted)]' },
  ];

  const handleUserInfoClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent event bubbling
    onClick?.(event);
  };

  const statusDotClass =
    status === 'online'
      ? 'pb-presence-dot pb-presence-online'
      : status === 'idle'
        ? 'pb-presence-dot pb-presence-idle'
        : status === 'afk'
          ? 'pb-presence-dot pb-presence-away'
        : status === 'dnd'
          ? 'pb-presence-dot pb-presence-dnd'
          : 'pb-presence-dot pb-presence-offline';

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
              <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 ${statusDotClass}`} />
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--color-text)]">{username}</div>
              <div className="truncate text-xs text-[var(--color-text-muted)]">{getStatusText(status)}</div>
            </div>
          </button>

          <div className="relative flex items-center gap-1">
            <button
              onClick={() => setStatusMenuOpen((prev) => !prev)}
              className="flex h-8 items-center gap-1 rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
              title="Set status"
              aria-label="Set status"
            >
              <span className={`h-2.5 w-2.5 ${statusDotClass}`} />
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {statusMenuOpen && (
              <div className="absolute bottom-11 right-0 z-30 w-48 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
                <div className="border-b border-[var(--color-border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  Set your status
                </div>
                <div className="p-1">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onStatusChange?.(option.value);
                        setStatusMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-hover)] ${status === option.value ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}
                    >
                      <span className={`h-2.5 w-2.5 pb-presence-dot ${option.toneClass}`} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            <Link
              to="/settings"
              prefetch="intent"
              className="pb-icon-btn h-8 w-8 rounded-md text-[var(--color-text-secondary)] flex items-center justify-center"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
