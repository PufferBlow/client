import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { groupChannels } from "../../features/channels/categories";
import type { Channel } from "../../features/channels/types";
import { routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ChannelSidebar } from "./ChannelSidebar";

beforeEach(() => signIn("tok"));

const channel = (id: string, name: string, over: Partial<Channel> = {}): Channel => ({ channel_id: id, channel_name: name, channel_type: "text", is_private: false, created_at: "t", ...over });
const category = (id: string, name: string, position: number) => ({ category_id: id, name, position });

describe("groupChannels", () => {
  it("puts channels under their category, categories in order and channels by position then name", () => {
    const groups = groupChannels(
      [channel("1", "rules", { category_id: "info", position: 1 }), channel("2", "announcements", { category_id: "info", position: 0 }), channel("3", "general", { category_id: "talk" }), channel("4", "afk", { category_id: "talk" })],
      [category("talk", "Talk", 1), category("info", "Information", 0)],
    );
    expect(groups.map((g) => g.category?.name)).toEqual(["Information", "Talk"]);
    expect(groups[0]!.channels.map((c) => c.channel_name)).toEqual(["announcements", "rules"]);
    expect(groups[1]!.channels.map((c) => c.channel_name)).toEqual(["afk", "general"]); // same position: by name
  });

  it("keeps channels in no category, or in one that is gone, together at the end", () => {
    const groups = groupChannels([channel("1", "a", { category_id: "info" }), channel("2", "b"), channel("3", "c", { category_id: "deleted" })], [category("info", "Information", 0)]);
    expect(groups.map((g) => g.category?.name ?? null)).toEqual(["Information", null]);
    expect(groups[1]!.channels.map((c) => c.channel_name)).toEqual(["b", "c"]);
  });

  it("leaves out a category with nothing in it, and gives no groups for no channels", () => {
    expect(groupChannels([channel("1", "a")], [category("empty", "Empty", 0)]).map((g) => g.category)).toEqual([null]);
    expect(groupChannels([], [category("empty", "Empty", 0)])).toEqual([]);
  });
});

const backend = (channels: Channel[], categories: unknown[]) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "x", roles_ids: [] } },
    "POST /api/v1/channels/list/": { channels },
    "GET /api/v1/channels/categories": { categories },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "Test Server" } },
    "GET /api/v1/notifications/preferences": { preferences: [] },
    "GET /api/v1/notifications": { notifications: [] },
    "GET /api/v2/voice/channels/v1/participants": { participants: [] },
  });

describe("the channel list", () => {
  it("shows each category as a group with its channels, text and voice together, then the rest", async () => {
    backend(
      [channel("c1", "rules", { category_id: "info" }), channel("v1", "Lounge", { channel_type: "voice", category_id: "info" }), channel("c2", "general"), channel("v2", "Ranked", { channel_type: "voice" })],
      [category("info", "Information", 0)],
    );
    renderWithProviders(<ChannelSidebar />, { route: "/dashboard/channels", path: "*" });

    const info = within(await screen.findByRole("region", { name: "Information" }));
    expect(info.getByRole("link", { name: /rules/ })).toBeInTheDocument();
    expect(info.getByRole("button", { name: /^Join voice channel Lounge/ })).toBeInTheDocument();
    expect(screen.getByText("Channels")).toBeInTheDocument(); // the uncategorised text channels
    expect(screen.getByRole("link", { name: /general/ })).toBeInTheDocument();
    expect(screen.getByText("Voice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Join voice channel Ranked/ })).toBeInTheDocument();
  });

  it("looks as it always did when the instance has no categories", async () => {
    backend([channel("c1", "general"), channel("v1", "Lounge", { channel_type: "voice" })], []);
    renderWithProviders(<ChannelSidebar />, { route: "/dashboard/channels", path: "*" });

    expect(await screen.findByRole("link", { name: /general/ })).toBeInTheDocument();
    expect(screen.getByText("Channels")).toBeInTheDocument();
    expect(screen.getByText("Voice")).toBeInTheDocument();
  });

  it("still lists the channels when the categories cannot be read (an older instance)", async () => {
    routeFetch({
      "POST /api/v1/users/profile": { user_data: { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "x", roles_ids: [] } },
      "POST /api/v1/channels/list/": { channels: [channel("c1", "general")] },
      "GET /api/v1/channels/read-history": { unread_counts: {} },
      "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "Test Server" } },
      "GET /api/v1/notifications/preferences": { preferences: [] },
      "GET /api/v1/notifications": { notifications: [] },
    });
    renderWithProviders(<ChannelSidebar />, { route: "/dashboard/channels", path: "*" });
    expect(await screen.findByRole("link", { name: /general/ })).toBeInTheDocument();
  });
});
