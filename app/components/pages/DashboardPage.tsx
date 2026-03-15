import { Link, useLocation, useNavigate } from "react-router";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactDOM from 'react-dom';
import { ChannelCreationModal } from "../../components/ChannelCreationModal";
import { UserContextMenu } from "../../components/UserContextMenu";
import { SearchModal } from "../../components/SearchModal";
import { EmojiPicker } from "../../components/EmojiPicker";
import { VoiceChannel } from "../../components/VoiceChannel";
import { UserPanel } from "../../components/UserPanel";
import { DeviceSelectorModal } from "../../components/DeviceSelectorModal";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { MessageReportModal } from "../../components/MessageReportModal";
import { MessageContextMenu } from "../../components/MessageContextMenu";
import { MessageEmbeds } from "../../components/MessageEmbeds";
import { NotificationMenu, type NotificationItem } from "../../components/NotificationMenu";
import { useToast } from "../../components/Toast";
import { UserCard } from "../../components/UserCard";
import { AttachmentGrid } from "../../components/AttachmentBubble";
import { UserListItem } from "../../components/dashboard/UserListItem";
import { AddServerButton } from "../../components/dashboard/AddServerButton";
import { ContextMenu } from "../../components/ui/ContextMenu";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { validateMessageInput } from "../../utils/markdown";
import { logger } from "../../utils/logger";
import { usePersistedUIState } from "../../utils/uiStatePersistence";
import { getAuthTokenFromCookies, getHostPortFromCookies, getHostPortFromStorage, useCurrentUserProfile, getUserProfileById, createFallbackAvatarUrl, createFullUrl, getResolvedRoleNames, getUserAccentColor, getUserRoles, hasResolvedPrivilege, updateUserStatus } from "../../services/user";
import { listChannels, createChannel, deleteChannel } from "../../services/channel";
import { getMessageReadHistory, loadMessages, markMessageAsRead, sendMessage } from "../../services/message";
import { banUser, submitMessageReport, submitUserReport, timeoutUser } from "../../services/moderation";
import { GlobalWebSocket, createGlobalWebSocket, isChatWebSocketMessage, normalizeChatWebSocketMessage } from "../../services/websocket";
import { listUsers, type ListUsersResponse } from "../../services/user";
import { getServerInfo, type ServerInfo } from "../../services/system";
import { resolveStoredInstance } from "../../services/instance";
import { buildAuthRedirectPath } from "../../utils/authRedirect";
import type { Channel } from "../../models";
import type { Message } from "../../models";
import type { User } from "../../models";

interface DisplayUser {
  id: string;
  username: string;
  avatar?: string;
  banner?: string;
  accentColor?: string;
  bannerColor?: string;
  customStatus?: string;
  externalLinks?: { platform: string; url: string }[];
  status: 'online' | 'idle' | 'afk' | 'offline' | 'dnd';
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

interface ComposerAttachmentPreview {
  file: File;
  kind: 'image' | 'video' | 'file';
  url?: string;
}

type UploadCategory = 'image' | 'video' | 'audio' | 'file';

const normalizeExtensions = (extensions?: string[] | null): string[] =>
  (extensions ?? [])
    .map((extension) => extension.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);

const getAttachmentCategory = (file: File, policy: {
  imageExtensions: string[];
  videoExtensions: string[];
  audioExtensions: string[];
}): UploadCategory => {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/^\./, '') || '';

