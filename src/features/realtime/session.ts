import type { Message } from "../messages/types";
import { RealtimeClient, type ConnectionStatus } from "./client";
import { CommandClient, CommandError } from "./commands";
import { toRealtimeEvent, type RealtimeEvent } from "./events";
import { messageCommands, resyncChannel, subscribeChannel, type MessageCommands } from "./messageCommands";
import type { ServerFrame } from "./protocol";
import { EventTracker } from "./tracker";

export interface SessionOptions {
  /** Same contract as `RealtimeClient`: the URL must already carry `protocol=1`. */
  buildUrl: () => string | null;
  refreshCredentials?: () => Promise<unknown>;
  onStatus: (status: ConnectionStatus) => void;
  onEvent: (event: RealtimeEvent) => void;
  /** The server's current view of a channel's recent messages, after a gap or a reconnect. */
  onResync: (channelId: string, messages: Message[]) => void;
  /** Channels whose messages are cached and so need catching up after an interruption. */
  openChannelIds: () => string[];
  /** After a reconnect: refetch everything that is not a message (unread counts, lists...). */
  onReconnect: () => void;
  commandTimeoutMs?: number;
}

/**
 * One protocol connection: transport, commands, event de-duplication and gap recovery.
 *
 * Events are pushed for every channel the server auto-subscribed at connect time; channels
 * created afterwards need an explicit `channel.subscribe`, which {@link syncChannels} sends.
 */
export class RealtimeSession {
  readonly commands: MessageCommands;

  private readonly transport: RealtimeClient;
  private readonly commandClient: CommandClient;
  private readonly tracker = new EventTracker();

  private connected = false;
  private helloSeen = false;
  private subscribed: Set<string> | null = null;
  private readonly queued = new Set<string>();
  private draining = false;

  constructor(private readonly options: SessionOptions) {
    this.transport = new RealtimeClient({
      buildUrl: options.buildUrl,
      refreshCredentials: options.refreshCredentials,
      onStatus: (status) => {
        this.connected = status === "connected";
        options.onStatus(status);
      },
      onFrame: (frame) => this.handleFrame(frame),
      onReconnect: () => undefined, // handled on `hello`, once the server has shown its epoch
      onClose: () => {
        this.commandClient.rejectAll();
        this.subscribed = null;
        this.queued.clear();
        this.tracker.resetConnection();
      },
    });
    this.commandClient = new CommandClient(this.transport, options.commandTimeoutMs);
    this.commands = messageCommands(this.commandClient);
  }

  start(): void {
    this.transport.start();
  }

  stop(): void {
    this.transport.stop();
    this.commandClient.rejectAll();
  }

  /**
   * Tell the server about channels it did not subscribe us to at connect time. The first list
   * seen on a connection is taken as what the server already covered.
   */
  syncChannels(channelIds: string[]): void {
    if (!this.connected) return;
    if (this.subscribed === null) {
      this.subscribed = new Set(channelIds);
      return;
    }
    for (const id of channelIds) {
      if (this.subscribed.has(id)) continue;
      this.subscribed.add(id);
      void subscribeChannel(this.commandClient, id)
        .then((result) => this.tracker.setBaseline(id, result.seq, result.epoch))
        .catch(() => this.subscribed?.delete(id)); // not allowed or dropped: try again on the next sync
    }
  }

  /** Ask the server for a channel's recent messages and hand them to `onResync`. */
  resync(channelId: string): void {
    this.queued.add(channelId);
    void this.drain();
  }

  // Resyncs run one at a time so a reconnect with many open channels cannot trip the rate limit.
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      for (let id = this.next(); id !== undefined; id = this.next()) {
        try {
          const result = await resyncChannel(this.commandClient, id);
          this.tracker.setBaseline(id, result.seq, result.epoch);
          this.options.onResync(id, result.messages);
        } catch (error) {
          const code = error instanceof CommandError ? error.code : null;
          // The socket is gone: the rest of the queue is cleared on close and redone on reconnect.
          if (code === null || code === "DISCONNECTED" || code === "NOT_CONNECTED") break;
          console.warn(`[realtime] resync of ${id} failed: ${code}`);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private next(): string | undefined {
    const id = this.queued.values().next().value;
    if (id !== undefined) this.queued.delete(id);
    return id;
  }

  private resyncOpenChannels(): void {
    for (const id of this.options.openChannelIds()) this.queued.add(id);
    void this.drain();
  }

  private handleFrame(frame: ServerFrame): void {
    switch (frame.type) {
      case "hello": {
        const epochChanged = this.tracker.observeEpoch(frame.epoch);
        if (this.helloSeen || epochChanged) {
          // Whatever happened while the socket was down is gone: refetch the rest and resync messages.
          this.options.onReconnect();
          this.resyncOpenChannels();
        }
        this.helloSeen = true;
        return;
      }

      case "ack":
      case "error":
        this.commandClient.handleFrame(frame);
        return;

      case "event": {
        const verdict = this.tracker.accept(frame);
        if (verdict.apply) {
          const event = toRealtimeEvent(frame);
          if (event) {
            if (event.kind === "channel" && event.change !== "updated") {
              this.tracker.forget(event.channelId);
              this.subscribed?.delete(event.channelId);
            }
            this.options.onEvent(event);
          }
        }
        if (verdict.resync && frame.channelId) this.resync(frame.channelId);
        return;
      }

      case "pong":
        return;
    }
  }
}
