import React, { useState, useEffect, useRef } from "react";
import { getAuthTokenFromCookies, listUsers, type ListUsersResponse } from "../../services/user";
import { listChannels, deleteChannel, createChannel } from "../../services/channel";
import {
  getUserRegistrationsChart,
  getMessageActivityChart,
  getOnlineUsersChart,
  getChannelCreationChart,
  getUserStatusChart,
  getServerInfo,
  updateServerInfo,
  uploadServerAvatar,
  uploadServerBanner,
  getServerUsage,
  getActivityMetrics,
  getServerOverview,
  getServerLogs,
  getServerConfig,
  updateServerConfig,
  type Period,
  type ChartData,
  type RawStats,
  type ServerUsage,
  type ActivityMetrics,
  type ServerOverview,
  type RuntimeConfig,
} from "../../services/system";
import { convertToFullStorageUrl, listBlockedIPs, blockIP, unblockIP, createApiClient } from "../../services/apiClient";
import { listStorageFiles, deleteStorageFile, cleanupOrphanedFiles } from "../../services/storage";
import { banUser, timeoutUser, fetchReports, resolveReport, type Report } from "../../services/moderation";
import { getBackgroundTaskStatuses, runBackgroundTask, toggleBackgroundTask, getBackupConfig, updateBackupConfig } from "../../services/backgroundTasks";
import { logger } from "../../utils/logger";
import type { Channel } from "../../models";
import { Line, Bar, Pie } from "react-chartjs-2";
import { Hash, Mic } from "lucide-react";
import type { ShowToast } from "../Toast";
import { ModerationActionModal, type ModerationActionSubmit } from "../ModerationActionModal";
import {
  RoleBadgeList,
} from "./RoleManagement";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Notice } from "../ui/Notice";
import { renderFileTypeIcon } from "../../utils/fileTypeMeta";
import { ControlPanelAvatar, getControlPanelAvatarLabel } from "./ControlPanelAvatar";
import { UserProfileModal } from "./UserProfileModal";
import { RecentActivity } from "./RecentActivity";
import {
  cx,
  controlPanelSectionClass,
  controlPanelInsetClass,
  controlPanelQuietClass,
  controlPanelCardClass,
  controlPanelMetricClass,
  controlPanelChartCardClass,
  controlPanelRowClass,
  controlPanelInputClass,
  controlPanelTextAreaClass,
  controlPanelSelectClass,
  controlPanelButtonClass,
  controlPanelSegmentClass,
  controlPanelBadgeClass,
  formatCompactNumber,
} from "./shared";
import {
  resolveCssVar,
  hexToRgba,
  getControlPanelChartPalette,
  createChartOptions,
} from "./chartPalette";

