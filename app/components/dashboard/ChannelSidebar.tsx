import React, { useState, useEffect } from 'react';
import { VoiceChannel } from '../VoiceChannel';
import { ChannelCreationModal } from '../ChannelCreationModal';
import type { Channel } from '../../models';
import type { RTCMediaQuality } from '../../services/system';

/**
 * Props for the ChannelSidebar component
 */
export interface ChannelSidebarProps {
  /**
   * List of available channels
   */
  channels: Channel[];

  /**
   * Currently selected channel
   */
  selectedChannel: Channel | null;

  /**
   * Loading state for channels
   */
  channelsLoading?: boolean;

  /**
   * Error state for channels
   */
  channelsError?: string | null;

  /**
   * Current voice channel information
   */
  currentVoiceChannel?: {
    channelId: string;
    channelName: string;
    participants: number;
  } | null;

  /**
   * Current user information for permissions
   */
  currentUser?: {
    is_owner?: boolean;
    is_admin?: boolean;
    roles?: string[];
    resolved_privileges?: string[];
  } | null;

  /**
   * Callback when a channel is selected
   */
  onChannelSelect: (channel: Channel) => void;

  /**
   * Callback when channel creation modal should open
   */
  onOpenChannelModal: () => void;

  /**
   * Callback when a channel is right-clicked
   */
  onChannelContextMenu?: (event: React.MouseEvent, channel: Channel) => void;

  /**
   * Callback for voice channel connection toggle
   */
  onVoiceChannelToggle?: (channelId: string) => void;

  mediaQuality?: RTCMediaQuality | null;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ChannelSidebar component - displays server channels and handles navigation.
 *
 * This component shows text and voice channels, handles channel selection,
 * and provides channel management functionality.
 *
 * @example
 * ```tsx
 * <ChannelSidebar
 *   channels={channels}
 *   selectedChannel={selectedChannel}
 *   onChannelSelect={handleChannelSelect}
 *   onOpenChannelModal={() => setChannelModalOpen(true)}
 *   currentUser={currentUser}
 * />
 * ```
 */
export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  channels,
  selectedChannel,
  channelsLoading = false,
  channelsError,
  currentVoiceChannel,
  currentUser,
  onChannelSelect,
  onOpenChannelModal,
  onChannelContextMenu,
  onVoiceChannelToggle,
  mediaQuality,
  className = '',
}) => {
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);

  // Separate text and voice channels
  const textChannels = channels.filter(channel => channel.channel_type !== 'voice');
  const voiceChannels = channels.filter(channel => channel.channel_type === 'voice');
  const currentUserPrivileges = currentUser?.resolved_privileges || [];
  const canManageChannels =
    currentUser?.is_owner ||
    currentUser?.is_admin ||
    currentUserPrivileges.includes('create_channels') ||
    currentUserPrivileges.includes('manage_channel_users');

  const handleChannelClick = (channel: Channel) => {
    onChannelSelect(channel);
  };

  const handleChannelContextMenu = (event: React.MouseEvent, channel: Channel) => {
    event.preventDefault();
    if (canManageChannels) {
      onChannelContextMenu?.(event, channel);
    }
  };

  const handleCreateChannel = async (channelData: { name: string; type: 'text' | 'voice'; description?: string; isPrivate?: boolean }) => {
    // This will be handled by the parent component
    console.log('Creating channel:', channelData);
    setChannelCreationModalOpen(false);
    // Call parent's onOpenChannelModal or handle creation directly
    onOpenChannelModal();
  };

  if (channelsLoading) {
    return (
      <div className={`w-72 lg:w-80 min-w-[16rem] max-w-[22rem] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col overflow-hidden backdrop-blur-sm animate-pulse ${className}`}>
        <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)]">
          <div className="h-4 w-32 rounded bg-[var(--color-surface-tertiary)]"></div>
          <div className="h-8 w-8 rounded bg-[var(--color-surface-tertiary)]"></div>
        </div>
        <div className="flex-1 p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-[var(--color-surface-tertiary)]"></div>
          ))}
        </div>
      </div>
    );
  }

  if (channelsError) {
    return (
      <div className={`w-72 lg:w-80 min-w-[16rem] max-w-[22rem] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col overflow-hidden backdrop-blur-sm ${className}`}>
        <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)]">
          <div className="h-4 w-32 rounded bg-[var(--color-surface-tertiary)]"></div>
          <div className="h-8 w-8 rounded bg-[var(--color-surface-tertiary)]"></div>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-center text-[var(--color-error)]">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Failed to load channels</h3>
            <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{channelsError}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`w-72 lg:w-80 min-w-[16rem] max-w-[22rem] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col overflow-hidden backdrop-blur-sm ${className}`}>
        {/* Server Header */}
        <div className="relative">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-base truncate text-[var(--color-text)]">
                  Channels
                </h2>
                <p className="text-xs truncate text-[var(--color-text-secondary)]">
                  {channels.length} channels
                </p>
              </div>

              {/* Channel Creation Button */}
              {canManageChannels && (
                <button
                  onClick={() => setChannelCreationModalOpen(true)}
                  className="pb-icon-btn group"
                  title="Create channel"
                  aria-label="Create channel"
                >
                  <svg className="w-4 h-4 text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          {channels.length === 0 ? (
            <div className="p-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-tertiary)]">
                <svg className="h-8 w-8 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="mb-2 text-lg font-medium text-[var(--color-text-secondary)]">No channels available</p>
              <p className="text-sm text-[var(--color-text-muted)]">Ask a server admin to create some channels.</p>
            </div>
          ) : (
            <div className="px-2 py-4">
              {/* Text Channels */}
              {textChannels.length > 0 && (
                <>
                  <div className="flex items-center px-2 mb-1">
                    <svg className="mr-1 h-3 w-3 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                      Text Channels
                    </span>
                  </div>

                  <div className="space-y-0.5 mb-4">
                    {textChannels.map(channel => (
                      <div
                        key={channel.channel_id}
                        className={`group flex cursor-pointer items-center rounded px-2 py-1.5 transition-colors ${
                          selectedChannel?.channel_id === channel.channel_id
                            ? 'bg-[var(--color-active)] text-[var(--color-text)]'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                        }`}
                        onClick={() => handleChannelClick(channel)}
                        onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleChannelClick(channel);
                          }
                        }}
                        aria-label={`Select channel ${channel.channel_name}`}
                      >
                        <span className="mr-2">#</span>
                        <span className="flex-1 break-words text-sm overflow-wrap-anywhere">
                          {channel.channel_name}
                        </span>
                        <div className="flex items-center ml-auto">
                          {channel.is_private && (
                            <svg
                              className="w-4 h-4 ml-1 text-[var(--color-text-muted)]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-label="Private channel"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Voice Channels */}
              {voiceChannels.length > 0 && (
                <>
                  <div className="flex items-center px-2 mb-1">
                    <svg className="mr-1 h-3 w-3 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                      Voice Channels
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {voiceChannels.map(channel => (
                      <VoiceChannel
                        key={channel.channel_id}
                        channelId={channel.channel_id}
                        channelName={channel.channel_name}
                        isConnected={currentVoiceChannel?.channelId === channel.channel_id}
                        mediaQuality={mediaQuality}
                        onToggleConnection={() => onVoiceChannelToggle?.(channel.channel_id)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Channel Creation Modal */}
      <ChannelCreationModal
        isOpen={channelCreationModalOpen}
        onClose={() => setChannelCreationModalOpen(false)}
        onCreateChannel={handleCreateChannel}
      />
    </>
  );
};

export default ChannelSidebar;
