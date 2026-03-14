import React from 'react';
import { UserRole, USER_ROLES, createFallbackAvatarUrl, getPrimaryRole } from '../services/user';

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
  accentColor = "var(--color-accent)",
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
  const resolvedAccentColor = accentColor || "var(--color-accent)";
  const resolvedBannerColor = bannerColor || resolvedAccentColor;

  const buildTintedStyle = (color: string, strength: number = 18) => ({
    backgroundColor: `color-mix(in srgb, ${color} ${strength}%, transparent)`,
    color,
    borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
  });

  // Get the primary role (highest priority) if roles are provided
  const primaryRole = roles ? getPrimaryRole(roles) : undefined;

  // Update local state when username changes
  const [currentUsername, setCurrentUsername] = React.useState(username);
  const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setCurrentUsername(username);
  }, [username]);

  // Fallback avatar using DiceBear if no avatar provided
  const fallbackAvatar = createFallbackAvatarUrl(currentUsername || 'user');
  const displayAvatarUrl = avatarUrl || fallbackAvatar;

  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [displayAvatarUrl, currentUsername]);

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
        return 'bg-[var(--color-success)] shadow-[0_0_16px_color-mix(in_srgb,var(--color-success)_45%,transparent)]';
      case 'offline':
        return 'bg-[var(--color-text-muted)] shadow-[0_0_16px_color-mix(in_srgb,var(--color-text-muted)_35%,transparent)]';
      case 'dnd':
        return 'bg-[var(--color-error)] shadow-[0_0_16px_color-mix(in_srgb,var(--color-error)_45%,transparent)]';
      case 'idle':
        return 'bg-[var(--color-warning)] shadow-[0_0_16px_color-mix(in_srgb,var(--color-warning)_45%,transparent)]';
      default:
        return 'bg-[var(--color-text-muted)] shadow-[0_0_16px_color-mix(in_srgb,var(--color-text-muted)_35%,transparent)]';
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
      <div className="flex items-center space-x-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all duration-300 shadow-2xl hover:scale-105">
        {/* Avatar with status */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--color-border-secondary)] overflow-hidden bg-gradient-to-br from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] p-0.5">
            <img
              src={displayAvatarUrl}
              alt={`${currentUsername}'s avatar`}
              className="w-full h-full rounded-full object-cover bg-[var(--color-surface-secondary)]"
            />
          </div>
          {showOnlineIndicator && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--color-surface)] rounded-full flex items-center justify-center border-2 border-[var(--color-background)]">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status)} shadow-lg`}></div>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h4 className="font-semibold text-[var(--color-text)] truncate">
              {username}
            </h4>
            {primaryRole && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide border flex items-center space-x-1"
                style={buildTintedStyle(USER_ROLES[primaryRole]?.color ?? "var(--color-primary)")}
              >
                <span>{USER_ROLES[primaryRole]?.name}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-2 leading-relaxed">
            {bio}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-[var(--color-text-secondary)]">
              <div className="flex items-center space-x-1">
                <span>{getStatusIcon(status)}</span>
                <span className="font-medium">{getStatusText(status)}</span>
              </div>
              {originServer && (
                <>
                  <span className="text-[var(--color-text-muted)]">•</span>
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
      className={`w-88 animate-scale-in overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl duration-500 ${onCardClick ? 'cursor-pointer hover:scale-105' : ''}`}
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
              ? `linear-gradient(135deg, color-mix(in srgb, ${resolvedBannerColor} 20%, var(--color-surface-secondary)), color-mix(in srgb, ${resolvedBannerColor} 40%, var(--color-surface-tertiary)))`
              : `linear-gradient(135deg, color-mix(in srgb, ${resolvedAccentColor} 22%, var(--color-surface-secondary)), color-mix(in srgb, ${resolvedAccentColor} 38%, var(--color-surface-tertiary)))`
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
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-shadow-lg) 24%, transparent)",
            }}
          ></div>
        </div>

        {/* Status Indicator - Discord style */}
        <div className="absolute top-6 right-6">
          <div
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg ${
              status === 'active' ? 'border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-on-success)]' :
              status === 'idle' ? 'border-[var(--color-warning)] bg-[var(--color-warning)] text-[var(--color-on-warning)]' :
              status === 'dnd' ? 'border-[var(--color-error)] bg-[var(--color-error)] text-[var(--color-on-error)]' :
              'border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
            }`}
            style={status === 'active' ? { borderWidth: "2px", borderStyle: "solid", borderColor: `color-mix(in srgb, ${resolvedAccentColor} 35%, transparent)` } : undefined}
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${
              status === 'active' ? 'bg-[var(--color-success)] shadow-[0_0_12px_color-mix(in_srgb,var(--color-success)_45%,transparent)]' :
              status === 'idle' ? 'bg-[var(--color-warning)] shadow-[0_0_12px_color-mix(in_srgb,var(--color-warning)_45%,transparent)]' :
              status === 'dnd' ? 'bg-[var(--color-error)] shadow-[0_0_12px_color-mix(in_srgb,var(--color-error)_45%,transparent)]' :
              'bg-[var(--color-text-muted)] shadow-[0_0_12px_color-mix(in_srgb,var(--color-text-muted)_35%,transparent)]'
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
                className="w-32 h-32 rounded-full border-8 border-[var(--color-surface)] overflow-hidden shadow-2xl"
              >
                <div className="w-full h-full bg-gradient-to-br from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] flex items-center justify-center">
                  {avatarLoadFailed ? (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] text-4xl font-bold text-[var(--color-text)]">
                      {currentUsername.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <img
                      src={displayAvatarUrl}
                      alt={`${currentUsername}'s avatar`}
                      className="w-full h-full object-cover"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  )}
                </div>
              </div>
              {showOnlineIndicator && (
                <div
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-4 border-[var(--color-surface)] flex items-center justify-center shadow-lg"
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
                    className="text-2xl font-bold bg-[var(--color-surface-secondary)] border-2 border-[var(--color-primary)] rounded-lg px-3 py-1 text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all duration-200"
                    placeholder="Enter username"
                    autoFocus
                    maxLength={50}
                  />
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-[var(--color-text)] leading-tight">{username}</h2>
                    {onUsernameChange && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditingUsername(true);
                        }}
                        className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] p-1 rounded transition-colors"
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
                    className="px-3 py-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] rounded text-sm font-medium transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUsernameCancel();
                    }}
                    className="px-3 py-1 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] text-[var(--color-text)] rounded text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                  @{username.toLowerCase().replace(/\s+/g, '')}
                  <span className="text-[var(--color-text)] ml-1">
                    #{discriminator || Math.floor(Math.random() * 9000) + 1000}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>



        {/* Custom Status */}
        {customStatus && (
          <div className="mt-2 max-w-md">
            <div className="flex w-fit items-center space-x-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-1 text-xs text-[var(--color-text)]">
              {status === 'active' && <div className="w-2 h-2 bg-[var(--color-success)] rounded-full"></div>}
              {status === 'idle' && <div className="w-2 h-2 bg-[var(--color-warning)] rounded-full"></div>}
              {status === 'dnd' && <div className="w-2 h-2 bg-[var(--color-error)] rounded-full"></div>}
              <span>{customStatus}</span>
            </div>
          </div>
        )}

        {/* Mutual Connections */}
        {(mutualServers > 0 || mutualFriends > 0) && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            {mutualServers > 0 && (
              <div className="flex items-center space-x-2 text-[var(--color-text-secondary)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>{mutualServers} Mutual Server{mutualServers !== 1 ? 's' : ''}</span>
              </div>
            )}
            {mutualFriends > 0 && (
              <div className="flex items-center space-x-2 text-[var(--color-text-secondary)]">
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
                style={buildTintedStyle(USER_ROLES[primaryRole]?.color ?? "var(--color-primary)")}
              >
                <span>{USER_ROLES[primaryRole]?.name}</span>
              </div>
            )}

            {/* Custom badges */}
            {badges.map((badge, index) => (
              <div
                key={index}
                className="px-2 py-1 rounded-full text-xs font-medium border flex items-center space-x-1"
                style={buildTintedStyle("var(--color-warning)")}
              >
                <span>⭐</span>
                <span>{badge}</span>
              </div>
            ))}

            {/* Server origin */}
            {originServer && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]">
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
            <h3 className="text-lg font-semibold text-[var(--color-text)] flex items-center space-x-2">
              <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] p-1.5 rounded-lg transition-colors group"
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
                className="w-full bg-[var(--color-surface-secondary)] border-2 border-[var(--color-primary)] rounded-lg px-4 py-3 text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all duration-200 resize-none text-sm"
                placeholder="Tell others about yourself..."
                autoFocus
                maxLength={500}
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleBioSave}
                  className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] rounded-lg text-sm font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleBioCancel}
                  className="px-4 py-2 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] text-[var(--color-text)] rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-[var(--color-text)] leading-relaxed">
              {bio || (
                <span className="text-[var(--color-text-muted)] italic">
                  {onBioChange ? "Add a bio to let others know about you." : "No bio set"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* External Links Section */}
        {externalLinks.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Links</h3>
            <div className="grid grid-cols-2 gap-3">
              {externalLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-3 p-3 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] rounded-lg transition-colors border border-[var(--color-border-secondary)] group"
                  style={{ borderColor: `color-mix(in srgb, ${resolvedAccentColor} 22%, var(--color-border-secondary))` }}
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">
                    {getPlatformIcon(link.platform)}
                  </span>
                  <span className="text-[var(--color-text)] text-sm font-medium capitalize group-hover:text-[var(--color-text)] transition-colors">
                    {link.platform}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Member Since Section */}
        <div className="pt-4 border-t border-[var(--color-border-secondary)]">
          <div className="flex items-center space-x-3 text-[var(--color-text-muted)] text-sm">
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
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Account Actions</h3>
            <div className="space-y-2">
              {onPasswordChange && (
                <button
                  onClick={onPasswordChange}
                  className="w-full flex items-center justify-center space-x-3 p-3 text-[var(--color-text)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded-lg transition-all duration-200 group border border-transparent"
                  style={{ borderColor: `color-mix(in srgb, ${resolvedAccentColor} 35%, transparent)` }}
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
                  className="w-full flex items-center justify-center space-x-3 rounded-lg border p-3 text-[var(--color-error)] transition-all duration-200 group hover:bg-[color:color-mix(in_srgb,var(--color-error)_10%,transparent)]"
                  style={{
                    borderColor: "color-mix(in srgb, var(--color-error) 35%, transparent)",
                  }}
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
