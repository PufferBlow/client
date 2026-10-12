import { describe, expect, it, vi } from "vitest";
import { calledUrl, jsonResponse, mockFetch } from "../test/helpers";
import { api, ApiError } from "./api";

describe("api requests", () => {
  it("appends query params and skips undefined or null values", async () => {
    const fetchMock = mockFetch(jsonResponse({ ok: true }));
    await api.get("http://x.test/path?fixed=1", { query: { a: "1", b: 2, c: true, d: undefined, e: null } });

    const url = calledUrl(fetchMock);
    expect(url.searchParams.get("fixed")).toBe("1");
    expect(url.searchParams.get("a")).toBe("1");
    expect(url.searchParams.get("b")).toBe("2");
    expect(url.searchParams.get("c")).toBe("true");
    expect(url.searchParams.has("d")).toBe(false);
    expect(url.searchParams.has("e")).toBe(false);
  });

  it("sends JSON bodies with a content type", async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    await api.post("http://x.test/p", { json: { name: "x" } });

    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "x" }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("sends multipart bodies untouched so the browser sets the boundary", async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    const form = new FormData();
    form.set("message", "hi");
    await api.post("http://x.test/p", { form });

    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("never sends an Authorization header", async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    await api.get("http://x.test/p");
    expect((fetchMock.mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("resolves with the flat response body", async () => {
    mockFetch(jsonResponse({ status_code: 200, channels: [1, 2] }));
    await expect(api.get("http://x.test/p")).resolves.toEqual({ status_code: 200, channels: [1, 2] });
  });
});

describe("api errors", () => {
  it("maps the typed error envelope", async () => {
    mockFetch(
      jsonResponse(
        {
          error_code: "auth.username_taken",
          user_message: "That name is taken.",
          message: "internal message",
          details: { field: "new_username" },
          retry_after_seconds: 7,
        },
        409,
      ),
    );

    const error = await api.get("http://x.test/p").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "auth.username_taken",
      message: "That name is taken.",
      details: { field: "new_username" },
      retryAfterSeconds: 7,
    });
  });

  it("falls back to legacy {detail} errors", async () => {
    mockFetch(jsonResponse({ detail: "Nope" }, 403));
    await expect(api.get("http://x.test/p")).rejects.toMatchObject({ status: 403, message: "Nope", code: "unknown" });
  });

  it("derives a rate-limit code from a bare 429", async () => {
    mockFetch(jsonResponse(null, 429));
    await expect(api.get("http://x.test/p")).rejects.toMatchObject({ status: 429, code: "rate_limit.exceeded" });
  });

  it("handles a non-JSON error body", async () => {
    mockFetch(new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(api.get("http://x.test/p")).rejects.toMatchObject({ status: 502, message: "Request failed with status 502" });
  });

  it("reports network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.get("http://x.test/p")).rejects.toMatchObject({ status: 0, code: "network", message: "Failed to fetch" });
  });

  it("reports timeouts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })),
    );
    await expect(api.get("http://x.test/p", { timeout: 10 })).rejects.toMatchObject({ status: 0, code: "timeout" });
  });

  it("reports caller cancellation separately from a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })),
    );
    const controller = new AbortController();
    const pending = api.get("http://x.test/p", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
  });
});
