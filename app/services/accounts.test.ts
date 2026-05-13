// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildAccountId,
  forgetAccount,
  getActiveAccount,
  getActiveAccountId,
  listAccounts,
  rememberAccount,
  setActiveAccountId,
  touchAccount,
} from "./accounts";

const ACCOUNTS_KEY = "pufferblow-accounts";
const ACTIVE_ID_KEY = "pufferblow-active-account-id";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("accounts service", () => {
  it("buildAccountId normalizes the host and joins with user id", () => {
    expect(buildAccountId("chat.pufferblow.social", "u-1")).toBe(
      "https://chat.pufferblow.social::u-1",
    );
  });

  it("rememberAccount inserts a new row and marks it active", () => {
    const saved = rememberAccount({
      hostPort: "localhost:7575",
      userId: "u-1",
      username: "alice",
      authToken: "tok-1",
    });

    expect(saved.id).toBe("http://localhost:7575::u-1");
    expect(saved.hostPort).toBe("http://localhost:7575");
    expect(getActiveAccountId()).toBe(saved.id);
    expect(listAccounts()).toHaveLength(1);
  });

  it("rememberAccount is idempotent on (host, user) and refreshes the row", () => {
    rememberAccount({
      hostPort: "localhost:7575",
      userId: "u-1",
      username: "alice",
      authToken: "tok-old",
    });
    const second = rememberAccount({
      hostPort: "localhost:7575",
      userId: "u-1",
      username: "alice-renamed",
      authToken: "tok-new",
      avatarUrl: "/a.png",
    });

    const all = listAccounts();
    expect(all).toHaveLength(1);
    expect(all[0].username).toBe("alice-renamed");
    expect(all[0].authToken).toBe("tok-new");
    expect(all[0].avatarUrl).toBe("/a.png");
    expect(second.id).toBe(all[0].id);
  });

  it("listAccounts returns most-recently-used first", () => {
    const first = rememberAccount({
      hostPort: "localhost:7575",
      userId: "u-1",
      username: "alice",
      authToken: "tok-1",
      lastUsedAt: "2025-01-01T00:00:00.000Z",
    });
    const second = rememberAccount({
      hostPort: "chat.example.com",
      userId: "u-2",
      username: "bob",
      authToken: "tok-2",
      lastUsedAt: "2025-06-01T00:00:00.000Z",
    });

    const sorted = listAccounts();
    expect(sorted.map((account) => account.id)).toEqual([second.id, first.id]);
  });

  it("touchAccount updates lastUsedAt and re-sorts", () => {
    const first = rememberAccount({
      hostPort: "localhost:7575",
      userId: "u-1",
      username: "alice",
      authToken: "tok-1",
      lastUsedAt: "2025-01-01T00:00:00.000Z",
    });
    rememberAccount({
      hostPort: "chat.example.com",
      userId: "u-2",
      username: "bob",
      authToken: "tok-2",
      lastUsedAt: "2025-06-01T00:00:00.000Z",
    });

    touchAccount(first.id);

    const sorted = listAccounts();
    expect(sorted[0].id).toBe(first.id);
  });

  it("forgetAccount removes the row and clears active id when it was active", () => {
    const account = rememberAccount({
      hostPort: "localhost:7575",
      userId: "u-1",
      username: "alice",
      authToken: "tok-1",
    });
    expect(getActiveAccountId()).toBe(account.id);

    forgetAccount(account.id);
    expect(listAccounts()).toHaveLength(0);
    expect(getActiveAccountId()).toBeNull();
  });

  it("forgetAccount leaves a different active id alone", () => {
    const accountA = rememberAccount({
      hostPort: "localhost:7575",
      userId: "u-1",
      username: "alice",
      authToken: "tok-1",
    });
    const accountB = rememberAccount({
      hostPort: "chat.example.com",
      userId: "u-2",
      username: "bob",
      authToken: "tok-2",
    });
    // accountB is now active (rememberAccount sets active each time)
    expect(getActiveAccountId()).toBe(accountB.id);

    forgetAccount(accountA.id);
    expect(getActiveAccountId()).toBe(accountB.id);
  });

  it("setActiveAccountId(null) clears the pointer", () => {
    const account = rememberAccount({
      hostPort: "localhost:7575",
      userId: "u-1",
      username: "alice",
      authToken: "tok-1",
    });
    expect(getActiveAccountId()).toBe(account.id);
    setActiveAccountId(null);
    expect(getActiveAccountId()).toBeNull();
    expect(getActiveAccount()).toBeNull();
  });

  it("listAccounts is empty when storage is corrupted", () => {
    localStorage.setItem(ACCOUNTS_KEY, "not json");
    expect(listAccounts()).toEqual([]);
  });

  it("listAccounts filters out malformed rows", () => {
    localStorage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify([
        { id: "x", hostPort: "http://h", userId: "u", username: "ok", authToken: "t", lastUsedAt: "" },
        { not: "a record" },
      ]),
    );
    expect(listAccounts()).toHaveLength(1);
  });

  it("getActiveAccount returns null when active id points to a missing row", () => {
    localStorage.setItem(ACTIVE_ID_KEY, "nonexistent");
    expect(getActiveAccount()).toBeNull();
  });
});
