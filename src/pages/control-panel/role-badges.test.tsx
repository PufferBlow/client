import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { stubXhrOverFetch } from "../../test/xhrOverFetch";
import { ControlPanelPage } from "./ControlPanelPage";

beforeEach(() => {
  signIn("tok");
  stubXhrOverFetch();
});

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

const roles = [
  { role_id: "owner", role_name: "Owner", privileges_ids: ["manage_server_settings"], is_system: true, user_count: 1, badge: { tier: "staff", tone: "brass", glyph: "crown" } },
  { role_id: "user", role_name: "Regular User", privileges_ids: [], is_system: true, user_count: 2, badge: null },
  { role_id: "coach", role_name: "Coach", privileges_ids: ["mute_users"], is_system: false, user_count: 0, badge: { tier: "community", tone: "violet", glyph: "target" } },
  { role_id: "plain", role_name: "Plain", privileges_ids: [], is_system: false, user_count: 0, badge: null },
];
const privileges = [
  { privilege_id: "ban_users", privilege_name: "Ban users", category: "moderation" },
  { privilege_id: "mute_users", privilege_name: "Mute users", category: "moderation" },
  { privilege_id: "send_messages", privilege_name: "Send messages", category: "message_management" },
];

const backend = (extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: owner },
    "GET /api/v1/system/server-info": { server_info: { server_id: "localhost:7575", server_name: "Test", version: "1", avatar_url: null, banner_url: null, members_count: 1, online_members: 1 } },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "POST /api/v1/channels/list/": { channels: [] },
    "GET /api/v1/users/list": { users: [owner] },
    "POST /api/v1/system/roles/list": { roles },
    "POST /api/v1/system/privileges/list": { privileges },
    ...extra,
  });

const renderRoles = () => renderWithProviders(<ControlPanelPage />, { route: "/control-panel/roles", path: "/control-panel/:section?" });

const bodyOf = (fetchMock: ReturnType<typeof routeFetch>, route: string) => {
  const call = fetchMock.mock.calls.find(([input, init]) => `${init?.method ?? "GET"} ${new URL(String(input)).pathname}` === route);
  return call ? (JSON.parse(String(call[1]!.body)) as Record<string, unknown>) : undefined;
};

