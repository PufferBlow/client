import { useState, useEffect, useRef, useCallback } from 'react';
import { ChannelWebSocket, createChannelWebSocket, getHostPortForWebSocket } from '../services/websocket';
import { logger } from '../utils/logger';
import type { Message, MessageAttachment } from '../models';

/**
 * WebSocket connection states
 */
export type WebSocketState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * WebSocket event handlers
 */
export interface WebSocketEventHandlers {
  /**
   * Called when a message is received
   */
  onMessage?: (message: any) => void;

  /**
   * Called when the connection is established
   */
  onConnected?: () => void;

  /**
   * Called when the connection is lost
   */
  onDisconnected?: (reason?: string) => void;

  /**
   * Called when an error occurs
   */
  onError?: (error: Event) => void;
}

/**
 * Return type for the useWebSocket hook
 */
export interface UseWebSocketReturn {
  /**
   * Current connection state
   */
  state: WebSocketState;

  /**
   * WebSocket connection instance
   */
  connection: ChannelWebSocket | null;

  /**
   * Connect to a channel
   */
  connect: (channelId: string, authToken: string, handlers: WebSocketEventHandlers) => void;

  /**
   * Disconnect from current channel
   */
  disconnect: () => void;

  /**
   * Send a message through the WebSocket
   */
  sendMessage: (message: any) => void;

  /**
   * Last error that occurred
   */
  error: string | null;
}

/**
 * Custom hook for managing WebSocket connections to chat channels.
 *
 * This hook encapsulates all WebSocket connection logic, state management,
 * and error handling for real-time messaging functionality.
 *
 * @param userId - The current user's ID for message filtering
 *
 * @example
 * ```typescript
 * const { state, connect, disconnect, sendMessage } = useWebSocket(currentUser?.user_id);
 *
 * useEffect(() => {
 *   if (selectedChannel) {
 *     connect(selectedChannel.channel_id, authToken, {
 *       onMessage: handleIncomingMessage,
 *       onConnected: () => showToast('Connected to chat'),
 *       onError: () => showToast('Connection error', 'error')
 *     });
 *   }
 *
 *   return () => disconnect();
 * }, [selectedChannel]);
 * ```
 */
