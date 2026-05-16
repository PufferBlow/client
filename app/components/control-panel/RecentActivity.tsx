/**
 * RecentActivity — feed shown in the Overview tab listing the latest server
 * events. Refreshes every 30s and renders a quick-look UserProfileModal when a
 * moderator clicks an embedded username.
 */
import React, { useEffect, useState } from "react";
import { getAuthTokenFromCookies } from "../../services/user";
import { getRecentActivity } from "../../services/system";
import { logger } from "../../utils/logger";
import { cx, controlPanelRowClass, controlPanelSectionClass } from "./shared";
import { UserProfileModal } from "./UserProfileModal";

export function RecentActivity() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfileModal, setUserProfileModal] = useState<{
    isOpen: boolean;
    user: any;
    position?: { x: number; y: number };
    triggerRect?: DOMRect | null;
  }>({ isOpen: false, user: null });

  const fetchRecentActivity = async () => {
    const authToken = getAuthTokenFromCookies() || '';

    if (!authToken) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      const response = await getRecentActivity(authToken, 10);
      if (response.success && response.data) {
        // Transform API data to component format
        const formattedActivities = (response.data.activities || []).map((activity: any) => ({
          id: activity.id,
          type: activity.type,
          title: activity.title,
          description: activity.description || '',
          timestamp: activity.timestamp,
          user: activity.user || null,
          metadata: activity.metadata || {}
        }));
        setActivities(formattedActivities);
        setError(null); // Clear any previous error
      } else {
        setError('Failed to load recent activity');
      }
    } catch (err) {
      setError('Failed to fetch recent activity');
      logger.api.error('Failed to fetch recent activity', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivity();

    // Set up automatic refresh every 30 seconds for real-time data
    const interval = setInterval(() => {
      fetchRecentActivity();
    }, 30000); // 30 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  // Extract username from activity description for server settings updates
  const parseActivityDescription = (activity: any) => {
    const description = activity.description || activity.title || '';

    // Check if it's a server settings update description
    if (description.includes('updated') && description.includes('to')) {
      // Look for patterns like "User updated server settings" or "server_settings_updated by username"
      const match = description.match(/updated by (\w+): (.+ changed to .+)/) ||
        description.match(/(\w+) changed (.+)/);

      if (match) {
        const username = match[1];
        const action = match[2] || description.replace(`by ${username}: `, '');

        return {
          username,
          action,
          userId: activity.user?.id || activity.metadata?.user_id
        };
      }
    }

    return {
      username: null,
      action: description,
      userId: activity.user?.id
    };
  };

  const handleUsernameClick = (
    activity: any,
    username: string,
    userId: string | undefined,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();

    if (!username || !userId) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Seed the modal with only the fields we actually know from the activity
    // payload — username, id, and (sometimes) an avatar URL. UserProfileModal
    // resolves the rest via useUserProfile(id); we used to fabricate status /
    // bio / joinedAt / roles here, which flashed lies for a moderator before
    // the real fetch resolved.
    const user = {
      id: userId,
      username,
      avatar: null,
      avatar_url: activity?.user?.avatar_url || activity?.metadata?.avatar_url || null,
    };

    // Position the modal relative to the clicked username
    const position = {
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 5
    };

    setUserProfileModal({
      isOpen: true,
      user,
      position,
      triggerRect: rect
    });
  };

  const handleCloseUserProfile = () => {
    setUserProfileModal({ isOpen: false, user: null });
  };

  if (loading) {
    return (
      <div className={controlPanelSectionClass}>
        <h2 className="text-[var(--color-text)] font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className={cx(controlPanelRowClass, "animate-pulse")}>
            <div className="w-8 h-8 bg-[var(--color-surface-tertiary)] rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-[var(--color-surface-tertiary)] rounded mb-1 w-24"></div>
              <div className="h-3 bg-[var(--color-surface-tertiary)] rounded w-32"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={controlPanelSectionClass}>
        <h2 className="text-[var(--color-text)] font-semibold mb-4">Recent Activity</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-center text-[var(--color-error)]">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={controlPanelSectionClass}>
      <h2 className="text-[var(--color-text)] font-semibold mb-4">Recent Activity</h2>
      {activities.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center text-[var(--color-text-secondary)]">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No recent activity</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity: any) => {
            // Map activity types to colors and icons
            const getActivityStyle = (type: string) => {
              switch (type) {
                case 'user_joined':
                  return { color: 'var(--color-success)', icon: '👤' };
                case 'channel_created':
                  return { color: 'var(--color-primary)', icon: '📝' };
                case 'moderation':
                  return { color: 'var(--color-warning)', icon: '⚠️' };
                case 'message_sent':
                  return { color: 'var(--color-text-secondary)', icon: '💬' };
                case 'setting_changed':
                  return { color: 'var(--color-error)', icon: '⚙️' };
                case 'file_upload':
                  return { color: 'var(--color-success)', icon: '📁' };
                default:
                  return { color: 'var(--color-text-secondary)', icon: '📌' };
              }
            };

            const style = getActivityStyle(activity.type);

            // Parse activity description for clickable username
            const parsedDesc = parseActivityDescription(activity);

            return (
              <div key={activity.id} className={cx(controlPanelRowClass, "flex items-center space-x-3 cursor-pointer")}>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                  style={{ backgroundColor: `color-mix(in srgb, ${style.color} 20%, var(--color-surface))`, color: style.color }}
                >
                  {style.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-[var(--color-text)]">{activity.title}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    {parsedDesc.username && parsedDesc.userId ? (
                      <span>
                        <span
                          onClick={(e) => handleUsernameClick(activity, parsedDesc.username, parsedDesc.userId, e)}
                          className="text-[var(--color-primary)] font-semibold hover:text-[var(--color-primary)] underline decoration-2 decoration-[var(--color-primary)] hover:decoration-[var(--color-primary)] cursor-pointer transition-colors select-none bg-[var(--color-surface-secondary)] dark:bg-[var(--color-primary)]/30 px-1 rounded"
                          title={`Click to view ${parsedDesc.username}'s profile`}
                        >
                          @{parsedDesc.username}
                        </span>
                        {' '}
                        {parsedDesc.action.replace(parsedDesc.username, '').replace('updated by ', '').replace('changed ', 'changed ').replace(' by ', '')}
                      </span>
                    ) : (
                      parsedDesc.action || activity.description
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User Profile Modal */}
      {userProfileModal.isOpen && (
        <UserProfileModal
          isOpen={true}
          onClose={handleCloseUserProfile}
          user={userProfileModal.user}
          currentUserId="user_current_admin"
          position={userProfileModal.position}
          triggerRect={userProfileModal.triggerRect}
        />
      )}
    </div>
  );
}
