import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';

import { Button } from '../Button';
import { LoadingState } from '../LoadingState';
import { ErrorState } from '../ErrorState';

import { validateMessageInput } from '../../utils/markdown';
import { logger } from '../../utils/logger';

import type { Channel, Message, MessageAttachment, User } from '../../models';

// Dynamic imports for heavy/conditional components
const EmojiPicker = lazy(() => import('../EmojiPicker').then(module => ({ default: module.EmojiPicker })));
const MessageContextMenu = lazy(() => import('../MessageContextMenu').then(module => ({ default: module.MessageContextMenu })));
const MessageReportModal = lazy(() => import('../MessageReportModal').then(module => ({ default: module.MessageReportModal })));
const UserCard = lazy(() => import('../UserCard').then(module => ({ default: module.UserCard })));
const MarkdownRenderer = lazy(() => import('../MarkdownRenderer').then(module => ({ default: module.MarkdownRenderer })));
const AttachmentGrid = lazy(() => import('../AttachmentBubble').then(module => ({ default: module.AttachmentGrid })));

/**
 * Display user structure for chat
 */
export interface DisplayUser {
  id: string;
  username: string;
  avatar?: string;
  banner?: string;
  accentColor?: string;
  bannerColor?: string;
  customStatus?: string;
  externalLinks?: { platform: string; url: string }[];
  status: 'online' | 'idle' | 'offline' | 'dnd';
  bio?: string;
  joinedAt: string;
  originServer?: string;
  roles: string[];
  activity?: {
    type: 'playing' | 'listening' | 'watching' | 'streaming';
    name: string;
    details?: string;
  };
  mutualServers?: number;
  mutualFriends?: number;
  badges?: string[];
}

/**
 * Props for the ChatArea component
 */
export interface ChatAreaProps {
  /**
   * Currently selected channel
   */
  selectedChannel: Channel | null;

  /**
   * List of messages in the current channel
   */
  messages: Message[];

  /**
   * List of users for user information
   */
  users: DisplayUser[];

  /**
   * Current user information
   */
  currentUser?: User | null;

  /**
   * Loading state for messages
   */
  messagesLoading?: boolean;

  /**
   * Error state for messages
   */
  messagesError?: string | null;

  /**
   * Whether members list is visible
   */
  membersListVisible?: boolean;

  /**
   * Callback to toggle members list visibility
   */
  onToggleMembersList?: () => void;

  /**
   * Callback when a message is sent
   */
  onSendMessage?: (content: string, attachments: File[]) => Promise<void>;

  /**
   * Callback when a user is clicked
   */
  onUserClick?: (userId: string, username: string, event: React.MouseEvent) => void;

  /**
   * Callback for message actions (reply, react, report)
   */
  onMessageAction?: (action: 'reply' | 'react' | 'report', messageId: string) => void;

  /**
   * Callback for message context menu
   */
  onMessageContextMenu?: (messageId: string, event: React.MouseEvent) => void;

  /**
   * Callback for search modal
   */
  onOpenSearch?: () => void;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ChatArea component - main chat interface with message display and input.
 *
 * This component handles the core chat functionality including message display,
 * message input, user interactions, and various chat features.
 *
 * @example
 * ```tsx
 * <ChatArea
 *   selectedChannel={selectedChannel}
 *   messages={messages}
 *   users={users}
 *   currentUser={currentUser}
 *   onSendMessage={handleSendMessage}
 *   onUserClick={handleUserClick}
 * />
 * ```
 */
export const ChatArea: React.FC<ChatAreaProps> = ({
  selectedChannel,
  messages,
  users,
  currentUser,
  messagesLoading = false,
  messagesError,
  membersListVisible = false,
  onToggleMembersList,
  onSendMessage,
  onUserClick,
  onMessageAction,
  onMessageContextMenu,
  onOpenSearch,
  className = '',
}) => {
  // State management
  const [messageInput, setMessageInput] = useState('');
  const [messageAttachments, setMessageAttachments] = useState<File[]>([]);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [messageContextMenu, setMessageContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    messageId: string;
  }>({ isOpen: false, position: { x: 0, y: 0 }, messageId: '' });
  const [messageReportModal, setMessageReportModal] = useState<{
    isOpen: boolean;
    messages: string[];
  }>({ isOpen: false, messages: [] });
  const [userCardTooltip, setUserCardTooltip] = useState<{
    isOpen: boolean;
    user: DisplayUser | null;
    position: { x: number; y: number };
  }>({ isOpen: false, user: null, position: { x: 0, y: 0 } });

  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [messages]);

  // Handle message sending
  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();

    // Require either a message or attachments
    const hasContent = trimmedMessage || messageAttachments.length > 0;

    if (!hasContent || !onSendMessage) {
      return;
    }

