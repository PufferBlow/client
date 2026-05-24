/**
 * OverviewTab — dashboard landing pane. Shows server banner/avatar, key
 * metrics, registration/activity/online/channel charts, and live
 * telemetry. The recent-activity feed used to live here too but moved
 * to its own dedicated tab so this pane stays focused on counters +
 * charts + telemetry; the feed has its own scrolling needs that
 * pulled the page's attention.
 */
import React, { useEffect, useState } from "react";
import { Line, Bar, Pie } from "react-chartjs-2";
import { getAuthTokenFromCookies } from "../../../services/user";
import {
  getUserRegistrationsChart,
  getMessageActivityChart,
  getOnlineUsersChart,
  getChannelCreationChart,
  getUserStatusChart,
  getServerInfo,
  getServerUsage,
  getActivityMetrics,
  getServerOverview,
  type Period,
  type ChartData,
  type RawStats,
  type ServerUsage,
  type ActivityMetrics,
  type ServerOverview,
} from "../../../services/system";
import { logger } from "../../../utils/logger";
import {
  cx,
  controlPanelSectionClass,
  controlPanelInsetClass,
  controlPanelQuietClass,
  controlPanelCardClass,
  controlPanelMetricClass,
  controlPanelChartCardClass,
  controlPanelButtonClass,
  controlPanelSegmentClass,
  controlPanelBadgeClass,
  formatCompactNumber,
} from "../shared";
import { getControlPanelChartPalette, createChartOptions } from "../chartPalette";

