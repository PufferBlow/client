/** `GET /api/v1/system/health` (admins): everything the status page shows. */
export interface HealthCheck {
  status: "ok" | "down";
  ms: number;
  note: string;
}

export interface LatencyPoint {
  /** Start of the five-minute bucket, in seconds since the epoch. */
  t: number;
  count: number;
  p50: number;
  p95: number;
}

export interface UptimeDay {
  day: string;
  checks: number;
  /** Share of that day's checks that found everything working; null when nobody was watching. */
  ratio: number | null;
}

export interface Incident {
  incident_id: string;
  title: string;
  state: "investigating" | "resolved";
  body: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface PeerHost {
  host: string;
  follows: number;
  last_activity: string | null;
}

export interface InstanceHealth {
  status: "ok" | "degraded";
  version: string;
  instance: string | null;
  uptime_s: number;
  checks: Record<string, HealthCheck>;
  latency: { p50: number; p95: number; samples: number; window_seconds: number; series: LatencyPoint[] };
  resources: { cpu: number; memory: number; disk: number } | null;
  uptime_days: UptimeDay[];
  uptime_percent: number | null;
  incidents: Incident[];
  peers: PeerHost[];
  realtime?: { connections: number };
}

/** `GET /healthz`: the small answer anyone can ask. */
export interface PublicHealth {
  status: "ok" | "degraded";
}
