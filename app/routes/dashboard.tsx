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
import { ThemeToggleWithIcon } from "../components/ThemeToggle";
import { EmojiPicker } from "../components/EmojiPicker";
import { logger } from "../utils/logger";
import { getCurrentUserProfile, getAuthTokenFromCookies, getHostPortFromCookies, profileCache, userActivityTracker } from "../services/user";
import { listChannels, createChannel } from "../services/channel";
import type { Channel } from "../models";

interface User {
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
  // Modal states
  const [serverCreationModalOpen, setServerCreationModalOpen] = useState(false);
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [selectedUserProfileModalOpen, setSelectedUserProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserPosition, setSelectedUserPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedUserTriggerRect, setSelectedUserTriggerRect] = useState<DOMRect | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [messageContextMenu, setMessageContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [membersListVisible, setMembersListVisible] = useState(false);
  const [userContextMenu, setUserContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 });
  const messageInputBarRef = useRef<HTMLDivElement>(null);
  const serverDropdownRef = useRef<HTMLDivElement>(null);

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

  // Check authentication and fetch user profile on component mount
  useEffect(() => {
    const checkAuth = () => {
      // Check cookies for auth token
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key.trim()] = value;
        return acc;
      }, {} as Record<string, string>);

      if (cookies.authToken && cookies.authToken.trim() !== '') {
        return true; // Authenticated
      }

