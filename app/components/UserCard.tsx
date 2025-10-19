import React from 'react';
import { UserRole, USER_ROLES, getPrimaryRole } from '../services/user';

interface ExternalLink {
  platform: string;
  url: string;
  icon?: string;
}

interface Activity {
  type: 'playing' | 'listening' | 'watching' | 'streaming';
  name: string;
  details?: string;
  url?: string;
}

interface UserCardProps {
  username: string;
  bio?: string;
  roles?: UserRole[];
  originServer?: string;
  avatarUrl?: string;
  backgroundUrl?: string;
  accentColor?: string;
  bannerColor?: string;
  status?: 'active' | 'offline' | 'dnd' | 'idle';
  customStatus?: string;
  activity?: Activity;
  externalLinks?: ExternalLink[];
  badges?: string[];
  joinDate?: string;
  mutualServers?: number;
  mutualFriends?: number;
  discriminator?: string;
  onUsernameChange?: (newUsername: string) => void;
  onBioChange?: (newBio: string) => void;
  onStatusChange?: (newStatus: 'active' | 'offline' | 'dnd' | 'idle') => void;
  onPasswordChange?: () => void;
  onAuthTokenReset?: () => void;
  onAccentColorChange?: (color: string) => void;
  onBannerColorChange?: (color: string) => void;
  onCustomStatusChange?: (status: string) => void;
  onExternalLinksChange?: (links: ExternalLink[]) => void;
  onCardClick?: () => void;
  showOnlineIndicator?: boolean;
  isCompact?: boolean;
}

