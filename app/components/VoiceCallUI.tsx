import React, { useState } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import type { VoiceSessionActions } from './VoiceChannel';
import type { VoiceParticipant } from '../services/voiceTransport';

interface VoiceCallUIProps {
  channelName: string;
  session: VoiceSessionActions;
  currentUserId?: string;
  currentUsername?: string;
}

interface ParticipantCardProps {
  participant: VoiceParticipant;
  isSelf: boolean;
  session: VoiceSessionActions;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({ participant, isSelf, session }) => {
  const displayName = participant.username || `User ${participant.user_id.slice(-4)}`;
  const [localVolume, setLocalVolume] = useState(() =>
    isSelf ? 1 : session.getUserVolume(participant.user_id)
  );

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setLocalVolume(v);
    session.setUserVolume(participant.user_id, v);
  };

  return (
    <div
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all min-w-[90px] max-w-[120px] ${
        participant.is_speaking
          ? 'border-[var(--color-success)] bg-[var(--color-success)]/8 shadow-[0_0_0_2px_rgba(0,200,100,0.2)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-secondary)]'
      }`}
    >
      {/* Avatar circle */}
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white transition-colors ${
          participant.is_speaking
            ? 'bg-[var(--color-success)]'
            : participant.is_muted
              ? 'bg-[var(--color-surface-tertiary)]'
              : 'bg-[var(--color-primary)]'
        }`}
      >
        {displayName.charAt(0).toUpperCase()}
      </div>

      {/* Name + self tag */}
      <span className="text-xs font-medium text-[var(--color-text)] truncate w-full text-center">
        {displayName}
        {isSelf && <span className="text-[var(--color-text-muted)] ml-1">(you)</span>}
      </span>

      {/* Status icons row */}
      <div className="flex items-center gap-1">
        {participant.is_muted && <MicOff className="w-3 h-3 text-[var(--color-error)]" />}
        {participant.is_deafened && <VolumeX className="w-3 h-3 text-[var(--color-error)]" />}
        {participant.is_speaking && (
          <span className="text-[9px] text-[var(--color-success)] font-semibold uppercase tracking-wide">
            Speaking
          </span>
        )}
      </div>

      {/* Volume slider (not for self) */}
      {!isSelf && (
        <div className="flex items-center gap-1 w-full">
          <VolumeX className="w-2.5 h-2.5 text-[var(--color-text-muted)] flex-shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={localVolume}
            onChange={handleVolumeChange}
            className="flex-1 h-1 accent-[var(--color-primary)] cursor-pointer"
            title={`Volume: ${Math.round(localVolume * 100)}%`}
          />
          <Volume2 className="w-2.5 h-2.5 text-[var(--color-text-muted)] flex-shrink-0" />
        </div>
      )}
    </div>
  );
};

export const VoiceCallUI: React.FC<VoiceCallUIProps> = ({
  channelName,
  session,
  currentUserId,
  currentUsername,
}) => {
  const { participants, isMuted, isDeafened, toggleMute, toggleDeafen, leave } = session;

  // Include self as a participant card if not already in list
  const allParticipants: VoiceParticipant[] = React.useMemo(() => {
    if (currentUserId && !participants.some((p) => p.user_id === currentUserId)) {
      return [
        {
          user_id: currentUserId,
          username: currentUsername,
          is_muted: isMuted,
          is_deafened: isDeafened,
          is_speaking: false,
        },
        ...participants,
      ];
    }
    return participants;
  }, [participants, currentUserId, currentUsername, isMuted, isDeafened]);

  return (
    <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]/50">
      {/* Call header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)]/50">
        <Volume2 className="w-4 h-4 text-[var(--color-success)]" />
        <span className="font-semibold text-[var(--color-text)] text-sm">{channelName}</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          · {allParticipants.length} in voice
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-success)] font-medium">● Connected</span>
        </div>
      </div>

      {/* Participant grid */}
      <div className="px-4 py-3">
        {allParticipants.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-[var(--color-text-muted)]">
            <Volume2 className="w-4 h-4 opacity-40" />
            <span className="text-xs">You joined the voice channel. Waiting for others...</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allParticipants.map((p) => (
              <ParticipantCard
                key={p.user_id}
                participant={p}
                isSelf={p.user_id === currentUserId}
                session={session}
              />
            ))}
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-[var(--color-border)]/50">
        <button
          onClick={() => void toggleMute()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-[var(--color-border)] ${
            isMuted
              ? 'bg-[var(--color-error)] text-[var(--color-on-error)] hover:bg-[var(--color-error)]/90'
              : 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-hover)]'
          }`}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {isMuted ? 'Unmute' : 'Mute'}
        </button>

        <button
          onClick={() => void toggleDeafen()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-[var(--color-border)] ${
            isDeafened
              ? 'bg-[var(--color-error)] text-[var(--color-on-error)] hover:bg-[var(--color-error)]/90'
              : 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-hover)]'
          }`}
        >
          <VolumeX className="w-3.5 h-3.5" />
          {isDeafened ? 'Undeafen' : 'Deafen'}
        </button>

        <button
          onClick={() => void leave()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-error)]/85 text-[var(--color-on-error)] hover:bg-[var(--color-error)] transition-colors border border-[var(--color-border)]"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          Leave
        </button>
      </div>
    </div>
  );
};

export default VoiceCallUI;
