import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Channel, Message } from "../../models";
import { getAuthTokenFromCookies, getHostPortFromCookies, getHostPortFromStorage, updateUserStatus } from "../../services/user";
import { getMessageReadHistory, markMessageAsRead } from "../../services/message";
import { type NotificationItem } from "../NotificationMenu";
import { usePersistedUIState } from "../../utils/uiStatePersistence";
import { type ListUsersResponse } from "../../services/user";
import type { GlobalWebSocket } from "../../services/websocket";
import { buildAuthRedirectPath } from "../../utils/authRedirect";
import { parseReplyContext } from "../../utils/replyContext";
import type { ShowToast } from "../Toast";
import type { ServerInfo } from "../../services/system";
import type { DisplayUser } from "./types";
import { groupMessagesByAuthor } from "./types";

type UseDashboardDataOptions = {
  currentUser: any;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  location: { pathname: string; search: string; hash: string };
  showToast: ShowToast;
};

// "Manual" presence states are the ones a user can intentionally
// announce in the picker. They lock the value against the activity
// loop — once locked, the loop won't auto-flip the user to online or
// idle on input. `offline` used to be in this list, but it's now
// strictly system-determined (set on disconnect, never user-picked),
// so the lock no longer covers it.
const isManualPresenceStatus = (
  status: unknown,
): status is "dnd" | "afk" =>
  status === "dnd" || status === "afk";

