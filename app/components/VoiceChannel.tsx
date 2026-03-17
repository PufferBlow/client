import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';

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
}

const ParticipantRow: React.FC<ParticipantRowProps> = ({ participant, transport }) => {
  const duration = useDuration(participant.connected_at);
  const [volume, setVolume] = useState(() => transport?.getUserVolume(participant.user_id) ?? 1);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    transport?.setUserVolume(participant.user_id, v);
  };

  return (
    <div className="flex flex-col gap-1 py-1 px-1">
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Speaking / muted indicator */}
        <div
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            participant.is_speaking
              ? 'bg-[var(--color-success)] animate-pulse'
              : participant.is_muted
                ? 'bg-[var(--color-error)]'
                : 'bg-[var(--color-text-muted)]'
          }`}
        />
        <span className="text-xs text-[var(--color-text)] truncate flex-1">
          {participant.username || `User ${participant.user_id.slice(-4)}`}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 font-mono">
          {duration}
        </span>
        {participant.is_muted && (
          <MicOff className="w-3 h-3 text-[var(--color-error)] flex-shrink-0" />
        )}
      </div>
      {/* Volume slider */}
      <div className="flex items-center gap-1.5 pl-3">
        <VolumeX className="w-2.5 h-2.5 text-[var(--color-text-muted)] flex-shrink-0" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={handleVolumeChange}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 h-1 accent-[var(--color-primary)] cursor-pointer"
          title={`Volume: ${Math.round(volume * 100)}%`}
        />
        <Volume2 className="w-2.5 h-2.5 text-[var(--color-text-muted)] flex-shrink-0" />
      </div>
    </div>
  );
};

export const VoiceChannel: React.FC<VoiceChannelProps> = ({
  channelId,
  channelName,
  isSelected = false,
  onSelect,
  onToggleConnection,
  onConnectionStateChange,
  onVoiceSessionReady,
  mediaQuality,
}) => {
  const transportRef = useRef<VoiceTransport | null>(null);

  // Stable refs for callbacks — updated every render but never trigger effects
  const onConnectionStateChangeRef = useRef(onConnectionStateChange);
  const onVoiceSessionReadyRef = useRef(onVoiceSessionReady);
  const onToggleConnectionRef = useRef(onToggleConnection);
  useEffect(() => { onConnectionStateChangeRef.current = onConnectionStateChange; });
  useEffect(() => { onVoiceSessionReadyRef.current = onVoiceSessionReady; });
  useEffect(() => { onToggleConnectionRef.current = onToggleConnection; });

  const [connectionState, setConnectionState] = useState<VoiceTransportState>('idle');
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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
    const transport = createVoiceTransport({
      onStateChange: setConnectionState,
      onParticipantsChange: (nextParticipants) => {
        setParticipants(nextParticipants);
        onConnectionStateChangeRef.current?.({
          connected: nextParticipants.length > 0,
          channelId,
          channelName,
          participants: nextParticipants,
          participantCount: nextParticipants.length,
        });
      },
      onError: (message) => setError(message),
    });

    transportRef.current = transport;

    return () => {
      void transport.disconnect();
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
      setSessionId(null);
      setParticipants([]);
      setIsMuted(false);
      setIsDeafened(false);
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
      isMuted,
      isDeafened,
      participants,
    });
  }, [isConnected, toggleMute, toggleDeafen, handleLeaveVoiceChannel, isMuted, isDeafened, participants]);

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

        {/* Expand/collapse button */}
        <button
          className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
          onClick={handleExpandToggle}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
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
              />
            ))
          ) : (
            <div className="px-1 py-0.5 text-[10px] text-[var(--color-text-muted)]">
              {isConnected ? 'Just you' : 'No one here yet'}
            </div>
          )}

          {/* Controls when connected */}
          {isConnected && (
            <div className="flex items-center gap-1 pt-1 px-1">
              <button
                onClick={(e) => { e.stopPropagation(); void toggleMute(); }}
                className={`flex items-center justify-center w-6 h-6 rounded transition-colors border border-[var(--color-border)] ${
                  isMuted
                    ? 'bg-[var(--color-error)] text-[var(--color-on-error)]'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); void toggleDeafen(); }}
                className={`flex items-center justify-center w-6 h-6 rounded transition-colors border border-[var(--color-border)] ${
                  isDeafened
                    ? 'bg-[var(--color-error)] text-[var(--color-on-error)]'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
                title={isDeafened ? 'Undeafen' : 'Deafen'}
              >
                <VolumeX className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); void handleLeaveVoiceChannel(); }}
                className="flex items-center justify-center w-6 h-6 rounded bg-[var(--color-error)]/80 text-[var(--color-on-error)] hover:bg-[var(--color-error)] transition-colors border border-[var(--color-border)]"
                title="Leave voice channel"
              >
                <PhoneOff className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceChannel;
