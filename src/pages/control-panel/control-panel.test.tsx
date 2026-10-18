import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServerRail } from "../../components/dashboard/ServerRail";
import { isServerOwner, roleNames } from "../../features/users/roles";
import { bearerOfCall, jsonResponse, requestLog, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ControlPanelPage } from "./ControlPanelPage";

beforeEach(() => signIn("tok"));

const owner = {
  user_id: "me",
  username: "ada",
  about: null,
  status: "online",
  accent_color: null,
  avatar_url: null,
  origin_server: "localhost:7575",
  roles_ids: ["owner"],
  resolved_roles: [{ role_id: "owner", role_name: "Owner", is_system: true }],
};
const member = { ...owner, user_id: "u2", username: "grace", roles_ids: ["member"], resolved_roles: [{ role_id: "member", role_name: "Member" }] };

const serverInfo = {
  server_info: {
    server_id: "localhost:7575",
    server_name: "Test Server",
    server_description: "A friendly place",
    version: "1.2.3",
    avatar_url: null,
    banner_url: null,
    members_count: 12,
    online_members: 4,
    is_private: false,
    max_message_length: 2000,
    max_total_attachment_size: 25 * 1024 * 1024,
  },
};

const channels = [
  { channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "2030-01-02T00:00:00Z" },
  { channel_id: "c2", channel_name: "staff", channel_type: "text", is_private: true, created_at: "2030-01-03T00:00:00Z" },
  { channel_id: "v1", channel_name: "Lounge", channel_type: "voice", is_private: false, created_at: "2030-01-04T00:00:00Z" },
];

const backend = (profile: unknown = owner, extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: profile },
    "GET /api/v1/system/server-info": serverInfo,
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "POST /api/v1/channels/list/": { channels },
    "GET /api/v1/users/list": { users: [owner, member] },
    ...extra,
  });

describe("isServerOwner", () => {
  it("recognises the owner role by id", () => {
    expect(isServerOwner({ roles_ids: ["owner"] })).toBe(true);
    expect(isServerOwner({ roles_ids: ["member", "owner"] })).toBe(true);
  });

  it("recognises it from resolved roles too", () => {
    expect(isServerOwner({ resolved_roles: [{ role_id: "owner", role_name: "Owner" }] })).toBe(true);
  });

  it.each([
    [{ roles_ids: ["admin"] }],
    [{ roles_ids: ["member"] }],
    [{ roles_ids: [] }],
    [{ roles_ids: null }],
    [{}],
    [null],
    [undefined],
  ])("is false for %j", (profile) => {
    expect(isServerOwner(profile)).toBe(false);
  });

  it("does not treat a role merely named 'Owner' as ownership", () => {
    expect(isServerOwner({ resolved_roles: [{ role_id: "custom", role_name: "Owner" }] })).toBe(false);
  });
});

describe("roleNames", () => {
  it("prefers resolved names and falls back to ids", () => {
    expect(roleNames({ resolved_roles: [{ role_id: "owner", role_name: "Owner" }], roles_ids: ["owner"] })).toEqual(["Owner"]);
    expect(roleNames({ roles_ids: ["admin"] })).toEqual(["admin"]);
    expect(roleNames({})).toEqual([]);
  });
});

