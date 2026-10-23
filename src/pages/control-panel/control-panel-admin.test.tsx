import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { actionLabel, durationLabel, moderationStates, type AuditEntry } from "../../features/admin/moderation";
import { jsonResponse, requestLog, routeFetch, signIn } from "../../test/helpers";
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
const grace = { ...owner, user_id: "u2", username: "grace", roles_ids: ["member"], resolved_roles: [{ role_id: "member", role_name: "Member" }] };
const linus = { ...owner, user_id: "u3", username: "linus", roles_ids: ["member"], resolved_roles: [{ role_id: "member", role_name: "Member" }] };

const serverInfo = {
  server_info: {
    server_id: "localhost:7575",
    server_name: "Test Server",
    server_description: "A friendly place",
    version: "1.2.3",
    avatar_url: null,
    banner_url: null,
    members_count: 3,
    online_members: 1,
    is_private: false,
    max_message_length: 2000,
    max_total_attachment_size: 25,
    max_image_size: 10,
    max_video_size: 50,
    max_sticker_size: 2,
    max_gif_size: 8,
  },
};

const roles = [
  { role_id: "owner", role_name: "Owner", privileges_ids: ["manage_server_settings", "ban_users"], is_system: true, user_count: 1 },
  { role_id: "member", role_name: "Member", privileges_ids: [], is_system: true, user_count: 2 },
  { role_id: "helper", role_name: "Helper", privileges_ids: ["mute_users"], is_system: false, user_count: 0 },
];
const privileges = [
  { privilege_id: "ban_users", privilege_name: "Ban users", category: "moderation" },
  { privilege_id: "mute_users", privilege_name: "Mute users", category: "moderation" },
  { privilege_id: "manage_server_settings", privilege_name: "Manage server settings", category: "server" },
];

const audit = (entries: Partial<AuditEntry>[] = []) => ({
  activities: entries.map((e, i) => ({
    id: `a${i}`,
    type: "server_settings_updated",
    title: "Something happened",
    description: "",
    timestamp: "2030-01-02T10:00:00Z",
    user: { id: "me", username: "ada" },
    metadata: {},
    ...e,
  })),
});

const backend = (extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: owner },
    "GET /api/v1/system/server-info": serverInfo,
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "POST /api/v1/channels/list/": { channels: [] },
    "GET /api/v1/users/list": { users: [owner, grace, linus] },
    "POST /api/v1/system/roles/list": { roles },
    "POST /api/v1/system/privileges/list": { privileges },
    "POST /api/v1/system/recent-activity": audit(),
    ...extra,
  });

const renderPanel = (section: string) =>
  renderWithProviders(<ControlPanelPage />, { route: `/control-panel/${section}`, path: "/control-panel/:section?" });

const bodyOf = (fetchMock: ReturnType<typeof routeFetch>, route: string) => {
  const call = fetchMock.mock.calls.find(([input, init]) => `${init?.method ?? "GET"} ${new URL(String(input)).pathname}` === route);
  return call ? (JSON.parse(String(call[1]!.body)) as Record<string, unknown>) : undefined;
};

describe("moderation state from the audit log", () => {
  const entry = (type: string, at: string, meta: Record<string, unknown>): AuditEntry => ({ id: at + type, type, title: "", description: "", timestamp: at, user: null, metadata: meta });

  it("the newest entry for a person wins", () => {
    const states = moderationStates([
      entry("user_unbanned", "2030-01-03T00:00:00Z", { target_user_id: "u2" }),
      entry("user_banned", "2030-01-02T00:00:00Z", { target_user_id: "u2" }),
      entry("user_banned", "2030-01-01T00:00:00Z", { target_user_id: "u3" }),
    ]);
    expect(states.get("u2")?.banned).toBe(false);
    expect(states.get("u3")?.banned).toBe(true);
  });

  it("a timeout counts until it runs out or is cleared", () => {
    const now = new Date("2030-01-01T12:00:00Z");
    const timeout = (id: string, until: string) => entry("user_timed_out", "2030-01-01T11:00:00Z", { target_user_id: id, expires_at: until });
    const states = moderationStates(
      [timeout("u2", "2030-01-01T13:00:00Z"), timeout("u3", "2030-01-01T11:30:00Z"), timeout("u4", "2030-01-01T13:00:00Z"), entry("user_timeout_cleared", "2030-01-01T11:10:00Z", { target_user_id: "u4" })],
      now,
    );
    expect(states.get("u2")?.timeoutUntil).toEqual(new Date("2030-01-01T13:00:00Z"));
    expect(states.get("u3")?.timeoutUntil).toBeNull();
    expect(states.get("u4")?.timeoutUntil).toBeNull();
  });

  it("labels", () => {
    expect(durationLabel(5)).toBe("5 minutes");
    expect(durationLabel(60)).toBe("1 hour");
    expect(durationLabel(1440)).toBe("1 day");
    expect(actionLabel("user_roles_updated")).toBe("User roles updated");
  });
});