export function useDashboardData({ currentUser, navigate, location, showToast }: UseDashboardDataOptions) {
  const loginRedirectPath = buildAuthRedirectPath(location.pathname, location.search, location.hash);

  useEffect(() => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) {
      navigate(loginRedirectPath, { replace: true });
    }
  }, [loginRedirectPath, navigate]);

  const {
    selectedChannelId: persistedChannelId,
    setSelectedChannel: persistSelectedChannel,
    setMessageDraft,
    getMessageDraft,
    clearMessageDraft,
  } = usePersistedUIState(currentUser?.user_id);

  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [deviceSelectorModalOpen, setDeviceSelectorModalOpen] = useState(false);
  const [userCardTooltipUser, setUserCardTooltipUser] = useState<DisplayUser | null>(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipSource, setTooltipSource] = useState<"userpanel" | "members" | "messages">("messages");
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
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
  const [userContextMenu, setUserContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });
  const [selectedContextUser, setSelectedContextUser] = useState<{
    userId: string;
    username: string;
    anchorElement: HTMLElement | null;
    source: "userpanel" | "members" | "messages";
  } | null>(null);
  const [channelContextMenu, setChannelContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    channel: Channel | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, channel: null });
  const [channelDeleteConfirm, setChannelDeleteConfirm] = useState<{
    isOpen: boolean;
    channel: Channel | null;
    isDeleting?: boolean;
  }>({ isOpen: false, channel: null, isDeleting: false });
  const [reportModal, setReportModal] = useState<{
    isOpen: boolean;
    targetType: "message" | "user";
    messages: string[];
    targetUserId?: string;
    targetUsername?: string;
  }>({ isOpen: false, targetType: "message", messages: [] });
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [serverInfoError, setServerInfoError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<ListUsersResponse["users"]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [webSocketConnection, setWebSocketConnection] = useState<GlobalWebSocket | null>(null);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());
  const [unreadCountsByChannel, setUnreadCountsByChannel] = useState<Record<string, number>>({});
  // Set of channel_ids the viewer has explicitly muted. Seeded from
  // `GET /notifications/preferences` on mount and mutated locally by
  // the mute/unmute handlers so the menu label + icon update without
  // a round-trip. Used by ChannelList to suppress the unread dot on
  // muted channels (muted = "I don't care, don't dot me") and by the
  // context menu to flip the label between "Mute Channel" /
  // "Unmute Channel."
  const [mutedChannelIds, setMutedChannelIds] = useState<Set<string>>(new Set());
  const [manualPresenceLock, setManualPresenceLock] = useState<"dnd" | "afk" | "offline" | null>(null);
  const [unreadMarker, setUnreadMarker] = useState<{ channelId: string; messageId: string } | null>(null);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
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
  const currentUserLiveStatusRef = useRef<string>("offline");
  type PresenceUpdater = (
    status: "online" | "idle" | "afk" | "dnd" | "offline",
    options?: { silent?: boolean; lockMode?: "preserve" | "set" | "clear" },
  ) => Promise<void>;
  const updatePresenceStatusRef = useRef<PresenceUpdater | null>(null);
  const previousProfileUserIdRef = useRef<string | null>(currentUser?.user_id ?? null);
  const previousProfileStatusRef = useRef<unknown>(currentUser?.status ?? null);

  const calculateTooltipPosition = useCallback(
    (anchor: HTMLElement, source: "userpanel" | "members" | "messages") => {
      const rect = anchor.getBoundingClientRect();
      const spacing = 10;
      const viewportPadding = 16;
      const tooltipWidth = popperElement?.offsetWidth ?? 352;
      const tooltipHeight = popperElement?.offsetHeight ?? 420;
      const maxLeft = window.innerWidth - tooltipWidth - viewportPadding;
      const maxTop = window.innerHeight - tooltipHeight - viewportPadding;

      if (source === "userpanel") {
        const left = Math.min(maxLeft, Math.max(viewportPadding, rect.left));
        const preferBottomTop = rect.bottom + spacing;
        const top =
          preferBottomTop + tooltipHeight <= window.innerHeight - viewportPadding
            ? preferBottomTop
            : Math.max(viewportPadding, rect.top - tooltipHeight - spacing);
        return { top, left };
      }

      const centeredLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
      const left = Math.min(maxLeft, Math.max(viewportPadding, centeredLeft));
      const preferTop = rect.top - tooltipHeight - spacing;
      const top = preferTop >= viewportPadding ? preferTop : Math.min(maxTop, rect.bottom + spacing);
      return { top, left };
    },
    [popperElement],
  );

  useEffect(() => {
    if (!isTooltipOpen || !referenceElement) {
      return;
    }

    const updatePosition = () => {
      setTooltipPosition(calculateTooltipPosition(referenceElement, tooltipSource));
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [calculateTooltipPosition, isTooltipOpen, referenceElement, tooltipSource, userCardTooltipUser]);

  const usersById = useMemo(() => {
    const map = new Map<string, ListUsersResponse["users"][number]>();
    users.forEach((user) => {
      map.set(user.user_id, user);
    });
    return map;
  }, [users]);

  const currentUserLiveStatus = useMemo(() => {
    if (!currentUser) {
      return "offline" as const;
    }

    const liveStatus = usersById.get(currentUser.user_id)?.status ?? currentUser.status;
    if (liveStatus === "online" || liveStatus === "idle" || liveStatus === "afk" || liveStatus === "dnd") {
      return liveStatus;
    }
    return "offline" as const;
  }, [currentUser, usersById]);

  useEffect(() => {
    selectedChannelIdRef.current = selectedChannel?.channel_id ?? null;
  }, [selectedChannel]);

  useEffect(() => {
    currentUserIdRef.current = currentUser?.user_id ?? null;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.user_id) {
      previousProfileUserIdRef.current = null;
      previousProfileStatusRef.current = null;
      setManualPresenceLock(null);
      return;
    }

    const userChanged = previousProfileUserIdRef.current !== currentUser.user_id;
    const statusChanged = previousProfileStatusRef.current !== currentUser.status;
    if (!userChanged && !statusChanged) {
      return;
    }

    previousProfileUserIdRef.current = currentUser.user_id;
    previousProfileStatusRef.current = currentUser.status;
    setManualPresenceLock(
      isManualPresenceStatus(currentUser.status) ? currentUser.status : null,
    );
  }, [currentUser?.status, currentUser?.user_id]);

  useEffect(() => {
    webSocketConnectionRef.current = webSocketConnection;
  }, [webSocketConnection]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserNotificationPermission("unsupported");
      return;
    }
    setBrowserNotificationPermission(Notification.permission);
  }, [notificationMenuOpen]);

  const groupedMessages = useMemo(() => groupMessagesByAuthor(messages), [messages]);

  const getMessageById = useCallback(
    (messageId: string | null) => (messageId ? messages.find((message) => message.message_id === messageId) ?? null : null),
    [messages],
  );

  const buildReplyMessage = useCallback(
    (messageBody: string, target: Message | null) => {
      if (!target) {
        return messageBody;
      }

      const author = target.username || usersById.get(target.sender_user_id)?.username || "Unknown User";
      // If the message we're replying to is ITSELF a reply (i.e. its
      // body starts with our reply marker), strip out the nested
      // reply header before extracting the excerpt. Otherwise the
      // excerpt would include "> Replying to @<grandparent> > <grand-
      // parent excerpt>" and reply chains would visually balloon
      // each generation, restating the entire history in every new
      // reply. We only want to quote what the target actually
      // SAID, not who they were replying to.
      const parsedTarget = parseReplyContext(target.message || "");
      const targetVisibleBody =
        parsedTarget ? parsedTarget.body : (target.message || "");
      const excerpt = targetVisibleBody
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
        .slice(0, 140);
      const quotedLines = excerpt ? `> ${excerpt.replace(/\n/g, "\n> ")}\n\n` : "";
      return `> Replying to @${author}\n${quotedLines}${messageBody}`.trim();
    },
    [usersById],
  );

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

  const applyReadHistorySnapshot = useCallback((messageIds: string[], unreadCounts: Record<string, number>) => {
    const snapshot = new Set(messageIds);
    readMessageIdsRef.current = snapshot;
    setReadMessageIds(snapshot);
    // Defensive: never re-introduce an unread dot for the channel the
    // user is currently viewing. `fetchReadHistoryData` runs in parallel
    // with the channel-restore effect, so the snapshot can land AFTER
    // `handleChannelSelect` has already cleared this channel's count.
    // Without this guard the blunt overwrite would resurrect the dot
    // for ~one render before the next `markMessagesRead` round-trip
    // wiped it again — a flicker that read as "the dot is stuck on a
    // channel I just opened."
    const activeChannelId = selectedChannelIdRef.current;
    const sanitized = activeChannelId
      ? Object.fromEntries(
          Object.entries(unreadCounts).filter(([channelId]) => channelId !== activeChannelId),
        )
      : unreadCounts;
    setUnreadCountsByChannel(sanitized);
  }, []);

  const markChannelNotificationsRead = useCallback((channelId: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.channelId !== channelId));
  }, []);

  const applyPresenceUpdate = useCallback((userId: string, status: DisplayUser["status"]) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) => (user.user_id === userId ? { ...user, status } : user)),
    );
    setMessages((prevMessages) =>
      prevMessages.map((message) =>
        message.sender_user_id === userId ? { ...message, sender_status: status } : message,
      ),
    );
  }, []);

  const updatePresenceStatus = useCallback(
    async (
      status: "online" | "idle" | "afk" | "dnd" | "offline",
      options?: { silent?: boolean; lockMode?: "preserve" | "set" | "clear" },
    ) => {
      if (!currentUser || currentUserLiveStatus === status || presenceUpdateInFlightRef.current) {
        return;
      }

      const previousStatus =
        currentUserLiveStatus === "online" || currentUserLiveStatus === "idle" || currentUserLiveStatus === "afk" || currentUserLiveStatus === "dnd"
          ? currentUserLiveStatus
          : "offline";

      presenceUpdateInFlightRef.current = true;
      applyPresenceUpdate(currentUser.user_id, status);

      try {
        const sentViaWebSocket = webSocketConnectionRef.current?.sendPresenceUpdate(status) ?? false;
        if (!sentViaWebSocket) {
          const authToken = getAuthTokenFromCookies() || "";
          if (!authToken) {
            throw new Error("No authentication token");
          }

          const response = await updateUserStatus({ auth_token: authToken, status });
          if (!response.success) {
            throw new Error(response.error || "Failed to update status");
          }
        }

        if (options?.lockMode === "set") {
          // Mirror `isManualPresenceStatus`: only the intentional
          // availability states (DND / AFK) pin the lock. Anything
          // else clears it so the activity loop can resume managing
          // online ↔ idle.
          setManualPresenceLock(status === "dnd" || status === "afk" ? status : null);
        } else if (options?.lockMode === "clear") {
          setManualPresenceLock(null);
        }

      } catch (error) {
        applyPresenceUpdate(currentUser.user_id, previousStatus);
        if (!options?.silent) {
          showToast({
            message: `Failed to update status: ${error instanceof Error ? error.message : "Unknown error"}`,
            tone: "error",
            category: "system",
          });
        }
      } finally {
        presenceUpdateInFlightRef.current = false;
      }
    },
    [applyPresenceUpdate, currentUser, currentUserLiveStatus, showToast],
  );

  // Keep refs in sync so the idle effect can read current values without being in its dep array.
  useEffect(() => {
    currentUserLiveStatusRef.current = currentUserLiveStatus;
  }, [currentUserLiveStatus]);

  useEffect(() => {
    updatePresenceStatusRef.current = updatePresenceStatus;
  }, [updatePresenceStatus]);

  // Restore manual presence lock if an external broadcast flips the status away from it.
  useEffect(() => {
    if (
      !currentUser ||
      !manualPresenceLock ||
      currentUserLiveStatus === manualPresenceLock ||
      presenceUpdateInFlightRef.current
    ) {
      return;
    }

    void updatePresenceStatus(manualPresenceLock, { silent: true });
  }, [currentUser, currentUserLiveStatus, manualPresenceLock, updatePresenceStatus]);

  // Idle detection — stable effect that only re-mounts when the user or DND lock changes.
  // Uses refs for live status and updater so no stale closures, no unnecessary teardowns.
  const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const IDLE_CHECK_INTERVAL_MS = 20_000;   // check every 20 seconds

  useEffect(() => {
    if (!currentUser || manualPresenceLock) {
      return;
    }

    lastActivityAtRef.current = Date.now();

    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
      if (currentUserLiveStatusRef.current === "idle") {
        void updatePresenceStatusRef.current?.("online", { silent: true, lockMode: "clear" });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markActivity();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove", "mousedown", "keydown", "touchstart", "scroll", "focus",
    ];
    activityEvents.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = window.setInterval(() => {
      const idleForMs = Date.now() - lastActivityAtRef.current;
      const status = currentUserLiveStatusRef.current;
      if (idleForMs >= IDLE_THRESHOLD_MS && status === "online") {
        void updatePresenceStatusRef.current?.("idle", { silent: true, lockMode: "clear" });
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, markActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.user_id, manualPresenceLock]);

  const markMessagesRead = useCallback(
    async (channelId: string, messageIds: string[]) => {
      const uniqueMessageIds = [...new Set(messageIds)].filter((messageId) => !readMessageIdsRef.current.has(messageId));
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

      const authToken = getAuthTokenFromCookies() || "";
      const hostPort = getHostPortFromStorage() || getHostPortFromCookies();
      if (!authToken || !hostPort) {
        return;
      }

      uniqueMessageIds.forEach((messageId) => {
        webSocketConnectionRef.current?.sendReadConfirmation(messageId, channelId);
      });

      await Promise.allSettled(uniqueMessageIds.map((messageId) => markMessageAsRead(hostPort, channelId, messageId, authToken)));
    },
    [addReadMessageIds, markChannelNotificationsRead],
  );

  return {
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
    popperElement,
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
    setReadMessageIds,
    unreadCountsByChannel,
    setUnreadCountsByChannel,
    mutedChannelIds,
    setMutedChannelIds,
    manualPresenceLock,
    setManualPresenceLock,
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
    lastActivityAtRef,
    presenceUpdateInFlightRef,
    usersById,
    currentUserLiveStatus,
    groupedMessages,
    getMessageById,
    buildReplyMessage,
    addReadMessageIds,
    applyReadHistorySnapshot,
    markChannelNotificationsRead,
    applyPresenceUpdate,
    updatePresenceStatus,
    markMessagesRead,
  };
}
