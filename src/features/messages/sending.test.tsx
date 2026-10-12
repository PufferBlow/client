import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEvent } from "../realtime/applyEvent";
import { CommandError } from "../realtime/commands";
import { MessageCommandsContext } from "../realtime/commandsContext";
import type { MessageCommands } from "../realtime/messageCommands";
import { userKeys } from "../users/hooks";
import type { UserProfile } from "../users/types";
import { flattenMessages, messageKeys, type MessageCache } from "./cache";
import { useDeleteMessage, useEditMessage, useSendMessage, useToggleReaction } from "./hooks";
import type { Message } from "./types";

const server = (overrides: Partial<Message> = {}): Message => ({
  id: "m_server",
  channelId: "c1",
  authorId: "me",
  authorName: "ada",
  authorAvatarUrl: null,
  text: "hello",
  sentAt: "2030-01-01T10:00:00+00:00",
  attachments: [],
  reactions: [],
  editCount: 0,
  editedAt: null,
  ...overrides,
});

const profile: UserProfile = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "x" };

describe("sending over the protocol", () => {
  let client: QueryClient;
  let commands: { [K in keyof MessageCommands]: ReturnType<typeof vi.fn> };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MessageCommandsContext.Provider value={commands as unknown as MessageCommands}>{children}</MessageCommandsContext.Provider>
    </QueryClientProvider>
  );
  const rows = () => flattenMessages(client.getQueryData<MessageCache>(messageKeys.channel("c1")));

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(userKeys.profile, profile);
    client.setQueryData<MessageCache>(messageKeys.channel("c1"), { pageParams: [null], pages: [{ messages: [], nextCursor: null }] });
    commands = { createMessage: vi.fn(), editMessage: vi.fn(), deleteMessage: vi.fn(), setReaction: vi.fn() };
  });

  it("shows the message as pending at once, then replaces it with the server's copy on the ack", async () => {
    let ack!: (m: Message) => void;
    commands.createMessage.mockReturnValue(new Promise<Message>((resolve) => (ack = resolve)));
    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });

    await act(() => result.current.send({ text: "hello" }));

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ text: "hello", status: "pending", authorId: "me", authorName: "ada" });
    expect(rows()[0]!.id).toMatch(/^local_/);

    await act(async () => ack(server()));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ id: "m_server", text: "hello" });
    expect(rows()[0]!.status).toBeUndefined();
  });

  it("sends a nonce with the command", async () => {
    commands.createMessage.mockResolvedValue(server());
    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });
    await act(() => result.current.send({ text: "hello" }));
    const sent = commands.createMessage.mock.calls[0]![0] as { channelId: string; content: string; nonce: string };
    expect(sent).toMatchObject({ channelId: "c1", content: "hello" });
    expect(sent.nonce).toMatch(/[0-9a-f-]{20,}/);
  });

  it("does not duplicate the row when the broadcast event arrives after the ack", async () => {
    commands.createMessage.mockResolvedValue(server());
    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });
    await act(() => result.current.send({ text: "hello" }));
    await waitFor(() => expect(rows()[0]!.id).toBe("m_server"));

    applyEvent(client, { kind: "message", message: server() }, { activeChannelId: "c1" });
    expect(rows()).toHaveLength(1);
  });

  it("does not duplicate the row when the event arrives before the ack", async () => {
    let ack!: (m: Message) => void;
    commands.createMessage.mockReturnValue(new Promise<Message>((resolve) => (ack = resolve)));
    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });
    await act(() => result.current.send({ text: "hello" }));

    applyEvent(client, { kind: "message", message: server() }, { activeChannelId: "c1" });
    expect(rows()).toHaveLength(2); // the pending copy and the server's, for a moment

    await act(async () => ack(server()));
    expect(rows().map((m) => m.id)).toEqual(["m_server"]);
  });

  it("keeps a failed send in the list with the reason, and retries with the same nonce", async () => {
    commands.createMessage.mockRejectedValueOnce(new CommandError("DISCONNECTED", "dropped", true));
    commands.createMessage.mockResolvedValueOnce(server());
    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });

    await act(() => result.current.send({ text: "hello" }));
    await waitFor(() => expect(rows()[0]!.status).toBe("failed"));
    expect(rows()[0]!.failure).toEqual({ message: "The connection dropped. Retry to send it.", retryable: true });

    const failed = rows()[0]!;
    await act(async () => result.current.retry(failed.id));
    await waitFor(() => expect(rows()[0]!.id).toBe("m_server"));

    expect(commands.createMessage).toHaveBeenCalledTimes(2);
    const [first, second] = commands.createMessage.mock.calls.map((c) => (c[0] as { nonce: string }).nonce);
    expect(second).toBe(first);
    expect(failed.nonce).toBe(first);
    expect(rows()).toHaveLength(1);
  });

  it("shows a pending state again while a retry is in flight", async () => {
    commands.createMessage.mockRejectedValueOnce(new CommandError("TIMEOUT", "slow", true));
    commands.createMessage.mockReturnValueOnce(new Promise(() => undefined));
    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });
    await act(() => result.current.send({ text: "hello" }));
    await waitFor(() => expect(rows()[0]!.status).toBe("failed"));

    await act(async () => result.current.retry(rows()[0]!.id));
    expect(rows()[0]).toMatchObject({ status: "pending" });
    expect(rows()[0]!.failure).toBeUndefined();
  });

  it("explains a rate limit and a refusal in plain words, and flags a refusal as not retryable", async () => {
    commands.createMessage.mockRejectedValueOnce(new CommandError("RATE_LIMITED", "slow down", true, 0.4));
    commands.createMessage.mockRejectedValueOnce(new CommandError("PERMISSION_DENIED", "You cannot send messages in this channel.", false));
    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });

    await act(() => result.current.send({ text: "one" }));
    await act(() => result.current.send({ text: "two" }));
    await waitFor(() => expect(rows().every((m) => m.status === "failed")).toBe(true));

    expect(rows()[0]!.failure).toEqual({ message: "You're sending too fast. Try again in a moment.", retryable: true });
    expect(rows()[1]!.failure).toEqual({ message: "You cannot send messages in this channel.", retryable: false });
  });

  it("discards a failed message", async () => {
    commands.createMessage.mockRejectedValue(new CommandError("TIMEOUT", "slow", true));
    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });
    await act(() => result.current.send({ text: "hello" }));
    await waitFor(() => expect(rows()[0]!.status).toBe("failed"));
    act(() => result.current.discard(rows()[0]!.id));
    expect(rows()).toHaveLength(0);
  });

  it("sends attachments through the HTTP upload route instead of the socket", async () => {
    const { calledUrl, jsonResponse, mockFetch, signIn } = await import("../../test/helpers");
    signIn();
    const fetchMock = mockFetch(
      jsonResponse({ message_data: { message_id: "m_file", channel_id: "c1", sender_user_id: "me", username: "ada", message: "see file", sent_at: "2030-01-01T10:00:00Z" } }),
    );
    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });

    await act(() => result.current.send({ text: "see file", files: [new File(["x"], "a.txt")] }));

    expect(commands.createMessage).not.toHaveBeenCalled();
    expect(calledUrl(fetchMock, 0).pathname).toBe("/api/v1/channels/c1/send_message");
    expect(rows().map((m) => m.id)).toEqual(["m_file"]);
  });

  it("waits for the ack and throws when there is nothing on screen to show a pending row in", async () => {
    client.removeQueries({ queryKey: messageKeys.channel("c1") });
    commands.createMessage.mockRejectedValue(new CommandError("PERMISSION_DENIED", "nope", false));
    const { result } = renderHook(() => useSendMessage("c1"), { wrapper });
    await expect(result.current.send({ text: "hello" })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });
});

