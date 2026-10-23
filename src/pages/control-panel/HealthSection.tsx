import { useMemo, useState, type ReactNode } from "react";
import { Panel } from "../../components/control-panel/Panel";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { HostPill } from "../../components/ui/HostPill";
import { LoadingState } from "../../components/ui/LoadingState";
import { useInstanceHealth } from "../../features/health/hooks";
import {
  ago,
  badDays,
  buildChart,
  dayTone,
  formatPercent,
  formatUptime,
  resourceTone,
  sparkline,
  TONE_COLOUR,
  type Tone,
} from "../../features/health/format";
import type { InstanceHealth } from "../../features/health/types";
import { classifyAuthError } from "../../utils/authErrors";

/** A request this slow, at the 95th percentile, is a problem. */
const SLO_MS = 250;
const CHART_W = 600;
const CHART_H = 180;

const label = "pb-section-label text-text-tertiary";

function StatusPill({ status }: { status: InstanceHealth["status"] }) {
  const ok = status === "ok";
  const colour = ok ? "var(--color-in-game)" : "var(--color-warning)";
  return (
    <span
      className="inline-flex h-[30px] items-center gap-2 rounded-pill px-3 font-heading text-[11.5px] font-bold uppercase tracking-[0.1em]"
      style={{ color: colour, background: `color-mix(in srgb, ${colour} 14%, transparent)` }}
    >
      <span className="size-2 rounded-full" style={{ background: colour }} />
      {ok ? "Operational" : "Degraded"}
    </span>
  );
}

function Kpi({ title, value, unit, spark, tone = "ok", note }: { title: string; value: string; unit?: string; spark?: string; tone?: Tone; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-background-secondary p-4">
      <span className={label}>{title}</span>
      <div className="flex items-end justify-between gap-2.5">
        <span className="flex items-baseline gap-1">
          <span className="pb-data-figure">{value}</span>
          {unit && <span className="text-[13px] text-text-tertiary">{unit}</span>}
        </span>
        {spark && (
          <svg viewBox="0 0 120 32" preserveAspectRatio="none" className="h-7 w-24 overflow-visible" aria-hidden="true">
            <polyline points={spark} fill="none" stroke={TONE_COLOUR[tone]} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        )}
      </div>
      {note && <span className="pb-meta text-xs">{note}</span>}
    </div>
  );
}

/** One bar per day: white for a good day, amber or red for a bad one, a dim stub when nobody was watching. */
function UptimeBar({ health }: { health: InstanceHealth }) {
  const days = health.uptime_days;
  return (
    <div className="flex flex-col gap-2" role="img" aria-label={`Uptime over ${days.length} days: ${formatPercent(health.uptime_percent)}, ${badDays(days)} days with trouble`}>
      <div className="flex items-center justify-between gap-2.5">
        <span className={label}>Uptime · {days.length} days</span>
        <span className="font-heading text-[13px] font-bold tracking-[0.06em]">{formatPercent(health.uptime_percent)}</span>
      </div>
      <div className="flex h-[34px] items-stretch gap-0.5">
        {days.map((d) => {
          const tone = dayTone(d.ratio);
          return (
            <span
              key={d.day}
              title={d.ratio === null ? `${d.day}: not watched` : `${d.day}: ${formatPercent(d.ratio * 100)}`}
              className="min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-70"
              style={{ background: tone ? TONE_COLOUR[tone] : "rgba(242,242,242,0.08)" }}
            />
          );
        })}
      </div>
      <div className="pb-data-axis flex justify-between">
        <span>{days.length} days ago</span>
        <span>today</span>
      </div>
    </div>
  );
}