  if (policy.imageExtensions.includes(extension) || file.type.startsWith('image/')) {
    return 'image';
  }
  if (policy.videoExtensions.includes(extension) || file.type.startsWith('video/')) {
    return 'video';
  }
  if (policy.audioExtensions.includes(extension) || file.type.startsWith('audio/')) {
    return 'audio';
  }
  return 'file';
};

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();
  const { data: currentUser, isLoading: userLoading, error: userError } = useCurrentUserProfile();
  const loginRedirectPath = buildAuthRedirectPath(
    location.pathname,
    location.search,
    location.hash,
  );

  // Client-side authentication check
  useEffect(() => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) {
      navigate(loginRedirectPath, { replace: true });
    }
  }, [loginRedirectPath, navigate]);

  // UI persistence hook
  const {
    selectedChannelId: persistedChannelId,
    setSelectedChannel: persistSelectedChannel,
    setMessageDraft,
    getMessageDraft,
    clearMessageDraft,
  } = usePersistedUIState(currentUser?.user_id);

  // Modal states
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [deviceSelectorModalOpen, setDeviceSelectorModalOpen] = useState(false);

  // User card tooltip state
  const [userCardTooltipUser, setUserCardTooltipUser] = useState<DisplayUser | null>(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipSource, setTooltipSource] = useState<'userpanel' | 'members' | 'messages'>('messages');

  // Tooltip anchoring and position state
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const calculateTooltipPosition = useCallback((
    anchor: HTMLElement,
    source: 'userpanel' | 'members' | 'messages'
  ) => {
    const rect = anchor.getBoundingClientRect();
    const spacing = 10;
    const viewportPadding = 16;
    const tooltipWidth = popperElement?.offsetWidth ?? 352;
    const tooltipHeight = popperElement?.offsetHeight ?? 420;
    const maxLeft = window.innerWidth - tooltipWidth - viewportPadding;
    const maxTop = window.innerHeight - tooltipHeight - viewportPadding;

    if (source === 'userpanel') {
      const left = Math.min(maxLeft, Math.max(viewportPadding, rect.left));
      const preferBottomTop = rect.bottom + spacing;
      const top = preferBottomTop + tooltipHeight <= window.innerHeight - viewportPadding
        ? preferBottomTop
        : Math.max(viewportPadding, rect.top - tooltipHeight - spacing);
      return { top, left };
    }

    const centeredLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    const left = Math.min(maxLeft, Math.max(viewportPadding, centeredLeft));
    const preferTop = rect.top - tooltipHeight - spacing;
    const top = preferTop >= viewportPadding
      ? preferTop
      : Math.min(maxTop, rect.bottom + spacing);
    return { top, left };
  }, [popperElement]);

  // Keep tooltip aligned on scroll/resize and after content/size changes.
  useEffect(() => {
    if (!isTooltipOpen || !referenceElement) {
      return;
    }

    const updatePosition = () => {
      setTooltipPosition(calculateTooltipPosition(referenceElement, tooltipSource));
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isTooltipOpen, referenceElement, tooltipSource, userCardTooltipUser, calculateTooltipPosition]);

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [messageContextMenu, setMessageContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    customCopyLinkLabel?: string;
    customReportLabel?: string;
    onCopyLink?: () => void;
    onReport?: () => void;
  }>({ isOpen: false, position: { x: 0, y: 0 } });
  const [currentMenuMessageId, setCurrentMenuMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [membersListVisible, setMembersListVisible] = useState(false);
  const [userContextMenu, setUserContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });
  const [selectedContextUser, setSelectedContextUser] = useState<{
    userId: string;
    username: string;
    anchorElement: HTMLElement | null;
    source: 'userpanel' | 'members' | 'messages';
  } | null>(null);
  const [channelContextMenu, setChannelContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number }; channel: Channel | null }>({ isOpen: false, position: { x: 0, y: 0 }, channel: null });
  const [channelDeleteConfirm, setChannelDeleteConfirm] = useState<{ isOpen: boolean; channel: Channel | null; isDeleting?: boolean }>({ isOpen: false, channel: null, isDeleting: false });
  const [reportModal, setReportModal] = useState<{
    isOpen: boolean;
    targetType: 'message' | 'user';
    messages: string[];
    targetUserId?: string;
    targetUsername?: string;
  }>({ isOpen: false, targetType: 'message', messages: [] });
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [serverInfoError, setServerInfoError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<ListUsersResponse['users']>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [webSocketConnection, setWebSocketConnection] = useState<GlobalWebSocket | null>(null);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());
  const [unreadCountsByChannel, setUnreadCountsByChannel] = useState<Record<string, number>>({});
  const [manualPresenceLock, setManualPresenceLock] = useState<'dnd' | 'afk' | 'offline' | null>(null);
  const [unreadMarker, setUnreadMarker] = useState<{ channelId: string; messageId: string } | null>(null);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported',
  );
  const webSocketConnectionRef = useRef<GlobalWebSocket | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement | null>(null);
  const selectedChannelIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(currentUser?.user_id ?? null);
  const seenRealtimeMessageIdsRef = useRef<Set<string>>(new Set());
  const readMessageIdsRef = useRef<Set<string>>(new Set());
  const lastActivityAtRef = useRef<number>(Date.now());
  const presenceUpdateInFlightRef = useRef(false);

  const usersById = useMemo(() => {
    const map = new Map<string, ListUsersResponse['users'][number]>();
    users.forEach((user) => {
      map.set(user.user_id, user);
    });
    return map;
  }, [users]);

  const currentUserLiveStatus = useMemo(() => {
    if (!currentUser) {
      return 'offline' as const;
    }

    const liveStatus = usersById.get(currentUser.user_id)?.status ?? currentUser.status;
    if (
      liveStatus === 'online' ||
      liveStatus === 'idle' ||
      liveStatus === 'afk' ||
      liveStatus === 'dnd'
    ) {
      return liveStatus;
    }
    return 'offline' as const;
  }, [currentUser, usersById]);

  useEffect(() => {
    selectedChannelIdRef.current = selectedChannel?.channel_id ?? null;
  }, [selectedChannel]);

  useEffect(() => {
    currentUserIdRef.current = currentUser?.user_id ?? null;
  }, [currentUser]);

  useEffect(() => {
    webSocketConnectionRef.current = webSocketConnection;
  }, [webSocketConnection]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserNotificationPermission('unsupported');
      return;
    }

    setBrowserNotificationPermission(Notification.permission);
  }, [notificationMenuOpen]);

  const groupedMessages = useMemo(() => {
    if (messages.length === 0) {
      return [] as Message[][];
    }

    const groups: Message[][] = [];
    let currentGroup: Message[] = [];

    messages.forEach((message, index) => {
      const messageTime = new Date(message.sent_at);

      if (currentGroup.length === 0) {
        currentGroup = [message];
      } else {
        const prevMessageTime = new Date(currentGroup[currentGroup.length - 1].sent_at);
        const timeDiff = (messageTime.getTime() - prevMessageTime.getTime()) / 1000;
        if (message.sender_user_id === currentGroup[0].sender_user_id && timeDiff <= 30) {
          currentGroup.push(message);
        } else {
          groups.push(currentGroup);
          currentGroup = [message];
        }
      }

      if (index === messages.length - 1) {
        groups.push(currentGroup);
      }
    });

    return groups;
  }, [messages]);

  const getMessageById = useCallback(
    (messageId: string | null) =>
      messageId ? messages.find((message) => message.message_id === messageId) ?? null : null,
    [messages],
  );

  const buildReplyMessage = useCallback((messageBody: string, target: Message | null) => {
    if (!target) {
      return messageBody;
    }

    const author = target.username || usersById.get(target.sender_user_id)?.username || "Unknown User";
    const excerpt = (target.message || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, 140);
    const quotedLines = excerpt ? `> ${excerpt.replace(/\n/g, "\n> ")}\n\n` : "";
    return `> Replying to @${author}\n${quotedLines}${messageBody}`.trim();
  }, [usersById]);

  const addReadMessageIds = useCallback((messageIds: string[]) => {
    if (messageIds.length === 0) {
      return;
    }

    setReadMessageIds((prev) => {
      const next = new Set(prev);
      messageIds.forEach((messageId) => next.add(messageId));
      readMessageIdsRef.current = next;
      return next;
    });
  }, []);

  const applyReadHistorySnapshot = useCallback(
    (messageIds: string[], unreadCounts: Record<string, number>) => {
      const snapshot = new Set(messageIds);
      readMessageIdsRef.current = snapshot;
      setReadMessageIds(snapshot);
      setUnreadCountsByChannel(unreadCounts);
    },
    [],
  );

  const markChannelNotificationsRead = useCallback((channelId: string) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.channelId !== channelId),
    );
  }, []);

  const applyPresenceUpdate = useCallback((userId: string, status: DisplayUser['status']) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.user_id === userId
          ? {
              ...user,
              status,
            }
          : user,
      ),
    );

    setMessages((prevMessages) =>
      prevMessages.map((message) =>
        message.sender_user_id === userId
          ? {
              ...message,
              sender_status: status,
            }
          : message,
      ),
    );
  }, []);

  const updatePresenceStatus = useCallback(
    async (
      status: 'online' | 'idle' | 'afk' | 'dnd' | 'offline',
      options?: {
        silent?: boolean;
        lockMode?: 'preserve' | 'set' | 'clear';
      },
    ) => {
      if (!currentUser || currentUserLiveStatus === status || presenceUpdateInFlightRef.current) {
        return;
      }

      const previousStatus =
        currentUserLiveStatus === 'online' ||
        currentUserLiveStatus === 'idle' ||
        currentUserLiveStatus === 'afk' ||
        currentUserLiveStatus === 'dnd'
          ? currentUserLiveStatus
          : 'offline';

      presenceUpdateInFlightRef.current = true;
      applyPresenceUpdate(currentUser.user_id, status);

      try {
        const sentViaWebSocket =
          webSocketConnectionRef.current?.sendPresenceUpdate(status) ?? false;

        if (!sentViaWebSocket) {
          const authToken = getAuthTokenFromCookies() || '';
          if (!authToken) {
            throw new Error('No authentication token');
          }

          const response = await updateUserStatus({
            auth_token: authToken,
            status,
          });

          if (!response.success) {
            throw new Error(response.error || 'Failed to update status');
          }
        }

        if (options?.lockMode === 'set') {
          setManualPresenceLock(
            status === 'dnd' || status === 'afk' || status === 'offline'
              ? status
              : null,
          );
        } else if (options?.lockMode === 'clear') {
          setManualPresenceLock(null);
        }

        if (!options?.silent) {
          showToast({
            message: `Status updated to ${status === 'dnd' ? 'Do Not Disturb' : status}.`,
            tone: 'success',
            category: 'system',
          });
        }
      } catch (error) {
        applyPresenceUpdate(currentUser.user_id, previousStatus);
        if (!options?.silent) {
          showToast({
            message: `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`,
            tone: 'error',
            category: 'system',
          });
        }
      } finally {
        presenceUpdateInFlightRef.current = false;
      }
    },
    [applyPresenceUpdate, currentUser, currentUserLiveStatus, showToast],
  );

  useEffect(() => {
    if (!currentUser || manualPresenceLock) {
      return;
    }

    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
      if (currentUserLiveStatus === 'idle') {
        void updatePresenceStatus('online', {
          silent: true,
          lockMode: 'clear',
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markActivity();
      }
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'focus',
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = window.setInterval(() => {
      const idleForMs = Date.now() - lastActivityAtRef.current;
      const idleThresholdMs = 5 * 60 * 1000;
      if (idleForMs >= idleThresholdMs && currentUserLiveStatus === 'online') {
        void updatePresenceStatus('idle', {
          silent: true,
          lockMode: 'clear',
        });
      }
    }, 30_000);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, [currentUser, currentUserLiveStatus, manualPresenceLock, updatePresenceStatus]);

  const markMessagesRead = useCallback(
    async (channelId: string, messageIds: string[]) => {
      const uniqueMessageIds = [...new Set(messageIds)].filter(
        (messageId) => !readMessageIdsRef.current.has(messageId),
      );

      if (uniqueMessageIds.length === 0) {
        return;
      }

      addReadMessageIds(uniqueMessageIds);
      markChannelNotificationsRead(channelId);
      setUnreadCountsByChannel((prev) => {
        const next = { ...prev };
        delete next[channelId];
        return next;
      });

      const authToken = getAuthTokenFromCookies() || '';
      const hostPort = getHostPortFromStorage() || getHostPortFromCookies();
      if (!authToken || !hostPort) {
        return;
      }

      uniqueMessageIds.forEach((messageId) => {
        webSocketConnectionRef.current?.sendReadConfirmation(messageId, channelId);
      });

      await Promise.allSettled(
        uniqueMessageIds.map((messageId) =>
          markMessageAsRead(hostPort, channelId, messageId, authToken),
        ),
      );
    },
    [addReadMessageIds, markChannelNotificationsRead],
  );

  // Voice channel state management
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState<{
    channelId: string;
    channelName: string;
    participants: number;
  } | null>(null);
  const [messageInput, setMessageInput] = useState(() => {
    // Initialize with persisted draft if we have a selected channel
    if (persistedChannelId) {
      return getMessageDraft(persistedChannelId);
    }
    return '';
  });
  const [messageAttachments, setMessageAttachments] = useState<File[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const canDeleteChannels = hasResolvedPrivilege(currentUser, "delete_channels");
  const canTimeoutUsers = hasResolvedPrivilege(currentUser, "mute_users");
  const canBanUsers = hasResolvedPrivilege(currentUser, "ban_users");

  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const messageInputBarRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const serverDropdownRef = useRef<HTMLDivElement>(null);
  const cachedTextareaHeightRef = useRef(24);
  const draftPersistTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDraftRef = useRef<{ channelId: string; message: string } | null>(null);
  const currentUserPrivileges = currentUser?.resolved_privileges || [];
  const canCreateInvite =
    currentUser?.is_admin ||
    currentUser?.is_owner ||
    currentUserPrivileges.includes("manage_channel_users");
  const canAccessControlPanel =
    currentUser?.is_owner ||
    currentUser?.is_admin ||
    currentUserPrivileges.includes("manage_server_settings");
  const canDeleteServer =
    currentUser?.is_owner || currentUserPrivileges.includes("manage_server_settings");

  const uploadPolicy = useMemo(() => {
    const imageExtensions = normalizeExtensions(serverInfo?.allowed_image_types);
    const videoExtensions = normalizeExtensions(serverInfo?.allowed_video_types);
    const audioExtensions = normalizeExtensions(serverInfo?.allowed_audio_types);
    const fileExtensions = normalizeExtensions(serverInfo?.allowed_file_types);
    const allExtensions = [
      ...imageExtensions,
      ...videoExtensions,
      ...audioExtensions,
      ...fileExtensions,
    ];

    return {
      maxMessageLength: serverInfo?.max_message_length ?? null,
      maxTotalAttachmentSizeMb: serverInfo?.max_total_attachment_size ?? null,
      maxSizesByCategory: {
        image: serverInfo?.max_image_size ?? null,
        video: serverInfo?.max_video_size ?? null,
        audio: serverInfo?.max_audio_size ?? null,
        file: serverInfo?.max_file_size ?? null,
      },
      imageExtensions,
      videoExtensions,
      audioExtensions,
      fileExtensions,
      allExtensions,
      acceptAttribute:
        allExtensions.length > 0
          ? allExtensions.map((extension) => `.${extension}`).join(',')
          : undefined,
    };
  }, [serverInfo]);

  const composerAttachmentPreviews = useMemo<ComposerAttachmentPreview[]>(
    () =>
      messageAttachments.map((file) => ({
        file,
        kind: file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('video/')
            ? 'video'
            : 'file',
        url:
          file.type.startsWith('image/') || file.type.startsWith('video/')
            ? URL.createObjectURL(file)
            : undefined,
      })),
    [messageAttachments],
  );

  const composerAttachmentSummary = useMemo(() => {
    const totalBytes = messageAttachments.reduce((sum, file) => sum + file.size, 0);
    return {
      count: messageAttachments.length,
      formattedSize:
        totalBytes >= 1024 * 1024
          ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(totalBytes / 1024))} KB`,
    };
  }, [messageAttachments]);

  const persistDraftForChannel = useCallback((channelId: string, message: string) => {
    const normalizedMessage = message.trim().length === 0 ? '' : message;

    if (normalizedMessage) {
      setMessageDraft(channelId, message);
    } else {
      clearMessageDraft(channelId);
    }

    pendingDraftRef.current = null;
  }, [clearMessageDraft, setMessageDraft]);

  const cancelPendingDraftPersistence = useCallback(() => {
    if (draftPersistTimeoutRef.current) {
      clearTimeout(draftPersistTimeoutRef.current);
      draftPersistTimeoutRef.current = null;
    }

    pendingDraftRef.current = null;
  }, []);

  const flushPendingDraftPersistence = useCallback(() => {
    if (draftPersistTimeoutRef.current) {
      clearTimeout(draftPersistTimeoutRef.current);
      draftPersistTimeoutRef.current = null;
    }

    if (pendingDraftRef.current) {
      persistDraftForChannel(pendingDraftRef.current.channelId, pendingDraftRef.current.message);
    }
  }, [persistDraftForChannel]);

  const scheduleDraftPersistence = useCallback((channelId: string, message: string) => {
    pendingDraftRef.current = { channelId, message };

    if (draftPersistTimeoutRef.current) {
      clearTimeout(draftPersistTimeoutRef.current);
    }

    draftPersistTimeoutRef.current = setTimeout(() => {
      if (!pendingDraftRef.current) {
        return;
      }

      persistDraftForChannel(pendingDraftRef.current.channelId, pendingDraftRef.current.message);
      draftPersistTimeoutRef.current = null;
    }, 250);
  }, [persistDraftForChannel]);

  const resizeMessageComposer = useCallback(() => {
    const textarea = messageInputRef.current;
    if (!textarea) {
      return;
    }

    const minHeight = 24;
    const maxHeight = 200;

    requestAnimationFrame(() => {
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;
      const boundedHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      const shouldScroll = scrollHeight > maxHeight;

      if (
        Math.abs(boundedHeight - cachedTextareaHeightRef.current) <= 1 &&
        textarea.style.overflowY === (shouldScroll ? 'auto' : 'hidden')
      ) {
        textarea.style.height = `${boundedHeight}px`;
        return;
      }

      textarea.style.overflowY = shouldScroll ? 'auto' : 'hidden';
      textarea.style.height = `${boundedHeight}px`;
      cachedTextareaHeightRef.current = boundedHeight;
    });
  }, []);

  // Handle loading timeout - prevent infinite loading
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  useEffect(() => {
    if (userLoading) {
      logger.ui.debug('Starting dashboard loading timeout');
      const timer = setTimeout(() => {
        logger.ui.error('Dashboard loading timeout reached');
        setLoadingTimeout(true);
      }, 10000); // 10 second timeout

      return () => {
        logger.ui.debug('Clearing dashboard loading timeout');
        clearTimeout(timer);
      };
    }
  }, [userLoading]);

  // Store error state to render after hooks
  const errorMessage = (userError as any)?.message || '';
  const isInitialLoad = userLoading && !currentUser;
  const shouldRedirectToLogin = isInitialLoad && errorMessage?.includes('No authentication token');
  const showServerConfigError = errorMessage?.includes('No home instance configured');

  async function fetchChannelsData(authToken: string): Promise<void> {
    try {
      const response = await listChannels(authToken);
      if (response.success && response.data && response.data.channels) {
        setChannels(response.data.channels);
        setChannelsError(null);
        logger.ui.info("Channels fetched successfully", { count: response.data.channels.length });
      } else {
        logger.ui.error("Failed to fetch channels", { error: response.error });
        setChannels([]);
        setChannelsError(response.error || 'Failed to load channels');
      }
    } catch (error) {
      logger.ui.error("Unexpected error fetching channels", { error: error instanceof Error ? error.message : String(error) });
      setChannels([]);
      setChannelsError('Failed to load channels due to configuration error');
    }
  }

  async function fetchUsersData(authToken: string): Promise<void> {
    try {
      const response = await listUsers(authToken);
      if (response.success && response.data && response.data.users) {
        setUsers(response.data.users);
        setUsersError(null);
        logger.ui.info("Users fetched successfully", { count: response.data.users.length });
      } else {
        logger.ui.error("Failed to fetch users", { error: response.error });
        setUsers([]);
        setUsersError(response.error || 'Failed to load server members');
      }
    } catch (error) {
      logger.ui.error("Unexpected error fetching users", { error: error instanceof Error ? error.message : String(error) });
      setUsers([]);
      setUsersError('Failed to load server members due to configuration error');
    }
  }

  async function fetchServerInfoData(authToken: string): Promise<void> {
    try {
      if (!authToken) {
        return;
      }

      const response = await getServerInfo();
      if (response.success && response.data && response.data.server_info) {
        setServerInfo(response.data.server_info);
        setServerInfoError(null);
        logger.ui.info("Server info fetched successfully");
      } else {
        logger.ui.error("Failed to fetch server info", { error: response.error });
        setServerInfo(null);
        setServerInfoError(response.error || 'Failed to load server information');
      }
    } catch (error) {
      logger.ui.error("Unexpected error fetching server info", { error: error instanceof Error ? error.message : String(error) });
      setServerInfo(null);
      setServerInfoError('Failed to load server information due to configuration error');
    }
  }

  async function fetchReadHistoryData(authToken: string): Promise<void> {
    try {
      const hostPort = getHostPortFromStorage() || getHostPortFromCookies();
      if (!hostPort) {
        return;
      }

      const response = await getMessageReadHistory(hostPort, authToken);
      if (response.success && response.data) {
        applyReadHistorySnapshot(
          response.data.viewed_message_ids || [],
          response.data.unread_counts || {},
        );
        logger.ui.debug("Read history fetched successfully", {
          readCount: response.data.viewed_message_ids?.length || 0,
          unreadChannels: Object.keys(response.data.unread_counts || {}).length,
        });
      }
    } catch (error) {
      logger.ui.warn("Failed to fetch read history snapshot", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Handle redirects after all hooks are declared
  useEffect(() => {
    if (shouldRedirectToLogin) {
      logger.ui.error('Authentication failure during initial load, redirecting to login', { error: errorMessage });
      navigate(loginRedirectPath, { replace: true });
    }
  }, [errorMessage, loginRedirectPath, navigate, shouldRedirectToLogin]);

  // Handle click outside to close server dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (serverDropdownRef.current && !serverDropdownRef.current.contains(event.target as Node)) {
        setServerDropdownOpen(false);
      }
    };

    if (serverDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [serverDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target as Node)
      ) {
        setNotificationMenuOpen(false);
      }
    };

    if (notificationMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationMenuOpen]);

  // Handle click outside to close user card tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isTooltipOpen) {
        setIsTooltipOpen(false);
      }
    };

    if (isTooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTooltipOpen]);

  useEffect(() => {
    resizeMessageComposer();
  }, [messageInput, resizeMessageComposer]);

  useEffect(() => {
    if (!selectedChannel) {
      flushPendingDraftPersistence();
      return;
    }

    scheduleDraftPersistence(selectedChannel.channel_id, messageInput);
  }, [flushPendingDraftPersistence, messageInput, scheduleDraftPersistence, selectedChannel]);

  useEffect(() => () => {
    flushPendingDraftPersistence();
  }, [flushPendingDraftPersistence]);

  useEffect(() => () => {
    composerAttachmentPreviews.forEach((preview) => {
      if (preview.url) {
        URL.revokeObjectURL(preview.url);
      }
    });
  }, [composerAttachmentPreviews]);

  // Auto-scroll messages to bottom when new messages arrive or are first loaded
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      // Use setTimeout to ensure DOM has updated with new messages
      setTimeout(() => {
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          container.scrollTop = container.scrollHeight;
        }
      }, 50); // Small delay to ensure DOM update
    }
  }, [messages.length]);

  useEffect(() => {
    if (!selectedChannel || !currentUser || messages.length === 0) {
      return;
    }

    if (unreadMarker?.channelId !== selectedChannel.channel_id) {
      const firstUnreadMessage = messages.find(
        (message) =>
          message.sender_user_id !== currentUser.user_id &&
          !readMessageIdsRef.current.has(message.message_id),
      );
      if (firstUnreadMessage) {
        setUnreadMarker({
          channelId: selectedChannel.channel_id,
          messageId: firstUnreadMessage.message_id,
        });
      }
    }

    const unreadVisibleMessageIds = messages
      .filter(
        (message) =>
          message.sender_user_id !== currentUser.user_id &&
          !readMessageIds.has(message.message_id),
      )
      .map((message) => message.message_id);

    if (unreadVisibleMessageIds.length === 0) {
      return;
    }

    void markMessagesRead(selectedChannel.channel_id, unreadVisibleMessageIds);
  }, [messages, selectedChannel, currentUser, readMessageIds, markMessagesRead, unreadMarker]);

  // Fetch channels, users, and server info on mount
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      return;
    }

    void Promise.all([
      fetchChannelsData(authToken),
      fetchUsersData(authToken),
      fetchServerInfoData(authToken),
      fetchReadHistoryData(authToken),
    ]);
  }, [currentUser]);

  // Initialize from persisted state after channels are loaded
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      // Try to restore previously selected channel
      if (persistedChannelId) {
        const persistedChannel = channels.find(c => c.channel_id === persistedChannelId);
        if (persistedChannel) {
          logger.ui.debug("Restoring previously selected channel", { channelId: persistedChannel.channel_id });

          // Set the selected channel and load messages automatically
          setSelectedChannel(persistedChannel);

          // Restore message draft for the persisted channel
          const restoredDraft = getMessageDraft(persistedChannel.channel_id);
          setMessageInput(restoredDraft);

          // Load messages and setup WebSocket connection for the restored channel
          loadChannelMessages(persistedChannel);
          // Note: We don't call persistSelectedChannel here since it was already persisted
        } else {
          logger.ui.warn("Persisted channel not found, selecting first available channel", { persistedChannelId });
          // Persisted channel no longer exists, select the first available channel
          const firstChannel = channels[0];
          handleChannelSelect(firstChannel);
        }
      } else {
        // No persisted channel, select the first available channel
        logger.ui.debug("No persisted channel found, selecting first available channel");
        const firstChannel = channels[0];
        handleChannelSelect(firstChannel);
      }
    }
  }, [channels, persistedChannelId, selectedChannel]);

  const showUnsupportedSingleInstanceAction = (action: string, detail: string) => {
    showToast({
      message: `${action} is not available on this home instance yet. ${detail}`,
      tone: "warning",
      category: "system",
      dedupeKey: `dashboard:unsupported:${action.toLowerCase().replace(/\s+/g, "-")}`,
    });
  };

  const handleCreateChannel = async (channelData: { name: string; type: 'text' | 'voice'; description?: string; isPrivate?: boolean }) => {
    try {
      const authToken = getAuthTokenFromCookies() || '';

      const response = await createChannel({
        channel_name: channelData.name,
        is_private: channelData.isPrivate || false,
        channel_type: channelData.type
      }, authToken);

      if (response.success && response.data) {
        logger.ui.info("Channel created successfully", {
          channelName: channelData.name,
          isPrivate: channelData.isPrivate
        });

        const createdChannel = (response.data as any)?.channel_data as Channel | undefined;

        showToast({
          message: `Channel #${channelData.name} created successfully.`,
          tone: "success",
          category: "destructive",
        });

        // Refresh channels list
        const channelsResponse = await listChannels(authToken);
        if (channelsResponse.success && channelsResponse.data) {
          setChannels(channelsResponse.data.channels);
          if (createdChannel?.channel_id) {
            const matchingChannel = channelsResponse.data.channels.find(
              (channel) => channel.channel_id === createdChannel.channel_id,
            );
            if (matchingChannel) {
              await handleChannelSelect(matchingChannel);
            }
          }
        }

        // Close modals
        setChannelCreationModalOpen(false);
      } else {
        // Handle specific error codes
        if (response.error?.includes('409') || response.error?.includes('Channel name already exists')) {
          showToast({
            message: "Channel name already exists, please choose a different name.",
            tone: "error",
            category: "validation",
          });
        } else if (response.error?.includes('403') || response.error?.includes('Access forbidden')) {
          showToast({
            message: "Access forbidden. Your current instance role does not allow channel creation.",
            tone: "error",
            category: "system",
          });
        } else {
          showToast({
            message: `Failed to create channel: ${response.error || "Unknown error"}`,
            tone: "error",
            category: "system",
          });
        }
        logger.ui.error("Failed to create channel", { error: response.error, channelData });
      }
    } catch (error) {
      showToast({
        message: "An unexpected error occurred while creating the channel.",
        tone: "error",
        category: "system",
      });
      logger.ui.error("Unexpected error creating channel", { error, channelData });
    }
  };

  const handleSearch = async (query: string) => {
    // Mock search results
    return [
      { id: "1", type: "message" as const, title: "Alice", subtitle: "#general", content: `Message containing "${query}"`, timestamp: new Date().toISOString() },
      { id: "2", type: "user" as const, title: "Bob", subtitle: "Online" },
      { id: "3", type: "channel" as const, title: "#random", subtitle: "Text Channel" },
    ].filter(result =>
      result.title.toLowerCase().includes(query.toLowerCase()) ||
      result.content?.toLowerCase().includes(query.toLowerCase())
    );
  };

  const handleSelectSearchResult = (result: any) => {
    logger.ui.debug("Selected dashboard search result", { resultType: result?.type, resultId: result?.id });
    // TODO: Navigate to result
  };

  const handleInviteActionUnavailable = () => {
    showUnsupportedSingleInstanceAction(
      "Invite links",
      "This home instance does not expose invite creation through the current API."
    );
  };

  // Message action handlers
  const handleMessageReply = (messageId: string | null) => {
    if (!messageId) {
      logger.ui.warn("Reply action invoked without a message ID");
      return;
    }
    const targetMessage = getMessageById(messageId);
    if (!targetMessage) {
      showToast({
        message: "The message you tried to reply to is no longer available.",
        tone: "error",
        category: "validation",
      });
      return;
    }

    logger.ui.debug("Reply action selected", { messageId });
    setReplyTarget(targetMessage);
    setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
    requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
  };

  const handleMessageReact = (messageId: string) => {
    logger.ui.debug("Reaction action selected", { messageId });
    // TODO: Implement reaction functionality
  };

  const handleMessageReport = (messageId: string | null) => {
    if (!messageId) {
      logger.ui.warn("Report action invoked without a message ID");
      return;
    }
    // Handle single message report by opening modal
    setReportModal({ isOpen: true, targetType: 'message', messages: [messageId] });
  };

  const handleMessageReportSubmit = async (report: { category: string; description: string }) => {
    const { category, description } = report;
    const authToken = getAuthTokenFromCookies() || '';

    if (!authToken) {
      showToast({
        message: "You need to be signed in to submit reports.",
        tone: "error",
        category: "system",
      });
      return;
    }

    if (reportModal.targetType === 'user' && reportModal.targetUserId) {
      const response = await submitUserReport({
        auth_token: authToken,
        target_user_id: reportModal.targetUserId,
        category,
        description,
      });

      if (!response.success) {
        showToast({
          message: `Failed to submit user report: ${response.error || 'Unknown error'}`,
          tone: "error",
          category: "system",
        });
        return;
      }

      showToast({
        message: `Report submitted for ${reportModal.targetUsername || 'this user'}.`,
        tone: "success",
        category: "system",
      });
      logger.ui.info("User report submitted", {
        targetUserId: reportModal.targetUserId,
        category,
      });
      setReportModal({ isOpen: false, targetType: 'message', messages: [] });
      return;
    }

    const response = await submitMessageReport({
      auth_token: authToken,
      message_ids: reportModal.messages,
      category,
      description,
    });

    if (!response.success) {
      showToast({
        message: `Failed to submit message report: ${response.error || 'Unknown error'}`,
        tone: "error",
        category: "system",
      });
      return;
    }

    showToast({
      message: "Report submitted successfully. Thank you for helping keep the community safe.",
      tone: "success",
      category: "system",
    });
    setReportModal({ isOpen: false, targetType: 'message', messages: [] });
    logger.ui.info("Message report submitted", {
      messageCount: reportModal.messages.length,
      category,
      descriptionLength: description.length
    });
  };

  const handleMessageGroupContextMenu = (messageIds: string[], event: React.MouseEvent) => {
    event.preventDefault();

    // Set up group-specific handlers
    const groupCopyHandler = async () => {
      try {
        await navigator.clipboard.writeText(messageIds.join(','));
        logger.ui.info("Message group IDs copied to clipboard", { count: messageIds.length });
      } catch (error) {
        logger.ui.error("Failed to copy message group IDs to clipboard", { error });
        showToast({
          message: "Failed to copy message IDs to clipboard. Please try again.",
          tone: "error",
          category: "validation",
        });
      }
    };

    const groupReportHandler = () => {
      // Report all messages in the group
      setReportModal({ isOpen: true, targetType: 'message', messages: messageIds });
    };

    setMessageContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      customCopyLinkLabel: 'Copy Message IDs',
      customReportLabel: 'Report Messages',
      onCopyLink: groupCopyHandler,
      onReport: groupReportHandler
    });
  };

  const handleMessageCopy = async (messageId: string | null) => {
    if (!messageId) {
      showToast({
        message: "Message ID not available to copy.",
        tone: "error",
        category: "validation",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(messageId);
      logger.ui.info("Message ID copied to clipboard", { messageId: "[REDACTED]" });
    } catch (error) {
      logger.ui.error("Failed to copy message ID to clipboard", { error });
      showToast({
        message: "Failed to copy message ID to clipboard. Please try again.",
        tone: "error",
        category: "validation",
      });
    }
  };

  const handleUserReport = (userId: string, username?: string) => {
    logger.ui.debug("User report action selected", { userId });
    setReportModal({
      isOpen: true,
      targetType: 'user',
      messages: [],
      targetUserId: userId,
      targetUsername: username,
    });
    setUserContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
  };

  const handleCopyUserId = async (userId: string) => {
    try {
      await navigator.clipboard.writeText(userId);
      logger.ui.info("User ID copied to clipboard", { userId: "[REDACTED]" });
    } catch (error) {
      logger.ui.error("Failed to copy user ID to clipboard", { error });
      showToast({
        message: "Failed to copy user ID to clipboard. Please try again.",
        tone: "error",
        category: "validation",
      });
    }
  };

  const handleSendMessageToUser = (userId: string) => {
    logger.ui.debug("Direct message action selected", { userId });
    showUnsupportedSingleInstanceAction(
      "Direct messages",
      "Federated direct messages on Pufferblow go through your home instance ActivityPub routes. This quick action still needs a dedicated conversation surface.",
    );
    setUserContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
    setSelectedContextUser(null);
  };

  const handleMentionUser = (username: string) => {
    setMessageInput((prev) => {
      const prefix = prev.trim().length > 0 ? `${prev} ` : '';
      return `${prefix}@${username} `;
    });
    setUserContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
    requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
  };

  const openUserContextMenu = (
    userId: string,
    username: string,
    event: React.MouseEvent,
    source: 'userpanel' | 'members' | 'messages' = 'messages',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedContextUser({
      userId,
      username,
      anchorElement: event.currentTarget as HTMLElement,
      source,
    });
    setUserContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const appendUniqueMessage = useCallback((incomingMessage: Message) => {
    setMessages((prevMessages) => {
      const existingIndex = prevMessages.findIndex(
        (message) => message.message_id === incomingMessage.message_id,
      );

      if (existingIndex >= 0) {
        const nextMessages = [...prevMessages];
        nextMessages[existingIndex] = {
          ...nextMessages[existingIndex],
          ...incomingMessage,
        };
        return nextMessages;
      }

      return [...prevMessages, incomingMessage];
    });
  }, []);

  // Extracted message loading logic for reuse
  const loadChannelMessages = async (channel: Channel) => {
    const authToken = getAuthTokenFromCookies() || '';
    const hostPort = getHostPortFromStorage() || getHostPortFromCookies();

    logger.ui.debug("Loading channel messages", {
      channelId: channel.channel_id,
      hasAuthToken: Boolean(authToken),
      hasHomeInstance: Boolean(hostPort),
    });

    if (authToken && channel.channel_id && hostPort) {
      const response = await loadMessages(hostPort, channel.channel_id, authToken);

      if (response.success && response.data && response.data.messages) {
        setMessages(response.data.messages);
        logger.ui.info("Messages loaded successfully", { channelId: channel.channel_id, count: response.data.messages.length });

        // Establish WebSocket connection after loading messages
        if (currentUser) {
          logger.network.info("Establishing dashboard WebSocket connection", { channelId: channel.channel_id });
          const wsConnection = createGlobalWebSocket(authToken, hostPort, {
            onMessage: (message) => {
              logger.network.debug("Dashboard WebSocket message received", { type: message.type, channelId: message.channel_id });

              if (
                message.type === 'user_status_changed' &&
                message.user_id &&
                message.status &&
                (
                  message.status === 'online' ||
                  message.status === 'idle' ||
                  message.status === 'afk' ||
                  message.status === 'dnd' ||
                  message.status === 'offline'
                )
              ) {
                applyPresenceUpdate(message.user_id, message.status);
                return;
              }

              if (!isChatWebSocketMessage(message)) {
                return;
              }

              const incomingChannelId = message.channel_id || channel.channel_id;
              const normalizedMessage = {
                ...normalizeChatWebSocketMessage(message),
                channel_id: incomingChannelId,
              };

              const currentUserId = currentUserIdRef.current;
              const isOwnMessage =
                Boolean(currentUserId) &&
                normalizedMessage.sender_user_id === currentUserId;
              const isAlreadyProcessed = seenRealtimeMessageIdsRef.current.has(
                normalizedMessage.message_id,
              );
              seenRealtimeMessageIdsRef.current.add(normalizedMessage.message_id);

              if (incomingChannelId === selectedChannelIdRef.current) {
                appendUniqueMessage(normalizedMessage);

                if (!isOwnMessage) {
                  void markMessagesRead(incomingChannelId, [
                    normalizedMessage.message_id,
                  ]);
                }
              }

              if (
                isOwnMessage ||
                isAlreadyProcessed ||
                readMessageIdsRef.current.has(normalizedMessage.message_id)
              ) {
                return;
              }

              const channelName =
                channels.find((item) => item.channel_id === incomingChannelId)?.channel_name ||
                'channel';
              const body =
                normalizedMessage.message?.trim() ||
                (normalizedMessage.attachments?.length
                  ? 'Sent an attachment.'
                  : 'New message received.');
              const mentionHandle = currentUser?.username
                ? `@${currentUser.username.toLowerCase()}`
                : null;
              const isMention = mentionHandle
                ? body.toLowerCase().includes(mentionHandle)
                : false;

              setUnreadCountsByChannel((prev) => ({
                ...prev,
                [incomingChannelId]: (prev[incomingChannelId] || 0) + 1,
              }));

              setNotifications((prev) => [
                {
                  id: normalizedMessage.message_id,
                  title: normalizedMessage.username || 'New message',
                  body,
                  channelId: incomingChannelId,
                  channelName,
                  createdAt: normalizedMessage.sent_at || new Date().toISOString(),
                  unread: true,
                  kind: isMention ? ('mention' as const) : ('message' as const),
                },
                ...prev.filter(
                  (notification) =>
                    notification.id !== normalizedMessage.message_id,
                ),
              ].slice(0, 25));

              if (
                incomingChannelId !== selectedChannelIdRef.current &&
                typeof window !== 'undefined' &&
                document.hidden &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                new Notification(
                  `${normalizedMessage.username || 'Someone'} in #${channelName}`,
                  {
                    body,
                  },
                );
              }
            },
            onConnected: () => {
              logger.network.info("Dashboard WebSocket connected", { channelId: channel.channel_id });
            },
            onDisconnected: (reason) => {
              logger.network.info("Dashboard WebSocket disconnected", { channelId: channel.channel_id, reason });
            },
            onError: (error) => {
              logger.network.error("Dashboard WebSocket error", { channelId: channel.channel_id, error });
              showToast({
                message: "Connection error. Messages may not update in real-time.",
                tone: "error",
                category: "system",
              });
            }
          });
          wsConnection.connect();
          setWebSocketConnection(wsConnection);
        }
      } else {
        logger.ui.error("Failed to load messages", { channelId: channel.channel_id, error: response.error });
        setMessages([]); // Clear messages if failed
      }
    } else {
      logger.ui.warn("Skipping message load because prerequisites are missing", {
        channelId: channel.channel_id,
        hasAuthToken: Boolean(authToken),
        hasHomeInstance: Boolean(hostPort),
      });
    }
  };

  const handleChannelSelect = async (channel: Channel) => {
    logger.ui.debug("Channel selected", { channelId: channel.channel_id, channelName: channel.channel_name });

    flushPendingDraftPersistence();

    // Disconnect from previous WebSocket if exists
    if (webSocketConnection) {
      webSocketConnection.disconnect();
      setWebSocketConnection(null);
    }

    setSelectedChannel(channel);
    setReplyTarget(null);
    setNotificationMenuOpen(false);
    setUnreadMarker(null);
    markChannelNotificationsRead(channel.channel_id);
    setUnreadCountsByChannel((prev) => {
      const next = { ...prev };
      delete next[channel.channel_id];
      return next;
    });

    // Persist the selected channel
    persistSelectedChannel(channel.channel_id);

    // Restore message draft for the new channel
    const restoredDraft = getMessageDraft(channel.channel_id);
    setMessageInput(restoredDraft);

    // Load messages for the selected channel using the extracted function
    await loadChannelMessages(channel);
  };

  const handleNotificationSelect = async (notification: NotificationItem) => {
    const channel = channels.find(
      (candidate) => candidate.channel_id === notification.channelId,
    );
    if (!channel) {
      return;
    }

    setNotifications((prev) =>
      prev.filter((item) => item.id !== notification.id),
    );
    await handleChannelSelect(channel);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications([]);
    setUnreadCountsByChannel({});
  };

  const handleEnableBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserNotificationPermission('unsupported');
      return;
    }

    const permission = await Notification.requestPermission();
    setBrowserNotificationPermission(permission);

    showToast({
      message:
        permission === 'granted'
          ? 'Browser notifications enabled.'
          : permission === 'denied'
            ? 'Browser notifications were blocked.'
            : 'Browser notification prompt dismissed.',
      tone: permission === 'granted' ? 'success' : 'warning',
      category: 'system',
    });
  };

  const handleJumpToFirstUnread = () => {
    unreadDividerRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const handleStatusChange = async (
    status: 'online' | 'idle' | 'afk' | 'dnd' | 'offline',
  ) => {
    lastActivityAtRef.current = Date.now();
    await updatePresenceStatus(status, {
      silent: false,
      lockMode:
        status === 'dnd' || status === 'afk' || status === 'offline'
          ? 'set'
          : 'clear',
    });
  };

  const handleMessageContextMenu = (messageId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setMessageContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY }
    });
  };

  const handleChannelContextMenu = (event: React.MouseEvent, channel: Channel) => {
    event.preventDefault();
    if (canDeleteChannels) {
      setChannelContextMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        channel: channel
      });
    }
  };

  const handleUserTimeout = async (userId: string, username: string) => {
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      showToast({
        message: "You need to be signed in to moderate users.",
        tone: "error",
        category: "system",
      });
      return;
    }

    const durationInput = window.prompt(`Timeout ${username} for how many minutes?`, '60');
    if (!durationInput) {
      return;
    }

    const durationMinutes = Number.parseInt(durationInput, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      showToast({
        message: "Please enter a valid timeout duration in minutes.",
        tone: "error",
        category: "validation",
      });
      return;
    }

    const reason = window.prompt(`Optional timeout reason for ${username}:`, '') || undefined;
    const response = await timeoutUser(userId, {
      auth_token: authToken,
      duration_minutes: durationMinutes,
      reason,
    });

    if (!response.success) {
      showToast({
        message: `Failed to timeout ${username}: ${response.error || 'Unknown error'}`,
        tone: "error",
        category: "system",
      });
      return;
    }

    showToast({
      message: `${username} has been timed out for ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}.`,
      tone: "success",
      category: "destructive",
    });
    setUserContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
    setSelectedContextUser(null);
  };

  const handleUserBan = async (userId: string, username: string) => {
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      showToast({
        message: "You need to be signed in to moderate users.",
        tone: "error",
        category: "system",
      });
      return;
    }

    const confirmed = window.confirm(`Ban ${username} from this home instance?`);
    if (!confirmed) {
      return;
    }

    const reason = window.prompt(`Optional ban reason for ${username}:`, '') || undefined;
    const response = await banUser(userId, {
      auth_token: authToken,
      reason,
    });

    if (!response.success) {
      showToast({
        message: `Failed to ban ${username}: ${response.error || 'Unknown error'}`,
        tone: "error",
        category: "system",
      });
      return;
    }

    showToast({
      message: `${username} has been banned from this home instance.`,
      tone: "success",
      category: "destructive",
    });
    setUserContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
    setSelectedContextUser(null);
  };

  // Message input handlers
  const canSendMessage =
    Boolean(selectedChannel) &&
    !isSendingMessage &&
    (Boolean(messageInput.trim()) || messageAttachments.length > 0);

  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    const outgoingMessage = buildReplyMessage(trimmedMessage || '', replyTarget);

    // Require either a message or attachments
    const hasContent = trimmedMessage || messageAttachments.length > 0;

    if (!hasContent) {
      return;
    }

    // Validate message for security and length if present
    if (trimmedMessage) {
      const validationResult = validateMessageInput(
        trimmedMessage,
        uploadPolicy.maxMessageLength ?? Number.MAX_SAFE_INTEGER,
      );
      if (!validationResult.isValid) {
        showToast({
          message: validationResult.error || "Invalid message content.",
          tone: "error",
          category: "validation",
          dedupeKey: "dashboard:invalid-message-content",
        });
        return;
      }
    }

    const authToken = getAuthTokenFromCookies() || '';

    if (!selectedChannel || !authToken) {
      logger.ui.warn("Cannot send message - no channel selected or no auth token");
      return;
    }

    try {
      setIsSendingMessage(true);
      logger.ui.debug('Sending message', {
        channelId: selectedChannel.channel_id,
        messageLength: outgoingMessage.length,
        attachments: messageAttachments.length,
        isReply: Boolean(replyTarget),
      });

      // Send via REST API (attachments require multipart/form-data)
      const messageData = {
        content: outgoingMessage || '', // Empty string if only attachments
        sentAt: new Date().toISOString(),
        attachments: messageAttachments.length > 0 ? messageAttachments : undefined
      };

      const resolvedInstance =
        resolveStoredInstance(getHostPortFromStorage()) ??
        resolveStoredInstance(getHostPortFromCookies());
      if (!resolvedInstance) {
        throw new Error('No home instance configured');
      }
      const response = await sendMessage(
        resolvedInstance.raw,
        selectedChannel.channel_id,
        messageData,
        authToken,
      );
      logger.ui.debug('Send message response received', {
        channelId: selectedChannel.channel_id,
        success: response.success,
        hasError: Boolean(response.error),
      });

      if (response.success) {
        logger.ui.info("Message sent successfully", {
          channelId: selectedChannel.channel_id,
          messageLength: outgoingMessage.length,
          attachmentCount: messageAttachments.length
        });

        // Clear input, draft, and attachments
        cancelPendingDraftPersistence();
        setMessageInput('');
        setMessageAttachments([]);
        setReplyTarget(null);
        if (selectedChannel) {
          clearMessageDraft(selectedChannel.channel_id);
        }

        const createdMessage = response.data?.message_data;
        if (createdMessage) {
          appendUniqueMessage(createdMessage);
        }

      } else {
        logger.ui.error("Failed to send message", { error: response.error });
        showToast({
          message: `Failed to send message: ${response.error || "Unknown error"}`,
          tone: "error",
          category: "system",
        });
      }
    } catch (error) {
      logger.ui.error("Unexpected error sending message", { error });
      showToast({
        message: "An unexpected error occurred while sending the message.",
        tone: "error",
        category: "system",
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleKeyPress = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    // Keep IME composition flow intact (e.g., JP/CN/KR keyboards).
    if (event.nativeEvent.isComposing) {
      return;
    }

    // Send only on plain Enter. Any modifier keeps normal newline behavior.
    const isPlainEnter =
      !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
    if (!isPlainEnter) {
      return;
    }

    event.preventDefault();
    await handleSendMessage();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const attachments: File[] = [];
    const existingTotalSize = messageAttachments.reduce((sum, attachment) => sum + attachment.size, 0);
    let nextTotalSize = existingTotalSize;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/^\./, '') || '';
      const category = getAttachmentCategory(file, uploadPolicy);
      const allowedExtensions =
        category === 'image'
          ? uploadPolicy.imageExtensions
          : category === 'video'
            ? uploadPolicy.videoExtensions
            : category === 'audio'
              ? uploadPolicy.audioExtensions
              : uploadPolicy.fileExtensions;
      const maxSizeMb = uploadPolicy.maxSizesByCategory[category];

      if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
        logger.ui.warn("Rejected dangerous file upload", {
          fileName: file.name,
          extension,
          reason: "extension blocked by instance policy",
        });
        showToast({
          message: `File "${file.name}" is not allowed by this instance.`,
          tone: "error",
          category: "validation",
        });
        event.target.value = ''; // Clear the input
        return;
      }

      if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
        logger.ui.warn("Rejected large file upload", {
          fileName: file.name,
          fileSize: file.size,
          maxSizeMb,
          category,
        });
        showToast({
          message: `File "${file.name}" is too large for this instance. Maximum ${category} size is ${maxSizeMb}MB.`,
          tone: "error",
          category: "validation",
        });
        event.target.value = '';
        return;
      }

      nextTotalSize += file.size;
      if (
        uploadPolicy.maxTotalAttachmentSizeMb &&
        nextTotalSize > uploadPolicy.maxTotalAttachmentSizeMb * 1024 * 1024
      ) {
        logger.ui.warn("Rejected attachments - total size too large", {
          totalSize: nextTotalSize,
          maxTotalSizeMb: uploadPolicy.maxTotalAttachmentSizeMb,
        });
        showToast({
          message: `Combined attachment size exceeds this instance limit of ${uploadPolicy.maxTotalAttachmentSizeMb}MB.`,
          tone: "error",
          category: "validation",
        });
        event.target.value = '';
        return;
      }

      attachments.push(file);
    }

    // Add new attachments to existing ones
    setMessageAttachments(prev => [...prev, ...attachments]);

    logger.ui.info("Attachments added to message", {
      count: attachments.length,
      fileNames: attachments.map(f => f.name),
      totalSize: nextTotalSize
    });

    // Clear the input so same files can be selected again if needed
    event.target.value = '';
  };

  const removeAttachment = (indexToRemove: number) => {
    setMessageAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleEmojiClick = (event: React.MouseEvent) => {
    event.preventDefault();

    setIsEmojiPickerOpen(!isEmojiPickerOpen);
    logger.ui.debug("Emoji picker toggled", { isOpen: !isEmojiPickerOpen });
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
    setIsEmojiPickerOpen(false);
    logger.ui.debug("Emoji added to message", { emoji });
  };

  const handleGifSelect = (gif: { url: string; title: string }) => {
    // For now, just log the GIF selection - in a real app you'd send this to the message
    logger.ui.info("GIF selected", { gifUrl: gif.url, gifTitle: gif.title });
    setIsEmojiPickerOpen(false);
    // TODO: Implement GIF sending functionality
  };

  const handleUserClick = async (userId: string, username: string, event: React.MouseEvent, tooltipSource?: 'userpanel' | 'members' | 'messages') => {
    event.preventDefault();

    // Close tooltip if clicking on the same element
    if (isTooltipOpen) {
      setIsTooltipOpen(false);
      return;
    }

    // Show loading tooltip immediately
    const loadingUser: DisplayUser = {
      id: userId,
      username: username,
      avatar: createFallbackAvatarUrl(username),
      banner: undefined,
      accentColor: 'var(--color-accent)',
      bannerColor: undefined,
      customStatus: 'Loading...',
      externalLinks: [],
      status: 'idle', // Show as idle while loading
      bio: 'Loading user information...',
      joinedAt: '',
      originServer: serverInfo?.server_name || 'Pufferblow Home Instance',
      roles: ['Member'],
      activity: {
        type: 'playing' as const,
        name: 'Loading...',
        details: 'Please wait'
      }
    };
    showUserCardTooltip(loadingUser, event, tooltipSource);

    try {
      // Fetch user profile from API
      const hostPort = getHostPortFromStorage();
      const authToken = getAuthTokenFromCookies();

      if (!hostPort || !authToken) {
        throw new Error('Missing server configuration or authentication');
      }

      const response = await getUserProfileById(hostPort!, userId, authToken!);

      const displayedUsername = username;

      if (response.success && response.data?.user_data) {
        const userData = response.data.user_data;

        const displayUser: DisplayUser = {
          id: userData.user_id || userId,
          username: displayedUsername,
          avatar: userData.avatar_url ? createFullUrl(userData.avatar_url) || createFallbackAvatarUrl(displayedUsername) : createFallbackAvatarUrl(displayedUsername),
          banner: userData.banner_url ? createFullUrl(userData.banner_url) : undefined,
          accentColor: getUserAccentColor(userData.roles_ids),
          bannerColor: getUserAccentColor(userData.roles_ids),
          customStatus: userData.roles_ids?.includes('owner') ? 'Server Owner' : userData.roles_ids?.includes('admin') ? 'Administrator' : 'Active Member',
          externalLinks: [], // Would be loaded from user preferences/settings in real implementation
          status: (
            userData.status === 'online' ||
            userData.status === 'idle' ||
            userData.status === 'afk' ||
            userData.status === 'dnd' ||
            userData.status === 'offline'
          ) ? userData.status as 'online' | 'idle' | 'afk' | 'dnd' | 'offline' : 'offline',
          bio: userData.about || 'Active member of this home instance community.',
          joinedAt: userData.created_at || '',
          originServer: userData.origin_server || serverInfo?.server_name || 'Pufferblow Home Instance',
          roles: getUserRoles(userData.roles_ids).map(role => role.toString()),
          activity: undefined, // Could be extended later
          mutualServers: undefined, // Could be calculated later
          mutualFriends: undefined, // Could be extended later
          badges: [] // Could be extended later
        };

        // Update tooltip with loaded data
        setUserCardTooltipUser(displayUser);
        setIsTooltipOpen(true);
      } else {
        throw new Error(response.error || 'Failed to fetch user profile');
      }
    } catch (error) {
      logger.ui.error('Error fetching user profile', { error: error instanceof Error ? error.message : String(error), userId });

      // Show error in tooltip instead of toast (which might trigger more redirects)
      const errorUser: DisplayUser = {
        id: userId,
        username: username,
        avatar: createFallbackAvatarUrl(username),
        banner: undefined,
        accentColor: 'var(--color-error)',
        bannerColor: undefined,
        customStatus: 'Error Loading',
        externalLinks: [],
        status: 'offline',
        bio: 'Failed to load user information. Please try again later.',
        joinedAt: '',
        originServer: serverInfo?.server_name || 'Pufferblow Home Instance',
        roles: ['Member'],
        activity: {
          type: 'playing' as const,
          name: 'Offline',
          details: 'User data unavailable'
        }
      };

      // Update tooltip with error state
      setUserCardTooltipUser(errorUser);
      setIsTooltipOpen(true);

      // Don't show toast here as it could cause more issues if errors are compounding
      logger.ui.warn('User profile load failed, showing fallback tooltip', { userId, error });
    }
  };

  // Helper function for user card tooltip
  const showUserCardTooltip = (user: DisplayUser, event: React.MouseEvent, source?: 'userpanel' | 'members' | 'messages') => {
    const activeSource = source ?? tooltipSource;
    if (source) {
      setTooltipSource(source);
    }
    const target = event.currentTarget as HTMLElement;
    setReferenceElement(target);
    setTooltipPosition(calculateTooltipPosition(target, activeSource));
    setUserCardTooltipUser(user);
    setIsTooltipOpen(true);
  };

  if (showServerConfigError) {
    logger.ui.error('Server configuration error', { error: errorMessage });
    return (
      <div className="h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center text-[var(--color-text)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-[var(--color-text)]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.6-.833-2.37 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold">Home Instance Configuration Error</h2>
          <p className="mb-4 text-[var(--color-text-secondary)]">Unable to connect to your configured home instance. Check the instance address in settings and try again.</p>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-6 py-2 font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loadingTimeout) {
    return (
      <div className="h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center text-[var(--color-text)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-[var(--color-text)]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.6-.833-2.37 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Loading Timeout</h2>
          <p className="text-[var(--color-text-secondary)] mb-4">The app took too long to load. This may be due to a network issue or server problems.</p>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-6 py-2 font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="h-screen bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none relative">
        <div className="w-16 bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col items-center py-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent animate-pulse">
          <div className="w-8 h-px bg-[var(--color-surface-tertiary)] rounded mb-2"></div>

          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-12 h-12 rounded-2xl bg-[var(--color-surface-secondary)] shadow-lg border border-[var(--color-border)] flex items-center justify-center group">
              <div className="w-8 h-8 rounded bg-[var(--color-surface-tertiary)] opacity-60"></div>
            </div>
          ))}

          <AddServerButton
            disabled
            title="Additional home instances are not available in this build"
            ariaLabel="Additional home instances are not available in this build"
          />
        </div>

        <div className="w-72 lg:w-80 min-w-[16rem] max-w-[22rem] bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col overflow-hidden animate-pulse">
          <div className="relative">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="h-5 bg-[var(--color-surface-tertiary)] rounded mb-1 w-32"></div>
                  <div className="h-3 bg-[var(--color-surface-tertiary)] rounded w-48"></div>
                </div>
                <div className="w-8 h-8 bg-[var(--color-surface-secondary)] rounded-lg"></div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-2 py-4">
              <div className="flex items-center px-2 mb-1">
                <svg className="w-3 h-3 text-[var(--color-text-secondary)] mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <div className="h-3 bg-[var(--color-surface-secondary)] rounded w-16"></div>
              </div>

              <div className="space-y-0.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex items-center px-2 py-1.5 rounded hover:bg-[var(--color-surface-tertiary)] cursor-pointer group transition-colors">
                    <div className="w-2 h-2 bg-[var(--color-surface-secondary)] rounded-full mr-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className={`h-3 bg-gradient-to-r from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] rounded ${i % 3 === 0 ? 'w-20' : i % 4 === 0 ? 'w-28' : 'w-16'}`}></div>
                    </div>
                    {i % 5 === 0 && (
                      <svg className="w-4 h-4 text-[var(--color-text-muted)] ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <UserPanel
            username="Loading..."
            avatar="/pufferblow-art-pixel-32x32.png"
            status="offline"
            onClick={() => { }}
            className="opacity-60"
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden animate-pulse">
          <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
            <div className="flex items-center">
              <span className="text-[var(--color-text-secondary)] mr-2">#</span>
              <div className="h-5 bg-gradient-to-r from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] rounded w-24"></div>
              <div className="ml-2 text-[var(--color-text-muted)] text-sm">
                <div className="h-4 bg-gradient-to-r from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] rounded w-48"></div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <button className="w-5 h-5 text-[var(--color-text-secondary)] rounded-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              <svg className="w-5 h-5 text-[var(--color-text-secondary)] rounded-md p-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-[var(--color-surface-secondary)]/30 transition-colors ${i % 4 === 0 ? 'bg-[var(--color-primary)]/10 border-l-4 border-[var(--color-primary)]' : ''}`}
              >
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-border)] to-[var(--color-surface-tertiary)] rounded-full flex-shrink-0 animate-pulse shadow-lg"></div>

                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className={`h-4 bg-gradient-to-r from-white to-[var(--color-border-secondary)] rounded font-medium ${i % 3 === 0 ? 'w-20' : i % 2 === 0 ? 'w-24' : 'w-16'}`}></div>

                    {i % 5 === 0 && (
                      <div className="rounded bg-[var(--color-success)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-on-success)] opacity-80">
                        ADMIN
                      </div>
                    )}

                    <div className="h-3 bg-gradient-to-r from-[var(--color-border)] to-[var(--color-surface-tertiary)] rounded w-16 opacity-60"></div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-3 bg-gradient-to-r from-[var(--color-border-secondary)] to-[var(--color-border)] rounded animate-pulse w-full"></div>
                    {i % 3 === 0 && (
                      <div className="h-3 bg-gradient-to-r from-[var(--color-border-secondary)] to-[var(--color-border)] rounded animate-pulse w-4/5"></div>
                    )}
                    {i % 4 === 0 && (
                      <>
                        <div className="h-3 bg-gradient-to-r from-[var(--color-border-secondary)] to-[var(--color-border)] rounded animate-pulse w-3/4"></div>
                        <div className="h-3 bg-gradient-to-r from-[var(--color-border-secondary)] to-[var(--color-border)] rounded animate-pulse w-1/2"></div>
                      </>
                    )}
                  </div>

                  {i % 6 === 2 && (
                    <div className="mt-3 p-3 bg-gradient-to-br from-[var(--color-surface-tertiary)] to-[var(--color-surface-secondary)] rounded-lg border border-[var(--color-border)] animate-pulse">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 flex-shrink-0 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <div className="h-3 bg-gradient-to-r from-[var(--color-border)] to-[var(--color-surface-tertiary)] rounded w-24"></div>
                      </div>
                    </div>
                  )}
                </div>

                {(i + 1) % 2 === 0 && (
                  <div className="absolute right-0 top-0 opacity-100 mt-2 mr-2">
                    <button className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-surface-tertiary)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]">
                      <svg className="pb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4">
            <div className="bg-[var(--color-surface-tertiary)] rounded-lg px-4 py-3 animate-pulse">
              <div className="flex items-end space-x-3">
                <div className="w-8 h-8 bg-[var(--color-hover)] rounded flex-shrink-0"></div>
                <div className="flex-1 min-h-0">
                  <div className="w-full bg-[var(--color-surface-secondary)] rounded px-2 py-1 opacity-60"></div>
                </div>
                <div className="w-8 h-8 bg-[var(--color-hover)] rounded"></div>
                <div className="w-8 h-8 bg-[var(--color-hover)] rounded"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-72 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] animate-pulse max-xl:hidden">
          <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)]">
            <div className="h-4 bg-[var(--color-surface-secondary)] rounded w-20"></div>
          </div>
          <div className="flex-1 p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 px-3 py-2 rounded-xl">
                <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full opacity-60"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-gradient-to-r from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] rounded w-20"></div>
                  <div className="h-2 bg-gradient-to-r from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none relative min-w-0">
      {/* Left Sidebar Container */}
      <div className="flex flex-col gap-0 h-full shrink-0">
        {/* Server and Channel Sidebars Row */}
        <div className="flex flex-1 gap-2 min-h-0">
          {/* Server Sidebar */}
          <div className="w-16 shrink-0 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex flex-col items-center py-2 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent">
            <div className="w-8 h-px bg-[var(--color-surface-tertiary)] rounded mb-2"></div>

            {/* Current Server */}
            {serverInfo && (
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer group relative">
                {serverInfo.avatar_url ? (
                  <img
                    src={serverInfo.avatar_url}
                    alt={`${serverInfo.server_name} avatar`}
                    className="w-12 h-12 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="text-[var(--color-on-primary)] font-semibold text-lg bg-[var(--color-primary)] w-full h-full flex items-center justify-center rounded-2xl">
                    {(serverInfo.server_name || 'S').charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[var(--color-success)] rounded-full border-2 border-[var(--color-border)] opacity-100"></div>
              </div>
            )}

            <AddServerButton
              disabled
              title="Additional home instances are not available in this build"
              ariaLabel="Additional home instances are not available in this build"
            />
          </div>

          {/* Channel Sidebar */}
          <div className="w-72 lg:w-80 shrink-0 min-w-[16rem] max-w-[22rem] bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex flex-col overflow-hidden">
            {/* Modern Server Header */}
            <div className="relative">
              {/* Server Banner */}
              {serverInfo?.banner_url && (
                <div className="relative h-20 w-full rounded-t-2xl overflow-hidden">
                  <img
                    src={serverInfo.banner_url}
                    alt={`${serverInfo.server_name} banner`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[color:color-mix(in_srgb,var(--color-background)_80%,transparent)] via-[color:color-mix(in_srgb,var(--color-background)_34%,transparent)] to-transparent"></div>
                </div>
              )}

              {/* Server Info Section */}
              <div className={`px-4 py-3 ${serverInfo?.banner_url ? 'relative' : 'border-b border-[var(--color-border)]'}`}>
                <div className="flex items-center justify-between">
                  {/* Server Info */}
                  <div className="min-w-0 flex-1">
                    <h1 className="text-[var(--color-text)] font-bold text-base truncate" title={serverInfo?.server_name || 'Loading...'}>
                      {serverInfo?.server_name || 'Loading...'}
                    </h1>
                    <p className="text-[var(--color-text-secondary)] text-xs truncate">{serverInfo?.server_description}</p>
                  </div>

                  {/* Server Dropdown */}
                  <div className="relative" ref={serverDropdownRef}>
                    <button
                      onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
                      className={`pb-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                        serverDropdownOpen
                          ? "border-[var(--color-border)] bg-[var(--color-active)] text-[var(--color-text)]"
                          : "border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                      }`}
                      title="Home instance options"
                      aria-label="Home instance options"
                      aria-expanded={serverDropdownOpen}
                      aria-haspopup="menu"
                    >
                      <svg
                        className={`pb-icon transition-transform ${serverDropdownOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {serverDropdownOpen && (
                      <div className="pb-menu absolute right-0 top-full z-50 mt-2 w-64 rounded-lg p-2">
                        <div className="mb-2 rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2">
                          <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                            {serverInfo?.server_name || "Server"}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">Home instance actions</p>
                        </div>

                        <button
                          onClick={() => {
                            showToast({
                              message:
                                "Home instance details live in the control panel and settings.",
                              tone: "warning",
                              category: "info",
                            });
                            setServerDropdownOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                          title="View home instance information"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">Instance Info</span>
                        </button>

                        <button
                          onClick={() => {
                            if (!canCreateInvite) {
                              return;
                            }
                            handleInviteActionUnavailable();
                            setServerDropdownOpen(false);
                          }}
                          disabled={!canCreateInvite}
                          className={`mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            canCreateInvite
                              ? "text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                              : "cursor-not-allowed text-[var(--color-text-muted)] opacity-60"
                          }`}
                          title={
                            canCreateInvite
                              ? "Invite creation is not available on this single-instance build"
                              : "Only admins, moderators, and owners can create invite codes"
                          }
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                            <span className="font-medium">Invites Unavailable</span>
                          </button>

                        <Link
                          to="/control-panel"
                          onClick={(e) => {
                            if (!canAccessControlPanel) {
                              e.preventDefault();
                              return;
                            }
                            setServerDropdownOpen(false);
                          }}
                          aria-disabled={!canAccessControlPanel}
                          className={`mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            canAccessControlPanel
                              ? "text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                              : "pointer-events-none cursor-not-allowed text-[var(--color-text-muted)] opacity-60"
                          }`}
                          title={
                            canAccessControlPanel
                              ? "Access server control panel"
                              : "Only server admins and owners can access control panel"
                          }
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="font-medium">Control Panel</span>
                        </Link>

                        <div className="my-2 border-t border-[var(--color-border-secondary)]" />

                        <button
                          onClick={() => {
                            if (!canDeleteServer) {
                              return;
                            }
                            const confirmed = window.confirm("Are you sure you want to delete this server? This action cannot be undone.");
                            if (confirmed) {
                              showToast({
                                message:
                                  "Home instance deletion is unavailable. This client is connected to one home instance, and deleting it is not supported here.",
                                tone: "warning",
                                category: "system",
                              });
                            }
                            setServerDropdownOpen(false);
                          }}
                          disabled={!canDeleteServer}
                          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            canDeleteServer
                              ? "text-[var(--color-error)] hover:bg-[var(--color-error)]/12"
                              : "cursor-not-allowed text-[var(--color-text-muted)] opacity-60"
                          }`}
                          title={
                            canDeleteServer
                              ? "Delete this server"
                              : "Home instance deletion is not available on this single-instance build"
                          }
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="font-medium">Delete Unavailable</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Channel List */}
            <div className="flex-1 overflow-y-auto">
              {channelsError ? (
                <div className="flex flex-col items-center justify-center min-h-96 px-6 py-12">
                  <div className="relative">
                    {/* Background Glow */}
                    <div className="absolute inset-0 scale-150 rounded-full bg-gradient-to-br from-[var(--color-error)]/20 to-[var(--color-warning)]/20 blur-xl"></div>

                    {/* Main Icon Container */}
                    <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-error)] to-[color:color-mix(in_srgb,var(--color-error)_78%,var(--color-background))] shadow-2xl transition-transform duration-300 transform rotate-3 hover:rotate-0">
                      <svg className="w-10 h-10 text-[var(--color-on-error)] drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.6-.833-2.37 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>

                      {/* Decorative Elements */}
                      <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-[var(--color-warning)] animate-ping"></div>
                      <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-[var(--color-warning)]"></div>
                    </div>
                  </div>

                  {/* Error Message */}
                  <div className="text-center max-w-md mb-8">
                    <h3 className="text-xl font-bold text-[var(--color-text)] mb-3 drop-shadow-sm">
                      Channels Unavailable
                    </h3>
                    <p className="text-[var(--color-text-secondary)] leading-relaxed mb-4">
                      {channelsError}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => window.location.reload()}
                      className="px-6 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary)] hover:to-[var(--color-primary-hover)] text-[var(--color-on-primary)] font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Retry</span>
                    </button>
                  </div>
                </div>
              ) : channels.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium mb-2 text-[var(--color-text-secondary)]">No channels available</p>
                  <p className="text-[var(--color-text-muted)]">Ask a server admin to create some channels to get started.</p>
                </div>
              ) : (
                <>
                  {/* Channels */}
                  <div className="px-2 py-4">
                    <div className="flex items-center px-2 mb-1">
                      <svg className="w-3 h-3 text-[var(--color-text-secondary)] mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Channels</span>
                    </div>

                    <div className="space-y-2">
                      {channels.map(channel => {
                        // Render voice channels with VoiceChannel component
                        if (channel.channel_type === 'voice') {
                          return (
                            <VoiceChannel
                              key={channel.channel_id}
                              channelId={channel.channel_id}
                              channelName={channel.channel_name}
                              isConnected={currentVoiceChannel?.channelId === channel.channel_id}
                              mediaQuality={serverInfo?.rtc_media_quality ?? null}
                              onToggleConnection={() => {
                                // Intentionally lightweight; source of truth comes from onConnectionStateChange.
                              }}
                              onConnectionStateChange={({ connected, channelId, channelName, participants }) => {
                                if (connected) {
                                  setCurrentVoiceChannel({
                                    channelId,
                                    channelName,
                                    participants,
                                  });
                                  return;
                                }

                                setCurrentVoiceChannel((prev) =>
                                  prev?.channelId === channelId ? null : prev
                                );
                              }}
                            />
                          );
                        }

                        // Render text channels normally
                        const hasDraft = getMessageDraft(channel.channel_id).trim().length > 0;
                        const unreadCount = unreadCountsByChannel[channel.channel_id] || 0;
                        return (
                          <div
                            key={channel.channel_id}
                            className={`flex items-center px-2 py-1 rounded-md hover:bg-[var(--color-hover)] cursor-pointer ${selectedChannel?.channel_id === channel.channel_id ? 'bg-[var(--color-active)] text-[var(--color-text)]' : ''
                              }`}
                            onClick={() => handleChannelSelect(channel)}
                            onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                          >
                            <span className="text-[var(--color-text-secondary)] mr-2">#</span>
                            <span className="text-[var(--color-text-secondary)] text-sm break-words overflow-wrap-anywhere flex-1">{channel.channel_name}</span>
                            <div className="flex items-center ml-auto">
                              {unreadCount > 0 && (
                                <span className="mr-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-on-primary)]">
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              )}
                              {hasDraft && (
                                <div className="flex items-center mr-1" title="Has unsent message">
                                  <svg className="w-3 h-3 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </div>
                              )}
                              {channel.is_private && (
                                <svg className="w-4 h-4 text-[var(--color-text-muted)] ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Full-width UserPanel as direct child of left sidebar container */}
        {currentUser && (
          <div className="w-full rounded-b-xl border-t border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
            <UserPanel
              username={currentUser.username || ''}
              avatar={currentUser.avatar || ''}
              status={currentUserLiveStatus}
              onSettingsClick={() => navigate('/settings')}
              onDeviceSelectorClick={() => setDeviceSelectorModalOpen(true)}
              onStatusChange={handleStatusChange}
              onClick={(e) => handleUserClick(currentUser.user_id, currentUser.username, e, 'userpanel')}
              className="w-full"
              voiceChannel={currentVoiceChannel ? {
                channelName: currentVoiceChannel.channelName,
                participants: currentVoiceChannel.participants,
                onDisconnect: () => {
                  // Handle voice channel disconnect
                  setCurrentVoiceChannel(null);
                }
              } : undefined}
            />
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 min-w-0 flex flex-col bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        {/* Channel Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]/70">
          <div className="flex items-center">
            <span className="text-[var(--color-text-secondary)] mr-2">#</span>
            <h2 className="text-[var(--color-text)] font-semibold tracking-tight">{selectedChannel?.channel_name || 'general'}</h2>
            <div className="ml-2 text-[var(--color-text-muted)] text-xs uppercase tracking-wide">channel</div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative" ref={notificationMenuRef}>
              <button
                onClick={() => setNotificationMenuOpen((prev) => !prev)}
                className="pb-icon-btn relative"
                title="Notifications"
                aria-label="Notifications"
              >
                <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-on-primary)]">
                    {notifications.length > 99 ? '99+' : notifications.length}
                  </span>
                )}
              </button>
              <NotificationMenu
                notifications={notifications}
                isOpen={notificationMenuOpen}
                onClose={() => setNotificationMenuOpen(false)}
                onSelect={handleNotificationSelect}
                onMarkAllRead={handleMarkAllNotificationsRead}
                browserNotificationPermission={browserNotificationPermission}
                onEnableBrowserNotifications={handleEnableBrowserNotifications}
              />
            </div>
            {unreadMarker?.channelId === selectedChannel?.channel_id && (
              <button
                onClick={handleJumpToFirstUnread}
                className="rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/12 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/18"
                title="Jump to first unread message"
              >
                Jump to unread
              </button>
            )}
            <button className="pb-icon-btn" title="User details" aria-label="User details">
              <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            <button className="pb-icon-btn" title="Search in channel" aria-label="Search in channel">
              <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={() => setMembersListVisible(!membersListVisible)}
              className="pb-icon-btn hidden xl:inline-flex"
              title="Toggle member list"
              aria-label="Toggle member list"
            >
              <svg className="pb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
            <button className="pb-icon-btn" title="More channel options" aria-label="More channel options">
              <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-[var(--color-text-secondary)]">
                <div className="text-[var(--color-text-muted)] text-sm">No messages yet</div>
                <div className="text-[var(--color-text-muted)] text-xs mt-1">
                  {selectedChannel ? `This is the beginning of #${selectedChannel.channel_name}` : 'Select a channel to view messages'}
                </div>
              </div>
            </div>
          ) : (
            groupedMessages.map((group) => {
                const firstMessage = group[0];
                const messageTimestamp = new Date(firstMessage.sent_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const groupMessageIds = group.map(m => m.message_id);

                // Get user profile data from users list and format
                const foundUser = usersById.get(firstMessage.sender_user_id);

                let messageUser: DisplayUser;
                if (foundUser) {
                  const foundUserRoleNames = getResolvedRoleNames(foundUser);
                  // Convert API user format to DisplayUser format
                  messageUser = {
                    id: foundUser.user_id,
                    username: foundUser.username,
                    avatar: foundUser.username ? createFallbackAvatarUrl(foundUser.username) : undefined,
                    banner: undefined, // Could be extended from API later
                    accentColor: foundUser.is_owner ? 'var(--color-info)' : foundUser.is_admin ? 'var(--color-error)' : 'var(--color-primary)',
                    bannerColor: foundUser.is_owner ? 'var(--color-info)' : foundUser.is_admin ? 'var(--color-error)' : 'var(--color-primary)',
                    customStatus: foundUserRoleNames[0] || 'Active Member',
                    externalLinks: [], // Would be loaded from user preferences/settings in real implementation
                    status: (
                      foundUser.status === 'online' ||
                      foundUser.status === 'idle' ||
                      foundUser.status === 'afk' ||
                      foundUser.status === 'dnd' ||
                      foundUser.status === 'offline'
                    )
                      ? foundUser.status as 'online' | 'idle' | 'afk' | 'dnd' | 'offline'
                      : 'offline',
                    bio: `Member of ${serverInfo?.server_name || 'Pufferblow Home Instance'} since ${new Date(foundUser.created_at).getFullYear()}. Passionate about decentralized technology.`,
                    joinedAt: foundUser.created_at,
                    originServer: serverInfo?.server_name || 'Pufferblow Home Instance',
                    roles: foundUserRoleNames,
                    activity: undefined, // Could be extended later
                    mutualServers: undefined, // Could be calculated later
                    mutualFriends: undefined, // Could be extended later
                    badges: [] // Could be extended later
                  };
                } else {
                  // Fallback for message user data when not in users list
                  messageUser = {
                    id: firstMessage.sender_user_id,
                    username: firstMessage.username || 'Unknown User',
                    avatar: firstMessage.sender_avatar_url ? createFullUrl(firstMessage.sender_avatar_url) : createFallbackAvatarUrl(firstMessage.username || firstMessage.sender_user_id),
                    banner: undefined,
                    accentColor: 'var(--color-accent)',
                    bannerColor: undefined,
                    customStatus: 'Member',
                    externalLinks: [],
                    status: (
                      firstMessage.sender_status === 'online' ||
                      firstMessage.sender_status === 'idle' ||
                      firstMessage.sender_status === 'afk' ||
                      firstMessage.sender_status === 'dnd'
                    ) ? firstMessage.sender_status as 'online' | 'idle' | 'afk' | 'dnd' : 'offline',
                    bio: 'Active member of this home instance community',
                    joinedAt: '',
                    originServer: serverInfo?.server_name || 'Pufferblow Home Instance',
                    roles: firstMessage.sender_roles ? ['Member'] : [], // Use sender_roles if available
                    activity: undefined,
                    mutualServers: undefined,
                    mutualFriends: undefined,
                    badges: undefined
                  };
                }

                // Use actual user profile data (fallback to message data if user not found)
                const displayName = messageUser.username || firstMessage.username || 'Unknown User';
                const displayAvatar = messageUser.avatar || firstMessage.sender_avatar_url || '/pufferblow-art-pixel-32x32.png';

              return (
                <React.Fragment key={firstMessage.message_id}>
                  {unreadMarker?.channelId === selectedChannel?.channel_id &&
                    group.some((message) => message.message_id === unreadMarker?.messageId) && (
                      <div ref={unreadDividerRef} className="flex items-center gap-3 px-2 py-2">
                        <div className="h-px flex-1 bg-[var(--color-border)]" />
                        <div className="rounded-full border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                          New messages
                        </div>
                        <div className="h-px flex-1 bg-[var(--color-border)]" />
                      </div>
                    )}
                  <div
                    className={`group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-[var(--color-surface-secondary)]/30 transition-colors ${firstMessage.sender_user_id === currentUser?.user_id
                        ? 'bg-[var(--color-primary)]/20 border-l-4 border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]/30'
                        : ''
                      }`}
                    onMouseEnter={() => setHoveredMessageId(firstMessage.message_id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    onContextMenu={(e) => handleMessageGroupContextMenu(groupMessageIds, e)}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex-shrink-0 relative">
                      <img
                        src={displayAvatar}
                        alt={displayName}
                        className="w-full h-full rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => handleUserClick(firstMessage.sender_user_id, displayName, e, 'messages')}
                        onContextMenu={(e) => openUserContextMenu(firstMessage.sender_user_id, displayName, e, 'messages')}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {/* Username */}
                        <span
                          className="text-[var(--color-text)] font-medium select-text cursor-pointer hover:underline"
                          onClick={(e) => handleUserClick(firstMessage.sender_user_id, displayName, e, 'messages')}
                          onContextMenu={(e) => openUserContextMenu(firstMessage.sender_user_id, displayName, e, 'messages')}
                        >
                          {displayName}
                        </span>
                        {/* Role badges using injected data */}
                        {firstMessage.sender_roles?.includes("owner") || firstMessage.sender_roles?.includes("Owner") ? (
                          <span className="pb-status-success border text-xs px-1.5 py-0.5 rounded font-medium">OWNER</span>
                        ) : firstMessage.sender_roles?.includes("admin") || firstMessage.sender_roles?.includes("Admin") ? (
                          <span className="pb-status-danger border text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                        ) : firstMessage.sender_roles?.includes("moderator") || firstMessage.sender_roles?.includes("Moderator") ? (
                          <span className="pb-status-info border text-xs px-1.5 py-0.5 rounded font-medium">MOD</span>
                        ) : null}
                        <span className="text-[var(--color-text-secondary)] text-xs select-text">{messageTimestamp}</span>
                      </div>
                      <div className="space-y-1">
                        {group.map((message) => (
                          <div key={message.message_id}>
                            <MarkdownRenderer content={message.message} className="text-[var(--color-text)]" />
                            <MessageEmbeds content={message.message} />

                            {/* Render attachments with Discord-style bubble layout */}
                            {message.attachments && message.attachments.length > 0 && (
                              <AttachmentGrid attachments={message.attachments} />
                            )}
                          </div>
                        ))}
                      </div>
                      {/* Hover Menu Button */}
                      <div className={`absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity ${hoveredMessageId === firstMessage.message_id ? "opacity-100" : ""}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentMenuMessageId(firstMessage.message_id);
                            setMessageContextMenu({
                              isOpen: true,
                              position: { x: e.clientX, y: e.clientY },
                              onCopyLink: () => handleMessageCopy(firstMessage.message_id),
                              onReport: () => handleMessageReport(firstMessage.message_id)
                            });
                          }}
                          className="pb-icon-btn mr-2 bg-[var(--color-surface-tertiary)] hover:bg-[var(--color-hover)] text-[var(--color-text)] hover:text-[var(--color-text)]"
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
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Message Input */}
        <div className="p-4">
          {replyTarget && (
            <div className="mb-3 flex items-start justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  Replying to {replyTarget.username || usersById.get(replyTarget.sender_user_id)?.username || 'Unknown User'}
                </div>
                <div className="mt-1 line-clamp-2 text-sm text-[var(--color-text-muted)]">
                  {replyTarget.message || 'Attachment-only message'}
                </div>
              </div>
              <button
                onClick={() => setReplyTarget(null)}
                className="ml-4 rounded-md p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                title="Cancel reply"
                aria-label="Cancel reply"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Attachments Preview */}
          {messageAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {composerAttachmentPreviews.map((preview, index) => (
                <div
                  key={index}
                  className="relative bg-[var(--color-surface-secondary)] rounded-lg p-3 border border-[var(--color-border)] group hover:border-[var(--color-border)] transition-colors"
                >
                  {/* File content preview */}
                  {preview.kind === 'image' && preview.url ? (
                    <div className="flex flex-col items-center space-y-2">
                      <img
                        src={preview.url}
                        alt={preview.file.name}
                        className="max-w-24 max-h-24 object-cover rounded"
                      />
                      <div className="text-center">
                        <p className="text-xs text-[var(--color-text)] font-medium truncate max-w-24" title={preview.file.name}>
                          {preview.file.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {(preview.file.size / (1024 * 1024)).toFixed(1)}MB
                        </p>
                      </div>
                    </div>
                  ) : preview.kind === 'video' && preview.url ? (
                    <div className="flex flex-col items-center space-y-2">
                      <video
                        src={preview.url}
                        className="max-w-24 max-h-24 rounded object-cover"
                        muted
                        preload="metadata"
                      />
                      <div className="text-center">
                        <p className="text-xs text-[var(--color-text)] font-medium truncate max-w-24" title={preview.file.name}>
                          {preview.file.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {(preview.file.size / (1024 * 1024)).toFixed(1)}MB • Video
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2 text-center">
                      <svg className="w-12 h-12 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-xs text-[var(--color-text)] font-medium truncate max-w-24" title={preview.file.name}>
                          {preview.file.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {(preview.file.size / (1024 * 1024)).toFixed(1)}MB • {preview.file.type || 'Unknown type'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--color-error)] text-[var(--color-on-error)] hover:bg-[var(--color-error)]/90"
                    title="Remove attachment"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* Clear all attachments button */}
              {messageAttachments.length > 1 && (
                <button
                  onClick={() => setMessageAttachments([])}
                  className="px-3 py-2 bg-[var(--color-error)] hover:bg-[var(--color-error)]/90 text-[var(--color-on-error)] text-sm rounded-lg transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          )}

            <div
              ref={messageInputBarRef}
              className={`relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-6 py-4 transition-colors duration-200 hover:bg-[var(--color-surface)] ${
                !selectedChannel ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <div className="flex items-end space-x-3">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={!selectedChannel || isSendingMessage}
                className="hidden"
                accept={uploadPolicy.acceptAttribute}
              />

              {/* File Upload Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="pb-icon-btn flex-shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                  disabled={!selectedChannel || isSendingMessage}
                  title="Upload file"
                  aria-label="Upload file"
                >
                <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              {/* Message Input */}
                <div className="flex-1 min-h-0">
                  <textarea
                    ref={messageInputRef}
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                    }}
                    onBlur={flushPendingDraftPersistence}
                    onKeyDown={handleKeyPress}
                    placeholder={selectedChannel ? `Message #${selectedChannel.channel_name}` : 'Select a channel to start messaging'}
                    disabled={!selectedChannel || isSendingMessage}
                    className="w-full bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none resize-none h-6 break-words overflow-wrap-anywhere disabled:opacity-50 disabled:cursor-not-allowed"
                    rows={1}
                  />
                </div>

              {/* Emoji Button */}
                <button
                  onClick={handleEmojiClick}
                  disabled={!selectedChannel || isSendingMessage}
                  className={`pb-icon-btn ${isEmojiPickerOpen
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]'
                  }`}
                title="Add emoji"
                aria-label="Add emoji"
              >
                <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H13m-3 3.5a.5.5 0 11-1 0 .5.5 0 011 0zM16 7a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>

                <button
                  onClick={handleSendMessage}
                  disabled={!canSendMessage}
                  className="pb-icon-btn bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[var(--color-primary)]"
                  title={canSendMessage ? "Send message" : "Type a message or add an attachment"}
                  aria-label="Send message"
                >
                  {isSendingMessage ? (
                    <span className="px-1 text-xs font-medium">Sending...</span>
                  ) : (
                    <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{selectedChannel ? 'Enter to send' : 'Select a channel to start typing'}</span>
                  {selectedChannel && <span>Shift+Enter for newline</span>}
                  {composerAttachmentSummary.count > 0 && (
                    <span>
                      {composerAttachmentSummary.count} attachment{composerAttachmentSummary.count === 1 ? '' : 's'} • {composerAttachmentSummary.formattedSize}
                    </span>
                  )}
                </div>
                {selectedChannel && (
                  <span>
                    {messageInput.trim().length}
                    {uploadPolicy.maxMessageLength ? `/${uploadPolicy.maxMessageLength}` : ''}
                  </span>
                )}
              </div>
            </div>



          {/* Emoji Picker */}
          <EmojiPicker
            isOpen={isEmojiPickerOpen}
            onClose={() => setIsEmojiPickerOpen(false)}
            onEmojiSelect={handleEmojiSelect}
            onGifSelect={handleGifSelect}
          />
        </div>
      </div>

      {/* Member List */}
      <div className={`max-xl:hidden transition-all duration-300 ease-in-out ${membersListVisible ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="w-72 h-full bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex flex-col">
          {/* Header with close button */}
          <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Members</h3>
            <button
              onClick={() => setMembersListVisible(false)}
              className="pb-icon-btn hover:bg-[var(--color-surface-secondary)]"
              title="Close member list"
              aria-label="Close member list"
            >
              <svg className="pb-icon text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Members Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent">
            {usersError ? (
              <div className="p-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-error)] text-[var(--color-on-error)]">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.6-.833-2.37 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="mb-2 text-center text-lg font-medium text-[var(--color-error)]">Failed to load members</p>
                <p className="text-center text-[var(--color-text-muted)] mb-4">{usersError}</p>
                <div className="text-center">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] rounded transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="p-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-center text-lg font-medium mb-2 text-[var(--color-text-secondary)]">No members found</p>
                <p className="text-center text-[var(--color-text-muted)]">This server appears to be empty.</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {(() => {
                  const roleGroupPriority = ['Server Owner', 'Administrator', 'Moderator', 'Regular User', 'Member'];
                  const groupedUsers = users.reduce((acc, user) => {
                    const roleNames = getResolvedRoleNames(user);
                    const groupTitle =
                      roleGroupPriority.find((roleName) => roleNames.includes(roleName)) ||
                      roleNames[0] ||
                      'Member';
                    if (!acc[groupTitle]) {
                      acc[groupTitle] = [];
                    }
                    acc[groupTitle].push(user);
                    return acc;
                  }, {} as Record<string, typeof users>);

                  const renderUserGroup = (title: string, userList: typeof users) => {
                    if (userList.length === 0) return null;

                    return (
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 bg-[var(--color-surface-tertiary)] px-2 py-1 rounded border border-[var(--color-border)]">
                          {title} - {userList.length}
                        </h4>
                        <div className="space-y-1">
                          {userList.map(user => (
                            <UserListItem
                              key={user.user_id}
                              userId={user.user_id}
                              username={user.username}
                              status={user.status}
                              roleNames={getResolvedRoleNames(user)}
                              onClick={(e) => handleUserClick(user.user_id, user.username, e, 'members')}
                              onContextMenu={(e) => openUserContextMenu(user.user_id, user.username, e, 'members')}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  };

                  return roleGroupPriority
                    .filter((title) => groupedUsers[title]?.length)
                    .map((title) => renderUserGroup(title, groupedUsers[title]));
                })()}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Modals */}
      <ChannelCreationModal
        isOpen={channelCreationModalOpen}
        onClose={() => setChannelCreationModalOpen(false)}
        onCreateChannel={handleCreateChannel}
      />

      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSearch={handleSearch}
        onSelectResult={handleSelectSearchResult}
      />

      <MessageContextMenu
        isOpen={messageContextMenu.isOpen}
        position={messageContextMenu.position}
        onClose={() => setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 } })}
        onReply={() => handleMessageReply(currentMenuMessageId)}
        onReact={() => {
          // Open emoji picker for reactions
          const rect = { left: messageContextMenu.position.x, top: messageContextMenu.position.y, right: messageContextMenu.position.x, bottom: messageContextMenu.position.y };
          const pickerWidth = 320;
          const pickerHeight = 400;
          const gap = 8;

          // Position to the right of the menu
          let x = rect.right + gap;
          let y = rect.top;

          // If it would go off the right edge, position to the left
          if (x + pickerWidth > window.innerWidth) {
            x = rect.left - pickerWidth - gap;
          }

          // Adjust if picker would go off-screen vertically
          if (y + pickerHeight > window.innerHeight) {
            y = window.innerHeight - pickerHeight - gap;
          }
          if (y < gap) {
            y = gap;
          }

          setIsEmojiPickerOpen(true);
          setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 } }); // Close context menu
        }}
        onCopyLink={() => handleMessageCopy(currentMenuMessageId)}
        onReport={() => handleMessageReport(currentMenuMessageId)}
      />

      <UserContextMenu
        isOpen={userContextMenu.isOpen}
        position={userContextMenu.position}
        onClose={() => {
          setUserContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
          setSelectedContextUser(null);
        }}
        onViewProfile={() => {
          if (!selectedContextUser) return;
          const anchorElement = selectedContextUser.anchorElement ?? referenceElement ?? document.body;
          const syntheticEvent = {
            preventDefault() {},
            currentTarget: anchorElement,
          } as unknown as React.MouseEvent;
          handleUserClick(
            selectedContextUser.userId,
            selectedContextUser.username,
            syntheticEvent,
            selectedContextUser.source,
          );
          setUserContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
        }}
        onMention={() => {
          if (!selectedContextUser) return;
          handleMentionUser(selectedContextUser.username);
        }}
        onSendMessage={() => {
          if (!selectedContextUser) return;
          handleSendMessageToUser(selectedContextUser.userId);
          setUserContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
        }}
        onReport={() => {
          if (!selectedContextUser) return;
          handleUserReport(selectedContextUser.userId, selectedContextUser.username);
        }}
        onTimeout={() => {
          if (!selectedContextUser) return;
          void handleUserTimeout(selectedContextUser.userId, selectedContextUser.username);
        }}
        onBan={() => {
          if (!selectedContextUser) return;
          void handleUserBan(selectedContextUser.userId, selectedContextUser.username);
        }}
        canTimeout={canTimeoutUsers && selectedContextUser?.userId !== currentUser?.user_id}
        canBan={canBanUsers && selectedContextUser?.userId !== currentUser?.user_id}
      />

      <ContextMenu
        isOpen={channelContextMenu.isOpen && !!channelContextMenu.channel}
        position={channelContextMenu.position}
        onClose={() => setChannelContextMenu({ isOpen: false, position: { x: 0, y: 0 }, channel: null })}
        items={[
          {
            id: "delete-channel",
            label: "Delete Channel",
            tone: "danger",
            icon: (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7"
                />
              </svg>
            ),
            onSelect: () => {
              setChannelDeleteConfirm({ isOpen: true, channel: channelContextMenu.channel });
              setChannelContextMenu({ isOpen: false, position: { x: 0, y: 0 }, channel: null });
            },
          },
        ]}
      />

      <ConfirmDialog
        isOpen={channelDeleteConfirm.isOpen && !!channelDeleteConfirm.channel}
        title="Delete Channel"
        description={`Delete #${channelDeleteConfirm.channel?.channel_name || ""}? This action cannot be undone.`}
        confirmLabel={channelDeleteConfirm.isDeleting ? "Deleting..." : "Delete Channel"}
        tone="danger"
        isLoading={channelDeleteConfirm.isDeleting}
        onCancel={() => setChannelDeleteConfirm({ isOpen: false, channel: null, isDeleting: false })}
        onConfirm={async () => {
          const authToken = getAuthTokenFromCookies() || "";
          const channel = channelDeleteConfirm.channel;
          if (!authToken || !channel) return;

          setChannelDeleteConfirm((prev) => ({ ...prev, isDeleting: true }));

          try {
            const response = await deleteChannel(channel.channel_id, authToken);

            if (response.success) {
              logger.ui.info("Channel deleted successfully from dashboard", {
                channelId: channel.channel_id,
                channelName: channel.channel_name,
              });

              showToast({
                message: `Channel #${channel.channel_name} deleted successfully.`,
                tone: "success",
                category: "destructive",
              });

                try {
                  const listResponse = await listChannels(authToken);
                  if (listResponse.success && listResponse.data?.channels) {
                    setChannels(listResponse.data.channels);
                    if (selectedChannel?.channel_id === channel.channel_id) {
                      const fallbackChannel = listResponse.data.channels[0] ?? null;
                      setSelectedChannel(fallbackChannel);
                      setMessages([]);
                      if (fallbackChannel) {
                        await loadChannelMessages(fallbackChannel);
                      }
                    }
                  }
                } catch {
                showToast({
                  message: "Channel deleted but failed to refresh channel list. Please refresh the page.",
                  tone: "error",
                  category: "system",
                });
              }
            } else {
              showToast({
                message: `Failed to delete channel: ${response.error || "Unknown error"}`,
                tone: "error",
                category: "system",
              });
            }
          } catch {
            showToast({
              message: "An unexpected error occurred while deleting the channel.",
              tone: "error",
              category: "system",
            });
          } finally {
            setChannelDeleteConfirm({ isOpen: false, channel: null, isDeleting: false });
          }
        }}
      />

      <MessageReportModal
        isOpen={reportModal.isOpen}
        onClose={() => setReportModal({ isOpen: false, targetType: 'message', messages: [] })}
        onSubmit={handleMessageReportSubmit}
        messageCount={reportModal.targetType === 'message' ? reportModal.messages.length : 1}
        entityLabel={reportModal.targetType}
        title={
          reportModal.targetType === 'user' && reportModal.targetUsername
            ? `Report ${reportModal.targetUsername}`
            : undefined
        }
        description={
          reportModal.targetType === 'user'
            ? 'Help moderators review profile or behavior issues tied to this user.'
            : 'Help keep the server safe by reporting policy violations.'
        }
      />

      {/* User Card Tooltip */}
      {isTooltipOpen && userCardTooltipUser && ReactDOM.createPortal(
        <div
          ref={setPopperElement}
          className="rounded-xl shadow-2xl z-50 pointer-events-auto"
          style={{
            position: 'fixed',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <UserCard
            username={userCardTooltipUser.username || 'Unknown User'}
            bio={userCardTooltipUser.bio || 'No bio available'}
            roles={userCardTooltipUser.roles as any}
            originServer={userCardTooltipUser.originServer || serverInfo?.server_name || 'Loading...'}
            avatarUrl={userCardTooltipUser.avatar}
            backgroundUrl={userCardTooltipUser.banner}
            status={userCardTooltipUser.status === 'online' ? 'active' :
              userCardTooltipUser.status === 'idle' || userCardTooltipUser.status === 'afk' ? 'idle' :
                userCardTooltipUser.status === 'dnd' ? 'dnd' : 'offline'}
            activity={userCardTooltipUser.activity || {
              type: Math.random() > 0.5 ? 'listening' : 'playing',
              name: Math.random() > 0.5 ? 'Spotify' : 'Visual Studio Code',
              details: Math.random() > 0.5 ? 'Symphony No. 9 in D minor, Op. 125' : 'Working on pufferblow-client'
            }}
            mutualServers={userCardTooltipUser.mutualServers || Math.floor(Math.random() * 15) + 1}
            mutualFriends={userCardTooltipUser.mutualFriends || Math.floor(Math.random() * 25) + 1}
            badges={userCardTooltipUser.badges || ['Developer', 'Early Supporter'].slice(0, Math.floor(Math.random() * 3))}
            customStatus={userCardTooltipUser.customStatus}
            accentColor={userCardTooltipUser.accentColor || 'var(--color-accent)'}
            bannerColor={userCardTooltipUser.bannerColor}
            externalLinks={userCardTooltipUser.externalLinks || []}
            joinDate={userCardTooltipUser.joinedAt ? new Date(userCardTooltipUser.joinedAt).toISOString().split('T')[0] : undefined}
            showOnlineIndicator={true}
            isCompact={false}
          />
        </div>,
        document.body
      )}

      {/* Device Selector Modal */}
      <DeviceSelectorModal
        isOpen={deviceSelectorModalOpen}
        onClose={() => setDeviceSelectorModalOpen(false)}
      />
    </div>
  );
}
