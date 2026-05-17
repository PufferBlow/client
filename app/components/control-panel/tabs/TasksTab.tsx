/**
 * TasksTab — admin view for monitoring & toggling registered background
 * tasks (cleanup, retention, db backup, etc.). Also surfaces the DB-backup
 * configuration panel.
 *
 * `IRRELEVANT_TASK_IDS` filters out task IDs the backend exposes but
 * that aren't actually wired to any real work yet (placeholder /
 * aspirational endpoints). Adding an entry here hides the row from
 * the admin UI without modifying the backend. Empty by default --
 * populate when a stale task definition appears.
 */
import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";

const IRRELEVANT_TASK_IDS: Set<string> = new Set([
  // Add task IDs here as they're identified as placeholder-only.
  // Example: "experimental_metric_export",
]);
import { getAuthTokenFromCookies } from "../../../services/user";
import {
  getBackgroundTaskStatuses,
  runBackgroundTask,
  toggleBackgroundTask,
  getBackupConfig,
  updateBackupConfig,
} from "../../../services/backgroundTasks";
import type { ShowToast } from "../../Toast";
import { Modal } from "../../ui/Modal";
import { Button } from "../../Button";
import {
  cx,
  controlPanelSectionClass,
  controlPanelButtonClass,
  controlPanelInputClass,
  controlPanelRowClass,
} from "../shared";

export function TasksTab({
  showToast
}: {
  showToast: ShowToast;
}) {
  const [tasks, setTasks] = useState<Record<string, import('../../../services/backgroundTasks').TaskInfo>>({});
  const [loading, setLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [showBackupConfig, setShowBackupConfig] = useState(false);
  const [backupConfig, setBackupConfig] = useState<import('../../../services/backgroundTasks').BackupConfig>({
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
        setTasks(result.data.tasks as Record<string, import('../../../services/backgroundTasks').TaskInfo>);
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

  const statusColor = (task: import('../../../services/backgroundTasks').TaskInfo) => {
    if (task.running) return 'text-[var(--color-success)]';
    if (!task.enabled) return 'text-[var(--color-text-muted)]';
    if (task.last_error && task.errors > 0) return 'text-[var(--color-error)]';
    return 'text-[var(--color-text-secondary)]';
  };

  const statusLabel = (task: import('../../../services/backgroundTasks').TaskInfo) => {
    if (task.running) return 'running';
    if (!task.enabled) return 'disabled';
    if (task.last_error && task.errors > 0 && task.runs > 0 && task.errors === task.runs) return 'error';
    return 'idle';
  };

  const taskEntries = Object.entries(tasks).filter(
    ([taskId]) => !IRRELEVANT_TASK_IDS.has(taskId),
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-6">
      <div className={cx(controlPanelSectionClass, "flex min-h-0 flex-1 flex-col")}>
        <div className="flex items-center justify-between mb-6">
          {/* Header buttons removed:
              - "Backup Config" toggle: backup config now opens as a
                floating modal triggered by the per-row Configure
                button on the database_backup task.
              - "Refresh": the running-task poll already keeps the list
                live; a manual refresh button was redundant. */}
          <h2 className="text-lg font-medium text-[var(--color-text)]">Background Tasks</h2>
        </div>

        {/* Backup Config — now a floating modal, opened from the per-row
            "Configure" button below. Renders outside the task-list
            scroller so it never gets clipped by the section padding. */}
        <Modal
          isOpen={showBackupConfig}
          onClose={() => setShowBackupConfig(false)}
          title="Database Backup Configuration"
          widthClassName="max-w-2xl"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowBackupConfig(false)}>
                Close
              </Button>
              <Button onClick={handleSaveBackupConfig} disabled={savingBackup || backupConfigLoading}>
                {savingBackup ? 'Saving…' : 'Save Backup Config'}
              </Button>
            </div>
          }
        >
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

            </div>
          )}
        </Modal>

        {/* Task list */}
        {loading && taskEntries.length === 0 ? (
          <div className="text-center text-[var(--color-text-secondary)] py-8">Loading tasks…</div>
        ) : taskEntries.length === 0 ? (
          <div className="text-center text-[var(--color-text-secondary)] py-8">No background tasks registered.</div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
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
                    {/* Enable indicator restyled as a square check box
                        instead of a sliding pill. The square + check
                        glyph reads more clearly as "this task IS / IS
                        NOT enabled" than the slider did, which looked
                        like a generic "feature toggle". */}
                    <button
                      type="button"
                      onClick={() => handleToggleTask(taskId, task.enabled)}
                      className="flex items-center space-x-2 group"
                      aria-pressed={task.enabled}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                          task.enabled
                            ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface)] text-transparent group-hover:bg-[var(--color-hover)]"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      <span className="text-sm text-[var(--color-text)]">
                        {task.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </button>

                    <div className="flex space-x-2">
                      {isDatabaseBackup && (
                        <button
                          onClick={() => setShowBackupConfig(true)}
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