function LatencyChart({ series }: { series: InstanceHealth["latency"]["series"] }) {
  const chart = useMemo(() => buildChart(series, CHART_W, CHART_H, SLO_MS), [series]);
  const [hover, setHover] = useState<number | null>(null);
  const worst = Math.max(0, ...series.map((p) => p.p95));
  const line = worst > SLO_MS ? TONE_COLOUR.danger : TONE_COLOUR.ok;
  const shown = hover === null ? null : series[hover]!;
  const sloY = chart.y(SLO_MS);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className={label}>API latency · 24 h</span>
        <span className="flex gap-3.5 font-mono text-[11px] text-text-tertiary">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-text" />p95</span>
          <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed border-text-muted" />p50</span>
          <span className="flex items-center gap-1.5"><span className="w-3.5 border-t border-dashed border-error" />SLO {SLO_MS} ms</span>
        </span>
      </div>
      {series.length === 0 ? (
        <p className="pb-meta m-0 text-[13px]">No requests recorded yet. The chart fills in as the instance is used; it starts over when the instance restarts.</p>
      ) : (
        <div
          className="relative h-[200px]"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const plot = rect.width - 34;
            setHover(chart.nearest((e.clientX - rect.left - 34) / plot)?.index ?? null);
          }}
        >
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" role="img" aria-label="Request latency over the last day" className="absolute bottom-5 left-[34px] h-[180px] overflow-visible" style={{ width: "calc(100% - 34px)" }}>
            {[0, 60, 120].map((y) => (
              <line key={y} x1="0" x2={CHART_W} y1={y} y2={y} stroke="rgba(242,242,242,.06)" vectorEffect="non-scaling-stroke" />
            ))}
            <line x1="0" x2={CHART_W} y1={CHART_H} y2={CHART_H} stroke="rgba(242,242,242,.12)" vectorEffect="non-scaling-stroke" />
            {sloY !== null && <line x1="0" x2={CHART_W} y1={sloY} y2={sloY} stroke="#e2654f" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
            <polygon points={chart.area} fill="rgba(242,242,242,.06)" />
            <polyline points={chart.p50} fill="none" stroke="#707070" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            <polyline points={chart.p95} fill="none" stroke={line} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="pb-data-axis absolute left-0 top-0 flex h-[180px] w-[30px] flex-col items-end justify-between">
            <span className="-translate-y-1.5">{chart.max}</span>
            <span>{Math.round(chart.max / 2)}</span>
            <span className="translate-y-1.5">0</span>
          </div>
          {shown && hover !== null && (
            <div className="pointer-events-none absolute top-0 whitespace-nowrap rounded-sm bg-primary px-2.5 py-[7px] text-xs font-semibold leading-snug text-on-primary" style={{ left: `calc(34px + (100% - 34px) * ${series.length < 2 ? 0.5 : (shown.t - series[0]!.t) / Math.max(1, series.at(-1)!.t - series[0]!.t)})`, transform: "translateX(-50%)" }}>
              {new Date(shown.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · p95 {Math.round(shown.p95)} ms · p50 {Math.round(shown.p50)} ms · {shown.count} requests
            </div>
          )}
        </div>
      )}
      <p className="pb-meta m-0 text-xs">The line turns red only when it crosses the SLO. Hover for values.</p>
    </div>
  );
}

const STATE: Record<string, { colour: string; label: string }> = {
  ok: { colour: "var(--color-text)", label: "OK" },
  down: { colour: "var(--color-error)", label: "Down" },
};

