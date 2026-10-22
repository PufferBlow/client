import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { jsonResponse, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import type { InstanceHealth } from "../../features/health/types";
import { ControlPanelPage } from "./ControlPanelPage";

beforeEach(() => signIn("tok"));

const owner = {
  user_id: "me",
  username: "ada",
  about: null,
  status: "online",
  accent_color: null,
  avatar_url: null,
  origin_server: "localhost:7575",
  roles_ids: ["owner"],
};

const days = Array.from({ length: 90 }, (_, i) => ({ day: `2026-07-${String((i % 28) + 1).padStart(2, "0")}-${i}`, checks: i > 80 ? 1440 : 0, ratio: i > 80 ? (i === 85 ? 0.9 : 1) : null }));

const health = (over: Partial<InstanceHealth> = {}): InstanceHealth => ({
  status: "ok",
  version: "0.9.2",
  instance: "switchyard.works",
  uptime_s: 2591204,
  checks: {
    database: { status: "ok", ms: 4.1, note: "Answering queries" },
    storage: { status: "ok", ms: 0, note: "Writable" },
    realtime: { status: "ok", ms: 0, note: "3 connected" },
  },
  latency: {
    p50: 12,
    p95: 88,
    samples: 4021,
    window_seconds: 3600,
    series: [
      { t: 1_792_000_000, count: 310, p50: 11, p95: 90 },
      { t: 1_792_000_300, count: 280, p50: 12, p95: 80 },
      { t: 1_792_000_600, count: 300, p50: 13, p95: 95 },
    ],
  },
  resources: { cpu: 23.5, memory: 84.2, disk: 91 },
  uptime_days: days,
  uptime_percent: 99.98,
  incidents: [],
  peers: [
    { host: "mesh.garden", follows: 2, last_activity: new Date(Date.now() - 180_000).toISOString() },
    { host: "kiln.social", follows: 5, last_activity: null },
  ],
  ...over,
});

const backend = (value: InstanceHealth | Response = health()) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: owner },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "Switchyard", version: "0.9.2", avatar_url: null, banner_url: null } },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "POST /api/v1/channels/list/": { channels: [] },
    "GET /api/v1/users/list": { users: [owner] },
    "GET /api/v1/system/health": value instanceof Response ? value : { health: value },
  });

const renderPanel = (section: string) => renderWithProviders(<ControlPanelPage />, { route: `/control-panel/${section}`, path: "/control-panel/:section?" });

describe("the Health page", () => {
  it("shows the instance, its version and uptime, and that it is operational", async () => {
    backend();
    renderPanel("health");

    expect(await screen.findByRole("heading", { name: "switchyard.works" })).toBeInTheDocument();
    expect(screen.getByText(/Pufferblow 0\.9\.2 · up 29d 23h/)).toBeInTheDocument();
    expect(screen.getByText("Operational")).toBeInTheDocument();
  });

  it("says Degraded when the instance says it is", async () => {
    backend(health({ status: "degraded" }));
    renderPanel("health");
    expect(await screen.findByText("Degraded")).toBeInTheDocument();
  });

  it("shows the headline figures", async () => {
    backend();
    renderPanel("health");
    await screen.findByText("Operational");

    expect(screen.getByText("99.98")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument(); // p95
    expect(screen.getByText(/p50 12 ms · SLO 250 ms/)).toBeInTheDocument();
    expect(screen.getByText("4,021")).toBeInTheDocument();
    expect(screen.getByText("1 days with trouble")).toBeInTheDocument();
  });

  it("draws the 90 days and describes them for a screen reader", async () => {
    backend();
    renderPanel("health");
    const bar = await screen.findByRole("img", { name: /Uptime over 90 days: 99.98%, 1 days with trouble/ });
    expect(bar.querySelectorAll("span[title]")).toHaveLength(90);
    expect(bar.querySelector('span[title*="not watched"]')).not.toBeNull();
  });

  it("charts latency and shows the values under the cursor", async () => {
    backend();
    renderPanel("health");
    const chart = await screen.findByRole("img", { name: "Request latency over the last day" });
    expect(chart.querySelectorAll("polyline")).toHaveLength(2);

    const area = chart.closest("div.relative")!;
    area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 634, height: 200, right: 634, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.mouseMove(area, { clientX: 634 });
    expect(await screen.findByText(/p95 95 ms · p50 13 ms · 300 requests/)).toBeInTheDocument();
    fireEvent.mouseLeave(area);
    await waitFor(() => expect(screen.queryByText(/p95 95 ms/)).not.toBeInTheDocument());
  });

  it("explains an empty chart instead of drawing nothing", async () => {
    backend(health({ latency: { p50: 0, p95: 0, samples: 0, window_seconds: 3600, series: [] } }));
    renderPanel("health");
    expect(await screen.findByText(/No requests recorded yet/)).toBeInTheDocument();
  });

  it("lists the checks, and can show them as JSON", async () => {
    backend(health({ checks: { database: { status: "down", ms: 0, note: "connection refused" }, storage: { status: "ok", ms: 0, note: "Writable" } } }));
    const { user } = renderPanel("health");

    expect(await screen.findByText("connection refused")).toBeInTheDocument();
    expect(screen.getByText("Down")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByText(/"status": "down"/)).toBeInTheDocument();
  });

  it("shows resources as gauges, and says so when the instance cannot read them", async () => {
    backend();
    const first = renderPanel("health");
    expect(await screen.findByRole("img", { name: "Disk 91%" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "CPU 23.5%" })).toBeInTheDocument();
    first.unmount();

    backend(health({ resources: null }));
    renderPanel("health");
    expect(await screen.findByText(/can't read its own resource use/)).toBeInTheDocument();
  });

  it("lists peers with how recently they were active", async () => {
    backend();
    renderPanel("health");
    expect(await screen.findByText("@mesh.garden")).toBeInTheDocument();
    expect(screen.getByText(/2 follows · active 3 min ago/)).toBeInTheDocument();
    expect(screen.getByText(/5 follows · active Never/)).toBeInTheDocument();
  });

  it("tells the story of an incident, open or resolved", async () => {
    backend(
      health({
        incidents: [
          { incident_id: "i1", title: "Trouble with database", state: "investigating", body: "Found by the instance's own check", started_at: new Date(Date.now() - 60_000).toISOString(), ended_at: null },
          { incident_id: "i2", title: "Trouble with voice", state: "resolved", body: "", started_at: new Date(Date.now() - 7_200_000).toISOString(), ended_at: new Date(Date.now() - 3_600_000).toISOString() },
        ],
      }),
    );
    renderPanel("health");
    expect(await screen.findByText("Trouble with database")).toBeInTheDocument();
    expect(screen.getByText("Investigating")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText(/resolved 1 h ago/)).toBeInTheDocument();
  });

  it("says plainly when nothing has gone wrong", async () => {
    backend();
    renderPanel("health");
    expect(await screen.findByText("Nothing has gone wrong")).toBeInTheDocument();
  });

  it("shows an error with retry when the health cannot be read", async () => {
    backend(jsonResponse({ error_code: "auth.privilege_denied", message: "no", user_message: "Only admins can do that." }, 403));
    renderPanel("health");
    expect(await screen.findByText("Couldn't load the instance's health")).toBeInTheDocument();
    expect(screen.getByText("Only admins can do that.")).toBeInTheDocument();
  });
});
