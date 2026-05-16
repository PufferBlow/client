import { VoiceChannel, type VoiceSessionActions } from "../VoiceChannel";
import type { Channel } from "../../models";
import type { RTCMediaQuality } from "../../services/system";

interface CurrentVoiceChannel {
  channelId: string;
  channelName: string;
  participants: number;
}

interface ChannelListProps {
  channels: Channel[];
  channelsError: string | null;
  selectedChannel: Channel | null;
  /** Per-channel drafts; truthy when the user has unsent text. */
  getMessageDraft: (channelId: string) => string;
  unreadCountsByChannel: Record<string, number>;
  onChannelSelect: (channel: Channel) => void;
  onChannelContextMenu: (event: React.MouseEvent, channel: Channel) => void;

  /** Voice-call orchestration props. Passed through to each VoiceChannel
   *  row so the dashboard can keep its currentVoiceChannel + voice
   *  session-action state in one place. */
  currentVoiceChannel: CurrentVoiceChannel | null;
  setCurrentVoiceChannel: (
    next: CurrentVoiceChannel | null | ((prev: CurrentVoiceChannel | null) => CurrentVoiceChannel | null),
  ) => void;
  onVoiceSessionReady: (session: VoiceSessionActions | null) => void;
  rtcMediaQuality: RTCMediaQuality | null;
}

/**
 * Channel sidebar body. Three branches:
 *
 *   1. channelsError — shows the design's celebratory error card with a
 *      retry button.
 *   2. channels.length === 0 — empty state with a hint to ask an admin.
 *   3. otherwise — text channels grouped first, then voice channels with
 *      live connection state.
 *
 * Text channels show their unread badge, an unsent-draft indicator, and a
 * lock glyph for private channels. Voice channels delegate their entire
 * row to <VoiceChannel/> which owns connect/disconnect lifecycle; this
 * component only translates VoiceChannel's onConnectionStateChange into
 * an update on `currentVoiceChannel` so the user panel + chat header
 * see the active call.
 */
export function ChannelList({
  channels,
  channelsError,
  selectedChannel,
  getMessageDraft,
  unreadCountsByChannel,
  onChannelSelect,
  onChannelContextMenu,
  currentVoiceChannel,
  setCurrentVoiceChannel,
  onVoiceSessionReady,
  rtcMediaQuality,
}: ChannelListProps) {
  if (channelsError) {
    return (
      <div className="flex-1 overflow-y-auto">
        <ChannelsErrorState error={channelsError} />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <ChannelsEmptyState />
      </div>
    );
  }

  const textChannels = channels.filter((c) => c.channel_type !== "voice");
  const voiceChannels = channels.filter((c) => c.channel_type === "voice");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-2 py-4">
        <div className="flex items-center px-2 mb-1">
          <svg
            className="w-3 h-3 text-[var(--color-text-secondary)] mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
          <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            Channels
          </span>
        </div>

        {textChannels.length > 0 && (
          <div className="space-y-0.5">
            {textChannels.map((channel) => (
              <TextChannelRow
                key={channel.channel_id}
                channel={channel}
                isSelected={selectedChannel?.channel_id === channel.channel_id}
                unreadCount={unreadCountsByChannel[channel.channel_id] || 0}
                hasDraft={getMessageDraft(channel.channel_id).trim().length > 0}
                onSelect={onChannelSelect}
                onContextMenu={onChannelContextMenu}
              />
            ))}
          </div>
        )}

        {voiceChannels.length > 0 && (
          <div className="mt-3">
            <div className="px-2 mb-1">
              <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Voice Channels
              </span>
            </div>
            <div className="space-y-0.5">
              {voiceChannels.map((channel) => (
                <VoiceChannel
                  key={channel.channel_id}
                  channelId={channel.channel_id}
                  channelName={channel.channel_name}
                  isConnected={currentVoiceChannel?.channelId === channel.channel_id}
                  isSelected={selectedChannel?.channel_id === channel.channel_id}
                  onSelect={() => onChannelSelect(channel)}
                  mediaQuality={rtcMediaQuality}
                  onToggleConnection={() => {}}
                  onConnectionStateChange={({
                    connected,
                    channelId,
                    channelName,
                    participants,
                  }) => {
                    if (connected) {
                      setCurrentVoiceChannel({
                        channelId,
                        channelName,
                        participants: participants.length,
                      });
                      return;
                    }
                    setCurrentVoiceChannel((prev) =>
                      prev?.channelId === channelId ? null : prev,
                    );
                  }}
                  onVoiceSessionReady={onVoiceSessionReady}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TextChannelRow({
  channel,
  isSelected,
  unreadCount,
  hasDraft,
  onSelect,
  onContextMenu,
}: {
  channel: Channel;
  isSelected: boolean;
  unreadCount: number;
  hasDraft: boolean;
  onSelect: (channel: Channel) => void;
  onContextMenu: (event: React.MouseEvent, channel: Channel) => void;
}) {
  return (
    <div
      className={`flex items-center px-2 py-1 rounded-md hover:bg-[var(--color-hover)] cursor-pointer ${
        isSelected ? "bg-[var(--color-active)] text-[var(--color-text)]" : ""
      }`}
      onClick={() => onSelect(channel)}
      onContextMenu={(e) => onContextMenu(e, channel)}
    >
      <span className="text-[var(--color-text-secondary)] mr-2">#</span>
      <span className="text-[var(--color-text-secondary)] text-sm break-words overflow-wrap-anywhere flex-1">
        {channel.channel_name}
      </span>
      <div className="flex items-center ml-auto">
        {unreadCount > 0 && (
          <span className="mr-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-on-primary)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {hasDraft && (
          <div className="flex items-center mr-1" title="Has unsent message">
            <svg
              className="w-3 h-3 text-[var(--color-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </div>
        )}
        {channel.is_private && (
          <svg
            className="w-4 h-4 text-[var(--color-text-muted)] ml-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

function ChannelsErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 px-6 py-12">
      <div className="relative">
        <div className="absolute inset-0 scale-150 rounded-full bg-gradient-to-br from-[var(--color-error)]/20 to-[var(--color-warning)]/20 blur-xl"></div>
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-error)] to-[color:color-mix(in_srgb,var(--color-error)_78%,var(--color-background))] shadow-2xl transition-transform duration-300 transform rotate-3 hover:rotate-0">
          <svg
            className="w-10 h-10 text-[var(--color-on-error)] drop-shadow-lg"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.6-.833-2.37 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-[var(--color-warning)] animate-ping"></div>
          <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-[var(--color-warning)]"></div>
        </div>
      </div>
      <div className="text-center max-w-md mb-8">
        <h3 className="text-xl font-bold text-[var(--color-text)] mb-3 drop-shadow-sm">
          Channels Unavailable
        </h3>
        <p className="text-[var(--color-text-secondary)] leading-relaxed mb-4">{error}</p>
      </div>
      <div className="flex items-center justify-center">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary)] hover:to-[var(--color-primary-hover)] text-[var(--color-on-primary)] font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>Retry</span>
        </button>
      </div>
    </div>
  );
}

function ChannelsEmptyState() {
  return (
    <div className="px-4 py-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
        <svg
          className="w-8 h-8 text-[var(--color-text-secondary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
      <p className="text-lg font-medium mb-2 text-[var(--color-text-secondary)]">
        No channels available
      </p>
      <p className="text-[var(--color-text-muted)]">
        Ask a server admin to create some channels to get started.
      </p>
    </div>
  );
}
