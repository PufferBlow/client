export interface ResolvedInstance {
  raw: string;
  origin: string;
  apiBaseUrl: string;
  wsBaseUrl: string;
  host: string;
  port: string;
  secure: boolean;
}

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

const trimInstanceInput = (input: string): string => input.trim().replace(/\/+$/, "");

const extractAuthority = (input: string): string => {
  const withoutScheme = input.replace(/^(?:https?|wss?):\/\//i, "");
  return withoutScheme.split("/")[0] || withoutScheme;
};

const extractHostname = (input: string): string => {
  const authority = extractAuthority(input);
  if (authority.startsWith("[")) {
    const endIndex = authority.indexOf("]");
    return endIndex >= 0 ? authority.slice(1, endIndex) : authority;
  }

  const [host] = authority.split(":");
  return host;
};

const isPrivateIpv4 = (host: string): boolean => {
  if (!IPV4_PATTERN.test(host)) {
    return false;
  }

  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
};

const inferHttpScheme = (input: string): "http" | "https" => {
  const host = extractHostname(input).toLowerCase();
  if (LOCAL_HOSTS.has(host) || isPrivateIpv4(host)) {
    return "http";
  }

  if (host.endsWith(".local") || host.endsWith(".internal")) {
    return "http";
  }

  if (IPV4_PATTERN.test(host)) {
    return "http";
  }

  return "https";
};

export const resolveInstance = (input: string): ResolvedInstance => {
  const trimmed = trimInstanceInput(input);
  if (!trimmed) {
    throw new Error("Missing instance address");
  }

  let candidate = trimmed;
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    candidate = trimmed.replace(/^ws/i, "http");
  } else if (!/^https?:\/\//i.test(trimmed)) {
    candidate = `${inferHttpScheme(trimmed)}://${trimmed}`;
  }

  const parsed = new URL(candidate);
  const secure = parsed.protocol === "https:";
  const wsProtocol = secure ? "wss:" : "ws:";

  return {
    raw: trimmed,
    origin: parsed.origin,
    apiBaseUrl: parsed.origin,
    wsBaseUrl: `${wsProtocol}//${parsed.host}`,
    host: parsed.hostname,
    port: parsed.port || (secure ? "443" : "80"),
    secure,
  };
};

export const normalizeInstance = (input: string): string => {
  return resolveInstance(input).origin;
};

export const resolveStoredInstance = (
  input: string | null | undefined,
): ResolvedInstance | null => {
  if (!input) {
    return null;
  }

  try {
    return resolveInstance(input);
  } catch {
    return null;
  }
};