    // Validate message for security and length if present
    if (trimmedMessage) {
      const validationResult = validateMessageInput(trimmedMessage, 4000); // Default max length
      if (!validationResult.isValid) {
        logger.ui.error('Message validation failed', { error: validationResult.error });
        return;
      }
    }

    try {
      await onSendMessage(trimmedMessage, messageAttachments);

      // Clear input and attachments on success
      setMessageInput('');
      setMessageAttachments([]);
    } catch (error) {
      logger.ui.error('Failed to send message', { error });
    }
  };

  // Handle keyboard shortcuts
  const handleKeyPress = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    if (event.nativeEvent.isComposing) {
      return;
    }

    const isPlainEnter =
      !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
    if (!isPlainEnter) {
      return;
    }

    event.preventDefault();
    await handleSendMessage();
  };

  // Handle file uploads
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Basic validation
    const maxSizeMB = 10;
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
      'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/opus',
      'application/pdf', 'text/plain', 'application/zip'
    ];
    const allowedAudioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'];
    const allowedVideoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
    const allowedImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const allowedDocumentExtensions = ['pdf', 'txt', 'zip'];

    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase() || '';

      if (file.size > maxSizeMB * 1024 * 1024) {
        logger.ui.warn('File too large', { fileName: file.name, size: file.size });
        continue;
      }

      const extensionAllowed =
        allowedAudioExtensions.includes(extension) ||
        allowedVideoExtensions.includes(extension) ||
        allowedImageExtensions.includes(extension) ||
        allowedDocumentExtensions.includes(extension);

      if (!allowedTypes.includes(file.type) && !extensionAllowed) {
        logger.ui.warn('File type not allowed', { fileName: file.name, type: file.type });
        continue;
      }

      validFiles.push(file);
    }

    setMessageAttachments(prev => [...prev, ...validFiles]);
    event.target.value = ''; // Clear input
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
    setIsEmojiPickerOpen(false);
  };

  const handleGifSelect = (gif: { url: string; title: string }) => {
    // For now, just log the GIF selection
    logger.ui.info('GIF selected', { gifUrl: gif.url, gifTitle: gif.title });
    setIsEmojiPickerOpen(false);
  };

  // Handle user interactions
  const handleUserClick = (userId: string, username: string, event: React.MouseEvent) => {
    event.preventDefault();

    // Find user data
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // Position tooltip
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position = {
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 5
    };

    setUserCardTooltip({
      isOpen: true,
      user,
      position
    });

    onUserClick?.(userId, username, event);
  };

  // Handle message context menu
  const handleMessageContextMenu = (messageId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setMessageContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      messageId
    });
  };

  // Handle message actions
  const handleMessageReply = (messageId: string) => {
    onMessageAction?.('reply', messageId);
    setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 }, messageId: '' });
  };

  const handleMessageReact = (messageId: string) => {
    onMessageAction?.('react', messageId);
    setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 }, messageId: '' });
  };

  const handleMessageReport = (messageId: string) => {
    setMessageReportModal({ isOpen: true, messages: [messageId] });
    setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 }, messageId: '' });
  };

  const handleMessageReportSubmit = async (report: { category: string; description: string }) => {
    logger.ui.info('Message report submitted', {
      messageIds: messageReportModal.messages,
      category: report.category,
      description: report.description
    });

    setMessageReportModal({ isOpen: false, messages: [] });
  };

  // Close tooltips on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setUserCardTooltip({ isOpen: false, user: null, position: { x: 0, y: 0 } });
    };

    if (userCardTooltip.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userCardTooltip.isOpen]);

  // Group messages by sender and time
  const groupedMessages = React.useMemo(() => {
    const groups: Message[][] = [];
    let currentGroup: Message[] = [];

    messages.forEach((message, index) => {
      const messageTime = new Date(message.sent_at);

      if (currentGroup.length === 0) {
        currentGroup = [message];
      } else {
        const prevMessageTime = new Date(currentGroup[currentGroup.length - 1].sent_at);
        const timeDiff = (messageTime.getTime() - prevMessageTime.getTime()) / 1000;

        // Continue group if same sender and within 30 seconds
        if (message.sender_user_id === currentGroup[0].sender_user_id && timeDiff <= 30) {
          currentGroup.push(message);
        } else {
          groups.push(currentGroup);
          currentGroup = [message];
        }
      }

      // Add the last group
      if (index === messages.length - 1) {
        groups.push(currentGroup);
      }
    });

    return groups;
  }, [messages]);

  if (messagesError) {
    return (
      <div className={`flex-1 min-w-0 flex flex-col bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden backdrop-blur-sm ${className}`}>
        <ErrorState
          title="Failed to load messages"
          message={messagesError}
          showRetry
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <>
      <div className={`flex-1 min-w-0 flex flex-col bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden backdrop-blur-sm ${className}`}>
        {/* Channel Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)] flex-shrink-0">
          <div className="flex items-center">
            <span className="text-[var(--color-text-secondary)] mr-2">#</span>
            <h2 className="text-[var(--color-text)] font-semibold">
              {selectedChannel?.channel_name || 'general'}
            </h2>
            <div className="ml-2 text-[var(--color-text-muted)] text-sm">
              Decentralized {selectedChannel?.channel_name || 'general'} discussion
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={onOpenSearch}
              className="w-5 h-5 text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors"
              title="Search messages"
              aria-label="Search messages"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={onToggleMembersList}
              className={`w-5 h-5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors rounded-md hover:bg-[var(--color-hover)] p-1 ${
                membersListVisible ? 'bg-[var(--color-active)]' : ''
              }`}
              title="Toggle member list"
              aria-label="Toggle member list"
              aria-pressed={membersListVisible}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
            <button className="w-5 h-5 text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors rounded-md hover:bg-[var(--color-hover)] p-1" title="Channel settings">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 break-words"
        >
          {messagesLoading ? (
            <LoadingState variant="skeleton" message="Loading messages..." />
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-[var(--color-text-secondary)]">
                <div className="text-sm text-[var(--color-text)]">No messages yet</div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {selectedChannel ? `This is the beginning of #${selectedChannel.channel_name}` : 'Select a channel to view messages'}
                </div>
              </div>
            </div>
          ) : (
            groupedMessages.map((group) => {
              const firstMessage = group[0];
              const messageTimestamp = new Date(firstMessage.sent_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });

              // Get user profile data
              const foundUser = users.find(user => user.id === firstMessage.sender_user_id);
              const displayName = foundUser?.username || firstMessage.username || 'Unknown User';
              const displayAvatar = foundUser?.avatar || firstMessage.sender_avatar_url || '/pufferblow-art-pixel-32x32.png';

              return (
                <div
                  key={firstMessage.message_id}
                  className={`group relative flex items-start space-x-3 rounded px-2 py-1 transition-colors hover:bg-[var(--color-surface-secondary)]/30 ${
                    firstMessage.sender_user_id === currentUser?.user_id
                      ? 'border-l-4 border-[var(--color-primary)] bg-[var(--color-primary)]/20 hover:bg-[var(--color-primary-hover)]/30'
                      : ''
                  }`}
                  onMouseEnter={() => setHoveredMessageId(firstMessage.message_id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full flex-shrink-0 relative">
                    <img
                      src={displayAvatar}
                      alt={displayName}
                      className="w-full h-full rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => handleUserClick(firstMessage.sender_user_id, displayName, e)}
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {/* Username */}
                      <span
                        className="cursor-pointer select-text font-medium text-[var(--color-text)] hover:underline"
                        onClick={(e) => handleUserClick(firstMessage.sender_user_id, displayName, e)}
                      >
                        {displayName}
                      </span>

                      {/* Role badges */}
                      {firstMessage.sender_roles?.includes("owner") && (
                        <span className="pb-status-success rounded border px-1.5 py-0.5 text-xs font-medium">OWNER</span>
                      )}
                      {firstMessage.sender_roles?.includes("admin") && (
                        <span className="pb-status-danger rounded border px-1.5 py-0.5 text-xs font-medium">ADMIN</span>
                      )}

                      <span className="select-text text-xs text-[var(--color-text-secondary)]">{messageTimestamp}</span>
                    </div>

                    <div className="space-y-1">
                      {group.map((message) => (
                        <div key={message.message_id}>
                          <MarkdownRenderer content={message.message} className="text-[var(--color-text)]" />
                          {message.attachments && message.attachments.length > 0 && (
                            <AttachmentGrid attachments={message.attachments} />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Hover Menu Button */}
                    <div className={`absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                      hoveredMessageId === firstMessage.message_id ? "opacity-100" : ""
                    }`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMessageContextMenu(firstMessage.message_id, e);
                        }}
                        className="pb-icon-btn mr-2 bg-[var(--color-surface-tertiary)] text-[var(--color-text)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                        title="More options"
                        aria-label="Message options"
                      >
                        <svg className="pb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 flex-shrink-0">
          {/* Attachments Preview */}
          {messageAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {messageAttachments.map((file, index) => (
                <div
                  key={index}
                  className="group relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3 transition-colors hover:border-[var(--color-border-secondary)]"
                >
                  <div className="flex items-center space-x-2">
                    <span className="max-w-24 truncate text-xs font-medium text-[var(--color-text)]" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      ({(file.size / (1024 * 1024)).toFixed(1)}MB)
                    </span>
                  </div>

                  <button
                    onClick={() => setMessageAttachments(prev => prev.filter((_, i) => i !== index))}
                    className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-error)] text-[var(--color-on-error)] opacity-0 transition-opacity hover:bg-[var(--color-error)]/90 group-hover:opacity-100"
                    title="Remove attachment"
                    aria-label="Remove attachment"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/90 px-6 py-4 shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-[var(--color-surface-secondary)]">
            <div className="flex items-end space-x-3">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,video/*,audio/*,application/pdf,text/plain,application/zip"
              />

              {/* File Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="pb-icon-btn flex-shrink-0"
                title="Upload file"
                aria-label="Upload file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              {/* Message Input */}
              <div className="flex-1 min-h-0">
                <textarea
                  ref={messageInputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={selectedChannel ? `Message #${selectedChannel.channel_name}` : 'Select a channel to start messaging'}
                  disabled={!selectedChannel}
                  className="h-6 w-full resize-none break-words bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none overflow-wrap-anywhere disabled:cursor-not-allowed disabled:opacity-50"
                  rows={1}
                />
              </div>

              {/* Emoji Button */}
              <button
                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                disabled={!selectedChannel}
                className={`pb-icon-btn disabled:cursor-not-allowed disabled:opacity-50 ${
                  isEmojiPickerOpen
                    ? 'border-[var(--color-border)] bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
                title="Add emoji"
                aria-label="Add emoji"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H13m-3 3.5a.5.5 0 11-1 0 .5.5 0 011 0zM16 7a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>

              {/* Send Button */}
              {messageInput.trim() && selectedChannel && (
                <Button
                  onClick={handleSendMessage}
                  size="sm"
                  className="animate-in slide-in-from-left-4 fade-in"
                  title="Send message"
                  aria-label="Send message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </Button>
              )}
            </div>
          </div>

          {/* Emoji Picker */}
          <Suspense fallback={<div className="text-xs text-[var(--color-text-secondary)]">Loading emoji picker...</div>}>
            <EmojiPicker
              isOpen={isEmojiPickerOpen}
              onClose={() => setIsEmojiPickerOpen(false)}
              onEmojiSelect={handleEmojiSelect}
              onGifSelect={handleGifSelect}
            />
          </Suspense>
        </div>
      </div>

      {/* Message Context Menu */}
      <Suspense fallback={null}>
        <MessageContextMenu
          isOpen={messageContextMenu.isOpen}
          position={messageContextMenu.position}
          onClose={() => setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 }, messageId: '' })}
          onReply={() => handleMessageReply(messageContextMenu.messageId)}
          onReact={() => handleMessageReact(messageContextMenu.messageId)}
          onCopyLink={() => logger.ui.info('Copy message link', { messageId: messageContextMenu.messageId })}
          onReport={() => handleMessageReport(messageContextMenu.messageId)}
        />
      </Suspense>

      {/* Message Report Modal */}
      <Suspense fallback={null}>
        <MessageReportModal
          isOpen={messageReportModal.isOpen}
          onClose={() => setMessageReportModal({ isOpen: false, messages: [] })}
          onSubmit={handleMessageReportSubmit}
          messageCount={messageReportModal.messages.length}
        />
      </Suspense>

      {/* User Card Tooltip */}
      {userCardTooltip.isOpen && userCardTooltip.user && (
        <Suspense fallback={null}>
          <div
            className="fixed z-50"
            style={{
              left: userCardTooltip.position.x,
              top: userCardTooltip.position.y
            }}
          >
            <UserCard
              username={userCardTooltip.user.username}
              bio={userCardTooltip.user.bio || 'Active member'}
              roles={userCardTooltip.user.roles as any} // Type assertion for compatibility
              originServer={userCardTooltip.user.originServer || 'Pufferblow Server'}
              avatarUrl={userCardTooltip.user.avatar}
              backgroundUrl={userCardTooltip.user.banner}
              status={userCardTooltip.user.status === 'online' ? 'active' : userCardTooltip.user.status as any}
              activity={userCardTooltip.user.activity}
              mutualServers={userCardTooltip.user.mutualServers || 1}
              mutualFriends={userCardTooltip.user.mutualFriends || 0}
              badges={userCardTooltip.user.badges}
              customStatus={userCardTooltip.user.customStatus}
              accentColor={userCardTooltip.user.accentColor || '#5865f2'}
              bannerColor={userCardTooltip.user.bannerColor}
              externalLinks={userCardTooltip.user.externalLinks || []}
              joinDate={userCardTooltip.user.joinedAt}
              showOnlineIndicator={true}
              isCompact={false}
            />
          </div>
        </Suspense>
      )}
    </>
  );
};

export default ChatArea;

