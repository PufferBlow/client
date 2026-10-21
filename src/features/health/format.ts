import type { LatencyPoint, UptimeDay } from "./types";

/** `2591204` -> `29d 23h`; the two biggest units that are not zero. */
export function formatUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export type Tone = "ok" | "warn" | "danger";

/** White under 80%, warn from 80%, danger from 90%. */
export function resourceTone(percent: number): Tone {
  return percent >= 90 ? "danger" : percent >= 80 ? "warn" : "ok";
}

/** A day's bar: good, a rough day, or a bad one. A day nobody was watching has no tone. */
export function dayTone(ratio: number | null): Tone | null {
  if (ratio === null) return null;
  return ratio >= 0.999 ? "ok" : ratio >= 0.95 ? "warn" : "danger";
}

export const TONE_COLOUR: Record<Tone, string> = { ok: "#f2f2f2", warn: "#e6c15c", danger: "#e2654f" };

/** `99.9993` -> `99.99%`: never rounds up to 100 while anything failed. */
export function formatPercent(value: number | null): string {
  if (value === null) return "–";
  if (value >= 100) return "100%";
  return `${Math.floor(value * 100) / 100}%`;
}

export interface Chart {
  p50: string;
  p95: string;
  area: string;
  /** The value at the top of the chart, rounded up to something tidy. */
  max: number;
  /** y for a level on the chart, or null when it is off the top. */
  y: (value: number) => number | null;
  /** The nearest point to an x in 0..1, for hover. */
  nearest: (x: number) => { index: number; point: LatencyPoint } | null;
}

/** Round up to 1, 2 or 5 times a power of ten, so the axis reads in clean numbers. */
export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const power = 10 ** Math.floor(Math.log10(value));
  const n = value / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power;
}

/** SVG polyline points for a latency series on a `width` x `height` plot (y grows downward). */
export function buildChart(series: readonly LatencyPoint[], width: number, height: number, slo?: number): Chart {
  const top = niceMax(Math.max(slo ?? 0, ...series.map((p) => p.p95), 1));
  const first = series[0]?.t ?? 0;
  const span = Math.max(1, (series.at(-1)?.t ?? 0) - first);
  const x = (t: number) => (series.length < 2 ? width / 2 : ((t - first) / span) * width);
  const y = (v: number) => height - Math.min(1, v / top) * height;
  const line = (pick: (p: LatencyPoint) => number) => series.map((p) => `${x(p.t).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(" ");
  const p95 = line((p) => p.p95);
  const area = series.length ? `${x(first).toFixed(1)},${height} ${p95} ${x(series.at(-1)!.t).toFixed(1)},${height}` : "";
  return {
    p50: line((p) => p.p50),
    p95,
    area,
    max: top,
    y: (value) => (value > top ? null : y(value)),
    nearest: (fraction) => {
      if (series.length === 0) return null;
      const target = first + Math.min(1, Math.max(0, fraction)) * span;
      let best = 0;
      series.forEach((p, i) => {
        if (Math.abs(p.t - target) < Math.abs(series[best]!.t - target)) best = i;
      });
      return { index: best, point: series[best]! };
    },
  };
}

/** Sparkline points for a list of numbers on a 120x32 box. */
export function sparkline(values: readonly number[], width = 120, height = 32): string {
  if (values.length === 0) return "";
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const spread = hi - lo || 1;
  return values
    .map((v, i) => `${(values.length === 1 ? width / 2 : (i / (values.length - 1)) * width).toFixed(1)},${(height - ((v - lo) / spread) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
}

/** Days where something failed, for the uptime summary. */
export function badDays(days: readonly UptimeDay[]): number {
  return days.filter((d) => d.ratio !== null && d.ratio < 0.999).length;
}

/** "12 s ago", "3 min ago", "2 h ago", "4 d ago", from an ISO time. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (Number.isNaN(seconds)) return "–";
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}
