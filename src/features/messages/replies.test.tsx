import type { ReactNode } from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageCommandsContext } from "../realtime/commandsContext";
import type { MessageCommands } from "../realtime/messageCommands";
import { userKeys } from "../users/hooks";
import { flattenMessages, messageKeys, type MessageCache } from "./cache";
import { continuesGroup } from "./grouping";
import { useSendMessage } from "./hooks";
import { messageFromView, normalizeMessage, replyFromWire } from "./normalize";
import type { Message, ReplyPreview } from "./types";
import { sendMessage } from "./api";
import { toPlainText } from "../../lib/markdown";
import { jsonResponse, mockFetch, signIn } from "../../test/helpers";
import { MessageItem } from "../../components/dashboard/MessageItem";
import { Composer } from "../../components/dashboard/Composer";

const wirePreview = {
  message_id: "orig",
  author_id: "u-grace",
  author_name: "grace",
  author_avatar_url: null,
  content: "the **original** ||secret||",
  has_attachments: false,
  deleted: false,
};

const preview: ReplyPreview = {
  id: "orig",
  authorId: "u-grace",
  authorName: "grace",
  authorAvatarUrl: null,
  text: "the **original** ||secret||",
  hasAttachments: false,
  deleted: false,
};

const message = (overrides: Partial<Message> = {}): Message => ({
  id: "m1",
  channelId: "c1",
  authorId: "u-ada",
  authorName: "ada",
  authorAvatarUrl: null,
  text: "agreed",
  sentAt: "2030-01-01T12:00:00Z",
  attachments: [],
  reactions: [],
  editCount: 0,
  editedAt: null,
  ...overrides,
});

describe("reading replies off the wire", () => {
  it("maps the preview from both message shapes", () => {
    const history = normalizeMessage({ message_id: "m1", sent_at: "t", reply_to_message_id: "orig", reply_to: wirePreview });
    const live = messageFromView({ id: "m1", created_at: "t", reply_to_message_id: "orig", reply_to: wirePreview });
    expect(history.replyTo).toEqual(preview);
    expect(live?.replyTo).toEqual(preview);
  });

  it("leaves plain messages without a replyTo key", () => {
    expect("replyTo" in normalizeMessage({ message_id: "m1", sent_at: "t", reply_to_message_id: null, reply_to: null })).toBe(false);
  });

  it("treats a reply whose preview is missing or deleted as deleted", () => {
    expect(replyFromWire(null, "orig")).toMatchObject({ id: "orig", deleted: true });
    expect(replyFromWire({ message_id: "orig", deleted: true }, "orig")).toMatchObject({ id: "orig", deleted: true });
  });
});

describe("toPlainText", () => {
  it("drops formatting and keeps spoilers hidden", () => {
    expect(toPlainText("the **original**\n> quoted ||secret||")).toBe("the original quoted ██████");
  });
});

describe("grouping", () => {
  it("starts a new group for a reply even from the same author", () => {
    const first = message({ id: "a" });
    expect(continuesGroup(first, message({ id: "b", sentAt: "2030-01-01T12:00:30Z" }))).toBe(true);
    expect(continuesGroup(first, message({ id: "b", sentAt: "2030-01-01T12:00:30Z", replyTo: preview }))).toBe(false);
  });
});

describe("sending a reply", () => {
  it("adds reply_to_message_id to the upload form", async () => {
    signIn("tok");
    const fetchMock = mockFetch(jsonResponse({ message_data: { message_id: "n", sent_at: "t" } }));
    await sendMessage("c1", { text: "x", replyToMessageId: "orig" });
    expect((fetchMock.mock.calls[0]![1]!.body as FormData).get("reply_to_message_id")).toBe("orig");
  });

  it("sends the target over the socket and shows the preview on the pending row", async () => {
    const client = new QueryClient();
    client.setQueryData(userKeys.profile, { user_id: "u-ada", username: "ada" });
    client.setQueryData<MessageCache>(messageKeys.channel("c1"), { pageParams: [null], pages: [{ messages: [], nextCursor: null }] });
    const commands = { createMessage: vi.fn(() => new Promise(() => undefined)), editMessage: vi.fn(), deleteMessage: vi.fn(), setReaction: vi.fn() };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <MessageCommandsContext.Provider value={commands as unknown as MessageCommands}>{children}</MessageCommandsContext.Provider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });
    await act(() => result.current.send({ text: "agreed", replyTo: preview }));

    expect(commands.createMessage).toHaveBeenCalledWith(expect.objectContaining({ content: "agreed", replyToMessageId: "orig" }));
    const [pending] = flattenMessages(client.getQueryData<MessageCache>(messageKeys.channel("c1")));
    expect(pending).toMatchObject({ status: "pending", replyTo: preview });
  });
});

describe("a reply in the message list", () => {
  const handlers = () => ({ onEdit: vi.fn(), onDelete: vi.fn(), onToggleReaction: vi.fn() });

  it("shows who and what it answers, without giving away spoilers, and jumps there on click", async () => {
    const onJumpTo = vi.fn();
    render(<MessageItem message={message({ replyTo: preview })} myUserId="someone" onJumpTo={onJumpTo} {...handlers()} />);

    const line = screen.getByRole("button", { name: /^Replying to grace/ });
    expect(line).toHaveTextContent("grace");
    expect(line).toHaveTextContent("the original ██████");
    expect(line).not.toHaveTextContent("secret");

    await userEvent.click(line);
    expect(onJumpTo).toHaveBeenCalledWith("orig");
  });

  it("says when the original is gone", () => {
    render(<MessageItem message={message({ replyTo: { ...preview, deleted: true } })} myUserId="someone" {...handlers()} />);
    expect(screen.getByText("Original message was deleted")).toBeInTheDocument();
  });

  it("offers attachments when the original had no text", () => {
    render(<MessageItem message={message({ replyTo: { ...preview, text: "", hasAttachments: true } })} myUserId="someone" {...handlers()} />);
    expect(screen.getByText("Click to see attachment")).toBeInTheDocument();
  });

  it("tints replies to my messages", () => {
    const { container } = render(<MessageItem message={message({ replyTo: preview })} myUserId="u-grace" {...handlers()} />);
    expect(container.querySelector("article")?.className).toContain("bg-primary/[0.06]");
  });

  it("has a Reply button in the toolbar", async () => {
    const onReply = vi.fn();
    render(<MessageItem message={message()} myUserId="someone" onReply={onReply} {...handlers()} />);
    await userEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(onReply).toHaveBeenCalledWith("m1");
  });
});

describe("the composer while replying", () => {
  let onCancelReply: ReturnType<typeof vi.fn<() => void>>;
  beforeEach(() => {
    onCancelReply = vi.fn<() => void>();
    render(<Composer channelName="general" replyingTo={{ id: "orig", authorName: "grace" }} onCancelReply={onCancelReply} onSend={vi.fn()} />);
  });

  it("says who is being answered and focuses the field", () => {
    expect(screen.getByText("grace").parentElement).toHaveTextContent("Replying to grace");
    expect(screen.getByLabelText("Message #general")).toHaveFocus();
  });

  it("cancels with the × button or Escape", async () => {
    await userEvent.click(screen.getByRole("button", { name: "Cancel reply" }));
    screen.getByLabelText("Message #general").focus();
    await userEvent.keyboard("{Escape}");
    expect(onCancelReply).toHaveBeenCalledTimes(2);
  });
});
