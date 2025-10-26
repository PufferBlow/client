import React, { useEffect, useState, useCallback } from 'react';
import { Room, RoomEvent, Participant } from 'livekit-client';
import { Mic, MicOff, VolumeX, Volume2, PhoneOff } from 'lucide-react';
import { joinVoiceChannel, leaveVoiceChannel, getVoiceChannelStatus, type VoiceChannelJoinResponse } from '../services/channel';
import { getAuthTokenFromCookies } from '../services/user';

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
  isConnected: boolean;
  onToggleConnection: () => void;
}

export const VoiceChannel: React.FC<VoiceChannelProps> = ({
  channelId,
  channelName,
  isConnected,
  onToggleConnection
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent default click behavior to avoid triggering channel selection
  const handleChannelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleJoinVoiceChannel = async () => {
    if (isConnected) {
      await handleLeaveVoiceChannel();
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) {
        throw new Error('Not authenticated');
      }

      // Get LiveKit token from our API
      const response = await joinVoiceChannel(channelId, authToken);
      if (!response.success) {
        throw new Error(response.error || 'Failed to join voice channel');
      }

      const joinData = response.data as VoiceChannelJoinResponse;
      if (!joinData.token || !joinData.room_name || !joinData.livekit_url) {
        throw new Error('Invalid voice channel data');
      }

      // Connect to LiveKit room
      const newRoom = new Room();
      newRoom.connect(joinData.livekit_url, joinData.token);

      // Set up event listeners
      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        setParticipants(prev => [...prev, participant]);
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
      });

      newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === 'connected') {
          setRoom(newRoom);
          setParticipants([newRoom.localParticipant, ...Array.from(newRoom.remoteParticipants.values())]);
        }
      });

      setRoom(newRoom);
    } catch (err) {
      console.error('Failed to join voice channel:', err);
      setError(err instanceof Error ? err.message : 'Failed to join voice channel');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveVoiceChannel = async () => {
    if (room) {
      try {
        const authToken = getAuthTokenFromCookies();
        await leaveVoiceChannel(channelId, authToken || '');
        room.disconnect();
        setRoom(null);
        setParticipants([]);
      } catch (err) {
        console.error('Failed to leave voice channel:', err);
      }
    }
  };

  const toggleMute = useCallback(() => {
    if (room?.localParticipant) {
      if (isMuted) {
        room.localParticipant.setMicrophoneEnabled(true);
      } else {
        room.localParticipant.setMicrophoneEnabled(false);
      }
      setIsMuted(!isMuted);
    }
  }, [room, isMuted]);

  const toggleDeafen = useCallback(() => {
    if (room?.localParticipant) {
      if (isDeafened) {
        room.localParticipant.setMicrophoneEnabled(true);
        if (!isMuted) room.localParticipant.setMicrophoneEnabled(false); // Restore previous mute state
      } else {
        room.localParticipant.setMicrophoneEnabled(false);
      }
      setIsDeafened(!isDeafened);
    }
  }, [room, isDeafened]);

  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  // Update connection status
  useEffect(() => {
    if (isConnected && room) {
      onToggleConnection();
    } else if (!isConnected && !room) {
      onToggleConnection();
    }
  }, [isConnected, room, onToggleConnection]);

  return (
    <div
      className={`rounded-lg border border-border p-3 space-y-3 transition-all duration-200 ${
        isConnected ? 'bg-red-500/10 border-red-400/30' : 'bg-surface-secondary'
      }`}
      onClick={handleChannelClick}
    >
      {/* Channel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-red-500' : 'bg-gray-400'}`}></div>
          <span className="text-sm font-medium text-white">{channelName}</span>
        </div>
        <div className="flex items-center space-x-1">
          {isConnected && (
            <span className="text-xs text-gray-400">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
          {error}
        </div>
      )}

      {/* Join/Leave Button */}
      <div className="flex justify-center">
        <button
          onClick={handleJoinVoiceChannel}
          disabled={isJoining}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 transition-all ${
            isConnected
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          } ${isJoining ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isJoining ? (
            <>
              <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
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

      {/* Voice Controls */}
      {isConnected && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={toggleMute}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isMuted
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4 text-white" />
            )}
          </button>

          <button
            onClick={toggleDeafen}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDeafened
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            <VolumeX className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* Participants List */}
      {isConnected && participants.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Participants</div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {participants.map((participant) => (
              <div key={participant.sid} className="flex items-center space-x-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  participant.isSpeaking ? 'bg-green-400 animate-pulse' :
                  participant.isMicrophoneEnabled ? 'bg-gray-400' : 'bg-red-400'
                }`}></div>
                <span className="text-white truncate flex-1">
                  {participant.name || 'Unknown'}
                  {participant.isLocal && ' (You)'}
                </span>
                <div className="flex space-x-1">
                  {participant.isMicrophoneEnabled ? (
                    <Mic className="w-3 h-3 text-gray-400" />
                  ) : (
                    <MicOff className="w-3 h-3 text-red-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceChannel;