describe("settings", () => {
  it("saves only what changed", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "PUT /api/v1/system/server-info": { status_code: 200 } });
    renderPanel("settings");

    const name = await screen.findByLabelText("Server name");
    expect(name).toHaveValue("Test Server");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.clear(name);
    await user.type(name, "Renamed");
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Saved.");
    expect(bodyOf(fetchMock, "PUT /api/v1/system/server-info")).toEqual({ auth_token: "tok", server_name: "Renamed", is_private: true });
  });

  it("sends changed limits as numbers and refuses a bad one", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "PUT /api/v1/system/server-info": { status_code: 200 } });
    renderPanel("settings");

    const length = await screen.findByLabelText("Message length");
    await user.clear(length);
    await user.type(length, "abc");
    expect(await screen.findByText("Use a whole number above zero.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save limits" })).toBeDisabled();

    await user.clear(length);
    await user.type(length, "4000");
    await user.click(screen.getByRole("button", { name: "Save limits" }));
    await screen.findByText("Limits saved.");
    expect(bodyOf(fetchMock, "PUT /api/v1/system/server-info")).toEqual({ auth_token: "tok", max_message_length: 4000 });
  });

  it("shuffles the server icon", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "PUT /api/v1/system/server-appearance": { status_code: 200 } });
    renderPanel("settings");
    await user.click(await screen.findByRole("button", { name: /Shuffle icon and banner/ }));
    await screen.findByText("New icon and banner picked.");
    expect(bodyOf(fetchMock, "PUT /api/v1/system/server-appearance")).toMatchObject({ avatar_kind: "identicon", shuffle_avatar_seed: true });
  });
});

describe("roles", () => {
  it("lists roles, marks built-in ones read-only and edits a custom one", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "PUT /api/v1/system/roles/helper": { role: roles[2] } });
    renderPanel("roles");

    expect(await screen.findByText("3 roles")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Owner/ }));
    expect(screen.getByLabelText("Role name")).toBeDisabled();
    expect(screen.getByText(/built in, so it cannot be changed/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Helper/ }));
    await user.click(screen.getByLabelText("Ban users"));
    await user.click(screen.getByRole("button", { name: "Save role" }));
    await screen.findByText("Role saved.");
    expect(bodyOf(fetchMock, "PUT /api/v1/system/roles/helper")).toEqual({ auth_token: "tok", role_name: "Helper", privileges_ids: ["mute_users", "ban_users"] });
  });

  it("creates a role", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "POST /api/v1/system/roles": jsonResponse({ role: { role_id: "greeter", role_name: "Greeter", privileges_ids: ["mute_users"], is_system: false, user_count: 0 } }, 201) });
    renderPanel("roles");

    await user.click(await screen.findByRole("button", { name: "New role" }));
    expect(screen.getByRole("button", { name: "Create role" })).toBeDisabled();
    await user.type(screen.getByLabelText("Role name"), "Greeter");
    await user.click(screen.getByLabelText("Mute users"));
    await user.click(screen.getByRole("button", { name: "Create role" }));
    await waitFor(() => expect(bodyOf(fetchMock, "POST /api/v1/system/roles")).toEqual({ auth_token: "tok", role_name: "Greeter", privileges_ids: ["mute_users"] }));
  });

  it("deletes an unused custom role, and will not for one that is in use", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "DELETE /api/v1/system/roles/helper": { status_code: 200 } });
    renderPanel("roles");

    await user.click(await screen.findByRole("button", { name: /Helper/ }));
    await user.click(screen.getByRole("button", { name: "Delete role" }));
    await waitFor(() => expect(requestLog(fetchMock)).toContain("DELETE /api/v1/system/roles/helper"));
  });
});

