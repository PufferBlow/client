import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, VolumeX, Volume2, PhoneOff } from 'lucide-react';

import {
  applyVoiceSessionAction,
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

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
  isConnected: boolean;
  onToggleConnection: () => void;
  onConnectionStateChange?: (payload: {
    connected: boolean;
    channelId: string;
    channelName: string;
    participants: number;
  }) => void;
  mediaQuality?: RTCMediaQuality | null;
}

export const VoiceChannel: React.FC<VoiceChannelProps> = ({
  channelId,
  channelName,
  onToggleConnection,
  onConnectionStateChange,
  mediaQuality,
}) => {
  const transportRef = useRef<VoiceTransport | null>(null);

  const [connectionState, setConnectionState] = useState<VoiceTransportState>('idle');
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
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

  useEffect(() => {
    const transport = createVoiceTransport({
      onStateChange: setConnectionState,
      onParticipantsChange: (nextParticipants) => {
        setParticipants(nextParticipants);
        onConnectionStateChange?.({
          connected: nextParticipants.length > 0,
          channelId,
          channelName,
          participants: nextParticipants.length,
        });
      },
      onError: (message) => setError(message),
    });

    transportRef.current = transport;

    return () => {
      void transport.disconnect();
      transportRef.current = null;
    };
  }, [channelId, channelName, onConnectionStateChange]);

  const handleJoinVoiceChannel = async () => {
    const transport = transportRef.current;
    if (!transport) {
      setError('Voice transport is not initialized');
      return;
    }

    const authToken = getAuthTokenFromCookies();
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }

    if (isConnected) {
      await handleLeaveVoiceChannel();
      return;
    }

    setError(null);
    setIsJoining(true);

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

      const statusResponse = await getVoiceChannelStatus(
        channelId,
        authToken,
        bootstrap.session_id
      );
      if (statusResponse.success && statusResponse.data?.participants) {
        setParticipants(statusResponse.data.participants);
      }

      onConnectionStateChange?.({
        connected: true,
        channelId,
        channelName,
        participants: statusResponse.data?.participant_count ?? bootstrap.participant_count,
      });
      onToggleConnection();

      voiceLogger.info(`Voice session connected for channel ${channelId}`);
    } catch (joinError) {
      const message =
        joinError instanceof Error ? joinError.message : 'Failed to join voice channel';
      setError(message);
      voiceLogger.error(`Voice join failed for channel ${channelId}: ${message}`);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveVoiceChannel = async () => {
    const transport = transportRef.current;
    if (!transport) return;

    const authToken = getAuthTokenFromCookies();

    try {
      if (authToken) {
        await leaveVoiceChannel(channelId, authToken, sessionId || undefined);
      }
      await transport.disconnect();
    } catch (leaveError) {
      const message =
        leaveError instanceof Error ? leaveError.message : 'Failed to leave voice channel';
      setError(message);
    } finally {
      setSessionId(null);
      setParticipants([]);
      setIsMuted(false);
      setIsDeafened(false);
      onConnectionStateChange?.({
        connected: false,
        channelId,
        channelName,
        participants: 0,
      });
      onToggleConnection();
    }
  };

  const toggleMute = async () => {
    const transport = transportRef.current;
    if (!transport) return;

    const nextMuted = !isMuted;
    setIsMuted(transport.setMuted(nextMuted));

    const authToken = getAuthTokenFromCookies();
    if (authToken && sessionId) {
      await applyVoiceSessionAction(sessionId, authToken, 'mute_self', {
        value: nextMuted,
      });
    }
  };

  const toggleDeafen = async () => {
    const transport = transportRef.current;
    if (!transport) return;

    const nextDeafened = !isDeafened;
    setIsDeafened(transport.setDeafened(nextDeafened));

    const authToken = getAuthTokenFromCookies();
    if (authToken && sessionId) {
      await applyVoiceSessionAction(sessionId, authToken, 'deafen_self', {
        value: nextDeafened,
      });
    }
  };

  return (
    <div
      className={`rounded-lg border border-border p-3 space-y-3 transition-all duration-200 ${
        isConnected ? 'bg-[var(--color-surface-secondary)]' : 'bg-[var(--color-surface-tertiary)]'
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'
            }`}
          />
          <span className="text-sm font-medium text-[var(--color-text)]">{channelName}</span>
        </div>
        {isConnected && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-[var(--color-error)] border border-[var(--color-error)]/40 bg-[var(--color-surface)] p-2 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={handleJoinVoiceChannel}
          disabled={isJoining}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 transition-all border border-[var(--color-border)] ${
            isConnected
              ? 'bg-[var(--color-error)]/85 text-[var(--color-on-error)] hover:bg-[var(--color-error)]'
              : 'bg-[var(--color-success)]/85 text-[var(--color-on-success)] hover:bg-[var(--color-success)]'
          } ${isJoining ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {isJoining ? (
            <>
              <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
              <span>Joining...</span>
            </>
          ) : isConnected ? (
            <>
              <PhoneOff className="w-4 h-4" />
              <span>Leave</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Join Voice</span>
            </>
          )}
        </button>
      </div>

      {!isConnected && mediaQuality && (
        <div className="space-y-2 rounded-lg border border-border bg-[var(--color-surface)] p-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Quality
            </label>
            <select
              value={qualityProfile}
              onChange={(event) => setQualityProfile(event.target.value as 'low' | 'balanced' | 'high')}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-2 py-1 text-xs text-[var(--color-text)]"
            >
              <option value="low">Low</option>
              <option value="balanced">Balanced</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-secondary)]">
            <div>
              Audio: {mediaQuality.audio.profiles[qualityProfile].bitrate_kbps} kbps
            </div>
            <div>
              Video: {mediaQuality.video.profiles[qualityProfile].width}x{mediaQuality.video.profiles[qualityProfile].height} @{mediaQuality.video.profiles[qualityProfile].fps}fps
            </div>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={toggleMute}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border border-[var(--color-border)] ${
              isMuted
                ? 'bg-[var(--color-error)] text-[var(--color-on-error)]'
                : 'bg-[var(--color-surface-secondary)] text-[var(--color-text)]'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleDeafen}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border border-[var(--color-border)] ${
              isDeafened
                ? 'bg-[var(--color-error)] text-[var(--color-on-error)]'
                : 'bg-[var(--color-surface-secondary)] text-[var(--color-text)]'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            <VolumeX className="w-4 h-4" />
          </button>
        </div>
      )}

      {isConnected && participants.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
            Participants
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {participants.map((participant) => (
              <div key={participant.user_id} className="flex items-center space-x-2 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    participant.is_speaking
                      ? 'bg-[var(--color-success)] animate-pulse'
                      : participant.is_muted
                        ? 'bg-[var(--color-error)]'
                        : 'bg-[var(--color-text-muted)]'
                  }`}
                />
                <span className="text-[var(--color-text)] truncate flex-1">
                  {participant.username || `User ${participant.user_id.slice(-4)}`}
                </span>
                {participant.is_muted ? (
                  <MicOff className="w-3 h-3 text-[var(--color-error)]" />
                ) : (
                  <Mic className="w-3 h-3 text-[var(--color-text-muted)]" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceChannel;
