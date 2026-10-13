import { createLogger } from "../lib/logger";
import type { InstanceConfig } from "./types";

const log = createLogger("instance");

const INSTANCE_KEY = "pb_instance";
const DEFAULT_PORT = "7575";
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export function getStoredInstance(): InstanceConfig | null {
  const raw = localStorage.getItem(INSTANCE_KEY);
  if (!raw) return null;

  try {
    const config = JSON.parse(raw) as InstanceConfig;
    return config.origin ? config : null;
  } catch {
    log.warn("stored instance is corrupt, ignoring it");
    return null;
  }
}

export function setStoredInstance(config: InstanceConfig): void {
  log.info(`using instance ${config.origin}`);
  localStorage.setItem(INSTANCE_KEY, JSON.stringify(config));
}

export function clearStoredInstance(): void {
  log.info("cleared the stored instance");
  localStorage.removeItem(INSTANCE_KEY);
}

function isPrivateIpv4(host: string): boolean {
  if (!IPV4_PATTERN.test(host)) return false;
  const [a = 0, b = 0] = host.split(".").map(Number);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Local, private and `.local`/`.internal` hosts speak plain HTTP; everything else HTTPS. */
function inferScheme(authority: string): "http" | "https" {
  const host = (
    authority.startsWith("[") ? authority.slice(1, authority.indexOf("]")) : (authority.split(":")[0] ?? "")
  ).toLowerCase();
  if (host === "localhost" || host === "::1" || isPrivateIpv4(host) || IPV4_PATTERN.test(host)) return "http";
  if (host.endsWith(".local") || host.endsWith(".internal")) return "http";
  return "https";
}

/**
 * Accepts `host`, `host:port`, `http(s)://host[:port]` and `ws(s)://host[:port]`.
 * A bare plain-HTTP host without a port falls back to the default Pufferblow port.
 * Throws when the input is empty or not a valid address.
 */
export function resolveInstance(input: string): InstanceConfig {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) {
    log.debug("no instance address given");
    throw new Error("Missing instance address");
  }
  // A scheme with nothing after it ("http://" loses its slashes above) is not an address.
  if (/^[a-z][a-z0-9+.-]*:$/i.test(trimmed)) throw new Error("Missing instance address");

  let candidate: string;
  if (/^wss?:\/\//i.test(trimmed)) {
    candidate = trimmed.replace(/^ws/i, "http");
  } else if (/^https?:\/\//i.test(trimmed)) {
    candidate = trimmed;
  } else {
    const authority = trimmed.split("/")[0] ?? trimmed;
    const scheme = inferScheme(authority);
    const needsPort = scheme === "http" && !/:\d+$/.test(authority);
    candidate = `${scheme}://${authority}${needsPort ? `:${DEFAULT_PORT}` : ""}`;
  }

  const parsed = new URL(candidate);
  const secure = parsed.protocol === "https:";
  log.debug(`resolved "${trimmed}" to ${parsed.origin}`);

  return {
    raw: parsed.host,
    host: parsed.hostname,
    port: Number(parsed.port || (secure ? 443 : 80)),
    protocol: secure ? "https" : "http",
    origin: parsed.origin,
  };
}

export function getApiUrl(instance: InstanceConfig): string {
  return instance.origin;
}

export function getWebSocketUrl(instance: InstanceConfig): string {
  return instance.origin.replace(/^http/, "ws");
}