export const useWebSocket = (userId?: string): UseWebSocketReturn => {
  const [state, setState] = useState<WebSocketState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<ChannelWebSocket | null>(null);
  const handlersRef = useRef<WebSocketEventHandlers>({});

  /**
   * Enhanced message handler that normalizes WebSocket message data
   */
  const handleMessage = useCallback((message: any) => {
    logger.network.info('WebSocket message received', { type: message.type, userId });

    if (message.type === 'message') {
      // Normalize attachments from WebSocket (may be simple URLs or objects)
      let normalizedAttachments: MessageAttachment[] = [];

      if (message.attachments && Array.isArray(message.attachments)) {
        logger.network.debug('Processing attachments', { count: message.attachments.length, userId });
        const tempAttachments: MessageAttachment[] = [];
        message.attachments.forEach((att: any, index: number) => {
          logger.network.debug(`Processing attachment ${index}`, { type: typeof att, hasUrl: att?.url, attType: att?.type, filename: att?.filename });
          // If it's already an object with proper structure, use it
          if (typeof att === 'object' && att.url) {
            // Ensure all required fields are present and properly typed
            const normalizedAtt: MessageAttachment = {
              url: att.url,
              filename: att.filename || att.url.split('/').pop() || 'attachment',
              type: att.type || 'application/octet-stream',
              size: att.size || null
            };
            tempAttachments.push(normalizedAtt);
            logger.network.debug(`Added normalized attachment ${index}`, { url: normalizedAtt.url, type: normalizedAtt.type, filename: normalizedAtt.filename });
          }
          // If it's a string URL, convert to MessageAttachment object
          else if (typeof att === 'string') {
            const filename = att.split('/').pop() || 'attachment';
            const ext = filename.split('.').pop()?.toLowerCase() || '';
            let mimeType = 'application/octet-stream';

            // Guess MIME type from extension (fallback)
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) {
              mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            } else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
              mimeType = `video/${ext === 'mov' ? 'quicktime' : ext}`;
            } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) {
              mimeType =
                ext === 'mp3'
                  ? 'audio/mpeg'
                  : ext === 'm4a'
                    ? 'audio/mp4'
                    : `audio/${ext}`;
            } else if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
              mimeType = ext === 'pdf' ? 'application/pdf' :
                       ext === 'doc' ? 'application/msword' :
                       ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                       ext === 'txt' ? 'text/plain' : 'application/octet-stream';
            }

            tempAttachments.push({
              url: att,
              filename: filename,
              type: mimeType,
              size: null
            });
            logger.network.debug(`Converted string attachment ${index}`, { url: att, type: mimeType, filename });
          } else {
            logger.network.warn(`Invalid attachment format ${index}`, { attachment: att });
          }
        });
        normalizedAttachments = tempAttachments;
        logger.network.debug('Final normalized attachments', { count: normalizedAttachments.length, attachments: normalizedAttachments });
      }

      // Create normalized message object
      const normalizedMessage: Message = {
        message_id: message.message_id || `ws-${Date.now()}-${Math.random()}`,
        sender_user_id: message.sender_user_id || '',
        message: message.message || '',
        hashed_message: message.hashed_message || '',
        username: message.username,
        sender_avatar_url: message.sender_avatar_url,
        sender_status: message.sender_status,
        sender_roles: message.sender_roles,
        sent_at: message.sent_at || new Date().toISOString(),
        channel_id: message.channel_id || '',
        attachments: normalizedAttachments
      };

      // Call user-provided handler with normalized message
      handlersRef.current.onMessage?.(normalizedMessage);
    } else {
      // Pass through other message types unchanged
      handlersRef.current.onMessage?.(message);
    }
  }, [userId]);

  /**
   * Handle successful connection
   */
  const handleConnected = useCallback(() => {
    setState('connected');
    setError(null);
    logger.network.info('WebSocket connected successfully');
    handlersRef.current.onConnected?.();
  }, []);

  /**
   * Handle disconnection
   */
  const handleDisconnected = useCallback((reason?: string) => {
    setState('disconnected');
    logger.network.info('WebSocket disconnected', { reason });
    handlersRef.current.onDisconnected?.(reason);
  }, []);

  /**
   * Handle connection errors
   */
  const handleError = useCallback((error: Event) => {
    setState('error');
    setError('WebSocket connection failed');
    logger.network.error('WebSocket connection error', { error });
    handlersRef.current.onError?.(error);
  }, []);

  /**
   * Connect to a channel's WebSocket
   */
  const connect = useCallback((
    channelId: string,
    authToken: string,
    handlers: WebSocketEventHandlers
  ) => {
    if (!channelId || !authToken) {
      logger.network.warn('Cannot connect WebSocket: missing channelId or authToken');
      return;
    }

    // Disconnect existing connection
    disconnect();

    setState('connecting');
    setError(null);
    handlersRef.current = handlers;

    try {
      const hostPort = getHostPortForWebSocket();
      if (!hostPort) {
        throw new Error('No server host:port configured for WebSocket connection');
      }

      logger.network.info('Creating WebSocket connection', { channelId, hostPort });

      const wsConnection = createChannelWebSocket(channelId, authToken, hostPort, {
        onMessage: handleMessage,
        onConnected: handleConnected,
        onDisconnected: handleDisconnected,
        onError: handleError
      });

      connectionRef.current = wsConnection;
      wsConnection.connect();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create WebSocket connection';
      setState('error');
      setError(errorMessage);
      logger.network.error('Failed to create WebSocket connection', { error: err });
    }
  }, [handleMessage, handleConnected, handleDisconnected, handleError]);

  /**
   * Disconnect from current WebSocket connection
   */
  const disconnect = useCallback(() => {
    if (connectionRef.current) {
      logger.network.info('Disconnecting WebSocket');
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }
    setState('disconnected');
    setError(null);
  }, []);

  /**
   * Send a message through the WebSocket
   */
  const sendMessage = useCallback((message: any) => {
    if (connectionRef.current && state === 'connected') {
      connectionRef.current.sendMessage(message);
    } else {
      logger.network.warn('Cannot send message: WebSocket not connected', { state });
    }
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    connection: connectionRef.current,
    connect,
    disconnect,
    sendMessage,
    error
  };
};

export default useWebSocket;
