/**
 * RecentActivity — feed listing the latest server events. Now lives in
 * its own "Activity" tab in the control panel (previously inlined at
 * the bottom of OverviewTab). Refreshes every 30s and renders a
 * quick-look UserProfileModal when a moderator clicks an embedded
 * username.
 *
 * The tab is paginated client-side: we fetch a wide window from
 * `/system/recent-activity` (200 entries) and then page through it
 * locally with a `pageSize` of 20. A search box filters across title,
 * description, and the activity's associated username. Pagination
 * resets to page 1 whenever the search term changes so the user always
 * sees matches at the top of the list.
 */
import React, { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  MessageSquare,
  MessageSquarePlus,
  Pin,
  Search,
  Settings as SettingsIcon,
  Upload,
  UserPlus,
} from "lucide-react";
import { getAuthTokenFromCookies } from "../../services/user";
import { getRecentActivity } from "../../services/system";
import { logger } from "../../utils/logger";
import { cx, controlPanelRowClass, controlPanelSectionClass } from "./shared";
import { UserProfileModal } from "./UserProfileModal";

/**
 * Map an activity `type` (returned by /system/recent-activity) to an
 * SVG icon component and a semantic accent color. The icons live in
 * `lucide-react` to match the rest of the control panel's iconography.
 */
type ActivityStyle = {
  Icon: ComponentType<{ className?: string }>;
  color: string;
};

const ACTIVITY_STYLES: Record<string, ActivityStyle> = {
  user_joined: { Icon: UserPlus, color: "var(--color-success)" },
  channel_created: { Icon: MessageSquarePlus, color: "var(--color-primary)" },
  moderation: { Icon: AlertTriangle, color: "var(--color-warning)" },
  message_sent: { Icon: MessageSquare, color: "var(--color-text-secondary)" },
  setting_changed: { Icon: SettingsIcon, color: "var(--color-error)" },
  file_upload: { Icon: Upload, color: "var(--color-success)" },
};
const DEFAULT_ACTIVITY_STYLE: ActivityStyle = {
  Icon: Pin,
  color: "var(--color-text-secondary)",
};

const getActivityStyle = (type: string): ActivityStyle =>
  ACTIVITY_STYLES[type] ?? DEFAULT_ACTIVITY_STYLE;

const PAGE_SIZE = 20;
// How many entries to ask the backend for. We page client-side so the
// user can scroll through history without re-firing requests.
const FETCH_LIMIT = 200;

export function RecentActivity() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
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
      const response = await getRecentActivity(authToken, FETCH_LIMIT);
      if (response.success && response.data) {
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
        setError(null);
      } else {
        // Surface the actual server error rather than burying it
        // behind a generic copy — previously a 422 (e.g. the
        // limit-too-high bug) showed the same "Failed to load
        // recent activity" message a transport failure would, and
        // there was no way to tell them apart from the UI.
        const detail = response.error?.trim();
        setError(detail ? `Failed to load recent activity: ${detail}` : "Failed to load recent activity");
        logger.api.error("getRecentActivity returned !success", { error: response.error });
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
    const interval = setInterval(fetchRecentActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  // Reset to page 1 when the search term changes, otherwise a stale
  // page index can leave the user staring at "No results" even though
  // matches exist on page 1.
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const parseActivityDescription = (activity: any) => {
    const description = activity.description || activity.title || '';
    if (description.includes('updated') && description.includes('to')) {
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

  const filteredActivities = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return activities;
    return activities.filter((activity) => {
      const haystack = [
        activity.title,
        activity.description,
        activity.type,
        activity.user?.username,
        activity.metadata?.channel_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [activities, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedActivities = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, safePage]);

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

    const user = {
      id: userId,
      username,
      avatar: null,
      avatar_url: activity?.user?.avatar_url || activity?.metadata?.avatar_url || null,
    };

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

  // Search + pagination header used in every render branch so the
  // controls don't disappear during loading / empty / error states.
  const header = (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <h2 className="text-[var(--color-text)] font-semibold">Recent Activity</h2>
      <div className="relative w-full lg:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search activity..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] py-2 pl-9 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors focus:border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={cx(controlPanelSectionClass, "flex h-full min-h-0 flex-1 flex-col")}>
        {header}
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
      <div className={cx(controlPanelSectionClass, "flex h-full min-h-0 flex-1 flex-col")}>
        {header}
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
    <div className={cx(controlPanelSectionClass, "flex h-full min-h-0 flex-1 flex-col")}>
      {header}

      {filteredActivities.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="text-center text-[var(--color-text-secondary)]">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">
              {searchTerm.trim() ? "No activities match your search" : "No recent activity"}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Scrollable list area — fills remaining height in the tab
              so the activity feed can scroll independently of the page
              chrome and pagination footer. */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="space-y-3">
              {pagedActivities.map((activity: any) => {
                const { Icon: ActivityTypeIcon, color: activityColor } = getActivityStyle(activity.type);
                const parsedDesc = parseActivityDescription(activity);

                return (
                  <div key={activity.id} className={cx(controlPanelRowClass, "flex items-center space-x-3 cursor-pointer")}>
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${activityColor} 20%, var(--color-surface))`,
                        color: activityColor,
                      }}
                    >
                      <ActivityTypeIcon className="h-4 w-4" />
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
          </div>

          {/* Pagination footer. Hidden when the entire result set fits
              on a single page so we don't waste a row on a disabled
              control set. */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-secondary)] pt-3 text-sm text-[var(--color-text-secondary)]">
              <div>
                Showing {(safePage - 1) * PAGE_SIZE + 1}
                –
                {Math.min(safePage * PAGE_SIZE, filteredActivities.length)}
                {" of "}
                {filteredActivities.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-1 text-xs font-medium transition-colors hover:bg-[var(--color-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs tabular-nums">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-1 text-xs font-medium transition-colors hover:bg-[var(--color-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

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