describe("role badges in the roles page", () => {
  it("draws each role's badge in the list, and a dot for one without", async () => {
    backend();
    renderRoles();
    await screen.findByText("4 roles");
    const owner = screen.getByRole("button", { name: /^Owner/ });
    expect(owner.querySelector("svg")).toHaveAttribute("data-tier", "staff");
    expect(screen.getByRole("button", { name: /^Coach/ }).querySelector("svg")).toHaveAttribute("data-tier", "community");
    expect(screen.getByRole("button", { name: /^Plain/ }).querySelector("svg")).toBeNull();
  });

  it("shows a built-in badge but does not let it be changed", async () => {
    const user = userEvent.setup();
    backend();
    renderRoles();
    await user.click(await screen.findByRole("button", { name: /^Owner/ }));
    const section = screen.getByRole("region", { name: "Role badge" });
    expect(within(section).getByRole("img", { name: "Owner badge" })).toBeInTheDocument();
    expect(within(section).getByText(/Built-in badges cannot be changed/)).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Glyph: crown" })).not.toBeInTheDocument();
  });

  it("creates a role with a badge started from a preset, with the preset's name filled in", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "POST /api/v1/system/roles": jsonResponse({ role: { ...roles[2], role_id: "coach-2" } }, 201) });
    renderRoles();

    await user.click(await screen.findByRole("button", { name: "New role" }));
    const section = screen.getByRole("region", { name: "Role badge" });
    await user.click(within(section).getByRole("button", { name: "Has a badge" }));
    await user.click(within(section).getByRole("button", { name: "Start from Coach" }));
    expect(screen.getByLabelText("Role name")).toHaveValue("Coach");
    expect(within(section).getByRole("button", { name: "Glyph: target" })).toHaveAttribute("aria-pressed", "true");
    expect(within(section).getByRole("button", { name: "Badge colour: violet" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(section).getByRole("button", { name: "Badge colour: sage" }));
    await user.click(within(section).getByRole("button", { name: "Glyph: trophy" }));
    await user.click(screen.getByRole("button", { name: "Create role" }));
    await waitFor(() =>
      expect(bodyOf(fetchMock, "POST /api/v1/system/roles")).toEqual({
        auth_token: "tok",
        role_name: "Coach",
        privileges_ids: [],
        badge: { tier: "community", tone: "sage", glyph: "trophy" },
      }),
    );
  });

  it("shows the badge at every size and as a tag, as it is being made", async () => {
    const user = userEvent.setup();
    backend();
    renderRoles();
    await user.click(await screen.findByRole("button", { name: "New role" }));
    await user.type(screen.getByLabelText("Role name"), "Clip judge");
    await user.click(screen.getByRole("button", { name: "Has a badge" }));

    const chat = screen.getByLabelText("Preview in chat");
    expect(chat.querySelector("svg")).toHaveAttribute("width", "16");
    for (const size of ["64", "32", "20", "16"]) expect(screen.getAllByText(size).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clip judge").length).toBeGreaterThan(0); // the tag
  });

  it("offers the staff shape only once the role has a moderation permission", async () => {
    const user = userEvent.setup();
    backend();
    renderRoles();
    await user.click(await screen.findByRole("button", { name: "New role" }));
    const section = screen.getByRole("region", { name: "Role badge" });
    await user.click(within(section).getByRole("button", { name: "Has a badge" }));
    await user.click(within(section).getByRole("button", { name: "Staff" }));
    expect(within(section).getByText(/needs a moderation permission/)).toBeInTheDocument();

    await user.click(screen.getByLabelText("Mute users"));
    expect(within(section).queryByText(/needs a moderation permission/)).not.toBeInTheDocument();
    expect(within(section).getByText(/Spined shape/)).toBeInTheDocument();
  });

  it("changes a badge, and sends nothing about it when it was not touched", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "PUT /api/v1/system/roles/coach": { role: roles[2] } });
    renderRoles();

    await user.click(await screen.findByRole("button", { name: /^Coach/ }));
    expect(screen.getByRole("button", { name: "Save role" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Glyph: star" }));
    await user.click(screen.getByRole("button", { name: "Save role" }));
    await screen.findByText("Role saved.");
    expect(bodyOf(fetchMock, "PUT /api/v1/system/roles/coach")).toEqual({
      auth_token: "tok",
      role_name: "Coach",
      privileges_ids: ["mute_users"],
      badge: { tier: "community", tone: "violet", glyph: "star" },
    });
  });

  it("takes a badge off", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({ "PUT /api/v1/system/roles/coach": { role: { ...roles[2], badge: null } } });
    renderRoles();
    await user.click(await screen.findByRole("button", { name: /^Coach/ }));
    await user.click(screen.getByRole("button", { name: "No badge" }));
    await user.click(screen.getByRole("button", { name: "Save role" }));
    await screen.findByText("Role saved.");
    expect(bodyOf(fetchMock, "PUT /api/v1/system/roles/coach")).toEqual({ auth_token: "tok", role_name: "Coach", privileges_ids: ["mute_users"], remove_badge: true });
  });

  it("uploads a picture for the badge and uses it", async () => {
    const user = userEvent.setup();
    const fetchMock = backend({
      "POST /api/v1/system/role-badge-images": jsonResponse({ url: "/storage/abc" }, 201),
      "PUT /api/v1/system/roles/coach": { role: roles[2] },
    });
    renderRoles();
    await user.click(await screen.findByRole("button", { name: /^Coach/ }));
    await user.upload(screen.getByLabelText("Badge picture file"), new File([new Uint8Array(1000)], "badge.png", { type: "image/png" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Upload an image" })).toHaveAttribute("aria-pressed", "true"));

    await user.click(screen.getByRole("button", { name: "Save role" }));
    await screen.findByText("Role saved.");
    expect(bodyOf(fetchMock, "PUT /api/v1/system/roles/coach")?.badge).toEqual({ tier: "community", tone: "violet", glyph: "image", image_url: "/storage/abc" });
  });

  it("refuses a picture that is not a PNG or is too big, before sending it", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const fetchMock = backend();
    renderRoles();
    await user.click(await screen.findByRole("button", { name: /^Coach/ }));
    await user.upload(screen.getByLabelText("Badge picture file"), new File([new Uint8Array(100)], "badge.gif", { type: "image/gif" }));
    expect(await screen.findByText("A badge picture must be a PNG.")).toBeInTheDocument();
    await user.upload(screen.getByLabelText("Badge picture file"), new File([new Uint8Array(300 * 1024)], "big.png", { type: "image/png" }));
    expect(await screen.findByText("The picture is larger than 256 KB.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("role-badge-images"))).toBe(false);
  });
});
