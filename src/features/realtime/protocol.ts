/**
 * Wire format of the Pufferblow command/event protocol, version 1.
 *
 * The server's `docs/protocol/v1/fixtures/*.json` are the contract; `__fixtures__/` holds an
 * identical copy and `protocol.test.ts` parses every one of them. Unknown frames resolve to
 * `null` so a newer server can add things without breaking this client.
 */

export const PROTOCOL_VERSION = 1;

export type ErrorCode =
  | "MALFORMED"
  | "UNSUPPORTED_VERSION"
  | "UNKNOWN_COMMAND"
  | "UNAUTHENTICATED"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "VALIDATION_FAILED"
  | "INTERNAL"
  // Raised by this client, never sent by the server.
  | "NOT_CONNECTED"
  | "DISCONNECTED"
  | "TIMEOUT";

export interface HelloFrame {
  type: "hello";
  supported: number[];
  sessionId: string;
  epoch: string;
}

export interface AckFrame {
  type: "ack";
  id: string;
  result: Record<string, unknown>;
  /** True when the server recognised the command's nonce and returned the stored result. */
  duplicate: boolean;
}

export interface ErrorFrame {
  type: "error";
  /** `null` when the server could not tell which command the frame was for. */
  id: string | null;
  code: string;
  message: string;
  retryable: boolean;
  retryAfter: number | null;
}

export interface EventFrame {
  type: "event";
  id: string;
  name: string;
  channelId: string | null;
  seq: number | null;
  epoch: string | null;
  data: Record<string, unknown>;
}

export interface PongFrame {
  type: "pong";
}

export type ServerFrame = HelloFrame | AckFrame | ErrorFrame | EventFrame | PongFrame;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Parse one inbound text frame. Anything that is not a well-formed v1 frame is `null`. */
export function parseServerFrame(data: unknown): ServerFrame | null {
  if (typeof data !== "string") return null;

  let frame: unknown;
  try {
    frame = JSON.parse(data);
  } catch {
    return null;
  }
  return parseFrameObject(frame);
}

export function parseFrameObject(frame: unknown): ServerFrame | null {
  if (!isRecord(frame)) return null;

  if (frame.type === "pong") return { type: "pong" };
  if (frame.version !== PROTOCOL_VERSION) return null;

  switch (frame.type) {
    case "hello": {
      const sessionId = str(frame.session_id);
      const epoch = str(frame.epoch);
      if (sessionId === null || epoch === null) return null;
      const supported = Array.isArray(frame.supported) ? frame.supported.filter((n): n is number => typeof n === "number") : [];
      return { type: "hello", supported, sessionId, epoch };
    }

    case "ack": {
      const id = str(frame.id);
      if (id === null || !isRecord(frame.data)) return null;
      const result = isRecord(frame.data.result) ? frame.data.result : {};
      return { type: "ack", id, result, duplicate: frame.data.duplicate === true };
    }

    case "error": {
      if (!isRecord(frame.error)) return null;
      return {
        type: "error",
        id: str(frame.id),
        code: str(frame.error.code) ?? "INTERNAL",
        message: str(frame.error.message) ?? "Unknown error",
        retryable: frame.error.retryable === true,
        retryAfter: num(frame.error.retry_after),
      };
    }

    case "event": {
      const id = str(frame.id);
      const name = str(frame.name);
      if (id === null || name === null || !isRecord(frame.data)) return null;
      return {
        type: "event",
        id,
        name,
        channelId: str(frame.channel_id),
        seq: num(frame.seq),
        epoch: str(frame.epoch),
        data: frame.data,
      };
    }

    default:
      return null;
  }
}

export interface CommandFrame {
  type: "command";
  version: typeof PROTOCOL_VERSION;
  id: string;
  name: string;
  data: Record<string, unknown>;
}

export const buildCommand = (id: string, name: string, data: Record<string, unknown>): CommandFrame => ({
  type: "command",
  version: PROTOCOL_VERSION,
  id,
  name,
  data,
});
