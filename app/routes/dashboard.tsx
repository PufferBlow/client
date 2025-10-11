import type { Route } from "./+types/dashboard";
import { Link, redirect } from "react-router";
import { useState, useEffect, useRef } from "react";
import { ServerCreationModal } from "../components/ServerCreationModal";
import { ChannelCreationModal } from "../components/ChannelCreationModal";
import { UserProfileModal } from "../components/UserProfileModal";
import { MessageContextMenu } from "../components/MessageContextMenu";
import { UserContextMenu } from "../components/UserContextMenu";
import { SearchModal } from "../components/SearchModal";
import { InviteModal } from "../components/InviteModal";
import { EmojiPicker } from "../components/EmojiPicker";
import { UserCard } from "../components/UserCard";
import { UserPanel } from "../components/UserPanel";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { MessageReportModal } from "../components/MessageReportModal";
import { validateMessageInput } from "../utils/markdown";
import { logger } from "../utils/logger";
import { usePersistedUIState } from "../utils/uiStatePersistence";
import { getAuthTokenFromCookies, getHostPortFromCookies, useCurrentUserProfile, useActivityTracker, getUserProfileById } from "../services/user";
import { listChannels, createChannel, loadMessages, sendMessage, deleteChannel } from "../services/channel";
import { listUsers, type ListUsersResponse } from "../services/user";
import type { Channel } from "../models";
import type { Message } from "../models";
import type { User } from "../models";

interface DisplayUser {
  id: string;
  username: string;
  avatar?: string;
  status: 'online' | 'idle' | 'offline' | 'dnd';
  bio?: string;
  joinedAt: string;
  roles: string[];
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Pufferblow - Decentralized Messaging" },
    { name: "description", content: "Discord-like messaging with decentralized servers" },
  ];
}

export async function loader() {
  // Authentication check moved to component to work with SSR
  return null;
}