describe("server rail control panel button", () => {
  const renderRail = () => renderWithProviders(<ServerRail />, { route: "/dashboard/channels", path: "*" });
  const button = () => screen.queryByRole("link", { name: "Server control panel" });

  it("appears for the server owner and links to the control panel", async () => {
    backend(owner);
    renderRail();

    const link = await screen.findByRole("link", { name: "Server control panel" });
    expect(link).toHaveAttribute("href", "/control-panel");
  });

  it("sits at the bottom of the rail, after the server", async () => {
    backend(owner);
    renderRail();

    await screen.findByRole("link", { name: "Server control panel" });
    const links = within(screen.getByRole("navigation", { name: "Servers" })).getAllByRole("link");
    expect(links.at(-1)).toHaveAccessibleName("Server control panel");
  });

  it("is hidden for anyone who is not the owner", async () => {
    backend({ ...member, user_id: "me" });
    renderRail();

    await screen.findByRole("link", { name: /Test Server/ });
    expect(button()).not.toBeInTheDocument();
  });

  it("is hidden for an admin who is not the owner", async () => {
    backend({ ...member, user_id: "me", roles_ids: ["admin"], resolved_roles: [{ role_id: "admin", role_name: "Admin" }] });
    renderRail();

    await screen.findByRole("link", { name: /Test Server/ });
    expect(button()).not.toBeInTheDocument();
  });

  it("stays hidden while the profile is loading, and if it fails", async () => {
    backend(owner, { "POST /api/v1/users/profile": jsonResponse({ error_code: "server.internal_error", message: "x" }, 500) });
    renderRail();

    await screen.findByRole("link", { name: /Test Server/ });
    expect(button()).not.toBeInTheDocument();
  });
});