describe("members", () => {
  it("assigns roles", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "PUT /api/v1/system/users/u2/roles": { status_code: 200 } });
    renderPanel("members");

    await user.click(await screen.findByRole("button", { name: "Roles of grace" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByLabelText("Helper"));
    await user.click(within(dialog).getByRole("button", { name: "Save roles" }));
    await within(dialog).findByText("Roles updated.");
    expect(bodyOf(fetchMock, "PUT /api/v1/system/users/u2/roles")).toEqual({ auth_token: "tok", roles_ids: ["member", "helper"] });
  });

  it("offers no moderation for the owner or for yourself", async () => {
    backend();
    renderPanel("members");
    await screen.findByText("grace");
    expect(screen.queryByRole("button", { name: "Ban ada" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ban grace" })).toBeInTheDocument();
  });

  it("times someone out with a reason", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "POST /api/v1/moderation/users/u2/timeout": jsonResponse({ expires_at: "x" }, 201) });
    renderPanel("members");

    await user.click(await screen.findByRole("button", { name: "Time out grace" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "1 day" }));
    await user.type(within(dialog).getByLabelText("Reason"), "spam");
    await user.click(within(dialog).getByRole("button", { name: "Time out" }));
    await within(dialog).findByText("Timeout set.");
    expect(bodyOf(fetchMock, "POST /api/v1/moderation/users/u2/timeout")).toEqual({ auth_token: "tok", duration_minutes: 1440, reason: "spam" });
  });

  it("bans, and shows who is banned from the audit log with an unban button", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({
      "POST /api/v1/moderation/users/u2/ban": jsonResponse({ target_user_id: "u2" }, 201),
      "DELETE /api/v1/moderation/users/u3/ban": { status_code: 200 },
      "POST /api/v1/system/recent-activity": audit([{ type: "user_banned", timestamp: "2030-01-01T00:00:00Z", metadata: { target_user_id: "u3" } }]),
    });
    renderPanel("members");

    expect(await screen.findByText("Banned")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unban linus" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Unban" }));
    await waitFor(() => expect(requestLog(fetchMock)).toContain("DELETE /api/v1/moderation/users/u3/ban"));
  });

  it("filters by name", async () => {
    const user = userEvent.setup();
    backend();
    renderPanel("members");
    await user.type(await screen.findByLabelText("Search members"), "lin");
    expect(screen.queryByText("grace")).not.toBeInTheDocument();
    expect(screen.getByText("linus")).toBeInTheDocument();
  });
});