export default function Dashboard() {
  // React Query hooks for user authentication and data
  const { data: currentUser, isLoading: userLoading, error: userError } = useCurrentUserProfile();
  const { recordActivity } = useActivityTracker();

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
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [selectedUserProfileModalOpen, setSelectedUserProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DisplayUser | null>(null);
  const [selectedUserPosition, setSelectedUserPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedUserTriggerRect, setSelectedUserTriggerRect] = useState<DOMRect | null>(null);
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
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [membersListVisible, setMembersListVisible] = useState(false);
  const [userContextMenu, setUserContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });
  const [channelContextMenu, setChannelContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number }; channel: Channel | null }>({ isOpen: false, position: { x: 0, y: 0 }, channel: null });
  const [channelDeleteConfirm, setChannelDeleteConfirm] = useState<{ isOpen: boolean; channel: Channel | null }>({ isOpen: false, channel: null });
  const [successToast, setSuccessToast] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
  const [messageReportModal, setMessageReportModal] = useState<{ isOpen: boolean; messages: string[] }>({ isOpen: false, messages: [] });
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<ListUsersResponse['users']>([]);
  const [messageInput, setMessageInput] = useState(() => {
    // Initialize with persisted draft if we have a selected channel
    if (persistedChannelId) {
      return getMessageDraft(persistedChannelId);
    }
    return '';
  });
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 });
  const [maxMessageLength, setMaxMessageLength] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pufferblow-max-message-length');
      return saved ? parseInt(saved) : 4000;
    }
    return 4000; // Default value for SSR
  });
  const [messageTooLongAlert, setMessageTooLongAlert] = useState<string | null>(null);
  const messageInputBarRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const serverDropdownRef = useRef<HTMLDivElement>(null);
  const [cachedTextareaHeight, setCachedTextareaHeight] = useState<number>(24);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle authentication redirects
  if (userError?.message?.includes('No authentication token')) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
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

  // Fetch channels and users on mount
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

    if (currentUser) {
      fetchChannels();
      fetchUsers();
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

  // Function to fetch and cache user profiles
  const getUserProfile = async (userId: string) => {
    if (userProfiles[userId]) {
      return userProfiles[userId];
    }

    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        console.error('No auth token available for user profile fetch');
        return null;
      }

      const response = await getUserProfileById(userId, authToken);
      if (response.success && response.data?.user_data) {
        const userData = response.data.user_data;

        // Create user profile object
        const userProfile = {
          id: userData.user_id,
          username: userData.username,
          avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(userData.username)}&backgroundColor=5865f2`,
          status: (userData.status === 'online' || userData.status === 'idle' || userData.status === 'dnd' || userData.status === 'offline')
            ? userData.status === 'dnd' ? 'offline' : userData.status as 'online' | 'idle' | 'dnd' | 'offline'
            : 'offline',
          roles: userData.is_owner ? ['Owner', 'Admin'] :
                 userData.is_admin ? ['Admin'] : ['Member']
        };

        // Cache the profile
        setUserProfiles(prev => ({
          ...prev,
          [userId]: userProfile
        }));

        return userProfile;
      } else {
        console.error('Failed to fetch user profile:', userId, response.error);

        // Return fallback user data
        const fallbackUser = {
          id: userId,
          username: 'Unknown User',
          avatar: '/pufferblow-art-pixel-32x32.png',
          status: 'offline' as const,
          roles: ['Member']
        };

        setUserProfiles(prev => ({
          ...prev,
          [userId]: fallbackUser
        }));

        return fallbackUser;
      }
    } catch (error) {
      console.error('Error fetching user profile:', userId, error);

      // Return fallback user data
      const fallbackUser = {
        id: userId,
        username: 'Unknown User',
        avatar: '/pufferblow-art-pixel-32x32.png',
        status: 'offline' as const,
        roles: ['Member']
      };

      setUserProfiles(prev => ({
        ...prev,
        [userId]: fallbackUser
      }));

      return fallbackUser;
    }
  };

  // Load user profiles for current messages
  useEffect(() => {
    const loadUserProfilesForMessages = async () => {
      if (!messages.length) return;

      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) return;

      const uniqueSenderIds = [...new Set(messages.map(m => m.sender_user_id))];
      const profilesToLoad = uniqueSenderIds.filter(id => !userProfiles[id]);

      if (profilesToLoad.length > 0) {
        console.log('Loading user profiles for messages:', profilesToLoad.length, 'profiles');
        await Promise.all(profilesToLoad.map(id => getUserProfile(id)));
      }
    };

    loadUserProfilesForMessages();
  }, [messages, userProfiles]);

  // Auto-hide message too long alert after 5 seconds
  useEffect(() => {
    if (messageTooLongAlert) {
      const timeout = setTimeout(() => {
        setMessageTooLongAlert(null);
      }, 3000); // 3 seconds

      return () => clearTimeout(timeout);
    }
  }, [messageTooLongAlert]);

  // Show skeleton loading state
  if (userLoading) {
    return (
      <div className="h-screen bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none relative animate-pulse">
        {/* Server Sidebar Skeleton */}
        <div className="w-16 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col items-center py-3 space-y-2">
          {/* Pufferblow Logo */}
          <div className="w-12 h-12 bg-gray-600 rounded-2xl flex items-center justify-center mb-2">
            <div className="w-6 h-6 bg-gray-500 rounded"></div>
          </div>
          <div className="w-8 h-px bg-gray-600 rounded"></div>
          {/* Server Icons */}
          <div className="w-12 h-12 bg-gray-700 rounded-2xl"></div>
          <div className="w-12 h-12 bg-gray-700 rounded-2xl"></div>
          <div className="w-12 h-12 bg-gray-700 rounded-2xl"></div>
          <div className="w-12 h-12 bg-gray-700 rounded-2xl"></div>
        </div>

        {/* Channel Sidebar Skeleton */}
        <div className="w-60 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col">
          <div className="h-12 px-4 bg-gray-700 rounded-t-xl"></div>
          <div className="flex-1 p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                <div className="flex-1 h-4 bg-gray-600 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area Skeleton */}
        <div className="flex-1 flex flex-col bg-gray-800 rounded-xl shadow-lg border border-gray-600">
          <div className="h-12 bg-gray-700 rounded-t-xl"></div>
          <div className="flex-1 p-4 space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gray-600 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-4 bg-gray-600 rounded"></div>
                    <div className="w-16 h-3 bg-gray-700 rounded"></div>
                  </div>
                  <div className="space-y-1">
                    <div className="w-full h-3 bg-gray-600 rounded"></div>
                    <div className="w-3/4 h-3 bg-gray-600 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-600">
            <div className="bg-gray-600 rounded-lg px-4 py-3 h-12"></div>
          </div>
        </div>

        {/* Member List Skeleton */}
        <div className="w-60 opacity-25">
          <div className="w-60 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="w-16 h-4 bg-gray-700 rounded"></div>
              <div className="w-4 h-4 bg-gray-700 rounded"></div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <div className="w-full h-4 bg-gray-700 rounded mb-2"></div>
                <div className="flex items-center space-x-3 px-3 py-2">
                  <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                  <div className="flex-1 space-y-1">
                    <div className="w-12 h-3 bg-gray-600 rounded"></div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="w-full h-4 bg-gray-700 rounded mb-2"></div>
                <div className="flex items-center space-x-3 px-3 py-2">
                  <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                  <div className="flex-1 space-y-1">
                    <div className="w-12 h-3 bg-gray-600 rounded"></div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="w-full h-4 bg-gray-700 rounded mb-2"></div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 px-3 py-2">
                    <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                    <div className="flex-1 space-y-1">
                      <div className="w-16 h-3 bg-gray-600 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
        setSuccessToast({ isOpen: true, message: `Channel #${channelData.name} created successfully!` });
        setTimeout(() => setSuccessToast({ isOpen: false, message: '' }), 3000);

        // Refresh channels list
        const channelsResponse = await listChannels(authToken);
        if (channelsResponse.success && channelsResponse.data) {
          setChannels(channelsResponse.data.channels);
        }

        // Close modal
        setChannelCreationModalOpen(false);
      } else {
        // Handle specific error codes
        if (response.error?.includes('409') || response.error?.includes('Channel name already exists')) {
          alert('Channel name already exists, please choose a different name.');
        } else if (response.error?.includes('403') || response.error?.includes('Access forbidden')) {
          alert('Access forbidden. Only admins can create channels and manage them.');
        } else {
          alert(`Failed to create channel: ${response.error || 'Unknown error'}`);
        }
        logger.ui.error("Failed to create channel", { error: response.error, channelData });
      }
    } catch (error) {
      alert('An unexpected error occurred while creating the channel.');
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
    navigator.clipboard.writeText(`https://pufferblow.app/invite/${inviteCode}`);
    logger.ui.info("Invite link copied to clipboard", { inviteCode: "[REDACTED]" });
  };

  // Message action handlers
  const handleMessageReply = (messageId: string) => {
    console.log("Reply to message:", messageId);
    // TODO: Implement reply functionality
  };

  const handleMessageReact = (messageId: string) => {
    console.log("Add reaction to message:", messageId);
    // TODO: Implement reaction functionality
  };

  const handleMessageReport = (messageId: string) => {
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
    setSuccessToast({
      isOpen: true,
      message: `Report submitted successfully. Thank you for helping keep our community safe!`
    });
    setTimeout(() => setSuccessToast({ isOpen: false, message: '' }), 4000);

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
        alert(`${messageIds.length} message IDs copied to clipboard!`);
      } catch (error) {
        logger.ui.error("Failed to copy message group IDs to clipboard", { error });
        alert("Failed to copy message IDs to clipboard. Please try again.");
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

  const handleMessageCopy = async (messageId: string) => {
    try {
      await navigator.clipboard.writeText(messageId);
      logger.ui.info("Message ID copied to clipboard", { messageId: "[REDACTED]" });
      alert("Message ID copied to clipboard!");
    } catch (error) {
      logger.ui.error("Failed to copy message ID to clipboard", { error });
      alert("Failed to copy message ID to clipboard. Please try again.");
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
      alert("User ID copied to clipboard!");
    } catch (error) {
      logger.ui.error("Failed to copy user ID to clipboard", { error });
      alert("Failed to copy user ID to clipboard. Please try again.");
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

    setSelectedChannel(channel);

    // Persist the selected channel
    persistSelectedChannel(channel.channel_id);

    // Restore message draft for the new channel
    const restoredDraft = getMessageDraft(channel.channel_id);
    setMessageInput(restoredDraft);

    // Load messages for the selected channel
    const authToken = getAuthTokenFromCookies() || '';
    console.log("Loading messages - authToken:", authToken ? 'exists' : 'missing', "channel_id:", channel.channel_id);

    if (authToken && channel.channel_id) {
      console.log("Making loadMessages API call...");
      const response = await loadMessages(channel.channel_id, authToken);
      console.log("loadMessages response:", response);

      if (response.success && response.data && response.data.messages) {
        setMessages(response.data.messages);
        logger.ui.info("Messages loaded successfully", { channelId: channel.channel_id, count: response.data.messages.length });
        console.log("Messages set:", response.data.messages.length, "messages");
      } else {
        console.error("Failed to load messages:", response.error);
        logger.ui.error("Failed to load messages", { channelId: channel.channel_id, error: response.error });
        setMessages([]); // Clear messages if failed
      }
    } else {
      console.log("Not loading messages - missing authToken or channel_id");
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
    if (currentUser?.roles?.includes('Owner') || currentUser?.is_owner) {
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
    if (trimmedMessage) {
      // Validate message for security and length
      const validationResult = validateMessageInput(trimmedMessage, maxMessageLength);
      if (!validationResult.isValid) {
        setMessageTooLongAlert(validationResult.error || 'Invalid message content');
        return;
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
          authToken: authToken.substring(0, 20) + '...'
        });

        const response = await sendMessage(selectedChannel.channel_id, trimmedMessage, authToken);
        console.log('Send message response:', response);

        if (response.success) {
          logger.ui.info("Message sent successfully", {
            channelId: selectedChannel.channel_id,
            messageLength: messageInput.length
          });

          // Clear input and draft
          setMessageInput('');
          if (selectedChannel) {
            clearMessageDraft(selectedChannel.channel_id);
          }

          // Refresh messages list
          const messagesResponse = await loadMessages(selectedChannel.channel_id, authToken);
          console.log('Refresh messages response:', messagesResponse);

          if (messagesResponse.success && messagesResponse.data && messagesResponse.data.messages) {
            setMessages(messagesResponse.data.messages);
            logger.ui.info("Messages refreshed after sending");
          } else {
            logger.ui.error("Failed to refresh messages after sending", { error: messagesResponse.error });
          }
        } else {
          logger.ui.error("Failed to send message", { error: response.error });
          alert(`Failed to send message: ${response.error || 'Unknown error'}`);
        }
      } catch (error) {
        logger.ui.error("Unexpected error sending message", { error });
        alert('An unexpected error occurred while sending the message.');
      }
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

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension && dangerousExtensions.includes(extension)) {
        logger.ui.warn("Rejected dangerous file upload", {
          fileName: file.name,
          extension,
          reason: "potentially exploitable file type"
        });
        alert(`File "${file.name}" cannot be uploaded. This file type is not allowed for security reasons.`);
        event.target.value = ''; // Clear the input
        return;
      }

      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        logger.ui.warn("Rejected large file upload", {
          fileName: file.name,
          fileSize: file.size,
          maxSize
        });
        alert(`File "${file.name}" is too large. Maximum file size is 10MB.`);
        event.target.value = '';
        return;
      }
    }

    logger.ui.info("File(s) selected for upload", {
      count: files.length,
      fileNames: Array.from(files).map(f => f.name)
    });
    // TODO: Implement file upload
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

    // If it's the current user, use their profile
    if (currentUser && userId === currentUser.user_id) {
      setUserProfileModalOpen(true);
      return;
    }

    // Calculate position next to the clicked element with viewport bounds checking
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const modalWidth = 320; // Approximate width of the modal
    const modalHeight = 400; // Approximate height of the modal
    const gap = 8;

    // Check if there's enough space to the right
    const spaceToRight = window.innerWidth - rect.right;
    const spaceToLeft = rect.left;

    let modalX: number;
    let modalY: number;

    // Position horizontally: prefer right, fallback to left
    if (spaceToRight >= modalWidth + gap) {
      modalX = rect.right + gap;
    } else if (spaceToLeft >= modalWidth + gap) {
      modalX = rect.left - modalWidth - gap;
    } else {
      // Center if neither side has enough space
      modalX = Math.max(gap, (window.innerWidth - modalWidth) / 2);
    }

    // Position vertically: align with top of element, but ensure modal stays in viewport
    modalY = rect.top;

    // Adjust if modal would go off-screen vertically
    if (modalY + modalHeight > window.innerHeight) {
      modalY = window.innerHeight - modalHeight - gap;
    }
    if (modalY < gap) {
      modalY = gap;
    }

    // Get cached user profile or load it
    const userInfo = userProfiles[userId];
    if (userInfo) {
      // Use cached profile
      const displayUser: DisplayUser = {
        id: userInfo.id,
        username: userInfo.username || '',
        avatar: userInfo.avatar,
        status: (userInfo.status === 'online' || userInfo.status === 'idle' || userInfo.status === 'offline' || userInfo.status === 'dnd')
          ? userInfo.status as 'online' | 'idle' | 'offline' | 'dnd'
          : 'offline',
        bio: userInfo.bio || '',
        joinedAt: userInfo.created_at || '',
        roles: userInfo.roles || []
      };

      setSelectedUser(displayUser);
      setSelectedUserPosition({ x: modalX, y: modalY });
      setSelectedUserTriggerRect(rect);
      setSelectedUserProfileModalOpen(true);
    } else {
      // Load profile if not cached
      const profile = await getUserProfile(userId);
      if (profile) {
        const displayUser: DisplayUser = {
          id: profile.id,
          username: profile.username || '',
          avatar: profile.avatar,
          status: (profile.status === 'online' || profile.status === 'idle' || profile.status === 'offline' || profile.status === 'dnd')
            ? profile.status as 'online' | 'idle' | 'offline' | 'dnd'
            : 'offline',
          bio: profile.bio || '',
          joinedAt: profile.created_at || '',
          roles: profile.roles || []
        };

        setSelectedUser(displayUser);
        setSelectedUserPosition({ x: modalX, y: modalY });
        setSelectedUserTriggerRect(rect);
        setSelectedUserProfileModalOpen(true);
      }
    }
  };

  return (
    <div className="h-screen bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none relative">
      {/* Server Sidebar */}
      <div className="w-16 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col items-center py-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent">
        {/* Pufferblow Logo */}
        <div className="w-12 h-12 bg-[#5865f2] rounded-2xl flex items-center justify-center mb-2 hover:rounded-xl hover:bg-[#4752c4] transition-all duration-200 cursor-pointer group relative">
          <img
            src="/pufferblow-art-pixel-32x32.png"
            alt="Pufferblow"
            className="w-8 h-8"
          />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[#1e1f22] opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>

        <div className="w-8 h-px bg-[#35373c] rounded"></div>

        {/* Server Icons */}
        <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#404eed] transition-all duration-200 cursor-pointer group relative">
          <span className="text-white font-semibold text-lg">G</span>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[#1e1f22] opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
        <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#22c55e] transition-all duration-200 cursor-pointer group relative">
          <span className="text-white font-semibold text-lg">D</span>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#f59e0b] rounded-full border-2 border-[#1e1f22] opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
        <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#ef4444] transition-all duration-200 cursor-pointer group relative">
          <span className="text-white font-semibold text-lg">T</span>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[#1e1f22] opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>

        {/* Add Server Button */}
        <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#23a559] transition-all duration-200 cursor-pointer group">
          <svg className="w-6 h-6 text-[#b5bac1] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      </div>

      {/* Channel Sidebar */}
      <div className="w-60 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col resize-x min-w-48 max-w-96">
        {/* Server Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-gray-800 shadow-sm relative">
          <h1 className="text-white font-semibold">General Server</h1>
          <div ref={serverDropdownRef}>
            <button
              onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
              className="w-4 h-4 text-gray-400 cursor-pointer hover:text-white transition-colors"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {serverDropdownOpen && (
              <div className="absolute right-0 top-12 bg-gray-800/80 backdrop-blur-md border border-gray-700 rounded-lg shadow-lg py-1 min-w-48 z-50">
                <button
                  onClick={() => {
                    // TODO: Open server info modal/page
                    console.log('Server Info clicked');
                    setServerDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left transition-colors flex items-center space-x-2 text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer"
                  title="View server information"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Server Info</span>
                </button>

                <button
                  onClick={() => {
                    const hasPermission = currentUser?.is_admin || currentUser?.is_owner || (currentUser?.roles?.includes('Admin')) || (currentUser?.roles?.includes('Moderator'));
                    if (hasPermission) {
                      setInviteModalOpen(true);
                      setServerDropdownOpen(false);
                    }
                  }}
                  disabled={!currentUser?.is_admin && !currentUser?.is_owner && !(currentUser?.roles?.includes('Admin')) && !(currentUser?.roles?.includes('Moderator'))}
                    className={`w-full px-3 py-2 text-left transition-colors flex items-center space-x-2 ${
                      (currentUser?.roles?.includes?.('Admin') || currentUser?.roles?.includes?.('Moderator') || currentUser?.is_admin || currentUser?.is_owner)
                        ? 'text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer'
                        : 'text-gray-500 cursor-not-allowed opacity-60'
                    }`}
                  title={
                    (currentUser?.roles?.includes('Admin') || currentUser?.roles?.includes('Moderator') || currentUser?.is_admin || currentUser?.is_owner)
                      ? 'Create invite code'
                      : 'Only admins, moderators, and owners can create invite codes'
                  }
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Create Invite Code</span>
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
                  className={`w-full px-3 py-2 text-left transition-colors flex items-center space-x-2 ${
                    (currentUser?.is_owner || currentUser?.roles?.includes('Owner') || currentUser?.is_admin || currentUser?.roles?.includes('Admin'))
                      ? 'text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer'
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
                  <span>Control Panel</span>
                </Link>

                <button
                  onClick={() => {
                    const isOwner = currentUser?.is_owner || currentUser?.roles?.includes('Owner');
                    if (isOwner) {
                      // TODO: Implement delete server confirmation
                      const confirmed = window.confirm('Are you sure you want to delete this server? This action cannot be undone.');
                      if (confirmed) {
                        console.log('Delete Server confirmed');
                      }
                      setServerDropdownOpen(false);
                    }
                  }}
                  disabled={!currentUser?.is_owner && !currentUser?.roles?.includes('Owner')}
                  className={`w-full px-3 py-2 text-left transition-colors flex items-center space-x-2 ${
                    (currentUser?.is_owner || currentUser?.roles?.includes('Owner'))
                      ? 'text-red-300 hover:bg-red-900 hover:text-red-100 cursor-pointer'
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
                  <span>Delete Server</span>
                </button>

                <div className="border-t border-gray-700 my-1"></div>

                <button
                  onClick={() => {
                    const hasPermission = currentUser?.roles.includes('Admin') || currentUser?.roles.includes('Moderator');
                    if (hasPermission) {
                      setChannelCreationModalOpen(true);
                      setServerDropdownOpen(false);
                    }
                  }}
                  disabled={!(currentUser?.roles.includes('Admin') || currentUser?.roles.includes('Moderator'))}
                  className={`w-full px-3 py-2 text-left transition-colors flex items-center space-x-2 ${
                    currentUser?.roles.includes('Admin') || currentUser?.roles.includes('Moderator')
                      ? 'text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer'
                      : 'text-gray-500 cursor-not-allowed opacity-60'
                  }`}
                  title={
                    currentUser?.roles.includes('Admin') || currentUser?.roles.includes('Moderator')
                      ? 'Create a new channel'
                      : 'Only admins and moderators can create channels'
                  }
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Create Channel</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          {channels.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-gray-400 text-sm">No channels</div>
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
                        className={`flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer ${
                          selectedChannel?.channel_id === channel.channel_id ? 'bg-gray-600' : ''
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
            onClick={() => setUserProfileModalOpen(true)}
            onSettingsClick={() => setUserProfileModalOpen(true)}
            className="m-2 mt-auto"
          />
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-800 rounded-xl shadow-lg border border-gray-600 resize-x min-w-96">
        {/* Channel Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-gray-700 bg-gray-800">
          <div className="flex items-center">
            <span className="text-gray-400 mr-2">#</span>
            <h2 className="text-white font-semibold">{selectedChannel?.channel_name || 'general'}</h2>
            <div className="ml-2 text-gray-400 text-sm">Decentralized {selectedChannel?.channel_name || 'general'} discussion</div>
          </div>
          <div className="flex items-center space-x-4">
            <svg className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <svg className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <button
              onClick={() => setMembersListVisible(!membersListVisible)}
              className="w-5 h-5 text-gray-400 hover:text-white transition-colors"
              title="Toggle member list"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
            <svg className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                  // Continue group if same sender and within 20 seconds
                  if (message.sender_user_id === currentGroup[0].sender_user_id && timeDiff <= 20) {
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
                const userInfo = userProfiles[firstMessage.sender_user_id];
                const messageTimestamp = new Date(firstMessage.sent_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const groupMessageIds = group.map(m => m.message_id);

                // Show loading state while fetching user info
                if (!userInfo) {
                  return (
                    <div
                      key={firstMessage.message_id}
                      className={`group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors ${
                        firstMessage.sender_user_id === currentUser?.user_id
                          ? 'bg-blue-900/20 border-l-4 border-blue-500 hover:bg-blue-900/30'
                          : ''
                      }`}
                    >
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex-shrink-0 animate-pulse"></div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-20 h-4 bg-gray-600 rounded animate-pulse"></div>
                          <div className="w-16 h-3 bg-gray-700 rounded animate-pulse"></div>
                        </div>
                        <div className="space-y-2">
                          {group.map((msg, idx) => (
                            <div key={msg.message_id} className="min-h-3">
                              {idx === 0 && <div className="w-3/4 h-3 bg-gray-600 rounded animate-pulse"></div>}
                              <div className="w-full h-3 bg-gray-600 rounded animate-pulse"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={firstMessage.message_id}
                    className={`group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors ${
                      firstMessage.sender_user_id === currentUser?.user_id
                        ? 'bg-blue-900/20 border-l-4 border-blue-500 hover:bg-blue-900/30'
                        : ''
                    }`}
                    onMouseEnter={() => setHoveredMessageId(firstMessage.message_id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    onContextMenu={(e) => handleMessageGroupContextMenu(groupMessageIds, e)}
                  >
                    <img
                      src={userInfo.avatar}
                      alt={userInfo.username}
                      className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => handleUserClick(firstMessage.sender_user_id, userInfo.username, e)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span
                          className="text-white font-medium select-text cursor-pointer hover:underline"
                          onClick={(e) => handleUserClick(firstMessage.sender_user_id, userInfo.username, e)}
                        >
                          {userInfo.username}
                        </span>
                        {userInfo.roles.includes("Owner") ? (
                          <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">OWNER</span>
                        ) : userInfo.roles.includes("Admin") ? (
                          <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                        ) : userInfo.roles.includes("Moderator") ? (
                          <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">MOD</span>
                        ) : null}
                        <span className="text-gray-400 text-xs select-text">{messageTimestamp}</span>
                      </div>
                      <div className="space-y-1">
                        {group.map((message) => (
                          <MarkdownRenderer key={message.message_id} content={message.message} className="text-gray-300" />
                        ))}
                      </div>
                      {/* Hover Menu Button */}
                      <div className={`absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity ${hoveredMessageId === firstMessage.message_id ? "opacity-100" : ""}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMessageContextMenu({
                              isOpen: true,
                              position: { x: e.clientX, y: e.clientY }
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
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isEmojiPickerOpen
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

          {/* Auto-hide floating alert for too long messages */}
          {messageTooLongAlert && (
            <div className="absolute bottom-2 right-2 w-auto max-w-xs p-3 rounded-lg border bg-red-50 text-red-800 border-red-200 z-10 shadow-md">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-red-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-xs font-medium">{messageTooLongAlert}</span>
                <button
                  onClick={() => setMessageTooLongAlert(null)}
                  className="p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors text-red-800 flex-shrink-0"
                  aria-label="Close message"
                  title="Dismiss"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

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
                const moderators = users.filter(user => !user.is_owner && !user.is_admin);
                const members = users.filter(user => !user.is_owner && !user.is_admin && !moderators.includes(user));

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
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-surface)] shadow-sm ${
                                user.status === 'online' ? 'bg-green-400' :
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

      <UserProfileModal
        isOpen={userProfileModalOpen}
        onClose={() => setUserProfileModalOpen(false)}
        user={currentUser ? {
          id: currentUser.user_id || currentUser.id,
          username: currentUser.username || '',
          avatar: currentUser.avatar,
          status: (currentUser.status === 'online' || currentUser.status === 'idle' || currentUser.status === 'offline' || currentUser.status === 'dnd')
            ? currentUser.status as 'online' | 'idle' | 'offline' | 'dnd'
            : 'offline',
          bio: currentUser.bio,
          joinedAt: currentUser.joinedAt || currentUser.created_at,
          roles: currentUser.roles || []
        } : null}
        currentUserId={currentUser?.user_id || ""}
        onReport={handleUserReport}
        onCopyUserId={handleCopyUserId}
        onSendMessage={handleSendMessageToUser}
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
        serverName={currentServer.name}
        serverId={currentServer.id}
        onGenerateInvite={handleGenerateInvite}
        onCopyInvite={handleCopyInvite}
      />

      <MessageContextMenu
        isOpen={messageContextMenu.isOpen}
        position={messageContextMenu.position}
        onClose={() => setMessageContextMenu({ isOpen: false, position: { x: 0, y: 0 } })}
        onReply={() => handleMessageReply("current")}
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
        onCopyLink={() => handleMessageCopy("current")}
        onReport={() => handleMessageReport("current")}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  if (!authToken) return;

                  // Call delete API
                  deleteChannel(channelDeleteConfirm.channel.channel_id, authToken).then(async (response) => {
                  if (response.success) {
                    logger.ui.info("Channel deleted successfully from dashboard", {
                      channelId: channelDeleteConfirm.channel.channel_id,
                      channelName: channelDeleteConfirm.channel.channel_name
                    });

                    // Show success toast
                    setSuccessToast({ isOpen: true, message: `Channel #${channelDeleteConfirm.channel.channel_name} deleted successfully!` });
                    setTimeout(() => setSuccessToast({ isOpen: false, message: '' }), 3000);

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
                      alert(`Failed to delete channel: ${response.error || 'Unknown error'}`);
                    }
                  }).catch((error) => {
                    console.error("Error deleting channel:", error);
                    alert('An unexpected error occurred while deleting the channel.');
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

      <UserProfileModal
        isOpen={selectedUserProfileModalOpen}
        onClose={() => setSelectedUserProfileModalOpen(false)}
        user={selectedUser}
        currentUserId={currentUser?.user_id || ""}
        position={selectedUserPosition}
        triggerRect={selectedUserTriggerRect}
        onReport={handleUserReport}
        onCopyUserId={handleCopyUserId}
        onSendMessage={handleSendMessageToUser}
      />

      {/* Success Toast Notification */}
      {successToast.isOpen && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 animate-in slide-in-from-right-4 fade-in duration-300">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">{successToast.message}</span>
            <button
              onClick={() => setSuccessToast({ isOpen: false, message: '' })}
              className="text-white hover:bg-black hover:bg-opacity-25 rounded-full p-1 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <MessageReportModal
        isOpen={messageReportModal.isOpen}
        onClose={() => setMessageReportModal({ isOpen: false, messages: [] })}
        onSubmit={handleMessageReportSubmit}
        messageCount={messageReportModal.messages.length}
      />
    </div>
  );
}
