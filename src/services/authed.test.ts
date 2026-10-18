import { describe, expect, it } from "vitest";
import { splitCredential } from "../features/realtime/client";
import { authed } from "./authed";
import { bearerOf, calledUrl, jsonResponse, mockFetch, signIn } from "../test/helpers";

describe("authed.query", () => {
  it("sends the token in an Authorization header and keeps it out of the URL", async () => {
    signIn("tok");
    const fetchMock = mockFetch(jsonResponse({ ok: true }));
    await authed.query("GET", "/api/v1/things", { query: { page: 1 } });

    expect(bearerOf(fetchMock)).toBe("Bearer tok");
    expect(calledUrl(fetchMock).search).toBe("?page=1");
  });

  it("falls back to the URL for an instance that ignores the header, and remembers it", async () => {
    signIn("tok", "http://old.example:7575");
    const missing = { error_code: "validation.field_required", details: { fields: [{ field: "auth_token" }] } };
    const fetchMock = mockFetch(jsonResponse(missing, 400), jsonResponse({ ok: 1 }), jsonResponse({ ok: 2 }));

    await expect(authed.query("GET", "/api/v1/things")).resolves.toEqual({ ok: 1 });
    expect(calledUrl(fetchMock, 1).searchParams.get("auth_token")).toBe("tok");

    await authed.query("GET", "/api/v1/other"); // no second probe
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(bearerOf(fetchMock, 2)).toBeUndefined();
    expect(calledUrl(fetchMock, 2).searchParams.get("auth_token")).toBe("tok");
  });

  it("does not retry other errors", async () => {
    signIn("tok", "http://other.example:7575");
    const fetchMock = mockFetch(jsonResponse({ error_code: "auth.forbidden", message: "no" }, 403));
    await expect(authed.query("GET", "/api/v1/things")).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("splitCredential", () => {
  it("moves the token from the socket URL into subprotocols", () => {
    expect(splitCredential("ws://h:7575/ws?protocol=1&auth_token=abc.def-1")).toEqual({
      url: "ws://h:7575/ws?protocol=1",
      protocols: ["pufferblow.v1", "bearer.abc.def-1"],
    });
  });

  it("leaves a URL without a token, or with one a subprotocol cannot carry, as it is", () => {
    expect(splitCredential("ws://h/ws?protocol=1")).toEqual({ url: "ws://h/ws?protocol=1", protocols: [] });
    expect(splitCredential("ws://h/ws?auth_token=a%20b")).toEqual({ url: "ws://h/ws?auth_token=a%20b", protocols: [] });
  });
});
