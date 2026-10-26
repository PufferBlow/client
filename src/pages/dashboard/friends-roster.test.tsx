import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { FriendsView } from "./FriendsView";

beforeEach(() => signIn("tok"));

const me = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "localhost:7575" };
const friend = (id: string, name: string, status: string, host = "") => ({
  friendship_id: `f-${id}`,
  other_user_id: id,
  other_username: name,
  other_origin_server: host,
  other_avatar_url: null,
  other_status: status,
});

const backend = (extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/friends": {
      friends: [friend("u1", "grace", "online"), friend("u2", "linus", "online", "kiln.social"), friend("u3", "ken", "offline", "kiln.social"), friend("u4", "pell", "online", "mesh.garden")],
    },
    "GET /api/v1/friends/requests": { incoming: [], outgoing: [] },
    "GET /api/v1/friends/blocks": { blocks: [] },
    "POST /api/v1/channels/list/": { channels: [{ channel_id: "v1", channel_name: "Ranked Grind", channel_type: "voice", is_private: false, created_at: "t" }] },
    "GET /api/v2/voice/channels/v1/participants": { participants: [{ user_id: "u1", username: "grace", is_muted: false, is_deafened: false, is_speaking: true }] },
    "GET /api/v1/dms/conversations": { conversations: [] },
    ...extra,
  });

const render = () => renderWithProviders(<FriendsView />, { route: "/dashboard/friends" });
const main = () => screen.getByRole("region", { name: "Friends" });

describe("friends: instances and who is active", () => {
  it("shows what a friend is doing: in voice, else their presence", async () => {
    backend();
    render();

    const grace = (await within(main()).findByText("grace")).closest("li")!;
    expect(await within(grace).findByText("In voice · Ranked Grind")).toBeInTheDocument();
    expect(within(within(main()).getByText("linus").closest("li")!).getByText("Online")).toBeInTheDocument();
  });

  it("lists friends who are in a voice room under Active now, with a way to join", async () => {
    backend();
    render();

    const active = await screen.findByRole("complementary", { name: "Active now" });
    expect(await within(active).findByText("grace")).toBeInTheDocument();
    expect(within(active).getByText("In voice · Ranked Grind")).toBeInTheDocument();
    expect(within(active).getByRole("link", { name: /Join/ })).toHaveAttribute("href", "/dashboard/channels");
    expect(within(active).queryByText("linus")).not.toBeInTheDocument();
  });

  it("says it is quiet when nobody is in a room", async () => {
    backend({ "GET /api/v2/voice/channels/v1/participants": { participants: [] } });
    render();
    const active = await screen.findByRole("complementary", { name: "Active now" });
    expect(await within(active).findByText("It's quiet")).toBeInTheDocument();
  });

  it("filters by instance, counting this instance's people as local", async () => {
    backend();
    const { user } = render();
    await within(main()).findByText("grace");

    await user.click(screen.getByRole("combobox", { name: "Instance" }));
    await user.click(screen.getByRole("option", { name: "kiln.social" }));

    expect(within(main()).getByText("linus")).toBeInTheDocument();
    expect(within(main()).queryByText("grace")).not.toBeInTheDocument();
    expect(within(main()).queryByText("pell")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Instance" }));
    await user.click(screen.getByRole("option", { name: "localhost:7575" }));
    expect(within(main()).getByText("grace")).toBeInTheDocument();
    expect(within(main()).queryByText("linus")).not.toBeInTheDocument();
  });

  it("only offers an instance filter when friends live on more than one", async () => {
    backend({ "GET /api/v1/friends": { friends: [friend("u1", "grace", "online")] } });
    render();
    await within(main()).findByText("grace");
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Instance" })).not.toBeInTheDocument());
  });
});
