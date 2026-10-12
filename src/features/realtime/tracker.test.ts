import { describe, expect, it } from "vitest";
import type { EventFrame } from "./protocol";
import { EventTracker } from "./tracker";

let counter = 0;
const frame = (overrides: Partial<EventFrame> = {}): EventFrame => ({
  type: "event",
  id: `evt_${++counter}`,
  name: "message.created",
  channelId: "c1",
  seq: 1,
  epoch: "ep_1",
  data: {},
  ...overrides,
});

describe("EventTracker", () => {
  it("applies an event once and skips a repeat of the same event id", () => {
    const tracker = new EventTracker();
    const first = frame({ id: "evt_same" });
    expect(tracker.accept(first)).toEqual({ apply: true, resync: false });
    expect(tracker.accept(first)).toEqual({ apply: false, resync: false });
  });

  it("follows consecutive sequence numbers without asking for a resync", () => {
    const tracker = new EventTracker();
    tracker.observeEpoch("ep_1");
    expect(tracker.accept(frame({ seq: 10 })).resync).toBe(false); // first event sets the baseline
    expect(tracker.accept(frame({ seq: 11 })).resync).toBe(false);
    expect(tracker.accept(frame({ seq: 12 })).resync).toBe(false);
  });

  it("applies the event that revealed a gap and asks for a resync", () => {
    const tracker = new EventTracker();
    tracker.observeEpoch("ep_1");
    tracker.accept(frame({ seq: 10 }));
    expect(tracker.accept(frame({ seq: 13 }))).toEqual({ apply: true, resync: true });
    expect(tracker.accept(frame({ seq: 14 })).resync).toBe(false); // caught up to the new position
  });

  it("tracks each channel on its own", () => {
    const tracker = new EventTracker();
    tracker.observeEpoch("ep_1");
    tracker.accept(frame({ channelId: "a", seq: 5 }));
    tracker.accept(frame({ channelId: "b", seq: 90 }));
    expect(tracker.accept(frame({ channelId: "a", seq: 6 })).resync).toBe(false);
    expect(tracker.accept(frame({ channelId: "b", seq: 91 })).resync).toBe(false);
  });

  it("does not resync for an out-of-order or repeated sequence number", () => {
    const tracker = new EventTracker();
    tracker.observeEpoch("ep_1");
    tracker.accept(frame({ seq: 10 }));
    tracker.accept(frame({ seq: 11 }));
    expect(tracker.accept(frame({ seq: 10 }))).toEqual({ apply: true, resync: false });
  });

  it("asks for a resync when an event carries a new epoch", () => {
    const tracker = new EventTracker();
    tracker.observeEpoch("ep_1");
    tracker.accept(frame({ seq: 10 }));
    expect(tracker.accept(frame({ seq: 1, epoch: "ep_2" }))).toEqual({ apply: true, resync: true });
    expect(tracker.accept(frame({ seq: 2, epoch: "ep_2" })).resync).toBe(false);
  });

  it("reports a changed epoch from hello, and not the first one", () => {
    const tracker = new EventTracker();
    expect(tracker.observeEpoch("ep_1")).toBe(false);
    expect(tracker.observeEpoch("ep_1")).toBe(false);
    expect(tracker.observeEpoch("ep_2")).toBe(true);
  });

  it("uses a resync's position as the new baseline", () => {
    const tracker = new EventTracker();
    tracker.observeEpoch("ep_1");
    tracker.accept(frame({ seq: 10 }));
    tracker.setBaseline("c1", 20, "ep_1");
    expect(tracker.accept(frame({ seq: 21 })).resync).toBe(false);
    expect(tracker.accept(frame({ seq: 25 })).resync).toBe(true);
  });

  it("forgets a channel and a connection's positions", () => {
    const tracker = new EventTracker();
    tracker.observeEpoch("ep_1");
    tracker.accept(frame({ seq: 10 }));
    tracker.forget("c1");
    expect(tracker.accept(frame({ seq: 50 })).resync).toBe(false);
    tracker.resetConnection();
    expect(tracker.accept(frame({ seq: 90 })).resync).toBe(false);
  });

  it("passes through events that have no channel or sequence (presence)", () => {
    const tracker = new EventTracker();
    expect(tracker.accept(frame({ channelId: null, seq: null }))).toEqual({ apply: true, resync: false });
  });

  it("remembers recent event ids only up to a limit", () => {
    const tracker = new EventTracker();
    const first = frame({ id: "evt_first", channelId: null, seq: null });
    tracker.accept(first);
    for (let i = 0; i < 1100; i++) tracker.accept(frame({ channelId: null, seq: null }));
    expect(tracker.accept(first).apply).toBe(true); // evicted, so treated as new
  });
});
