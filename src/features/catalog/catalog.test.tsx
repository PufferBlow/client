import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmojiPickerPopover } from "../../components/ui/EmojiPickerPopover";
import { EmojiText } from "../../components/ui/Emoji";
import { replaceShortcodes } from "../../lib/shortcodes";
import { ControlPanelPage } from "../../pages/control-panel/ControlPanelPage";
import { routeFetch, signIn } from "../../test/helpers";
import { stubXhrOverFetch } from "../../test/xhrOverFetch";
import { renderWithProviders } from "../../test/render";
import type { CatalogItem } from "./api";
import { CustomEmojiContext, type CustomEmojiIndex } from "./customEmojiContext";

// emoji-mart needs real image decoding and a sprite sheet; the tabs are what is under test here.
vi.mock("../../components/ui/EmojiPicker", () => ({ default: () => <div data-testid="emoji-grid" /> }));

beforeEach(() => {
  signIn("tok");
  stubXhrOverFetch();
});

const item = (over: Partial<CatalogItem>): CatalogItem => ({
  sticker_id: "s1",
  sticker_url: "/storage/aaa",
  filename: "a.png",
  display_name: "Thing",
  alias: null,
  kind: "sticker",
  is_active: true,
  ...over,
});

const parrot = item({ sticker_id: "e1", sticker_url: "/storage/parrot", display_name: "Party parrot", alias: "party_parrot", kind: "emoji" });
const hello = item({ sticker_id: "s9", sticker_url: "/storage/hello", display_name: "Big hello", alias: null, kind: "sticker" });
const old = item({ sticker_id: "s0", display_name: "From an old instance", kind: undefined });

const index = (items: CatalogItem[]): CustomEmojiIndex => ({
  byAlias: new Map(items.filter((i) => i.kind === "emoji" && i.alias).map((i) => [i.alias!, i])),
  byId: new Map(items.map((i) => [i.sticker_id, i])),
});

