import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { jsonResponse, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ControlPanelPage } from "./ControlPanelPage";

beforeEach(() => signIn("tok"));

const owner = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "x", roles_ids: ["owner"] };
const channels = [
  { channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "2030-01-02T00:00:00Z", category_id: "info" },
  { channel_id: "c2", channel_name: "rules", channel_type: "text", is_private: false, created_at: "2030-01-02T00:00:00Z", category_id: "info" },
  { channel_id: "c3", channel_name: "lounge", channel_type: "voice", is_private: false, created_at: "2030-01-02T00:00:00Z" },
];
const categories = [
  { category_id: "info", name: "Information", position: 0 },
  { category_id: "talk", name: "Talk", position: 1 },
];

const backend = (extra: Record<string, unknown> = {}, cats: unknown[] = categories) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: owner },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "Test Server", version: "1" } },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "POST /api/v1/channels/list/": { channels },
    "GET /api/v1/channels/categories": { categories: cats },
    "GET /api/v1/users/list": { users: [owner] },
    ...extra,
  });

const render = () => renderWithProviders(<ControlPanelPage />, { route: "/control-panel/channels", path: "/control-panel/:section?" });
const panel = async () => within(await screen.findByRole("heading", { name: "Categories", level: 2 }).then((h) => h.closest("section")!));
const sent = (fetchMock: ReturnType<typeof routeFetch>, method: string, path: string) =>
  fetchMock.mock.calls.filter(([input, init]) => init?.method === method && new URL(String(input)).pathname === path).map(([, init]) => {
      const { auth_token: _token, ...rest } = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      return rest;
    });

describe("managing categories", () => {
  it("lists them with how many channels each holds, and shows each channel's category", async () => {
    backend();
    render();
    const cats = await panel();

    expect(await cats.findByText("Information")).toBeInTheDocument();
    expect(cats.getByText("2 channels")).toBeInTheDocument();
    expect(cats.getByText("0 channels")).toBeInTheDocument();
    const row = (await screen.findByText("rules")).closest("tr")!;
    expect(within(row).getByText("Information")).toBeInTheDocument();
    expect(within((screen.getByText("lounge").closest("tr"))!).getByText("–")).toBeInTheDocument();
  });

  it("adds one, trimmed", async () => {
    const fetchMock = backend({ "POST /api/v1/channels/categories": { category: { category_id: "n", name: "Clips", position: 2 } } });
    const { user } = render();
    const cats = await panel();

    await user.type(cats.getByLabelText("Category name"), "  Clips  ");
    await user.click(cats.getByRole("button", { name: /Add/ }));

    await waitFor(() => expect(sent(fetchMock, "POST", "/api/v1/channels/categories")).toEqual([{ name: "Clips" }]));
    await waitFor(() => expect(cats.getByLabelText("Category name")).toHaveValue(""));
  });

  it("will not add an empty name", async () => {
    const fetchMock = backend();
    render();
    const cats = await panel();
    expect(cats.getByRole("button", { name: /Add/ })).toBeDisabled();
    expect(sent(fetchMock, "POST", "/api/v1/channels/categories")).toEqual([]);
  });

  it("says why when the name is taken", async () => {
    backend({ "POST /api/v1/channels/categories": jsonResponse({ error_code: "conflict", message: "A category with that name already exists." }, 409) });
    const { user } = render();
    const cats = await panel();

    await user.type(cats.getByLabelText("Category name"), "Talk");
    await user.click(cats.getByRole("button", { name: /Add/ }));

    expect(await cats.findByRole("alert")).toHaveTextContent(/already exists/);
  });

  it("renames in place", async () => {
    const fetchMock = backend({ "PUT /api/v1/channels/categories/info": { category: { category_id: "info", name: "News", position: 0 } } });
    const { user } = render();
    const cats = await panel();

    await user.click(await cats.findByRole("button", { name: "Rename Information" }));
    const field = cats.getByLabelText("New name for Information");
    await user.clear(field);
    await user.type(field, "News");
    await user.click(cats.getByRole("button", { name: "Save name" }));

    await waitFor(() => expect(sent(fetchMock, "PUT", "/api/v1/channels/categories/info")).toEqual([{ name: "News" }]));
  });

  it("moves a category down and sends the new order", async () => {
    const fetchMock = backend({ "PUT /api/v1/channels/categories/order": { categories: [] } });
    const { user } = render();
    const cats = await panel();

    expect(await cats.findByRole("button", { name: "Move Information up" })).toBeDisabled(); // first
    expect(cats.getByRole("button", { name: "Move Talk down" })).toBeDisabled(); // last
    await user.click(cats.getByRole("button", { name: "Move Information down" }));

    await waitFor(() => expect(sent(fetchMock, "PUT", "/api/v1/channels/categories/order")).toEqual([{ category_ids: ["talk", "info"] }]));
  });

  it("asks before deleting, and says its channels stay", async () => {
    const fetchMock = backend({ "DELETE /api/v1/channels/categories/info": { status_code: 200 } });
    const { user } = render();
    const cats = await panel();

    await user.click(await cats.findByRole("button", { name: "Delete Information" }));
    expect(sent(fetchMock, "DELETE", "/api/v1/channels/categories/info")).toEqual([]); // not yet
    await user.click(cats.getByRole("button", { name: "Keep it" }));
    expect(cats.getByRole("button", { name: "Delete Information" })).toHaveAttribute("title", "Its channels stay, uncategorised");

    await user.click(cats.getByRole("button", { name: "Delete Information" }));
    await user.click(cats.getByRole("button", { name: "Confirm deleting Information" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) => init?.method === "DELETE" && String(input).includes("/categories/info"))).toBe(true));
  });

  it("explains when there are none", async () => {
    backend({}, []);
    render();
    const cats = await panel();
    expect(await cats.findByText(/No categories yet/)).toBeInTheDocument();
  });
});
