import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Channel } from "../../features/channels/types";
import { removeMessage, type MessageCache } from "../../features/messages/cache";
import { messageKeys } from "../../features/messages/cache";
import { jsonResponse, requestLog, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import type { MessageCommands } from "../../features/realtime/messageCommands";
import { ChatPanel } from "./ChatPanel";

// emoji-mart needs a real browser; the picker is replaced with one button per emoji we want to pick.
vi.mock("../ui/EmojiPicker", () => ({
  default: ({ onSelect }: { onSelect: (e: { native: string }) => void }) => (
    <div data-testid="picker">
      <button onClick={() => onSelect({ native: "🦄" })}>pick unicorn</button>
    </div>
  ),
}));

beforeEach(() => signIn("tok"));

const channel: Channel = { channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "t" };

const profile = (extra: Record<string, unknown> = {}) => ({
  user_id: "me",
  username: "ada",
  about: null,
  status: "online",
  accent_color: null,
  avatar_url: null,
  origin_server: "localhost:7575",
  resolved_privileges: ["send_messages"],
  ...extra,
});

const msg = (id: string, text: string, overrides: Record<string, unknown> = {}) => ({
  message_id: id,
  channel_id: "c1",
  sender_user_id: "u2",
  sender_username: "grace",
  message: text,
  sent_at: `2030-01-01T10:00:0${id.slice(-1)}Z`,
  ...overrides,
});

// m1 is mine, m2 and m3 are grace's and group together (m3 is a continuation row).
const messages = [msg("m1", "mine", { sender_user_id: "me", sender_username: "ada" }), msg("m2", "second"), msg("m3", "third")];

const backend = (extra: Record<string, unknown> = {}, me = profile(), history = messages) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "S", max_message_length: 2000 } },
    "GET /api/v1/channels/c1/load_messages": { messages: history, next_cursor: null },
    "POST /api/v1/channels/c1/mark_all_read": { status_code: 200 },
    ...extra,
  });

const renderChat = (commands: Partial<MessageCommands> = {}) =>
  renderWithProviders(<ChatPanel channel={channel} />, { route: "/dashboard/channels/c1", path: "*", commands });

const rowOf = (text: string) => screen.getByText(text).closest("article") as HTMLElement;
const rightClick = (text: string, point = { clientX: 40, clientY: 60 }) => fireEvent.contextMenu(rowOf(text), point);
const menu = () => screen.queryByRole("menu", { name: "Message actions" });
const item = (name: string | RegExp) => within(screen.getByRole("menu")).getByRole("menuitem", { name });
const hasItem = (name: string | RegExp) => within(screen.getByRole("menu")).queryByRole("menuitem", { name }) !== null;

/** Open a loaded channel and wait for the history. */
async function open(extra?: Record<string, unknown>, me = profile(), history = messages, commands: Partial<MessageCommands> = {}) {
  const fetchMock = backend(extra, me, history);
  const view = renderChat(commands);
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(history.length));
  // Wait for the profile so permission checks are settled.
  await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/users/profile"));
  await act(async () => {});
  return { fetchMock, ...view };
}

