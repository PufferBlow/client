import React, { useState, useEffect, useRef } from "react";
import { getAuthTokenFromCookies, listUsers, type ListUsersResponse, useUserProfile } from "../../services/user";
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
  getRecentActivity,
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
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";
import { Hash, Mic } from "lucide-react";
import type { ShowToast } from "../Toast";
import {
  RoleBadgeList,
} from "./RoleManagement";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { renderFileTypeIcon } from "../../utils/fileTypeMeta";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

const getControlPanelAvatarLabel = (username: string) =>
  username
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '?';

function ControlPanelAvatar({
  username,
  avatarUrl,
  className,
}: {
  username: string;
  avatarUrl?: string | null;
  className: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedAvatarUrl = avatarUrl ? convertToFullStorageUrl(avatarUrl) : null;

  if (resolvedAvatarUrl && !imageFailed) {
    return (
      <img
        src={resolvedAvatarUrl}
        alt={username}
        onError={() => setImageFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-[var(--color-surface-secondary)] text-xs font-semibold text-[var(--color-text)]`}
      aria-label={`${username} avatar placeholder`}
    >
      {getControlPanelAvatarLabel(username)}
    </div>
  );
}

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const controlPanelSectionClass =
  "rounded-[1.5rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-6 shadow-sm";
const controlPanelInsetClass =
  "rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-5";
const controlPanelQuietClass =
  "rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[color:color-mix(in_srgb,var(--color-surface-secondary)_72%,var(--color-background)_28%)] p-5";
const controlPanelCardClass =
  "rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-4";
const controlPanelMetricClass =
  "rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-5";
const controlPanelChartCardClass =
  "rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-5";
const controlPanelRowClass =
  "rounded-[1rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-4 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-hover)]";
const controlPanelInputClass =
  "w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-4 py-2.5 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors focus:border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]";
const controlPanelTextAreaClass =
  "w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors focus:border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]";
const controlPanelSelectClass =
  "w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-4 py-2.5 text-[var(--color-text)] transition-colors focus:border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]";

const controlPanelButtonClass = (variant: "primary" | "secondary" | "ghost" | "danger" = "secondary") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium tracking-[-0.01em] transition-colors",
    variant === "primary" &&
      "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]",
    variant === "secondary" &&
      "border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)]",
    variant === "ghost" &&
      "border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
    variant === "danger" &&
      "border-[color:color-mix(in_srgb,var(--color-error)_32%,var(--color-border-secondary))] bg-[color:color-mix(in_srgb,var(--color-error)_10%,var(--color-surface-secondary))] text-[var(--color-text)] hover:bg-[color:color-mix(in_srgb,var(--color-error)_16%,var(--color-surface-secondary))]",
  );

const controlPanelSegmentClass = (active: boolean) =>
  cx(
    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
    active
      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
      : "border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
  );

const controlPanelBadgeClass = (tone: "neutral" | "success" | "warning" | "info" | "danger" = "neutral") =>
  cx(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em]",
    tone === "neutral" &&
      "border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]",
    tone === "success" && "pb-status-success",
    tone === "warning" && "pb-status-warning",
    tone === "info" && "pb-status-info",
    tone === "danger" && "pb-status-danger",
  );

const formatCompactNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";

const resolveCssVar = (name: string, fallback: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const hexToRgba = (value: string, alpha: number) => {
  const hex = value.replace("#", "").trim();
  if (hex.length !== 3 && hex.length !== 6) {
    return value;
  }

  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;

  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getControlPanelChartPalette = () => {
  const text = resolveCssVar("--color-text", "#fafafa");
  const textSecondary = resolveCssVar("--color-text-secondary", "#d4d4d4");
  const textMuted = resolveCssVar("--color-text-muted", "#737373");
  const border = resolveCssVar("--color-border-secondary", "rgba(255,255,255,0.08)");
  const primary = resolveCssVar("--color-primary", "#fafafa");
  const success = resolveCssVar("--color-success", "#7ecf9f");
  const warning = resolveCssVar("--color-warning", "#d6b36a");
  const info = resolveCssVar("--color-info", "#86aee8");
  const error = resolveCssVar("--color-error", "#d8837b");

  return {
    text,
    textSecondary,
    textMuted,
    border,
    primary,
    success,
    warning,
    info,
    error,
    neutralFill: hexToRgba(primary, 0.12),
    neutralStroke: hexToRgba(primary, 0.7),
    successFill: hexToRgba(success, 0.18),
    successStroke: success,
    warningFill: hexToRgba(warning, 0.2),
    warningStroke: warning,
    infoFill: hexToRgba(info, 0.18),
    infoStroke: info,
    errorFill: hexToRgba(error, 0.16),
    errorStroke: error,
  };
};

const createChartOptions = (kind: "line" | "bar" | "pie") => {
  const palette = getControlPanelChartPalette();

  if (kind === "pie") {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: palette.textSecondary,
            usePointStyle: true,
            padding: 18,
            boxWidth: 10,
            boxHeight: 10,
            font: {
              size: 11,
            },
          },
        },
      },
    };
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(12, 12, 12, 0.94)",
        borderColor: palette.border,
        borderWidth: 1,
        titleColor: palette.text,
        bodyColor: palette.textSecondary,
        padding: 12,
        displayColors: false,
      },
    },
    scales: {
      x: {
        border: {
          display: false,
        },
        ticks: {
          color: palette.textMuted,
          maxRotation: 0,
          autoSkipPadding: 14,
          font: {
            size: 11,
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        border: {
          display: false,
        },
        ticks: {
          color: palette.textMuted,
          padding: 10,
          font: {
            size: 11,
          },
        },
        grid: {
          color: hexToRgba(resolveCssVar("--color-text", "#fafafa"), 0.08),
          drawTicks: false,
        },
      },
    },
  };
};

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
            { label: 'Images', value: imageCount.toLocaleString(), icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', color: '#a78bfa' },
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

    // Mock user data for display
    const user = {
      id: userId,
      username: username,
      avatar: null,
      avatar_url: activity?.user?.avatar_url || activity?.metadata?.avatar_url || null,
      status: 'online' as const, // Mock status
      bio: `${username} performed this server action`,
      joinedAt: '2023-01-15', // Mock join date
      roles: ['Admin', 'Owner'] // Mock roles for server setting changers
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

// Members Tab Component
export function MembersTab({
  roles,
  users,
  onOpenRolesTab,
  showToast
}: {
  roles: import("../../services/system").InstanceRole[];
  users: ListUsersResponse['users'];
  onOpenRolesTab: () => void;
  showToast: ShowToast;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedUserMenu, setSelectedUserMenu] = useState<typeof users[0] | null>(null);
  const [userMenuPosition, setUserMenuPosition] = useState({ x: 0, y: 0 });

  // Show loading state when no users are loaded yet
  if (!users || users.length === 0) {
    return (
      <div className="space-y-6">
        <div className={controlPanelSectionClass}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-[var(--color-text)]">Manage Members</h2>
            <button className={cx(controlPanelButtonClass('secondary'), "cursor-not-allowed opacity-60")}>
              Invite Member
            </button>
          </div>

          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center px-4 py-3">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 bg-[var(--color-surface-tertiary)] rounded-full"></div>
                  <div>
                    <div className="h-4 bg-[var(--color-surface-tertiary)] rounded mb-1 w-24"></div>
                    <div className="h-3 bg-[var(--color-surface-tertiary)] rounded w-32"></div>
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="h-3 bg-[var(--color-surface-tertiary)] rounded"></div>
                </div>
                <div className="w-12">
                  <div className="w-5 h-5 bg-[var(--color-surface-tertiary)] rounded"></div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center text-[var(--color-text-secondary)] py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p>Loading members...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleUserMenu = (user: typeof users[0], event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setSelectedUserMenu(user);
    setUserMenuPosition({
      x: Math.min(rect.left + window.scrollX, window.innerWidth - 200),
      y: rect.bottom + window.scrollY + 5
    });
    setUserMenuOpen(!userMenuOpen || selectedUserMenu?.user_id !== user.user_id);
  };

  const handleUserAction = async (action: 'editRoles' | 'timeout' | 'ban') => {
    if (!selectedUserMenu) return;

    const authToken = getAuthTokenFromCookies() || '';
    const targetUserId = selectedUserMenu.user_id;
    const targetUsername = selectedUserMenu.username;

    switch (action) {
      case 'editRoles':
        onOpenRolesTab();
        break;
      case 'timeout': {
        const durationInput = window.prompt(`Timeout ${targetUsername} for how many minutes?`, '60');
        if (!durationInput) {
          break;
        }

        const durationMinutes = Number.parseInt(durationInput, 10);
        if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
          showToast({
            message: "Please enter a valid timeout duration in minutes.",
            tone: 'error',
            category: 'validation',
          });
          break;
        }

        const reason = window.prompt(`Optional timeout reason for ${targetUsername}:`, '') || undefined;
        const response = await timeoutUser(targetUserId, {
          auth_token: authToken,
          duration_minutes: durationMinutes,
          reason,
        });

        if (!response.success) {
          showToast({
            message: `Failed to timeout ${targetUsername}: ${response.error || 'Unknown error'}`,
            tone: 'error',
            category: 'system',
          });
          break;
        }

        showToast({
          message: `${targetUsername} has been timed out for ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}.`,
          tone: 'success',
          category: 'destructive',
        });
        break;
      }
      case 'ban': {
        const confirmed = window.confirm(`Ban ${targetUsername} from this home instance?`);
        if (!confirmed) {
          break;
        }

        const reason = window.prompt(`Optional ban reason for ${targetUsername}:`, '') || undefined;
        const response = await banUser(targetUserId, {
          auth_token: authToken,
          reason,
        });

        if (!response.success) {
          showToast({
            message: `Failed to ban ${targetUsername}: ${response.error || 'Unknown error'}`,
            tone: 'error',
            category: 'system',
          });
          break;
        }

        showToast({
          message: `${targetUsername} has been banned from this home instance.`,
          tone: 'success',
          category: 'destructive',
        });
        break;
      }
    }

    setUserMenuOpen(false);
    setSelectedUserMenu(null);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      setUserMenuOpen(false);
      setSelectedUserMenu(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  return (
    <div className="space-y-6">
      <div className={controlPanelSectionClass}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Manage Members</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={onOpenRolesTab}
              className={controlPanelButtonClass('secondary')}
            >
              Open Roles
            </button>
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={controlPanelInputClass}
            />
            <button className={controlPanelButtonClass('primary')}>
              Invite Member
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {/* Filter users based on search term */}
          {users.filter(user =>
            searchTerm === '' ||
            user.username.toLowerCase().includes(searchTerm.toLowerCase())
          ).map((user) => (
            <div
              key={user.user_id}
              className={cx(controlPanelRowClass, "flex items-center px-4 py-3 cursor-pointer")}
            >
              {/* User info on the left */}
              <div className="flex items-center space-x-3 flex-1">
                <div className="relative">
                  <ControlPanelAvatar
                    username={user.username}
                    avatarUrl={user.avatar_url || user.avatar}
                    className="h-10 w-10 rounded-full border border-[var(--color-border-secondary)]"
                  />
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--color-surface)] shadow-sm ${user.status === 'online' ? 'bg-[var(--color-success)]' :
                      user.status === 'idle' ? 'bg-[var(--color-warning)]' :
                        user.status === 'dnd' ? 'bg-[var(--color-error)]' :
                          'bg-[var(--color-border)]'
                    }`}></div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-[var(--color-text)]">{user.username}</span>
                  <RoleBadgeList roleIds={user.roles_ids} roles={roles} />
                </div>
              </div>

              {/* Joined date in the middle */}
              <div className="flex-1 text-center text-[var(--color-text-secondary)]">
                Joined {new Date(user.created_at || '2023-01-01').toLocaleDateString()}
              </div>

              {/* Three dots menu on the right */}
              <div className="w-12 flex justify-end">
                <button
                  onClick={(event) => { event.stopPropagation(); handleUserMenu(user, event); }}
                  className="p-1 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Menu Dropdown */}
      {userMenuOpen && selectedUserMenu && (
        <div
          className="fixed z-50 w-48 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] py-1 shadow-lg"
          style={{ left: userMenuPosition.x, top: userMenuPosition.y }}
        >
          <button
            onClick={() => handleUserAction('editRoles')}
            className="flex w-full items-center space-x-2 px-3 py-2 text-left text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-secondary)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit Roles</span>
          </button>

          <button
            onClick={() => void handleUserAction('timeout')}
            className="flex w-full items-center space-x-2 px-3 py-2 text-left text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-secondary)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
            <span>Timeout</span>
          </button>

          <button
            onClick={() => void handleUserAction('ban')}
            className="flex w-full items-center space-x-2 px-3 py-2 text-left text-[var(--color-error)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--color-error)_12%,transparent)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Ban</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function ChannelsTab({
  onOpenChannelModal,
  channels,
  setChannels,
  showToast
}: {
  onOpenChannelModal: () => void;
  channels: Channel[];
  setChannels: (channels: Channel[]) => void;
  showToast: ShowToast;
}) {
  const [deleteConfirmChannel, setDeleteConfirmChannel] = useState<Channel | null>(null);

  // channels array will be empty initially, so we can't use that to detect loading
  // However, the parent component will pass loaded channels
  const hasChannels = channels && channels.length > 0;

  const handleDeleteChannel = async (channel: Channel) => {
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) return;

    try {
      const response = await deleteChannel(channel.channel_id, authToken);
      if (response.success) {
        logger.ui.info("Channel deleted successfully", { channelId: channel.channel_id, channelName: channel.channel_name });

        showToast({
          message: `Channel #${channel.channel_name} deleted successfully.`,
          tone: 'success',
          category: 'destructive',
        });

        // Refresh the channel list
        const listResponse = await listChannels(authToken);
        if (listResponse.success && listResponse.data && listResponse.data.channels) {
          setChannels(listResponse.data.channels);
        }
        setDeleteConfirmChannel(null);
      } else {
        logger.ui.error("Failed to delete channel", { channelId: channel.channel_id, error: response.error });
        showToast({
          message: `Failed to delete channel: ${response.error || 'Unknown error'}`,
          tone: 'error',
          category: 'system',
        });
      }
    } catch (error) {
      logger.ui.error("Error deleting channel", { channelId: channel.channel_id, error });
      showToast({
        message: 'An unexpected error occurred while deleting the channel.',
        tone: 'error',
        category: 'system',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className={controlPanelSectionClass}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Manage Channels</h2>
          <button
            onClick={onOpenChannelModal}
            className={controlPanelButtonClass('primary')}
          >
            Create Channel
          </button>
        </div>

        {hasChannels ? (
          <div className="space-y-3">
            {channels.map((channel) => (
              <div key={channel.channel_id} className={cx(controlPanelRowClass, "flex items-center justify-between p-4")}>
                <div className="flex items-center space-x-3">
                  <span className="text-[var(--color-text-secondary)]">#</span>
                  <span className="font-medium text-[var(--color-text)]">{channel.channel_name}</span>
                  {channel.is_private && (
                    <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  {channel.channel_type === 'voice' ? (
                    <>
                      <Mic className="w-3 h-3 mr-1" />
                      <span>voice</span>
                    </>
                  ) : (
                    <>
                      <Hash className="w-3 h-3 mr-1" />
                      <span>text</span>
                    </>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmChannel(channel)}
                    className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-error)]"
                    title={`Delete ${channel.channel_name}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-[var(--color-text-secondary)] py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2">No channels found</p>
            <p className="text-[var(--color-text-muted)]">Create your first channel to get started with discussions.</p>
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmChannel)}
        title="Delete Channel"
        description={deleteConfirmChannel
          ? `Delete #${deleteConfirmChannel.channel_name}? All messages in this channel will be permanently removed.`
          : ""}
        confirmLabel="Delete Channel"
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => setDeleteConfirmChannel(null)}
        onConfirm={() => {
          if (deleteConfirmChannel) {
            void handleDeleteChannel(deleteConfirmChannel);
          }
        }}
      />
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
          <div className="mb-4 rounded border p-3 text-sm text-[var(--color-error)]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)' }}>
            {error}
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

// Security Tab Component
export function SecurityTab() {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <h2 className="mb-6 text-lg font-medium text-[var(--color-text)]">Security Settings</h2>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg">
            <div>
              <div className="font-medium text-[var(--color-text)]">Content Moderation</div>
              <div className="text-[var(--color-text-secondary)] text-sm">Automatically filter inappropriate content</div>
            </div>
            <button className="rounded-lg bg-[var(--color-success)] px-4 py-2 text-[var(--color-on-success)] transition-colors hover:opacity-90">
              Enable
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg">
            <div>
              <div className="font-medium text-[var(--color-text)]">Spam Protection</div>
              <div className="text-[var(--color-text-secondary)] text-sm">Prevent spam messages and raids</div>
            </div>
            <button className="rounded-lg bg-[var(--color-success)] px-4 py-2 text-[var(--color-on-success)] transition-colors hover:opacity-90">
              Enable
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg">
            <div>
              <div className="font-medium text-[var(--color-text)]">IP Logging</div>
              <div className="text-[var(--color-text-secondary)] text-sm">Log IP addresses for security monitoring</div>
            </div>
            <button className="rounded-lg bg-[var(--color-error)] px-4 py-2 text-[var(--color-on-error)] transition-colors hover:opacity-90">
              Disable
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg">
            <div>
              <div className="font-medium text-[var(--color-text)]">Two-Factor Authentication</div>
              <div className="text-[var(--color-text-secondary)] text-sm">Require 2FA for all administrators</div>
            </div>
            <button className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] px-4 py-2 rounded-lg transition-colors">
              Configure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Blocked IPs Tab Component
export function BlockedIPsTab({
  showToast
}: {
  showToast: ShowToast;
}) {
  const [blockedIPs, setBlockedIPs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newIP, setNewIP] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isAddingIP, setIsAddingIP] = useState(false);
  const [deleteConfirmIP, setDeleteConfirmIP] = useState<any>(null);

  // Load blocked IPs on component mount
  useEffect(() => {
    loadBlockedIPs();
  }, []);

  const loadBlockedIPs = async () => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        setError('Authentication token not found');
        setLoading(false);
        return;
      }

      const response = await listBlockedIPs(authToken);
      if (response.success && response.data) {
        setBlockedIPs(response.data.blocked_ips || []);
      } else {
        setError(response.error || 'Failed to load blocked IPs');
        setBlockedIPs([]);
      }
    } catch (err) {
      setError('Failed to load blocked IPs');
      setBlockedIPs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockIP = async () => {
    if (!newIP.trim() || !newReason.trim()) {
      showToast({
        message: 'Please provide both IP address and reason.',
        tone: 'error',
        category: 'validation',
      });
      return;
    }

    // Basic IP validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!ipRegex.test(newIP.trim())) {
      showToast({
        message: 'Please provide a valid IP address.',
        tone: 'error',
        category: 'validation',
      });
      return;
    }

    setIsAddingIP(true);

    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        showToast({
          message: 'Authentication token not found.',
          tone: 'error',
          category: 'system',
        });
        return;
      }

      const response = await blockIP(authToken, newIP.trim(), newReason.trim());
      if (response.success) {
        showToast({
          message: `IP ${newIP} has been blocked successfully.`,
          tone: 'success',
          category: 'destructive',
        });
        setNewIP('');
        setNewReason('');
        await loadBlockedIPs(); // Refresh the list
      } else {
        showToast({
          message: response.error || 'Failed to block IP.',
          tone: 'error',
          category: 'system',
        });
      }
    } catch (err) {
      showToast({
        message: 'Failed to block IP.',
        tone: 'error',
        category: 'system',
      });
    } finally {
      setIsAddingIP(false);
    }
  };

  const handleUnblockIP = async (ip: string) => {
    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        showToast({
          message: 'Authentication token not found.',
          tone: 'error',
          category: 'system',
        });
        return;
      }

      const response = await unblockIP(authToken, ip);
      if (response.success) {
        showToast({
          message: `IP ${ip} has been unblocked successfully.`,
          tone: 'success',
          category: 'destructive',
        });
        await loadBlockedIPs(); // Refresh the list
        setDeleteConfirmIP(null);
      } else {
        showToast({
          message: response.error || 'Failed to unblock IP.',
          tone: 'error',
          category: 'system',
        });
      }
    } catch (err) {
      showToast({
        message: 'Failed to unblock IP.',
        tone: 'error',
        category: 'system',
      });
    }
  };

  const filteredIPs = blockedIPs.filter(ip =>
    searchTerm === '' ||
    ip.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ip.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-[var(--color-surface-tertiary)] rounded w-48"></div>
            <div className="h-32 bg-[var(--color-surface-tertiary)] rounded"></div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-[var(--color-surface-tertiary)] rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="py-8 text-center text-[var(--color-error)]">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Error Loading Blocked IPs</h3>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={loadBlockedIPs}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blocked IPs Management Header */}
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">Blocked IP Addresses</h2>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Manage IP addresses that are blocked from accessing the server</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--color-text)]">{blockedIPs.length}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Total Blocked</div>
          </div>
        </div>

        {/* Add New IP Block */}
        <div className="bg-[var(--color-surface-secondary)] rounded-lg p-4 mb-6">
          <h3 className="mb-4 text-md font-medium text-[var(--color-text)]">Block New IP Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                IP Address
              </label>
              <input
                type="text"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                placeholder="192.168.1.1 or 2001:db8::1"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                disabled={isAddingIP}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Reason
              </label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Reason for blocking"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                disabled={isAddingIP}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleBlockIP}
                disabled={isAddingIP || !newIP.trim() || !newReason.trim()}
                className="flex w-full items-center justify-center space-x-2 rounded-lg px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:bg-[var(--color-surface-tertiary)] disabled:text-[var(--color-text-muted)]"
                style={{ backgroundColor: 'var(--color-error)', color: 'var(--color-on-error)' }}
              >
                {isAddingIP ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Blocking...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Block IP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search blocked IPs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-4 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <button
            onClick={loadBlockedIPs}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {/* Blocked IPs List */}
        {filteredIPs.length === 0 ? (
          <div className="text-center text-[var(--color-text-secondary)] py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2">
              {blockedIPs.length === 0 ? 'No blocked IPs' : 'No IPs match your search'}
            </p>
            <p className="text-[var(--color-text-muted)] text-sm">
              {blockedIPs.length === 0 ? 'IP addresses will appear here once blocked' : 'Try adjusting your search terms'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIPs.map((blockedIP, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                {/* IP Info */}
                <div className="flex items-center space-x-4 flex-1">
                  {/* IP Icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-error)]">
                    <svg className="w-5 h-5 text-[var(--color-on-error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>

                  {/* IP Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-[var(--color-text)]">{blockedIP.ip}</h4>
                      <span className="rounded px-2 py-1 text-xs font-medium bg-[var(--color-error)] text-[var(--color-on-error)]">
                        Blocked
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-[var(--color-text-secondary)]">
                      <span>Reason: {blockedIP.reason}</span>
                      <span>•</span>
                      <span>Blocked: {new Date(blockedIP.blocked_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setDeleteConfirmIP(blockedIP)}
                    className="p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-success)]"
                    title="Unblock IP"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Information Panel */}
        <div
          className="mt-6 rounded-lg border p-4"
          style={{
            background: 'linear-gradient(to right, color-mix(in srgb, var(--color-error) 10%, transparent), color-mix(in srgb, var(--color-warning) 10%, transparent))',
            borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)',
          }}
        >
          <h3 className="mb-2 text-lg font-medium text-[var(--color-text)]">About IP Blocking</h3>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Blocked IP addresses are automatically prevented from accessing the server by the rate limiting middleware.
            IPs are typically blocked when they exceed rate limits or engage in malicious activities.
            You can manually block IPs here for security purposes, or unblock them if needed.
          </p>
        </div>
      </div>

      {/* Unblock Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmIP)}
        title="Unblock IP Address"
        description={deleteConfirmIP
          ? `Unblock ${deleteConfirmIP.ip}? This address will be able to access the server again.`
          : ""}
        confirmLabel="Unblock IP"
        cancelLabel="Cancel"
        tone="warning"
        onCancel={() => setDeleteConfirmIP(null)}
        onConfirm={() => {
          if (deleteConfirmIP?.ip) {
            void handleUnblockIP(deleteConfirmIP.ip);
          }
        }}
      />
    </div>
  );
}

// Simple User Profile Modal for viewing user information
export function UserProfileModal({
  isOpen,
  onClose,
  user,
  currentUserId,
  position,
  triggerRect
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  currentUserId: string;
  position?: { x: number; y: number };
  triggerRect?: DOMRect | null;
}) {
  const profileUserId = user?.id || user?.user_id || "";
  const { data: fetchedUser } = useUserProfile(profileUserId);

  if (!isOpen || !user) return null;

  const displayUser = fetchedUser
    ? {
        ...user,
        ...fetchedUser,
        id: fetchedUser.id || fetchedUser.user_id || user.id,
        username: fetchedUser.username || user.username,
        bio: fetchedUser.bio || user.bio,
        joinedAt: fetchedUser.joinedAt || fetchedUser.created_at || user.joinedAt || new Date().toISOString(),
        avatar_url: fetchedUser.avatar_url ?? user.avatar_url ?? null,
        avatar: fetchedUser.avatar ?? user.avatar ?? null,
      }
    : {
        ...user,
        joinedAt: user.joinedAt || new Date().toISOString(),
      };

  return (
    <div
      className="fixed z-50 bg-[var(--color-surface)] rounded-lg shadow-lg border border-[var(--color-border)] py-2 w-64"
      style={{
        left: position?.x || '50%',
        top: position?.y || '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)'
      }}
    >
      <div className="px-4 py-2">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-3">
          <ControlPanelAvatar
            username={displayUser.username}
            avatarUrl={displayUser.avatar_url || displayUser.avatar}
            className="h-8 w-8 rounded-full border border-[var(--color-border)]"
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[var(--color-text)] truncate">{displayUser.username}</div>
            <div className="text-xs text-[var(--color-text-secondary)]">{displayUser.bio}</div>
          </div>
        </div>

        {/* Joined date */}
        <div className="text-xs text-[var(--color-text-muted)] pb-2">
          Joined {new Date(displayUser.joinedAt).toLocaleDateString()}
        </div>

        {/* Actions (if different from current user) */}
        {displayUser.id !== currentUserId && (
          <div className="border-t border-[var(--color-border)] pt-2">
            <button className="w-full text-left px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] rounded transition-colors">
              Start Conversation
            </button>
            <button className="w-full text-left px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] rounded transition-colors">
              Add Friend
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Logs Tab Component
export function LogsTab({
  showToast
}: {
  showToast: ShowToast;
}) {
  const [logs, setLogs] = useState<string[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        setError('Authentication token not found');
        setLoading(false);
        return;
      }

      const request: any = {};
      // Add search and level filters if provided
      if (searchTerm.trim()) {
        request.lines = 1000; // Fetch more lines when searching to ensure results
        // Note: server-side filtering would be better, but implementing client-side for now
      }
      // Add level filter
      if (logLevel !== 'all') {
        request.level = logLevel.toUpperCase() as 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
      }

      const response = await getServerLogs(authToken, request);
      if (response.success && response.data) {
        // Extract the actual log lines from the content field if available
        let logLines: string[] = [];
        const logsData = response.data.logs;

        if (logsData) {
          if (Array.isArray(logsData)) {
            // If logs is an array of objects with content/raw fields
            logLines = (logsData as any[]).map((log: any) => {
              // Ensure we always return a string, even if the field contains other types
              const raw = log.raw || log.content || log;
              return typeof raw === 'string' ? raw : String(raw);
            });
          } else if (typeof logsData === 'string') {
            // If logs is a string, split by newlines
            logLines = (logsData as string).split('\n').filter((line: string) => line.trim() !== '');
          } else {
            logLines = [];
          }
        } else {
          logLines = [];
        }

        setLogs(logLines);
        applyFilters(logLines, searchTerm, logLevel);
      } else {
        setError(response.error || 'Failed to load logs');
      }
    } catch (err) {
      setError('Failed to load logs');
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (logList: string[], search: string, level: string) => {
    let filtered = logList;

    // Filter by log level
    if (level !== 'all') {
      filtered = filtered.filter(line => {
        const upperLine = line.toUpperCase();
        switch (level) {
          case 'error':
            return upperLine.includes('ERROR') || upperLine.includes('[ERROR]');
          case 'warning':
            return upperLine.includes('WARN') || upperLine.includes('[WARN]') ||
                   upperLine.includes('WARNING') || upperLine.includes('[WARNING]');
          case 'info':
            return upperLine.includes('INFO') || upperLine.includes('[INFO]');
          case 'debug':
            return upperLine.includes('DEBUG') || upperLine.includes('[DEBUG]');
          default:
            return true;
        }
      });
    }

    // Filter by search term
    if (search.trim()) {
      filtered = filtered.filter(line =>
        line.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters(logs, searchTerm, logLevel);
  }, [logs, searchTerm, logLevel]);

  const ansiToHtml = (text: any): string => {
    // Ensure text is a string
    if (typeof text !== 'string') {
      text = String(text);
    }

    // Basic ANSI color parsing - converts common ANSI codes to HTML spans
    // \x1b[31m = red, \x1b[32m = green, \x1b[33m = yellow, etc.
    // Using CSS custom properties to match the app's color scheme
    let html = text
      .replace(/\x1b\[31m/g, '<span style="color: var(--color-error);">') // Red for errors
      .replace(/\x1b\[32m/g, '<span style="color: var(--color-success);">') // Green for success
      .replace(/\x1b\[33m/g, '<span style="color: var(--color-warning);">') // Yellow for warnings
      .replace(/\x1b\[34m/g, '<span style="color: var(--color-primary);">') // Blue for info
      .replace(/\x1b\[35m/g, '<span style="color: var(--color-accent);">') // Magenta/purple
      .replace(/\x1b\[36m/g, '<span style="color: var(--color-info);">') // Cyan/blue
      .replace(/\x1b\[37m/g, '<span style="color: var(--color-text);">') // White/bright text
      .replace(/\x1b\[0m/g, '</span>') // Reset
      .replace(/\x1b\[1m/g, '<span style="font-weight: bold;">') // Bold
      .replace(/\x1b\[4m/g, '<span style="text-decoration: underline;">'); // Underline

    // Close any unclosed spans
    const openSpans = (html.match(/<span/g) || []).length;
    const closeSpans = (html.match(/<\/span>/g) || []).length;
    if (openSpans > closeSpans) {
      html += '</span>'.repeat(openSpans - closeSpans);
    }

    return html;
  };

  const downloadLogs = () => {
    const logContent = logs.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `server-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLogs = async () => {
    setLogs([]);
    setFilteredLogs([]);
  };

  return (
    <div className="space-y-6">
      {/* Logs Header */}
      <div className={controlPanelSectionClass}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">Server Logs</h2>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Live server logs with filtering and color support</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-[var(--color-text-secondary)]">
              {filteredLogs.length} / {logs.length} entries
            </div>
            <button
              onClick={loadLogs}
              disabled={loading}
              className={cx(controlPanelButtonClass('primary'), "disabled:opacity-60")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{loading ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={controlPanelInputClass}
            />
          </div>

          {/* Filter by level */}
          <div className="flex items-center space-x-2">
            <label className="font-medium text-[var(--color-text)]">Level:</label>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className={controlPanelSelectClass}
            >
              <option value="all">All</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          {/* Auto-scroll toggle */}
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-[var(--color-border)] text-[var(--color-primary)]"
              />
              <span className="text-sm text-[var(--color-text)]">Auto-scroll</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-2">
            <button
              onClick={downloadLogs}
              className={controlPanelButtonClass('secondary')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download Logs</span>
            </button>
            <button
              onClick={clearLogs}
              className={controlPanelButtonClass('danger')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-[var(--color-text-secondary)] py-12">
            <svg className="w-8 h-8 animate-spin text-[var(--color-primary)] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p>Loading server logs...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-[var(--color-error)]">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Error Loading Logs</h3>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={loadLogs}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          /* Logs Display */
          <div className={controlPanelInsetClass}>
            <div className="p-4 border-b border-[var(--color-border)]">
              <h3 className="font-medium text-[var(--color-text)]">
                Server Logs
                {filteredLogs.length !== logs.length && (
                  <span className="text-[var(--color-text-secondary)] text-sm ml-2">
                    (filtered)
                  </span>
                )}
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto rounded-[1rem] bg-[var(--color-background)] p-4 font-mono text-sm">
              {filteredLogs.length === 0 ? (
                <div className="text-center text-[var(--color-text-secondary)] py-8">
                  {logs.length === 0 ? (
                    <>
                      <svg className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>No logs available</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-2">Server logs will appear here when they become available</p>
                    </>
                  ) : (
                    <p>No logs match your search criteria</p>
                  )}
                </div>
              ) : (
                <>
                  {filteredLogs.map((line, index) => (
                    <div
                      key={index}
                      className="mb-1 hover:bg-[var(--color-surface)] px-2 py-1 rounded text-[var(--color-text)]"
                      dangerouslySetInnerHTML={{ __html: ansiToHtml(line) }}
                    />
                  ))}
                  <div ref={logsEndRef} />
                </>
              )}
            </div>
          </div>
        )}

        {/* Information Panel */}
        <div
          className="mt-6 rounded-[1.25rem] border p-4"
          style={{
            background: 'linear-gradient(to right, color-mix(in srgb, var(--color-primary) 18%, transparent), color-mix(in srgb, var(--color-accent) 12%, transparent))',
            borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)',
          }}
        >
          <h3 className="mb-2 text-lg font-medium text-[var(--color-text)]">About Server Logs</h3>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Server logs capture all system activity including requests, errors, warnings, and debug information.
            Color codes are preserved for better readability. Use filters to focus on specific types of logs or search by content.
          </p>
        </div>
      </div>
    </div>
  );
}

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
              <div className="text-center text-[var(--color-error)] py-8">{reportsError}</div>
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
