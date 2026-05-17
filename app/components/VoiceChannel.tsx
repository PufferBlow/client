import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, MicOff, Volume2 } from 'lucide-react';

import { VoiceParticipantContextMenu } from './VoiceParticipantContextMenu';

import {
  applyVoiceSessionAction,
  getVoiceChannelParticipants,
  getVoiceChannelStatus,
  joinVoiceChannel,
  leaveVoiceChannel,
} from '../services/channel';
import {
  createVoiceTransport,
  type VoiceParticipant,
  type VoiceTransport,
  type VoiceTransportState,
} from '../services/voiceTransport';
import { voiceCallSession, installVoiceUnloadHandler } from '../services/voiceCallSession';
import type { RTCMediaQuality } from '../services/system';
import { getAuthTokenFromCookies } from '../services/user';
import { logger } from '../utils/logger';

const voiceLogger = logger.network;

export interface VoiceSessionActions {
  toggleMute: () => Promise<void>;
  toggleDeafen: () => Promise<void>;
  leave: () => Promise<void>;
  setUserVolume: (userId: string, volume: number) => void;
  getUserVolume: (userId: string) => number;
  // Screen-share controls. startScreenShare can reject (user denies the
  // browser prompt, browser doesn't support getDisplayMedia, etc.); the
  // caller should toast on rejection. stopScreenShare is safe to call
  // when not sharing — no-ops.
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  isScreenSharing: boolean;
  // user_id -> live screen-share MediaStream. The UI binds these to
  // <video> elements. Updated whenever a remote peer starts/stops or
  // disconnects.
  remoteScreenShares: Map<string, MediaStream>;
  // The local user's screen-capture stream, for rendering a self-preview.
  // null when not sharing.
  localScreenStream: MediaStream | null;
  isMuted: boolean;
  isDeafened: boolean;
  participants: VoiceParticipant[];
}

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
  isConnected: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onToggleConnection: () => void;
  onConnectionStateChange?: (payload: {
    connected: boolean;
    channelId: string;
    channelName: string;
    participants: VoiceParticipant[];
    participantCount: number;
  }) => void;
  onVoiceSessionReady?: (session: VoiceSessionActions | null) => void;
  mediaQuality?: RTCMediaQuality | null;
  /**
   * Resolver that turns a participant's user_id into an avatar URL.
   * Mirrors the same prop on VoiceCallUI: the consumer (DashboardPage)
   * owns the user cache, this component just consumes the lookup.
   * Optional -- when omitted, the sidebar participant row falls back
   * to a letter-on-color circle.
   */
  resolveAvatarUrl?: (userId: string, username?: string) => string | undefined;
}

/** Format seconds into mm:ss or hh:mm:ss */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Live duration display for a participant joined at `connectedAt` ISO string */
function useDuration(connectedAt?: string): string {
  const [seconds, setSeconds] = useState(() => {
    if (!connectedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000));
  });

  useEffect(() => {
    if (!connectedAt) return;
    const id = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [connectedAt]);

  return formatDuration(seconds);
}

interface ParticipantRowProps {
  participant: VoiceParticipant;
  transport: VoiceTransport | null;
  /** Avatar URL for this participant. Optional -- when undefined the row
   *  falls back to a letter-on-color circle so federated/unhydrated peers
   *  still render something recognizable. Resolved by the consumer
   *  (DashboardPage) through its users cache. */
  avatarUrl?: string;
  /** Fires on right-click. The parent (VoiceChannel) owns the menu state. */
  onContextMenu?: (event: React.MouseEvent, participant: VoiceParticipant) => void;
}

