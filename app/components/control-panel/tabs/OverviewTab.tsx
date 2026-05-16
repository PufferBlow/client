/**
 * OverviewTab — dashboard landing pane. Shows server banner/avatar, key
 * metrics, registration/activity/online/channel charts, and the
 * RecentActivity feed.
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
import { convertToFullStorageUrl } from "../../../services/apiClient";
import { logger } from "../../../utils/logger";
import { RecentActivity } from "../RecentActivity";
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