import { Link, useLocation, useNavigate } from "react-router";
import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue, useTransition } from "react";
import ReactDOM from 'react-dom';
import { ChannelCreationModal } from "../../components/ChannelCreationModal";
import { UserContextMenu } from "../../components/UserContextMenu";
import { EmojiPicker } from "../../components/EmojiPicker";
import { VoiceChannel } from "../../components/VoiceChannel";
import { VoiceCallUI } from "../../components/VoiceCallUI";
import { UserPanel } from "../../components/UserPanel";
import { DeviceSelectorModal } from "../../components/DeviceSelectorModal";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { MessageReportModal } from "../../components/MessageReportModal";
import { MessageContextMenu } from "../../components/MessageContextMenu";
import { MessageEmbeds } from "../../components/MessageEmbeds";
import { MessageReplyContext, buildReplyParentAvatarUrl } from "../../components/MessageReplyContext";
import { findReplyParent, parseReplyContext } from "../../utils/replyContext";
import { NotificationMenu, type NotificationItem } from "../../components/NotificationMenu";
import { useToast } from "../../components/Toast";
import { UserCard } from "../../components/UserCard";
import { AttachmentGrid } from "../../components/AttachmentBubble";
import { UserListItem } from "../../components/dashboard/UserListItem";
import { AddServerButton } from "../../components/dashboard/AddServerButton";
import { JoinServerModal } from "../../components/dashboard/JoinServerModal";
import { ChannelSidebarHeader } from "../../components/dashboard-page/ChannelSidebarHeader";
import { DirectMessagesPanel } from "../../components/dashboard-page/DirectMessagesPanel";
import { MembersList } from "../../components/dashboard-page/MembersList";
import { ChatHeader } from "../../components/dashboard-page/ChatHeader";
import { ChannelList } from "../../components/dashboard-page/ChannelList";
import { ContextMenu } from "../../components/ui/ContextMenu";
import { ProgressiveImage } from "../../components/ui/ProgressiveImage";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ModerationActionModal, type ModerationActionSubmit } from "../../components/ModerationActionModal";
import { validateMessageInput } from "../../utils/markdown";
import { extractMentionQuery, insertMentionAtCursor, parseMentions } from "../../utils/mentions";
import { findEmojiAliasMatches } from "../../utils/emojiAliases";
import { sendPing } from "../../services/ping";
import { logger } from "../../utils/logger";
import { getAuthTokenFromCookies, getHostPortFromCookies, getHostPortFromStorage, useCurrentUserProfile, getUserProfileById, createFallbackAvatarUrl, createFullUrl, getResolvedRoleNames, getUserAccentColor, getUserRoles, hasResolvedPrivilege, updateUserStatus, resolveAvatarUrl, resolveBanner, resolveSenderAvatarUrl } from "../../services/user";
import { listChannels, createChannel, deleteChannel, updateChannel } from "../../services/channel";
import { Modal } from "../../components/ui/Modal";
import { addReaction, deleteMessage, getMessageReadHistory, loadMessages, markMessageAsRead, removeReaction, searchChannelMessages, sendMessage } from "../../services/message";
import {
  dispatchDesktopNotification,
  ensureNotificationPermission,
  setUnreadBadge,
  subscribeNotificationsMuted,
} from "../../services/desktopNotifications";
import type { MessageReaction } from "../../models/Message";
import { banUser, submitMessageReport, submitUserReport, timeoutUser } from "../../services/moderation";
import { GlobalWebSocket, createGlobalWebSocket, isChatWebSocketMessage, normalizeChatWebSocketMessage } from "../../services/websocket";
import { listUsers, type ListUsersResponse } from "../../services/user";
import { getServerInfo, type ServerInfo } from "../../services/system";
import { convertToFullStorageUrl } from "../../services/apiClient";
import { resolveStoredInstance } from "../../services/instance";
import { useTrackLastRoute } from "../../utils/uiStatePersistence";
import { buildAuthRedirectPath } from "../../utils/authRedirect";
import type { Channel } from "../../models";
import type { Message } from "../../models";
import type { User } from "../../models";
import { ChannelPanel } from "../dashboard-page/ChannelPanel";
import { DashboardOverlays } from "../dashboard-page/DashboardOverlays";
import { MembersPanel } from "../dashboard-page/MembersPanel";
import { MessagePane } from "../dashboard-page/MessagePane";
import { ServerRail } from "../dashboard-page/ServerRail";
import { ServerRailItem } from "../dashboard-page/ServerRailItem";
import { useTitleBar } from "../../context/TitleBarContext";
import type { DisplayUser } from "../dashboard-page/types";
import { getAttachmentCategory, normalizeExtensions } from "../dashboard-page/types";
import { useDashboardComposer } from "../dashboard-page/useDashboardComposer";
import { useDashboardData } from "../dashboard-page/useDashboardData";