describe("edit, delete and react over the protocol", () => {
  let client: QueryClient;
  let commands: { [K in keyof MessageCommands]: ReturnType<typeof vi.fn> };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MessageCommandsContext.Provider value={commands as unknown as MessageCommands}>{children}</MessageCommandsContext.Provider>
    </QueryClientProvider>
  );
  const rows = () => flattenMessages(client.getQueryData<MessageCache>(messageKeys.channel("c1")));

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData<MessageCache>(messageKeys.channel("c1"), { pageParams: [null], pages: [{ messages: [server()], nextCursor: null }] });
    commands = { createMessage: vi.fn(), editMessage: vi.fn(), deleteMessage: vi.fn(), setReaction: vi.fn() };
  });

  it("edits through message.edit and patches the cache", async () => {
    commands.editMessage.mockResolvedValue({ text: "changed", editCount: 1, editedAt: "2030-01-01T10:05:00+00:00" });
    const { result } = renderHook(() => useEditMessage("c1"), { wrapper });
    await act(() => result.current.mutateAsync({ id: "m_server", text: "changed" }));
    expect(commands.editMessage).toHaveBeenCalledWith("c1", "m_server", "changed");
    expect(rows()[0]).toMatchObject({ text: "changed", editCount: 1 });
  });

  it("deletes through message.delete and removes the row", async () => {
    commands.deleteMessage.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteMessage("c1"), { wrapper });
    await act(() => result.current.mutateAsync("m_server"));
    expect(commands.deleteMessage).toHaveBeenCalledWith("c1", "m_server");
    expect(rows()).toHaveLength(0);
  });

  it("toggles a reaction through reaction.add / reaction.remove", async () => {
    commands.setReaction.mockResolvedValue([{ emoji: "👍", count: 1, userIds: ["me"] }]);
    const { result } = renderHook(() => useToggleReaction("c1"), { wrapper });
    await act(() => result.current.mutateAsync({ id: "m_server", emoji: "👍", present: true }));
    expect(commands.setReaction).toHaveBeenCalledWith("c1", "m_server", "👍", true);
    expect(rows()[0]!.reactions).toEqual([{ emoji: "👍", count: 1, userIds: ["me"] }]);
  });

  it("surfaces a refused edit", async () => {
    commands.editMessage.mockRejectedValue(new CommandError("PERMISSION_DENIED", "Only the author can edit this.", false));
    const { result } = renderHook(() => useEditMessage("c1"), { wrapper });
    await expect(act(() => result.current.mutateAsync({ id: "m_server", text: "x" }))).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(rows()[0]!.text).toBe("hello");
  });
});
