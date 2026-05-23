import { useState, type ReactNode } from "react";
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
  /** Channels the viewer has explicitly muted via the per-channel mute
   *  affordance. Used to suppress the unread dot (muted = "I asked not
   *  to be pinged here, don't dot me") and to render a muted glyph on
   *  the channel row. Membership is the only thing that matters; the
   *  source of truth is `mutedChannelIds` in the dashboard data hook,
   *  seeded from `GET /notifications/preferences` on mount. */
  mutedChannelIds: Set<string>;
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
  /** Avatar resolver for voice-channel participant rows. Passed through
   *  to each VoiceChannel; mirrors the same prop on VoiceCallUI so the
   *  sidebar and the main call view show the same faces. */
  resolveAvatarUrl?: (userId: string, username?: string) => string | undefined;
}

/**
 * Channel sidebar body. Three branches:
 *
 *   1. channelsError — shows the design's celebratory error card with a
 *      retry button.
 *   2. channels.length === 0 — empty state with a hint to ask an admin.
 *   3. otherwise — three collapsible groups: Text, Voice, Private.
 *
 * Channels show a binary unread dot (no count), an unsent-draft pen
 * icon, and a lock glyph for private channels (in the private group
 * the lock is redundant; we keep it on the row itself for consistency).
 * Voice channels delegate their entire row to <VoiceChannel/> which
 * owns connect/disconnect lifecycle; this component only translates
 * VoiceChannel's onConnectionStateChange into an update on
 * `currentVoiceChannel` so the user panel + chat header see the
 * active call.
 *
 * Group collapse state lives in component state (not localStorage) so
 * collapsed groups reopen on app restart -- intentional default since
 * a user who collapsed a group probably wants to see new content
 * surface next session, not stay hidden.
 */
type GroupKey = "text" | "voice" | "private";