describe("ControlPanelPage", () => {
  const renderPanel = (section = "") =>
    renderWithProviders(<ControlPanelPage />, { route: `/control-panel/${section}`.replace(/\/$/, ""), path: "/control-panel/:section?" });

  it("sends a non-owner back to the dashboard", async () => {
    backend({ ...member, user_id: "me" });
    renderPanel();
    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/dashboard");
  });

  it("checks permissions before showing anything", () => {
    backend();
    renderPanel();
    expect(screen.getByText("Checking permissions…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
  });

  it("shows an error with retry if the profile can't be loaded", async () => {
    backend(owner, { "POST /api/v1/users/profile": jsonResponse({ error_code: "server.internal_error", message: "boom" }, 500) });
    renderPanel();
    expect(await screen.findByText("Couldn't load your profile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("opens on the overview for the owner and lists every section", async () => {
    backend();
    renderPanel();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Control panel sections" });
    for (const label of ["Overview", "Channels", "Members", "Roles & privileges", "Moderation", "Server settings"]) {
      expect(within(nav).getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("link", { name: /Overview/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("Test Server").length).toBeGreaterThanOrEqual(2); // sidebar title and details
  });

  it("falls back to the overview for an unknown section", async () => {
    backend();
    renderPanel("bogus");
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
  });

  describe("overview", () => {
    it("shows the server's headline numbers and details", async () => {
      backend();
      renderPanel();

      await screen.findByText("Accounts on this server");
      expect(screen.getByText("12")).toBeInTheDocument(); // members
      expect(screen.getByText("4")).toBeInTheDocument(); // online
      await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument()); // channels
      expect(screen.getByText("1.2.3")).toBeInTheDocument();
      expect(screen.getByText("A friendly place")).toBeInTheDocument();
      expect(screen.getByText("2,000 characters")).toBeInTheDocument();
      expect(screen.getByText("25 MB")).toBeInTheDocument();
      expect(screen.getByText("Public")).toBeInTheDocument();
    });

    it("copes with null counts and limits from the server", async () => {
      backend(owner, {
        "GET /api/v1/system/server-info": {
          server_info: { ...serverInfo.server_info, members_count: null, online_members: null, max_message_length: null, max_total_attachment_size: null, server_description: null, is_private: true },
        },
      });
      renderPanel();

      expect(await screen.findByText("Private")).toBeInTheDocument();
      expect(screen.getAllByText("No limit")).toHaveLength(2); // message length and attachments
      expect(screen.getByText("None")).toBeInTheDocument();
      // Falls back to counting the user list when the server doesn't say.
      await waitFor(() => expect(screen.getAllByText("2").length).toBeGreaterThan(0));
    });

    it("links onward to the other sections", async () => {
      backend();
      renderPanel();
      expect(await screen.findByRole("link", { name: /review channels/i })).toHaveAttribute("href", "/control-panel/channels");
    });

    it("shows an error with retry when the server can't be loaded", async () => {
      backend(owner, { "GET /api/v1/system/server-info": jsonResponse({ error_code: "server.internal_error", message: "boom" }, 500) });
      renderPanel();
      expect(await screen.findByText("Couldn't load the server")).toBeInTheDocument();
    });
  });

  describe("channels", () => {
    it("lists every channel with its type and access", async () => {
      backend();
      renderPanel("channels");

      const table = await screen.findByRole("table");
      const rows = await within(table).findAllByRole("row");
      expect(rows).toHaveLength(4); // header + 3
      expect(within(table).getByText("general")).toBeInTheDocument();
      expect(within(table).getByText("Voice")).toBeInTheDocument();
      expect(within(table).getAllByText("Text")).toHaveLength(2);
      expect(within(table).getByText("Private")).toBeInTheDocument();
      expect(screen.getByText("3 channels")).toBeInTheDocument();
    });

    it("shows an empty state with a way to create the first channel", async () => {
      backend(owner, { "POST /api/v1/channels/list/": { channels: [] } });
      renderPanel("channels");
      expect(await screen.findByText("No channels yet")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /new channel/i })).toBeInTheDocument();
    });

    describe("create, edit and delete", () => {
      const created = { channel_id: "c9", channel_name: "ideas", channel_type: "voice", is_private: true, created_at: "2030-02-01T00:00:00Z" };
      const bodyOf = (fn: ReturnType<typeof routeFetch>, route: string) => {
        const call = fn.mock.calls.find(([input, init]) => `${init?.method} ${new URL(String(input)).pathname}` === route)!;
        return JSON.parse(String(call[1]!.body));
      };

      it("creates a channel with the chosen name, type and privacy", async () => {
        const user = userEvent.setup();
        const fetchMock = backend(owner, { "POST /api/v1/channels/create/": { channel_data: created } });
        renderPanel("channels");

        await user.click(await screen.findByRole("button", { name: /new channel/i }));
        await user.type(screen.getByRole("textbox", { name: "Channel name" }), "  ideas ");
        await user.click(screen.getByLabelText("Voice"));
        await user.click(screen.getByLabelText(/private channel/i));
        await user.click(screen.getByRole("button", { name: "Create channel" }));

        await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/channels/create/"));
        expect(bodyOf(fetchMock, "POST /api/v1/channels/create/")).toEqual({
          channel_name: "ideas",
          channel_type: "voice",
          is_private: true,
          auth_token: "tok",
        });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      });

      it("won't submit an empty name", async () => {
        const user = userEvent.setup();
        const fetchMock = backend(owner, { "POST /api/v1/channels/create/": { channel_data: created } });
        renderPanel("channels");

        await user.click(await screen.findByRole("button", { name: /new channel/i }));
        await user.click(screen.getByRole("button", { name: "Create channel" }));

        expect(screen.getByText("Give the channel a name.")).toBeInTheDocument();
        expect(requestLog(fetchMock)).not.toContain("POST /api/v1/channels/create/");
      });

      it("shows the server's reason when creating fails, and keeps the form open", async () => {
        const user = userEvent.setup();
        backend(owner, {
          "POST /api/v1/channels/create/": jsonResponse({ error_code: "channel.name_taken", message: "Channel name already exists." }, 409),
        });
        renderPanel("channels");

        await user.click(await screen.findByRole("button", { name: /new channel/i }));
        await user.type(screen.getByRole("textbox", { name: "Channel name" }), "general");
        await user.click(screen.getByRole("button", { name: "Create channel" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
        expect(screen.getByRole("textbox", { name: "Channel name" })).toHaveValue("general");
      });

      it("edits name and privacy, but not the type", async () => {
        const user = userEvent.setup();
        const fetchMock = backend(owner, {
          "PUT /api/v1/channels/c1/update": { channel_data: { ...channels[0], channel_name: "lobby", is_private: true } },
        });
        renderPanel("channels");

        await user.click(await screen.findByRole("button", { name: "Edit general" }));
        expect(screen.queryByLabelText("Voice")).not.toBeInTheDocument();
        expect(screen.getByText(/can't be changed/i)).toBeInTheDocument();

        const name = screen.getByRole("textbox", { name: "Channel name" });
        expect(name).toHaveValue("general");
        await user.clear(name);
        await user.type(name, "lobby");
        await user.click(screen.getByLabelText(/private channel/i));
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        await waitFor(() => expect(requestLog(fetchMock)).toContain("PUT /api/v1/channels/c1/update"));
        expect(bodyOf(fetchMock, "PUT /api/v1/channels/c1/update")).toEqual({ channel_name: "lobby", is_private: true, auth_token: "tok" });
      });

      it("asks before deleting, then removes the channel from the list", async () => {
        const user = userEvent.setup();
        const fetchMock = backend(owner, { "DELETE /api/v1/channels/c2/delete": { status_code: 200 } });
        renderPanel("channels");

        await user.click(await screen.findByRole("button", { name: "Delete staff" }));
        expect(requestLog(fetchMock)).not.toContain("DELETE /api/v1/channels/c2/delete");
        await user.click(screen.getByRole("button", { name: "Delete channel" }));

        await waitFor(() => expect(requestLog(fetchMock)).toContain("DELETE /api/v1/channels/c2/delete"));
        const call = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE")!;
        expect(bearerOfCall(call)).toBe("Bearer tok");
        expect(new URL(String(call[0])).searchParams.has("auth_token")).toBe(false);
      });

      it("cancelling a delete changes nothing", async () => {
        const user = userEvent.setup();
        const fetchMock = backend();
        renderPanel("channels");

        await user.click(await screen.findByRole("button", { name: "Delete staff" }));
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.queryByText(/delete staff\?/i)).not.toBeInTheDocument();
        expect(requestLog(fetchMock).some((r) => r.startsWith("DELETE"))).toBe(false);
      });

      it("shows why a delete failed", async () => {
        const user = userEvent.setup();
        backend(owner, {
          "DELETE /api/v1/channels/c2/delete": jsonResponse({ error_code: "auth.forbidden", message: "You can't delete channels." }, 403),
        });
        renderPanel("channels");

        await user.click(await screen.findByRole("button", { name: "Delete staff" }));
        await user.click(screen.getByRole("button", { name: "Delete channel" }));

        expect(await screen.findByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("members", () => {
    it("lists members with status and role tags, owner first alphabetically", async () => {
      backend();
      renderPanel("members");

      const table = await screen.findByRole("table");
      await within(table).findByText("grace");
      expect(within(table).getByText("Owner")).toBeInTheDocument();
      expect(within(table).getByText("Member", { selector: "span" })).toBeInTheDocument();
      const names = within(table).getAllByText(/^(ada|grace)$/).map((el) => el.textContent);
      expect(names).toEqual(["ada", "grace"]);
      expect(screen.getByText("2 members")).toBeInTheDocument();
    });
  });

  describe("planned sections", () => {
    it.each([
      ["roles", "Create and edit roles"],
      ["moderation", "Time out or ban members"],
      ["settings", "Name, description and welcome message"],
    ])("%s explains what is coming", async (section, planned) => {
      backend();
      renderPanel(section);

      expect(await screen.findByText("Coming soon")).toBeInTheDocument();
      expect(screen.getByText(planned)).toBeInTheDocument();
    });

    it("flags them as 'Soon' in the navigation", async () => {
      backend();
      renderPanel();
      const nav = await screen.findByRole("navigation", { name: "Control panel sections" });
      expect(within(nav).getAllByText("Soon")).toHaveLength(3);
    });
  });
});
