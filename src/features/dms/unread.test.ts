import { afterEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { Conversation } from "./api";
import { applyEvent } from "../realtime/applyEvent";
import { userKeys } from "../users/hooks";
import type { Message } from "../messages/types";
import { markDmRead, noteIncomingDm, readDmUnread, unreadIn } from "./unread";

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: "d1",
  peerUserId: "u2",
  peerUsername: "grace",
  peerHost: "home.example",
  peerAvatarUrl: null,
  peerStatus: "online",
  lastMessageAt: null,
  lastMessagePreview: "",
  lastMessageSenderIsMe: false,
  ...overrides,
});

afterEach(() => localStorage.clear());

describe("direct message unread counts", () => {
  it("counts every message that arrives, one by one", () => {
    noteIncomingDm("me", "d1");
    noteIncomingDm("me", "d1");
    noteIncomingDm("me", "d1");
    expect(unreadIn(readDmUnread("me"), conversation())).toBe(3);
  });

  it("clears when the conversation is opened", () => {
    noteIncomingDm("me", "d1");
    markDmRead("me", "d1");
    expect(unreadIn(readDmUnread("me"), conversation())).toBe(0);
  });

  it("shows one unread for a message that arrived while the app was closed", () => {
    const state = readDmUnread("me");
    const later = new Date(Date.parse(state.since) + 60_000).toISOString();
    expect(unreadIn(state, conversation({ lastMessageAt: later }))).toBe(1);
    expect(unreadIn(state, conversation({ lastMessageAt: later, lastMessageSenderIsMe: true }))).toBe(0);
  });

  it("does not light up conversations that were already there before this device started tracking", () => {
    const state = readDmUnread("me");
    const earlier = new Date(Date.parse(state.since) - 86_400_000).toISOString();
    expect(unreadIn(state, conversation({ lastMessageAt: earlier }))).toBe(0);
  });

  it("is kept per account", () => {
    noteIncomingDm("me", "d1");
    expect(unreadIn(readDmUnread("someone-else"), conversation())).toBe(0);
  });
});

describe("realtime DM messages", () => {
  const dmMessage = (authorId: string): Message => ({
    id: `m-${authorId}`,
    channelId: "d1",
    authorId,
    authorName: "x",
    authorAvatarUrl: null,
    text: "hi",
    sentAt: new Date().toISOString(),
    attachments: [],
    reactions: [],
    editCount: 0,
    editedAt: null,
  });
  const client = () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(userKeys.profile, { user_id: "me" });
    return queryClient;
  };

  it("notify for any message from the other person, reply or not", () => {
    applyEvent(client(), { kind: "message", message: dmMessage("u2"), dm: true }, { activeChannelId: undefined });
    expect(unreadIn(readDmUnread("me"), conversation())).toBe(1);
  });

  it("do not notify for your own messages or for the conversation you are reading", () => {
    applyEvent(client(), { kind: "message", message: dmMessage("me"), dm: true }, { activeChannelId: undefined });
    applyEvent(client(), { kind: "message", message: dmMessage("u2"), dm: true }, { activeChannelId: undefined, activeConversationId: "d1" });
    expect(unreadIn(readDmUnread("me"), conversation())).toBe(0);
  });
});