      return false; // Not authenticated
    };

    if (!checkAuth()) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
      return;
    }

    const fetchUserProfile = async () => {
      const hostPort = getHostPortFromCookies() || 'localhost:7575';
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) return;

      const response = await getCurrentUserProfile(hostPort, authToken);
      if (response.success && response.data?.status_code === 200) {
        const userData = response.data.user_data;
        // Generate avatar URL using DiceBear Bottts Neutral style
        const avatarUrl = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(userData.username)}&backgroundColor=5865f2`;

        // Assign roles based on API data
        const defaultRoles = ['Member'];
        if (userData.is_owner) defaultRoles.push('Owner');
        if (userData.is_admin) defaultRoles.push('Admin');

        const user: User = {
          id: userData.user_id,
          username: userData.username,
          avatar: avatarUrl, // Auto-generated avatar
          status: userData.status === 'inactive' ? 'offline' : userData.status as 'online' | 'idle' | 'dnd' | 'offline',
          bio: 'Passionate about decentralized technology and building the future of secure communication. Always exploring new ways to make digital interactions more private and efficient.', // Random bio data
          joinedAt: userData.created_at,
          roles: defaultRoles // Auto-assigned roles
        } as User;
        setCurrentUser(user);
        setCurrentUserId(userData.user_id);
        // Cache the profile
        profileCache.set(userData);
        // Start activity tracking
        userActivityTracker.startTracking();
      }
    };

    fetchUserProfile();

    // Fetch channels
    const fetchChannels = async () => {
      const hostPort = getHostPortFromCookies() || 'localhost:7575';
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) return;

      const response = await listChannels(hostPort, authToken);
      if (response.success && response.data && response.data.channels) {
        setChannels(response.data.channels);
        console.log("Channels fetched from API:", response.data.channels);
        logger.ui.info("Channels fetched successfully", { count: response.data.channels.length });
      } else {
        console.error("Failed to fetch channels from API:", response.error);
        logger.ui.error("Failed to fetch channels", { error: response.error });
        // Don't show mock data - let it show "No channels" if API fails
        setChannels([]);
      }
    };

    fetchChannels();

    logger.system.info("Dashboard component mounted", {
      userId: currentUserId,
      serverId: currentServer.id,
      serverName: currentServer.name
    });

    // Log sensitive data redaction example
    logger.auth.debug("Testing sensitive data redaction", {
      password: "secret123",
      authToken: "token123",
      normalData: "this is fine"
    });

    return () => {
      logger.system.info("Dashboard component unmounting");
    };
  }, []);

  // State for user data
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Mock data
  const currentServer = { id: "server1", name: "General Server" };

  // Event handlers
  const handleCreateServer = (serverData: { name: string; description: string; isPrivate: boolean }) => {
    logger.ui.info("Creating server", { serverName: serverData.name, isPrivate: serverData.isPrivate });
    // TODO: Implement server creation
  };

  const handleCreateChannel = async (channelData: { name: string; type: 'text' | 'voice'; description?: string; isPrivate?: boolean }) => {
    try {
      const hostPort = getHostPortFromCookies() || 'localhost:7575';
      const authToken = getAuthTokenFromCookies() || '';

      const response = await createChannel(hostPort, {
        channel_name: channelData.name,
        is_private: channelData.isPrivate || false
      }, authToken);

      if (response.success && response.data) {
        logger.ui.info("Channel created successfully", {
          channelName: channelData.name,
          isPrivate: channelData.isPrivate
        });

        // Refresh channels list
        const channelsResponse = await listChannels(hostPort, authToken);
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
    console.log("Report message:", messageId);
    // TODO: Implement report functionality
  };

  const handleMessageCopy = (messageId: string) => {
    console.log("Copy message:", messageId);
    // TODO: Implement copy functionality
  };

  const handleUserReport = (userId: string) => {
    console.log("Report user:", userId);
    // TODO: Implement user report functionality
  };

  const handleCopyUserId = (userId: string) => {
    navigator.clipboard.writeText(userId);
    logger.ui.info("User ID copied to clipboard", { userId: "[REDACTED]" });
  };

  const handleSendMessageToUser = (userId: string) => {
    console.log("Send message to user:", userId);
    // TODO: Implement direct message functionality
  };

  const handleMessageContextMenu = (messageId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setMessageContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY }
    });
  };

  // Message input handlers
  const handleSendMessage = () => {
    if (messageInput.trim()) {
      logger.ui.info("Sending message", { channel: "general", messageLength: messageInput.length });
      // TODO: Implement message sending
      setMessageInput('');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
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

  const handleUserClick = (userId: string, username: string, event: React.MouseEvent) => {
    // Create mock user data based on userId with generated avatars
    const mockUsers: Record<string, User> = {
      "user123": {
        id: "user123",
        username: "User",
        avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("User")}&backgroundColor=5865f2`,
        status: "online",
        bio: "Building the future of decentralized messaging",
        joinedAt: "2023-01-15T00:00:00Z",
        roles: ["Member"]
      },
      "user456": {
        id: "user456",
        username: "Alice",
        avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("Alice")}&backgroundColor=5865f2`,
        status: "online",
        bio: "Frontend developer passionate about user experience",
        joinedAt: "2023-02-20T00:00:00Z",
        roles: ["Member", "Developer"]
      },
      "user789": {
        id: "user789",
        username: "Bob",
        avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("Bob")}&backgroundColor=5865f2`,
        status: "online",
        bio: "Backend engineer specializing in distributed systems",
        joinedAt: "2023-03-10T00:00:00Z",
        roles: ["Member", "Admin"]
      },
      "user101": {
        id: "user101",
        username: "Charlie",
        avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("Charlie")}&backgroundColor=5865f2`,
        status: "online",
        bio: "DevOps engineer ensuring smooth deployments",
        joinedAt: "2023-04-05T00:00:00Z",
        roles: ["Member", "Moderator"]
      }
    };

    const user = mockUsers[userId];
    if (user) {
      // Calculate position next to the clicked user card with viewport bounds checking
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

      // Position vertically: align with top of user card, but ensure modal stays in viewport
      modalY = rect.top;

      // Adjust if modal would go off-screen vertically
      if (modalY + modalHeight > window.innerHeight) {
        modalY = window.innerHeight - modalHeight - gap;
      }
      if (modalY < gap) {
        modalY = gap;
      }

      setSelectedUser(user);
      setSelectedUserPosition({ x: modalX, y: modalY });
      setSelectedUserTriggerRect(rect);
      setSelectedUserProfileModalOpen(true);
    }
  };

  return (
    <div className="h-screen bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none">
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
              <div className="absolute right-0 top-12 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 min-w-48 z-50">
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
                  {channels.map(channel => (
                    <div
                      key={channel.channel_id}
                      className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer"
                    >
                      <span className="text-gray-400 mr-2">#</span>
                      <span className="text-gray-400 text-sm">{channel.channel_name}</span>
                      {channel.is_private && (
                        <svg className="w-4 h-4 text-gray-500 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Panel */}
        <div className="h-14 bg-gray-800 px-2 flex items-center">
          <div
            className="flex items-center flex-1 cursor-pointer hover:bg-gray-700 rounded-md transition-colors p-1 -m-1"
            onClick={() => currentUser && setUserProfileModalOpen(true)}
          >
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.username}
                className="w-8 h-8 rounded-full mr-2"
              />
            ) : (
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center mr-2">
                <span className="text-white text-sm font-semibold">U</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{currentUser?.username || 'User'}</div>
              <div className="text-gray-400 text-xs capitalize">{currentUser?.status || 'online'}</div>
            </div>
          </div>
          <div className="flex space-x-2">
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-600">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
            </button>
            <Link to="/settings" className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-600">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-800 rounded-xl shadow-lg border border-gray-600 resize-x min-w-96">
        {/* Channel Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-gray-700 bg-gray-800">
          <div className="flex items-center">
            <span className="text-gray-400 mr-2">#</span>
            <h2 className="text-white font-semibold">general</h2>
            <div className="ml-2 text-gray-400 text-sm">Decentralized general discussion</div>
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Welcome Message */}
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
              <img
                src="/pufferblow-art-pixel-32x32.png"
                alt="Pufferblow Bot"
                className="w-6 h-6"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-white font-medium select-text">Pufferblow Bot</span>
                <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded">BOT</span>
                <span className="text-gray-400 text-xs select-text">Today at 12:00 PM</span>
              </div>
              <div className="text-gray-300 font-sans select-text">
                Welcome to Pufferblow! 🎉 This is a decentralized messaging platform similar to Discord.
                Your messages are distributed across decentralized servers for better privacy and reliability.
              </div>
            </div>
          </div>

          {/* Sample Messages */}
          <div
            className="group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors"
            onMouseEnter={() => setHoveredMessageId("alice")}
            onMouseLeave={() => setHoveredMessageId(null)}
            onContextMenu={(e) => handleMessageContextMenu("alice", e)}
          >
            <img
              src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("Alice")}&backgroundColor=5865f2`}
              alt="Alice"
              className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => handleUserClick("user456", "Alice", e)}
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span
                  className="text-white font-medium select-text cursor-pointer hover:underline"
                  onClick={(e) => handleUserClick("user456", "Alice", e)}
                >
                  Alice
                </span>
                <span className="text-gray-400 text-xs select-text">Today at 12:05 PM</span>
              </div>
              <div className="text-gray-300 font-sans select-text">
                Hey everyone! Love the decentralized approach. No more worrying about server downtime! 🚀
              </div>
            </div>
            {/* Hover Menu Button */}
            <div className={`absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity ${hoveredMessageId === "alice" ? "opacity-100" : ""}`}>
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

          <div
            className="group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors"
            onMouseEnter={() => setHoveredMessageId("bob")}
            onMouseLeave={() => setHoveredMessageId(null)}
            onContextMenu={(e) => handleMessageContextMenu("bob", e)}
          >
            <img
              src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("Bob")}&backgroundColor=5865f2`}
              alt="Bob"
              className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => handleUserClick("user789", "Bob", e)}
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <div className="flex items-center space-x-2">
                  <span
                    className="text-white font-medium select-text cursor-pointer hover:underline"
                    onClick={(e) => handleUserClick("user789", "Bob", e)}
                  >
                    Bob
                  </span>
                  <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                </div>
                <span className="text-gray-400 text-xs select-text">Today at 12:07 PM</span>
              </div>
              <div className="text-gray-300 font-sans select-text">
                The UI looks great! Very familiar coming from Discord. How does the decentralization work exactly?
              </div>
            </div>
            {/* Hover Menu Button */}
            <div className={`absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity ${hoveredMessageId === "bob" ? "opacity-100" : ""}`}>
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

          <div
            className="group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors"
            onMouseEnter={() => setHoveredMessageId("charlie")}
            onMouseLeave={() => setHoveredMessageId(null)}
            onContextMenu={(e) => handleMessageContextMenu("charlie", e)}
          >
            <img
              src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("Charlie")}&backgroundColor=5865f2`}
              alt="Charlie"
              className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => handleUserClick("user101", "Charlie", e)}
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <div className="flex items-center space-x-2">
                  <span
                    className="text-white font-medium select-text cursor-pointer hover:underline"
                    onClick={(e) => handleUserClick("user101", "Charlie", e)}
                  >
                    Charlie
                  </span>
                  <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">MOD</span>
                </div>
                <span className="text-gray-400 text-xs select-text">Today at 12:10 PM</span>
              </div>
              <div className="text-gray-300 font-sans select-text">
                @Bob The messages are distributed across multiple nodes in the network. Even if some servers go down,
                your messages remain accessible through other nodes. Pretty cool tech! 💪
              </div>
            </div>
            {/* Hover Menu Button */}
            <div className={`absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity ${hoveredMessageId === "charlie" ? "opacity-100" : ""}`}>
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

        {/* Message Input */}
        <div className="p-4">
          <div ref={messageInputBarRef} className="bg-gray-600 rounded-lg px-4 py-3">
            <div className="flex items-end space-x-3">
              {/* File Upload Button */}
              <label className="flex-shrink-0">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx"
                />
                <button
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-500 transition-colors text-gray-400 hover:text-white"
                  title="Upload file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              </label>

              {/* Message Input */}
              <div className="flex-1">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Message #general"
                  className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none resize-none min-h-[20px] max-h-32"
                  rows={1}
                  style={{ height: 'auto', minHeight: '20px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                  }}
                />
              </div>

              {/* Emoji Button */}
              <button
                onClick={handleEmojiClick}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
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

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                  messageInput.trim()
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-500 text-gray-400 cursor-not-allowed'
                }`}
                title="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
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
        <div className="w-60 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] p-4">
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-4">
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

          {/* Admin Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 bg-[var(--color-surface-tertiary)] px-2 py-1 rounded border border-[var(--color-border)]">Admin — 1</h4>
              <div className="space-y-1">
                <div
                  className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:rounded-lg hover:bg-gradient-to-r hover:from-[var(--color-surface-secondary)] hover:to-[var(--color-surface-tertiary)] cursor-pointer shadow-sm hover:shadow-md transform hover:scale-102 transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-primary)]"
                  onClick={(e) => handleUserClick("user789", "Bob", e)}
                >
                  <div className="relative">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("Bob")}&backgroundColor=5865f2`}
                      alt="Bob"
                      className="w-8 h-8 rounded-full shadow-md border-2 border-red-300"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[var(--color-surface)] shadow-sm"></div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">Bob</span>
                    <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                  </div>
                </div>
              </div>
          </div>

          {/* Moderators Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 bg-[var(--color-surface-tertiary)] px-2 py-1 rounded border border-[var(--color-border)]">Moderators — 1</h4>
            <div className="space-y-1">
              <div
                className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:rounded-lg hover:bg-gradient-to-r hover:from-[var(--color-surface-secondary)] hover:to-[var(--color-surface-tertiary)] cursor-pointer shadow-sm hover:shadow-md transform hover:scale-102 transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                onClick={(e) => handleUserClick("user101", "Charlie", e)}
              >
                <div className="relative">
                  <img
                    src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("Charlie")}&backgroundColor=5865f2`}
                    alt="Charlie"
                    className="w-8 h-8 rounded-full shadow-md border-2 border-purple-300"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[var(--color-surface)] shadow-sm"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">Charlie</span>
                  <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">MOD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Members Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 bg-[var(--color-surface-tertiary)] px-2 py-1 rounded border border-[var(--color-border)]">Members — 2</h4>
            <div className="space-y-1">
              <div
                className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:rounded-lg hover:bg-gradient-to-r hover:from-[var(--color-surface-secondary)] hover:to-[var(--color-surface-tertiary)] cursor-pointer shadow-sm hover:shadow-md transform hover:scale-102 transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-primary)]"
                onClick={(e) => handleUserClick("user123", "User", e)}
              >
                <div className="relative">
                  <img
                    src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("User")}&backgroundColor=5865f2`}
                    alt="User"
                    className="w-8 h-8 rounded-full shadow-md border-2 border-[var(--color-primary-hover)]"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[var(--color-surface)] shadow-sm"></div>
                </div>
                <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">User</span>
              </div>
              <div
                className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:rounded-lg hover:bg-gradient-to-r hover:from-[var(--color-surface-secondary)] hover:to-[var(--color-surface-tertiary)] cursor-pointer shadow-sm hover:shadow-md transform hover:scale-102 transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-secondary)]"
                onClick={(e) => handleUserClick("user456", "Alice", e)}
              >
                <div className="relative">
                  <img
                    src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent("Alice")}&backgroundColor=5865f2`}
                    alt="Alice"
                    className="w-8 h-8 rounded-full shadow-md border-2 border-green-300"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[var(--color-surface)] shadow-sm"></div>
                </div>
                <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">Alice</span>
              </div>
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
        user={currentUser}
        currentUserId={currentUserId}
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

      <UserProfileModal
        isOpen={selectedUserProfileModalOpen}
        onClose={() => setSelectedUserProfileModalOpen(false)}
        user={selectedUser}
        currentUserId={currentUserId}
        position={selectedUserPosition}
        triggerRect={selectedUserTriggerRect}
        onReport={handleUserReport}
        onCopyUserId={handleCopyUserId}
        onSendMessage={handleSendMessageToUser}
      />
    </div>
  );
}