// `onSettingsClick` is accepted for back-compat with the existing
// caller in ControlPanelContent but the in-tab button that used it
// (in the now-removed server banner) is gone. The prop is silently
// unused; we can drop it from the call site whenever convenient.
export function OverviewTab(_props: { onSettingsClick?: () => void } = {}) {
  const [viewMode, setViewMode] = useState<'numbers' | 'diagram'>('numbers');
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

        // Helper function to format chart data for Chart.js.
        //
        // Backend shapes we accept here:
        //  1. Chart.js native: `{labels, datasets}` — passed through.
        //  2. Time-series array from `_chart_response`: each item is a
        //     `ChartData.to_chart_format()` row, i.e.
        //       { time_key, primary_value, metrics, period,
        //         timestamp, date? }
        //     The label comes from `date` / `time_key`, the value
        //     from `primary_value` (or `metrics.count` as a fallback).
        //  3. Pie-shape array from the user_status route:
        //       [{label, value}, ...]
        //  4. Object map fallback: `{key1: number, ...}`.
        const formatChartData = (backendData: any, chartType: string) => {
          if (!backendData || (Array.isArray(backendData) && backendData.length === 0)) {
            return null;
          }

          // If already in Chart.js format, return as-is
          if (!Array.isArray(backendData) && typeof backendData === 'object' &&
              'labels' in backendData && 'datasets' in backendData &&
              Array.isArray(backendData.datasets)) {
            return backendData;
          }

          // If backend returns a different format, try to transform it
          // This is a fallback for various possible backend response formats
          try {
            let labels: string[] = [];
            let data: number[] = [];

            // Handle different possible data formats from backend
            if (Array.isArray(backendData)) {
              labels = backendData.map((item, idx) => {
                if (typeof item !== 'object' || item === null) return `Item ${idx + 1}`;
                // Backend `ChartData.to_chart_format()` priority: date
                // (daily), time_key (anything), timestamp (hourly).
                // Fall back to the generic Chart.js item keys for
                // forward-compat with any future shape.
                return (
                  item.label ??
                  item.name ??
                  item.date ??
                  item.time_key ??
                  item.timestamp ??
                  item.x ??
                  `Item ${idx + 1}`
                );
              });
              data = backendData.map((item) => {
                if (typeof item !== 'object' || item === null) {
                  return parseFloat(String(item ?? 0)) || 0;
                }
                // primary_value is what the backend stores on every
                // ChartData row; the rest are fallbacks for older /
                // alternate shapes.
                const candidate =
                  item.primary_value ??
                  item.value ??
                  item.y ??
                  item.data ??
                  item.count ??
                  (item.metrics && (item.metrics.count ?? item.metrics.value)) ??
                  0;
                const n = typeof candidate === 'number' ? candidate : parseFloat(String(candidate));
                return Number.isFinite(n) ? n : 0;
              });
            } else if (typeof backendData === 'object') {
              // Handle object format
              labels = Object.keys(backendData).filter(key => key !== 'labels' && key !== 'datasets');
              data = labels.map((key) => {
                const v = (backendData as any)[key];
                const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
                return Number.isFinite(n) ? n : 0;
              });
            }

            // Ensure we have valid data. Returning null here lets the
            // caller render the "no data yet" empty state instead of
            // a misleading "Item 1: 0" placeholder bar.
            if (labels.length === 0 || data.every((d) => !Number.isFinite(d) || d === 0)) {
              if (labels.length === 0) {
                return null;
              }
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

  /**
   * Status for a single resource value. Returns both a human-readable
   * label and a control-panel tone so cards can stamp the right badge.
   * Thresholds:
   *   - <45%   Healthy   (success)
   *   - 45-64% Normal    (info)
   *   - 65-84% Warm      (warning)  -- worth keeping an eye on
   *   - ≥85%   Critical  (danger)   -- act before things start failing
   */
  const getUsageStatus = (
    value: number,
  ): { label: string; tone: "success" | "info" | "warning" | "danger" } => {
    if (value >= 85) return { label: "Critical", tone: "danger" };
    if (value >= 65) return { label: "Warm", tone: "warning" };
    if (value >= 45) return { label: "Normal", tone: "info" };
    return { label: "Healthy", tone: "success" };
  };

  /** Format the larger I/O numbers without being noisy at low rates. */
  const formatThroughput = (mbPerSec: number): string => {
    if (mbPerSec < 0.05) return "Idle";
    if (mbPerSec < 1) return `${(mbPerSec * 1000).toFixed(0)} KB/s`;
    return `${mbPerSec.toFixed(1)} MB/s`;
  };

  /** Compact uptime: "4d 12h", "12h 30m", or "45m" rather than the
   *  back-end's verbose format which can run "4 days, 12 hours, ...". */
  const formatUptime = (seconds: number): string => {
    const s = Math.max(0, Math.floor(seconds));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
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

  /**
   * Resource utilization CARD — the wide-screen treatment. Big headline
   * percent (3xl tabular-nums so successive frames don't jitter),
   * progress bar for shape-at-a-glance, status badge that names the
   * severity ("Healthy" / "Warm" / "Critical"), and the GB-of-GB
   * detail line so the percent isn't disembodied. Used on sm+ where
   * the 4-column grid has room to breathe.
   */
  const UsageCard = ({
    label,
    value,
    detail,
  }: {
    label: string;
    value: number;
    detail: string;
  }) => {
    const status = getUsageStatus(value);
    const accent = getUsageTone(value);
    return (
      <div className={controlPanelCardClass}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            {label}
          </span>
          <span className={controlPanelBadgeClass(status.tone)}>{status.label}</span>
        </div>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums tracking-[-0.04em] text-[var(--color-text)]">
            {Math.round(value)}
          </span>
          <span className="text-base text-[var(--color-text-tertiary)]">%</span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-background)]">
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(value, 100))}%`, backgroundColor: accent }}
          />
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">{detail}</div>
      </div>
    );
  };

  /**
   * Compact horizontal ROW — the mobile-first treatment. Four resource
   * cards stacked vertically on a phone screen would push the rest of
   * the overview off the viewport; we collapse each one into a single-
   * line composition: small label · inline progress bar · percent ·
   * tiny status dot.
   *
   *   CPU        ━━━━━━━━━━━━━━━━━━━━░░░░░░░░  72%  ●
   *
   * Optional ``detailLine`` (memory / storage carry GB-of-GB; CPU
   * doesn't) sits below the row in muted text so it's reachable
   * without a tap. The status is communicated by the dot's color —
   * a full badge would re-introduce the line wrap problem on
   * narrow widths. Color matches the bar fill for consistency.
   */
  const UsageRow = ({
    label,
    value,
    detail,
  }: {
    label: string;
    value: number;
    detail?: string;
  }) => {
    const accent = getUsageTone(value);
    const status = getUsageStatus(value);
    return (
      <div className="rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2.5">
        <div className="flex items-center gap-3">
          <span className="w-[4.5rem] shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            {label}
          </span>
          {/* Bar takes the remaining width. `flex-1` + `min-w-0` is
              the standard trick to let it shrink with the parent
              instead of pushing the % column off-screen. */}
          <div className="h-1.5 flex-1 min-w-0 overflow-hidden rounded-full bg-[var(--color-background)]">
            <div
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(value, 100))}%`, backgroundColor: accent }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--color-text)]">
            {Math.round(value)}%
          </span>
          {/* Status dot — color carries the severity. aria-label
              keeps screen readers in the loop without needing a
              visible badge. */}
          <span
            aria-label={status.label}
            role="img"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
        </div>
        {detail ? (
          // Detail line shows the human-readable GB-of-GB context.
          // Offset by the label column width so it aligns under the
          // bar — easier to scan than left-aligned.
          <div className="mt-1 pl-[5.5rem] text-[11px] text-[var(--color-text-secondary)]">
            {detail}
          </div>
        ) : null}
      </div>
    );
  };

  /**
   * Disk I/O CARD — wide-screen treatment. Read + write throughputs
   * with up/down arrows, same card chrome as UsageCard so the row
   * reads as one coherent group rather than "three percent cards
   * plus a random I/O card." `formatThroughput` shows "Idle" below
   * ~50 KB/s so a quiet server doesn't read as broken.
   */
  const DiskIOCard = ({
    readMbPerSec,
    writeMbPerSec,
  }: {
    readMbPerSec: number;
    writeMbPerSec: number;
  }) => (
    <div className={controlPanelCardClass}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          Disk I/O
        </span>
        <span className={controlPanelBadgeClass("info")}>Throughput</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Read
          </span>
          <span className="text-sm font-medium tabular-nums text-[var(--color-text)]">
            {formatThroughput(readMbPerSec)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            Write
          </span>
          <span className="text-sm font-medium tabular-nums text-[var(--color-text)]">
            {formatThroughput(writeMbPerSec)}
          </span>
        </div>
      </div>
    </div>
  );

  /**
   * Compact Disk I/O ROW — mobile counterpart to ``DiskIOCard``.
   * Read + write inline with arrows; matches the visual cadence of
   * ``UsageRow`` (one line per resource) so the four resources read
   * as a single tidy list rather than three rows + one card.
   *
   *   DISK I/O       ↓ 2.4 MB/s   ↑ 0.5 MB/s
   */
  const DiskIORow = ({
    readMbPerSec,
    writeMbPerSec,
  }: {
    readMbPerSec: number;
    writeMbPerSec: number;
  }) => (
    <div className="rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="w-[4.5rem] shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
          Disk I/O
        </span>
        <div className="flex flex-1 min-w-0 items-center justify-end gap-4 text-sm tabular-nums text-[var(--color-text)]">
          <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span className="font-medium text-[var(--color-text)]">{formatThroughput(readMbPerSec)}</span>
          </span>
          <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span className="font-medium text-[var(--color-text)]">{formatThroughput(writeMbPerSec)}</span>
          </span>
        </div>
      </div>
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
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-6">
      {/* Server banner block (avatar + name + description + version
          badges + Instance Settings button) was removed -- it duplicated
          information available in the Dashboard sidebar and the Server
          tab. The Overview pane now opens directly with the metrics
          + telemetry grid. */}

      <section className={cx(controlPanelSectionClass, "flex min-h-0 flex-1 flex-col overflow-y-auto pr-1")}>
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
              {/* Inset padding tightens on mobile (p-4) and opens back
                  up on sm+ (p-5) so the compact rows below don't
                  feel cramped against the inset border. */}
              <div className={cx(controlPanelInsetClass, "p-4 sm:p-5")}>
                {/* Header layout switches at sm: stacked (title then
                    badge on its own line) on mobile so the badge
                    can't bump the title onto two lines; side-by-side
                    on sm+ where there's horizontal room. */}
                <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold tracking-[-0.02em] text-[var(--color-text)]">
                      Live telemetry
                    </h3>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)] sm:text-sm">
                      Host CPU, memory, storage, and I/O. Status is the
                      severity of the worst resource right now.
                    </p>
                  </div>
                  {/* Single status badge driven by the worst resource.
                      `self-start` keeps it from stretching to the
                      header column width on mobile. */}
                  {(() => {
                    if (usageError) {
                      return (
                        <span className={cx(controlPanelBadgeClass("danger"), "self-start")}>
                          Telemetry offline
                        </span>
                      );
                    }
                    if (usageLoading || !serverUsage) {
                      return (
                        <span className={cx(controlPanelBadgeClass("info"), "self-start")}>Collecting…</span>
                      );
                    }
                    const worst = Math.max(
                      serverUsage.cpu_percent,
                      serverUsage.ram_percent,
                      serverUsage.storage_percent,
                    );
                    const overall = getUsageStatus(worst);
                    return (
                      <span className={cx(controlPanelBadgeClass(overall.tone), "self-start")}>
                        {overall.tone === "success"
                          ? "All systems healthy"
                          : overall.tone === "info"
                            ? "Normal load"
                            : overall.tone === "warning"
                              ? "Monitor"
                              : "Attention needed"}
                      </span>
                    );
                  })()}
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
                  <div className="space-y-3 sm:space-y-4">
                    {/* TWO renderings, mutually visible via Tailwind
                        breakpoints — no JS branching needed:

                          * < sm — compact one-line ``UsageRow`` /
                            ``DiskIORow`` items stacked. Each is ~36px
                            tall, so the whole strip fits in ~150px
                            and leaves the rest of the overview
                            visible without a scroll.
                          * ≥ sm — the existing card grid (`md:2-col`,
                            `xl:4-col`). Each card has the big 3xl
                            percentage and the GB-of-GB detail.

                        Same data either way; the chrome is what
                        differs. Both surfaces share the same status /
                        accent helpers so the colors stay consistent
                        between viewports — same red dot on the row
                        view IS the same accent on the card bar. */}
                    <div className="space-y-2 sm:hidden">
                      <UsageRow
                        label="CPU"
                        value={serverUsage.cpu_percent}
                      />
                      <UsageRow
                        label="Memory"
                        value={serverUsage.ram_percent}
                        detail={`${serverUsage.ram_used_gb} GB of ${serverUsage.ram_total_gb} GB`}
                      />
                      <UsageRow
                        label="Storage"
                        value={serverUsage.storage_percent}
                        detail={`${serverUsage.storage_used_gb} GB of ${serverUsage.storage_total_gb} GB`}
                      />
                      <DiskIORow
                        readMbPerSec={serverUsage.disk_read_mb_per_sec}
                        writeMbPerSec={serverUsage.disk_write_mb_per_sec}
                      />
                    </div>

                    <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
                      <UsageCard
                        label="CPU"
                        value={serverUsage.cpu_percent}
                        detail="Processor load"
                      />
                      <UsageCard
                        label="Memory"
                        value={serverUsage.ram_percent}
                        detail={`${serverUsage.ram_used_gb} GB of ${serverUsage.ram_total_gb} GB`}
                      />
                      <UsageCard
                        label="Storage"
                        value={serverUsage.storage_percent}
                        detail={`${serverUsage.storage_used_gb} GB of ${serverUsage.storage_total_gb} GB`}
                      />
                      <DiskIOCard
                        readMbPerSec={serverUsage.disk_read_mb_per_sec}
                        writeMbPerSec={serverUsage.disk_write_mb_per_sec}
                      />
                    </div>

                    {/* Footer strip — uptime + last-updated. On mobile
                        we drop the heavy `controlPanelQuietClass`
                        chrome (rounded-2xl + 20px padding) for a thin
                        rule + tight padding so the footer doesn't
                        outweigh the compact rows above it. The
                        labels also shorten ("Uptime" stays, "Updated"
                        becomes a relative shorthand) so the line
                        doesn't wrap on narrow phones. */}
                    <div className="rounded-lg border border-[var(--color-border-secondary)] bg-[color:color-mix(in_srgb,var(--color-surface-secondary)_72%,var(--color-background)_28%)] px-3 py-2 sm:rounded-[1.25rem] sm:px-5 sm:py-4">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)] sm:text-sm">
                        <span className="flex items-center gap-1.5 sm:gap-2">
                          <svg className="h-3.5 w-3.5 text-[var(--color-text-tertiary)] sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Uptime{" "}
                          <span className="font-medium tabular-nums text-[var(--color-text)]">
                            {formatUptime(serverUsage.uptime_seconds)}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 sm:gap-2">
                          <svg className="h-3.5 w-3.5 text-[var(--color-text-tertiary)] sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Updated{" "}
                          <span className="font-medium tabular-nums text-[var(--color-text)]">
                            {new Date(serverUsage.timestamp * 1000).toLocaleTimeString()}
                          </span>
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

      {/* Recent activity feed moved to its own "Activity" tab so this
          pane stays focused on counters + telemetry. See ControlPanelContent
          for the routing. */}
    </div>
  );
}