import { vi } from "vitest";

/** A minimal `Response` for stubbing `fetch`. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Replace the global `fetch` with a mock and return it. */
export function mockFetch(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  for (const response of responses) fn.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** The URL (as a URL object) of the nth call to a `fetch` mock. */
export function calledUrl(fn: ReturnType<typeof mockFetch>, call = 0): URL {
  return new URL(String(fn.mock.calls[call]![0]));
}

/** Pretend the user is signed in to a local instance. */
export function signIn(token = "test-token", origin = "http://localhost:7575") {
  const url = new URL(origin);
  localStorage.setItem(
    "pb_instance",
    JSON.stringify({ raw: url.host, host: url.hostname, port: Number(url.port || 80), protocol: "http", origin }),
  );
  document.cookie = `auth_token=${token}; Path=/`;
}

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

/**
 * Route `fetch` by `"METHOD /path"`. Unmatched requests fail the test loudly, so a screen
 * can't silently depend on an endpoint the test didn't expect.
 */
export function routeFetch(routes: Record<string, Handler | Response | unknown>) {
  const fn = vi.fn<typeof fetch>(async (input, init = {}) => {
    const url = new URL(String(input));
    const key = `${(init.method ?? "GET").toUpperCase()} ${url.pathname}`;
    const handler = routes[key];
    if (handler === undefined) throw new Error(`Unexpected request: ${key}`);
    if (typeof handler === "function") return (handler as Handler)(url, init);
    return handler instanceof Response ? handler : jsonResponse(handler);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Requests the router saw, as `"METHOD /path"`. */
export function requestLog(fn: ReturnType<typeof routeFetch>): string[] {
  return fn.mock.calls.map(([input, init]) => `${(init?.method ?? "GET").toUpperCase()} ${new URL(String(input)).pathname}`);
}