export function TasksTab({
  showToast
}: {
  showToast: ShowToast;
}) {
  const [tasks, setTasks] = useState<Record<string, import('../../services/backgroundTasks').TaskInfo>>({});
  const [loading, setLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [showBackupConfig, setShowBackupConfig] = useState(false);
  const [backupConfig, setBackupConfig] = useState<import('../../services/backgroundTasks').BackupConfig>({
    enabled: false,
    mode: 'file',
    path: '',
    mirror_dsn: null,
    schedule_hours: 24,
    max_files: 7,
  });
  const [backupConfigLoading, setBackupConfigLoading] = useState(false);
  const [savingBackup, setSavingBackup] = useState(false);

  const loadTasks = async () => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    setLoading(true);
    try {
      const result = await getBackgroundTaskStatuses(authToken);
      if (result.success && result.data) {
        setTasks(result.data.tasks as Record<string, import('../../services/backgroundTasks').TaskInfo>);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadBackupConfig = async () => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    setBackupConfigLoading(true);
    try {
      const result = await getBackupConfig(authToken);
      if (result.success && result.data) {
        setBackupConfig(result.data.config);
      }
    } finally {
      setBackupConfigLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (showBackupConfig) loadBackupConfig();
  }, [showBackupConfig]);

  // Poll while any task is running
  useEffect(() => {
    const hasRunning = Object.values(tasks).some(t => t.running);
    if (!hasRunning) return;
    const timer = setInterval(loadTasks, 3000);
    return () => clearInterval(timer);
  }, [tasks]);

  const handleRunTask = async (taskId: string) => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    setRunningTaskId(taskId);
    try {
      const result = await runBackgroundTask(taskId, authToken);
      if (result.success) {
        showToast({ message: `Task started successfully.`, tone: 'success', category: 'info' });
        await loadTasks();
      } else {
        showToast({ message: result.error ?? 'Failed to run task', tone: 'error', category: 'info' });
      }
    } finally {
      setRunningTaskId(null);
    }
  };

  const handleToggleTask = async (taskId: string, currentEnabled: boolean) => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    const newEnabled = !currentEnabled;
    // Optimistic update
    setTasks(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], enabled: newEnabled },
    }));
    try {
      const result = await toggleBackgroundTask(taskId, newEnabled, authToken);
      if (!result.success) {
        // Revert
        setTasks(prev => ({
          ...prev,
          [taskId]: { ...prev[taskId], enabled: currentEnabled },
        }));
        showToast({ message: result.error ?? 'Failed to toggle task', tone: 'error', category: 'info' });
      }
    } catch {
      setTasks(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], enabled: currentEnabled },
      }));
    }
  };

  const handleSaveBackupConfig = async () => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    setSavingBackup(true);
    try {
      const result = await updateBackupConfig({
        auth_token: authToken,
        enabled: backupConfig.enabled,
        mode: backupConfig.mode,
        path: backupConfig.path || undefined,
        mirror_dsn: backupConfig.mirror_dsn || undefined,
        schedule_hours: backupConfig.schedule_hours,
        max_files: backupConfig.max_files,
      });
      if (result.success) {
        showToast({ message: 'Backup configuration saved.', tone: 'success', category: 'info' });
        await loadTasks();
      } else {
        showToast({ message: result.error ?? 'Failed to save backup config', tone: 'error', category: 'info' });
      }
    } finally {
      setSavingBackup(false);
    }
  };

  const statusColor = (task: import('../../services/backgroundTasks').TaskInfo) => {
    if (task.running) return 'text-[var(--color-success)]';
    if (!task.enabled) return 'text-[var(--color-text-muted)]';
    if (task.last_error && task.errors > 0) return 'text-[var(--color-error)]';
    return 'text-[var(--color-text-secondary)]';
  };

  const statusLabel = (task: import('../../services/backgroundTasks').TaskInfo) => {
    if (task.running) return 'running';
    if (!task.enabled) return 'disabled';
    if (task.last_error && task.errors > 0 && task.runs > 0 && task.errors === task.runs) return 'error';
    return 'idle';
  };

  const taskEntries = Object.entries(tasks);

  return (
    <div className="space-y-6">
      <div className={controlPanelSectionClass}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Background Tasks</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowBackupConfig(v => !v)}
              className={controlPanelButtonClass(showBackupConfig ? 'primary' : 'secondary')}
            >
              Backup Config
            </button>
            <button
              onClick={loadTasks}
              disabled={loading}
              className={controlPanelButtonClass('ghost')}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Backup Config Panel */}
        {showBackupConfig && (
          <div className="mb-6 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-5">
            <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Database Backup Configuration</h3>
            {backupConfigLoading ? (
              <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
            ) : (
              <div className="space-y-4">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text)]">Enable Backups</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Automatically back up the database on schedule</div>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={backupConfig.enabled}
                        onChange={e => setBackupConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors ${backupConfig.enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-tertiary)]'}`} />
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${backupConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </label>
                </div>

                {/* Mode */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Backup Mode</label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setBackupConfig(prev => ({ ...prev, mode: 'file' }))}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${backupConfig.mode === 'file' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]'}`}
                    >
                      File Dump
                    </button>
                    <button
                      onClick={() => setBackupConfig(prev => ({ ...prev, mode: 'mirror' }))}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${backupConfig.mode === 'mirror' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]'}`}
                    >
                      Mirror DB
                    </button>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {backupConfig.mode === 'file'
                      ? 'Creates a pg_dump (.dump) file on the server filesystem.'
                      : 'Pipes pg_dump directly into a secondary PostgreSQL instance.'}
                  </p>
                </div>

                {/* Mode-specific fields */}
                {backupConfig.mode === 'file' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Backup Directory</label>
                      <input
                        type="text"
                        value={backupConfig.path}
                        onChange={e => setBackupConfig(prev => ({ ...prev, path: e.target.value }))}
                        placeholder="~/.pufferblow/backups"
                        className={controlPanelInputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Max backup files to keep</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={backupConfig.max_files}
                        onChange={e => setBackupConfig(prev => ({ ...prev, max_files: parseInt(e.target.value, 10) || 7 }))}
                        className={cx(controlPanelInputClass, 'w-24')}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Mirror Database DSN</label>
                    <input
                      type="text"
                      value={backupConfig.mirror_dsn ?? ''}
                      onChange={e => setBackupConfig(prev => ({ ...prev, mirror_dsn: e.target.value || null }))}
                      placeholder="postgresql://user:pass@host:5432/dbname"
                      className={controlPanelInputClass}
                    />
                  </div>
                )}

                {/* Schedule */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Schedule (hours between backups)</label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={backupConfig.schedule_hours}
                    onChange={e => setBackupConfig(prev => ({ ...prev, schedule_hours: parseInt(e.target.value, 10) || 24 }))}
                    className={cx(controlPanelInputClass, 'w-24')}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveBackupConfig}
                    disabled={savingBackup}
                    className={controlPanelButtonClass('primary')}
                  >
                    {savingBackup ? 'Saving…' : 'Save Backup Config'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Task list */}
        {loading && taskEntries.length === 0 ? (
          <div className="text-center text-[var(--color-text-secondary)] py-8">Loading tasks…</div>
        ) : taskEntries.length === 0 ? (
          <div className="text-center text-[var(--color-text-secondary)] py-8">No background tasks registered.</div>
        ) : (
          <div className="space-y-3">
            {taskEntries.map(([taskId, task]) => {
              const isRunning = task.running || runningTaskId === taskId;
              const label = isRunning ? 'running' : statusLabel(task);
              const isDatabaseBackup = taskId === 'database_backup';

              return (
                <div key={taskId} className={controlPanelRowClass}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-1 flex-wrap gap-y-1">
                        <h3 className="text-base font-medium text-[var(--color-text)]">{task.name}</h3>
                        <span className={`flex items-center space-x-1 text-xs ${isRunning ? 'text-[var(--color-success)]' : !task.enabled ? 'text-[var(--color-text-muted)]' : label === 'error' ? 'text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}`}>
                          {isRunning ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : label === 'error' ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          <span>{label}</span>
                        </span>
                        <span className="rounded px-2 py-0.5 text-xs bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]">
                          {task.schedule_label}
                        </span>
                        {isDatabaseBackup && (
                          <span className="rounded px-2 py-0.5 text-xs bg-[color:color-mix(in_srgb,var(--color-primary)_20%,transparent)] text-[var(--color-primary)]">
                            Backup
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] mb-2">{task.description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                        <span>Runs: {task.runs}</span>
                        {task.errors > 0 && <span className="text-[var(--color-error)]">Errors: {task.errors}</span>}
                        {task.last_run && <span>Last: {new Date(task.last_run).toLocaleString()}</span>}
                        {task.next_run && task.enabled && !isRunning && (
                          <span>Next: {new Date(task.next_run).toLocaleString()}</span>
                        )}
                        {task.total_runtime > 0 && (
                          <span>Avg: {(task.total_runtime / Math.max(task.runs, 1)).toFixed(1)}s</span>
                        )}
                      </div>
                      {task.last_error && (
                        <div className="mt-1 text-xs text-[var(--color-error)] truncate max-w-md" title={task.last_error}>
                          Last error: {task.last_error}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <div
                        className="relative inline-block w-10 h-5 cursor-pointer"
                        onClick={() => handleToggleTask(taskId, task.enabled)}
                      >
                        <div className={`w-10 h-5 rounded-full transition-colors ${task.enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-tertiary)]'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${task.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                      <span className="text-sm text-[var(--color-text)]">{task.enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>

                    <div className="flex space-x-2">
                      {isDatabaseBackup && (
                        <button
                          onClick={() => setShowBackupConfig(v => !v)}
                          className={controlPanelButtonClass('ghost')}
                        >
                          Configure
                        </button>
                      )}
                      <button
                        onClick={() => handleRunTask(taskId)}
                        disabled={isRunning || !task.enabled}
                        className={`flex items-center space-x-1 rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isRunning ? 'bg-[var(--color-surface-tertiary)] text-[var(--color-text-muted)]' : 'bg-[var(--color-success)] text-[var(--color-on-success)] hover:opacity-90'}`}
                      >
                        {isRunning ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Running…</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Run Now</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Storage Tab Component
type StorageFile = {
  id: string;
  filename: string;
  subdirectory: string;
  size: number;
  type: string;
  uploaded_at: string;
  uploader: string;
  is_orphaned: boolean;
  url: string;
};

export function StorageTab({
  showToast,
  fileViewerModal,
  setFileViewerModal
}: {
  showToast: ShowToast;
  fileViewerModal: { isOpen: boolean; file: StorageFile | null };
  setFileViewerModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; file: StorageFile | null }>>;
}) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [browseDirectory, setBrowseDirectory] = useState('all');
  const [uploadDirectory, setUploadDirectory] = useState('uploads');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<StorageFile | null>(null);
  const [isCleaningOrphaned, setIsCleaningOrphaned] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const directories = [
    { value: 'all', label: 'All' },
    { value: 'uploads', label: 'Uploads' },
    { value: 'avatars', label: 'Avatars' },
    { value: 'banners', label: 'Banners' },
    { value: 'attachments', label: 'Attachments' },
    { value: 'images', label: 'Images' },
    { value: 'videos', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'documents', label: 'Documents' },
    { value: 'stickers', label: 'Stickers' },
    { value: 'gifs', label: 'GIFs' },
    { value: 'files', label: 'Files' },
  ];

  const uploadDirectories = directories.filter(d => d.value !== 'all');

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const loadFiles = async () => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) {
      setError('Authentication token not found');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await listStorageFiles(browseDirectory, authToken);
      if (response.success && response.data) {
        setFiles((response.data as any).files || []);
      } else {
        setError(response.error || 'Failed to load files');
        setFiles([]);
      }
    } catch {
      setError('Network error occurred');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiles(); }, [browseDirectory]);

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const authToken = getAuthTokenFromCookies();
    if (!authToken) {
      showToast({ message: 'Authentication token not found.', tone: 'error', category: 'system' });
      return;
    }
    setIsUploading(true);
    try {
      const results = await Promise.allSettled(
        Array.from(fileList).map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('directory', uploadDirectory);
          const apiClient = createApiClient();
          const response = await apiClient.post(
            `/api/v1/storage/upload?auth_token=${encodeURIComponent(authToken)}`,
            formData,
          );
          if (!response.success) throw new Error(response.error || `Upload failed for "${file.name}"`);
        })
      );
      const failed = results.filter(r => r.status === 'rejected');
      const succeeded = results.length - failed.length;
      if (failed.length > 0) {
        showToast({
          message: `${succeeded} uploaded, ${failed.length} failed.`,
          tone: succeeded > 0 ? 'warning' : 'error',
          category: 'system',
          dedupeKey: 'storage:upload:partial-failure',
        });
      } else {
        showToast({ message: `${succeeded} file${succeeded === 1 ? '' : 's'} uploaded.`, tone: 'success', category: 'system' });
      }
      await loadFiles();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Upload failed.', tone: 'error', category: 'system' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (file: StorageFile) => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    try {
      const response = await deleteStorageFile(file.url, authToken);
      if (response.success) {
        setFiles(prev => prev.filter(f => f.id !== file.id));
        showToast({ message: `"${file.filename}" deleted.`, tone: 'success', category: 'destructive' });
        setDeleteConfirmFile(null);
      } else {
        showToast({ message: `Failed to delete: ${response.error || 'Unknown error'}`, tone: 'error', category: 'system' });
      }
    } catch {
      showToast({ message: 'Network error while deleting file.', tone: 'error', category: 'system' });
    }
  };

  const handleCleanupOrphanedFiles = async () => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    setIsCleaningOrphaned(true);
    try {
      const response = await cleanupOrphanedFiles(browseDirectory === 'all' ? '' : browseDirectory, authToken);
      if (response.success) {
        showToast({
          message: `Cleaned up ${(response.data as any)?.deleted_count ?? 0} orphaned files.`,
          tone: 'success',
          category: 'destructive',
        });
        await loadFiles();
      } else {
        showToast({ message: `Cleanup failed: ${response.error || 'Unknown error'}`, tone: 'error', category: 'system' });
      }
    } catch {
      showToast({ message: 'Network error during cleanup.', tone: 'error', category: 'system' });
    } finally {
      setIsCleaningOrphaned(false);
    }
  };

  const handleCopyUrl = (file: StorageFile) => {
    const fullUrl = convertToFullStorageUrl(file.url);
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const filteredFiles = files.filter(file =>
    file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file.type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const imageCount = files.filter(f => f.type?.startsWith('image/')).length;
  const orphanedCount = files.filter(f => f.is_orphaned).length;

  return (
    <div className="space-y-4">
      {/* Header + Stats */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">Storage</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Manage files stored on this instance</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCleanupOrphanedFiles}
              disabled={isCleaningOrphaned || orphanedCount === 0}
              title={orphanedCount === 0 ? 'No orphaned files' : `Clean ${orphanedCount} orphaned file${orphanedCount === 1 ? '' : 's'}`}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}
            >
              {isCleaningOrphaned ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              {isCleaningOrphaned ? 'Cleaning…' : 'Clean Orphaned'}
            </button>
            <button
              onClick={() => setShowUpload(v => !v)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {[
            { label: 'Files', value: files.length.toLocaleString(), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'var(--color-primary)' },
            { label: 'Total size', value: formatFileSize(totalSize), icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', color: 'var(--color-success)' },
            { label: 'Images', value: imageCount.toLocaleString(), icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'var(--color-info)' },
            { label: 'Orphaned', value: orphanedCount.toLocaleString(), icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z', color: orphanedCount > 0 ? 'var(--color-error)' : 'var(--color-text-muted)' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-3 px-6 py-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 12%, transparent)` }}>
                <svg className="w-4 h-4" fill="none" stroke={stat.color} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={stat.icon} />
                </svg>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-secondary)]">{stat.label}</div>
                <div className="text-lg font-semibold text-[var(--color-text)] leading-tight">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload panel (collapsible) */}
      {showUpload && (
        <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text)]">Upload files</h3>
            <button onClick={() => setShowUpload(false)} className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex-1">
              <input
                type="file"
                multiple
                onChange={(e) => { handleFileUpload(e.target.files); e.target.value = ''; }}
                accept="image/*,video/*,audio/*,application/pdf,text/plain,application/zip"
                className="hidden"
                id="storage-file-upload"
              />
              <label
                htmlFor="storage-file-upload"
                className="flex flex-col items-center justify-center w-full border-2 border-dashed border-[var(--color-border)] rounded-lg p-8 cursor-pointer transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-secondary)]/30"
                style={{ pointerEvents: isUploading ? 'none' : 'auto', opacity: isUploading ? 0.6 : 1 }}
              >
                {isUploading ? (
                  <svg className="w-8 h-8 animate-spin text-[var(--color-primary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-[var(--color-text-secondary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
                <span className="text-sm font-medium text-[var(--color-text)]">{isUploading ? 'Uploading…' : 'Click to select files'}</span>
                <span className="text-xs text-[var(--color-text-secondary)] mt-1">Images, video, audio, PDF, ZIP · multiple supported</span>
              </label>
            </div>

            <div className="sm:w-48 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Upload to</label>
                <select
                  value={uploadDirectory}
                  onChange={(e) => setUploadDirectory(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                >
                  {uploadDirectories.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File browser */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        {/* Controls */}
        <div className="px-5 pt-4 pb-3 border-b border-[var(--color-border)] space-y-3">
          {/* Directory tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
            {directories.map(dir => (
              <button
                key={dir.value}
                onClick={() => setBrowseDirectory(dir.value)}
                className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                style={
                  browseDirectory === dir.value
                    ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)' }
                    : { backgroundColor: 'var(--color-surface-secondary)', color: 'var(--color-text-secondary)' }
                }
              >
                {dir.label}
                {dir.value !== 'all' && files.filter(f => f.subdirectory === dir.value).length > 0 && (
                  <span className="ml-1 opacity-60">{files.filter(f => f.subdirectory === dir.value).length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or type…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] pl-9 pr-4 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* File list */}
        <div className="divide-y divide-[var(--color-border)]">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-tertiary)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-[var(--color-surface-tertiary)] rounded w-48" />
                    <div className="h-3 bg-[var(--color-surface-tertiary)] rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-[var(--color-error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-[var(--color-error)] mb-3">{error}</p>
              <button onClick={loadFiles} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]">Retry</button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                {searchTerm ? 'No files match your search' : `No files in ${browseDirectory === 'all' ? 'storage' : browseDirectory}`}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {searchTerm ? 'Try different keywords' : 'Upload files to get started'}
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-surface-secondary)]/50 transition-colors group">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-lg bg-[var(--color-surface-secondary)] text-base">
                  {renderFileTypeIcon({ filename: file.filename, mimeType: file.type || '', size: 'md' })}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--color-text)]">{file.filename}</span>
                    {file.is_orphaned && (
                      <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 15%, transparent)', color: 'var(--color-error)' }}>
                        orphaned
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--color-text-muted)]">
                    <span>{formatFileSize(file.size)}</span>
                    <span>·</span>
                    <span className="truncate max-w-[140px]" title={file.type}>{file.type || '—'}</span>
                    <span>·</span>
                    <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                    {file.subdirectory && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{file.subdirectory}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleCopyUrl(file)}
                    className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tertiary)] transition-colors"
                    title="Copy URL"
                  >
                    {copiedId === file.id ? (
                      <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setFileViewerModal({ isOpen: true, file })}
                    className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-tertiary)] transition-colors"
                    title="Preview"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmFile(file)}
                    className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-tertiary)] transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {filteredFiles.length > 0 && (
          <div className="px-5 py-2.5 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            {filteredFiles.length} file{filteredFiles.length === 1 ? '' : 's'}{searchTerm ? ' matching' : ''}
            {' · '}{formatFileSize(filteredFiles.reduce((s, f) => s + f.size, 0))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,var(--color-shadow-lg)_50%,transparent)] p-4">
          <div className="mx-auto w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[var(--color-text)]">Delete file</h3>
                <button onClick={() => setDeleteConfirmFile(null)} className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors rounded-md">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-lg bg-[var(--color-surface-tertiary)] text-base">
                  {renderFileTypeIcon({ filename: deleteConfirmFile.filename, mimeType: deleteConfirmFile.type || '', size: 'md' })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{deleteConfirmFile.filename}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{formatFileSize(deleteConfirmFile.size)} · {deleteConfirmFile.type}</p>
                </div>
              </div>

              <div className="mb-5 rounded-lg p-3.5" style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-error) 25%, transparent)' }}>
                <p className="text-xs text-[var(--color-text)]">
                  <span className="font-medium text-[var(--color-error)]">Permanent action. </span>
                  This file will be removed from storage and cannot be recovered.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteConfirmFile(null)} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteFile(deleteConfirmFile)}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  style={{ backgroundColor: 'var(--color-error)', color: 'var(--color-on-error)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete file
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Overview Tab Component

export function OverviewTab({ onSettingsClick }: { onSettingsClick: () => void }) {
  const [viewMode, setViewMode] = useState<'numbers' | 'diagram'>('numbers');
  const [bannerExpanded, setBannerExpanded] = useState(false);
  const [chartData, setChartData] = useState<{
    userRegistrations?: ChartData;
    messageActivity?: ChartData;
    onlineUsers?: ChartData;
    channelCreation?: ChartData;
    userStatus?: ChartData;
  }>({});
  const [rawStats, setRawStats] = useState<{
    userRegistrations?: RawStats;
    messageActivity?: RawStats;
    onlineUsers?: RawStats;
    channelCreation?: RawStats;
    userStatus?: RawStats;
  }>({});
  const [serverUsage, setServerUsage] = useState<ServerUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>({ period: '7d' });
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetrics | null>(null);
  const [serverOverview, setServerOverview] = useState<ServerOverview | null>(null);

  // Load chart data and server usage
  useEffect(() => {
    const loadChartData = async () => {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        setError('Authentication token not found');
        return;
      }

      setLoading(true);
      setError(null);

      // Load activity metrics and server overview
      try {
        const [activityMetricsRes, serverOverviewRes] = await Promise.allSettled([
          getActivityMetrics(authToken),
          getServerOverview(authToken)
        ]);

        if (activityMetricsRes.status === 'fulfilled' && activityMetricsRes.value.success && activityMetricsRes.value.data) {
          setActivityMetrics(activityMetricsRes.value.data.activity_metrics);
        }

        if (serverOverviewRes.status === 'fulfilled' && serverOverviewRes.value.success && serverOverviewRes.value.data) {
          setServerOverview(serverOverviewRes.value.data.server_overview);
        }
      } catch (err) {
        console.error('Failed to load activity metrics/server overview:', err);
      }

      try {
        const [
          serverUsageRes,
          userRegistrationsRes,
          messageActivityRes,
          onlineUsersRes,
          channelCreationRes,
          userStatusRes
        ] = await Promise.allSettled([
          getServerUsage(),
          getUserRegistrationsChart(selectedPeriod, authToken),
          getMessageActivityChart(selectedPeriod, authToken),
          getOnlineUsersChart(selectedPeriod, authToken),
          getChannelCreationChart(selectedPeriod, authToken),
          getUserStatusChart(authToken)
        ]);

        // Handle server usage
        if (serverUsageRes.status === 'fulfilled') {
          if (serverUsageRes.value.success && serverUsageRes.value.data) {
            console.log('Server usage data received:', serverUsageRes.value.data.server_usage);
            setServerUsage(serverUsageRes.value.data.server_usage);
            setUsageLoading(false);
          } else {
            console.error('Server usage API failed:', serverUsageRes.value?.error);
            setUsageError('Failed to load server usage data');
            setUsageLoading(false);
          }
        } else {
          console.error('Server usage API promise rejected:', serverUsageRes.reason);
          setUsageError('Failed to load server usage data');
          setUsageLoading(false);
        }

        const newChartData: typeof chartData = {};
        const newRawStats: typeof rawStats = {};

        // Helper function to format chart data for Chart.js
        const formatChartData = (backendData: any, chartType: string) => {
          if (!backendData || typeof backendData !== 'object') {
            return null;
          }

          // If already in Chart.js format, return as-is
          if ('labels' in backendData && 'datasets' in backendData && Array.isArray(backendData.datasets)) {
            return backendData;
          }

          // If backend returns a different format, try to transform it
          // This is a fallback for various possible backend response formats
          try {
            let labels: string[] = [];
            let data: number[] = [];

            // Handle different possible data formats from backend
            if (Array.isArray(backendData)) {
              labels = backendData.map(item => item.label || item.name || item.x || `Item ${backendData.indexOf(item) + 1}`);
              data = backendData.map(item => parseFloat(item.value || item.y || item.data || 0));
            } else if (typeof backendData === 'object') {
              // Handle object format
              labels = Object.keys(backendData).filter(key => key !== 'labels' && key !== 'datasets');
              data = Object.values(backendData).filter(val => typeof val === 'number' && !labels.includes(val as any)) as number[];
            }

            // Ensure we have valid data
            if (labels.length === 0 && data.length === 0) {
              labels = ['No Data'];
              data = [0];
            }

            const palette = getControlPanelChartPalette();
            const normalizedType = chartType.toLowerCase();
            const chartKind =
              normalizedType.includes("status")
                ? "pie"
                : normalizedType.includes("message") || normalizedType.includes("channel")
                  ? "bar"
                  : "line";

            const chartColors =
              chartKind === "pie"
                ? {
                    backgroundColor: [
                      palette.successFill,
                      palette.infoFill,
                      palette.warningFill,
                      palette.errorFill,
                      palette.neutralFill,
                    ],
                    borderColor: [
                      palette.successStroke,
                      palette.infoStroke,
                      palette.warningStroke,
                      palette.errorStroke,
                      palette.neutralStroke,
                    ],
                    borderWidth: 1,
                    hoverOffset: 6,
                  }
                : chartKind === "bar"
                  ? {
                      backgroundColor: labels.map((_, index) =>
                        [
                          palette.neutralFill,
                          palette.infoFill,
                          palette.successFill,
                          palette.warningFill,
                          palette.errorFill,
                        ][index % 5],
                      ),
                      borderColor: labels.map((_, index) =>
                        [
                          palette.neutralStroke,
                          palette.infoStroke,
                          palette.successStroke,
                          palette.warningStroke,
                          palette.errorStroke,
                        ][index % 5],
                      ),
                      borderWidth: 1,
                      borderRadius: 8,
                      borderSkipped: false,
                      maxBarThickness: 28,
                    }
                  : {
                      borderColor: normalizedType.includes("online")
                        ? palette.successStroke
                        : normalizedType.includes("registration")
                          ? palette.infoStroke
                          : palette.neutralStroke,
                      backgroundColor: normalizedType.includes("online")
                        ? palette.successFill
                        : normalizedType.includes("registration")
                          ? palette.infoFill
                          : palette.neutralFill,
                      borderWidth: 2,
                      tension: 0.34,
                      fill: true,
                      pointRadius: 0,
                      pointHoverRadius: 4,
                      pointHitRadius: 18,
                    };

            return {
              labels: labels,
              datasets: [{
                label: chartType,
                data: data,
                ...chartColors,
              }]
            };

          } catch (error) {
            logger.api.error(`Failed to format chart data for ${chartType}`, { backendData, error });
            return null;
          }
        };

        const userRegistrationsData = userRegistrationsRes.status === 'fulfilled' && userRegistrationsRes.value.success && userRegistrationsRes.value.data
          ? formatChartData(userRegistrationsRes.value.data.chart_data, 'User Registrations')
          : null;
        if (userRegistrationsData) {
          newChartData.userRegistrations = userRegistrationsData;
        }
        if (userRegistrationsRes.status === 'fulfilled' && userRegistrationsRes.value.success && userRegistrationsRes.value.data?.raw_stats) {
          newRawStats.userRegistrations = userRegistrationsRes.value.data.raw_stats;
        }

        const messageActivityData = messageActivityRes.status === 'fulfilled' && messageActivityRes.value.success && messageActivityRes.value.data
          ? formatChartData(messageActivityRes.value.data.chart_data, 'Message Activity')
          : null;
        if (messageActivityData) {
          newChartData.messageActivity = messageActivityData;
        }
        if (messageActivityRes.status === 'fulfilled' && messageActivityRes.value.success && messageActivityRes.value.data?.raw_stats) {
          newRawStats.messageActivity = messageActivityRes.value.data.raw_stats;
        }

        const onlineUsersData = onlineUsersRes.status === 'fulfilled' && onlineUsersRes.value.success && onlineUsersRes.value.data
          ? formatChartData(onlineUsersRes.value.data.chart_data, 'Online Users')
          : null;
        if (onlineUsersData) {
          newChartData.onlineUsers = onlineUsersData;
        }
        if (onlineUsersRes.status === 'fulfilled' && onlineUsersRes.value.success && onlineUsersRes.value.data?.raw_stats) {
          newRawStats.onlineUsers = onlineUsersRes.value.data.raw_stats;
        }

        const channelCreationData = channelCreationRes.status === 'fulfilled' && channelCreationRes.value.success && channelCreationRes.value.data
          ? formatChartData(channelCreationRes.value.data.chart_data, 'Channel Creation')
          : null;
        if (channelCreationData) {
          newChartData.channelCreation = channelCreationData;
        }
        if (channelCreationRes.status === 'fulfilled' && channelCreationRes.value.success && channelCreationRes.value.data?.raw_stats) {
          newRawStats.channelCreation = channelCreationRes.value.data.raw_stats;
        }

        const userStatusData = userStatusRes.status === 'fulfilled' && userStatusRes.value.success && userStatusRes.value.data
          ? formatChartData(userStatusRes.value.data.chart_data, 'User Status')
          : null;
        if (userStatusData) {
          newChartData.userStatus = userStatusData;
        }
        if (userStatusRes.status === 'fulfilled' && userStatusRes.value.success && userStatusRes.value.data?.raw_stats) {
          newRawStats.userStatus = userStatusRes.value.data.raw_stats;
        }

        setChartData(newChartData);
        setRawStats(newRawStats);

        // Check if any requests failed and set appropriate error
        const failedRequests = [
          serverUsageRes,
          userRegistrationsRes,
          messageActivityRes,
          onlineUsersRes,
          channelCreationRes,
          userStatusRes
        ].filter(res => res.status === 'rejected' || (res.status === 'fulfilled' && !res.value.success));

        if (failedRequests.length > 0) {
          setError('Some chart data could not be loaded');
        }

      } catch (err) {
        setError('Failed to load chart data');
        logger.api.error('Failed to load chart data', err);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [selectedPeriod]);

  // Period selector component
  const PeriodSelector = () => (
    <div className="mb-4 flex flex-wrap gap-2">
      {(['1h', '24h', '7d', '30d', '90d', '1y'] as const).map((period) => (
        <button
          key={period}
          onClick={() => setSelectedPeriod({ period })}
          className={controlPanelSegmentClass(selectedPeriod.period === period)}
        >
          {period}
        </button>
      ))}
    </div>
  );

  const [serverInfo, setServerInfo] = useState<{
    server_name: string;
    version: string;
    creation_date: string | null;
    max_users: number | null;
    is_private?: boolean;
    total_users?: number;
    server_description?: string;
    avatar_url?: string | null;
    banner_url?: string | null;
  } | null>(null);

  // Load server info for overview
  useEffect(() => {
    const loadServerInfo = async () => {
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) return;

      try {
        const response = await getServerInfo();
        if (response.success && response.data) {
          setServerInfo(response.data.server_info ? response.data.server_info : null);
        }
      } catch (err) {
        logger.api.error('Failed to load server info for overview', err);
      }
    };

    loadServerInfo();
  }, []);

  const refreshUsage = async () => {
    setUsageLoading(true);
    setUsageError(null);

    try {
      const response = await getServerUsage();
      if (response.success && response.data) {
        setServerUsage(response.data.server_usage);
      } else {
        setUsageError('Failed to load server usage data');
      }
    } catch (err) {
      setUsageError('Failed to load server usage data');
      logger.api.error('Failed to refresh server usage data', err);
    } finally {
      setUsageLoading(false);
    }
  };

  const getUsageTone = (value: number) => {
    if (value >= 85) return 'var(--color-error)';
    if (value >= 65) return 'var(--color-warning)';
    if (value >= 45) return 'var(--color-info)';
    return 'var(--color-success)';
  };

  const MetricCard = ({
    label,
    value,
    detail,
    tone = 'neutral',
  }: {
    label: string;
    value: string;
    detail?: string;
    tone?: 'neutral' | 'success' | 'warning' | 'info';
  }) => (
    <div className={controlPanelMetricClass}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          {label}
        </span>
        <span className={controlPanelBadgeClass(tone)}>{tone === 'neutral' ? 'Live' : tone}</span>
      </div>
      <div className="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">{value}</div>
      {detail ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{detail}</p> : null}
    </div>
  );

  const OverviewInfoCard = ({
    title,
    items,
  }: {
    title: string;
    items: Array<{ label: string; value: string }>;
  }) => (
    <div className={controlPanelInsetClass}>
      <h3 className="mb-4 text-base font-semibold tracking-[-0.02em] text-[var(--color-text)]">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 border-b border-[var(--color-border-secondary)] pb-3 last:border-b-0 last:pb-0"
          >
            <span className="text-sm text-[var(--color-text-secondary)]">{item.label}</span>
            <span className="text-sm font-medium text-[var(--color-text)]">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const UsageCard = ({
    label,
    value,
    detail,
    accent,
  }: {
    label: string;
    value: number;
    detail: string;
    accent: string;
  }) => (
    <div className={controlPanelCardClass}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">{label}</span>
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">{value}%</span>
      </div>
      <div className="mb-3 h-2 rounded-full bg-[var(--color-background)]">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(value, 100))}%`, backgroundColor: accent }}
        />
      </div>
      <div className="text-sm text-[var(--color-text-secondary)]">{detail}</div>
    </div>
  );

  const ChartPanel = ({
    title,
    description,
    children,
  }: {
    title: string;
    description: string;
    children: React.ReactNode;
  }) => (
    <div className={controlPanelChartCardClass}>
      <div className="mb-4">
        <h4 className="text-base font-semibold tracking-[-0.02em] text-[var(--color-text)]">{title}</h4>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
      </div>
      <div className="h-72">{children}</div>
    </div>
  );

  const primaryDescription = serverInfo?.server_description?.trim();
  const overviewMetrics = [
    {
      label: 'Online now',
      value: formatCompactNumber(activityMetrics?.current_online ?? rawStats.onlineUsers?.currently_online),
      detail: `${formatCompactNumber(serverOverview?.active_users ?? activityMetrics?.active_users_24h)} active over the last 24h`,
      tone: 'success' as const,
    },
    {
      label: 'Total members',
      value: formatCompactNumber(serverOverview?.total_users ?? activityMetrics?.total_users ?? rawStats.userRegistrations?.total_users),
      detail: `+${formatCompactNumber(rawStats.userRegistrations?.new_this_week)} joined this week`,
      tone: 'info' as const,
    },
    {
      label: 'Messages',
      value: formatCompactNumber(serverOverview?.messages_this_period ?? rawStats.messageActivity?.messages_today),
      detail: `${formatCompactNumber(serverOverview?.messages_last_hour ?? activityMetrics?.messages_per_hour)} in the last hour`,
      tone: 'neutral' as const,
    },
    {
      label: 'Channels',
      value: formatCompactNumber(serverOverview?.total_channels ?? activityMetrics?.total_channels ?? rawStats.channelCreation?.total_channels),
      detail: `${formatCompactNumber(rawStats.channelCreation?.public_channels)} public / ${formatCompactNumber(rawStats.channelCreation?.private_channels)} private`,
      tone: 'warning' as const,
    },
  ];

  const overviewCards = [
    {
      title: 'Community snapshot',
      items: [
        { label: 'Active users', value: formatCompactNumber(serverOverview?.active_users ?? activityMetrics?.active_users_24h) },
        { label: 'Recently active', value: formatCompactNumber(rawStats.userRegistrations?.recently_active) },
        { label: 'Engagement rate', value: activityMetrics?.engagement_rate != null ? `${activityMetrics.engagement_rate}%` : '—' },
        { label: 'Messages per active user', value: activityMetrics?.messages_per_active_user != null ? `${activityMetrics.messages_per_active_user}` : '—' },
      ],
    },
    {
      title: 'Server details',
      items: [
        { label: 'Version', value: serverInfo?.version || '—' },
        { label: 'Visibility', value: serverInfo?.is_private ? 'Private' : 'Public' },
        { label: 'Created', value: serverInfo?.creation_date ? new Date(serverInfo.creation_date).toLocaleDateString() : 'Unknown' },
        { label: 'Member cap', value: serverInfo?.max_users ? `${serverInfo.max_users.toLocaleString()} members` : 'Unlimited' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {serverInfo ? (
        <section className={controlPanelSectionClass}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-1 items-start gap-4">
              {serverInfo.avatar_url ? (
                <img
                  src={convertToFullStorageUrl(serverInfo.avatar_url)}
                  alt={serverInfo.server_name}
                  className="h-16 w-16 rounded-[1.25rem] border border-[var(--color-border-secondary)] object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] text-2xl font-semibold text-[var(--color-text)]">
                  {serverInfo.server_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className={controlPanelBadgeClass('success')}>Instance online</span>
                  <span className={controlPanelBadgeClass('neutral')}>Version {serverInfo.version}</span>
                  <span className={controlPanelBadgeClass('neutral')}>
                    {serverInfo.is_private ? 'Invite only' : 'Public access'}
                  </span>
                </div>
                <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text)]">
                  {serverInfo.server_name}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  {primaryDescription
                    ? bannerExpanded || primaryDescription.length <= 180
                      ? primaryDescription
                      : `${primaryDescription.slice(0, 180)}...`
                    : 'Set a short description so admins can immediately understand the purpose of this instance.'}
                </p>
                {primaryDescription && primaryDescription.length > 180 ? (
                  <button
                    onClick={() => setBannerExpanded((value) => !value)}
                    className="mt-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                  >
                    {bannerExpanded ? 'Show less' : 'Read full description'}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={onSettingsClick} className={controlPanelButtonClass('secondary')}>
                Instance settings
              </button>
              <button onClick={refreshUsage} disabled={usageLoading} className={controlPanelButtonClass('ghost')}>
                {usageLoading ? 'Refreshing…' : 'Refresh usage'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className={controlPanelSectionClass}>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">Overview</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              A calmer snapshot of growth, activity, and system health for this instance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setViewMode('numbers')} className={controlPanelSegmentClass(viewMode === 'numbers')}>
              Summary
            </button>
            <button onClick={() => setViewMode('diagram')} className={controlPanelSegmentClass(viewMode === 'diagram')}>
              Charts
            </button>
          </div>
        </div>

        {viewMode === 'numbers' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {overviewMetrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  detail={metric.detail}
                  tone={metric.tone}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className={controlPanelInsetClass}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold tracking-[-0.02em] text-[var(--color-text)]">
                      Resource health
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Live host metrics with clearer thresholds and less visual noise.
                    </p>
                  </div>
                  <span className={controlPanelBadgeClass(usageError ? 'danger' : 'info')}>
                    {usageError ? 'Issue' : 'Live telemetry'}
                  </span>
                </div>

                {usageLoading ? (
                  <div className={controlPanelQuietClass}>
                    <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                      <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Collecting current resource usage
                    </div>
                  </div>
                ) : usageError ? (
                  <div className={cx(controlPanelQuietClass, 'pb-status-danger')}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--color-text)]">Resource monitoring unavailable</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{usageError}</p>
                      </div>
                      <button onClick={refreshUsage} className={controlPanelButtonClass('danger')}>
                        Retry
                      </button>
                    </div>
                  </div>
                ) : serverUsage ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <UsageCard
                        label="CPU"
                        value={serverUsage.cpu_percent}
                        detail="Processor utilization"
                        accent={getUsageTone(serverUsage.cpu_percent)}
                      />
                      <UsageCard
                        label="Memory"
                        value={serverUsage.ram_percent}
                        detail={`${serverUsage.ram_used_gb}GB of ${serverUsage.ram_total_gb}GB in use`}
                        accent={getUsageTone(serverUsage.ram_percent)}
                      />
                      <UsageCard
                        label="Storage"
                        value={serverUsage.storage_percent}
                        detail={`${serverUsage.storage_used_gb}GB of ${serverUsage.storage_total_gb}GB used`}
                        accent={getUsageTone(serverUsage.storage_percent)}
                      />
                      <div className={controlPanelCardClass}>
                        <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                          Disk I/O
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[var(--color-text-secondary)]">Read</span>
                            <span className="text-sm font-medium text-[var(--color-text)]">{serverUsage.disk_read_mb_per_sec} MB/s</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[var(--color-text-secondary)]">Write</span>
                            <span className="text-sm font-medium text-[var(--color-text)]">{serverUsage.disk_write_mb_per_sec} MB/s</span>
                          </div>
                          <div className="border-t border-[var(--color-border-secondary)] pt-3 text-sm text-[var(--color-text-secondary)]">
                            Uptime {serverUsage.uptime_formatted}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={controlPanelQuietClass}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <span className={controlPanelBadgeClass('success')}>System online</span>
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            Last updated {new Date(serverUsage.timestamp * 1000).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          Messages/hour {activityMetrics?.messages_per_hour ?? '—'} and {activityMetrics?.channel_utilization ?? '—'}% channel utilization
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={controlPanelQuietClass}>
                    <p className="text-sm text-[var(--color-text-secondary)]">No usage data is available yet.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6">
                {overviewCards.map((card) => (
                  <OverviewInfoCard key={card.title} title={card.title} items={card.items} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <PeriodSelector />

            {loading ? (
              <div className={controlPanelQuietClass}>
                <div className="flex min-h-56 flex-col items-center justify-center text-center">
                  <svg className="mb-3 h-5 w-5 animate-spin text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <h3 className="text-base font-semibold text-[var(--color-text)]">Loading chart data</h3>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Fetching recent instance metrics.</p>
                </div>
              </div>
            ) : error ? (
              <div className={cx(controlPanelQuietClass, 'pb-status-danger')}>
                <div className="flex min-h-56 flex-col items-center justify-center text-center">
                  <h3 className="text-base font-semibold text-[var(--color-text)]">Charts unavailable</h3>
                  <p className="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">{error}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {chartData.userRegistrations ? (
                  <ChartPanel
                    title="User registrations"
                    description="New account creation across the selected period."
                  >
                    <Line data={chartData.userRegistrations} options={createChartOptions('line')} />
                  </ChartPanel>
                ) : null}

                {chartData.messageActivity ? (
                  <ChartPanel
                    title="Message activity"
                    description="Volume of messages sent during the selected period."
                  >
                    <Bar data={chartData.messageActivity} options={createChartOptions('bar')} />
                  </ChartPanel>
                ) : null}

                {chartData.onlineUsers ? (
                  <ChartPanel
                    title="Online users"
                    description="Observed online presence snapshots over time."
                  >
                    <Line data={chartData.onlineUsers} options={createChartOptions('line')} />
                  </ChartPanel>
                ) : null}

                {chartData.channelCreation ? (
                  <ChartPanel
                    title="Channel creation"
                    description="How quickly the server structure is growing."
                  >
                    <Bar data={chartData.channelCreation} options={createChartOptions('bar')} />
                  </ChartPanel>
                ) : null}

                {chartData.userStatus ? (
                  <ChartPanel
                    title="Presence distribution"
                    description="Current split between online, away, and offline users."
                  >
                    <Pie data={chartData.userStatus} options={createChartOptions('pie')} />
                  </ChartPanel>
                ) : null}

                {Object.keys(chartData).length === 0 && !loading ? (
                  <div className={controlPanelQuietClass}>
                    <div className="flex min-h-56 flex-col items-center justify-center text-center">
                      <h3 className="text-base font-semibold text-[var(--color-text)]">No chart data yet</h3>
                      <p className="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
                        The server has not provided chart data for the selected window.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </section>

      <RecentActivity />

    </div>
  );
}



// Settings Tab Component
export function SettingsTab({
  showToast
}: {
  showToast: ShowToast;
}) {
  const voiceQualityRuntimeKeys = new Set([
    'RTC_DEFAULT_QUALITY_PROFILE',
    'RTC_AUDIO_SAMPLE_RATE_HZ',
    'RTC_AUDIO_CHANNELS',
    'RTC_AUDIO_STEREO_ENABLED',
    'RTC_AUDIO_DTX_ENABLED',
    'RTC_AUDIO_FEC_ENABLED',
    'RTC_AUDIO_BITRATE_LOW_KBPS',
    'RTC_AUDIO_BITRATE_BALANCED_KBPS',
    'RTC_AUDIO_BITRATE_HIGH_KBPS',
    'RTC_VIDEO_BITRATE_LOW_KBPS',
    'RTC_VIDEO_BITRATE_BALANCED_KBPS',
    'RTC_VIDEO_BITRATE_HIGH_KBPS',
    'RTC_VIDEO_WIDTH_LOW',
    'RTC_VIDEO_WIDTH_BALANCED',
    'RTC_VIDEO_WIDTH_HIGH',
    'RTC_VIDEO_HEIGHT_LOW',
    'RTC_VIDEO_HEIGHT_BALANCED',
    'RTC_VIDEO_HEIGHT_HIGH',
    'RTC_VIDEO_FPS_LOW',
    'RTC_VIDEO_FPS_BALANCED',
    'RTC_VIDEO_FPS_HIGH',
  ]);
  const serializeExtensions = (extensions?: string[] | null) =>
    extensions && extensions.length > 0 ? extensions.join(', ') : undefined;

  const parseExtensions = (value?: string) =>
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean);
  const getRuntimeNumber = (key: string, fallback: number) =>
    typeof runtimeConfig[key] === 'number' ? (runtimeConfig[key] as number) : fallback;
  const getRuntimeBoolean = (key: string, fallback: boolean) =>
    typeof runtimeConfig[key] === 'boolean' ? (runtimeConfig[key] as boolean) : fallback;
  const getRuntimeString = (key: string, fallback: string) =>
    typeof runtimeConfig[key] === 'string' ? (runtimeConfig[key] as string) : fallback;

  const [serverInfo, setServerInfo] = useState<{
    server_name: string;
    server_description: string;
    version: string;
    max_users: number | null;
    is_private: boolean;
    creation_date: string | null;
    max_message_length?: number;
    max_image_size?: number;
    max_video_size?: number;
    max_sticker_size?: number;
    max_gif_size?: number;
    max_audio_size?: number;
    max_file_size?: number;
    max_total_attachment_size?: number;
    allowed_image_types?: string;
    allowed_video_types?: string;
    allowed_file_types?: string;
    allowed_sticker_types?: string;
    allowed_gif_types?: string;
    allowed_audio_types?: string;
    avatar_url?: string | null;
    banner_url?: string | null;
  }>({
    server_name: 'Loading...',
    server_description: 'Loading...',
    version: 'Loading...',
    max_users: null,
    is_private: false,
    creation_date: null,
    max_message_length: undefined,
    max_image_size: undefined,
    max_video_size: undefined,
    max_sticker_size: undefined,
    max_gif_size: undefined,
    max_audio_size: undefined,
    max_file_size: undefined,
    max_total_attachment_size: undefined,
    allowed_image_types: undefined,
    allowed_video_types: undefined,
    allowed_file_types: undefined,
    allowed_sticker_types: undefined,
    allowed_gif_types: undefined,
    allowed_audio_types: undefined,
    avatar_url: null,
    banner_url: null,
  });
  const [originalServerInfo, setOriginalServerInfo] = useState<typeof serverInfo | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>({});
  const [originalRuntimeConfig, setOriginalRuntimeConfig] = useState<RuntimeConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState<'general' | 'appearance' | 'files' | 'runtime'>('general');

  // Load server info and runtime config on component mount
  useEffect(() => {
    const loadServerInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getServerInfo();
        if (response.success && response.data) {
          const info = response.data.server_info || {};
          setServerInfo({
            server_name: info.server_name || 'Loading...',
            server_description: info.server_description || 'Loading...',
            version: info.version || 'Loading...',
            max_users: info.max_users || null,
            is_private: info.is_private || false,
            creation_date: info.creation_date || null,
            max_message_length: info.max_message_length,
            max_image_size: info.max_image_size,
            max_video_size: info.max_video_size,
            max_sticker_size: info.max_sticker_size,
            max_gif_size: info.max_gif_size,
            max_audio_size: info.max_audio_size,
            max_file_size: info.max_file_size,
            max_total_attachment_size: info.max_total_attachment_size,
            allowed_image_types: serializeExtensions(info.allowed_image_types),
            allowed_video_types: serializeExtensions(info.allowed_video_types),
            allowed_file_types: serializeExtensions(info.allowed_file_types),
            allowed_sticker_types: serializeExtensions(info.allowed_sticker_types),
            allowed_gif_types: serializeExtensions(info.allowed_gif_types),
            allowed_audio_types: serializeExtensions(info.allowed_audio_types),
            avatar_url: info.avatar_url || null,
            banner_url: info.banner_url || null,
          });
          setOriginalServerInfo(JSON.parse(JSON.stringify({
            server_name: info.server_name || 'Loading...',
            server_description: info.server_description || 'Loading...',
            version: info.version || 'Loading...',
            max_users: info.max_users || null,
            is_private: info.is_private || false,
            creation_date: info.creation_date || null,
            max_message_length: info.max_message_length,
            max_image_size: info.max_image_size,
            max_video_size: info.max_video_size,
            max_sticker_size: info.max_sticker_size,
            max_gif_size: info.max_gif_size,
            max_audio_size: info.max_audio_size,
            max_file_size: info.max_file_size,
            max_total_attachment_size: info.max_total_attachment_size,
            allowed_image_types: serializeExtensions(info.allowed_image_types),
            allowed_video_types: serializeExtensions(info.allowed_video_types),
            allowed_file_types: serializeExtensions(info.allowed_file_types),
            allowed_sticker_types: serializeExtensions(info.allowed_sticker_types),
            allowed_gif_types: serializeExtensions(info.allowed_gif_types),
            allowed_audio_types: serializeExtensions(info.allowed_audio_types),
            avatar_url: info.avatar_url || null,
            banner_url: info.banner_url || null
          }))); // Deep copy
        } else {
          setError('Failed to load server information');
        }

        // Load runtime configuration
        const authToken = getAuthTokenFromCookies() || '';
        if (authToken) {
          const configResponse = await getServerConfig(authToken, false);
          if (configResponse.success && configResponse.data) {
            const config = configResponse.data.runtime_config || {};
            setRuntimeConfig(config);
            setOriginalRuntimeConfig(JSON.parse(JSON.stringify(config))); // Deep copy
          }
        }
      } catch (err) {
        setError('Failed to load server information');
        logger.api.error('Failed to load server info', err);
      } finally {
        setLoading(false);
      }
    };

    loadServerInfo();
  }, []);

  // Handle avatar upload immediately when selected
  const handleAvatarUpload = async (file: File) => {
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }

    try {
      const response = await uploadServerAvatar(authToken, file);

      if (response.success && response.data) {
        const fullAvatarUrl = convertToFullStorageUrl(response.data.avatar_url);
        setServerInfo(prev => ({ ...prev, avatar_url: fullAvatarUrl }));
        setOriginalServerInfo(prev => prev ? { ...prev, avatar_url: fullAvatarUrl } : null);
        logger.ui.info('Server avatar updated successfully', response.data);
      } else {
        setError('Failed to upload avatar');
        logger.ui.error('Failed to upload avatar', response.error);
      }
    } catch (err) {
      setError('Failed to upload avatar');
      logger.api.error('Failed to upload avatar', err);
    }
  };

  // Handle banner upload immediately when selected
  const handleBannerUpload = async (file: File) => {
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }

    try {
      const response = await uploadServerBanner(authToken, file);

      if (response.success && response.data) {
        const fullBannerUrl = convertToFullStorageUrl(response.data.banner_url);
        setServerInfo(prev => ({ ...prev, banner_url: fullBannerUrl }));
        setOriginalServerInfo(prev => prev ? { ...prev, banner_url: fullBannerUrl } : null);
        logger.ui.info('Server banner updated successfully', response.data);
      } else {
        setError('Failed to upload banner');
        logger.ui.error('Failed to upload banner', response.error);
      }
    } catch (err) {
      setError('Failed to upload banner');
      logger.api.error('Failed to upload banner', err);
    }
  };

  const handleSave = async () => {
    // Form validation
    if (!serverInfo.server_name?.trim()) {
      setError('Server name cannot be empty');
      return;
    }

    if (serverInfo.server_name.length > 100) {
      setError('Server name cannot exceed 100 characters');
      return;
    }

    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Save server info changes
      const changes: any = {};
      if (serverInfo.server_name !== originalServerInfo?.server_name) {
        changes.server_name = serverInfo.server_name.trim();
      }
      if (serverInfo.server_description !== originalServerInfo?.server_description) {
        changes.server_description = (serverInfo.server_description || '').trim();
      }
      if (serverInfo.is_private !== originalServerInfo?.is_private) {
        changes.is_private = serverInfo.is_private;
      }
      if (serverInfo.max_message_length !== undefined && serverInfo.max_message_length !== originalServerInfo?.max_message_length) {
        changes.max_message_length = serverInfo.max_message_length;
      }
      if (serverInfo.max_image_size !== undefined && serverInfo.max_image_size !== originalServerInfo?.max_image_size) {
        changes.max_image_size = serverInfo.max_image_size;
      }
      if (serverInfo.max_video_size !== undefined && serverInfo.max_video_size !== originalServerInfo?.max_video_size) {
        changes.max_video_size = serverInfo.max_video_size;
      }
      if (serverInfo.max_sticker_size !== undefined && serverInfo.max_sticker_size !== originalServerInfo?.max_sticker_size) {
        changes.max_sticker_size = serverInfo.max_sticker_size;
      }
      if (serverInfo.max_gif_size !== undefined && serverInfo.max_gif_size !== originalServerInfo?.max_gif_size) {
        changes.max_gif_size = serverInfo.max_gif_size;
      }
      if (serverInfo.allowed_image_types !== originalServerInfo?.allowed_image_types) {
        changes.allowed_image_types = parseExtensions(serverInfo.allowed_image_types);
      }
      if (serverInfo.allowed_video_types !== originalServerInfo?.allowed_video_types) {
        changes.allowed_video_types = parseExtensions(serverInfo.allowed_video_types);
      }
      if (serverInfo.allowed_file_types !== originalServerInfo?.allowed_file_types) {
        changes.allowed_file_types = parseExtensions(serverInfo.allowed_file_types);
      }
      if (serverInfo.allowed_sticker_types !== originalServerInfo?.allowed_sticker_types) {
        changes.allowed_sticker_types = parseExtensions(serverInfo.allowed_sticker_types);
      }
      if (serverInfo.allowed_gif_types !== originalServerInfo?.allowed_gif_types) {
        changes.allowed_gif_types = parseExtensions(serverInfo.allowed_gif_types);
      }

      // Save runtime config changes
      const runtimeConfigChanges: Record<string, unknown> = {};
      for (const key in runtimeConfig) {
        if (runtimeConfig[key] !== originalRuntimeConfig[key]) {
          runtimeConfigChanges[key] = runtimeConfig[key];
        }
      }

      if (Object.keys(changes).length === 0 && Object.keys(runtimeConfigChanges).length === 0) {
        setError('No changes to save');
        setSaving(false);
        return;
      }

      // Update server info if there are changes
      if (Object.keys(changes).length > 0) {
        const response = await updateServerInfo({
          auth_token: authToken,
          ...changes
        });

        if (!response.success) {
          setError(response.error || 'Failed to update server settings');
          return;
        }
        setOriginalServerInfo(JSON.parse(JSON.stringify(serverInfo)));
      }

      // Update runtime config if there are changes
      if (Object.keys(runtimeConfigChanges).length > 0) {
        const response = await updateServerConfig(authToken, runtimeConfigChanges);

        if (!response.success) {
          setError(response.error || 'Failed to update runtime configuration');
          return;
        }
        setOriginalRuntimeConfig(JSON.parse(JSON.stringify(runtimeConfig)));
        
        if (response.data?.restart_required) {
          showToast({
            message: 'Server restart required for some settings to take effect.',
            tone: 'warning',
            category: 'system',
          });
        }
      }

      showToast({
        message: 'Settings updated successfully.',
        tone: 'success',
        category: 'system',
        dedupeKey: 'settings-tab:settings-updated',
      });
      logger.ui.info('Settings updated successfully');
    } catch (err) {
      setError('Failed to save settings');
      logger.api.error('Failed to save settings', err);
      showToast({
        message: 'Failed to save settings.',
        tone: 'error',
        category: 'system',
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper function to convert data URL to File object
  const dataURLToFile = (dataURL: string, filename: string): File => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Avatar and banner are uploaded immediately when selected, so they shouldn't count as "unsaved changes"
  const hasChanges = (originalServerInfo &&
    (serverInfo.server_name !== originalServerInfo.server_name ||
      serverInfo.server_description !== originalServerInfo.server_description ||
      serverInfo.is_private !== originalServerInfo.is_private ||
      serverInfo.max_users !== originalServerInfo.max_users ||
      serverInfo.max_message_length !== originalServerInfo.max_message_length ||
      serverInfo.max_image_size !== originalServerInfo.max_image_size ||
      serverInfo.max_video_size !== originalServerInfo.max_video_size ||
      serverInfo.max_sticker_size !== originalServerInfo.max_sticker_size ||
      serverInfo.max_gif_size !== originalServerInfo.max_gif_size ||
      serverInfo.allowed_image_types !== originalServerInfo.allowed_image_types ||
      serverInfo.allowed_video_types !== originalServerInfo.allowed_video_types ||
      serverInfo.allowed_file_types !== originalServerInfo.allowed_file_types ||
      serverInfo.allowed_sticker_types !== originalServerInfo.allowed_sticker_types ||
      serverInfo.allowed_gif_types !== originalServerInfo.allowed_gif_types)) ||
    JSON.stringify(runtimeConfig) !== JSON.stringify(originalRuntimeConfig);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className={controlPanelSectionClass}>
          <div className="animate-pulse space-y-6">
            <div className="h-6 bg-[var(--color-surface-tertiary)] rounded w-48"></div>
            <div className="space-y-4">
              <div className="h-16 bg-[var(--color-surface-tertiary)] rounded"></div>
              <div className="h-24 bg-[var(--color-surface-tertiary)] rounded"></div>
              <div className="h-12 bg-[var(--color-surface-tertiary)] rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={controlPanelSectionClass}>
        <h2 className="mb-6 text-lg font-medium text-[var(--color-text)]">Server Settings</h2>

        {error && (
          <div className="mb-4">
            <Notice tone="error" message={error} />
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button className={controlPanelSegmentClass(activeSettingsSubTab === 'general')} onClick={() => setActiveSettingsSubTab('general')}>General</button>
            <button className={controlPanelSegmentClass(activeSettingsSubTab === 'appearance')} onClick={() => setActiveSettingsSubTab('appearance')}>Appearance</button>
            <button className={controlPanelSegmentClass(activeSettingsSubTab === 'files')} onClick={() => setActiveSettingsSubTab('files')}>File Uploads</button>
            <button className={controlPanelSegmentClass(activeSettingsSubTab === 'runtime')} onClick={() => setActiveSettingsSubTab('runtime')}>Runtime</button>
          </div>
          {activeSettingsSubTab === 'general' && (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-[var(--color-text)]">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Server Name
              </label>
              <input
                type="text"
                value={serverInfo.server_name}
                onChange={(e) => setServerInfo({ ...serverInfo, server_name: e.target.value })}
                className={controlPanelInputClass}
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Description
              </label>
              <textarea
                value={serverInfo.server_description}
                onChange={(e) => setServerInfo({ ...serverInfo, server_description: e.target.value })}
                rows={3}
                className={controlPanelTextAreaClass}
                disabled={saving}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                checked={serverInfo.is_private}
                onChange={(e) => setServerInfo({ ...serverInfo, is_private: e.target.checked })}
                className="mr-3"
                disabled={saving}
              />
              <label htmlFor="isPrivate" className="text-sm font-medium text-[var(--color-text)]">
                Make server private (invite only)
              </label>
            </div>



            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Maximum Message Length
              </label>
              <input
                type="number"
                value={serverInfo.max_message_length ?? ''}
                onChange={(e) => setServerInfo({ ...serverInfo, max_message_length: e.target.value ? parseInt(e.target.value) : undefined })}
                min="100"
                max="10000"
                placeholder="Default (4000)"
                className={controlPanelInputClass}
                disabled={saving}
              />
            </div>
          </div>
          )}
          {activeSettingsSubTab === 'appearance' && (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-[var(--color-text)]">Server Appearance</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Server Avatar */}
              <div className="space-y-3">
                <h4 className="font-medium text-[var(--color-text)]">Server Avatar</h4>
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    {serverInfo.avatar_url ? (
                      <>
                        <img
                          src={convertToFullStorageUrl(serverInfo.avatar_url)}
                          alt="Server Avatar"
                          className="h-20 w-20 rounded-2xl border-2 border-[var(--color-border)] object-cover"
                        />
                        <button
                          onClick={() => setServerInfo({ ...serverInfo, avatar_url: null })}
                          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-error)] text-[var(--color-on-error)] text-xs font-bold transition-opacity hover:opacity-90"
                          disabled={saving}
                          title="Remove avatar"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-primary)] text-2xl font-bold text-[var(--color-on-primary)]">
                        {serverInfo.server_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-sm text-[var(--color-text-secondary)]">Supports PNG, JPEG, GIF, WebP. Recommended 128×128 px.</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setServerInfo({ ...serverInfo, avatar_url: ev.target?.result as string });
                          reader.readAsDataURL(file);
                          await handleAvatarUpload(file);
                        }
                      }}
                      disabled={saving}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Avatar
                    </label>
                  </div>
                </div>
              </div>

              {/* Server Banner */}
              <div className="space-y-3">
                <h4 className="font-medium text-[var(--color-text)]">Server Banner</h4>

                {/* Preview — always shown */}
                <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)]">
                  {serverInfo.banner_url ? (
                    <>
                      <img
                        src={convertToFullStorageUrl(serverInfo.banner_url)}
                        alt="Server Banner"
                        className="h-28 w-full object-cover"
                      />
                      <button
                        onClick={() => setServerInfo({ ...serverInfo, banner_url: null })}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-sm font-bold backdrop-blur-sm transition-opacity hover:bg-black/80"
                        disabled={saving}
                        title="Remove banner"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)]">
                      <span className="text-xs text-[var(--color-text-muted)]">No banner set — gradient color shown in sidebar</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setServerInfo({ ...serverInfo, banner_url: ev.target?.result as string });
                        reader.readAsDataURL(file);
                        await handleBannerUpload(file);
                      }
                    }}
                    disabled={saving}
                    className="hidden"
                    id="banner-upload"
                  />
                  <label
                    htmlFor="banner-upload"
                    className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Banner
                  </label>
                  <p className="text-sm text-[var(--color-text-secondary)]">Recommended 1200×300 px. Supports GIF.</p>
                </div>
              </div>
            </div>

            {/* File Format Info */}
            <div className="bg-[var(--color-surface-secondary)]/50 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-[var(--color-primary)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-[var(--color-text)]">
                  <strong>GIF Support:</strong> Both static and animated GIF files are supported for avatar and banner images.
                  Recommended sizes: Avatar (128x128px), Banner (1200x300px).
                  <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Supported formats: PNG, JPEG/JPG, GIF, WebP
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
          {activeSettingsSubTab === 'files' && (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-[var(--color-text)]">File Upload Restrictions</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Max Image Size (MB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={serverInfo.max_image_size ?? ''}
                  onChange={(e) => setServerInfo({ ...serverInfo, max_image_size: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="5"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Max Video Size (MB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={serverInfo.max_video_size ?? ''}
                  onChange={(e) => setServerInfo({ ...serverInfo, max_video_size: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="50"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Max Sticker Size (MB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={serverInfo.max_sticker_size ?? ''}
                  onChange={(e) => setServerInfo({ ...serverInfo, max_sticker_size: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="5"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Max GIF Size (MB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={serverInfo.max_gif_size ?? ''}
                  onChange={(e) => setServerInfo({ ...serverInfo, max_gif_size: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="10"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Allowed Image Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_image_types || 'PNG, JPG, JPEG, GIF, WebP'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_image_types: e.target.value })}
                  placeholder="PNG, JPG, JPEG, GIF, WebP"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Allowed Video Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_video_types || 'MP4, WebM'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_video_types: e.target.value })}
                  placeholder="MP4, WebM"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Allowed Document Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_file_types || 'PDF, DOC, DOCX, TXT, ZIP'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_file_types: e.target.value })}
                  placeholder="PDF, DOC, DOCX, TXT, ZIP"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Allowed Sticker Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_sticker_types || 'PNG, GIF'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_sticker_types: e.target.value })}
                  placeholder="PNG, GIF"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Allowed GIF Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_gif_types || 'GIF'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_gif_types: e.target.value })}
                  placeholder="GIF"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/50 p-4">
              <div className="mb-3 text-sm font-medium text-[var(--color-text)]">
                Server-derived Attachment Caps
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
                  <div className="text-[var(--color-text-secondary)]">Max audio size</div>
                  <div className="font-medium text-[var(--color-text)]">
                    {serverInfo.max_audio_size ?? 'Unavailable'} MB
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Types: {serverInfo.allowed_audio_types || 'n/a'}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
                  <div className="text-[var(--color-text-secondary)]">Max document size</div>
                  <div className="font-medium text-[var(--color-text)]">
                    {serverInfo.max_file_size ?? 'Unavailable'} MB
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
                  <div className="text-[var(--color-text-secondary)]">Max total attachment size</div>
                  <div className="font-medium text-[var(--color-text)]">
                    {serverInfo.max_total_attachment_size ?? 'Unavailable'} MB
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                These caps come from the active instance storage policy. They are enforced server-side and shown here so owners can see the full effective upload policy.
              </div>
            </div>
          </div>
          )}
          {activeSettingsSubTab === 'runtime' && Object.keys(runtimeConfig).length > 0 && (
            <div className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-md font-medium text-[var(--color-text)]">Voice & Streaming Quality</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  These instance defaults are used for voice sessions, and are also forwarded to media-sfu as the authoritative publishing profile.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Default Quality Profile
                    </label>
                    <select
                      value={getRuntimeString('RTC_DEFAULT_QUALITY_PROFILE', 'balanced')}
                      onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_DEFAULT_QUALITY_PROFILE: e.target.value })}
                      className={controlPanelSelectClass}
                      disabled={saving}
                    >
                      <option value="low">Low</option>
                      <option value="balanced">Balanced</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Audio Sample Rate (Hz)
                    </label>
                    <input
                      type="number"
                      value={getRuntimeNumber('RTC_AUDIO_SAMPLE_RATE_HZ', 48000)}
                      onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_AUDIO_SAMPLE_RATE_HZ: parseInt(e.target.value, 10) || 48000 })}
                      className={controlPanelInputClass}
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Audio Channels
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="2"
                      value={getRuntimeNumber('RTC_AUDIO_CHANNELS', 1)}
                      onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_AUDIO_CHANNELS: parseInt(e.target.value, 10) || 1 })}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-4 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                      disabled={saving}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)]">
                      <input
                        type="checkbox"
                        checked={getRuntimeBoolean('RTC_AUDIO_STEREO_ENABLED', false)}
                        onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_AUDIO_STEREO_ENABLED: e.target.checked })}
                        disabled={saving}
                      />
                      Stereo
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)]">
                      <input
                        type="checkbox"
                        checked={getRuntimeBoolean('RTC_AUDIO_DTX_ENABLED', true)}
                        onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_AUDIO_DTX_ENABLED: e.target.checked })}
                        disabled={saving}
                      />
                      DTX
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)]">
                      <input
                        type="checkbox"
                        checked={getRuntimeBoolean('RTC_AUDIO_FEC_ENABLED', true)}
                        onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_AUDIO_FEC_ENABLED: e.target.checked })}
                        disabled={saving}
                      />
                      FEC
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['LOW', 'BALANCED', 'HIGH'] as const).map((profile) => (
                    <div key={profile} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4">
                      <div className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]">
                        {profile.toLowerCase()}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          Audio bitrate (kbps)
                        </label>
                        <input
                          type="number"
                          value={getRuntimeNumber(`RTC_AUDIO_BITRATE_${profile}_KBPS`, profile === 'LOW' ? 24 : profile === 'BALANCED' ? 48 : 64)}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [`RTC_AUDIO_BITRATE_${profile}_KBPS`]: parseInt(e.target.value, 10) || 0 })}
                          className={controlPanelInputClass}
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          Video bitrate (kbps)
                        </label>
                        <input
                          type="number"
                          value={getRuntimeNumber(`RTC_VIDEO_BITRATE_${profile}_KBPS`, profile === 'LOW' ? 800 : profile === 'BALANCED' ? 1500 : 2500)}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [`RTC_VIDEO_BITRATE_${profile}_KBPS`]: parseInt(e.target.value, 10) || 0 })}
                          className={controlPanelInputClass}
                          disabled={saving}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          value={getRuntimeNumber(`RTC_VIDEO_WIDTH_${profile}`, profile === 'LOW' ? 640 : profile === 'BALANCED' ? 1280 : 1920)}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [`RTC_VIDEO_WIDTH_${profile}`]: parseInt(e.target.value, 10) || 0 })}
                          className={controlPanelInputClass}
                          disabled={saving}
                          aria-label={`${profile.toLowerCase()} video width`}
                        />
                        <input
                          type="number"
                          value={getRuntimeNumber(`RTC_VIDEO_HEIGHT_${profile}`, profile === 'LOW' ? 360 : profile === 'BALANCED' ? 720 : 1080)}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [`RTC_VIDEO_HEIGHT_${profile}`]: parseInt(e.target.value, 10) || 0 })}
                          className={controlPanelInputClass}
                          disabled={saving}
                          aria-label={`${profile.toLowerCase()} video height`}
                        />
                        <input
                          type="number"
                          value={getRuntimeNumber(`RTC_VIDEO_FPS_${profile}`, profile === 'LOW' ? 15 : profile === 'BALANCED' ? 30 : 60)}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [`RTC_VIDEO_FPS_${profile}`]: parseInt(e.target.value, 10) || 0 })}
                          className={controlPanelInputClass}
                          disabled={saving}
                          aria-label={`${profile.toLowerCase()} video fps`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <h3 className="text-md font-medium text-[var(--color-text)]">Runtime Configuration</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Advanced server configuration. Changes to some settings may require a server restart to take effect.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(runtimeConfig)
                  .filter(([key]) => !key.includes('SECRET') && !key.includes('PASSWORD') && !voiceQualityRuntimeKeys.has(key))
                  .map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                        {key.replace(/_/g, ' ')}
                      </label>
                      {typeof value === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={value as boolean}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [key]: e.target.checked })}
                          className="w-4 h-4"
                          disabled={saving}
                        />
                      ) : typeof value === 'number' ? (
                        <input
                          type="number"
                          value={value as number}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [key]: parseInt(e.target.value) || 0 })}
                          className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                          disabled={saving}
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(value || '')}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [key]: e.target.value })}
                          className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                          disabled={saving}
                        />
                      )}
                    </div>
                  ))}
              </div>

              <div className="bg-[var(--color-surface-secondary)]/50 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-[var(--color-primary)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-[var(--color-text)]">
                    <strong>Note:</strong> Sensitive configuration keys (containing 'SECRET' or 'PASSWORD') are not displayed here for security reasons.
                    Modify these through environment variables or config files on the server.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-surface-tertiary)] disabled:cursor-not-allowed text-[var(--color-on-primary)] px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
            {hasChanges && !saving && (
              <span className="ml-3 text-sm text-[var(--color-warning)]">
                You have unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}




