import { describe, expect, it } from "vitest";
import { ago, badDays, buildChart, dayTone, formatPercent, formatUptime, niceMax, resourceTone, sparkline } from "./format";

describe("health formatting", () => {
  it("writes uptime with its two biggest units", () => {
    expect(formatUptime(2591204)).toBe("29d 23h");
    expect(formatUptime(3 * 3600 + 120)).toBe("3h 2m");
    expect(formatUptime(45)).toBe("0m");
    expect(formatUptime(-5)).toBe("0m");
  });

  it("is white under 80%, warn from 80, danger from 90", () => {
    expect([0, 79.9, 80, 89.9, 90, 100].map(resourceTone)).toEqual(["ok", "ok", "warn", "warn", "danger", "danger"]);
  });

  it("tones a day by how much of it was fine, and leaves an unwatched day alone", () => {
    expect([1, 0.999, 0.99, 0.95, 0.5].map(dayTone)).toEqual(["ok", "ok", "warn", "warn", "danger"]);
    expect(dayTone(null)).toBeNull();
    expect(
      badDays([
        { day: "a", checks: 10, ratio: 1 },
        { day: "b", checks: 10, ratio: 0.9 },
        { day: "c", checks: 0, ratio: null },
      ]),
    ).toBe(1);
  });

  it("never rounds a percentage up to 100 while something failed", () => {
    expect(formatPercent(99.9993)).toBe("99.99%");
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(null)).toBe("–");
  });

  it("rounds a chart's top to a clean number", () => {
    expect([0, 3, 7, 88, 130, 250, 640].map(niceMax)).toEqual([10, 5, 10, 100, 200, 500, 1000]);
  });

  it("says how long ago, and Never for nothing", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(ago("2026-10-20T11:59:48Z", now)).toBe("12 s ago");
    expect(ago("2026-10-20T11:57:00Z", now)).toBe("3 min ago");
    expect(ago("2026-10-20T10:00:00Z", now)).toBe("2 h ago");
    expect(ago("2026-10-16T12:00:00Z", now)).toBe("4 d ago");
    expect(ago(null)).toBe("Never");
  });
});

describe("latency chart", () => {
  const series = [
    { t: 1000, count: 10, p50: 10, p95: 40 },
    { t: 1300, count: 10, p50: 12, p95: 90 },
    { t: 1600, count: 10, p50: 11, p95: 60 },
  ];

  it("draws a point per bucket, left to right, higher latency higher up", () => {
    const chart = buildChart(series, 600, 180);
    const points = chart.p95.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
    expect(points).toHaveLength(3);
    expect(points[0]![0]).toBe(0);
    expect(points[2]![0]).toBe(600);
    expect(points[1]![1]).toBeLessThan(points[0]![1]); // 90 ms is above 40 ms
    expect(chart.max).toBe(100);
  });

  it("makes room for the SLO line and says where it is", () => {
    const chart = buildChart(series, 600, 180, 250);
    expect(chart.max).toBe(500);
    expect(chart.y(250)).toBe(90);
    expect(chart.y(900)).toBeNull();
  });

  it("finds the point nearest the cursor", () => {
    const chart = buildChart(series, 600, 180);
    expect(chart.nearest(0)?.index).toBe(0);
    expect(chart.nearest(0.48)?.index).toBe(1);
    expect(chart.nearest(1)?.point.p95).toBe(60);
    expect(buildChart([], 600, 180).nearest(0.5)).toBeNull();
  });

  it("copes with no data and with a single point", () => {
    expect(buildChart([], 600, 180).p95).toBe("");
    expect(buildChart([series[0]!], 600, 180).p95.split(",")[0]).toBe("300.0");
  });

  it("draws a sparkline inside its box", () => {
    const points = sparkline([1, 5, 3], 120, 32)
      .split(" ")
      .map((p) => p.split(",").map(Number) as [number, number]);
    expect(points).toHaveLength(3);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(120);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(32);
    }
    expect(sparkline([])).toBe("");
  });
});
