import { buildCommand, type AckFrame, type ErrorCode, type ErrorFrame, type ServerFrame } from "./protocol";

/** A command the server refused, or that never got an answer. */
export class CommandError extends Error {
  constructor(
    readonly code: ErrorCode | (string & {}),
    message: string,
    /** Safe to send again as-is (the same `nonce` makes a repeated `message.create` harmless). */
    readonly retryable: boolean,
    /** Seconds to wait first, when the server said so. */
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "CommandError";
  }
}

export interface CommandTransport {
  /** Returns false when the socket is not open. */
  send(text: string): boolean;
}

export interface SendOptions {
  timeoutMs?: number;
}

interface Pending {
  resolve: (ack: AckFrame) => void;
  reject: (error: CommandError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Sends commands over the shared socket and matches each ack or error back to its caller by
 * id. Commands are never queued: if the socket is down the promise rejects at once, so the UI
 * can show a retry instead of silently sending later.
 */
export class CommandClient {
  private readonly pending = new Map<string, Pending>();
  private counter = 0;

  constructor(
    private readonly transport: CommandTransport,
    private readonly defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  /** Resolves with the ack, including whether the server treated it as a duplicate. */
  request(name: string, data: Record<string, unknown>, options: SendOptions = {}): Promise<AckFrame> {
    const id = this.nextId();
    return new Promise<AckFrame>((resolve, reject) => {
      if (!this.transport.send(JSON.stringify(buildCommand(id, name, data)))) {
        reject(new CommandError("NOT_CONNECTED", "Not connected to the server.", true));
        return;
      }
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CommandError("TIMEOUT", "The server did not answer in time.", true));
      }, options.timeoutMs ?? this.defaultTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  /** Like {@link request} but resolves with just the result object. */
  async send<T = Record<string, unknown>>(name: string, data: Record<string, unknown>, options?: SendOptions): Promise<T> {
    return (await this.request(name, data, options)).result as T;
  }

  /** Feed every inbound frame here. Returns true when it answered one of our commands. */
  handleFrame(frame: ServerFrame): boolean {
    if (frame.type === "ack") return this.settle(frame.id, (p) => p.resolve(frame));
    if (frame.type === "error" && frame.id !== null) return this.settle(frame.id, (p) => p.reject(toError(frame)));
    return false;
  }

  /** The socket dropped: nothing in flight can be answered any more. */
  rejectAll(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new CommandError("DISCONNECTED", "The connection dropped before the server answered.", true));
      this.pending.delete(id);
    }
  }

  get inFlight(): number {
    return this.pending.size;
  }

  private settle(id: string, finish: (pending: Pending) => void): boolean {
    const pending = this.pending.get(id);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    finish(pending);
    return true;
  }

  private nextId(): string {
    this.counter += 1;
    return `cmd_${this.counter}`;
  }
}

const toError = (frame: ErrorFrame): CommandError => new CommandError(frame.code, frame.message, frame.retryable, frame.retryAfter);