/** Deterministic hue (0–359) derived from a server name string. */
export default function Dashboard() {
  // Remember the dashboard as the user's last destination so the
  // index route can put them back here on next launch.
  useTrackLastRoute("/dashboard");
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();
  const { setServerName, setServerAvatarUrl, setChannelName } = useTitleBar();
  const loginRedirectPath = buildAuthRedirectPath(location.pathname, location.search, location.hash);
  const { data: currentUser, isLoading: userLoading, error: userError } = useCurrentUserProfile();
  const {
    persistedChannelId,
    persistSelectedChannel,
    setMessageDraft,
    getMessageDraft,
    clearMessageDraft,
    channelCreationModalOpen,
    setChannelCreationModalOpen,
    deviceSelectorModalOpen,
    setDeviceSelectorModalOpen,
    userCardTooltipUser,
    setUserCardTooltipUser,
    isTooltipOpen,
    setIsTooltipOpen,
    tooltipSource,
    setTooltipSource,
    referenceElement,
    setReferenceElement,
    setPopperElement,
    tooltipPosition,
    setTooltipPosition,
    calculateTooltipPosition,
    searchModalOpen,
    setSearchModalOpen,
    messageContextMenu,
    setMessageContextMenu,
    currentMenuMessageId,
    setCurrentMenuMessageId,
    hoveredMessageId,
    setHoveredMessageId,
    membersListVisible,
    setMembersListVisible,
    userContextMenu,
    setUserContextMenu,
    selectedContextUser,
    setSelectedContextUser,
    channelContextMenu,
    setChannelContextMenu,
    channelDeleteConfirm,
    setChannelDeleteConfirm,
    reportModal,
    setReportModal,
    serverDropdownOpen,
    setServerDropdownOpen,
    serverInfo,
    setServerInfo,
    serverInfoError,
    setServerInfoError,
    channels,
    setChannels,
    channelsError,
    setChannelsError,
    selectedChannel,
    setSelectedChannel,
    messages,
    setMessages,
    users,
    setUsers,
    usersError,
    setUsersError,
    webSocketConnection,
    setWebSocketConnection,
    notificationMenuOpen,
    setNotificationMenuOpen,
    notifications,
    setNotifications,
    readMessageIds,
    unreadCountsByChannel,
    setUnreadCountsByChannel,
    manualPresenceLock,
    unreadMarker,
    setUnreadMarker,
    browserNotificationPermission,
    setBrowserNotificationPermission,
    webSocketConnectionRef,
    notificationMenuRef,
    unreadDividerRef,
    selectedChannelIdRef,
    currentUserIdRef,
    seenRealtimeMessageIdsRef,
    readMessageIdsRef,
    usersById,
    currentUserLiveStatus,
    groupedMessages,
    getMessageById,
    buildReplyMessage,
    applyReadHistorySnapshot,
    markChannelNotificationsRead,
    applyPresenceUpdate,
    updatePresenceStatus,
    markMessagesRead,
  } = useDashboardData({
    currentUser,
    navigate,
    location,
    showToast,
  });
  const {
    currentVoiceChannel,
    setCurrentVoiceChannel,
    voiceSessionActions,
    setVoiceSessionActions,
    messageInput,
    setMessageInput,
    messageAttachments,
    setMessageAttachments,
    isSendingMessage,
    setIsSendingMessage,
    replyTarget,
    setReplyTarget,
    isEmojiPickerOpen,
    setIsEmojiPickerOpen,
    dashboardRef,
    messageInputBarRef,
    messageInputRef,
    fileInputRef,
    messagesContainerRef,
    serverDropdownRef,
    uploadPolicy,
    composerAttachmentPreviews,
    composerAttachmentSummary,
    cancelPendingDraftPersistence,
    flushPendingDraftPersistence,
    scheduleDraftPersistence,
    resizeMessageComposer,
  } = useDashboardComposer({
    persistedChannelId,
    getMessageDraft,
    setMessageDraft,
    clearMessageDraft,
    serverInfo,
    normalizeExtensions,
  });
  // Keep the title bar's center breadcrumb in sync with whichever
  // server the dashboard is currently showing. Reset on unmount so
  // non-dashboard pages don't inherit stale chrome. The channel
  // half of the breadcrumb is wired up further down, after
  // `dmsOpen` is declared.
  useEffect(() => {
    setServerName(serverInfo?.server_name ?? null);
    setServerAvatarUrl(serverInfo?.avatar_url ?? null);
    return () => {
      setServerName(null);
      setServerAvatarUrl(null);
    };
  }, [serverInfo?.server_name, serverInfo?.avatar_url, setServerName, setServerAvatarUrl]);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  // Highlight-by-message-id. Search-result clicks (and other future
  // deep-link flows) set this to flash the target message briefly
  // after scrolling to it. Cleared on a timer so the highlight is a
  // transient affordance, not permanent.
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Emoji `:alias:` autocomplete state. Populated when the user types
  // `:smile` or similar in the composer; cleared on selection / Escape
  // / loss of trigger pattern. The popover above the textarea reads
  // from this; arrow keys / Tab / Enter route through `handleKeyPress`.
  const [emojiSuggest, setEmojiSuggest] = useState<{
    query: string;
    matches: Array<{ alias: string; emoji: string }>;
    selectedIdx: number;
    /** Position of the `:` token start in the textarea value. */
    tokenStart: number;
    /** End of the alias token (the cursor position when it was opened). */
    tokenEnd: number;
  } | null>(null);

  // Categorized upload picker. The "+" button in the composer used to
  // open a single OS file dialog that accepted every server-allowed
  // type at once. Now it opens a small popover with four entries
  // (Image / Video / Audio / File) and each one points at its own
  // hidden <input> with an `accept` attribute scoped to that category.
  // The unscoped `fileInputRef` (from useDashboardComposer) is still
  // used for the "File" entry as a true catch-all. All four inputs
  // share `handleFileUpload`, so the pipeline downstream is unchanged.
  const [uploadPickerOpen, setUploadPickerOpen] = useState(false);
  // Join-server modal. Triggered by the rail's "+" button. The
  // success callback splices the new server's metadata into a local
  // map so the rail can render its avatar / name without a refetch
  // — the home server's response already carries everything we
  // need (it ran the validation probe).
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  // Direct-messages view toggle. The fixed Pufferblow-logo rail item
  // at the top of the rail switches this on; clicking the home
  // server item below it switches it back off. When true, the
  // channel panel renders a DM surface instead of the server's
  // channel list — see the `dmsOpen ?` branch in the channel-panel
  // render block below.
  const [dmsOpen, setDmsOpen] = useState(false);

  // Channel half of the title-bar breadcrumb. Tracks the active
  // channel only; suppressed entirely while the DM panel is open
  // since "channel" doesn't apply to DMs. Cleared on unmount so
  // non-dashboard pages start clean.
  useEffect(() => {
    if (dmsOpen) {
      setChannelName(null);
      return;
    }
    setChannelName(selectedChannel?.channel_name ?? null);
    return () => setChannelName(null);
  }, [dmsOpen, selectedChannel?.channel_name, setChannelName]);

  const uploadPickerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Moderation modal state. Single field because the modal is opened in
  // exactly one of two modes — keeping them parallel as booleans would
  // let both be true at once. `null` means the modal is closed.
  const [moderationAction, setModerationAction] = useState<{
    kind: "timeout" | "ban";
    userId: string;
    username: string;
  } | null>(null);
  const [moderationSubmitting, setModerationSubmitting] = useState(false);

  const filteredMentionUsers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u) => u.username.toLowerCase().startsWith(q) && u.user_id !== currentUser?.user_id)
      .slice(0, 8);
  }, [mentionQuery, users, currentUser?.user_id]);

  const allUsernamesLower = useMemo(
    () => new Set(users.map((u) => u.username.toLowerCase())),
    [users],
  );

  const applyMentionSelection = useCallback(
    (username: string) => {
      const textarea = messageInputRef.current;
      if (!textarea) return;
      const { newValue, newCursor } = insertMentionAtCursor(
        messageInput,
        textarea.selectionStart ?? messageInput.length,
        username,
      );
      setMessageInput(newValue);
      setMentionQuery(null);
      setMentionSelectedIdx(0);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursor, newCursor);
      });
    },
    [messageInput, messageInputRef, setMessageInput],
  );

  const canDeleteChannels = hasResolvedPrivilege(currentUser, "delete_channels");
  const canEditChannels = hasResolvedPrivilege(currentUser, "edit_channels");
  // Edit-channel modal state. Opened from the channel right-click
  // menu in the sidebar; mirrors the same flow used in the control
  // panel's Channels tab. `editingChannel` is the snapshot of the
  // row the user is editing; `editChannelForm` is the live in-modal
  // draft so cancelling cleanly discards changes.
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editChannelForm, setEditChannelForm] = useState<{ channel_name: string; is_private: boolean }>(
    { channel_name: "", is_private: false },
  );
  const [editChannelSaving, setEditChannelSaving] = useState(false);
  useEffect(() => {
    if (editingChannel) {
      setEditChannelForm({
        channel_name: editingChannel.channel_name,
        is_private: !!editingChannel.is_private,
      });
    }
  }, [editingChannel]);
  const handleSaveChannelEdit = async () => {
    if (!editingChannel) return;
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      showToast({ message: 'Authentication token not found.', tone: 'error', category: 'system' });
      return;
    }
    const trimmedName = editChannelForm.channel_name.trim();
    if (!trimmedName) {
      showToast({ message: 'Channel name cannot be empty.', tone: 'error', category: 'validation' });
      return;
    }
    // Only send fields that actually changed so the backend's
    // unique-name check doesn't reject saving against the channel's
    // own current name.
    const payload: { channel_name?: string; is_private?: boolean } = {};
    if (trimmedName !== editingChannel.channel_name) payload.channel_name = trimmedName;
    if (!!editChannelForm.is_private !== !!editingChannel.is_private) {
      payload.is_private = editChannelForm.is_private;
    }
    if (Object.keys(payload).length === 0) {
      setEditingChannel(null);
      return;
    }
    setEditChannelSaving(true);
    try {
      const response = await updateChannel(editingChannel.channel_id, payload, authToken);
      if (response.success) {
        showToast({
          message: `Channel #${trimmedName} updated successfully.`,
          tone: 'success',
          category: 'destructive',
        });
        const listResponse = await listChannels(authToken);
        if (listResponse.success && listResponse.data && listResponse.data.channels) {
          setChannels(listResponse.data.channels);
        }
        setEditingChannel(null);
      } else {
        const isCollision =
          response.error?.includes('409') ||
          response.error?.toLowerCase().includes('already exists');
        showToast({
          message: isCollision
            ? 'A channel with that name already exists. Choose a different name.'
            : `Failed to update channel: ${response.error || 'Unknown error'}`,
          tone: 'error',
          category: isCollision ? 'validation' : 'system',
        });
      }
    } catch (err) {
      showToast({
        message: 'An unexpected error occurred while updating the channel.',
        tone: 'error',
        category: 'system',
      });
    } finally {
      setEditChannelSaving(false);
    }
  };
  const canTimeoutUsers = hasResolvedPrivilege(currentUser, "mute_users");
  const canBanUsers = hasResolvedPrivilege(currentUser, "ban_users");
  const canDeleteMessages = hasResolvedPrivilege(currentUser, "delete_messages");
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
  // "Create Channel" is gated by the `create_channels` privilege so the
  // option doesn't tempt non-eligible viewers; the modal itself can
  // still validate server-side. Falls back to the admin/owner flags
  // for the broad-strokes "this user can manage stuff" cases.
  const canCreateChannels =
    currentUser?.is_owner ||
    currentUser?.is_admin ||
    currentUserPrivileges.includes("create_channels");
  // "Leave Server" only renders when the viewer is NOT a native member
  // of this instance -- a federated visitor has somewhere to leave to,
  // while the home-instance user's account *is* this server's account
  // and "leave" would mean deleting it (a different flow). The check
  // compares the user's `origin_server` (host:port string from signup)
  // against the host:port the client is currently connected to.
  const homeHostPort =
    (typeof window !== "undefined" && (getHostPortFromStorage() || getHostPortFromCookies())) || "";
  const canLeaveServer =
    !!currentUser?.origin_server &&
    !!homeHostPort &&
    currentUser.origin_server !== homeHostPort;

  // Tracks whether the emoji picker is currently aimed at the message input
  // (default) or at adding a reaction to a specific message. We can't reuse
  // `currentMenuMessageId` alone for this because that ID lingers after the
  // context menu closes and the picker is also opened from the input toolbar.
  const [reactionTargetMessageId, setReactionTargetMessageId] = useState<string | null>(null);

  // Ask the OS for permission to show desktop notifications once the
  // dashboard mounts. ensureNotificationPermission is idempotent: it returns
  // the cached state if granted/denied and only prompts the very first time.
  useEffect(() => {
    void ensureNotificationPermission();
  }, []);

  // Mirror the Electron tray's notifications-muted toggle into the
  // desktopNotifications service so dispatchDesktopNotification can
  // suppress toasts when the user has muted from the tray. No-op in
  // plain-browser builds (the IPC bridge is absent).
  useEffect(() => {
    const dispose = subscribeNotificationsMuted();
    return dispose;
  }, []);

  // Close the composer upload picker when the user clicks anywhere
  // outside of it, or hits Escape. Bound only while the popover is
  // open so it doesn't burn cycles otherwise.
  useEffect(() => {
    if (!uploadPickerOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (uploadPickerRef.current && !uploadPickerRef.current.contains(e.target as Node)) {
        setUploadPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUploadPickerOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [uploadPickerOpen]);

  // Push the total-unread count into the OS tray / dock badge whenever the
  // per-channel unread map changes. Web builds short-circuit inside
  // setUnreadBadge because window.electron is undefined.
  useEffect(() => {
    const total = Object.values(unreadCountsByChannel).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0,
    );
    setUnreadBadge(total);
  }, [unreadCountsByChannel]);

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
        const info = response.data.server_info;
        setServerInfo({
          ...info,
          avatar_url: info.avatar_url ? convertToFullStorageUrl(info.avatar_url) : info.avatar_url,
          banner_url: info.banner_url ? convertToFullStorageUrl(info.banner_url) : info.banner_url,
        });
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

  // Auto-resize the composer textarea + schedule draft persistence.
  // Both used to fire as separate per-keystroke effects; combining
  // them into one effect halves the post-render setup cost and
  // colocates the two pieces of work that consume `messageInput` so
  // a future change can see them together. `scheduleDraftPersistence`
  // is itself debounced inside the hook (250ms), so the only thing
  // that runs synchronously per keystroke is the resize.
  useEffect(() => {
    resizeMessageComposer();
    if (!selectedChannel) {
      flushPendingDraftPersistence();
      return;
    }
    scheduleDraftPersistence(selectedChannel.channel_id, messageInput);
  }, [
    messageInput,
    resizeMessageComposer,
    selectedChannel,
    flushPendingDraftPersistence,
    scheduleDraftPersistence,
  ]);

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
    // Don't override a manual presence lock (DND/AFK) already set in the DB.
    // manualPresenceLock state hasn't committed yet at this point, so check currentUser.status directly.
    if (currentUser.status !== 'dnd' && currentUser.status !== 'afk') {
      void updatePresenceStatus("online");
    }
  }, [currentUser, updatePresenceStatus]);

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
          category: "system",
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

  /**
   * Channel-scoped search. Returns message hits from the CURRENT channel
   * only -- no cross-channel results, no user results, no channel-name
   * matches. Two sources, deduped:
   *
   *   1. Local message cache -- instant, covers the messages already
   *      loaded into the active view.
   *   2. Server-side decrypt-and-scan for the active channel -- picks
   *      up matches outside the local cache, capped at the server's
   *      `scan_limit`. When the cap was hit, the result's `meta`
   *      reports `truncatedScan: true` so the panel can warn the user.
   *
   * Returns an empty result set when no channel is selected, which
   * matches the UI behavior of hiding the search button entirely in
   * that case.
   */
  const handleSearch = async (query: string) => {
    const q = query.toLowerCase();
    const results: Array<{ id: string; type: "message" | "user" | "channel"; title: string; subtitle?: string; content?: string; timestamp?: string; channel_id?: string; avatar?: string }> = [];
    let truncatedScan = false;
    let scannedChannelName: string | undefined;
    const seenMessageIds = new Set<string>();

    if (!selectedChannel) {
      return { results, meta: { truncatedScan, scannedChannelName } };
    }
    const currentChannelId = selectedChannel.channel_id;

    // Shared avatar lookup -- mirrors how the messages list resolves
    // sender avatars so a search result and the actual message row
    // show the same face. Delegates to the unified
    // `resolveSenderAvatarUrl` helper so all three surfaces
    // (message list, search results, reply pill) render the exact
    // same image for a given sender, including the identicon
    // fallback for users we have no upload for.
    const resolveSenderAvatar = (
      senderUserId: string,
      fallback?: string | null,
      fallbackUsername?: string | null,
    ): string => {
      const cached = usersById.get(senderUserId);
      return resolveSenderAvatarUrl(
        cached ?? { user_id: senderUserId, username: fallbackUsername ?? undefined },
        fallback,
        fallbackUsername ?? cached?.username ?? senderUserId,
      );
    };

    // Local cache: messages already loaded for the active channel.
    for (const message of messages) {
      if (message.channel_id !== currentChannelId) continue;
      if (!message.message?.toLowerCase().includes(q)) continue;
      const sender = usersById.get(message.sender_user_id);
      results.push({
        id: message.message_id,
        type: "message",
        title: sender?.username || message.username || "Unknown User",
        subtitle: `#${selectedChannel.channel_name}`,
        content: message.message,
        timestamp: message.sent_at,
        channel_id: message.channel_id || undefined,
        avatar: resolveSenderAvatar(
          message.sender_user_id,
          message.sender_avatar_url,
          sender?.username || message.username,
        ),
      });
      seenMessageIds.add(message.message_id);
    }

    // Server-side scan for the active channel. Failures are non-fatal --
    // local results still display.
    const authToken = getAuthTokenFromCookies() || '';
    const resolvedInstance =
      resolveStoredInstance(getHostPortFromStorage()) ??
      resolveStoredInstance(getHostPortFromCookies());
    if (authToken && resolvedInstance && query.trim().length >= 2) {
      try {
        const response = await searchChannelMessages(
          resolvedInstance.raw,
          currentChannelId,
          query.trim(),
          authToken,
        );
        if (response.success && response.data?.messages) {
          if (response.data.truncated_scan) {
            truncatedScan = true;
            scannedChannelName = selectedChannel.channel_name;
          }
          for (const message of response.data.messages) {
            if (seenMessageIds.has(message.message_id)) continue;
            const sender = usersById.get(message.sender_user_id);
            results.push({
              id: message.message_id,
              type: "message",
              title: sender?.username || message.username || "Unknown User",
              subtitle: `#${selectedChannel.channel_name}`,
              content: message.message,
              timestamp: message.sent_at,
              channel_id: currentChannelId,
              avatar: resolveSenderAvatar(
                message.sender_user_id,
                message.sender_avatar_url,
                sender?.username || message.username,
              ),
            });
            seenMessageIds.add(message.message_id);
          }
        } else if (!response.success) {
          logger.network.warn("Server-side channel search failed", {
            channelId: currentChannelId,
            error: response.error,
          });
        }
      } catch (error) {
        logger.network.warn("Server-side channel search threw", {
          channelId: currentChannelId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      results: results.slice(0, 50),
      meta: { truncatedScan, scannedChannelName },
    };
  };

  /**
   * Scroll the chat stream to a specific message and flash it. Used by
   * search-result clicks; can be reused for jump-to-mention or
   * permalink flows. The DOM anchor is set on each message group's
   * outer container as `id="msg-<message_id>"`; the highlight state
   * adds a temporary ring around the row that fades after ~1.6s.
   */
  const scrollToMessage = (messageId: string) => {
    // Defer to next frame so the channel-switch render has flushed
    // (otherwise the target element may not exist yet).
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      window.setTimeout(() => {
        setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
      }, 1600);
    });
  };

  /**
   * Inspect the textarea value + cursor position to decide whether
   * we're inside an active `:emoji_alias` token. Returns the matching
   * alias prefix + position bounds when we are, null otherwise. The
   * trigger is intentionally loose: typing `:` opens the popover with
   * the most-common emojis (empty-prefix match); typing letters
   * narrows it; a space / newline / closing `:` dismisses it.
   */
  const detectEmojiToken = (
    value: string,
    caret: number,
  ): { query: string; tokenStart: number; tokenEnd: number } | null => {
    // Walk backwards from the caret looking for an unbroken alias-y
    // run [a-z0-9_+-] followed by `:`. Stop at whitespace or another
    // colon (closing colon means the alias is already complete and
    // should be replaced via `convertEmojiAliasesOnSend`, not via the
    // autocomplete popover).
    const before = value.slice(0, caret);
    const match = before.match(/(?:^|\s):([a-z0-9_+\-]*)$/i);
    if (!match) return null;
    const query = match[1].toLowerCase();
    const tokenStart = before.length - match[0].length + (match[0].startsWith(":") ? 0 : 1);
    return { query, tokenStart, tokenEnd: caret };
  };

  // Emoji alias matching now uses the precomputed prefix buckets from
  // `utils/emojiAliases.ts` -- no Object.entries / sort happens per
  // keystroke. See that module for the lookup structure.
  const matchEmojiAliases = findEmojiAliasMatches;

  // Deferred autocomplete update: typing a key must update the
  // textarea synchronously (or the cursor jumps), but the autocomplete
  // popover can lag a frame without harm. Wrapping `setEmojiSuggest` in
  // a transition tells React to treat the popover update as low-
  // priority -- React 19 will preempt it if more keystrokes arrive.
  const [, startEmojiSuggestTransition] = useTransition();

  /**
   * Replace the active `:alias` token (or `:alias:`) in `messageInput`
   * with the chosen emoji, advance the caret, and close the popover.
   * Re-focuses the textarea so typing continues naturally.
   */
  const applyEmojiSuggestion = (emoji: string) => {
    if (!emojiSuggest) return;
    const { tokenStart, tokenEnd } = emojiSuggest;
    // If a closing `:` follows the cursor (user typed `:smile:` then
    // moved back), absorb it so we don't leave a dangling colon.
    let endCut = tokenEnd;
    if (messageInput[tokenEnd] === ":") endCut = tokenEnd + 1;
    const next =
      messageInput.slice(0, tokenStart) + emoji + messageInput.slice(endCut);
    setMessageInput(next);
    setEmojiSuggest(null);
    requestAnimationFrame(() => {
      const ta = messageInputRef.current;
      if (!ta) return;
      const caret = tokenStart + emoji.length;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  };

  const handleSelectSearchResult = (result: any) => {
    logger.ui.debug("Selected dashboard search result", { resultType: result?.type, resultId: result?.id });
    setSearchModalOpen(false);
    if (result?.type === 'channel') {
      const channel = channels.find(c => c.channel_id === result.id);
      if (channel) void handleChannelSelect(channel);
    } else if (result?.type === 'message') {
      // Prefer the channel_id the result was tagged with — this catches
      // server-side hits whose message isn't yet in the local cache. Fall
      // back to scanning loaded messages for backward compatibility.
      const channelId =
        result.channel_id ||
        channels.find(c => messages.some(m => m.message_id === result.id && m.channel_id === c.channel_id))?.channel_id;
      const channel = channelId ? channels.find(c => c.channel_id === channelId) : undefined;
      if (channel) {
        const isAlreadyOpen = selectedChannel?.channel_id === channel.channel_id;
        if (isAlreadyOpen) {
          // Same channel -- just scroll. No need to await any load.
          scrollToMessage(result.id);
        } else {
          // Different channel -- switch first, then scroll on the
          // next render. handleChannelSelect is async (loads messages
          // for the new channel); the message we're targeting might
          // be off-screen until those load. The RAF inside
          // scrollToMessage handles the timing.
          void handleChannelSelect(channel).then(() => scrollToMessage(result.id));
        }
      }
    }
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

  /**
   * Apply a specific emoji as a reaction to a message. Optimistically updates
   * the local reactions state so the pill appears instantly, then reconciles
   * with the server's authoritative summary in the response. Removing a
   * reaction the viewer already applied is the same call path (toggle).
   */
  const applyReactionToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      const authToken = getAuthTokenFromCookies() || '';
      const hostPort = getHostPortFromStorage() || getHostPortFromCookies();

      if (!authToken || !hostPort) {
        showToast({
          message: "Couldn't add reaction — you don't appear to be signed in.",
          tone: "error",
          category: "system",
        });
        return;
      }

      const targetMessage = getMessageById(messageId);
      if (!targetMessage || !targetMessage.channel_id) {
        showToast({
          message: "Couldn't add reaction — message is no longer available.",
          tone: "error",
          category: "validation",
        });
        return;
      }

      const channelId = targetMessage.channel_id;
      const viewerAlreadyReacted = (targetMessage.reactions || []).some(
        (entry) => entry.emoji === emoji && entry.viewer_reacted,
      );

      const response = viewerAlreadyReacted
        ? await removeReaction(hostPort, channelId, messageId, emoji, authToken)
        : await addReaction(hostPort, channelId, messageId, emoji, authToken);

      if (!response.success) {
        showToast({
          message: `Failed to update reaction: ${response.error || 'Unknown error'}`,
          tone: "error",
          category: "system",
        });
        return;
      }

      const nextReactions: MessageReaction[] = response.data?.reactions || [];
      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === messageId ? { ...m, reactions: nextReactions } : m,
        ),
      );
      logger.ui.debug("Reaction mutation applied", {
        messageId,
        emoji,
        toggleDirection: viewerAlreadyReacted ? "remove" : "add",
      });
    },
    [getMessageById, setMessages, showToast],
  );

  const handleMessageReact = (messageId: string) => {
    logger.ui.debug("Reaction action selected", { messageId });
    // Two-step in one call: aim the emoji picker at the target
    // message AND open the picker. The previous version only aimed
    // it; opening had to happen via the context menu's onReaction
    // path. With the new hover action bar firing this handler
    // directly, the open step has to live here too.
    setReactionTargetMessageId(messageId);
    setIsEmojiPickerOpen(true);
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

  /**
   * Copy the message's *text* (not the ID) to the clipboard. Separate
   * from handleMessageCopy because the right-click menu exposes both:
   * "Copy Message" (this) and "Copy Message ID" (handleMessageCopy).
   * Attachment-only messages fall back to a friendly placeholder so
   * the clipboard isn't silently empty.
   */
  /**
   * Does this message carry media we should offer to download
   * instead of copy?
   *
   * The Copy Message menu entry copies the message's TEXT to the
   * clipboard. For an image-only / video-only / gif-only / audio-
   * only message that's a useless action (the binary content
   * doesn't fit in the clipboard text channel). When the message
   * carries an attachment with a media MIME, the context menu
   * swaps Copy Message for Download instead.
   *
   * Mixed messages (text + media) also get Download — the
   * media is almost always the more useful affordance when the
   * user reached for the context menu on a media-bearing
   * message.
   */
  const messageHasDownloadableMedia = (messageId: string | null): boolean => {
    if (!messageId) return false;
    const message = getMessageById(messageId);
    if (!message?.attachments?.length) return false;
    return message.attachments.some((attachment) => {
      const type = (attachment.type || "").toLowerCase();
      return (
        type.startsWith("image/")
        || type.startsWith("video/")
        || type.startsWith("audio/")
      );
    });
  };

  /**
   * Download every media attachment on a message. Multi-attachment
   * messages produce multiple `downloadFileViaBlob` calls in
   * sequence; the helper handles the auth-refresh retry and the
   * blob → anchor click trick on its own, so we don't need a
   * sleep / queue between calls.
   */
  const handleMessageDownload = async (messageId: string | null) => {
    if (!messageId) return;
    const message = getMessageById(messageId);
    if (!message?.attachments?.length) {
      showToast({
        message: "Nothing to download from this message.",
        tone: "warning",
        category: "validation",
      });
      return;
    }
    const { downloadFileViaBlob } = await import("../../utils/downloadFile");
    let failed = 0;
    for (const attachment of message.attachments) {
      const result = await downloadFileViaBlob({
        url: createFullUrl(attachment.url) ?? attachment.url,
        filename: attachment.filename,
        mimeType: attachment.type,
      });
      if (!result.success) {
        failed += 1;
        logger.ui.error("Attachment download failed", {
          filename: attachment.filename,
          error: result.error,
        });
      }
    }
    if (failed > 0) {
      showToast({
        message:
          failed === message.attachments.length
            ? "Failed to download attachment."
            : `Downloaded ${message.attachments.length - failed} of ${message.attachments.length} attachments.`,
        tone: "error",
        category: "system",
      });
    }
  };

  const handleMessageCopyText = async (messageId: string | null) => {
    if (!messageId) return;
    const message = getMessageById(messageId);
    if (!message) {
      showToast({
        message: "Message no longer available to copy.",
        tone: "error",
        category: "validation",
      });
      return;
    }
    const text =
      message.message?.trim() ||
      (message.attachments && message.attachments.length > 0
        ? "(attachment-only message)"
        : "");
    if (!text) {
      showToast({
        message: "Nothing to copy from this message.",
        tone: "warning",
        category: "validation",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      logger.ui.error("Failed to copy message text", { error });
      showToast({
        message: "Failed to copy message text. Please try again.",
        tone: "error",
        category: "validation",
      });
    }
  };

  /**
   * Delete a message. Authorization happens server-side; we still gate
   * the UI affordance behind canDelete (sender or `delete_messages`
   * privilege) so non-eligible viewers don't see the option at all.
   * No confirmation dialog right now -- the context menu interaction is
   * itself two-step (right-click, then click Delete).
   */
  const handleMessageDelete = async (messageId: string | null) => {
    if (!messageId) return;
    const message = getMessageById(messageId);
    const authToken = getAuthTokenFromCookies() || "";
    const hostPort = getHostPortFromStorage() || getHostPortFromCookies();
    if (!authToken || !hostPort) {
      showToast({
        message: "You need to be signed in to delete messages.",
        tone: "error",
        category: "system",
      });
      return;
    }
    if (!message?.channel_id) {
      showToast({
        message: "Cannot determine which channel this message belongs to.",
        tone: "error",
        category: "validation",
      });
      return;
    }
    try {
      const response = await deleteMessage(hostPort, messageId, authToken, message.channel_id);
      if (!response.success) {
        throw new Error(response.error || "Delete failed");
      }
      // The WS stream broadcasts a deletion event that prunes the local
      // cache, but optimistically remove now so the row vanishes on the
      // right-click frame instead of waiting a round-trip.
      setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
    } catch (error) {
      logger.ui.error("Failed to delete message", { error });
      showToast({
        message: error instanceof Error ? error.message : "Failed to delete message.",
        tone: "error",
        category: "system",
      });
    }
  };

  /**
   * Edit a message. The server doesn't ship message-edit yet (see
   * services/message.ts updateMessage stub), so this surfaces a clear
   * "not yet" toast instead of pretending to work. Wired here so the
   * menu item itself stays consistent across surfaces -- if/when the
   * server adds the endpoint, only this handler changes.
   */
  const handleMessageEdit = (messageId: string | null) => {
    if (!messageId) return;
    showUnsupportedSingleInstanceAction(
      "Editing messages",
      "The server doesn't ship message editing yet. The right-click menu surfaces the option so it's discoverable; we'll wire it up once the API lands.",
    );
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

              // Reaction add/remove broadcasts: every viewer gets the same
              // payload, so we compute their own `viewer_reacted` locally
              // against the user_ids list rather than relying on the server.
              if (
                message.type === "message_reaction_added" ||
                message.type === "message_reaction_removed"
              ) {
                const payload = message as unknown as {
                  message_id?: string;
                  channel_id?: string;
                  reactions?: Array<{
                    emoji: string;
                    count: number;
                    user_ids?: string[];
                  }>;
                };
                if (!payload.message_id || !payload.reactions) {
                  return;
                }
                const viewerId = currentUserIdRef.current;
                const nextReactions: MessageReaction[] = payload.reactions.map(
                  (entry) => ({
                    emoji: entry.emoji,
                    count: entry.count,
                    viewer_reacted: Boolean(viewerId && (entry.user_ids || []).includes(viewerId)),
                    user_ids: entry.user_ids,
                  }),
                );
                setMessages((prev) =>
                  prev.map((m) =>
                    m.message_id === payload.message_id
                      ? { ...m, reactions: nextReactions }
                      : m,
                  ),
                );
                return;
              }

              // OS-level toast for fresh notifications (mentions, etc.). The
              // service decides whether to actually fire — it suppresses when
              // the viewer is already focused on the source channel.
              if (message.type === "notification_created") {
                const notif = message.notification;
                const actor = notif.actor_user_id
                  ? usersById.get(notif.actor_user_id)
                  : undefined;
                const targetChannel = notif.channel_id
                  ? channels.find((c) => c.channel_id === notif.channel_id)
                  : undefined;
                const sourceMessage = notif.message_id
                  ? messages.find((m) => m.message_id === notif.message_id)
                  : undefined;
                dispatchDesktopNotification(message, {
                  actorUsername: actor?.username,
                  channelName: targetChannel?.channel_name,
                  bodyPreview: sourceMessage?.message,
                  activeChannelId: selectedChannelIdRef.current,
                  onActivate: () => {
                    if (targetChannel) {
                      void handleChannelSelect(targetChannel);
                    }
                  },
                });
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
                readMessageIdsRef.current.has(normalizedMessage.message_id) ||
                // If the user is actively viewing this channel, the message
                // is already appended above (line ~1306) and a markMessagesRead
                // call was kicked off. Returning here prevents the unread
                // count + notification entry from being created for a
                // message that's literally on screen -- the badge would
                // never go to zero because `markMessagesRead` resolving
                // doesn't decrement `unreadCountsByChannel`. This was the
                // user-visible "badge counts up forever" bug.
                incomingChannelId === selectedChannelIdRef.current
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
          if (manualPresenceLock) {
            wsConnection.setStatusOnConnect(manualPresenceLock);
          }
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
    // The menu now always opens -- "Mark As Read" is available to every
    // viewer, not just admins. Individual items inside the menu still
    // gate themselves by privilege (e.g. Delete Channel requires
    // canDeleteChannels).
    setChannelContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      channel: channel,
    });
  };

  /**
   * Clear unread state for a single channel without navigating to it.
   * Wired to the "Mark As Read" item on the channel context menu and
   * called per-channel by the server-dropdown's "Mark All As Read".
   * UI-only (no API call) -- mirrors how `handleChannelSelect` clears
   * the channel's entry when the user actually opens it.
   */
  const handleMarkChannelRead = (channelId: string) => {
    markChannelNotificationsRead(channelId);
    setUnreadCountsByChannel((prev) => {
      if (!prev[channelId]) return prev;
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
  };

  /**
   * Server-wide "Mark All As Read." Reuses the existing notification
   * clear path; renamed in the UI to match the dropdown label.
   */
  const handleMarkAllChannelsRead = () => {
    handleMarkAllNotificationsRead();
  };

  /**
   * Stub for server mute. The backend doesn't ship a per-server mute
   * flag yet, so this surfaces the standard "not yet" toast instead of
   * pretending to mute anything. The menu entry stays so the feature
   * is discoverable; wiring lands once the API does.
   */
  const handleMuteServer = () => {
    showUnsupportedSingleInstanceAction(
      "Server mute",
      "Muting the whole server (silence channel notifications, keep mention pings) isn't shipped yet. The dropdown surfaces the action so we know to wire it once the API lands.",
    );
  };

  /**
   * Stub for "Leave Server." Only renders in the dropdown when the
   * viewer's account origin is NOT this server (you can't leave the
   * home instance that minted your account). For everyone else this
   * is a federated visit; the action will eventually unsubscribe the
   * viewer from this server's channels. Currently a toast stub.
   */
  const handleLeaveServer = () => {
    const confirmed = window.confirm(
      "Leave this server? You'll need a new invite to rejoin.",
    );
    if (!confirmed) return;
    showUnsupportedSingleInstanceAction(
      "Leave server",
      "Leaving a federated server (unsubscribing from its channels and removing it from your sidebar) isn't shipped yet.",
    );
  };

  /**
   * Avatar resolver for voice-channel participants. Shared between two
   * consumers so the sidebar participant rows and the main VoiceCallUI
   * tiles render the same face for the same user_id:
   *
   *   1. <ChannelList> -> <VoiceChannel> -> <ParticipantRow>
   *   2. <VoiceCallUI> -> <ParticipantCard>
   *
   * Resolution order:
   *   - Local users cache (`usersById`) covers remote participants we've
   *     already loaded for this server.
   *   - `currentUser` covers self when the users list response omits the
   *     requester.
   *   - Identicon fallback derived from username or user_id covers
   *     freshly-joined federated peers we haven't fetched a profile for.
   *
   * Defined once here as a plain const (the function recreates per
   * render but each consumer just calls it during render anyway, so
   * memoizing wouldn't help with re-renders).
   */
  const resolveVoiceParticipantAvatar = (
    userId: string,
    username?: string,
  ): string | undefined => {
    const found =
      usersById.get(userId) ??
      (userId === currentUser?.user_id ? currentUser : undefined);
    if (found?.avatar_url) {
      return (
        createFullUrl(found.avatar_url) ??
        createFallbackAvatarUrl(found.username || username || userId)
      );
    }
    return createFallbackAvatarUrl(username || found?.username || userId);
  };

  // Opens the moderation modal in timeout mode. The actual API call happens
  // in handleModerationSubmit once the moderator confirms — splitting the
  // intent from the execution lets us reuse one modal for both action kinds
  // and run validation on the form inputs before hitting the network.
  const handleUserTimeout = (userId: string, username: string) => {
    const authToken = getAuthTokenFromCookies() || "";
    if (!authToken) {
      showToast({
        message: "You need to be signed in to moderate users.",
        tone: "error",
        category: "system",
      });
      return;
    }
    setModerationAction({ kind: "timeout", userId, username });
  };

  const handleUserBan = (userId: string, username: string) => {
    const authToken = getAuthTokenFromCookies() || "";
    if (!authToken) {
      showToast({
        message: "You need to be signed in to moderate users.",
        tone: "error",
        category: "system",
      });
      return;
    }
    setModerationAction({ kind: "ban", userId, username });
  };

  /**
   * Executes the pending moderation action with the form values gathered
   * by ModerationActionModal. The modal pre-validates duration so the
   * `durationMinutes` field is guaranteed defined for timeouts.
   */
  const handleModerationSubmit = async (data: ModerationActionSubmit) => {
    if (!moderationAction) return;
    const { kind, userId, username } = moderationAction;
    const authToken = getAuthTokenFromCookies() || "";
    if (!authToken) {
      showToast({
        message: "You need to be signed in to moderate users.",
        tone: "error",
        category: "system",
      });
      setModerationAction(null);
      return;
    }

    setModerationSubmitting(true);
    try {
      if (kind === "timeout") {
        const response = await timeoutUser(userId, {
          auth_token: authToken,
          duration_minutes: data.durationMinutes!,
          reason: data.reason,
        });
        if (!response.success) {
          showToast({
            message: `Failed to timeout ${username}: ${response.error || "Unknown error"}`,
            tone: "error",
            category: "system",
          });
          return;
        }
        const minutes = data.durationMinutes!;
        showToast({
          message: `${username} has been timed out for ${minutes} minute${minutes === 1 ? "" : "s"}.`,
          tone: "success",
          category: "destructive",
        });
      } else {
        const response = await banUser(userId, {
          auth_token: authToken,
          reason: data.reason,
        });
        if (!response.success) {
          showToast({
            message: `Failed to ban ${username}: ${response.error || "Unknown error"}`,
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
      }
      setModerationAction(null);
      setUserContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
      setSelectedContextUser(null);
    } finally {
      setModerationSubmitting(false);
    }
  };

  // Message input handlers
  //
  // `useDeferredValue` lets non-urgent consumers (the character count
  // in the composer footer, the send button's `disabled` state) read
  // a slightly stale version of `messageInput` while the textarea
  // itself uses the live value. Under React 19 concurrent rendering
  // this means a fast typist isn't blocked by re-evaluations of these
  // derived fields -- React updates them in a low-priority pass.
  const deferredMessageInput = useDeferredValue(messageInput);
  const canSendMessage =
    Boolean(selectedChannel) &&
    !isSendingMessage &&
    (Boolean(deferredMessageInput.trim()) || messageAttachments.length > 0);

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
    // Picker has two roles: insertion into the message input, or applying a
    // reaction to a specific message. The reaction target is set just before
    // the picker is opened from the message context menu (see onReact below).
    if (reactionTargetMessageId) {
      const targetId = reactionTargetMessageId;
      setReactionTargetMessageId(null);
      setIsEmojiPickerOpen(false);
      void applyReactionToMessage(targetId, emoji);
      return;
    }

    setMessageInput(prev => prev + emoji);
    setIsEmojiPickerOpen(false);
    logger.ui.debug("Emoji added to message", { emoji });
  };

  /**
   * Send the selected GIF as a one-click message. We post the GIF URL wrapped
   * in markdown image syntax so ReactMarkdown renders it inline in the
   * message stream without any additional renderer plumbing. The picker is
   * closed before the network call so the UI feels responsive even if the
   * send is slow; failures surface via toast.
   */
  const handleGifSelect = async (gif: { url: string; title: string }) => {
    logger.ui.info("GIF selected", { gifUrl: gif.url, gifTitle: gif.title });
    setIsEmojiPickerOpen(false);

    if (!selectedChannel) {
      showToast({
        message: "Pick a channel before sending a GIF.",
        tone: "error",
        category: "validation",
      });
      return;
    }

    const authToken = getAuthTokenFromCookies() || "";
    if (!authToken) {
      showToast({
        message: "You don't appear to be signed in — can't send the GIF.",
        tone: "error",
        category: "system",
      });
      return;
    }

    const resolvedInstance =
      resolveStoredInstance(getHostPortFromStorage()) ??
      resolveStoredInstance(getHostPortFromCookies());
    if (!resolvedInstance) {
      showToast({
        message: "No home instance configured. Connect to an instance first.",
        tone: "error",
        category: "system",
      });
      return;
    }

    // Markdown image: ReactMarkdown's default `img` element renders the GIF
    // inline. Sanitize the alt text so a stray `]` can't break the syntax.
    const safeTitle = (gif.title || "GIF").replace(/[\[\]]/g, "");
    const content = `![${safeTitle}](${gif.url})`;

    try {
      const response = await sendMessage(
        resolvedInstance.raw,
        selectedChannel.channel_id,
        { content, sentAt: new Date().toISOString() },
        authToken,
      );

      if (!response.success) {
        showToast({
          message: `Failed to send GIF: ${response.error || "Unknown error"}`,
          tone: "error",
          category: "system",
        });
        return;
      }

      const createdMessage = response.data?.message_data;
      if (createdMessage) {
        appendUniqueMessage(createdMessage);
      }
    } catch (error) {
      logger.ui.error("Unexpected error sending GIF", { error });
      showToast({
        message: "An unexpected error occurred while sending the GIF.",
        tone: "error",
        category: "system",
      });
    }
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

        // Resolve avatar/banner via the appearance helpers. resolveAvatarUrl
        // honors avatar_kind: 'image' uses the uploaded URL; 'identicon'
        // (default for new users) renders the DiceBear identicon seeded
        // from avatar_seed and tinted with the user's accent_color.
        // resolveBanner does the same for solid-vs-image banner mode.
        const resolvedAvatar = resolveAvatarUrl(
          {
            user_id: userData.user_id || userId,
            username: displayedUsername,
            avatar_kind: userData.avatar_kind,
            banner_kind: userData.banner_kind,
            avatar_url: userData.avatar_url
              ? createFullUrl(userData.avatar_url) || undefined
              : undefined,
            accent_color: userData.accent_color,
            avatar_seed: userData.avatar_seed,
          },
        );
        const resolvedBannerResult = resolveBanner({
          banner_kind: userData.banner_kind,
          banner_url: userData.banner_url
            ? createFullUrl(userData.banner_url) || undefined
            : undefined,
          accent_color: userData.accent_color,
        });

        const displayUser: DisplayUser = {
          id: userData.user_id || userId,
          username: displayedUsername,
          avatar: resolvedAvatar,
          // banner stays undefined when banner_kind=solid so UserCard
          // renders just the gradient backdrop using bannerColor.
          banner: resolvedBannerResult.mode === 'image' ? resolvedBannerResult.url : undefined,
          // accentColor (for badges/etc) prefers the user-chosen palette
          // value when present; falls back to the role-derived color.
          accentColor: userData.accent_color || getUserAccentColor(userData.roles_ids),
          bannerColor: resolvedBannerResult.mode === 'solid'
            ? resolvedBannerResult.color
            : (userData.accent_color || getUserAccentColor(userData.roles_ids)),
          // customStatus is meant for the user's optional one-line
          // status text. The previous fallback ("Server Owner" /
          // "Administrator" / "Active Member") duplicated the role
          // badge already rendered in the profile card's badge row,
          // so "Server Owner" ended up showing twice on the popup.
          // We leave this undefined until the API surfaces a real
          // custom-status field; the role badge alone now communicates
          // role membership.
          customStatus: undefined,
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
      <div className="h-full bg-[var(--color-background)] flex items-center justify-center">
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
      <div className="h-full bg-[var(--color-background)] flex items-center justify-center">
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
      <div className="h-full bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none relative">
        <div className="flex h-full shrink-0 flex-col gap-2">
          <div className="flex min-h-0 flex-1 gap-2">
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
            </div>
          </div>

          <UserPanel
            username="Loading..."
            avatar="/pufferblow-art-pixel-32x32.png"
            status="offline"
            onClick={() => { }}
            className="w-full opacity-60"
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
    <div className="h-full overflow-hidden bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none relative min-w-0">
      {/* Left Sidebar Container */}
      <div className="flex h-full shrink-0 flex-col gap-2">
        {/* Server and Channel Sidebars Row */}
        <div className="flex min-h-0 flex-1 gap-2">
          {/* Server Sidebar — one row per joined server. Each row is a
              `ServerRailItem`: w-16 (rail-width) box, avatar centered,
              vertical selection pill on the LEFT edge. The pill is a
              sibling of the avatar so hover / selection visuals never
              animate across the avatar's own pixels — the avatar shape
              stays rectangular (rounded-lg) on every state. The
              divider separates the current home instance from
              externally-joined servers (only the current shows until
              multi-server lands; the divider is kept so the visual
              rhythm doesn't shift on first multi-join). */}
          <ServerRail>
            {/* No `py-2` on the inner container — the rail's own
                outer `py-2` already provides vertical breathing room.
                Doubling them made the inner's `h-full` (which
                evaluates to the rail's content-box height) add its
                own padding on top, blowing the inner ~16 px past the
                available height and tripping `overflow-y-auto`. */}
            <div className="flex h-full flex-col space-y-2">
              {/* Fixed Direct-Messages slot — always present at the top
                  of the rail. Selects a DM-only view of the channel
                  panel instead of any one server's channel list. The
                  avatar shows the Pufferblow brand mark instead of an
                  instance avatar; the same mark renders inside the
                  splash, the marketing site, and the desktop title
                  bar, so users recognise it as the "this is the app
                  itself" affordance, distinct from the per-instance
                  avatars below it. */}
              <ServerRailItem
                label="Direct messages"
                selected={dmsOpen}
                onClick={() => setDmsOpen(true)}
                // `lockRestingPalette` keeps the avatar on the dark
                // resting surface across hover AND selected. The
                // Pufferblow mark draws in white strokes via
                // currentColor; against the standard selected /
                // hover palette (white bg, on-primary text) the
                // strokes would land white-on-white and the logo
                // would collapse. Selection is still communicated —
                // the full-height left pill is the cue, and the
                // pill behavior is unchanged here.
                lockRestingPalette
              >
                {/* Three stacked horizontal bars — a "list of message
                    rows" glyph for the DM affordance. Reads as a
                    skeleton/list rather than a single bubble, which
                    is what the user wants this slot to communicate:
                    "go to your direct conversations", i.e. an inbox
                    rather than one specific message.

                    Layout decisions:
                      - Lines are the same length (x1=5 → x2=19) so
                        the three rows read as a uniform stack — no
                        accidental "checklist" interpretation.
                      - Even vertical spacing: y=7, 12, 17. The 5-unit
                        gap is identical between every pair, which is
                        what "fixed gap" calls for.
                      - `strokeLinecap="round"` gives the bars
                        soft, pill-shaped ends so they read as
                        skeleton placeholder bars instead of crisp
                        rulers. `strokeWidth=2.4` keeps them weighty
                        without crowding the gaps at 28×28 px.
                      - `currentColor` is preserved so the icon
                        inherits the locked resting palette's
                        text-secondary color, same as the previous
                        glyph. */}
                <svg
                  className="h-7 w-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="7" x2="19" y2="7" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <line x1="5" y1="17" x2="19" y2="17" />
                </svg>
              </ServerRailItem>

              {/* Divider between the DM slot (always-present, app-wide
                  affordance) and the instance avatars (per-server
                  state). Same w-8 hairline used between server groups
                  below. */}
              <div className="mx-auto w-8 h-px bg-[var(--color-surface-tertiary)] rounded" />

              {serverInfo && (
                <ServerRailItem
                  label={serverInfo.server_name || "Server"}
                  selected={!dmsOpen}
                  onClick={() => setDmsOpen(false)}
                  presenceClassName={dmsOpen ? undefined : "bg-[var(--color-success)]"}
                >
                  {serverInfo.avatar_url ? (
                    <ProgressiveImage
                      src={serverInfo.avatar_url}
                      placeholderSrc={serverInfo.avatar_lqip_url ?? null}
                      alt={`${serverInfo.server_name} avatar`}
                      wrapperClassName="h-12 w-12 rounded-lg"
                      className="rounded-lg"
                      fallback={
                        <div className="flex h-full w-full items-center justify-center rounded-lg bg-[var(--color-surface-secondary)] text-lg font-semibold text-[var(--color-text)]">
                          {(serverInfo.server_name || "S").charAt(0).toUpperCase()}
                        </div>
                      }
                    />
                  ) : (
                    (serverInfo.server_name || "S").charAt(0).toUpperCase()
                  )}
                </ServerRailItem>
              )}

              {/* Add-server slot — its own button component owns the
                  shape + hover styling. The mt-auto pushes it to the
                  bottom of the rail; the wrapper keeps it centered in
                  the same 64px column the avatars use, so the rail
                  reads as a vertical column of rectangles.
                  No divider above this button — the only hairline in
                  the rail separates the fixed DM affordance from the
                  joined-instance avatars. Dividing between every
                  server entry would clutter the column once
                  multi-server lands. */}
              <div className="mt-auto flex w-16 items-center justify-center">
                <AddServerButton
                  onClick={() => setJoinModalOpen(true)}
                  title="Join a Pufferblow server"
                  ariaLabel="Join a Pufferblow server"
                />
              </div>
            </div>
          </ServerRail>

          {/* Channel Sidebar — branches on the rail selection. When
              the fixed DM slot at the top of the rail is active the
              panel shows the Direct-Messages surface; otherwise it
              renders the current server's channel list. The DM
              surface stays in the same ChannelPanel shell so the
              sidebar width / borders don't shift between the two
              views. */}
          <ChannelPanel>
            {dmsOpen ? (
              <DirectMessagesPanel />
            ) : (
              <>
                <ChannelSidebarHeader
                  serverInfo={serverInfo}
                  serverDropdownOpen={serverDropdownOpen}
                  setServerDropdownOpen={setServerDropdownOpen}
                  serverDropdownRef={serverDropdownRef}
                  canCreateInvite={canCreateInvite}
                  canAccessControlPanel={canAccessControlPanel}
                  canDeleteServer={canDeleteServer}
                  canCreateChannels={canCreateChannels}
                  canLeaveServer={canLeaveServer}
                  onInviteActionUnavailable={handleInviteActionUnavailable}
                  onCreateChannel={() => setChannelCreationModalOpen(true)}
                  onMarkAllChannelsRead={handleMarkAllChannelsRead}
                  onMuteServer={handleMuteServer}
                  onLeaveServer={handleLeaveServer}
                  showToast={showToast}
                />

                <ChannelList
                  channels={channels}
                  channelsError={channelsError}
                  selectedChannel={selectedChannel}
                  getMessageDraft={getMessageDraft}
                  unreadCountsByChannel={unreadCountsByChannel}
                  onChannelSelect={handleChannelSelect}
                  onChannelContextMenu={handleChannelContextMenu}
                  currentVoiceChannel={currentVoiceChannel}
                  setCurrentVoiceChannel={setCurrentVoiceChannel}
                  onVoiceSessionReady={(session) => {
                    setVoiceSessionActions(session);
                  }}
                  rtcMediaQuality={serverInfo?.rtc_media_quality ?? null}
                  resolveAvatarUrl={resolveVoiceParticipantAvatar}
                />
              </>
            )}
      </ChannelPanel>
        </div>

        {currentUser && (
          <div className="w-full">
            <UserPanel
              username={currentUser.username || ''}
              avatar={currentUser.avatar || ''}
              status={currentUserLiveStatus}
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
      <MessagePane>
        <ChatHeader
          selectedChannel={selectedChannel}
          notifications={notifications}
          notificationMenuOpen={notificationMenuOpen}
          setNotificationMenuOpen={setNotificationMenuOpen}
          notificationMenuRef={notificationMenuRef}
          onNotificationSelect={handleNotificationSelect}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          browserNotificationPermission={browserNotificationPermission}
          onEnableBrowserNotifications={handleEnableBrowserNotifications}
          unreadMarker={unreadMarker}
          onJumpToFirstUnread={handleJumpToFirstUnread}
          membersListVisible={membersListVisible}
          onToggleMembersList={() => setMembersListVisible(!membersListVisible)}
          // Search is now a floating panel anchored to the magnifier icon
          // inside ChatHeader (mirrors the notifications dropdown). The
          // panel is scoped to the active channel's messages only.
          isSearchOpen={searchModalOpen}
          setSearchOpen={setSearchModalOpen}
          onSearch={handleSearch}
          onSelectSearchResult={handleSelectSearchResult}
        />

        {/*
          Voice channels don't carry messages — the body of the chat area
          becomes the voice room (participant grid + screen-share tiles +
          control bar) instead of the messages scroller and composer. We
          keep ChatHeader visible above so channel switching, members
          toggle, etc. still work consistently across channel types.

          The "not yet joined" branch is a passive placeholder: joining a
          voice channel happens by clicking the channel row in the sidebar
          (see VoiceChannel.tsx -> handleJoinVoiceChannel), which both
          selects and connects. The placeholder only appears in edge
          cases (a failed connect that left the channel selected, or a
          manual disconnect without switching channels).
        */}
        {selectedChannel?.channel_type === 'voice' ? (
          // No outer overflow here -- VoiceCallUI now manages its own
          // internal scroller for the participant grid, so the wrapper
          // just provides bounded height via flex-1 / min-h-0.
          <div className="flex-1 min-h-0">
            {currentVoiceChannel?.channelId === selectedChannel?.channel_id && voiceSessionActions ? (
              <VoiceCallUI
                channelName={selectedChannel.channel_name}
                session={voiceSessionActions}
                currentUserId={currentUser?.user_id}
                currentUsername={currentUser?.username ?? undefined}
                // Resolve each participant's avatar through the already-
                // hydrated users cache. The voice transport doesn't carry
                // avatar URLs on the wire (the SFU only knows user_id +
                // username + speaking/mute flags), so DashboardPage --
                // which owns the users list -- supplies the lookup.
                //
                // Resolution order:
                //   1. Local users cache (`usersById`) -- covers remote
                //      participants we've already loaded for this server.
                //   2. `currentUser` -- covers self, since the users list
                //      response may or may not include the requester.
                //   3. Identicon fallback derived from username or
                //      user_id -- covers freshly-joined federated peers
                //      we haven't fetched a profile for yet.
                resolveAvatarUrl={resolveVoiceParticipantAvatar}
                // Banner resolver mirrors the avatar one: look up the user
                // in the cache, return their banner image if they've
                // uploaded one. If they haven't, return undefined and
                // VoiceCallUI's ParticipantCard falls back to a hash-
                // derived solid color so each tile still looks distinct.
                // (We don't surface accent_color here because it's not
                // on the lightweight User model used by the users list;
                // the per-tile color fallback handles that case fine.)
                // Left-click on a participant tile opens the user's profile
                // card -- same flow as clicking a name in the members list
                // or in the message stream. 'messages' as the tooltip source
                // gives the card a centered anchor (above/below the tile),
                // which matches how it looks when clicking a message author.
                onParticipantClick={(userId, username, event) =>
                  handleUserClick(userId, username, event, 'messages')
                }
                resolveBanner={(userId) => {
                  // `currentUser` (from useCurrentUserProfile) and User-list
                  // entries (from `usersById`) have different TS shapes --
                  // the intersection in the union drops `banner_url`. So
                  // we look up generically and cast to read the optional
                  // field. At runtime both shapes carry banner_url when
                  // the user has set one; missing on either side just
                  // falls through to the hash-color fallback.
                  const found =
                    usersById.get(userId) ??
                    (userId === currentUser?.user_id ? currentUser : undefined);
                  const bannerUrl = (found as { banner_url?: string | null } | undefined)
                    ?.banner_url;
                  if (bannerUrl) {
                    const url = createFullUrl(bannerUrl);
                    if (url) return { kind: 'image', url };
                  }
                  return undefined;
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <div className="text-center text-[var(--color-text-secondary)]">
                  <div className="text-base font-medium text-[var(--color-text)]">
                    Voice channel · #{selectedChannel.channel_name}
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)] mt-2">
                    Click this channel in the sidebar to join the call.
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
        <>
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
                    avatar: resolveSenderAvatarUrl(foundUser, foundUser.avatar_url, foundUser.username),
                    banner: undefined,
                    accentColor: foundUser.is_owner ? 'var(--color-info)' : foundUser.is_admin ? 'var(--color-error)' : 'var(--color-primary)',
                    bannerColor: foundUser.is_owner ? 'var(--color-info)' : foundUser.is_admin ? 'var(--color-error)' : 'var(--color-primary)',
                    // Was: customStatus = first role name. Same
                    // duplication issue as above — the role badge in
                    // the profile card already renders this, so the
                    // pill restated it. Leave blank until a real
                    // custom-status API field exists.
                    customStatus: undefined,
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
                    bio: undefined,
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
                    avatar: resolveSenderAvatarUrl(
                      {
                        user_id: firstMessage.sender_user_id,
                        username: firstMessage.username,
                        avatar_url: firstMessage.sender_avatar_url,
                      },
                      firstMessage.sender_avatar_url,
                      firstMessage.username,
                    ),
                    banner: undefined,
                    accentColor: 'var(--color-accent)',
                    bannerColor: undefined,
                    // Was: customStatus = "Member". Placeholder copy
                    // that the profile card's role badge already
                    // communicates; suppressing avoids the duplicate.
                    customStatus: undefined,
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
                // `messageUser.avatar` is already a fully-resolved URL
                // (resolveSenderAvatarUrl runs above), but it can be
                // empty for messages whose sender data is incomplete —
                // in that case we still want a working <img> rather
                // than a broken one. Re-running the unified resolver
                // with whatever's on `firstMessage` gives us either a
                // hoisted absolute URL or a deterministic identicon,
                // never the bare relative path the bug was caused by.
                const displayAvatar =
                  messageUser.avatar ||
                  resolveSenderAvatarUrl(
                    {
                      user_id: firstMessage.sender_user_id,
                      username: firstMessage.username,
                      avatar_url: firstMessage.sender_avatar_url,
                    },
                    firstMessage.sender_avatar_url,
                    firstMessage.username || displayName,
                  );
                // Low-quality placeholder URL for the sender's
                // avatar. Server emits it on every message read
                // via `sender_avatar_lqip_url`; we just normalize
                // through `createFullUrl` so a relative path
                // resolves to the active instance origin. Null
                // means no placeholder available — ProgressiveImage
                // falls back to a circular skeleton.
                const displayAvatarLqip =
                  createFullUrl(firstMessage.sender_avatar_lqip_url ?? undefined) ?? null;

              // Parse the FIRST message's reply context once per
              // group so the strip can render ABOVE the avatar +
              // username row (matches the user's request, and is
              // the standard Discord-style placement). Continuation
              // messages handle their own (rare) reply context
              // inline below. We compute parent + avatar URL up
              // here so the JSX downstream stays focused on layout.
              const firstReplyParsed = parseReplyContext(firstMessage.message);
              const firstReplyParent = firstReplyParsed
                ? findReplyParent(
                    messages,
                    firstReplyParsed.author,
                    firstReplyParsed.excerpt,
                    (id) => usersById.get(id)?.username,
                  )
                : null;
              const firstReplyAvatar = firstReplyParsed
                ? buildReplyParentAvatarUrl(firstReplyParent, usersById, firstReplyParsed.author)
                : null;
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
                  {/* Reply context strip — sits ABOVE the avatar +
                      username row so the visual flow matches what
                      a reader expects: first "this message replies
                      to ...", then the speaker's avatar / name, then
                      the body. The strip is left-indented to line
                      up with the message column (not the avatar
                      gutter), which is also Discord's convention
                      and keeps the avatar visually anchored to its
                      own message. */}
                  {firstReplyParsed && firstReplyAvatar !== null && (
                    <div className="px-2 pl-[3.5rem]">
                      <MessageReplyContext
                        author={firstReplyParsed.author}
                        excerpt={firstReplyParsed.excerpt}
                        parent={firstReplyParent}
                        parentAvatar={firstReplyAvatar}
                        onJump={scrollToMessage}
                      />
                    </div>
                  )}
                  <div
                    id={`msg-${firstMessage.message_id}`}
                    // Hover background removed -- the row no longer lights
                    // up just because the cursor passes over it. Discord-
                    // style hover-revealed actions still work via the
                    // `group` class and the per-message timestamp below.
                    // Own-message tint is also dropped (separate change).
                    //
                    // The `id="msg-..."` anchor is the scroll target for
                    // search-result clicks and other deep-link flows (see
                    // scrollToMessage above). When highlighted, the row
                    // gets a primary-color ring + tinted background that
                    // fades in/out via the transition; auto-clears after
                    // ~1.6s via a setTimeout in scrollToMessage.
                    className={`group relative flex items-start space-x-3 px-2 py-1 rounded transition-colors duration-500 ${
                      highlightedMessageId === firstMessage.message_id
                        ? "bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/40"
                        : ""
                    }`}
                    onMouseEnter={() => setHoveredMessageId(firstMessage.message_id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    onContextMenu={(e) => handleMessageGroupContextMenu(groupMessageIds, e)}
                  >
                    {/* Avatar — ProgressiveImage paints a circular
                        skeleton (or the LQIP-blur preview) before
                        the full avatar finishes downloading, then
                        crossfades. Wrapped in a button-y div so
                        the existing click + context-menu handlers
                        keep working without bubbling through the
                        component's internal img layer. */}
                    <div
                      className="w-10 h-10 rounded-full flex-shrink-0 relative cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => handleUserClick(firstMessage.sender_user_id, displayName, e, 'messages')}
                      onContextMenu={(e) => openUserContextMenu(firstMessage.sender_user_id, displayName, e, 'messages')}
                      role="button"
                      tabIndex={0}
                      aria-label={`${displayName}'s avatar`}
                    >
                      <ProgressiveImage
                        src={displayAvatar}
                        placeholderSrc={displayAvatarLqip}
                        alt={displayName}
                        wrapperClassName="w-full h-full rounded-full"
                        className="rounded-full"
                        fallback={
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-sm font-semibold text-[var(--color-text)]">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        }
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
                          <span className="pb-status-info border text-xs px-1.5 py-0.5 rounded font-medium">Server Owner</span>
                        ) : firstMessage.sender_roles?.includes("admin") || firstMessage.sender_roles?.includes("Admin") ? (
                          <span className="pb-status-danger border text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                        ) : firstMessage.sender_roles?.includes("moderator") || firstMessage.sender_roles?.includes("Moderator") ? (
                          <span className="pb-status-info border text-xs px-1.5 py-0.5 rounded font-medium">MOD</span>
                        ) : null}
                        <span className="text-[var(--color-text-secondary)] text-xs select-text">{messageTimestamp}</span>
                      </div>
                      <div className="space-y-1">
                        {group.map((message, messageIndex) => {
                          // Per-message timestamp shown on hover. The
                          // group-leading message already has its time
                          // visible next to the username (the span
                          // above), AND its left gutter is occupied by
                          // the avatar -- showing the hover timestamp
                          // there would collide with the avatar. So we
                          // only render the hover-revealed timestamp
                          // on continuation messages (messageIndex > 0),
                          // where the gutter is empty. This matches
                          // Discord's pattern.
                          const messageTime = new Date(message.sent_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          });
                          const isContinuation = messageIndex > 0;
                          return (
                          <div key={message.message_id} className="group/msg relative min-w-0">
                            {/*
                              `min-w-0` is what lets the message column
                              reflow when the surrounding pane shrinks
                              (e.g. opening the members panel). Without
                              it a child with intrinsic width — most
                              commonly a video iframe at its native
                              1280px — drives the flex column up to
                              its own content width, the message
                              column stops shrinking, and the iframe
                              looks "stuck stretched" while the panel
                              animates in.
                            */}
                            {isContinuation && (
                              <span
                                className="pointer-events-none absolute -left-[3.25rem] top-0.5 text-[10px] tabular-nums text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover/msg:opacity-100"
                                aria-hidden="true"
                              >
                                {messageTime}
                              </span>
                            )}
                            {(() => {
                              // Replies are encoded over the wire as a
                              // markdown blockquote header (`> Replying
                              // to @X\n> <excerpt>`) followed by the
                              // reply body — there's no typed
                              // reply-edge on the server. Detect that
                              // pattern at render time and:
                              //
                              //   - For the FIRST message in the group
                              //     the reply context strip was
                              //     already rendered ABOVE the row
                              //     (see above). Here we just strip
                              //     the header out of the body so
                              //     the blockquote doesn't render
                              //     twice (once as the strip, once
                              //     as raw markdown).
                              //
                              //   - For continuation messages the
                              //     strip renders inline above the
                              //     body — same logic the original
                              //     site used.
                              const parsed = parseReplyContext(message.message);
                              if (!parsed) {
                                return (
                                  <>
                                    <MarkdownRenderer content={message.message} className="text-[var(--color-text)]" />
                                    <MessageEmbeds content={message.message} />
                                  </>
                                );
                              }
                              if (!isContinuation) {
                                return (
                                  <>
                                    <MarkdownRenderer content={parsed.body} className="text-[var(--color-text)]" />
                                    <MessageEmbeds content={parsed.body} />
                                  </>
                                );
                              }
                              const parent = findReplyParent(
                                messages,
                                parsed.author,
                                parsed.excerpt,
                                (id) => usersById.get(id)?.username,
                              );
                              const parentAvatar = buildReplyParentAvatarUrl(
                                parent,
                                usersById,
                                parsed.author,
                              );
                              return (
                                <>
                                  <MessageReplyContext
                                    author={parsed.author}
                                    excerpt={parsed.excerpt}
                                    parent={parent}
                                    parentAvatar={parentAvatar}
                                    onJump={scrollToMessage}
                                  />
                                  <MarkdownRenderer content={parsed.body} className="text-[var(--color-text)]" />
                                  <MessageEmbeds content={parsed.body} />
                                </>
                              );
                            })()}

                            {/* Render attachments with Discord-style bubble layout */}
                            {message.attachments && message.attachments.length > 0 && (
                              <AttachmentGrid attachments={message.attachments} />
                            )}

                            {/* Reaction pills — clicking a pill toggles the
                                viewer's reaction. The trailing "+" button is
                                a discoverable add-another-reaction
                                affordance that avoids forcing the user back
                                up to the hover action cluster (which only
                                appears while the pointer is over the
                                message). Hidden when the row is empty —
                                first-time reactions go through the hover
                                cluster's smiley button. */}
                            {message.reactions && message.reactions.length > 0 && (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                {message.reactions.map((reaction) => (
                                  <button
                                    key={reaction.emoji}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void applyReactionToMessage(message.message_id, reaction.emoji);
                                    }}
                                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                      reaction.viewer_reacted
                                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                                        : "border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
                                    }`}
                                    aria-label={`${reaction.emoji} reaction, ${reaction.count} ${reaction.count === 1 ? "person" : "people"}${reaction.viewer_reacted ? ", you reacted" : ""}`}
                                  >
                                    <span>{reaction.emoji}</span>
                                    <span className="tabular-nums">{reaction.count}</span>
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMessageReact(message.message_id);
                                  }}
                                  className="flex h-[22px] items-center gap-1 rounded-full border border-dashed border-[var(--color-border)] bg-transparent px-2 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-primary)]"
                                  title="Add another reaction"
                                  aria-label="Add another reaction"
                                >
                                  <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                      {/* Hover action cluster — a small floating
                          card with three buttons (react / reply /
                          more). Replaces the previous single
                          three-dot button so the two most-common
                          message actions (adding a reaction,
                          replying) are one click away instead of
                          two. The cluster sits flush to the top-
                          right of the message group, slightly
                          overhanging the row — Discord's
                          convention — so it never pushes the
                          message text down and doesn't take any
                          vertical space when no message is
                          hovered. */}
                      <div
                        className={`absolute -top-3 right-2 flex items-center gap-0.5 rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-0.5 py-0.5 shadow-[var(--shadow-popover)] opacity-0 group-hover:opacity-100 transition-opacity ${
                          hoveredMessageId === firstMessage.message_id ? "opacity-100" : ""
                        }`}
                      >
                        {/* Add reaction. Opens the emoji picker
                            aimed at this message; the picker's
                            onSelect path will toggle the chosen
                            emoji via applyReactionToMessage. */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMessageReact(firstMessage.message_id);
                          }}
                          className="pb-icon-btn h-7 w-7 border-0 hover:bg-[var(--color-hover)]"
                          title="Add reaction"
                          aria-label="Add reaction"
                        >
                          <svg
                            className="pb-icon"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="9" />
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                            <line x1="9" y1="9" x2="9.01" y2="9" />
                            <line x1="15" y1="9" x2="15.01" y2="9" />
                            {/* Plus mark in the corner cueing
                                'add' rather than just react */}
                            <path d="M19 5v4M17 7h4" />
                          </svg>
                        </button>

                        {/* Reply. Sets the reply target and focuses
                            the composer; the slim reply pill above
                            the composer renders the target. */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMessageReply(firstMessage.message_id);
                          }}
                          className="pb-icon-btn h-7 w-7 border-0 hover:bg-[var(--color-hover)]"
                          title="Reply"
                          aria-label="Reply"
                        >
                          <svg
                            className="pb-icon -scale-x-100"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <polyline points="9 14 4 9 9 4" />
                            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                          </svg>
                        </button>

                        {/* More — the existing context menu. */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentMenuMessageId(firstMessage.message_id);
                            setMessageContextMenu({
                              isOpen: true,
                              position: { x: e.clientX, y: e.clientY },
                              onCopyLink: () => handleMessageCopy(firstMessage.message_id),
                              onReport: () => handleMessageReport(firstMessage.message_id),
                            });
                          }}
                          className="pb-icon-btn h-7 w-7 border-0 hover:bg-[var(--color-hover)]"
                          title="More options"
                          aria-label="Message options"
                        >
                          <svg
                            className="pb-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6h.01M12 12h.01M12 18h.01"
                            />
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
          {/* Reply target — slim inline pill attached to the top edge of
              the composer. Previous version was a separate card with a
              bold uppercase "Replying to NAME" header and a two-line
              preview — visually bulky for what's effectively a
              two-token signal (whom + what). The pill compresses both
              onto one line, uses a reply-arrow glyph to communicate
              the relationship without dedicated copy, and shares the
              composer's bottom rounding so the two elements read as a
              connected unit instead of stacked cards. */}
          {replyTarget && (() => {
            const replyToUsername =
              replyTarget.username
              || usersById.get(replyTarget.sender_user_id)?.username
              || 'Unknown User';
            // Preview is intentionally CAPPED at ~120 chars before
            // rendering even though the row also has CSS truncate
            // — the CSS clip handles "visually too long for this
            // pixel width", and the char cap handles "the source
            // message is huge and we shouldn't even put all of it
            // in the DOM". Strips newlines so the single-line
            // preview doesn't accidentally render with a height
            // bump.
            // If the target is itself a reply, strip its embedded
            // reply header before previewing — we want to show what
            // the user actually SAID, not the chain of who they
            // were replying to.
            const parsedTarget = parseReplyContext(replyTarget.message || '');
            const visibleTargetText = parsedTarget ? parsedTarget.body : (replyTarget.message || '');
            const rawText = visibleTargetText.replace(/\s+/g, ' ').trim();
            const PREVIEW_CHAR_CAP = 120;
            const previewText = rawText
              ? rawText.length > PREVIEW_CHAR_CAP
                ? `${rawText.slice(0, PREVIEW_CHAR_CAP).trimEnd()}…`
                : rawText
              : 'Attachment-only message';
            // Try the live users-list entry first. Fall back to the
            // message's own `sender_avatar_url` (server-attached on
            // the message payload), then to a deterministic
            // identicon seeded from the username. Goes through the
            // shared `resolveSenderAvatarUrl` helper so the reply
            // pill, message list row, and search results all
            // resolve to the EXACT same image for a given sender —
            // crucially including the `createFullUrl` hop that turns
            // relative upload paths like `/files/avatars/abc.png`
            // into fully-qualified URLs the <img> can actually
            // load. (The previous version called `resolveAvatarUrl`
            // directly, but the users-list shape lacks
            // `avatar_kind`, so that helper always fell through to
            // the identicon branch even for users with real
            // uploads.)
            const replyUser = usersById.get(replyTarget.sender_user_id);
            const replyAvatarUrl = resolveSenderAvatarUrl(
              replyUser ?? {
                user_id: replyTarget.sender_user_id,
                username: replyToUsername,
                avatar_url: replyTarget.sender_avatar_url ?? undefined,
              },
              replyTarget.sender_avatar_url ?? undefined,
              replyToUsername,
            );
            return (
              <div
                // Whole pill is clickable except for the close
                // button. Clicking scrolls the message list to the
                // target message and applies the ~1.6s highlight
                // ring via the existing scrollToMessage helper.
                // role=button + Enter / Space keyboard support so
                // the affordance is reachable without a pointer.
                role="button"
                tabIndex={0}
                onClick={() => scrollToMessage(replyTarget.message_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    scrollToMessage(replyTarget.message_id);
                  }
                }}
                title="Jump to message"
                className="group flex cursor-pointer items-center gap-2 rounded-t-xl border border-b-0 border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-1.5 transition-colors hover:bg-[var(--color-hover)]"
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0 -scale-x-100 text-[var(--color-text-muted)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <polyline points="9 14 4 9 9 4" />
                  <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                </svg>
                {/* Avatar of the user being replied to. Sized to
                    match the row's font weight visually — smaller
                    than a normal message avatar (~h-9) since the
                    row is tight, but big enough to read the
                    identicon's accent color. */}
                <img
                  src={replyAvatarUrl}
                  alt=""
                  className="h-5 w-5 shrink-0 rounded-full object-cover"
                />
                <span className="text-xs font-semibold text-[var(--color-text)] truncate max-w-[10rem]">
                  {replyToUsername}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] truncate min-w-0 flex-1">
                  {previewText}
                </span>
                <button
                  // Stop propagation so cancel doesn't also fire
                  // the parent's scroll-to-message click.
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplyTarget(null);
                  }}
                  className="shrink-0 rounded-full p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-error)]/15 hover:text-[var(--color-error)]"
                  title="Cancel reply"
                  aria-label="Cancel reply"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            );
          })()}

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

              {/* Clear-all attachments. Sized like a staged tile and
                  rendered with a muted error tone so it sits visually
                  alongside the previews instead of looking like an
                  alert slab. */}
              {messageAttachments.length > 1 && (
                <button
                  onClick={() => setMessageAttachments([])}
                  className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--color-error)]/40 bg-[var(--color-error)]/8 px-4 text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/14 min-w-[7rem]"
                  title="Remove all staged attachments"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="text-xs font-medium">Clear all</span>
                </button>
              )}
            </div>
          )}

            <div
              ref={messageInputBarRef}
              // Hover effect intentionally removed -- the bar shouldn't
              // light up just because the cursor passes over it. Focus
              // is what indicates "I'm typing here," not hover.
              className={`relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-6 py-4 ${
                !selectedChannel ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <div className="flex items-end space-x-3">
              {/* Four hidden inputs -- one per upload category. Each
                  one has an `accept` scoped to the server-allowed types
                  for that category, so the OS file picker only shows
                  matching files. They all funnel through the same
                  `handleFileUpload` handler downstream, so the upload
                  pipeline doesn't change. The unscoped `fileInputRef`
                  is the catch-all "File" entry. */}
              <input
                ref={imageInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={!selectedChannel || isSendingMessage}
                className="hidden"
                accept={
                  uploadPolicy.imageExtensions.length > 0
                    ? uploadPolicy.imageExtensions.map((e) => `.${e}`).join(",")
                    : "image/*"
                }
              />
              <input
                ref={videoInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={!selectedChannel || isSendingMessage}
                className="hidden"
                accept={
                  uploadPolicy.videoExtensions.length > 0
                    ? uploadPolicy.videoExtensions.map((e) => `.${e}`).join(",")
                    : "video/*"
                }
              />
              <input
                ref={audioInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={!selectedChannel || isSendingMessage}
                className="hidden"
                accept={
                  uploadPolicy.audioExtensions.length > 0
                    ? uploadPolicy.audioExtensions.map((e) => `.${e}`).join(",")
                    : "audio/*"
                }
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={!selectedChannel || isSendingMessage}
                className="hidden"
                accept={uploadPolicy.acceptAttribute}
              />

              {/* "+" button + categorized upload menu. Click toggles a
                  small popover anchored above the button (the composer
                  is at the bottom of the chat area) with four entries.
                  Each entry triggers its scoped <input>'s click which
                  opens the OS picker pre-filtered to that type. */}
              <div className="relative" ref={uploadPickerRef}>
                <button
                  onClick={() => setUploadPickerOpen((prev) => !prev)}
                  className="pb-icon-btn flex-shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                  disabled={!selectedChannel || isSendingMessage}
                  title="Upload an attachment"
                  aria-label="Upload an attachment"
                  aria-haspopup="menu"
                  aria-expanded={uploadPickerOpen}
                >
                  <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                {uploadPickerOpen && (
                  <div
                    role="menu"
                    aria-label="Upload type"
                    className="absolute bottom-full left-0 z-20 mb-2 w-52 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
                  >
                    {[
                      {
                        id: "image",
                        label: "Image",
                        sub: "PNG, JPG, GIF…",
                        iconPath:
                          "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
                        ref: imageInputRef,
                      },
                      {
                        id: "video",
                        label: "Video",
                        sub: "MP4, WebM, MOV…",
                        iconPath:
                          "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
                        ref: videoInputRef,
                      },
                      {
                        id: "audio",
                        label: "Audio",
                        sub: "MP3, WAV, FLAC…",
                        iconPath:
                          "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z",
                        ref: audioInputRef,
                      },
                      {
                        id: "file",
                        label: "File",
                        sub: "Anything else",
                        iconPath:
                          "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                        ref: fileInputRef,
                      },
                    ].map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUploadPickerOpen(false);
                          entry.ref.current?.click();
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                      >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={entry.iconPath} />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{entry.label}</span>
                          <span className="block truncate text-xs text-[var(--color-text-muted)]">
                            {entry.sub}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Message Input */}
                <div className="relative flex-1 min-h-0">
                  {/* Emoji alias autocomplete popover. Positions itself
                      above the textarea (bottom-full). Mouse-clickable
                      items + keyboard nav via the onKeyDown handler
                      below (Tab/Enter to confirm, ↑↓ to select, Esc to
                      dismiss). */}
                  {emojiSuggest && emojiSuggest.matches.length > 0 && (
                    <div className="absolute bottom-full left-0 z-30 mb-2 w-72 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
                      <div className="border-b border-[var(--color-border)] px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                        Emoji · :{emojiSuggest.query || "…"}
                      </div>
                      <div className="max-h-64 overflow-y-auto py-1">
                        {emojiSuggest.matches.map((m, idx) => (
                          <button
                            key={m.alias}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              applyEmojiSuggestion(m.emoji);
                            }}
                            onMouseEnter={() =>
                              setEmojiSuggest((prev) =>
                                prev ? { ...prev, selectedIdx: idx } : prev,
                              )
                            }
                            className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors ${
                              idx === emojiSuggest.selectedIdx
                                ? "bg-[var(--color-active)]"
                                : "hover:bg-[var(--color-hover)]"
                            }`}
                          >
                            <span className="text-base leading-none">{m.emoji}</span>
                            <span className="truncate font-mono text-xs text-[var(--color-text-secondary)]">
                              :{m.alias}:
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <textarea
                    ref={messageInputRef}
                    value={messageInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      // setMessageInput is the urgent update: the
                      // textarea's controlled value must reflect the
                      // keystroke immediately or the cursor jumps.
                      setMessageInput(value);
                      // The autocomplete state is non-urgent. React 19
                      // can defer this update and preempt it if the
                      // user types more keys before the popover finishes
                      // computing. This keeps the textarea responsive
                      // even when the alias list is large.
                      const caret = e.target.selectionStart ?? value.length;
                      const token = detectEmojiToken(value, caret);
                      startEmojiSuggestTransition(() => {
                        if (!token) {
                          setEmojiSuggest(null);
                          return;
                        }
                        const matches = matchEmojiAliases(token.query);
                        if (matches.length === 0) {
                          setEmojiSuggest(null);
                          return;
                        }
                        setEmojiSuggest({
                          query: token.query,
                          matches,
                          selectedIdx: 0,
                          tokenStart: token.tokenStart,
                          tokenEnd: token.tokenEnd,
                        });
                      });
                    }}
                    onBlur={flushPendingDraftPersistence}
                    onKeyDown={(e) => {
                      // Emoji autocomplete keyboard nav takes priority
                      // when its popover is open; fall through to the
                      // normal send/newline handler otherwise.
                      if (emojiSuggest && emojiSuggest.matches.length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setEmojiSuggest((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  selectedIdx: Math.min(prev.selectedIdx + 1, prev.matches.length - 1),
                                }
                              : prev,
                          );
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setEmojiSuggest((prev) =>
                            prev
                              ? { ...prev, selectedIdx: Math.max(prev.selectedIdx - 1, 0) }
                              : prev,
                          );
                          return;
                        }
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          applyEmojiSuggestion(emojiSuggest.matches[emojiSuggest.selectedIdx].emoji);
                          return;
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEmojiSuggest(null);
                          return;
                        }
                      }
                      handleKeyPress(e);
                    }}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                    // Spinning ring loader — replaces the previous
                    // "Sending..." text. Same visual footprint as
                    // the send icon so the button doesn't resize
                    // mid-action; `animate-spin` rotates the ring
                    // continuously, the gap (`border-t-transparent`)
                    // is what produces the spinning appearance.
                    // `currentColor` so it stays in the on-primary
                    // palette without an extra inline color rule.
                    <span
                      role="status"
                      aria-label="Sending"
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    />
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
                    {/* Uses the deferred value -- the counter doesn't
                        need to track every keystroke synchronously,
                        and reading the live value pulls this whole
                        block back onto the urgent render path. */}
                    {deferredMessageInput.trim().length}
                    {uploadPolicy.maxMessageLength ? `/${uploadPolicy.maxMessageLength}` : ''}
                  </span>
                )}
              </div>
            </div>



          {/* Emoji Picker */}
          <EmojiPicker
            isOpen={isEmojiPickerOpen}
            onClose={() => {
              setIsEmojiPickerOpen(false);
              // If the user dismissed the picker without choosing an emoji we
              // must drop the reaction intent, otherwise the next message-input
              // emoji selection would accidentally fire a reaction.
              setReactionTargetMessageId(null);
            }}
            onEmojiSelect={handleEmojiSelect}
            onGifSelect={handleGifSelect}
          />
        </div>
        </>
        )}

      </MessagePane>

      {/* Member List */}
      <MembersPanel isVisible={membersListVisible}>
        <MembersList
          users={users}
          usersError={usersError}
          onClose={() => setMembersListVisible(false)}
          onUserClick={handleUserClick}
          onUserContextMenu={openUserContextMenu}
        />
      </MembersPanel>



      {/* Modals */}
      <DashboardOverlays>
      <ChannelCreationModal
        isOpen={channelCreationModalOpen}
        onClose={() => setChannelCreationModalOpen(false)}
        onCreateChannel={handleCreateChannel}
      />

      <JoinServerModal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onJoined={(server) => {
          // For v1.0 we don't keep a local rail-side cache of
          // joined server metadata — the rail still only renders
          // serverInfo (the home instance). A toast tells the user
          // the join landed; subsequent connect-to-joined-server
          // affordances arrive when the rail starts rendering more
          // than one slot.
          showToast({
            message: `Joined ${server.server_name}.`,
            tone: "success",
            category: "system",
          });
        }}
      />

      {/* SearchModal used to be mounted globally here as a centered
          modal. It now lives inside ChatHeader as a floating dropdown
          anchored to the magnifier icon, so nothing renders here. */}

      {/* Capability flags are derived per-message at render time. The
          right-click target lives in `currentMenuMessageId` and we
          resolve it through `getMessageById` to read sender_user_id /
          channel_id; missing sender => default to "viewer is not self"
          which hides Edit + restores Report rows. Privileges come from
          the dashboard-wide `canDeleteMessages` / `canBanUsers` /
          `canTimeoutUsers` flags computed earlier from the user's
          resolved instance privileges. */}
      {(() => {
        const ctxMessage = currentMenuMessageId ? getMessageById(currentMenuMessageId) : null;
        const senderId = ctxMessage?.sender_user_id ?? null;
        const senderUsername = ctxMessage?.username ?? usersById.get(senderId ?? '')?.username;
        const isOwnMessage = !!senderId && senderId === currentUser?.user_id;

        return (
          <MessageContextMenu
            isOpen={messageContextMenu.isOpen}
            position={messageContextMenu.position}
            onClose={() => setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 } })}
            isSelf={isOwnMessage}
            canEdit={isOwnMessage}
            canDelete={isOwnMessage || canDeleteMessages}
            canBan={canBanUsers}
            canTimeout={canTimeoutUsers}
            onAddReaction={() => {
              // Open emoji picker aimed at the message under the context
              // menu. The picker shares the same component with the
              // message-input flow, so we mark the intent here via
              // `reactionTargetMessageId`.
              const rect = {
                left: messageContextMenu.position.x,
                top: messageContextMenu.position.y,
                right: messageContextMenu.position.x,
                bottom: messageContextMenu.position.y,
              };
              const pickerWidth = 320;
              const pickerHeight = 400;
              const gap = 8;

              let x = rect.right + gap;
              let y = rect.top;
              if (x + pickerWidth > window.innerWidth) {
                x = rect.left - pickerWidth - gap;
              }
              if (y + pickerHeight > window.innerHeight) {
                y = window.innerHeight - pickerHeight - gap;
              }
              if (y < gap) {
                y = gap;
              }

              if (currentMenuMessageId) {
                setReactionTargetMessageId(currentMenuMessageId);
              }
              setIsEmojiPickerOpen(true);
              setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
            }}
            onReply={() => handleMessageReply(currentMenuMessageId)}
            // Reply-in-DM intentionally not wired: DMs aren't a
            // first-class surface in this client yet, and the menu
            // policy is "every shown option must work". Omitting the
            // handler hides the row entirely; the option will come
            // back the moment the DM composer ships.
            // Media-bearing messages swap Copy Message for Download.
            // Text-only messages keep Copy Message. The menu enforces
            // mutual exclusion: passing both would short-circuit
            // and only render Download.
            onCopyMessage={
              messageHasDownloadableMedia(currentMenuMessageId)
                ? undefined
                : () => handleMessageCopyText(currentMenuMessageId)
            }
            onDownload={
              messageHasDownloadableMedia(currentMenuMessageId)
                ? () => void handleMessageDownload(currentMenuMessageId)
                : undefined
            }
            // Per-invocation override (e.g. the message-group menu sets
            // a multi-ID copy handler + plural label). Fall back to the
            // single-message handler when no override is supplied.
            onCopyMessageId={
              messageContextMenu.onCopyLink ?? (() => handleMessageCopy(currentMenuMessageId))
            }
            copyMessageIdLabel={messageContextMenu.customCopyLinkLabel}
            // Edit Message is also intentionally unwired right now —
            // the server hasn't shipped a message-edit endpoint yet
            // (`updateMessage` in services/message.ts is a stub). The
            // option will come back when the API lands. Same policy
            // as Reply-in-DM above: don't surface non-working options.
            onEdit={undefined}
            onDelete={() => void handleMessageDelete(currentMenuMessageId)}
            onReportMessage={
              messageContextMenu.onReport ?? (() => handleMessageReport(currentMenuMessageId))
            }
            reportMessageLabel={messageContextMenu.customReportLabel}
            onReportUser={() => {
              if (senderId) {
                handleUserReport(senderId, senderUsername);
              }
              setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
            }}
            onTimeoutUser={() => {
              if (senderId) {
                handleUserTimeout(senderId, senderUsername || "user");
              }
              setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
            }}
            onBanUser={() => {
              if (senderId) {
                handleUserBan(senderId, senderUsername || "user");
              }
              setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
            }}
          />
        );
      })()}

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

      {/* Channel right-click menu. "Mark As Read" is always available
          (every user can clear their own unread state); "Delete Channel"
          only renders for viewers with `delete_channels`. The list is
          built inline because items append/skip based on per-channel
          context, not just static privileges. */}
      <ContextMenu
        isOpen={channelContextMenu.isOpen && !!channelContextMenu.channel}
        position={channelContextMenu.position}
        onClose={() => setChannelContextMenu({ isOpen: false, position: { x: 0, y: 0 }, channel: null })}
        items={(() => {
          const items: Array<
            | { id: string; label: string; icon?: React.ReactNode; tone?: "default" | "danger" | "warning" | "success"; onSelect: () => void }
            | { id: string; separator: true }
          > = [];
          const ctxChannel = channelContextMenu.channel;
          if (!ctxChannel) return items;
          items.push({
            id: "mark-read",
            label: "Mark As Read",
            icon: (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ),
            onSelect: () => {
              handleMarkChannelRead(ctxChannel.channel_id);
              setChannelContextMenu({ isOpen: false, position: { x: 0, y: 0 }, channel: null });
            },
          });
          // Edit Channel — gated by edit_channels. Mirrors the
          // control-panel Channels tab edit flow; channel_type stays
          // immutable on this surface for the same reason (flipping
          // text<->voice would orphan messages or participant rows).
          if (canEditChannels) {
            items.push({ id: "sep-edit", separator: true });
            items.push({
              id: "edit-channel",
              label: "Edit Channel",
              icon: (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              ),
              onSelect: () => {
                setEditingChannel(ctxChannel);
                setChannelContextMenu({ isOpen: false, position: { x: 0, y: 0 }, channel: null });
              },
            });
          }
          if (canDeleteChannels) {
            items.push({ id: "sep-delete", separator: true });
            items.push({
              id: "delete-channel",
              label: "Delete Channel",
              tone: "danger",
              icon: (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {/* Full trash-can glyph, matching the icon used by
                      every other "Delete X" action in the app
                      (message delete, file attachment delete, storage
                      tab delete, server-options dropdown delete).
                      The previous path only had the body arc, which
                      rendered as a U-shape without a lid or contents. */}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              ),
              onSelect: () => {
                setChannelDeleteConfirm({ isOpen: true, channel: ctxChannel });
                setChannelContextMenu({ isOpen: false, position: { x: 0, y: 0 }, channel: null });
              },
            });
          }
          return items;
        })()}
      />

      <ModerationActionModal
        action={
          moderationAction
            ? { kind: moderationAction.kind, username: moderationAction.username }
            : null
        }
        isSubmitting={moderationSubmitting}
        onSubmit={handleModerationSubmit}
        onCancel={() => {
          if (moderationSubmitting) return;
          setModerationAction(null);
        }}
      />

      {/* Edit-channel modal, opened from the channel sidebar's
          right-click menu. Same UX rules as the control-panel
          version: channel_type stays a read-only badge because
          flipping text<->voice would orphan messages or participant
          rows. */}
      <Modal
        isOpen={Boolean(editingChannel)}
        onClose={() => {
          if (editChannelSaving) return;
          setEditingChannel(null);
        }}
        title={editingChannel ? `Edit #${editingChannel.channel_name}` : "Edit Channel"}
        widthClassName="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingChannel(null)}
              disabled={editChannelSaving}
              className="rounded-lg border border-transparent px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveChannelEdit}
              disabled={editChannelSaving}
              className="rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editChannelSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        }
      >
        {editingChannel && (
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Channel Type
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2.5">
                {editingChannel.channel_type === "voice" ? (
                  <>
                    <svg className="h-4 w-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-4-4a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="text-sm text-[var(--color-text)]">Voice channel</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    <span className="text-sm text-[var(--color-text)]">Text channel</span>
                  </>
                )}
                <span className="ml-auto rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Locked
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Switching between text and voice isn't supported — it would orphan messages or
                participant rows. To change the medium, delete and recreate the channel.
              </p>
            </div>

            <div>
              <label
                htmlFor="dashboard-edit-channel-name"
                className="mb-1 block text-sm font-medium text-[var(--color-text)]"
              >
                Channel Name
              </label>
              <input
                id="dashboard-edit-channel-name"
                type="text"
                value={editChannelForm.channel_name}
                onChange={(e) =>
                  setEditChannelForm((prev) => ({ ...prev, channel_name: e.target.value }))
                }
                disabled={editChannelSaving}
                className="w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-4 py-2.5 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors focus:border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                placeholder="channel-name"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-4 py-3">
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">Private channel</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Only the server owner, admins, and invited users can see private channels.
                </div>
              </div>
              <label className="flex cursor-pointer items-center">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={editChannelForm.is_private}
                    onChange={(e) =>
                      setEditChannelForm((prev) => ({ ...prev, is_private: e.target.checked }))
                    }
                    disabled={editChannelSaving}
                  />
                  <div
                    className={`h-6 w-11 rounded-full transition-colors ${
                      editChannelForm.is_private
                        ? "bg-[var(--color-primary)]"
                        : "bg-[var(--color-surface-tertiary)]"
                    }`}
                  />
                  <div
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      editChannelForm.is_private ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </label>
            </div>
          </div>
        )}
      </Modal>

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
            activity={userCardTooltipUser.activity}
            mutualServers={userCardTooltipUser.mutualServers}
            mutualFriends={userCardTooltipUser.mutualFriends}
            badges={userCardTooltipUser.badges || []}
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
      </DashboardOverlays>
    </div>
  );
}
