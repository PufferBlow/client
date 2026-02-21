import React, { useEffect, useState, useCallback } from 'react';
import { Mic, MicOff, VolumeX, Volume2, PhoneOff } from 'lucide-react';
import { createWebRTCManager, WebRTCManager } from '../services/webrtc';
import type { VoiceChannelStatus, VoiceChannelParticipant } from '../services/webrtc';
import { joinVoiceChannel, leaveVoiceChannel } from '../services/channel';
import { getAuthTokenFromCookies } from '../services/user';
import { createGlobalWebSocket } from '../services/websocket';
import { getHostPortForWebSocket } from '../services/websocket';
import { logger } from '../utils/logger';

// WebRTC specific logger
const webrtcLogger = logger.network;

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
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [participants, setParticipants] = useState<VoiceChannelParticipant[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelStatus, setChannelStatus] = useState<VoiceChannelStatus | null>(null);
  const [showChannelSwitchDialog, setShowChannelSwitchDialog] = useState(false);
  const [pendingChannelToJoin, setPendingChannelToJoin] = useState<string | null>(null);
  const [currentChannelInfo, setCurrentChannelInfo] = useState<{name: string, id: string} | null>(null);

  // Prevent default click behavior to avoid triggering channel selection
  const handleChannelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Initialize WebRTC manager when component mounts
  useEffect(() => {
    webrtcLogger.info(`Initializing WebRTC for VoiceChannel component: ${channelName} (${channelId})`);

    const authToken = getAuthTokenFromCookies();
    const hostPort = getHostPortForWebSocket();

    if (authToken) {
      webrtcLogger.debug('Creating global websocket for WebRTC signaling');

      const websocket = createGlobalWebSocket(authToken, hostPort, {
        onConnected: () => {
          webrtcLogger.info('WebRTC signaling websocket connected');
        },
        onDisconnected: (reason) => {
          webrtcLogger.warn(`WebRTC signaling websocket disconnected: ${reason}`);
        },
        onError: (error) => {
          webrtcLogger.error('WebRTC signaling websocket error:', error);
        },
        onMessage: (message) => {
          // Log WebRTC signaling messages
          if (message.type && message.type.startsWith('webrtc_')) {
            webrtcLogger.debug('WebRTC signaling message received:', {
              type: message.type,
              channelId: message.channel_id,
              fromUserId: message.webrtcData?.fromUserId
            });
          }
        }
      });
      websocket.connect();

      // Extract user ID from auth token (simple extract - you might need to decode this properly)
      const userId = authToken.split('.')[0]; // Assuming format: userId.token

      webrtcLogger.debug(`Creating WebRTC manager for user: ${userId}`);
      const manager = createWebRTCManager(websocket, userId);
      manager.setOnStatusChange((status) => {
        webrtcLogger.debug(`Channel status update for ${channelId}:`, {
          participantCount: status.participantCount,
          isJoined: status.isJoined
        });
        setChannelStatus(status);
      });
      manager.setOnError((errorMsg) => {
        webrtcLogger.error('WebRTC error:', errorMsg);
        setError(errorMsg);
      });

      setWebrtcManager(manager);

      // Cleanup on unmount
      return () => {
        webrtcLogger.info(`Cleaning up WebRTC for VoiceChannel: ${channelId}`);
        manager.cleanup();
        websocket.disconnect();
      };
    } else {
      webrtcLogger.warn('No auth token available for WebRTC initialization');
    }
  }, [channelId, channelName]);

  // Update participants when channel status changes
  useEffect(() => {
    if (channelStatus && channelStatus.channelId === channelId) {
      setParticipants(channelStatus.participants);
      setIsMuted(channelStatus.participants.find(p => p.userId === webrtcManager?.getCurrentChannelId())?.isMuted || false);
      onToggleConnection(); // Update parent component
    }
  }, [channelStatus, channelId, webrtcManager, onToggleConnection]);

  const handleJoinVoiceChannel = async () => {
    if (!webrtcManager) {
      setError('WebRTC manager not initialized');
      return;
    }

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

      // Initialize WebRTC manager (request microphone access)
      await webrtcManager.initialize();

      // Join voice channel through API
      const response = await joinVoiceChannel(channelId, authToken);
      if (!response.success) {
        throw new Error(response.error || 'Failed to join voice channel');
      }

      // Join WebRTC channel (this handles the signaling setup)
      const status = await webrtcManager.joinVoiceChannel(channelId);

      console.log('Joined voice channel:', status);

    } catch (err) {
      console.error('Failed to join voice channel:', err);
      setError(err instanceof Error ? err.message : 'Failed to join voice channel');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveVoiceChannel = async () => {
    if (!webrtcManager) return;

    try {
      await webrtcManager.leaveVoiceChannel();
      console.log('Left voice channel');
    } catch (err) {
      console.error('Failed to leave voice channel:', err);
    }
  };

  const toggleMute = useCallback(() => {
    if (!webrtcManager) return;

    const newMutedState = webrtcManager.toggleMute();
    setIsMuted(newMutedState);
  }, [webrtcManager]);

  const toggleDeafen = useCallback(() => {
    if (!webrtcManager) return;

    const newDeafenedState = webrtcManager.toggleDeafen();
    setIsDeafened(newDeafenedState);
  }, [webrtcManager]);

  // Get current connection status from WebRTC manager
  const currentIsConnected = webrtcManager?.getCurrentChannelId() === channelId;

  return (
    <div
      className={`rounded-lg border border-border p-3 space-y-3 transition-all duration-200 ${
        currentIsConnected ? 'bg-red-500/10 border-red-400/30' : 'bg-surface-secondary'
      }`}
      onClick={handleChannelClick}
    >
      {/* Channel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${currentIsConnected ? 'bg-red-500' : 'bg-gray-400'}`}></div>
          <span className="text-sm font-medium text-white">{channelName}</span>
        </div>
        <div className="flex items-center space-x-1">
          {currentIsConnected && (
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
          disabled={isJoining || !webrtcManager}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 transition-all ${
            currentIsConnected
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          } ${isJoining || !webrtcManager ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isJoining ? (
            <>
              <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Joining...</span>
            </>
          ) : currentIsConnected ? (
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
      {currentIsConnected && (
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
      {currentIsConnected && participants.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Participants</div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {participants.map((participant) => (
              <div key={participant.userId} className="flex items-center space-x-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  participant.isSpeaking ? 'bg-green-400 animate-pulse' :
                  !participant.isMuted ? 'bg-gray-400' : 'bg-red-400'
                }`}></div>
                <span className="text-white truncate flex-1">
                  {participant.username || `User ${participant.userId.slice(-4)}`}
                  {participant.userId === webrtcManager?.['localUserId'] && ' (You)'}
                </span>
                <div className="flex space-x-1">
                  {!participant.isMuted ? (
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

      {/* Connection Info */}
      {!webrtcManager && (
        <div className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded">
          WebRTC not initialized. Please refresh the page.
        </div>
      )}
    </div>
  );
};

export default VoiceChannel;
