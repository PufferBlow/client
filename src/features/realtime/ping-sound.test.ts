import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification } from "../notifications/api";
import { notificationKeys } from "../notifications/hooks";
import * as sounds from "../sounds/sounds";
import { applyEvent } from "./applyEvent";

const note = (id: string, read = false): AppNotification => ({ id, type: "mention", actorUserId: "u", channelId: "c", messageId: "m", createdAt: "t", read });

let server: AppNotification[];
let client: QueryClient;
let play: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  play = vi.spyOn(sounds, "playSound").mockImplementation(() => undefined);
  client = new QueryClient();
  server = [note("old")];
});
afterEach(() => client.clear());

/** The notification list as the inbox and the rail keep it: loaded, and watched. */
async function watch() {
  const observer = new QueryObserver(client, { queryKey: notificationKeys.list, queryFn: async () => server, staleTime: Infinity });
  observer.subscribe(() => undefined);
  await observer.refetch();
}

const ping = () => applyEvent(client, { kind: "notification" }, { activeChannelId: undefined, activeConversationId: undefined });

describe("the ping sound", () => {
  it("sounds for a notification that arrives while the app is running", async () => {
    await watch();
    server = [note("new"), note("old")];
    ping();
    await vi.waitFor(() => expect(play).toHaveBeenCalledWith("ping"));
  });

  it("stays quiet when the list is not loaded yet, as on first load", async () => {
    server = [note("new")];
    ping();
    await new Promise((r) => setTimeout(r, 20));
    expect(play).not.toHaveBeenCalled();
  });

  it("stays quiet when nothing in the list is new, or the new one is already read", async () => {
    await watch();
    ping();
    server = [note("seen", true), note("old")];
    ping();
    await new Promise((r) => setTimeout(r, 20));
    expect(play).not.toHaveBeenCalled();
  });
});
