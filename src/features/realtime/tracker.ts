import type { EventFrame } from "./protocol";

export interface Verdict {
  /** False for an event this client has already handled. */
  apply: boolean;
  /** True when events were missed (a sequence gap or a restarted server) and the channel needs a resync. */
  resync: boolean;
}

const SEEN_LIMIT = 1000;

/**
 * Decides what to do with each event: skip duplicates (by event id) and notice gaps.
 *
 * Delivery is at-least-once and in order per channel within one server epoch. Sequence numbers
 * are per channel; the epoch changes whenever the server restarts and its counters start over,
 * so a new epoch means "anything may have been missed".
 */
export class EventTracker {
  private readonly seen = new Set<string>();
  private readonly seqs = new Map<string, number>();
  private epoch: string | null = null;

  /**
   * Record the epoch from a `hello`. Returns true when it differs from the one before it
   * (the server restarted, so every channel should be resynced).
   */
  observeEpoch(epoch: string): boolean {
    const changed = this.epoch !== null && this.epoch !== epoch;
    if (changed) this.seqs.clear();
    this.epoch = epoch;
    return changed;
  }

  /** Take the position a subscribe or resync ack reports as the new baseline for a channel. */
  setBaseline(channelId: string, seq: number | null, epoch: string | null): void {
    if (epoch !== null && this.epoch !== null && epoch !== this.epoch) {
      this.seqs.clear();
      this.epoch = epoch;
    }
    if (seq !== null) this.seqs.set(channelId, seq);
  }

  forget(channelId: string): void {
    this.seqs.delete(channelId);
  }

  /** Reset between connections: sequence is only meaningful inside one socket's lifetime. */
  resetConnection(): void {
    this.seqs.clear();
  }

  accept(frame: EventFrame): Verdict {
    if (this.seen.has(frame.id)) return { apply: false, resync: false };
    this.seen.add(frame.id);
    if (this.seen.size > SEEN_LIMIT) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }

    const { channelId, seq, epoch } = frame;
    if (channelId === null || seq === null) return { apply: true, resync: false };

    if (epoch !== null && this.epoch !== null && epoch !== this.epoch) {
      // The server restarted under us; take its counters and catch up.
      this.epoch = epoch;
      this.seqs.clear();
      this.seqs.set(channelId, seq);
      return { apply: true, resync: true };
    }

    const last = this.seqs.get(channelId);
    if (last === undefined) {
      this.seqs.set(channelId, seq);
      return { apply: true, resync: false };
    }
    if (seq <= last) return { apply: true, resync: false }; // late or repeated; handlers are idempotent

    this.seqs.set(channelId, seq);
    return { apply: true, resync: seq > last + 1 };
  }
}
