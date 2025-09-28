import React from 'react';

interface UserCardProps {
  username: string;
  bio?: string;
  avatarUrl?: string;
  backgroundUrl?: string;
  status?: 'active' | 'offline' | 'dnd' | 'idle';
  onUsernameChange?: (newUsername: string) => void;
  onStatusChange?: (newStatus: 'active' | 'offline' | 'dnd' | 'idle') => void;
  onPasswordChange?: () => void;
  onAuthTokenReset?: () => void;
}

export function UserCard({
  username,
  bio = "No bio set",
  avatarUrl = "/pufferblow-art-pixel-64x64.png",
  backgroundUrl,
  status = 'active',
  onUsernameChange,
  onStatusChange,
  onPasswordChange,
  onAuthTokenReset
}: UserCardProps) {
  const [isEditingUsername, setIsEditingUsername] = React.useState(false);
  const [isEditingStatus, setIsEditingStatus] = React.useState(false);
  const [tempUsername, setTempUsername] = React.useState(username);
  const [tempStatus, setTempStatus] = React.useState(status);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-gray-500';
      case 'anon':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'anon':
        return 'Anonymous';
      default:
        return 'Unknown';
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

  return (
    <div className="bg-[var(--color-surface)] rounded-xl shadow-lg overflow-hidden border border-[var(--color-border)]">
      {/* Background Image */}
      <div className="relative h-32 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]">
        {backgroundUrl && (
          <img
            src={backgroundUrl}
            alt="Profile background"
            className="w-full h-full object-cover"
          />
        )}
        {/* Status Badge */}
        <div className="absolute top-4 right-4 flex items-center space-x-2 bg-[var(--color-surface)]/90 backdrop-blur-sm rounded-full px-3 py-1 border border-[var(--color-border)]">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`}></div>
          <span className="text-xs font-medium text-[var(--color-text)]">
            {getStatusText(status)}
          </span>
        </div>
      </div>

      {/* Profile Content */}
      <div className="relative px-6 pb-6">
        {/* Avatar */}
        <div className="relative -mt-12 mb-4">
          <div className="w-24 h-24 rounded-full border-4 border-[var(--color-surface)] overflow-hidden bg-[var(--color-surface-secondary)]">
            <img
              src={avatarUrl}
              alt={`${username}'s avatar`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* User Info */}
        <div className="space-y-4">
          {/* Username Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isEditingUsername ? (
                  <input
                    type="text"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    className="text-xl font-bold bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                    autoFocus
                  />
                ) : (
                  <h3 className="text-xl font-bold text-[var(--color-text)]">
                    {username}
                  </h3>
                )}
                <span className="text-sm text-[var(--color-text-secondary)] font-medium">
                  #{Math.floor(Math.random() * 9000) + 1000}
                </span>
              </div>
              {!isEditingUsername ? (
                <button
                  onClick={() => setIsEditingUsername(true)}
                  className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium"
                >
                  Edit
                </button>
              ) : (
                <div className="flex space-x-1">
                  <button
                    onClick={handleUsernameSave}
                    className="text-xs text-green-500 hover:text-green-600 font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleUsernameCancel}
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Status Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Status:</span>
                {isEditingStatus ? (
                  <select
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value as 'active' | 'offline' | 'dnd' | 'idle')}
                    className="text-sm bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="anon">Anonymous</option>
                  </select>
                ) : (
                  <span className="text-sm text-[var(--color-text)] font-medium">
                    {getStatusText(status)}
                  </span>
                )}
              </div>
              {!isEditingStatus ? (
                <button
                  onClick={() => setIsEditingStatus(true)}
                  className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium"
                >
                  Edit
                </button>
              ) : (
                <div className="flex space-x-1">
                  <button
                    onClick={handleStatusSave}
                    className="text-xs text-green-500 hover:text-green-600 font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleStatusCancel}
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {bio && (
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {bio}
            </p>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
            <button
              onClick={onPasswordChange}
              className="w-full text-left text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] px-3 py-2 rounded-md transition-colors"
            >
              Change Password
            </button>
            <button
              onClick={onAuthTokenReset}
              className="w-full text-left text-sm text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-md transition-colors"
            >
              Reset Auth Token
            </button>
          </div>

          {/* Join Date */}
          <div className="pt-2 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-muted)]">
              Joined {new Date().toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
