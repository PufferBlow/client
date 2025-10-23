import type { Route } from "./+types/dashboard";
import { Link, useNavigate } from "react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { ServerCreationModal } from "../components/ServerCreationModal";
import { ChannelCreationModal } from "../components/ChannelCreationModal";
import { UserContextMenu } from "../components/UserContextMenu";
import { SearchModal } from "../components/SearchModal";
import { InviteModal } from "../components/InviteModal";
import { EmojiPicker } from "../components/EmojiPicker";
import { UserPanel } from "../components/UserPanel";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { MessageReportModal } from "../components/MessageReportModal";
import { MessageContextMenu } from "../components/MessageContextMenu";
import { useToast } from "../components/Toast";
import { UserCard } from "../components/UserCard";
import { validateMessageInput } from "../utils/markdown";
import { logger } from "../utils/logger";
import { usePersistedUIState } from "../utils/uiStatePersistence";
import { getAuthTokenFromCookies, getHostPortFromCookies, getHostPortFromStorage, useCurrentUserProfile, getUserProfileById } from "../services/user";
import { listChannels, createChannel, loadMessages, deleteChannel } from "../services/channel";
import { sendMessage } from "../services/message";
import { ChannelWebSocket, createChannelWebSocket, getHostPortForWebSocket } from "../services/websocket";
import { listUsers, type ListUsersResponse } from "../services/user";
import { type ServerInfo } from "../services/system";
import type { Channel } from "../models";
import type { Message } from "../models";
import type { User } from "../models";

interface DisplayUser {
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

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Pufferblow - Decentralized Messaging" },
    { name: "description", content: "Discord-like messaging with decentralized servers" },
  ];
}