const ParticipantRowImpl: React.FC<ParticipantRowProps> = ({
  participant,
  avatarUrl,
  onContextMenu,
}) => {
  const duration = useDuration(participant.connected_at);
  const displayName = participant.username || `User ${participant.user_id.slice(-4)}`;
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const showAvatarImage = !!avatarUrl && !avatarImgFailed;

  return (
    <div
      className="flex items-center gap-2 py-1 px-1 rounded hover:bg-[var(--color-hover)]/40 cursor-context-menu"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e, participant);
      }}
    >
      {/* Avatar circle. Speaking state shows as a green ring around the
          avatar; muted state dims it slightly. The image falls back to
          a colored letter circle when the resolver had no URL or the
          image failed to load. */}
      <div className="relative flex-shrink-0">
        {showAvatarImage ? (
          <img
            src={avatarUrl}
            alt={displayName}
            onError={() => setAvatarImgFailed(true)}
            className={`h-5 w-5 rounded-full object-cover transition-all ${
              participant.is_speaking
                ? 'ring-2 ring-[var(--color-success)] ring-offset-1 ring-offset-transparent'
                : ''
            } ${participant.is_muted ? 'opacity-60' : ''}`}
          />
        ) : (
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white transition-all ${
              participant.is_speaking
                ? 'bg-[var(--color-success)] ring-2 ring-[var(--color-success)]/40'
                : 'bg-[var(--color-primary)]'
            } ${participant.is_muted ? 'opacity-60' : ''}`}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <span className="text-xs text-[var(--color-text)] truncate flex-1">
        {displayName}
      </span>
      <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 font-mono">
        {duration}
      </span>
      {participant.is_muted && (
        <MicOff className="w-3 h-3 text-[var(--color-error)] flex-shrink-0" />
      )}
      {/* Volume slider moved to right-click context menu (see
          VoiceParticipantContextMenu). Keeps the sidebar row compact
          and matches the action-pattern used everywhere else. */}
    </div>
  );
};

/**
 * Memoized row: when the parent re-renders (every WS speaker_levels tick,
 * mute toggle, etc.) only rows whose participant snapshot or transport
 * identity actually changed get re-rendered. The custom equality function
 * compares the fields ParticipantRow actually reads — adding a new field
 * means updating this list.
 *
 * `onContextMenu` is intentionally NOT compared: the parent passes a new
 * function reference each render (closure over menu state). Comparing it
 * would force re-render every tick. Since the callback only uses its
 * arguments (event + participant), changing identity doesn't change
 * behavior.
 */
const ParticipantRow = React.memo(ParticipantRowImpl, (prev, next) => {
  if (prev.transport !== next.transport) return false;
  if (prev.avatarUrl !== next.avatarUrl) return false;
  const a = prev.participant;
  const b = next.participant;
  return (
    a.user_id === b.user_id &&
    a.username === b.username &&
    a.is_muted === b.is_muted &&
    a.is_deafened === b.is_deafened &&
    a.is_speaking === b.is_speaking &&
    a.connected_at === b.connected_at
  );
});
ParticipantRow.displayName = 'ParticipantRow';

export const VoiceChannel: React.FC<VoiceChannelProps> = ({
  channelId,
  channelName,
  isSelected = false,
  onSelect,
  onToggleConnection,
  onConnectionStateChange,
  onVoiceSessionReady,
  mediaQuality,
  resolveAvatarUrl,
}) => {
  const transportRef = useRef<VoiceTransport | null>(null);

  // Right-click menu state for the sidebar participant rows. Lives at
  // this level (one per VoiceChannel instance) so opening a menu on one
  // participant in this channel doesn't conflict with the global voice
  // call UI menu in the main panel.
  const [participantMenu, setParticipantMenu] = useState<{
    userId: string;
    username?: string;
    x: number;
    y: number;
  } | null>(null);

  // Stable refs for callbacks — updated every render but never trigger effects
  const onConnectionStateChangeRef = useRef(onConnectionStateChange);
  const onVoiceSessionReadyRef = useRef(onVoiceSessionReady);
  const onToggleConnectionRef = useRef(onToggleConnection);
  useEffect(() => { onConnectionStateChangeRef.current = onConnectionStateChange; });
  useEffect(() => { onVoiceSessionReadyRef.current = onVoiceSessionReady; });
  useEffect(() => { onToggleConnectionRef.current = onToggleConnection; });

  // If a call is already in progress for THIS channel (we got here via
  // remount after a navigation away+back, not a fresh dashboard load),
  // seed every piece of React state from the still-alive transport's
  // snapshot getters. This is what makes the call survive navigation:
  // the transport in the registry was kept running, and we re-attach
  // the React-side view of it as if no unmount had happened.
  const existingActive = voiceCallSession.get();
  const reusedTransport: VoiceTransport | null =
    existingActive && existingActive.channelId === channelId
      ? existingActive.transport
      : null;

  const [connectionState, setConnectionState] = useState<VoiceTransportState>(
    () => reusedTransport?.getState() ?? 'idle',
  );
  const [participants, setParticipants] = useState<VoiceParticipant[]>(
    () => reusedTransport?.getParticipants() ?? [],
  );
  const [sessionId, setSessionId] = useState<string | null>(
    () => reusedTransport?.getActiveSessionId() ?? null,
  );
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(() => reusedTransport?.getIsMuted() ?? false);
  const [isDeafened, setIsDeafened] = useState(() => reusedTransport?.getIsDeafened() ?? false);
  const [isExpanded, setIsExpanded] = useState(false);
  // Screen share state, mirrored from the transport. We use plain React
  // state for the remote streams Map (replaced on each update so the
  // dependency arrays in consumers behave) and a boolean + ref for the
  // local capture stream.
  const [isScreenSharing, setIsScreenSharing] = useState(
    () => reusedTransport?.isScreenSharing() ?? false,
  );
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(
    () => reusedTransport?.getLocalScreenStream() ?? null,
  );
  const [remoteScreenShares, setRemoteScreenShares] = useState<Map<string, MediaStream>>(
    () => reusedTransport?.getRemoteScreenStreams() ?? new Map(),
  );
  const [qualityProfile, setQualityProfile] = useState<'low' | 'balanced' | 'high'>(
    mediaQuality?.default_profile ?? 'balanced'
  );

  useEffect(() => {
    setQualityProfile(mediaQuality?.default_profile ?? 'balanced');
  }, [mediaQuality?.default_profile]);

  const isConnected = useMemo(
    () => connectionState === 'connected' || connectionState === 'reconnecting',
    [connectionState]
  );

  // Auto-expand when connected
  useEffect(() => {
    if (isConnected) setIsExpanded(true);
  }, [isConnected]);

  // Fetch current participants from the server for channels we haven't joined yet
  useEffect(() => {
    if (isConnected) return; // transport manages participants when connected
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    let cancelled = false;
    getVoiceChannelParticipants(channelId, authToken).then((res) => {
      if (cancelled || !res.success || !res.data) return;
      const connected = res.data.participants.filter((p) => p.is_connected);
      if (connected.length > 0) {
        setParticipants(
          connected.map((p) => ({
            user_id: p.user_id,
            username: p.username,
            is_muted: p.is_muted,
            is_deafened: p.is_deafened,
            is_speaking: p.is_speaking,
            connected_at: p.connected_at ?? p.joined_at,
          }))
        );
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [channelId, isConnected]);

  useEffect(() => {
    // Build the callback bundle the transport notifies on state changes.
    // Defined inline so we capture stable refs (callbacks via React's
    // ref-update pattern). Used in two places below: attached to a
    // reused transport, or passed to createVoiceTransport for a new one.
    const callbacks = {
      onStateChange: setConnectionState,
      onParticipantsChange: (nextParticipants: VoiceParticipant[]) => {
        setParticipants(nextParticipants);
        onConnectionStateChangeRef.current?.({
          connected: nextParticipants.length > 0,
          channelId,
          channelName,
          participants: nextParticipants,
          participantCount: nextParticipants.length,
        });
      },
      onError: (message: string) => setError(message),
      // Remote screen-share streams arrive here. We replace the Map
      // identity on every update so React picks up the change — mutating
      // in place would skip useMemo / useEffect dependencies downstream.
      onRemoteScreenShare: (userId: string, stream: MediaStream | null) => {
        setRemoteScreenShares((prev) => {
          const next = new Map(prev);
          if (stream) {
            next.set(userId, stream);
          } else {
            next.delete(userId);
          }
          return next;
        });
      },
    };

    // Reuse path: there's an active call registered for this exact
    // channel, which means we're remounting after a navigation away +
    // back. The transport is still alive in the registry; swap our
    // callbacks onto it instead of building a new one. State was
    // already seeded from the transport's snapshot getters via the
    // lazy useState initializers above.
    const existing = voiceCallSession.get();
    let transport: VoiceTransport;
    if (existing && existing.channelId === channelId) {
      transport = existing.transport;
      transport.setCallbacks(callbacks);
    } else {
      transport = createVoiceTransport(callbacks);
    }

    transportRef.current = transport;

    return () => {
      // Two cleanup paths:
      //
      //   1. THIS transport is the currently-active call -> leave it
      //      running, just detach our callbacks so we don't reach into
      //      unmounted React state. Re-mounting the component (route
      //      change away+back) will pick it up again via the reuse
      //      path above. This is the "voice survives navigation" win.
      //
      //   2. Otherwise this transport is dormant (a sidebar row the
      //      user never joined) -> disconnect to free the WebRTC
      //      objects, matching the original behavior. No call to drop.
      if (voiceCallSession.get()?.transport === transport) {
        transport.setCallbacks({});
      } else {
        void transport.disconnect();
      }
      transportRef.current = null;
    };
  }, [channelId, channelName]);

  const toggleMute = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport) return;
    const nextMuted = !isMuted;
    setIsMuted(transport.setMuted(nextMuted));
    const authToken = getAuthTokenFromCookies();
    if (authToken && sessionId) {
      await applyVoiceSessionAction(sessionId, authToken, 'mute_self', { value: nextMuted });
    }
  }, [isMuted, sessionId]);

  const toggleDeafen = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport) return;
    const nextDeafened = !isDeafened;
    setIsDeafened(transport.setDeafened(nextDeafened));
    const authToken = getAuthTokenFromCookies();
    if (authToken && sessionId) {
      await applyVoiceSessionAction(sessionId, authToken, 'deafen_self', { value: nextDeafened });
    }
  }, [isDeafened, sessionId]);

  const handleStartScreenShare = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport) return;
    try {
      await transport.startScreenShare();
      setLocalScreenStream(transport.getLocalScreenStream());
      setIsScreenSharing(true);
    } catch (shareError) {
      // The most common rejection is the user cancelling the picker —
      // not a real error, but the surrounding UI may want to flash a
      // brief hint. Re-throwing lets the caller distinguish (e.g.
      // ignore NotAllowedError silently, toast on others).
      const name = shareError instanceof DOMException ? shareError.name : '';
      if (name !== 'NotAllowedError' && name !== 'AbortError') {
        const message = shareError instanceof Error ? shareError.message : 'Failed to share screen';
        setError(message);
      }
      throw shareError;
    }
  }, []);

  const handleStopScreenShare = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport) return;
    await transport.stopScreenShare();
    setLocalScreenStream(null);
    setIsScreenSharing(false);
  }, []);

  const handleLeaveVoiceChannel = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport) return;
    const authToken = getAuthTokenFromCookies();
    try {
      if (authToken) {
        await leaveVoiceChannel(channelId, authToken, sessionId || undefined);
      }
      await transport.disconnect();
    } catch (leaveError) {
      const message = leaveError instanceof Error ? leaveError.message : 'Failed to leave';
      setError(message);
    } finally {
      // Clear the registry so the next unmount disposes the transport
      // normally instead of treating it as the active call. Must happen
      // here (regardless of the try/catch outcome) so a Leave that
      // partially failed still releases the registry slot.
      voiceCallSession.clear();
      setSessionId(null);
      setParticipants([]);
      setIsMuted(false);
      setIsDeafened(false);
      // Clear screen-share state — the transport disconnect path already
      // stopped tracks and fired onRemoteScreenShare(null) for each
      // remote tile, but the local state mirrors here need to reset too.
      setIsScreenSharing(false);
      setLocalScreenStream(null);
      setRemoteScreenShares(new Map());
      onConnectionStateChangeRef.current?.({
        connected: false,
        channelId,
        channelName,
        participants: [],
        participantCount: 0,
      });
      onVoiceSessionReadyRef.current?.(null);
      onToggleConnectionRef.current?.();
    }
  }, [channelId, channelName, sessionId]);

  // Emit session actions whenever relevant state changes
  useEffect(() => {
    if (!isConnected) {
      onVoiceSessionReadyRef.current?.(null);
      return;
    }
    onVoiceSessionReadyRef.current?.({
      toggleMute,
      toggleDeafen,
      leave: handleLeaveVoiceChannel,
      setUserVolume: (userId, volume) => transportRef.current?.setUserVolume(userId, volume),
      getUserVolume: (userId) => transportRef.current?.getUserVolume(userId) ?? 1,
      startScreenShare: handleStartScreenShare,
      stopScreenShare: handleStopScreenShare,
      isScreenSharing,
      remoteScreenShares,
      localScreenStream,
      isMuted,
      isDeafened,
      participants,
    });
  }, [
    isConnected,
    toggleMute,
    toggleDeafen,
    handleLeaveVoiceChannel,
    handleStartScreenShare,
    handleStopScreenShare,
    isScreenSharing,
    remoteScreenShares,
    localScreenStream,
    isMuted,
    isDeafened,
    participants,
  ]);

  const handleJoinVoiceChannel = async () => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }
    if (isConnected) return; // Already connected; user should use leave button

    setError(null);
    setIsJoining(true);
    onSelect?.();

    // Re-read transportRef after onSelect (may trigger re-render but transport effect
    // no longer depends on callbacks, so the ref stays stable)
    const transport = transportRef.current;
    if (!transport) {
      setError('Voice transport is not initialized');
      setIsJoining(false);
      return;
    }

    try {
      const response = await joinVoiceChannel(channelId, authToken, qualityProfile);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to initialize voice session');
      }
      const bootstrap = response.data;
      setSessionId(bootstrap.session_id);

      await transport.connect({
        session_id: bootstrap.session_id,
        channel_id: bootstrap.channel_id,
        join_token: bootstrap.join_token,
        signaling_url: bootstrap.signaling_url,
        ice_servers: bootstrap.ice_servers,
        quality_profile: bootstrap.quality_profile,
        media_quality: bootstrap.media_quality ?? mediaQuality ?? undefined,
      });

      // Register as the active call so the transport survives a future
      // remount (route change to /settings, /control-panel, etc.). The
      // unload handler is a one-time install that disconnects the
      // transport if the page actually closes -- those two together are
      // what enforce "only exit voice when exiting the client".
      voiceCallSession.set({ transport, channelId, channelName });
      installVoiceUnloadHandler();

      const statusResponse = await getVoiceChannelStatus(channelId, authToken, bootstrap.session_id);
      if (statusResponse.success && statusResponse.data?.participants) {
        setParticipants(statusResponse.data.participants);
      }

      onConnectionStateChangeRef.current?.({
        connected: true,
        channelId,
        channelName,
        participants: statusResponse.data?.participants ?? [],
        participantCount: statusResponse.data?.participant_count ?? bootstrap.participant_count,
      });
      onToggleConnectionRef.current?.();
      voiceLogger.info(`Voice session connected for channel ${channelId}`);
    } catch (joinError) {
      const message = joinError instanceof Error ? joinError.message : 'Failed to join voice channel';
      setError(message);
      voiceLogger.error(`Voice join failed for channel ${channelId}: ${message}`);
    } finally {
      setIsJoining(false);
    }
  };

  const handleRowClick = () => {
    if (isConnected) {
      onSelect?.();
    } else {
      void handleJoinVoiceChannel();
    }
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Main channel row */}
      <div
        className={`group flex items-center rounded px-2 py-1.5 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-[var(--color-active)] text-[var(--color-text)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
        }`}
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRowClick();
          }
        }}
        aria-label={`Voice channel ${channelName}`}
      >
        {/* Connected indicator */}
        {isConnected && (
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] mr-1 flex-shrink-0 animate-pulse" />
        )}

        {/* Speaker icon */}
        <Volume2 className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />

        {/* Channel name */}
        <span className="flex-1 text-sm break-words overflow-wrap-anywhere">
          {channelName}
        </span>

        {/* Participant count */}
        {participants.length > 0 && (
          <span className="text-[10px] text-[var(--color-text-muted)] mr-1">
            {participants.length}
          </span>
        )}

        {/* Joining spinner */}
        {isJoining && (
          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1" />
        )}

        {/* Expand/collapse button. Bigger hit target than the old chevron
            (16px icon inside a 24px padded button) so it's easier to grab
            without precision-hovering, and always-visible at reduced
            opacity so users discover it without having to find the row. */}
        <button
          className="ml-1 p-1 rounded text-[var(--color-text-muted)] opacity-70 hover:opacity-100 hover:bg-[var(--color-hover)]/40 transition-opacity focus:opacity-100"
          onClick={handleExpandToggle}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-2 mb-1 text-xs text-[var(--color-error)] border border-[var(--color-error)]/30 bg-[var(--color-surface)] px-2 py-1 rounded">
          {error}
        </div>
      )}

      {/* Expanded section */}
      {isExpanded && (
        <div className="ml-5 mr-1 mb-1 space-y-0.5">
          {/* Quality selector (pre-join) */}
          {!isConnected && mediaQuality && (
            <div className="flex items-center gap-2 px-1 py-1">
              <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Quality</span>
              <select
                value={qualityProfile}
                onChange={(e) => setQualityProfile(e.target.value as 'low' | 'balanced' | 'high')}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-1 py-0.5 text-xs text-[var(--color-text)]"
              >
                <option value="low">Low</option>
                <option value="balanced">Balanced</option>
                <option value="high">High</option>
              </select>
            </div>
          )}

          {/* Participants */}
          {participants.length > 0 ? (
            participants.map((p) => (
              <ParticipantRow
                key={p.user_id}
                participant={p}
                transport={transportRef.current}
                avatarUrl={resolveAvatarUrl?.(p.user_id, p.username)}
                onContextMenu={(e, participant) => {
                  setParticipantMenu({
                    userId: participant.user_id,
                    username: participant.username,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
              />
            ))
          ) : (
            <div className="px-1 py-0.5 text-[10px] text-[var(--color-text-muted)]">
              {isConnected ? 'Just you' : 'No one here yet'}
            </div>
          )}

          {/* Sidebar in-call controls fully removed. Mute / Deafen /
              Leave all live in the VoiceCallUI control bar in the
              main panel — keeping any of them here meant two
              authoritative places for the same action. The channel
              row itself plus the UserPanel still provide separate
              disconnect affordances when those are needed. */}
        </div>
      )}

      {/* Right-click menu for sidebar participant rows. Driven by the
          per-row onContextMenu handlers above; reads/writes volume
          directly through the transport so the menu doesn't keep its
          own state across opens. */}
      <VoiceParticipantContextMenu
        isOpen={participantMenu !== null}
        position={{ x: participantMenu?.x ?? 0, y: participantMenu?.y ?? 0 }}
        userId={participantMenu?.userId ?? ''}
        username={participantMenu?.username}
        // Note: we don't know `isSelf` cheaply here (the sidebar row's
        // participant data is just `{user_id, username, flags...}`), so
        // we leave the volume slider visible. Adjusting your own volume
        // is a no-op at the transport level (you can't lower your own
        // playback), so this is harmless.
        isSelf={false}
        initialVolume={
          participantMenu
            ? transportRef.current?.getUserVolume(participantMenu.userId) ?? 1
            : undefined
        }
        onVolumeChange={(v) => {
          if (participantMenu) {
            transportRef.current?.setUserVolume(participantMenu.userId, v);
          }
        }}
        onClose={() => setParticipantMenu(null)}
      />
    </div>
  );
};

export default VoiceChannel;