function GroupHeader({
  label,
  count,
  isCollapsed,
  onToggle,
}: {
  label: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group/grp flex w-full items-center px-2 mb-1 text-left transition-colors hover:text-[var(--color-text)]"
      aria-expanded={!isCollapsed}
    >
      <svg
        className={`w-3 h-3 mr-1 text-[var(--color-text-muted)] transition-transform duration-150 ${
          isCollapsed ? "-rotate-90" : ""
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
      <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide group-hover/grp:text-[var(--color-text-secondary)]">
        {label}
      </span>
      <span className="ml-auto text-[10px] font-mono text-[var(--color-text-muted)]/60">
        {count}
      </span>
    </button>
  );
}

function ChannelGroup({
  groupKey,
  label,
  channels,
  collapsed,
  onToggle,
  renderRow,
}: {
  groupKey: GroupKey;
  label: string;
  channels: Channel[];
  collapsed: Record<GroupKey, boolean>;
  onToggle: (k: GroupKey) => void;
  renderRow: (channel: Channel) => ReactNode;
}) {
  if (channels.length === 0) return null;
  const isCollapsed = collapsed[groupKey];
  return (
    <div className="mb-2">
      <GroupHeader
        label={label}
        count={channels.length}
        isCollapsed={isCollapsed}
        onToggle={() => onToggle(groupKey)}
      />
      {!isCollapsed && <div className="space-y-0.5">{channels.map(renderRow)}</div>}
    </div>
  );
}
export function ChannelList({
  channels,
  channelsError,
  selectedChannel,
  getMessageDraft,
  unreadCountsByChannel,
  mutedChannelIds,
  onChannelSelect,
  onChannelContextMenu,
  currentVoiceChannel,
  setCurrentVoiceChannel,
  onVoiceSessionReady,
  rtcMediaQuality,
  resolveAvatarUrl,
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

  // Three groups: private is its own bucket (regardless of channel_type),
  // then text vs voice for the rest. A channel that's both `is_private`
  // AND voice goes into Private -- the "private" classification is more
  // informative for sidebar wayfinding than its medium.
  const privateChannels = channels.filter((c) => c.is_private);
  const textChannels = channels.filter((c) => !c.is_private && c.channel_type !== "voice");
  const voiceChannels = channels.filter((c) => !c.is_private && c.channel_type === "voice");

  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({
    text: false,
    voice: false,
    private: false,
  });
  const toggleGroup = (k: GroupKey) =>
    setCollapsed((prev) => ({ ...prev, [k]: !prev[k] }));

  const renderTextRow = (channel: Channel) => {
    const isMuted = mutedChannelIds.has(channel.channel_id);
    return (
      <TextChannelRow
        key={channel.channel_id}
        channel={channel}
        isSelected={selectedChannel?.channel_id === channel.channel_id}
        // Muted channels never show an unread dot — the whole point of
        // muting is "I don't want a visual ping from this channel."
        // The server still records that messages went unread (so the
        // unread-count snapshot is accurate for other surfaces), the
        // sidebar just chooses not to surface it here.
        hasUnread={!isMuted && (unreadCountsByChannel[channel.channel_id] || 0) > 0}
        hasDraft={getMessageDraft(channel.channel_id).trim().length > 0}
        isMuted={isMuted}
        onSelect={onChannelSelect}
        onContextMenu={onChannelContextMenu}
      />
    );
  };
  const renderVoiceRow = (channel: Channel) => (
    <VoiceChannel
      key={channel.channel_id}
      channelId={channel.channel_id}
      channelName={channel.channel_name}
      isConnected={currentVoiceChannel?.channelId === channel.channel_id}
      isSelected={selectedChannel?.channel_id === channel.channel_id}
      onSelect={() => onChannelSelect(channel)}
      mediaQuality={rtcMediaQuality}
      onToggleConnection={() => {}}
      onConnectionStateChange={({ connected, channelId, channelName, participants }) => {
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
      resolveAvatarUrl={resolveAvatarUrl}
    />
  );

  // Render order is Private → Text → Voice. Private rooms are the
  // smallest, most attention-grabbing bucket — putting them at the
  // top means a member who's in a sensitive DM-style room never has
  // to scroll past the public buckets to find it. Text and Voice
  // follow because they're the broad-audience surfaces; their order
  // between themselves matches the previous layout.
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-2 py-4">
        <ChannelGroup
          groupKey="private"
          label="Private Channels"
          channels={privateChannels}
          collapsed={collapsed}
          onToggle={toggleGroup}
          renderRow={(channel) =>
            channel.channel_type === "voice"
              ? renderVoiceRow(channel)
              : renderTextRow(channel)
          }
        />
        <ChannelGroup
          groupKey="text"
          label="Text Channels"
          channels={textChannels}
          collapsed={collapsed}
          onToggle={toggleGroup}
          renderRow={renderTextRow}
        />
        <ChannelGroup
          groupKey="voice"
          label="Voice Channels"
          channels={voiceChannels}
          collapsed={collapsed}
          onToggle={toggleGroup}
          renderRow={renderVoiceRow}
        />
      </div>
    </div>
  );
}

function TextChannelRow({
  channel,
  isSelected,
  hasUnread,
  hasDraft,
  isMuted,
  onSelect,
  onContextMenu,
}: {
  channel: Channel;
  isSelected: boolean;
  hasUnread: boolean;
  hasDraft: boolean;
  isMuted: boolean;
  onSelect: (channel: Channel) => void;
  onContextMenu: (event: React.MouseEvent, channel: Channel) => void;
}) {
  return (
    <div
      className={`flex items-center px-2 py-1 rounded-md hover:bg-[var(--color-hover)] cursor-pointer ${
        isSelected ? "bg-[var(--color-active)] text-[var(--color-text)]" : ""
      } ${isMuted && !isSelected ? "opacity-60" : ""}`}
      onClick={() => onSelect(channel)}
      onContextMenu={(e) => onContextMenu(e, channel)}
    >
      <span className="text-[var(--color-text-secondary)] mr-2">#</span>
      <span
        className={`text-sm break-words overflow-wrap-anywhere flex-1 ${
          hasUnread && !isSelected
            ? "text-[var(--color-text)] font-medium"
            : "text-[var(--color-text-secondary)]"
        }`}
      >
        {channel.channel_name}
      </span>
      <div className="flex items-center ml-auto">
        {/* Binary unread indicator -- a small primary-color dot, no
            count. Hidden when the channel is currently selected (no
            reason to mark unread on the channel the user is reading),
            hidden when the channel is muted (the whole point of mute
            is "don't visually ping me"), and cleared on
            `handleChannelSelect` in DashboardPage so it doesn't
            linger after the user opens the channel. */}
        {hasUnread && !isSelected && (
          <span
            className="mr-1 h-2 w-2 rounded-full bg-[var(--color-primary)]"
            aria-label="Unread messages"
          />
        )}
        {/* Muted glyph (speaker with diagonal slash). Visible on every
            muted channel row so the viewer can scan the sidebar and
            see "right, I muted these." Subtle — dimmed text color,
            same size as the lock glyph for private channels. */}
        {isMuted && (
          <svg
            className="w-3.5 h-3.5 text-[var(--color-text-muted)] ml-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-label="Muted"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9M3 3l18 18"
            />
          </svg>
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
  // Calm, control-panel-style error card. The previous version had
  // a tilted red gradient slab with a `animate-ping` halo and a
  // gradient retry button -- those drew far more attention than the
  // surrounding chrome and stuck out as "alert UI" against the
  // rest of the design. This card uses the same `pb-status-danger`
  // tone tokens the other failure surfaces (Logs error,
  // BlockedIPs error, Control-panel unavailable) already rely on,
  // so the channel sidebar fits into the rest of the app's
  // visual language.
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border"
        style={{
          background: "color-mix(in srgb, var(--color-error) 12%, transparent)",
          borderColor: "color-mix(in srgb, var(--color-error) 35%, transparent)",
          color: "var(--color-error)",
        }}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h3 className="mt-4 text-sm font-semibold text-[var(--color-text)]">
        Channels unavailable
      </h3>
      <p className="mt-1 max-w-xs text-center text-xs text-[var(--color-text-secondary)]">
        {error}
      </p>

      <button
        onClick={() => window.location.reload()}
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Retry
      </button>
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
