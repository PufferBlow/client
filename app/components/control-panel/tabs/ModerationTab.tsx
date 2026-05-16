/**
 * ModerationTab — three-pane mod queue: pending message reports, reported
 * users (aggregated), and (currently empty) automatic-moderation message
 * queue. Long-pressing a report opens an action sheet on touch devices.
 */
import React, { useEffect, useState } from "react";
import { getAuthTokenFromCookies } from "../../../services/user";
import {
  banUser,
  timeoutUser,
  fetchReports,
  resolveReport,
  type Report,
} from "../../../services/moderation";
import type { ShowToast } from "../../Toast";
import { Notice } from "../../ui/Notice";
import { ControlPanelAvatar } from "../ControlPanelAvatar";
import { UserProfileModal } from "../UserProfileModal";
import {
  cx,
  controlPanelSectionClass,
  controlPanelSegmentClass,
  controlPanelButtonClass,
  controlPanelInputClass,
  controlPanelRowClass,
} from "../shared";

// Moderation Tab Component
export function ModerationTab({
  showToast
}: {
  showToast: ShowToast;
}) {
  const [activeSubTab, setActiveSubTab] = useState<'reports' | 'users' | 'messages'>('reports');
  const [searchTerm, setSearchTerm] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);
  const [selectedMessageReportId, setSelectedMessageReportId] = useState<string | null>(null);
  const [touchTimeout, setTouchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [userProfileModal, setUserProfileModal] = useState<{
    isOpen: boolean;
    user: any;
    position?: { x: number; y: number };
    triggerRect?: DOMRect | null;
  }>({ isOpen: false, user: null });

  const messageReports = reports.filter(r => r.type === 'message_report');
  const userReports = reports.filter(r => r.type === 'user_report');

  // Group user reports by target user for the "Reported Users" tab
  const reportedUsersMap = userReports.reduce<Record<string, { userId: string; username: string; reportCount: number; lastReport: string; categories: string[] }>>((acc, r) => {
    const id = r.target_user?.id ?? 'unknown';
    if (!acc[id]) {
      acc[id] = { userId: id, username: r.target_user?.username ?? 'Unknown', reportCount: 0, lastReport: r.reported_at, categories: [] };
    }
    acc[id].reportCount += 1;
    if (r.reported_at > acc[id].lastReport) acc[id].lastReport = r.reported_at;
    if (r.category && !acc[id].categories.includes(r.category)) acc[id].categories.push(r.category);
    return acc;
  }, {});
  const reportedUsers = Object.values(reportedUsersMap);

  const loadReports = async () => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    setReportsLoading(true);
    setReportsError(null);
    try {
      const result = await fetchReports({ auth_token: authToken, limit: 200 });
      if (result.success && result.data) {
        setReports(result.data.reports);
      } else {
        setReportsError(result.error ?? 'Failed to load reports');
      }
    } catch {
      setReportsError('Failed to load reports');
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleResolveReport = async (reportId: string, action: 'delete' | 'warn' | 'ban' | 'dismiss') => {
    setSelectedMessageReportId(null);
    if (touchTimeout) { clearTimeout(touchTimeout); setTouchTimeout(null); }
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    setResolvingReportId(reportId);
    try {
      const result = await resolveReport(reportId, { auth_token: authToken, action });
      if (result.success) {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' as const } : r));
        showToast({
          message: `Report ${action === 'delete' ? 'deleted message' : action === 'warn' ? 'sent warning' : action === 'ban' ? 'banned user' : 'dismissed'} successfully.`,
          tone: 'success',
          category: 'destructive',
        });
      } else {
        showToast({ message: result.error ?? 'Failed to resolve report', tone: 'error', category: 'destructive' });
      }
    } finally {
      setResolvingReportId(null);
    }
  };

  const handleUserAction = async (userId: string, action: 'timeout' | 'ban') => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    try {
      if (action === 'ban') {
        const result = await banUser(userId, { auth_token: authToken });
        if (result.success) {
          showToast({ message: 'User banned successfully.', tone: 'success', category: 'destructive' });
        } else {
          showToast({ message: result.error ?? 'Failed to ban user', tone: 'error', category: 'destructive' });
        }
      } else {
        const result = await timeoutUser(userId, { auth_token: authToken, duration_minutes: 60 });
        if (result.success) {
          showToast({ message: 'User timed out for 60 minutes.', tone: 'success', category: 'destructive' });
        } else {
          showToast({ message: result.error ?? 'Failed to timeout user', tone: 'error', category: 'destructive' });
        }
      }
    } catch {
      showToast({ message: 'Action failed', tone: 'error', category: 'destructive' });
    }
  };

  const handleOpenUserProfile = (userId: string, username: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setUserProfileModal({
      isOpen: true,
      user: { id: userId, username, avatar: null, avatar_url: null, status: 'offline' as const },
      position: { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 5 },
      triggerRect: rect,
    });
  };

  const handleMessagePointerDown = (reportId: string) => {
    const timeout = setTimeout(() => {
      setSelectedMessageReportId(reportId);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
    setTouchTimeout(timeout);
  };

  const handleMessagePointerUp = () => {
    if (touchTimeout) { clearTimeout(touchTimeout); setTouchTimeout(null); }
  };

  const pendingCount = messageReports.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className={controlPanelSectionClass}>
        <div className="flex items-center space-x-4 mb-6">
          <button onClick={() => setActiveSubTab('reports')} className={controlPanelSegmentClass(activeSubTab === 'reports')}>
            Reports {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button onClick={() => setActiveSubTab('users')} className={controlPanelSegmentClass(activeSubTab === 'users')}>
            Reported Users {reportedUsers.length > 0 && `(${reportedUsers.length})`}
          </button>
          <button onClick={() => setActiveSubTab('messages')} className={controlPanelSegmentClass(activeSubTab === 'messages')}>
            Message Queue
          </button>
        </div>

        {/* Reports sub-tab */}
        {activeSubTab === 'reports' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-[var(--color-text)]">Reported Messages</h2>
              <div className="flex items-center space-x-2">
                <button onClick={loadReports} disabled={reportsLoading} className={controlPanelButtonClass('ghost')}>
                  {reportsLoading ? 'Loading…' : 'Refresh'}
                </button>
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cx(controlPanelInputClass, "w-64")}
                />
              </div>
            </div>

            {reportsLoading && (
              <div className="text-center text-[var(--color-text-secondary)] py-8">Loading reports…</div>
            )}
            {reportsError && !reportsLoading && (
              <div className="py-4">
                <Notice tone="error" message={reportsError} />
              </div>
            )}
            {!reportsLoading && !reportsError && (
              <div className="space-y-4">
                {messageReports
                  .filter(report =>
                    searchTerm === '' ||
                    report.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (report.reporter?.username ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (report.sender?.username ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (report.description ?? '').toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((report) => (
                    <div key={report.id} className={controlPanelRowClass}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2 flex-wrap gap-y-1">
                            {report.sender && (
                              <>
                                <span className="text-sm font-medium text-[var(--color-error)]">Message by</span>
                                <span
                                  onClick={(e) => handleOpenUserProfile(report.sender!.id, report.sender!.username, e)}
                                  className="cursor-pointer text-sm font-medium text-[var(--color-error)] hover:underline"
                                >
                                  {report.sender.username}
                                </span>
                                <span className="text-[var(--color-text-secondary)]">•</span>
                              </>
                            )}
                            <span className="text-[var(--color-text-secondary)] text-sm">Reported by</span>
                            {report.reporter ? (
                              <span
                                onClick={(e) => handleOpenUserProfile(report.reporter!.id, report.reporter!.username, e)}
                                className="text-[var(--color-text-secondary)] text-sm hover:text-[var(--color-text)] cursor-pointer hover:underline"
                              >
                                {report.reporter.username}
                              </span>
                            ) : (
                              <span className="text-[var(--color-text-secondary)] text-sm">Unknown</span>
                            )}
                            <span className={`rounded px-2 py-1 text-xs font-medium ${report.status === 'pending' ? 'bg-[var(--color-warning)] text-[var(--color-on-warning)]' : 'bg-[var(--color-success)] text-[var(--color-on-success)]'}`}>
                              {report.status}
                            </span>
                          </div>

                          {/* Message IDs */}
                          <div
                            className="mb-2 cursor-pointer rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-3 transition-colors duration-200 hover:bg-[var(--color-hover)]"
                            onPointerDown={() => handleMessagePointerDown(report.id)}
                            onPointerUp={handleMessagePointerUp}
                            onPointerLeave={handleMessagePointerUp}
                          >
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {(report.message_ids ?? []).length} message{(report.message_ids ?? []).length !== 1 ? 's' : ''} reported
                              {report.channel_ids && report.channel_ids.length > 0 && ` in ${report.channel_ids.length} channel${report.channel_ids.length !== 1 ? 's' : ''}`}
                            </p>
                          </div>

                          <div className="text-xs text-[var(--color-text-secondary)]">
                            {report.category} • {new Date(report.reported_at).toLocaleString()}
                          </div>
                          {report.description && (
                            <div className="text-xs text-[var(--color-text-muted)] mt-1">"{report.description}"</div>
                          )}
                        </div>
                      </div>
                      {report.status === 'pending' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleResolveReport(report.id, 'delete')}
                            disabled={resolvingReportId === report.id}
                            className={controlPanelButtonClass('danger')}
                          >
                            Delete Message
                          </button>
                          <button
                            onClick={() => handleResolveReport(report.id, 'warn')}
                            disabled={resolvingReportId === report.id}
                            className={controlPanelButtonClass('secondary')}
                          >
                            Warn User
                          </button>
                          <button
                            onClick={() => handleResolveReport(report.id, 'dismiss')}
                            disabled={resolvingReportId === report.id}
                            className={controlPanelButtonClass('ghost')}
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                {messageReports.length === 0 && (
                  <div className="text-center text-[var(--color-text-secondary)] py-8">No message reports</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reported Users sub-tab */}
        {activeSubTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-[var(--color-text)]">Reported Users</h2>
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cx(controlPanelInputClass, "w-64")}
              />
            </div>

            {reportsLoading && (
              <div className="text-center text-[var(--color-text-secondary)] py-8">Loading…</div>
            )}
            {!reportsLoading && (
              <div className="space-y-4">
                {reportedUsers
                  .filter(user =>
                    searchTerm === '' ||
                    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.categories.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map((user) => (
                    <div key={user.userId} className={controlPanelRowClass}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <ControlPanelAvatar
                            username={user.username}
                            avatarUrl={null}
                            className="h-10 w-10 rounded-full"
                          />
                          <div>
                            <div className="font-medium text-[var(--color-text)]">{user.username}</div>
                            <div className="text-[var(--color-text-secondary)] text-sm">{user.reportCount} report{user.reportCount !== 1 ? 's' : ''}</div>
                            <div className="text-[var(--color-text-muted)] text-xs">{user.categories.join(', ')}</div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUserAction(user.userId, 'timeout')}
                            className={controlPanelButtonClass('secondary')}
                          >
                            Timeout
                          </button>
                          <button
                            onClick={() => handleUserAction(user.userId, 'ban')}
                            className={controlPanelButtonClass('danger')}
                          >
                            Ban
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                {reportedUsers.length === 0 && (
                  <div className="text-center text-[var(--color-text-secondary)] py-8">No reported users</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Message Queue sub-tab */}
        {activeSubTab === 'messages' && (
          <div>
            <h2 className="mb-6 text-lg font-medium text-[var(--color-text)]">Message Moderation Queue</h2>
            <div className="text-center text-[var(--color-text-secondary)] py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p>No messages in moderation queue</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">
                All messages are currently passing automatic moderation
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Long-press message report modal */}
      {selectedMessageReportId && (() => {
        const report = messageReports.find(r => r.id === selectedMessageReportId);
        if (!report) return null;
        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[color:color-mix(in_srgb,var(--color-shadow-lg)_38%,transparent)] p-4">
            <div className="mx-auto w-full max-w-md rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)]">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[var(--color-text)]">Report Options</h3>
                  <button
                    onClick={() => setSelectedMessageReportId(null)}
                    className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="bg-[var(--color-surface-secondary)] rounded-lg p-4 mb-4">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {(report.message_ids ?? []).length} message{(report.message_ids ?? []).length !== 1 ? 's' : ''} — {report.category}
                  </p>
                  {report.description && <p className="text-xs text-[var(--color-text-secondary)] mt-1">"{report.description}"</p>}
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => handleResolveReport(report.id, 'delete')}
                    disabled={resolvingReportId === report.id}
                    className="rounded px-4 py-2 text-sm font-medium text-[var(--color-on-error)] transition-colors"
                    style={{ backgroundColor: 'var(--color-error)' }}
                  >
                    Delete Message
                  </button>
                  <button
                    onClick={() => handleResolveReport(report.id, 'warn')}
                    disabled={resolvingReportId === report.id}
                    className="rounded border px-4 py-2 text-sm font-medium text-[var(--color-on-warning)] transition-colors"
                    style={{ backgroundColor: 'var(--color-warning)', borderColor: 'color-mix(in srgb, var(--color-warning) 55%, transparent)' }}
                  >
                    Warn User
                  </button>
                  <button
                    onClick={() => handleResolveReport(report.id, 'dismiss')}
                    disabled={resolvingReportId === report.id}
                    className="rounded bg-[var(--color-surface-tertiary)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* User Profile Modal */}
      {userProfileModal.isOpen && (
        <UserProfileModal
          isOpen={true}
          onClose={() => setUserProfileModal({ isOpen: false, user: null })}
          user={userProfileModal.user}
          currentUserId=""
          position={userProfileModal.position}
          triggerRect={userProfileModal.triggerRect}
        />
      )}
    </div>
  );
}