export default function Dashboard() {
  const navigate = useNavigate();

  // Client-side authentication check
  useEffect(() => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) {
      navigate('/login');
    }
  }, [navigate]);
  // Toast hook
  const showToast = useToast();

  // React Query hooks for user authentication and data
  const { data: currentUser, isLoading: userLoading, error: userError } = useCurrentUserProfile();

  // UI persistence hook
  const {
    selectedChannelId: persistedChannelId,
    messageDrafts,
    setSelectedChannel: persistSelectedChannel,
    setMessageDraft,
    getMessageDraft,
    clearMessageDraft,
    clearAllState
  } = usePersistedUIState(currentUser?.user_id);

  // Modal states
  const [serverCreationModalOpen, setServerCreationModalOpen] = useState(false);
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [userCardTooltip, setUserCardTooltip] = useState<{
    user: DisplayUser;
    position: { x: number; y: number };
    transform?: string;
  } | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
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
  const [channelContextMenu, setChannelContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number }; channel: Channel | null }>({ isOpen: false, position: { x: 0, y: 0 }, channel: null });
  const [channelDeleteConfirm, setChannelDeleteConfirm] = useState<{ isOpen: boolean; channel: Channel | null }>({ isOpen: false, channel: null });
  const [messageReportModal, setMessageReportModal] = useState<{ isOpen: boolean; messages: string[] }>({ isOpen: false, messages: [] });
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<ListUsersResponse['users']>([]);
  const [webSocketConnection, setWebSocketConnection] = useState<ChannelWebSocket | null>(null);
  const [messageInput, setMessageInput] = useState(() => {
    // Initialize with persisted draft if we have a selected channel
    if (persistedChannelId) {
      return getMessageDraft(persistedChannelId);
    }
    return '';
  });
  const [messageAttachments, setMessageAttachments] = useState<File[]>([]);

  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 });
  const [maxMessageLength, setMaxMessageLength] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pufferblow-max-message-length');
      return saved ? parseInt(saved) : 4000;
    }
    return 4000; // Default value for SSR
  });
  const messageInputBarRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const serverDropdownRef = useRef<HTMLDivElement>(null);
  const [cachedTextareaHeight, setCachedTextareaHeight] = useState<number>(24);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle authentication redirects and loading errors
  if (userError?.message?.includes('No authentication token') || userError?.message?.includes('No server host:port configured')) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  // Handle loading timeout - prevent infinite loading
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  useEffect(() => {
    if (userLoading) {
      console.log('Dashboard: Starting loading timeout...');
      const timer = setTimeout(() => {
        console.error('Dashboard: Loading timeout reached - redirecting to login');
        setLoadingTimeout(true);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }, 10000); // 10 second timeout

      return () => {
        console.log('Dashboard: Clearing loading timeout');
        clearTimeout(timer);
      };
    }
  }, [userLoading]);

  // Show timeout error if it took too long to load
  if (loadingTimeout) {
    return (
      <div className="h-screen bg-gradient-to-br from-[var(--color-background)] to-[var(--color-background-secondary)] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-600 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.6-.833-2.37 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Loading Timeout</h2>
          <p className="text-gray-400 mb-4">The app took too long to load. This may be due to a network issue or server problems.</p>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

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

  // Handle click outside to close user card tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userCardTooltip) {
        closeUserCardTooltip();
      }
    };

    if (userCardTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userCardTooltip]);

  // Save maxMessageLength to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pufferblow-max-message-length', maxMessageLength.toString());
    }
  }, [maxMessageLength]);

  // Optimized auto-resize message input textarea with debouncing
  useEffect(() => {
    // Clear any pending resize timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    // Debounce the resize operation to avoid excessive calculations during typing
    resizeTimeoutRef.current = setTimeout(() => {
      if (messageInputRef.current) {
        const textarea = messageInputRef.current;
        const minHeight = 24; // 1.5rem = 24px
        const maxHeight = 200; // Maximum height before scrolling

        // Use requestAnimationFrame for smooth DOM updates
        requestAnimationFrame(() => {
          if (!textarea) return;

          // Reset height to auto to get the correct scrollHeight
          textarea.style.height = 'auto';

          // Calculate new height
          const scrollHeight = textarea.scrollHeight;
          let newHeight = scrollHeight;

          // Apply minimum height
          newHeight = Math.max(newHeight, minHeight);

          // Avoid unnecessary DOM updates if height hasn't changed significantly
          if (Math.abs(newHeight - cachedTextareaHeight) > 2) {
            setCachedTextareaHeight(newHeight);

            // If content exceeds max height, make it scrollable, otherwise expand
            if (scrollHeight > maxHeight) {
              newHeight = maxHeight;
              textarea.style.overflowY = 'auto';
            } else {
              textarea.style.overflowY = 'hidden';
            }

            textarea.style.height = `${newHeight}px`;
          }
        });
      }
    }, 50); // 50ms debounce delay

    // Cleanup timeout on unmount or next effect
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [messageInput]);

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
  }, [messages]);

  // Fetch channels, users, and server info on mount
  useEffect(() => {
    const fetchChannels = async () => {
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) return;

      const response = await listChannels(authToken);
      if (response.success && response.data && response.data.channels) {
        setChannels(response.data.channels);
        console.log("Channels fetched from API:", response.data.channels);
        logger.ui.info("Channels fetched successfully", { count: response.data.channels.length });
      } else {
        console.error("Failed to fetch channels from API:", response.error);
        logger.ui.error("Failed to fetch channels", { error: response.error });
        setChannels([]);
      }
    };

    const fetchUsers = async () => {
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) return;

      const response = await listUsers(authToken);
      if (response.success && response.data && response.data.users) {
        setUsers(response.data.users);
        console.log("Users fetched from API:", response.data.users);
        logger.ui.info("Users fetched successfully", { count: response.data.users.length });
      } else {
        console.error("Failed to fetch users from API:", response.error);
        logger.ui.error("Failed to fetch users", { error: response.error });
        setUsers([]);
      }
    };

    const fetchServerInfo = async () => {
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) return;

      const { getServerInfo } = await import('../services/system');
      const response = await getServerInfo();
      if (response.success && response.data && response.data.server_info) {
        setServerInfo(response.data.server_info);
        console.log("Server info fetched from API:", response.data.server_info);
        logger.ui.info("Server info fetched successfully");
      } else {
        console.error("Failed to fetch server info from API:", response.error);
        logger.ui.error("Failed to fetch server info", { error: response.error });
      }
    };

    if (currentUser) {
      fetchChannels();
      fetchUsers();
      fetchServerInfo();
    }
  }, [currentUser]);

  // Initialize from persisted state after channels are loaded
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      // Try to restore previously selected channel
      if (persistedChannelId) {
        const persistedChannel = channels.find(c => c.channel_id === persistedChannelId);
        if (persistedChannel) {
          console.log("Restoring previously selected channel:", persistedChannel);
          // Don't call handleChannelSelect here as it will handle persistence itself
          setSelectedChannel(persistedChannel);
          persistSelectedChannel(persistedChannel.channel_id);
        } else {
          console.log("Persisted channel not found, selecting first available channel");
          // Persisted channel no longer exists, select the first available channel
          const firstChannel = channels[0];
          handleChannelSelect(firstChannel);
        }
      } else {
        // No persisted channel, select the first available channel
        console.log("No persisted channel, selecting first available");
        const firstChannel = channels[0];
        handleChannelSelect(firstChannel);
      }
    }
  }, [channels, persistedChannelId, selectedChannel]);





  // Show skeleton loading state for dashboard
  if (!currentUser) {
    return (
      <div className="h-screen bg-gradient-to-br from-[var(--color-background)] to-[var(--color-background-secondary)] flex font-sans gap-2 p-2 select-none relative">
        {/* Server Sidebar */}
        <div className="w-16 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col items-center py-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent backdrop-blur-sm animate-pulse">
          <div className="w-8 h-px bg-[#35373c] rounded mb-2"></div>

          {/* Server Icons */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] shadow-lg border border-[var(--color-border)] flex items-center justify-center group">
              <div className="w-8 h-8 rounded bg-[var(--color-surface-tertiary)] opacity-60"></div>
            </div>
          ))}

          {/* Add Server Button */}
          <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#23a559] transition-all duration-200 cursor-pointer group mt-auto">
            <svg className="w-6 h-6 text-[#b5bac1] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
        </div>

        {/* Channel Sidebar */}
        <div className="w-60 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col resize-x min-w-48 max-w-96 backdrop-blur-sm animate-pulse">
          {/* Server Header */}
          <div className="relative">
            <div className={`px-4 py-3 ${false ? '' : 'border-b border-[var(--color-border)]'}`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="h-5 bg-gradient-to-r from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] rounded mb-1 w-32"></div>
                  <div className="h-3 bg-gradient-to-r from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] rounded w-48"></div>
                </div>
                <div className="w-8 h-8 bg-[var(--color-surface-secondary)] rounded-lg"></div>
              </div>
            </div>
          </div>

          {/* Channel List */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-2 py-4">
              {/* Channels Header */}
              <div className="flex items-center px-2 mb-1">
                <svg className="w-3 h-3 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <div className="h-3 bg-[var(--color-surface-secondary)] rounded w-16"></div>
              </div>

              {/* Channel Items */}
              <div className="space-y-0.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex items-center px-2 py-1.5 rounded hover:bg-gray-600 cursor-pointer group transition-colors">
                    <div className="w-2 h-2 bg-[var(--color-surface-secondary)] rounded-full mr-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className={`h-3 bg-gradient-to-r from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] rounded ${i % 3 === 0 ? 'w-20' : i % 4 === 0 ? 'w-28' : 'w-16'}`}></div>
                    </div>
                    {i % 5 === 0 && (
                      <svg className="w-4 h-4 text-gray-500 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* User Panel */}
          <UserPanel
            username="Loading..."
            avatar="/pufferblow-art-pixel-32x32.png"
            status="offline"
            onClick={() => { }}
            onSettingsClick={() => { }}
            className="m-2 mt-auto opacity-60"
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] resize-x min-w-96 backdrop-blur-sm animate-pulse">
          {/* Channel Header */}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
              <svg className="w-5 h-5 text-[var(--color-text-secondary)] rounded-md p-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors ${i % 4 === 0 ? 'bg-blue-900/10 border-l-4 border-blue-500' : ''
                  }`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex-shrink-0 animate-pulse shadow-lg"></div>

                {/* Message Content */}
                <div className="flex-1">
                  {/* Message Header */}
                  <div className="flex items-center space-x-2 mb-3">
                    {/* Username */}
                    <div className={`h-4 bg-gradient-to-r from-white to-gray-200 rounded font-medium ${i % 3 === 0 ? 'w-20' : i % 2 === 0 ? 'w-24' : 'w-16'}`}></div>

                    {/* Role badge */}
                    {i % 5 === 0 && (
                      <div className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded font-medium opacity-80">
                        ADMIN
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="h-3 bg-gradient-to-r from-gray-400 to-gray-600 rounded w-16 opacity-60"></div>
                  </div>

                  {/* Message Lines */}
                  <div className="space-y-2">
                    <div className="h-3 bg-gradient-to-r from-gray-300 to-gray-500 rounded animate-pulse w-full"></div>
                    {i % 3 === 0 && (
                      <div className="h-3 bg-gradient-to-r from-gray-300 to-gray-500 rounded animate-pulse w-4/5"></div>
                    )}
                    {i % 4 === 1 && (
                      <>
                        <div className="h-3 bg-gradient-to-r from-gray-300 to-gray-500 rounded animate-pulse w-3/4"></div>
                        <div className="h-3 bg-gradient-to-r from-gray-300 to-gray-500 rounded animate-pulse w-1/2"></div>
                      </>
                    )}
                  </div>

                  {/* Attachment Preview */}
                  {i % 6 === 2 && (
                    <div className="mt-3 p-3 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg border border-gray-500 animate-pulse">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <div className="h-3 bg-gradient-to-r from-gray-400 to-gray-600 rounded w-24"></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hover Menu Button */}
                {(i + 1) % 2 === 0 && (
                  <div className="absolute right-0 top-0 opacity-100 mt-2 mr-2">
                    <button className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded flex items-center justify-center text-gray-300 hover:text-white transition-colors">
                      ⋯
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-4">
            <div className="bg-gray-600 rounded-lg px-4 py-3 animate-pulse">
              <div className="flex items-end space-x-3">
                <div className="w-8 h-8 bg-gray-500 rounded flex-shrink-0"></div>
                <div className="flex-1 min-h-0">
                  <div className="w-full bg-gray-700 rounded px-2 py-1 opacity-60"></div>
                </div>
                <div className="w-8 h-8 bg-gray-500 rounded"></div>
                <div className="w-8 h-8 bg-gray-500 rounded"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Member List - Skeleton */}
        <div className="w-60 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] animate-pulse">
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

  // Mock data
  const currentServer = { id: "server1", name: "General Server" };

  // Event handlers
  const handleCreateServer = (serverData: { name: string; description: string; isPrivate: boolean }) => {
    logger.ui.info("Creating server", { serverName: serverData.name, isPrivate: serverData.isPrivate });
    // TODO: Implement server creation
  };

  const handleCreateChannel = async (channelData: { name: string; type: 'text' | 'voice'; description?: string; isPrivate?: boolean }) => {
    try {
      const authToken = getAuthTokenFromCookies() || '';

      const response = await createChannel({
        channel_name: channelData.name,
        is_private: channelData.isPrivate || false
      }, authToken);

      if (response.success && response.data) {
        logger.ui.info("Channel created successfully", {
          channelName: channelData.name,
          isPrivate: channelData.isPrivate
        });

        // Show success toast
        showToast(`Channel #${channelData.name} created successfully!`, 'success');

        // Refresh channels list
        const channelsResponse = await listChannels(authToken);
        if (channelsResponse.success && channelsResponse.data) {
          setChannels(channelsResponse.data.channels);
        }

        // Close modals
        setChannelCreationModalOpen(false);
      } else {
        // Handle specific error codes
        if (response.error?.includes('409') || response.error?.includes('Channel name already exists')) {
          showToast('Channel name already exists, please choose a different name.', 'error');
        } else if (response.error?.includes('403') || response.error?.includes('Access forbidden')) {
          showToast('Access forbidden. Only admins can create channels and manage them.', 'error');
        } else {
          showToast(`Failed to create channel: ${response.error || 'Unknown error'}`, 'error');
        }
        logger.ui.error("Failed to create channel", { error: response.error, channelData });
      }
    } catch (error) {
      showToast('An unexpected error occurred while creating the channel.', 'error');
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
    console.log("Selected search result:", result);
    // TODO: Navigate to result
  };

  const handleGenerateInvite = async (options: { maxUses?: number; expiresAt?: Date; isPermanent?: boolean }) => {
    // Mock invite generation
    return "ABC123";
  };

  const handleCopyInvite = (inviteCode: string) => {
    navigator.clipboard.writeText(`https://pufferblow.space/invite/${inviteCode}`);
    logger.ui.info("Invite link copied to clipboard", { inviteCode: "[REDACTED]" });
  };

  // Message action handlers
  const handleMessageReply = (messageId: string | null) => {
    if (!messageId) {
      console.log("No message ID available for reply");
      return;
    }
    console.log("Reply to message:", messageId);
    // TODO: Implement reply functionality
  };

  const handleMessageReact = (messageId: string) => {
    console.log("Add reaction to message:", messageId);
    // TODO: Implement reaction functionality
  };

  const handleMessageReport = (messageId: string | null) => {
    if (!messageId) {
      console.log("No message ID available for reporting");
      return;
    }
    // Handle single message report by opening modal
    setMessageReportModal({ isOpen: true, messages: [messageId] });
  };

  const handleMessageReportSubmit = async (report: { category: string; description: string }) => {
    const { category, description } = report;

    // TODO: Send report to API - for now just simulate submission
    console.log("Submitting message report:", {
      messageIds: messageReportModal.messages,
      category,
      description
    });

    // Show success toast
    showToast(`Report submitted successfully. Thank you for helping keep our community safe!`, 'success');

    // Close modal
    setMessageReportModal({ isOpen: false, messages: [] });

    // Log the report
    logger.ui.info("Message report submitted", {
      messageCount: messageReportModal.messages.length,
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
        showToast(`${messageIds.length} message IDs copied to clipboard!`, 'success');
      } catch (error) {
        logger.ui.error("Failed to copy message group IDs to clipboard", { error });
        showToast("Failed to copy message IDs to clipboard. Please try again.", 'error');
      }
    };

    const groupReportHandler = () => {
      // Report all messages in the group
      setMessageReportModal({ isOpen: true, messages: messageIds });
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
      showToast("Message ID not available to copy", 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(messageId);
      logger.ui.info("Message ID copied to clipboard", { messageId: "[REDACTED]" });
      showToast("Message ID copied to clipboard!", 'success');
    } catch (error) {
      logger.ui.error("Failed to copy message ID to clipboard", { error });
      showToast("Failed to copy message ID to clipboard. Please try again.", 'error');
    }
  };

  const handleUserReport = (userId: string) => {
    console.log("Report user:", userId);
    // TODO: Implement user report functionality
  };

  const handleCopyUserId = async (userId: string) => {
    try {
      await navigator.clipboard.writeText(userId);
      logger.ui.info("User ID copied to clipboard", { userId: "[REDACTED]" });
      showToast("User ID copied to clipboard!", 'success');
    } catch (error) {
      logger.ui.error("Failed to copy user ID to clipboard", { error });
      showToast("Failed to copy user ID to clipboard. Please try again.", 'error');
    }
  };

  const handleSendMessageToUser = (userId: string) => {
    console.log("Send message to user:", userId);
    // TODO: Implement direct message functionality
  };

  const handleChannelSelect = async (channel: Channel) => {
    console.log("Channel clicked:", channel);

    // Save current channel's message draft before switching
    if (selectedChannel && messageInput) {
      setMessageDraft(selectedChannel.channel_id, messageInput);
    }

    // Disconnect from previous WebSocket if exists
    if (webSocketConnection) {
      webSocketConnection.disconnect();
      setWebSocketConnection(null);
    }

    setSelectedChannel(channel);

    // Persist the selected channel
    persistSelectedChannel(channel.channel_id);

    // Restore message draft for the new channel
    const restoredDraft = getMessageDraft(channel.channel_id);
    setMessageInput(restoredDraft);

    // Load messages for the selected channel
    const authToken = getAuthTokenFromCookies() || '';
    const hostPort = getHostPortForWebSocket();

    console.log("Loading messages - authToken:", authToken ? 'exists' : 'missing', "channel_id:", channel.channel_id);

    if (authToken && channel.channel_id && hostPort) {
      console.log("Making loadMessages API call...");
      const response = await loadMessages(channel.channel_id, authToken);
      console.log("loadMessages response:", response);

      if (response.success && response.data && response.data.messages) {
        setMessages(response.data.messages);
        logger.ui.info("Messages loaded successfully", { channelId: channel.channel_id, count: response.data.messages.length });
        console.log("Messages set:", response.data.messages.length, "messages");

        // Establish WebSocket connection after loading messages
        if (currentUser) {
          console.log("Establishing WebSocket connection for channel:", channel.channel_id);
          const wsConnection = createChannelWebSocket(channel.channel_id, authToken, hostPort, {
            onMessage: (message) => {
              console.log("WebSocket message received:", message);
              // Handle incoming messages from WebSocket
              if (message.type === 'message') {
                // Add new message to the list
                setMessages(prevMessages => {
                  // Generate a temporary message ID if none provided
                  const msgId = message.message_id || `ws-${Date.now()}-${Math.random()}`;

                  // Check if message already exists (avoid duplicates)
                  const exists = prevMessages.some(m => m.message_id === msgId);
                  if (!exists) {
                    return [...prevMessages, {
                      message_id: msgId,
                      sender_user_id: message.sender_user_id || '',
                      message: message.message || '',
                      hashed_message: message.hashed_message || '',
                      username: message.username,
                      sender_avatar_url: message.sender_avatar_url,
                      sender_status: message.sender_status,
                      sender_roles: message.sender_roles,
                      sent_at: message.sent_at || new Date().toISOString(),
                      channel_id: channel.channel_id,
                      attachments: message.attachments || []
                    }];
                  }
                  return prevMessages;
                });
              }
            },
            onConnected: () => {
              console.log("WebSocket connected for channel:", channel.channel_id);
              showToast(`Connected to #${channel.channel_name}`, 'success');
            },
            onDisconnected: (reason) => {
              console.log("WebSocket disconnected:", reason);
              showToast(`Disconnected from #${channel.channel_name}`, 'error');
            },
            onError: (error) => {
              console.error("WebSocket error:", error);
              showToast("Connection error - messages may not update in real-time", 'error');
            }
          });
          wsConnection.connect();
          setWebSocketConnection(wsConnection);
        }
      } else {
        console.error("Failed to load messages:", response.error);
        logger.ui.error("Failed to load messages", { channelId: channel.channel_id, error: response.error });
        setMessages([]); // Clear messages if failed
      }
    } else {
      console.log("Not loading messages - missing authToken, channel_id, or hostPort");
    }
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
    // Only show context menu for owners
    if (currentUser?.roles?.includes('Owner')) {
      setChannelContextMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        channel: channel
      });
    }
  };

  // Message input handlers
  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();

    // Require either a message or attachments
    const hasContent = trimmedMessage || messageAttachments.length > 0;

    if (!hasContent) {
      return;
    }

    // Validate message for security and length if present
    if (trimmedMessage) {
      const validationResult = validateMessageInput(trimmedMessage, maxMessageLength);
      if (!validationResult.isValid) {
        showToast(validationResult.error || 'Invalid message content', 'error');
        return;
      }
    }

    const authToken = getAuthTokenFromCookies() || '';

    if (!selectedChannel || !authToken) {
      logger.ui.warn("Cannot send message - no channel selected or no auth token");
      return;
    }

    try {
      console.log('Sending message:', {
        channelId: selectedChannel.channel_id,
        message: trimmedMessage,
        attachments: messageAttachments.length,
        authToken: authToken.substring(0, 20) + '...'
      });

      // Send via REST API (attachments require multipart/form-data)
      const messageData = {
        content: trimmedMessage || '', // Empty string if only attachments
        attachments: messageAttachments.length > 0 ? messageAttachments : undefined
      };

      const hostPort = getHostPortForWebSocket();
      const { sendMessage: sendMessageWithAttachments } = await import('../services/message');

      const response = await sendMessageWithAttachments(hostPort, selectedChannel.channel_id, messageData, authToken);
      console.log('Send message response:', response);

      if (response.success) {
        logger.ui.info("Message sent successfully", {
          channelId: selectedChannel.channel_id,
          messageLength: trimmedMessage.length,
          attachmentCount: messageAttachments.length
        });

        // Clear input, draft, and attachments
        setMessageInput('');
        setMessageAttachments([]);
        if (selectedChannel) {
          clearMessageDraft(selectedChannel.channel_id);
        }

        // Add the message to the UI immediately (optimistic update)
        const tempMessage: Message = {
          message_id: `temp-${Date.now()}`,
          sender_user_id: currentUser?.user_id || '',
          message: trimmedMessage || `${messageAttachments.length} attachment${messageAttachments.length > 1 ? 's' : ''}`, // Display text for attachment-only messages
          hashed_message: trimmedMessage || `${messageAttachments.length} attachment${messageAttachments.length > 1 ? 's' : ''}`,
          sent_at: new Date().toISOString(),
          channel_id: selectedChannel.channel_id
          // Note: Attachment URLs will be available when the API responds
        };
        setMessages(prevMessages => [...prevMessages, tempMessage]);

        showToast('Message sent successfully!', 'success');
      } else {
        logger.ui.error("Failed to send message", { error: response.error });
        showToast(`Failed to send message: ${response.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      logger.ui.error("Unexpected error sending message", { error });
      showToast('An unexpected error occurred while sending the message.', 'error');
    }
  };

  const handleKeyPress = async (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await handleSendMessage();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Exploitable file extensions to reject
    const dangerousExtensions = [
      // Executables
      'exe', 'bat', 'cmd', 'scr', 'pif', 'com', 'msi', 'jar', 'app',
      // Scripts
      'vbs', 'js', 'jse', 'wsf', 'wsh', 'ps1', 'psm1', 'psd1', 'psc1',
      // Web files that could contain scripts
      'html', 'htm', 'xhtml', 'shtml', 'xml', 'svg',
      // Archives that might contain executables
      'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
      // Other potentially dangerous
      'reg', 'inf', 'url', 'lnk', 'scf', 'shb', 'shs'
    ];

    const attachments: File[] = [];
    const maxTotalSize = 50 * 1024 * 1024; // 50MB total for all attachments
    let totalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension && dangerousExtensions.includes(extension)) {
        logger.ui.warn("Rejected dangerous file upload", {
          fileName: file.name,
          extension,
          reason: "potentially exploitable file type"
        });
        showToast(`File "${file.name}" cannot be uploaded. This file type is not allowed for security reasons.`, 'error');
        event.target.value = ''; // Clear the input
        return;
      }

      // Check individual file size (limit to 10MB per file)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        logger.ui.warn("Rejected large file upload", {
          fileName: file.name,
          fileSize: file.size,
          maxSize
        });
        showToast(`File "${file.name}" is too large. Maximum file size is 10MB per file.`, 'error');
        event.target.value = '';
        return;
      }

      // Check total size
      totalSize += file.size;

      attachments.push(file);
    }

    if (totalSize > maxTotalSize) {
      logger.ui.warn("Rejected attachments - total size too large", {
        totalSize,
        maxTotalSize
      });
      showToast(`Total attachment size is too large. Maximum total size is 50MB.`, 'error');
      event.target.value = '';
      return;
    }

    // Add new attachments to existing ones
    setMessageAttachments(prev => [...prev, ...attachments]);

    logger.ui.info("Attachments added to message", {
      count: attachments.length,
      fileNames: attachments.map(f => f.name),
      totalSize
    });

    // Clear the input so same files can be selected again if needed
    event.target.value = '';
  };

  const removeAttachment = (indexToRemove: number) => {
    setMessageAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleEmojiClick = (event: React.MouseEvent) => {
    event.preventDefault();

    const buttonRect = (event.target as HTMLElement).getBoundingClientRect();
    const pickerWidth = 320; // w-80
    const pickerHeight = 400; // Approximate height
    const gap = 8;

    // Position horizontally: center on the emoji button
    let x = buttonRect.left + (buttonRect.width / 2) - (pickerWidth / 2);

    // Ensure horizontal bounds
    if (x < gap) {
      x = gap;
    } else if (x + pickerWidth > window.innerWidth - gap) {
      x = window.innerWidth - pickerWidth - gap;
    }

    // Position vertically: above the button with some space for the arrow
    let y = buttonRect.top - pickerHeight - gap - 4; // Extra space for visual arrow

    // If not enough space above, position below
    if (y < gap) {
      y = buttonRect.bottom + gap;
    }

    // Ensure vertical bounds
    if (y + pickerHeight > window.innerHeight - gap) {
      y = window.innerHeight - pickerHeight - gap;
    }
    if (y < gap) {
      y = gap;
    }

    setEmojiPickerPosition({ x, y });
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

  const handleUserClick = async (userId: string, username: string, event: React.MouseEvent) => {
    event.preventDefault();

    closeUserCardTooltip();

    try {
      // Try to find user in the current users list first
      const apiUser = users.find(u => u.user_id === userId);
      if (apiUser) {
        // Convert API user data to display format with full customization settings
        const displayUser: DisplayUser = {
          id: apiUser.user_id,
          username: apiUser.username,
          avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(apiUser.username)}&backgroundColor=5865f2`,
          banner: undefined, // Could be extended from API later
          accentColor: apiUser.is_owner ? '#22d3ee' : apiUser.is_admin ? '#ef4444' : '#8b5cf6', // Cyan for owner, red for admin, purple for member
          bannerColor: apiUser.is_owner ? '#22d3ee' : apiUser.is_admin ? '#ef4444' : '#8b5cf6', // Same colors but for banner background
          customStatus: apiUser.is_owner ? 'Server Owner' : apiUser.is_admin ? 'Administrator' : 'Active Member',
          externalLinks: [], // Would be loaded from user preferences/settings in real implementation
          status: (apiUser.status === 'online' || apiUser.status === 'idle' || apiUser.status === 'dnd' || apiUser.status === 'offline')
            ? apiUser.status as 'online' | 'idle' | 'dnd' | 'offline'
            : 'offline',
          bio: `Member of ${serverInfo?.server_name || 'Pufferblow Server'} since ${new Date(apiUser.created_at).getFullYear()}. Passionate about decentralized technology.`,
          joinedAt: apiUser.created_at || apiUser.last_seen,
          originServer: serverInfo?.server_name || 'Pufferblow Server',
          roles: apiUser.is_owner ? ['Owner', 'Admin'] : apiUser.is_admin ? ['Admin'] : ['Member']
        };
        showUserCardTooltip(displayUser, event);
      } else {
        // Fallback to creating a basic user card from the username
        const fallbackUser: DisplayUser = {
          id: userId,
          username: username,
          avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}&backgroundColor=5865f2`,
          banner: undefined,
          accentColor: '#8b5cf6', // Purple default
          bannerColor: undefined,
          customStatus: 'Member',
          externalLinks: [],
          status: 'offline',
          bio: 'User information not available',
          joinedAt: '',
          originServer: serverInfo?.server_name || 'Pufferblow Server',
          roles: ['Member']
        };
        showUserCardTooltip(fallbackUser, event);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      showToast('Could not load user profile', 'error');
    }
  };

  // Helper functions for user card tooltip
  const showUserCardTooltip = (user: DisplayUser, event: React.MouseEvent) => {
    const tooltipWidth = 220; // Smaller tooltip width
    const tooltipHeight = 180; // Much more compact tooltip height
    const gap = 8;
    const clickX = event.clientX;
    const clickY = event.clientY;

    // First, calculate position above the click point
    let x = clickX - (tooltipWidth / 2); // Center horizontally on click point
    let y = clickY - tooltipHeight - gap; // Position above with gap
    let transform = 'translate(0, 0)';

    // Check if positioning above would go off-screen
    if (y < gap) {
      // Position below the click point instead
      y = clickY + gap;
      transform = 'translate(0, 0)';
    } else {
      // Keep position above but adjust transform to account for full height
      transform = 'translate(0, 0)';
    }

    // Ensure horizontal bounds
    if (x < gap) {
      x = gap;
    } else if (x + tooltipWidth > window.innerWidth - gap) {
      x = window.innerWidth - tooltipWidth - gap;
    }

    // Ensure vertical bounds
    if (y + tooltipHeight > window.innerHeight - gap) {
      y = window.innerHeight - tooltipHeight - gap;
      if (y < gap) y = gap;
    }

    // Final bounds checking
    x = Math.max(gap, Math.min(x, window.innerWidth - tooltipWidth - gap));
    y = Math.max(gap, Math.min(y, window.innerHeight - tooltipHeight - gap));

    setUserCardTooltip({
      user,
      position: { x, y },
      transform: transform // Store transform for later use
    });
  };

  const closeUserCardTooltip = () => {
    setUserCardTooltip(null);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-[var(--color-background)] to-[var(--color-background-secondary)] flex font-sans gap-2 p-2 select-none relative">
      {/* Server Sidebar */}
      <div className="w-16 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col items-center py-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent backdrop-blur-sm">
        <div className="w-8 h-px bg-[#35373c] rounded mb-2"></div>

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
              <span className="text-white font-semibold text-lg bg-[var(--color-primary)] w-full h-full flex items-center justify-center rounded-2xl">
                {(serverInfo.server_name || 'S').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[#1e1f22] opacity-100"></div>
          </div>
        )}

        {/* Add Server Button */}
        <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#23a559] transition-all duration-200 cursor-pointer group mt-auto">
          <svg className="w-6 h-6 text-[#b5bac1] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      </div>

      {/* Channel Sidebar */}
      <div className="w-60 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col resize-x min-w-48 max-w-96 backdrop-blur-sm">
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
            </div>
          )}

          {/* Server Info Section */}
          <div className={`px-4 py-3 ${serverInfo?.banner_url ? 'relative' : 'border-b border-[var(--color-border)]'}`}>
            <div className="flex items-center justify-between">
              {/* Server Info */}
              <div className="min-w-0 flex-1">
                <h1 className="text-white font-bold text-base truncate" title={serverInfo?.server_name || 'Loading...'}>
                  {serverInfo?.server_name || 'Loading...'}
                </h1>
                <p className="text-gray-400 text-xs truncate">{serverInfo?.server_description}</p>
              </div>

              {/* Server Dropdown */}
              <div className="relative" ref={serverDropdownRef}>
                <button
                  onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-tertiary)] transition-all duration-200 group"
                  title="Server options"
                >
                  <svg
                    className={`w-4 h-4 text-gray-400 group-hover:text-white transition-colors ${serverDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {serverDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 bg-[var(--color-surface-secondary)]/95 backdrop-blur-md border border-[var(--color-border)] rounded-lg shadow-xl py-2 min-w-56 z-50">
                    {/* Server Actions */}
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          console.log('Server Info clicked');
                          setServerDropdownOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left transition-colors flex items-center space-x-3 text-gray-300 hover:bg-[var(--color-surface-tertiary)] hover:text-white cursor-pointer rounded-md"
                        title="View server information"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium">Server Info</span>
                      </button>

                      <button
                        onClick={() => {
                          const hasPermission = currentUser?.is_admin || currentUser?.is_owner || (currentUser?.roles?.includes('Admin')) || (currentUser?.roles?.includes('Moderator'));
                          if (hasPermission) {
                            setInviteModalOpen(true);
                            setServerDropdownOpen(false);
                          }
                        }}
                        disabled={!currentUser?.is_admin && !currentUser?.is_owner && !((currentUser?.roles || [])?.includes('Admin')) && !((currentUser?.roles || [])?.includes('Moderator'))}
                        className={`w-full px-3 py-2 text-left transition-colors flex items-center space-x-3 rounded-md ${((currentUser?.roles || [])?.includes?.('Admin') || (currentUser?.roles || [])?.includes?.('Moderator') || currentUser?.is_admin || currentUser?.is_owner)
                            ? 'text-gray-300 hover:bg-[var(--color-surface-tertiary)] hover:text-white cursor-pointer'
                            : 'text-gray-500 cursor-not-allowed opacity-60'
                          }`}
                        title={
                          ((currentUser?.roles || [])?.includes('Admin') || (currentUser?.roles || [])?.includes('Moderator') || currentUser?.is_admin || currentUser?.is_owner)
                            ? 'Create invite code'
                            : 'Only admins, moderators, and owners can create invite codes'
                        }
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-medium">Create Invite</span>
                      </button>

                      <Link
                        to="/control-panel"
                        onClick={(e) => {
                          const hasAccess = currentUser?.is_owner || currentUser?.roles?.includes('Owner') || currentUser?.is_admin || currentUser?.roles?.includes('Admin');
                          if (!hasAccess) {
                            e.preventDefault();
                          } else {
                            setServerDropdownOpen(false);
                          }
                        }}
                        className={`w-full px-3 py-2 text-left transition-colors flex items-center space-x-3 rounded-md ${(currentUser?.is_owner || currentUser?.roles?.includes('Owner') || currentUser?.is_admin || currentUser?.roles?.includes('Admin'))
                            ? 'text-gray-300 hover:bg-[var(--color-surface-tertiary)] hover:text-white cursor-pointer'
                            : 'text-gray-500 cursor-not-allowed opacity-60'
                          }`}
                        title={
                          (currentUser?.is_owner || currentUser?.roles?.includes('Owner') || currentUser?.is_admin || currentUser?.roles?.includes('Admin'))
                            ? 'Access server control panel'
                            : 'Only server admins and owners can access control panel'
                        }
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-medium">Control Panel</span>
                      </Link>

                      <button
                        onClick={() => {
                          const isOwner = currentUser?.is_owner || currentUser?.roles?.includes('Owner');
                          if (isOwner) {
                            const confirmed = window.confirm('Are you sure you want to delete this server? This action cannot be undone.');
                            if (confirmed) {
                              console.log('Delete Server confirmed');
                            }
                            setServerDropdownOpen(false);
                          }
                        }}
                        disabled={!currentUser?.is_owner && !currentUser?.roles?.includes('Owner')}
                        className={`w-full px-3 py-2 text-left transition-colors flex items-center space-x-3 rounded-md ${(currentUser?.is_owner || currentUser?.roles?.includes('Owner'))
                            ? 'text-red-300 hover:bg-red-900/20 hover:text-red-100 cursor-pointer'
                            : 'text-gray-500 cursor-not-allowed opacity-60'
                          }`}
                        title={
                          (currentUser?.is_owner || currentUser?.roles?.includes('Owner'))
                            ? 'Delete this server'
                            : 'Only server owner can delete the server'
                        }
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="text-sm font-medium">Delete Server</span>
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-[var(--color-border)] my-2"></div>

                    {/* Channel Actions */}
                    <div className="px-2 py-1">

                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          {channels.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2 text-gray-400">No channels available</p>
              <p className="text-gray-500">Ask a server admin to create some channels to get started.</p>
            </div>
          ) : (
            <>
              {/* Channels */}
              <div className="px-2 py-4">
                <div className="flex items-center px-2 mb-1">
                  <svg className="w-3 h-3 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Channels</span>
                </div>

                <div className="space-y-0.5">
                  {channels.map(channel => {
                    const hasDraft = getMessageDraft(channel.channel_id).trim().length > 0;

                    return (
                      <div
                        key={channel.channel_id}
                        className={`flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer ${selectedChannel?.channel_id === channel.channel_id ? 'bg-gray-600' : ''
                          }`}
                        onClick={() => handleChannelSelect(channel)}
                        onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                      >
                        <span className="text-gray-400 mr-2">#</span>
                        <span className="text-gray-400 text-sm break-words overflow-wrap-anywhere flex-1">{channel.channel_name}</span>
                        <div className="flex items-center ml-auto">
                          {hasDraft && (
                            <div className="flex items-center mr-1" title="Has unsent message">
                              <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </div>
                          )}
                          {channel.is_private && (
                            <svg className="w-4 h-4 text-gray-500 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* User Panel - Bottom of Channel Sidebar */}
        {currentUser && (
          <UserPanel
            username={currentUser.username || ''}
            avatar={currentUser.avatar || ''}
            status={currentUser.status === 'online' ? 'online' :
              currentUser.status === 'offline' ? 'offline' :
                currentUser.status === 'idle' ? 'idle' :
                  currentUser.status === 'dnd' ? 'dnd' :
                    'offline'}
            onClick={(e) => {
              // Show user card tooltip for current user
              const displayUser: DisplayUser = {
                id: currentUser.user_id,
                username: currentUser.username,
                avatar: currentUser.avatar,
                banner: undefined, // Could be extended from API later
                accentColor: currentUser.is_owner ? '#22d3ee' : currentUser.is_admin ? '#ef4444' : '#8b5cf6',
                bannerColor: currentUser.is_owner ? '#22d3ee' : currentUser.is_admin ? '#ef4444' : '#8b5cf6',
                customStatus: currentUser.is_owner ? 'Server Owner' : currentUser.is_admin ? 'Administrator' : 'Active Member',
                externalLinks: [],
                status: (currentUser.status === 'online' || currentUser.status === 'idle' || currentUser.status === 'dnd' || currentUser.status === 'offline')
                  ? currentUser.status as 'online' | 'idle' | 'dnd' | 'offline'
                  : 'offline',
                bio: `Member of ${serverInfo?.server_name || 'Pufferblow Server'} since ${new Date(currentUser.created_at).getFullYear()}. Passionate about decentralized technology.`,
                joinedAt: currentUser.created_at || currentUser.last_seen,
                originServer: (serverInfo?.server_name || 'Pufferblow Server') as string,
                roles: currentUser.is_owner ? ['Owner', 'Admin'] : currentUser.is_admin ? ['Admin'] : ['Member']
              } as DisplayUser;

              // Use actual click event for proper positioning
              showUserCardTooltip(displayUser, e);
            }}
            onSettingsClick={() => showToast("User settings clicked", 'success')}
            className="m-2 mt-auto"
          />
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] resize-x min-w-96 backdrop-blur-sm">
        {/* Channel Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
          <div className="flex items-center">
            <span className="text-[var(--color-text-secondary)] mr-2">#</span>
            <h2 className="text-[var(--color-text)] font-semibold">{selectedChannel?.channel_name || 'general'}</h2>
            <div className="ml-2 text-[var(--color-text-muted)] text-sm">Decentralized {selectedChannel?.channel_name || 'general'} discussion</div>
          </div>
          <div className="flex items-center space-x-4">
            <svg className="w-5 h-5 text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <svg className="w-5 h-5 text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <button
              onClick={() => setMembersListVisible(!membersListVisible)}
              className="w-5 h-5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors rounded-md hover:bg-[var(--color-hover)] p-1"
              title="Toggle member list"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
            <svg className="w-5 h-5 text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors rounded-md hover:bg-[var(--color-hover)] p-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </div>
        </div>

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 break-words"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="text-gray-500 text-sm">No messages yet</div>
                <div className="text-gray-600 text-xs mt-1">
                  {selectedChannel ? `This is the beginning of #${selectedChannel.channel_name}` : 'Select a channel to view messages'}
                </div>
              </div>
            </div>
          ) : (
            (() => {
              // Group messages by sender and time
              const messageGroups: Message[][] = [];
              let currentGroup: Message[] = [];

              messages.forEach((message, index) => {
                const messageTime = new Date(message.sent_at);

                if (currentGroup.length === 0) {
                  // Start a new group
                  currentGroup = [message];
                } else {
                  const prevMessageTime = new Date(currentGroup[currentGroup.length - 1].sent_at);
                  const timeDiff = (messageTime.getTime() - prevMessageTime.getTime()) / 1000; // seconds

                  // Continue group if same sender and within 30 seconds
                  if (message.sender_user_id === currentGroup[0].sender_user_id && timeDiff <= 30) {
                    currentGroup.push(message);
                  } else {
                    // Start a new group
                    messageGroups.push(currentGroup);
                    currentGroup = [message];
                  }
                }

                // Add the last group
                if (index === messages.length - 1) {
                  messageGroups.push(currentGroup);
                }
              });

              return messageGroups.map((group) => {
                const firstMessage = group[0];
                const messageTimestamp = new Date(firstMessage.sent_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const groupMessageIds = group.map(m => m.message_id);

                // Use username from injected message data (server-provided)
                const displayName = firstMessage.username || 'Unknown User';

                // Use avatar from injected message data (server-provided)
                const displayAvatar = firstMessage.sender_avatar_url || '/pufferblow-art-pixel-32x32.png';

                return (
                  <div
                    key={firstMessage.message_id}
                    className={`group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors ${firstMessage.sender_user_id === currentUser?.user_id
                        ? 'bg-blue-900/20 border-l-4 border-blue-500 hover:bg-blue-900/30'
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
                        onClick={(e) => handleUserClick(firstMessage.sender_user_id, displayName, e)}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {/* Username */}
                        <span
                          className="text-white font-medium select-text cursor-pointer hover:underline"
                          onClick={(e) => handleUserClick(firstMessage.sender_user_id, displayName, e)}
                        >
                          {displayName}
                        </span>
                        {/* Role badges using injected data */}
                        {firstMessage.sender_roles?.includes("owner") || firstMessage.sender_roles?.includes("Owner") ? (
                          <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">OWNER</span>
                        ) : firstMessage.sender_roles?.includes("admin") || firstMessage.sender_roles?.includes("Admin") ? (
                          <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                        ) : firstMessage.sender_roles?.includes("moderator") || firstMessage.sender_roles?.includes("Moderator") ? (
                          <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">MOD</span>
                        ) : null}
                        <span className="text-gray-400 text-xs select-text">{messageTimestamp}</span>
                      </div>
                      <div className="space-y-1">
                        {group.map((message) => (
                          <div key={message.message_id}>
                            <MarkdownRenderer content={message.message} className="text-gray-300" />

                            {/* Render attachments if they exist */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {message.attachments.map((attachment, index) => (
                                  <a
                                    key={index}
                                    href={attachment}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center space-x-2 px-3 py-1 bg-gray-700 rounded-lg border border-gray-600 hover:bg-gray-600 transition-colors text-sm text-gray-300 hover:text-white max-w-xs truncate"
                                    title="Attachment"
                                  >
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span className="truncate">Attachment {index + 1}</span>
                                  </a>
                                ))}
                              </div>
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
                          className="w-8 h-8 mr-2 bg-gray-600 hover:bg-gray-500 rounded flex items-center justify-center text-gray-300 hover:text-white transition-colors"
                          title="More options"
                        >
                          ⋯
                        </button>
                      </div>
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* Message Input */}
        <div className="p-4">
          {/* Attachments Preview */}
          {messageAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {messageAttachments.map((file, index) => (
                <div
                  key={index}
                  className="relative bg-gray-700 rounded-lg p-3 border border-gray-600 group hover:border-gray-500 transition-colors"
                >
                  {/* File content preview */}
                  {file.type.startsWith('image/') ? (
                    <div className="flex flex-col items-center space-y-2">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="max-w-24 max-h-24 object-cover rounded"
                      />
                      <div className="text-center">
                        <p className="text-xs text-white font-medium truncate max-w-24" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(file.size / (1024 * 1024)).toFixed(1)}MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2 text-center">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-xs text-white font-medium truncate max-w-24" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(file.size / (1024 * 1024)).toFixed(1)}MB • {file.type || 'Unknown type'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
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
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          )}

          <div
            ref={messageInputBarRef}
            className={`bg-gray-600 rounded-lg px-4 py-2 transition-opacity ${!selectedChannel ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex items-end space-x-3">
              {/* File Upload Button */}
              <label className="flex-shrink-0">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={!selectedChannel}
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx"
                />
                <button
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-500 transition-colors text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selectedChannel}
                  title="Upload file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              </label>

              {/* Message Input */}
              <div className="flex-1 min-h-0">
                <textarea
                  ref={messageInputRef}
                  value={messageInput}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setMessageInput(newValue);
                    // Save draft when typing if we have a selected channel
                    if (selectedChannel) {
                      setMessageDraft(selectedChannel.channel_id, newValue);
                    }
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder={selectedChannel ? `Message #${selectedChannel.channel_name}` : 'Select a channel to start messaging'}
                  disabled={!selectedChannel}
                  className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none resize-none h-6 break-words overflow-wrap-anywhere disabled:opacity-50 disabled:cursor-not-allowed"
                  rows={1}
                />
              </div>

              {/* Emoji Button */}
              <button
                onClick={handleEmojiClick}
                disabled={!selectedChannel}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isEmojiPickerOpen
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-500 text-gray-400 hover:text-white'
                  }`}
                title="Add emoji"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H13m-3 3.5a.5.5 0 11-1 0 .5.5 0 011 0zM16 7a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>

              {/* Send Button - Only show when message has content */}
              {messageInput.trim() && selectedChannel && (
                <button
                  onClick={handleSendMessage}
                  className="w-8 h-8 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 animate-in slide-in-from-left-4 fade-in"
                  title="Send message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              )}
            </div>
          </div>



          {/* Emoji Picker */}
          <EmojiPicker
            isOpen={isEmojiPickerOpen}
            position={emojiPickerPosition}
            onClose={() => setIsEmojiPickerOpen(false)}
            onEmojiSelect={handleEmojiSelect}
            onGifSelect={handleGifSelect}
          />
        </div>
      </div>

      {/* Member List */}
      <div className={`transition-all duration-300 ease-in-out ${membersListVisible ? 'w-60 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="w-60 h-full bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col">
          {/* Header with close button */}
          <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Members</h3>
            <button
              onClick={() => setMembersListVisible(false)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-surface-secondary)] transition-colors"
              title="Close member list"
            >
              <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Members Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent">
            <div className="p-4 space-y-4">
              {(() => {
                // Group users by role
                const owners = users.filter(user => user.is_owner);
                const admins = users.filter(user => user.is_admin && !user.is_owner);
                const moderators: typeof users = []; // No moderator role defined in API
                const members = users.filter(user => !user.is_owner && !user.is_admin);

                const renderUserGroup = (title: string, userList: typeof users, roleColor: string, roleLabel: string) => {
                  if (userList.length === 0) return null;

                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 bg-[var(--color-surface-tertiary)] px-2 py-1 rounded border border-[var(--color-border)]">
                        {title} — {userList.length}
                      </h4>
                      <div className="space-y-1">
                        {userList.map(user => (
                          <div
                            key={user.user_id}
                            className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:rounded-lg hover:bg-gradient-to-r hover:from-[var(--color-surface-secondary)] hover:to-[var(--color-surface-tertiary)] cursor-pointer shadow-sm hover:shadow-md transform hover:scale-102 transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-primary)]"
                            onClick={(e) => handleUserClick(user.user_id, user.username, e)}
                          >
                            <div className="relative">
                              <img
                                src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=5865f2`}
                                alt={user.username}
                                className="w-8 h-8 rounded-full shadow-md border-2 border-green-300"
                              />
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-surface)] shadow-sm ${user.status === 'online' ? 'bg-green-400' :
                                  user.status === 'idle' ? 'bg-yellow-400' :
                                    user.status === 'dnd' ? 'bg-red-400' :
                                      'bg-gray-400'
                                }`}></div>
                            </div>
                            <div className="flex items-center space-x-2 flex-1">
                              <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text truncate">{user.username}</span>
                              {user.is_owner && (
                                <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">OWNER</span>
                              )}
                              {user.is_admin && !user.is_owner && (
                                <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {renderUserGroup("Owner", owners, "red-300", "OWNER")}
                    {renderUserGroup("Admin", admins, "red-300", "ADMIN")}
                    {renderUserGroup("Moderators", moderators, "purple-300", "MOD")}
                    {renderUserGroup("Members", members, "green-300", "MEMBER")}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>



      {/* Modals */}
      <ServerCreationModal
        isOpen={serverCreationModalOpen}
        onClose={() => setServerCreationModalOpen(false)}
        onCreateServer={handleCreateServer}
      />

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

      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        serverName={serverInfo?.server_name || 'General Server'}
        onGenerateInvite={handleGenerateInvite}
        onCopyInvite={handleCopyInvite}
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

          setEmojiPickerPosition({ x, y });
          setIsEmojiPickerOpen(true);
          setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 } }); // Close context menu
        }}
        onCopyLink={() => handleMessageCopy(currentMenuMessageId)}
        onReport={() => handleMessageReport(currentMenuMessageId)}
      />

      <UserContextMenu
        isOpen={userContextMenu.isOpen}
        position={userContextMenu.position}
        onClose={() => setUserContextMenu({ isOpen: false, position: { x: 0, y: 0 } })}
      />

      {/* Channel Context Menu for Deletion */}
      {channelContextMenu.isOpen && channelContextMenu.channel && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 w-48"
          style={{
            left: Math.min(channelContextMenu.position.x, window.innerWidth - 200),
            top: Math.min(channelContextMenu.position.y, window.innerHeight - 100),
          }}
        >
          <button
            onClick={() => {
              setChannelDeleteConfirm({ isOpen: true, channel: channelContextMenu.channel });
              setChannelContextMenu({ isOpen: false, position: { x: 0, y: 0 }, channel: null });
            }}
            className="w-full px-3 py-2 text-left text-sm flex items-center text-red-400 hover:bg-red-900 hover:bg-opacity-20 transition-colors"
          >
            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete Channel</span>
          </button>
        </div>
      )}

      {/* Channel Deletion Confirmation Modal */}
      {channelDeleteConfirm.isOpen && channelDeleteConfirm.channel && (
        <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white">Delete Channel</h3>
            </div>
            <div className="mb-6">
              <p className="text-gray-300 mb-2">
                Are you sure you want to delete <span className="font-semibold text-white">#{channelDeleteConfirm.channel.channel_name}</span>?
              </p>
              <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded">
                ⚠️ This action cannot be undone. All messages in this channel will be permanently deleted.
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setChannelDeleteConfirm({ isOpen: false, channel: null })}
                className="px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const authToken = getAuthTokenFromCookies() || '';
                  const channel = channelDeleteConfirm.channel;
                  if (!authToken || !channel) return;

                  // Call delete API
                  deleteChannel(channel.channel_id, authToken).then(async (response) => {
                    if (response.success) {
                      logger.ui.info("Channel deleted successfully from dashboard", {
                        channelId: channel.channel_id,
                        channelName: channel.channel_name
                      });

                      // Show success toast
                      showToast(`Channel #${channel.channel_name} deleted successfully!`, 'success');

                      // Refresh channels list
                      try {
                        const listResponse = await listChannels(authToken);
                        if (listResponse.success && listResponse.data?.channels) {
                          setChannels(listResponse.data.channels);
                        }
                      } catch (error) {
                        console.error("Failed to refresh channels after deletion:", error);
                      }
                    } else {
                      console.error("Failed to delete channel:", response.error);
                      showToast(`Failed to delete channel: ${response.error || 'Unknown error'}`, 'error');
                    }
                  }).catch((error) => {
                    console.error("Error deleting channel:", error);
                    showToast('An unexpected error occurred while deleting the channel.', 'error');
                  });

                  setChannelDeleteConfirm({ isOpen: false, channel: null });
                }}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}

      <MessageReportModal
        isOpen={messageReportModal.isOpen}
        onClose={() => setMessageReportModal({ isOpen: false, messages: [] })}
        onSubmit={handleMessageReportSubmit}
        messageCount={messageReportModal.messages.length}
      />

      {/* User Card Tooltip */}
      {userCardTooltip && (
        <div
          className="fixed rounded-xl shadow-2xl z-50 pointer-events-auto"
          style={{
            left: userCardTooltip.position.x,
            top: userCardTooltip.position.y,
            transform: userCardTooltip.transform || 'translate(0, 0)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <UserCard
            username={userCardTooltip.user.username || 'Unknown User'}
            bio={userCardTooltip.user.bio || 'No bio available'}
            roles={userCardTooltip.user.roles as any}
            originServer={userCardTooltip.user.originServer || serverInfo?.server_name || 'Loading...'}
            avatarUrl={userCardTooltip.user.avatar}
            backgroundUrl={userCardTooltip.user.banner}
            status={userCardTooltip.user.status === 'online' ? 'active' :
              userCardTooltip.user.status === 'idle' ? 'idle' :
                userCardTooltip.user.status === 'dnd' ? 'dnd' : 'offline'}
            activity={userCardTooltip.user.activity || {
              type: Math.random() > 0.5 ? 'listening' : 'playing',
              name: Math.random() > 0.5 ? 'Spotify' : 'Visual Studio Code',
              details: Math.random() > 0.5 ? 'Symphony No. 9 in D minor, Op. 125' : 'Working on pufferblow-client'
            }}
            mutualServers={userCardTooltip.user.mutualServers || Math.floor(Math.random() * 15) + 1}
            mutualFriends={userCardTooltip.user.mutualFriends || Math.floor(Math.random() * 25) + 1}
            badges={userCardTooltip.user.badges || ['Developer', 'Early Supporter'].slice(0, Math.floor(Math.random() * 3))}
            customStatus={userCardTooltip.user.customStatus}
            accentColor={userCardTooltip.user.accentColor || '#5865f2'}
            bannerColor={userCardTooltip.user.bannerColor}
            externalLinks={userCardTooltip.user.externalLinks || []}
            joinDate={userCardTooltip.user.joinedAt ? new Date(userCardTooltip.user.joinedAt).toISOString().split('T')[0] : undefined}
            showOnlineIndicator={true}
            isCompact={false}
          />
        </div>
      )}
    </div>
  );
}