describe("reports", () => {
  const report = {
    id: "r1",
    type: "user_report",
    status: "pending",
    category: "Harassment",
    description: "Kept pinging me",
    reporter: { id: "u3", username: "linus" },
    reported_at: "2030-01-02T10:00:00Z",
    target_user: { id: "u2", username: "grace" },
  };
  const reportRoutes = (extra: Record<string, unknown> = {}) => ({
    "POST /api/v1/moderation/reports": { reports: [report, { ...report, id: "r2", status: "resolved", category: "Spam" }] },
    "POST /api/v1/blocked-ips/list": { blocked_ips: [{ ip: "203.0.113.7", reason: "scraping", blocked_at: "2030-01-01T00:00:00Z", attempts: 4 }] },
    ...extra,
  });

  it("shows pending reports first and dismisses one", async () => {
    const user = userEvent.setup();
    const fetchMock = backend(reportRoutes({ "POST /api/v1/moderation/reports/r1/resolve": { status_code: 200 } }));
    renderPanel("reports");

    expect(await screen.findByText("Harassment")).toBeInTheDocument();
    expect(screen.queryByText("Spam")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(bodyOf(fetchMock, "POST /api/v1/moderation/reports/r1/resolve")).toEqual({ auth_token: "tok", action: "dismissed" }));
  });

  it("times out the reported person, then resolves the report", async () => {
    const user = userEvent.setup();
    const fetchMock = backend(
      reportRoutes({
        "POST /api/v1/moderation/users/u2/timeout": jsonResponse({}, 201),
        "POST /api/v1/moderation/reports/r1/resolve": { status_code: 200 },
      }),
    );
    renderPanel("reports");

    await user.click(await screen.findByRole("button", { name: "Time out 1 hour" }));
    await waitFor(() => expect(bodyOf(fetchMock, "POST /api/v1/moderation/reports/r1/resolve")).toMatchObject({ action: "timed_out" }));
    expect(bodyOf(fetchMock, "POST /api/v1/moderation/users/u2/timeout")).toMatchObject({ duration_minutes: 60 });
  });

  it("lists resolved reports under a filter", async () => {
    const user = userEvent.setup();
    backend(reportRoutes());
    renderPanel("reports");
    await user.click(await screen.findByRole("button", { name: "Resolved" }));
    expect(await screen.findByText("Spam")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("blocks and unblocks IP addresses", async () => {
    const user = userEvent.setup();
    const fetchMock = backend(reportRoutes({ "POST /api/v1/blocked-ips/block": jsonResponse({}, 201), "POST /api/v1/blocked-ips/unblock": { status_code: 200 } }));
    renderPanel("reports");

    expect(await screen.findByText("203.0.113.7")).toBeInTheDocument();
    await user.type(screen.getByLabelText("IP address"), "198.51.100.2");
    await user.type(screen.getAllByLabelText("Reason")[0]!, "abuse");
    await user.click(screen.getByRole("button", { name: "Block" }));
    await waitFor(() => expect(bodyOf(fetchMock, "POST /api/v1/blocked-ips/block")).toEqual({ auth_token: "tok", ip: "198.51.100.2", reason: "abuse" }));

    await user.click(screen.getByRole("button", { name: "Unblock 203.0.113.7" }));
    await waitFor(() => expect(bodyOf(fetchMock, "POST /api/v1/blocked-ips/unblock")).toEqual({ auth_token: "tok", ip: "203.0.113.7" }));
  });
});

describe("audit log", () => {
  const entries = [
    { type: "role_created", title: "Role Helper created", timestamp: "2030-01-02T10:00:00Z", user: { id: "me", username: "ada" }, metadata: { role_id: "helper" } },
    { type: "user_banned", title: "User grace banned", timestamp: "2030-01-03T10:00:00Z", user: { id: "u9", username: "mod" }, metadata: { reason: "spam" } },
  ];

  it("lists entries newest first with their details", async () => {
    backend({ "POST /api/v1/system/recent-activity": audit(entries) });
    renderPanel("audit");

    await screen.findByText("2 entries");
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]!).getByText("User grace banned")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("reason: spam")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Role Helper created")).toBeInTheDocument();
  });

  it("filters by person, action and date, and clears the filters", async () => {
    const user = userEvent.setup();
    backend({ "POST /api/v1/system/recent-activity": audit(entries) });
    renderPanel("audit");
    await screen.findByText("2 entries");

    await user.selectOptions(screen.getByLabelText("Person"), "mod");
    expect(screen.getByText("1 entry")).toBeInTheDocument();
    expect(screen.queryByText("Role Helper created")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.selectOptions(screen.getByLabelText("Action"), "role_created");
    expect(screen.getByText("1 entry")).toBeInTheDocument();
    expect(screen.queryByText("User grace banned")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.type(screen.getByLabelText("From"), "2030-01-03");
    expect(screen.getByText("1 entry")).toBeInTheDocument();
    expect(screen.getByText("User grace banned")).toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    backend({ "POST /api/v1/system/recent-activity": audit(entries) });
    renderPanel("audit");
    await screen.findByText("2 entries");
    await user.type(screen.getByLabelText("To"), "2029-12-31");
    expect(await screen.findByText("Nothing matches")).toBeInTheDocument();
  });
});
