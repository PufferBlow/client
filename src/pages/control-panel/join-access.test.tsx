import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { jsonResponse, requestLog, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ControlPanelPage } from "./ControlPanelPage";

beforeEach(() => signIn("tok"));

const person = (roles: string[], privileges: string[]) => ({
  user_id: "me",
  username: "ada",
  about: null,
  status: "online",
  accent_color: null,
  avatar_url: null,
  origin_server: "localhost:7575",
  roles_ids: roles,
  resolved_roles: roles.map((r) => ({ role_id: r, role_name: r })),
  resolved_privileges: privileges,
});

const server = {
  server_info: { server_id: "localhost:7575", server_name: "Test Server", server_description: "", version: "1", avatar_url: null, banner_url: null, members_count: 3, online_members: 1, is_private: false, join_mode: "request", max_message_length: 2000, max_total_attachment_size: 25 },
};

const request = (over: Record<string, unknown> = {}) => ({
  request_id: "r1",
  kind: "federated",
  user_id: null,
  handle: "grace@kiln.social",
  home_host: "kiln.social",
  message: "Friend of linus",
  status: "pending",
  decided_by: null,
  decided_at: null,
  created_at: "2030-01-01T10:00:00Z",
  ...over,
});

const backend = (profile: ReturnType<typeof person>, extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: profile },
    "GET /api/v1/system/server-info": server,
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "POST /api/v1/channels/list/": { channels: [] },
    "GET /api/v1/server/join-requests": () => jsonResponse({ join_mode: "request", pending: 1, requests: [request()] }),
    ...extra,
  });

const renderPanel = (section: string) => renderWithProviders(<ControlPanelPage />, { route: `/control-panel/${section}`, path: "/control-panel/:section?" });
const owner = person(["owner"], []);
const moderator = person(["moderator"], ["manage_join_requests", "manage_invites"]);

describe("join requests", () => {
  it("lists who is waiting, with where they come from and what they said", async () => {
    backend(owner);
    renderPanel("join-requests");
    const row = (await screen.findByText("grace")).closest("tr")!;
    expect(within(row).getByText(/kiln.social/)).toBeInTheDocument();
    expect(within(row).getByText("Friend of linus")).toBeInTheDocument();
  });

  it("approves and declines", async () => {
    const fetchMock = backend(owner, {
      "POST /api/v1/server/join-requests/r1/approve": { status_code: 200, pending: 0 },
      "POST /api/v1/server/join-requests/r1/deny": { status_code: 200, pending: 0 },
    });
    const { user } = renderPanel("join-requests");
    await user.click(await screen.findByRole("button", { name: "Approve grace@kiln.social" }));
    await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/server/join-requests/r1/approve"));
    await user.click(await screen.findByRole("button", { name: "Decline grace@kiln.social" }));
    await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/server/join-requests/r1/deny"));
  });

  it("shows decided ones without buttons", async () => {
    backend(owner, { "GET /api/v1/server/join-requests": () => jsonResponse({ join_mode: "request", pending: 0, requests: [request({ status: "approved" })] }) });
    const { user } = renderPanel("join-requests");
    await user.click(await screen.findByRole("tab", { name: /Approved/ }));
    expect(await screen.findByText("Approved", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
  });

  it("is open to a moderator, who sees only the screens that are theirs", async () => {
    backend(moderator);
    renderPanel("join-requests");
    expect(await screen.findByText("grace")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Control panel sections" });
    expect(within(nav).getByRole("link", { name: /Join requests/ })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Invitations" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Roles" })).not.toBeInTheDocument();
  });

  it("is closed to someone with neither privilege", async () => {
    backend(person(["user"], []));
    renderPanel("join-requests");
    await waitFor(() => expect(screen.queryByText("grace")).not.toBeInTheDocument());
    expect(screen.queryByRole("navigation", { name: "Control panel sections" })).not.toBeInTheDocument();
  });
});

describe("invitations", () => {
  const invite = (over: Record<string, unknown> = {}) => ({ code: "ABCDEFGHJKMN", created_by: "me", note: "For the film club", max_uses: 5, uses: 2, expires_at: null, revoked_at: null, created_at: "2030-01-01T10:00:00Z", state: "active", ...over });

  it("shows each code with how it stands, and makes and revokes them", async () => {
    const fetchMock = backend(owner, {
      "GET /api/v1/server/invites": () => jsonResponse({ join_mode: "invite", invites: [invite(), invite({ code: "ZZZZZZZZZZZZ", note: null, state: "used_up", uses: 5 })] }),
      "POST /api/v1/server/invites": () => jsonResponse({ invite: invite() }, 201),
      "DELETE /api/v1/server/invites/ABCDEFGHJKMN": { revoked: true },
    });
    const { user } = renderPanel("invites");

    expect(await screen.findByText("ABCD-EFGH-JKMN")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(screen.getByText("Used up")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Who is it for"), "Launch party");
    await user.type(screen.getByLabelText("How many people can use it"), "10");
    await user.click(screen.getByRole("button", { name: "Make a code" }));
    await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/server/invites"));
    const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "POST" && String(init.body).includes("Launch party"))![1]!.body));
    expect(body).toMatchObject({ note: "Launch party", max_uses: 10 });

    await user.click(screen.getByRole("button", { name: "Revoke code ABCD-EFGH-JKMN" }));
    await waitFor(() => expect(requestLog(fetchMock)).toContain("DELETE /api/v1/server/invites/ABCDEFGHJKMN"));
    expect(screen.queryByRole("button", { name: /Revoke code ZZZZ/ })).not.toBeInTheDocument(); // only a live code can be revoked
  });

  it("says codes do nothing while the server is open", async () => {
    backend(owner, { "GET /api/v1/server/invites": () => jsonResponse({ join_mode: "open", invites: [] }) });
    renderPanel("invites");
    expect(await screen.findByText(/open to everyone right now/)).toBeInTheDocument();
    expect(screen.getByText("No codes yet.")).toBeInTheDocument();
  });
});
