import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { HubPage } from "./HubPage";

beforeEach(() => signIn("tok"));

const me = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "localhost:7575" };
const channels = [
  { channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "t" },
  { channel_id: "c2", channel_name: "patch-notes", channel_type: "text", is_private: false, created_at: "t" },
  { channel_id: "v1", channel_name: "Ranked Grind", channel_type: "voice", is_private: false, created_at: "t" },
];

const backend = (extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/users/list": { users: [me, { ...me, user_id: "u2", username: "vexa", origin_server: "lanes.gg" }] },
    "POST /api/v1/channels/list/": { channels },
    "GET /api/v1/channels/read-history": { unread_counts: { c2: 4 } },
    "GET /api/v1/system/server-info": {
      server_info: { server_id: "localhost:7575", server_name: "Deadlock Community", banner_url: null, avatar_url: null, members_count: 48210, online_members: 1904 },
    },
    "GET /api/v1/notifications": { notifications: [] },
    "GET /api/v1/notifications/preferences": { preferences: [] },
    "GET /api/v2/voice/channels/v1/participants": { participants: [{ user_id: "u2", username: "vexa", is_muted: false, is_deafened: false, is_speaking: true }] },
    ...extra,
  });

const renderHub = () => renderWithProviders(<HubPage />, { route: "/dashboard", path: "/dashboard" });

describe("the hub", () => {
  it("features the instance you are in, with its counts and a way into its first channel", async () => {
    backend();
    renderHub();

    const banner = await screen.findByRole("region", { name: "Deadlock Community" });
    expect(within(banner).getByRole("heading", { name: "Deadlock Community" })).toBeInTheDocument();
    expect(within(banner).getByText(/1,904 online/)).toBeInTheDocument();
    expect(within(banner).getByText(/48,210 members/)).toBeInTheDocument();
    expect(within(banner).getByRole("link", { name: /Open #general/ })).toHaveAttribute("href", "/dashboard/channels/c1");
  });

  it("lists your spaces with the one you are in first, and its unread count", async () => {
    backend();
    renderHub();

    const here = await screen.findByRole("button", { name: /Deadlock Community, the instance you are in/ });
    expect(here).toHaveTextContent("You are here");
    expect(await within(here).findByText("4")).toBeInTheDocument();
  });

  it("shows who is in a voice room right now, and leaves empty rooms out", async () => {
    backend();
    renderHub();

    const live = await screen.findByRole("complementary", { name: "Right now" });
    expect(await within(live).findByText("Ranked Grind")).toBeInTheDocument();
    expect(within(live).getByText(/1 in the room/)).toBeInTheDocument();
  });

  it("leaves a voice room out of Live now when nobody is in it", async () => {
    backend({ "GET /api/v2/voice/channels/v1/participants": { participants: [] } });
    renderHub();
    const live = await screen.findByRole("complementary", { name: "Right now" });
    await waitFor(() => expect(within(live).queryByText("Ranked Grind")).not.toBeInTheDocument());
  });

  it("points at what is unread, with the pings first", async () => {
    backend();
    renderHub();
    const live = await screen.findByRole("complementary", { name: "Right now" });
    const link = await within(live).findByRole("link", { name: /patch-notes/ });
    expect(link).toHaveAttribute("href", "/dashboard/channels/c2");
    expect(link).toHaveTextContent("4 unread");
  });

  it("says plainly which tiles are not available yet", async () => {
    backend();
    renderHub();
    await screen.findByRole("region", { name: "Deadlock Community" });
    const browse = screen.getByRole("navigation", { name: "Browse" });
    for (const name of ["Events", "Trending", "LFG", "Discover"]) expect(within(browse).getByText(name).closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
    expect(within(browse).getByText("Voice").closest("a")).not.toBeNull();
  });

  it("searches this instance's channels and people", async () => {
    backend();
    const { user } = renderHub();
    await screen.findByRole("region", { name: "Deadlock Community" });

    await user.type(screen.getByRole("searchbox", { name: "Search channels and people" }), "pat");
    expect(await screen.findByRole("link", { name: "patch-notes" })).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "vex");
    expect(await screen.findByRole("button", { name: /vexa/ })).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("links to friends and messages", async () => {
    backend();
    renderHub();
    expect(await screen.findByRole("link", { name: "Friends and messages" })).toHaveAttribute("href", "/dashboard/friends");
  });
});