describe("message context menu", () => {
  it("opens on right-click and stops the browser menu", async () => {
    await open();
    expect(menu()).not.toBeInTheDocument();

    const allowedByBrowser = fireEvent.contextMenu(rowOf("second"), { clientX: 40, clientY: 60 });
    expect(allowedByBrowser).toBe(false);
    expect(menu()).toBeInTheDocument();
  });

  it("leaves the browser menu alone on links", async () => {
    await open({}, profile(), [msg("m4", "look", { attachments: [{ url: "https://files.example/x.pdf", filename: "x.pdf", type: "application/pdf" }] })]);
    const allowedByBrowser = fireEvent.contextMenu(screen.getByRole("link", { name: /x\.pdf/ }), { clientX: 5, clientY: 5 });
    expect(allowedByBrowser).toBe(true);
    expect(menu()).not.toBeInTheDocument();
  });

  it("targets a continuation message, not the first message of its group", async () => {
    const { user } = await open();
    // "third" has no avatar or name of its own: it continues grace's group that starts at "second".
    expect(within(rowOf("third")).queryByText("grace")).not.toBeInTheDocument();

    rightClick("third");
    await user.click(item("Copy message ID"));
    expect(await navigator.clipboard.readText()).toBe("m3");

    rightClick("second");
    await user.click(item("Copy message ID"));
    expect(await navigator.clipboard.readText()).toBe("m2");
  });

  it("keeps a single menu aimed at the latest message after rapid right-clicks", async () => {
    const { user } = await open();

    rightClick("mine");
    rightClick("second");
    rightClick("third");
    rightClick("second");
    rightClick("mine");

    expect(screen.getAllByRole("menu")).toHaveLength(1);
    await user.click(item("Copy message ID"));
    expect(await navigator.clipboard.readText()).toBe("m1");
  });

  it("closes on Escape and on a click outside", async () => {
    const { user } = await open();

    rightClick("second");
    await user.keyboard("{Escape}");
    expect(menu()).not.toBeInTheDocument();

    rightClick("second");
    fireEvent.pointerDown(screen.getByRole("heading", { name: "general" }));
    expect(menu()).not.toBeInTheDocument();
  });

  it("closes when the message list scrolls", async () => {
    await open();
    rightClick("second");
    fireEvent.scroll(rowOf("second").parentElement!.parentElement!);
    expect(menu()).not.toBeInTheDocument();
  });

  it("closes itself if its message disappears underneath it", async () => {
    const { queryClient } = await open();
    rightClick("third");
    expect(menu()).toBeInTheDocument();

    act(() => {
      queryClient.setQueryData<MessageCache>(messageKeys.channel("c1"), (cache) => removeMessage(cache, "m3"));
    });
    await waitFor(() => expect(screen.queryByText("third")).not.toBeInTheDocument());
    expect(menu()).not.toBeInTheDocument();
  });

  describe("which actions appear", () => {
    it("offers edit and delete (not report) on your own message", async () => {
      await open();
      rightClick("mine");

      for (const name of ["Reply", "Copy text", "Copy message ID", "Edit message", "Delete message"]) expect(hasItem(name)).toBe(true);
      expect(hasItem("Report message")).toBe(false);
    });

    it("offers report (not edit or delete) on someone else's message", async () => {
      await open();
      rightClick("second");

      expect(hasItem("Report message")).toBe(true);
      expect(hasItem("Edit message")).toBe(false);
      expect(hasItem("Delete message")).toBe(false);
    });

    it("lets a moderator delete others' messages, but never edit them", async () => {
      await open({}, profile({ resolved_privileges: ["send_messages", "delete_messages"] }));
      rightClick("second");

      expect(hasItem("Delete message")).toBe(true);
      expect(hasItem("Edit message")).toBe(false);
    });

    it("separates the destructive action from the others", async () => {
      await open();
      rightClick("mine");
      const entries = Array.from(screen.getByRole("menu").children);
      const del = entries.findIndex((e) => e.textContent === "Delete message");
      expect(entries[del - 1]).toHaveAttribute("role", "separator");
      expect(del).toBe(entries.length - 1);
    });

    it("does not list actions the app does not support", async () => {
      await open();
      rightClick("mine");
      for (const name of [/pin/i, /forward/i, /unread/i, /link/i]) expect(hasItem(name)).toBe(false);
    });

    it("hides Copy text for a message with no text", async () => {
      await open({}, profile(), [msg("m4", "", { attachments: [{ url: "/storage/a.png", filename: "a.png", type: "image/png" }] })]);
      fireEvent.contextMenu(screen.getByAltText("a.png").closest("article")!, { clientX: 5, clientY: 5 });
      expect(hasItem("Copy text")).toBe(false);
      expect(hasItem("Copy message ID")).toBe(true);
    });
  });

  describe("copying", () => {
    it("copies the message text and confirms it", async () => {
      const { user } = await open();
      rightClick("second");
      await user.click(item("Copy text"));

      expect(await navigator.clipboard.readText()).toBe("second");
      expect(await screen.findByText("Message text copied.")).toBeInTheDocument();
      expect(menu()).not.toBeInTheDocument();
    });

    it("says so when the clipboard is unavailable", async () => {
      const { user } = await open();
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
      rightClick("second");
      await user.click(item("Copy text"));

      expect(await screen.findByText("Couldn't copy to the clipboard.")).toBeInTheDocument();
    });
  });

  describe("reactions", () => {
    it("adds a reaction to the exact message from the menu", async () => {
      const setReaction = vi.fn().mockResolvedValue([{ emoji: "puff:happy", count: 1, userIds: ["me"] }]);
      const { user } = await open({}, profile(), messages, { setReaction });
      rightClick("third");
      await user.click(item("Add Happy reaction"));

      await waitFor(() => expect(setReaction).toHaveBeenCalledWith("c1", "m3", "puff:happy", true));
      expect(await screen.findByRole("button", { name: "Happy reaction, 1" })).toBeInTheDocument();
    });

    it("shows a notice when a reaction fails", async () => {
      const { user } = await open({}, profile(), messages, { setReaction: vi.fn().mockRejectedValue(new Error("boom")) });
      rightClick("second");
      await user.click(item("Add Puffed reaction"));

      expect(await screen.findByRole("status")).toHaveTextContent(/./);
    });
  });

  describe("emoji picker", () => {
    it("opens from 'More reactions…' and reacts to the right message", async () => {
      const setReaction = vi.fn().mockResolvedValue([{ emoji: "🦄", count: 1, userIds: ["me"] }]);
      const { user } = await open({}, profile(), messages, { setReaction });
      rightClick("third");
      await user.click(item("More reactions…"));

      expect(menu()).not.toBeInTheDocument();
      await user.click(await screen.findByRole("button", { name: "pick unicorn" }));

      await waitFor(() => expect(setReaction).toHaveBeenCalledWith("c1", "m3", "🦄", true));
      expect(screen.queryByTestId("picker")).not.toBeInTheDocument();
    });

    it("opens from the Add reaction button on the message toolbar", async () => {
      const { user } = await open();
      await user.click(within(rowOf("second")).getByRole("button", { name: "Add reaction" }));
      expect(await screen.findByRole("dialog", { name: "Choose an emoji" })).toBeInTheDocument();
    });

    it("closes on Escape without reacting", async () => {
      const { user, fetchMock } = await open();
      await user.click(within(rowOf("second")).getByRole("button", { name: "Add reaction" }));
      await screen.findByTestId("picker");
      await user.keyboard("{Escape}");

      expect(screen.queryByTestId("picker")).not.toBeInTheDocument();
      expect(requestLog(fetchMock).some((r) => r.includes("reactions"))).toBe(false);
    });

    it("draws emoji in message text, reactions and the menu as Twemoji", async () => {
      const { user } = await open({}, profile(), [
        msg("m4", "party 🎉 time", { reactions: [{ emoji: "😂", count: 2, user_ids: ["u9"] }] }),
      ]);
      expect(screen.getAllByAltText("🎉").length).toBeGreaterThan(0);
      expect(within(screen.getByText("party").closest("p")!).getByAltText("🎉")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /😂\s*2/ })).toBeInTheDocument();

      fireEvent.contextMenu(rowOf("party"), { clientX: 5, clientY: 5 });
      // The menu offers the puff faces, never plain emoji.
      expect(within(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Add Happy reaction" })).getByAltText("Happy")).toBeInTheDocument();
      expect(within(screen.getByRole("menu")).queryByRole("menuitem", { name: /❤|👍/ })).not.toBeInTheDocument();
      await user.keyboard("{Escape}");
    });
  });

  describe("editing", () => {
    it("starts editing the right message", async () => {
      const { user } = await open();
      rightClick("mine");
      await user.click(item("Edit message"));

      const input = await screen.findByRole("textbox", { name: "Edit message" });
      expect(input).toHaveValue("mine");
      expect(within(rowOf("second")).queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  describe("deleting", () => {
    it("asks for confirmation, and cancelling changes nothing", async () => {
      const { user, fetchMock } = await open();
      rightClick("mine");
      await user.click(item("Delete message"));

      expect(await screen.findByText("Delete message?")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByText("Delete message?")).not.toBeInTheDocument();
      expect(screen.getByText("mine")).toBeInTheDocument();
      expect(requestLog(fetchMock).some((r) => r.startsWith("DELETE"))).toBe(false);
    });

    it("deletes exactly the chosen message once confirmed", async () => {
      const deleteMessage = vi.fn().mockResolvedValue(undefined);
      const { user } = await open({}, profile({ resolved_privileges: ["delete_messages"] }), messages, { deleteMessage });
      rightClick("third");
      await user.click(item("Delete message"));
      await user.click(within(await screen.findByText("Delete message?").then((h) => h.parentElement!.parentElement!)).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(screen.queryByText("third")).not.toBeInTheDocument());
      expect(deleteMessage).toHaveBeenCalledWith("c1", "m3");
      expect(screen.getByText("second")).toBeInTheDocument();
    });

    it("keeps the message and shows the server's reason when deleting is refused", async () => {
      const deleteMessage = vi.fn().mockRejectedValue(new Error("You are not authorized to delete this message"));
      const { user } = await open({}, profile({ resolved_privileges: ["delete_messages"] }), messages, { deleteMessage });
      rightClick("second");
      await user.click(item("Delete message"));
      const dialog = (await screen.findByText("Delete message?")).parentElement!.parentElement!;
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));

      expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
      expect(screen.getAllByRole("article", { name: /grace/ })).toHaveLength(2);
    });
  });

  describe("reporting", () => {
    it("sends the chosen reason for the right message", async () => {
      const { user, fetchMock } = await open({ "POST /api/v1/moderation/reports/messages": { status_code: 201 } });
      rightClick("third");
      await user.click(item("Report message"));

      const dialog = (await screen.findByText("Report message", { selector: "h2" })).parentElement!.parentElement!;
      await user.click(within(dialog).getByRole("combobox", { name: "Reason" }));
      await user.click(await screen.findByRole("option", { name: "Harassment" }));
      await user.type(within(dialog).getByLabelText(/details/i), "  rude  ");
      await user.click(within(dialog).getByRole("button", { name: "Send report" }));

      await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/moderation/reports/messages"));
      const call = fetchMock.mock.calls.find(([input]) => String(input).includes("/reports/messages"))!;
      expect(JSON.parse(String(call[1]!.body))).toEqual({ message_ids: ["m3"], category: "harassment", description: "rude", auth_token: "tok" });
      expect(await screen.findByText("Report sent. Thank you.")).toBeInTheDocument();
      expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
    });

    it("shows why a report failed and keeps the dialog open", async () => {
      const { user } = await open({
        "POST /api/v1/moderation/reports/messages": jsonResponse({ error_code: "server.internal_error", message: "boom" }, 500),
      });
      rightClick("second");
      await user.click(item("Report message"));
      await user.click(await screen.findByRole("button", { name: "Send report" }));

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByLabelText("Reason")).toBeInTheDocument();
    });
  });

  describe("without a mouse", () => {
    it("opens from the More actions button, for touch", async () => {
      const { user } = await open();
      const row = within(rowOf("second"));
      await user.click(row.getByRole("button", { name: "More actions" }));

      expect(menu()).toBeInTheDocument();
      await user.click(item("Copy message ID"));
      expect(await navigator.clipboard.readText()).toBe("m2");
    });

    it("opens from the keyboard's context-menu key on a focused message", async () => {
      const { user } = await open();
      rowOf("third").focus();
      await user.keyboard("{ContextMenu}");

      expect(menu()).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Add Puffed reaction" })).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(rowOf("third")).toHaveFocus();
    });

    it("opens with Shift+F10", async () => {
      const { user } = await open();
      rowOf("second").focus();
      await user.keyboard("{Shift>}{F10}{/Shift}");
      expect(menu()).toBeInTheDocument();
    });
  });

  it("ignores right-clicks while a message is being edited", async () => {
    const { user } = await open();
    await user.click(within(rowOf("mine")).getByRole("button", { name: "Edit message" }));
    await screen.findByRole("textbox", { name: "Edit message" });

    const allowed = fireEvent.contextMenu(screen.getByRole("textbox", { name: "Edit message" }), { clientX: 5, clientY: 5 });
    expect(allowed).toBe(true);
    expect(menu()).not.toBeInTheDocument();
  });
});
