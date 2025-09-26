import type { Route } from "./+types/dashboard";
import { Link } from "react-router";
import { useState } from "react";
import { ServerCreationModal } from "../components/ServerCreationModal";
import { ChannelCreationModal } from "../components/ChannelCreationModal";
import { UserProfileModal } from "../components/UserProfileModal";
import { MessageContextMenu } from "../components/MessageContextMenu";
import { UserContextMenu } from "../components/UserContextMenu";
import { SearchModal } from "../components/SearchModal";
import { InviteModal } from "../components/InviteModal";
import { ThemeToggleWithIcon } from "../components/ThemeToggle";

interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
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

export default function Dashboard() {
  // Modal states
  const [serverCreationModalOpen, setServerCreationModalOpen] = useState(false);
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [selectedUserProfileModalOpen, setSelectedUserProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserPosition, setSelectedUserPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [messageContextMenu, setMessageContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });
  const [userContextMenu, setUserContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });

  // Mock data
  const currentUserId = "user123";
  const currentServer = { id: "server1", name: "General Server" };
  const currentUser = {
    id: "user123",
    username: "User",
    discriminator: "1234",
    avatar: undefined,
    status: "online" as const,
    bio: "Building the future of decentralized messaging",
    joinedAt: "2023-01-15T00:00:00Z",
    roles: ["Member"]
  };

  // Event handlers
  const handleCreateServer = (serverData: { name: string; description: string; isPrivate: boolean }) => {
    console.log("Creating server:", serverData);
    // TODO: Implement server creation
  };

  const handleCreateChannel = (channelData: { name: string; type: 'text' | 'voice'; description?: string }) => {
    console.log("Creating channel:", channelData);
    // TODO: Implement channel creation
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
    console.log("Copied invite link:", inviteCode);
  };

  const handleUserClick = (userId: string, username: string, event: React.MouseEvent) => {
    // Create mock user data based on userId
    const mockUsers: Record<string, User> = {
      "user123": {
        id: "user123",
        username: "User",
        discriminator: "1234",
        avatar: undefined,
        status: "online",
        bio: "Building the future of decentralized messaging",
        joinedAt: "2023-01-15T00:00:00Z",
        roles: ["Member"]
      },
      "user456": {
        id: "user456",
        username: "Alice",
        discriminator: "5678",
        avatar: undefined,
        status: "online",
        bio: "Frontend developer passionate about user experience",
        joinedAt: "2023-02-20T00:00:00Z",
        roles: ["Member", "Developer"]
      },
      "user789": {
        id: "user789",
        username: "Bob",
        discriminator: "9012",
        avatar: undefined,
        status: "online",
        bio: "Backend engineer specializing in distributed systems",
        joinedAt: "2023-03-10T00:00:00Z",
        roles: ["Member", "Admin"]
      },
      "user101": {
        id: "user101",
        username: "Charlie",
        discriminator: "3456",
        avatar: undefined,
        status: "online",
        bio: "DevOps engineer ensuring smooth deployments",
        joinedAt: "2023-04-05T00:00:00Z",
        roles: ["Member", "Moderator"]
      }
    };

    const user = mockUsers[userId];
    if (user) {
      // Calculate position next to the clicked user card
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const modalX = rect.right + 8; // 8px gap from the right edge
      const modalY = rect.top; // Align with the top of the user card

      setSelectedUser(user);
      setSelectedUserPosition({ x: modalX, y: modalY });
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
      <div className="w-60 bg-gray-700 rounded-xl shadow-lg border border-gray-600 flex flex-col resize-x min-w-48 max-w-96">
        {/* Server Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-gray-800 shadow-sm">
          <h1 className="text-white font-semibold">General Server</h1>
          <svg className="w-4 h-4 text-gray-400 cursor-pointer hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          {/* Text Channels */}
          <div className="px-2 py-4">
            <div className="flex items-center px-2 mb-1">
              <svg className="w-3 h-3 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Text Channels</span>
            </div>
            
            <div className="space-y-0.5">
              <div className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer bg-gray-600">
                <span className="text-gray-400 mr-2">#</span>
                <span className="text-gray-300 text-sm">general</span>
              </div>
              <div className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer">
                <span className="text-gray-400 mr-2">#</span>
                <span className="text-gray-400 text-sm">random</span>
              </div>
              <div className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer">
                <span className="text-gray-400 mr-2">#</span>
                <span className="text-gray-400 text-sm">development</span>
              </div>
            </div>
          </div>

          {/* Voice Channels */}
          <div className="px-2 py-2">
            <div className="flex items-center px-2 mb-1">
              <svg className="w-3 h-3 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Voice Channels</span>
            </div>
            
            <div className="space-y-0.5">
              <div className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer">
                <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <span className="text-gray-400 text-sm">General</span>
              </div>
              <div className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer">
                <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <span className="text-gray-400 text-sm">Gaming</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Panel */}
        <div className="h-14 bg-gray-800 px-2 flex items-center">
          <div
            className="flex items-center flex-1 cursor-pointer hover:bg-gray-700 rounded-md transition-colors p-1 -m-1"
            onClick={() => setUserProfileModalOpen(true)}
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center mr-2">
              <span className="text-white text-sm font-semibold">U</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">User</div>
              <div className="text-gray-400 text-xs">Online</div>
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
            <ThemeToggleWithIcon />
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
              <div className="text-gray-300 font-mono select-text">
                Welcome to Pufferblow! 🎉 This is a decentralized messaging platform similar to Discord.
                Your messages are distributed across decentralized servers for better privacy and reliability.
              </div>
            </div>
          </div>

          {/* Sample Messages */}
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold">A</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-white font-medium select-text">Alice</span>
                <span className="text-gray-400 text-xs select-text">Today at 12:05 PM</span>
              </div>
              <div className="text-gray-300 font-mono select-text">
                Hey everyone! Love the decentralized approach. No more worrying about server downtime! 🚀
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold">B</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-white font-medium select-text">Bob</span>
                <span className="text-gray-400 text-xs select-text">Today at 12:07 PM</span>
              </div>
              <div className="text-gray-300 font-mono select-text">
                The UI looks great! Very familiar coming from Discord. How does the decentralization work exactly?
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold">C</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-white font-medium select-text">Charlie</span>
                <span className="text-gray-400 text-xs select-text">Today at 12:10 PM</span>
              </div>
              <div className="text-gray-300 font-mono select-text">
                @Bob The messages are distributed across multiple nodes in the network. Even if some servers go down,
                your messages remain accessible through other nodes. Pretty cool tech! 💪
              </div>
            </div>
          </div>
        </div>

        {/* Message Input */}
        <div className="p-4">
          <div className="bg-gray-600 rounded-lg px-4 py-3">
            <input
              type="text"
              placeholder="Message #general"
              className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Member List */}
      <div className="w-60 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] p-4">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3 bg-[var(--color-surface-tertiary)] px-3 py-2 rounded-xl border border-[var(--color-border)]">Online — 4</h3>
          <div className="space-y-2">
            <div
              className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:rounded-lg hover:bg-gradient-to-r hover:from-[var(--color-surface-secondary)] hover:to-[var(--color-surface-tertiary)] cursor-pointer shadow-sm hover:shadow-md transform hover:scale-102 transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-primary)]"
              onClick={(e) => handleUserClick("user123", "User", e)}
            >
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] rounded-full flex items-center justify-center shadow-md border-2 border-[var(--color-primary-hover)]">
                  <span className="text-white text-sm font-bold drop-shadow-sm">U</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-3 border-[var(--color-surface)] shadow-sm"></div>
              </div>
              <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">User</span>
            </div>
            <div
              className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:rounded-lg hover:bg-gradient-to-r hover:from-[var(--color-surface-secondary)] hover:to-[var(--color-surface-tertiary)] cursor-pointer shadow-sm hover:shadow-md transform hover:scale-102 transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-secondary)]"
              onClick={(e) => handleUserClick("user456", "Alice", e)}
            >
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-md border-2 border-green-300">
                  <span className="text-white text-sm font-bold drop-shadow-sm">A</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-3 border-[var(--color-surface)] shadow-sm"></div>
              </div>
              <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">Alice</span>
            </div>
            <div
              className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:rounded-lg hover:bg-gradient-to-r hover:from-[var(--color-surface-secondary)] hover:to-[var(--color-surface-tertiary)] cursor-pointer shadow-sm hover:shadow-md transform hover:scale-102 transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-secondary)]"
              onClick={(e) => handleUserClick("user789", "Bob", e)}
            >
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-md border-2 border-blue-300">
                  <span className="text-white text-sm font-bold drop-shadow-sm">B</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-3 border-[var(--color-surface)] shadow-sm"></div>
              </div>
              <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">Bob</span>
            </div>
            <div
              className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:rounded-lg hover:bg-gradient-to-r hover:from-[var(--color-surface-secondary)] hover:to-[var(--color-surface-tertiary)] cursor-pointer shadow-sm hover:shadow-md transform hover:scale-102 transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-accent)]"
              onClick={(e) => handleUserClick("user101", "Charlie", e)}
            >
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center shadow-md border-2 border-purple-300">
                  <span className="text-white text-sm font-bold drop-shadow-sm">C</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-3 border-[var(--color-surface)] shadow-sm"></div>
              </div>
              <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">Charlie</span>
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
      />
    </div>
  );
}