export function UserCard({
  username,
  bio = "No bio set",
  roles,
  originServer,
  avatarUrl,
  backgroundUrl,
  accentColor = "#5865f2",
  bannerColor,
  status = 'active',
  customStatus,
  activity,
  externalLinks = [],
  badges = [],
  joinDate,
  mutualServers = 0,
  mutualFriends = 0,
  discriminator,
  onUsernameChange,
  onBioChange,
  onStatusChange,
  onPasswordChange,
  onAuthTokenReset,
  onAccentColorChange,
  onBannerColorChange,
  onCustomStatusChange,
  onExternalLinksChange,
  onCardClick,
  showOnlineIndicator = true,
  isCompact = false
}: UserCardProps) {

  // Get the primary role (highest priority) if roles are provided
  const primaryRole = roles ? getPrimaryRole(roles) : undefined;

  // Update local state when username changes
  const [currentUsername, setCurrentUsername] = React.useState(username);

  React.useEffect(() => {
    setCurrentUsername(username);
  }, [username]);

  // Fallback avatar using DiceBear if no avatar provided
  const fallbackAvatar = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(currentUsername || 'user')}&backgroundColor=5865f2`;
  const displayAvatarUrl = avatarUrl || fallbackAvatar;

  // Fallback banner handling
  const displayBannerUrl = backgroundUrl;
  const [isEditingUsername, setIsEditingUsername] = React.useState(false);
  const [isEditingBio, setIsEditingBio] = React.useState(false);
  const [isEditingStatus, setIsEditingStatus] = React.useState(false);
  const [tempUsername, setTempUsername] = React.useState(username);
  const [tempBio, setTempBio] = React.useState(bio);
  const [tempStatus, setTempStatus] = React.useState(status);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500 shadow-green-500/50';
      case 'offline':
        return 'bg-gray-400 shadow-gray-400/50';
      case 'dnd':
        return 'bg-red-500 shadow-red-500/50';
      case 'idle':
        return 'bg-yellow-500 shadow-yellow-500/50';
      default:
        return 'bg-gray-400 shadow-gray-400/50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'dnd':
        return 'Do Not Disturb';
      case 'idle':
        return 'Idle';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return '🟢';
      case 'offline':
        return '⚫';
      case 'dnd':
        return '🔴';
      case 'idle':
        return '🟡';
      default:
        return '⚫';
    }
  };

  const handleUsernameSave = () => {
    if (tempUsername.trim() && tempUsername !== username) {
      onUsernameChange?.(tempUsername.trim());
    }
    setIsEditingUsername(false);
  };

  const handleUsernameCancel = () => {
    setTempUsername(username);
    setIsEditingUsername(false);
  };

  const handleBioSave = () => {
    const newBio = tempBio?.trim() || "";
    if (newBio !== bio) {
      onBioChange?.(newBio);
    }
    setIsEditingBio(false);
  };

  const handleBioCancel = () => {
    setTempBio(bio);
    setIsEditingBio(false);
  };

  const handleStatusSave = () => {
    if (tempStatus !== status) {
      onStatusChange?.(tempStatus);
    }
    setIsEditingStatus(false);
  };

  const handleStatusCancel = () => {
    setTempStatus(status);
    setIsEditingStatus(false);
  };

  if (isCompact) {
    return (
      <div className="flex items-center space-x-3 p-4 glassmorphism hover-lift rounded-xl border border-white/20 transition-all duration-300 shadow-2xl hover:scale-105">
        {/* Avatar with status */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full border-2 border-[#4C566A] overflow-hidden bg-gradient-to-br from-[#81A1C1] to-[#88C0D0] p-0.5">
            <img
              src={displayAvatarUrl}
              alt={`${currentUsername}'s avatar`}
              className="w-full h-full rounded-full object-cover bg-[#434C5E]"
            />
          </div>
          {showOnlineIndicator && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#3B4252] rounded-full flex items-center justify-center border-2 border-[#2E3440]">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status)} shadow-lg`}></div>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h4 className="font-semibold text-[#ECEFF4] truncate">
              {username}
            </h4>
            {primaryRole && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide border flex items-center space-x-1"
                style={{
                  backgroundColor: `${USER_ROLES[primaryRole]?.color}33`,
                  color: USER_ROLES[primaryRole]?.color,
                  borderColor: `${USER_ROLES[primaryRole]?.color}40`
                }}
              >
                <span>{USER_ROLES[primaryRole]?.name}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-[#D8DEE9] line-clamp-2 mb-2 leading-relaxed">
            {bio}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-[#E5E9F0]">
              <div className="flex items-center space-x-1">
                <span>{getStatusIcon(status)}</span>
                <span className="font-medium">{getStatusText(status)}</span>
              </div>
              {originServer && (
                <>
                  <span className="text-[#4C566A]">•</span>
                  <span>{originServer}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get platform icon for external links
  const getPlatformIcon = (platform: string) => {
    const iconMap: Record<string, string> = {
      'github': '🎯',
      'twitter': '🐦',
      'discord': '💬',
      'steam': '🎮',
      'twitch': '📺',
      'youtube': '📺',
      'instagram': '📷',
      'website': '🌐',
      'spotify': '🎵',
      'reddit': '🟠'
    };
    return iconMap[platform.toLowerCase()] || '🔗';
  };

  return (
    <div
      className={`glassmorphism rounded-2xl shadow-2xl overflow-hidden hover-lift animate-scale-in duration-500 max-w-lg w-full ${onCardClick ? 'cursor-pointer hover-lift hover:scale-105' : ''}`}
      onClick={(e) => {
        console.log('UserCard clicked', onCardClick);
        onCardClick?.();
      }}
    >
      {/* Discord-style Banner Section */}
      <div className={`relative ${isCompact ? 'h-24' : 'h-48'} overflow-hidden`}>
        {/* Banner Background */}
        <div
          className="w-full h-full relative"
          style={{
            background: bannerColor
              ? `linear-gradient(135deg, ${bannerColor}33, ${bannerColor}66)`
              : `linear-gradient(135deg, ${accentColor}33, ${accentColor}66), linear-gradient(135deg, #5865f2, #7289da)`
          }}
        >
          {displayBannerUrl && (
            <img
              src={displayBannerUrl}
              alt="Profile banner"
              className="w-full h-full object-cover"
            />
          )}

          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        {/* Status Indicator - Discord style */}
        <div className="absolute top-6 right-6">
          <div
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-sm ${
              status === 'active' ? 'bg-[#A3BE8C]/80 text-white' :
              status === 'idle' ? 'bg-yellow-500/90 text-white' :
              status === 'dnd' ? 'bg-red-500/90 text-white' :
              'bg-gray-500/90 text-gray-200'
            }`}
            style={{
              border: status === 'active' ? `2px solid ${accentColor}40` : 'none'
            }}
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${
              status === 'active' ? 'bg-[#A3BE8C]/40 shadow-[#A3BE8C]/30' :
              status === 'idle' ? 'bg-yellow-400/60 shadow-yellow-400/40' :
              status === 'dnd' ? 'bg-red-400/60 shadow-red-400/40' :
              'bg-gray-400/60 shadow-gray-400/40'
            }`}></div>
            {getStatusText(status)}
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="px-6 pb-6">
        {/* Avatar and Basic Info */}
        <div className="relative -mt-16 mb-4">
          <div className="flex items-end space-x-4">
            {/* Avatar */}
            <div className="relative">
              <div
                className="w-32 h-32 rounded-full border-8 border-[#313338] overflow-hidden shadow-2xl"
                style={{ borderColor: '#313338' }}
              >
                <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                  <img
                    src={displayAvatarUrl}
                    alt={`${currentUsername}'s avatar`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-4xl font-bold text-white">${currentUsername.charAt(0).toUpperCase()}</div>`;
                      }
                    }}
                  />
                </div>
              </div>
              {showOnlineIndicator && (
                <div
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-4 border-[#313338] flex items-center justify-center shadow-lg"
                  style={{ borderColor: '#313338' }}
                >
                  <div className={`w-6 h-6 rounded-full ${getStatusColor(status)} shadow-lg ${
                    status === 'active' ? 'animate-pulse' : ''
                  }`}></div>
                </div>
              )}
            </div>

            {/* Name and Title */}
            <div className="flex-1 pb-2">
              <div className="flex items-center space-x-2">
                {isEditingUsername ? (
                  <input
                    type="text"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    className="text-2xl font-bold bg-[#383a40] border-2 border-[#5865f2] rounded-lg px-3 py-1 text-white focus:ring-2 focus:ring-[#5865f2]/50 focus:border-[#5865f2] transition-all duration-200"
                    placeholder="Enter username"
                    autoFocus
                    maxLength={50}
                  />
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-white leading-tight">{username}</h2>
                    {onUsernameChange && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditingUsername(true);
                        }}
                        className="text-[#b9bbbe] hover:text-white p-1 rounded transition-colors"
                        title="Edit username"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>

              {isEditingUsername ? (
                <div className="flex space-x-2 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUsernameSave();
                    }}
                    className="px-3 py-1 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded text-sm font-medium transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUsernameCancel();
                    }}
                    className="px-3 py-1 bg-[#36393f] hover:bg-[#40444b] text-[#dcddde] rounded text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="text-[#b9bbbe] text-sm mt-1">
                  @{username.toLowerCase().replace(/\s+/g, '')}
                  <span className="text-[#dcddde] ml-1">
                    #{discriminator || Math.floor(Math.random() * 9000) + 1000}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Activity Status - Only show in full mode */}
        {activity && !isCompact && (
          <div className="mt-2 max-w-md">
            <div className="flex items-center space-x-2 bg-[#202225] rounded-lg px-3 py-2 text-sm text-[#dcddde]">
              {activity.type === 'playing' && (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-[#5865f2] rounded flex items-center justify-center text-xs">
                    🎮
                  </div>
                  <span className="text-[#b9bbbe]">Playing</span>
                  <span className="font-medium">{activity.name}</span>
                </div>
              )}
              {activity.type === 'listening' && (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-[#1db954] rounded flex items-center justify-center text-xs">
                    🎵
                  </div>
                  <span className="text-[#b9bbbe]">Listening to</span>
                  <span className="font-medium">{activity.name}</span>
                </div>
              )}
              {activity.type === 'watching' && (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-[#5865f2] rounded flex items-center justify-center text-xs">
                    📺
                  </div>
                  <span className="text-[#b9bbbe]">Watching</span>
                  <span className="font-medium">{activity.name}</span>
                </div>
              )}
              {activity.type === 'streaming' && activity.url && (
                <a
                  href={activity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:bg-[#2f3136] rounded px-2 py-1 -mx-2 -my-1 transition-colors group"
                >
                  <div className="w-4 h-4 bg-[#ff4646] rounded flex items-center justify-center text-xs">
                    🔴
                  </div>
                  <span className="text-[#b9bbbe]">Streaming</span>
                  <span className="font-medium group-hover:text-white transition-colors">{activity.name}</span>
                </a>
              )}
              {activity.details && (
                <div className="text-xs text-[#72767d] mt-1 ml-6">
                  {activity.details}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Status */}
        {customStatus && (
          <div className="mt-2 max-w-md">
            <div className="flex items-center space-x-2 bg-black/20 backdrop-blur-sm rounded-full px-3 py-1 w-fit text-xs text-[#dcddde]">
              {status === 'active' && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
              {status === 'idle' && <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>}
              {status === 'dnd' && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
              <span>{customStatus}</span>
            </div>
          </div>
        )}

        {/* Mutual Connections */}
        {(mutualServers > 0 || mutualFriends > 0) && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            {mutualServers > 0 && (
              <div className="flex items-center space-x-2 text-[#b9bbbe]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>{mutualServers} Mutual Server{mutualServers !== 1 ? 's' : ''}</span>
              </div>
            )}
            {mutualFriends > 0 && (
              <div className="flex items-center space-x-2 text-[#b9bbbe]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{mutualFriends} Mutual Friend{mutualFriends !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Badges Section */}
        {(primaryRole || originServer || badges.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {/* Role badges */}
            {primaryRole && (
              <div
                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-md flex items-center space-x-1"
                style={{
                  backgroundColor: `${USER_ROLES[primaryRole]?.color}33`,
                  color: USER_ROLES[primaryRole]?.color,
                  border: `1px solid ${USER_ROLES[primaryRole]?.color}40`
                }}
              >
                <span>{USER_ROLES[primaryRole]?.name}</span>
              </div>
            )}

            {/* Custom badges */}
            {badges.map((badge, index) => (
              <div
                key={index}
                className="px-2 py-1 rounded-full text-xs font-medium bg-[#f1c40f]/20 text-[#f1c40f] border border-[#f1c40f]/30 flex items-center space-x-1"
              >
                <span>⭐</span>
                <span>{badge}</span>
              </div>
            ))}

            {/* Server origin */}
            {originServer && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-[#36393f] text-[#b9bbbe] border border-[#40444b]">
                {originServer}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile Sections */}
      <div className="px-6 pb-6 space-y-6">
        {/* About Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <svg className="w-5 h-5 text-[#b9bbbe]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>About</span>
            </h3>
            {onBioChange && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingBio(true);
                }}
                className="text-[#b9bbbe] hover:text-white p-1.5 rounded-lg transition-colors group"
                title="Edit bio"
              >
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
          </div>

          {isEditingBio ? (
            <div className="space-y-2">
              <textarea
                value={tempBio}
                onChange={(e) => setTempBio(e.target.value)}
                rows={4}
                className="w-full bg-[#202225] border-2 border-[#5865f2] rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-[#5865f2]/50 focus:border-[#5865f2] transition-all duration-200 resize-none text-sm"
                placeholder="Tell others about yourself..."
                autoFocus
                maxLength={500}
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleBioSave}
                  className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleBioCancel}
                  className="px-4 py-2 bg-[#36393f] hover:bg-[#40444b] text-[#dcddde] rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-[#dcddde] leading-relaxed">
              {bio || (
                <span className="text-[#72767d] italic">
                  {onBioChange ? "Add a bio to let others know about you." : "No bio set"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* External Links Section */}
        {externalLinks.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Links</h3>
            <div className="grid grid-cols-2 gap-3">
              {externalLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-3 p-3 bg-[#202225] hover:bg-[#2f3136] rounded-lg transition-colors border border-[#40444b] hover:border-[#5865f2]/50 group"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">
                    {getPlatformIcon(link.platform)}
                  </span>
                  <span className="text-[#dcddde] text-sm font-medium capitalize group-hover:text-white transition-colors">
                    {link.platform}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Member Since Section */}
        <div className="pt-4 border-t border-[#40444b]">
          <div className="flex items-center space-x-3 text-[#72767d] text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              Joined {joinDate
                ? new Date(joinDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })
                : new Date().toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })
              }
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {(onPasswordChange || onAuthTokenReset) && (
          <div className="space-y-3 pt-4">
            <h3 className="text-lg font-semibold text-white">Account Actions</h3>
            <div className="space-y-2">
              {onPasswordChange && (
                <button
                  onClick={onPasswordChange}
                  className="w-full flex items-center justify-center space-x-3 p-3 text-[#dcddde] hover:text-white hover:bg-[#2f3136] rounded-lg transition-all duration-200 group border border-transparent"
                  style={{ borderColor: `${accentColor}40` }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="font-medium">Change Password</span>
                </button>
              )}

              {onAuthTokenReset && (
                <button
                  onClick={onAuthTokenReset}
                  className="w-full flex items-center justify-center space-x-3 p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200 group border border-red-500/30 hover:border-red-500/50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="font-medium">Reset Auth Token</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