describe("custom emoji in text", () => {
  it("draws a known :shortcode: as its picture and leaves unknown ones alone", () => {
    render(
      <CustomEmojiContext.Provider value={index([parrot])}>
        <p data-testid="line">
          <EmojiText text="hi :party_parrot: and :nothing_like_it: ok" />
        </p>
      </CustomEmojiContext.Provider>,
    );
    const line = screen.getByTestId("line");
    expect(within(line).getByRole("img", { name: ":party_parrot:" })).toHaveAttribute("src", expect.stringContaining("/storage/parrot"));
    expect(line.textContent).toContain(":nothing_like_it:");
    expect(line.textContent).not.toContain(":party_parrot:");
  });

  it("is plain text when the instance has no custom emoji", () => {
    render(
      <p data-testid="line">
        <EmojiText text="hi :party_parrot:" />
      </p>,
    );
    expect(screen.getByTestId("line")).toHaveTextContent("hi :party_parrot:");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not turn a shortcode glued to a word into a picture", () => {
    render(
      <CustomEmojiContext.Provider value={index([parrot])}>
        <p data-testid="line">
          <EmojiText text="a:party_parrot:b" />
        </p>
      </CustomEmojiContext.Provider>,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps the instance's own shortcodes out of the unicode replacement", () => {
    expect(replaceShortcodes("nice :tada: :party_parrot:")).toContain("🎉");
    expect(replaceShortcodes("nice :tada:", new Set(["tada"]))).toBe("nice :tada:");
    expect(replaceShortcodes("nice :tada: and :+1:", new Set(["tada"]))).toBe("nice :tada: and 👍");
  });
});

describe("the picker's custom and sticker tabs", () => {
  const catalog = () => routeFetch({ "GET /api/v1/stickers": { stickers: [parrot, hello, old] } });

  it("offers no extra tabs when nothing can use them", () => {
    catalog();
    renderWithProviders(<EmojiPickerPopover x={10} y={10} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("lists the custom emoji and picks one", async () => {
    const user = userEvent.setup();
    catalog();
    const onCustom = vi.fn();
    renderWithProviders(<EmojiPickerPopover x={10} y={10} onSelect={vi.fn()} onCustom={onCustom} onSticker={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: "Custom" }));
    expect(await screen.findByRole("button", { name: ":party_parrot:" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Big hello" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: ":party_parrot:" }));
    expect(onCustom).toHaveBeenCalledWith(expect.objectContaining({ sticker_id: "e1" }));
  });

  it("lists the stickers (an old instance's rows are stickers) and picks one", async () => {
    const user = userEvent.setup();
    catalog();
    const onSticker = vi.fn();
    renderWithProviders(<EmojiPickerPopover x={10} y={10} onSelect={vi.fn()} onCustom={vi.fn()} onSticker={onSticker} onClose={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: "Stickers" }));
    expect(await screen.findByRole("button", { name: "Big hello" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "From an old instance" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ":party_parrot:" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Big hello" }));
    expect(onSticker).toHaveBeenCalledWith(expect.objectContaining({ sticker_id: "s9" }));
  });

  it("searches by name or shortcode, and says when there is none", async () => {
    const user = userEvent.setup();
    routeFetch({ "GET /api/v1/stickers": { stickers: [parrot] } });
    renderWithProviders(<EmojiPickerPopover x={10} y={10} onSelect={vi.fn()} onCustom={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: "Custom" }));
    await screen.findByRole("button", { name: ":party_parrot:" });
    await user.type(screen.getByLabelText("Search custom emoji"), ":parr");
    expect(screen.getByRole("button", { name: ":party_parrot:" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search custom emoji"));
    await user.type(screen.getByLabelText("Search custom emoji"), "zzz");
    expect(screen.queryByRole("button", { name: ":party_parrot:" })).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("says there are none yet, and who can add them", async () => {
    const user = userEvent.setup();
    routeFetch({ "GET /api/v1/stickers": { stickers: [] } });
    renderWithProviders(<EmojiPickerPopover x={10} y={10} onSelect={vi.fn()} onCustom={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: "Custom" }));
    expect(await screen.findByText("No custom emoji yet")).toBeInTheDocument();
  });
});

describe("the control panel's emoji and stickers", () => {
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
  const backend = (stickers: CatalogItem[], extra: Record<string, unknown> = {}) =>
    routeFetch({
      "POST /api/v1/users/profile": { user_data: owner },
      "GET /api/v1/system/server-info": { server_info: { server_id: "localhost:7575", server_name: "Test", version: "1", avatar_url: null, banner_url: null, members_count: 1, online_members: 1 } },
      "GET /api/v1/channels/read-history": { unread_counts: {} },
      "POST /api/v1/channels/list/": { channels: [] },
      "GET /api/v1/users/list": { users: [owner] },
      "GET /api/v1/stickers/all": { stickers },
      ...extra,
    });
  const renderPanel = () => renderWithProviders(<ControlPanelPage />, { route: "/control-panel/emoji", path: "/control-panel/:section?" });

  it("is in the navigation under Community and lists the emoji, then the stickers", async () => {
    const user = userEvent.setup();
    backend([parrot, hello, { ...old, is_active: false }]);
    renderPanel();

    const nav = await screen.findByRole("navigation", { name: "Control panel sections" });
    expect(within(nav).getByRole("link", { name: /Emoji & stickers/ })).toBeInTheDocument();

    expect(await screen.findByText("Party parrot")).toBeInTheDocument();
    expect(screen.getByText(":party_parrot:")).toBeInTheDocument();
    expect(screen.queryByText("Big hello")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Stickers/ }));
    expect(await screen.findByText("Big hello")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("adds an emoji with the name and shortcode taken from the file", async () => {
    const user = userEvent.setup();
    const fetchMock = backend([], { "POST /api/v1/stickers": { sticker: parrot } });
    renderPanel();

    await screen.findByText("No custom emoji yet");
    await user.upload(screen.getByLabelText("Emoji file"), new File([new Uint8Array(2048)], "Party Parrot.gif", { type: "image/gif" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Party Parrot");
    expect(screen.getByLabelText("Shortcode")).toHaveValue("party_parrot");

    await user.click(screen.getByRole("button", { name: "Add emoji" }));
    await screen.findByText("Added the emoji.");
    const call = fetchMock.mock.calls.find(([input, init]) => new URL(String(input)).pathname === "/api/v1/stickers" && init?.method === "POST")!;
    const form = call[1]!.body as FormData;
    expect(form.get("kind")).toBe("emoji");
    expect(form.get("alias")).toBe("party_parrot");
    expect(form.get("display_name")).toBe("Party Parrot");
    expect((form.get("file") as File).name).toBe("Party Parrot.gif");
  });

  it("refuses a picture over the limit and a shortcode that cannot be typed", async () => {
    const user = userEvent.setup();
    backend([]);
    renderPanel();
    await screen.findByText("No custom emoji yet");

    await user.upload(screen.getByLabelText("Emoji file"), new File([new Uint8Array(600 * 1024)], "big.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/most is 512 KB/);

    await user.upload(screen.getByLabelText("Emoji file"), new File([new Uint8Array(100)], "ok.png", { type: "image/png" }));
    await user.clear(screen.getByLabelText("Shortcode"));
    await user.type(screen.getByLabelText("Shortcode"), "No Good!");
    expect(await screen.findByText("2 to 32 lowercase letters, digits or underscores.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add emoji" })).toBeDisabled();
  });

  it("hides and deletes (after asking)", async () => {
    const user = userEvent.setup();
    const fetchMock = backend([parrot], {
      "PATCH /api/v1/stickers/e1": { sticker: { ...parrot, is_active: false } },
      "DELETE /api/v1/stickers/e1": { status_code: 200, deleted: true },
    });
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Hide Party parrot" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) => init?.method === "PATCH" && String(input).includes("/api/v1/stickers/e1"))).toBe(true));
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ is_active: false });

    await user.click(screen.getByRole("button", { name: "Delete Party parrot" }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Confirm deleting Party parrot" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true));
  });
});