function Checks({ checks, health }: { checks: InstanceHealth["checks"]; health: InstanceHealth }) {
  const [json, setJson] = useState(false);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2.5">
        <span className={label}>Checks</span>
        <div role="group" aria-label="Checks view" className="flex gap-1">
          {([["Checks", false], ["JSON", true]] as const).map(([name, on]) => (
            <button key={name} type="button" aria-pressed={json === on} onClick={() => setJson(on)} className={`pb-label-button h-8 rounded-sm border-0 px-3 text-[11.5px] ${json === on ? "bg-text text-on-primary" : "bg-surface-tertiary text-text-body hover:bg-active"}`}>
              {name}
            </button>
          ))}
        </div>
      </div>
      {json ? (
        <pre className="m-0 max-h-[340px] overflow-auto rounded-md bg-background p-4 font-mono text-xs leading-relaxed text-text-body">{JSON.stringify({ status: health.status, checks }, null, 2)}</pre>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {Object.entries(checks).map(([name, check]) => {
            const state = STATE[check.status] ?? STATE.down!;
            return (
              <li key={name} className="grid grid-cols-[20px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-2 py-2.5 hover:bg-surface-secondary">
                <span className="size-2.5 justify-self-center rounded-full" style={{ background: state.colour, boxShadow: `0 0 0 4px color-mix(in srgb, ${state.colour} 14%, transparent)` }} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold capitalize">{name}</span>
                  <span className={`truncate text-xs ${check.status === "ok" ? "text-text-tertiary" : "text-error-text"}`}>{check.note}</span>
                </span>
                <span className="font-heading text-[15px] font-bold tabular-nums text-text-body">{check.ms ? `${check.ms} ms` : "–"}</span>
                <span className="w-[62px] text-right font-heading text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: state.colour }}>{state.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Gauge({ name, percent }: { name: string; percent: number }) {
  const tone = resourceTone(percent);
  const colour = TONE_COLOUR[tone];
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-lg bg-background-secondary px-2 py-4">
      <div role="img" aria-label={`${name} ${percent}%`} className="grid size-24 place-items-center rounded-full" style={{ background: `conic-gradient(${colour} ${percent * 3.6}deg, rgba(242,242,242,.08) 0)` }}>
        <div className="grid size-[78px] place-items-center rounded-full bg-background-secondary">
          <span className="font-heading text-2xl font-bold tabular-nums" style={{ color: colour }}>{Math.round(percent)}%</span>
        </div>
      </div>
      <span className="text-[13px] font-semibold">{name}</span>
    </div>
  );
}

export function HealthSection() {
  const { data: health, isPending, error, refetch } = useInstanceHealth();

  if (isPending) return <LoadingState message="Checking the instance…" shape="cards" />;
  if (error) return <ErrorState title="Couldn't load the instance's health" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;

  const p95s = health.latency.series.map((p) => p.p95);
  const incidents = health.incidents;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <Panel
        title={health.instance ?? "This instance"}
        description={`Pufferblow ${health.version} · up ${formatUptime(health.uptime_s)}`}
        action={<StatusPill status={health.status} />}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi title="Uptime · 90 d" value={formatPercent(health.uptime_percent).replace("%", "")} unit="%" tone={health.uptime_percent !== null && health.uptime_percent < 99 ? "warn" : "ok"} note={`${badDays(health.uptime_days)} days with trouble`} />
            <Kpi title="API p95" value={String(Math.round(health.latency.p95))} unit="ms" spark={sparkline(p95s)} tone={health.latency.p95 > SLO_MS ? "danger" : "ok"} note={`p50 ${Math.round(health.latency.p50)} ms · SLO ${SLO_MS} ms`} />
            <Kpi title="Requests · 1 h" value={health.latency.samples.toLocaleString()} spark={sparkline(health.latency.series.map((p) => p.count))} note="Health checks not counted" />
            <Kpi title="Up since restart" value={formatUptime(health.uptime_s)} note="Latency starts over with the process" />
          </div>
          <UptimeBar health={health} />
        </div>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="Latency">
          <LatencyChart series={health.latency.series} />
        </Panel>
        <Panel title="Checks">
          <Checks checks={health.checks} health={health} />
        </Panel>
        <Panel title="Resources" description="White under 80%, warn from 80%, danger from 90%.">
          {health.resources ? (
            <div className="grid grid-cols-3 gap-2.5">
              <Gauge name="CPU" percent={health.resources.cpu} />
              <Gauge name="Memory" percent={health.resources.memory} />
              <Gauge name="Disk" percent={health.resources.disk} />
            </div>
          ) : (
            <p className="pb-meta m-0 text-[13px]">This instance can't read its own resource use (psutil is not installed).</p>
          )}
        </Panel>
        <Panel title="Federation peers" description="Instances linked by an accepted follow. Queues and delivery are not tracked yet.">
          {health.peers.length === 0 ? (
            <p className="pb-meta m-0 text-[13px]">No peers yet.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {health.peers.map((p) => (
                <li key={p.host} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <HostPill host={p.host} />
                    <span className="pb-meta text-xs">{p.follows} {p.follows === 1 ? "follow" : "follows"} · active {ago(p.last_activity)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Incidents" grow>
        {incidents.length === 0 ? (
          <EmptyState title="Nothing has gone wrong" description="When the instance's own check finds trouble, it shows up here and clears itself." />
        ) : (
          <ol className="m-0 flex list-none flex-col p-0">
            {incidents.map((i) => {
              const open = i.state !== "resolved";
              const colour = open ? "var(--color-error)" : "var(--color-text-muted)";
              return (
                <li key={i.incident_id} className="grid grid-cols-[14px_minmax(0,1fr)] gap-3.5">
                  <span className="flex flex-col items-center">
                    <span className="mt-[3px] size-3 rounded-full" style={{ background: colour, boxShadow: "0 0 0 3px var(--color-background-secondary)" }} />
                    <span className="w-0.5 flex-1 bg-border-secondary" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1 pb-[18px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{i.title}</span>
                      <span className="inline-flex h-5 items-center rounded-xs px-[7px] font-heading text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: open ? "var(--color-error-text)" : "var(--color-text-tertiary)", background: open ? "rgba(226,101,79,.14)" : "rgba(242,242,242,.08)" }}>
                        {open ? "Investigating" : "Resolved"}
                      </span>
                    </div>
                    {i.body && <span className="text-[13px] leading-snug text-text-tertiary">{i.body}</span>}
                    <span className="pb-data-axis">
                      {ago(i.started_at)}
                      {i.ended_at ? ` · resolved ${ago(i.ended_at)}` : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </div>
  );
}
