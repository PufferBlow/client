import { createLogger } from "../../lib/logger";
import { parseServerFrame, type ServerFrame } from "./protocol";

const log = createLogger("ws");

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface RealtimeOptions {
  /** Called for every connection attempt, so a refreshed token is always used. `null` means "signed out". */
  buildUrl: () => string | null;
  /** Every decoded server frame except pongs (hello, ack, error, event). */
  onFrame: (frame: ServerFrame) => void;
  onStatus: (status: ConnectionStatus) => void;
  /** Fired when the socket re-opens after a drop, so callers can catch up on missed events. */
  onReconnect: () => void;
  /** Fired each time the socket closes (not on `stop()`), so callers can fail in-flight commands. */
  onClose?: () => void;
  /** Gives the caller a chance to renew credentials before a retry (it runs from the 3rd attempt). */
  refreshCredentials?: () => Promise<unknown>;
}

/** Offered next to `bearer.<token>` so the token travels in a header, not the URL (browsers cannot set headers on a WebSocket). */
export const WS_SUBPROTOCOL = "pufferblow.v1";
const SUBPROTOCOL_TOKEN = /^[A-Za-z0-9._~-]+$/;

/** Moves `auth_token` out of a socket URL into the subprotocols the server reads it from. */
export function splitCredential(url: string): { url: string; protocols: string[] } {
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("auth_token");
    // A token with characters a subprotocol cannot carry stays in the URL rather than failing to connect.
    if (!token || !SUBPROTOCOL_TOKEN.test(token)) return { url, protocols: [] };
    parsed.searchParams.delete("auth_token");
    return { url: parsed.toString(), protocols: [WS_SUBPROTOCOL, `bearer.${token}`] };
  } catch {
    return { url, protocols: [] };
  }
}

const PING_INTERVAL_MS = 30_000;
// The server answers a ping as soon as it reads it; allow for a slow network, not a slow server.
const PONG_TIMEOUT_MS = 10_000;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

/**
 * Connection to the instance's global `/ws` socket. The caller's URL opts into protocol v1
 * (`?protocol=1`). The token travels in a `bearer.<token>` subprotocol, never the URL, heartbeats use
 * `{type: "ping"}`, and reconnects back off without a retry cap.
 */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private hasConnected = false;
  private stopped = true;

  constructor(private readonly options: RealtimeOptions) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    log.info("starting the realtime connection");
    window.addEventListener("online", this.handleOnline);
    void this.open();
  }

  stop(): void {
    log.info("stopping the realtime connection");
    this.stopped = true;
    window.removeEventListener("online", this.handleOnline);
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "client closing");
    this.options.onStatus("disconnected");
  }

  /** Send a text frame. Returns false when the socket is not open. */
  send(text: string): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      log.debug("not sending, the socket is not open");
      return false;
    }
    log.debug(`→ frame (${text.length} chars)`);
    socket.send(text);
    return true;
  }

  private handleOnline = () => {
    if (this.stopped || this.socket?.readyState === WebSocket.OPEN) return;
    log.info("network is back, reconnecting now");
    this.attempt = 0;
    this.clearTimers();
    void this.open();
  };

  private async open(): Promise<void> {
    if (this.attempt >= 2 && this.options.refreshCredentials) {
      log.debug(`attempt ${this.attempt + 1}: renewing credentials first`);
      await this.options.refreshCredentials().catch(() => undefined);
      if (this.stopped) return;
    }

    let url = this.options.buildUrl();
    if (!url && this.options.refreshCredentials) {
      // An expired access token reads as signed out; one refresh may bring it back.
      await this.options.refreshCredentials().catch(() => undefined);
      if (this.stopped) return;
      url = this.options.buildUrl();
    }
    if (!url) {
      log.warn("not connecting: signed out");
      this.options.onStatus("disconnected");
      return;
    }

    this.options.onStatus("connecting");
    const target = splitCredential(url);
    log.info(`connecting (attempt ${this.attempt + 1})`, { url: target.url });
    const socket = target.protocols.length > 0 ? new WebSocket(target.url, target.protocols) : new WebSocket(target.url);
    this.socket = socket;

    socket.onopen = () => {
      log.info(this.hasConnected ? "reconnected" : "connected");
      this.attempt = 0;
      this.options.onStatus("connected");
      if (this.hasConnected) this.options.onReconnect();
      this.hasConnected = true;
      this.startHeartbeat();
    };

    socket.onmessage = (message: MessageEvent) => {
      this.clearPongTimer(); // any traffic proves the link is alive
      const frame = parseServerFrame(message.data);
      if (!frame) log.warn("dropped an undecodable frame");
      else if (frame.type !== "pong") {
        log.debug(`← ${frame.type}`);
        this.options.onFrame(frame);
      }
    };

    socket.onclose = (event?: CloseEvent) => {
      if (this.socket !== socket) return; // superseded or stopped
      log.warn(`connection closed (code ${event?.code ?? "unknown"}${event?.reason ? `, ${event.reason}` : ""})`);
      this.socket = null;
      this.clearTimers();
      this.options.onStatus("disconnected");
      this.options.onClose?.();
      this.scheduleReconnect();
    };

    // `onclose` always follows `onerror`; reconnect logic lives there.
    socket.onerror = () => log.debug("socket error");
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      socket.send(JSON.stringify({ type: "ping" }));
      // Only the first unanswered ping starts the clock; traffic of any kind stops it.
      this.pongTimer ??= setTimeout(() => {
        this.pongTimer = null;
        if (this.socket !== socket) return;
        log.warn(`no answer to a ping for ${PONG_TIMEOUT_MS}ms, dropping the link`);
        socket.close(); // dead link: let onclose reconnect
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }

  private clearPongTimer(): void {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** this.attempt) * (0.75 + Math.random() * 0.5);
    this.attempt += 1;
    log.info(`reconnecting in ${Math.round(delay / 100) / 10}s`);
    this.retryTimer = setTimeout(() => void this.open(), delay);
  }

  private clearTimers(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.heartbeat = null;
    this.retryTimer = null;
    this.clearPongTimer();
  }
}
