import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Message } from "../../features/messages/types";
import { canMentionEveryone } from "../../features/users/roles";
import { MentionDirectoryContext, type MentionDirectory } from "../../lib/mentions";
import { MessageItem } from "./MessageItem";

const message = (text: string, authorId = "u-other"): Message => ({
  id: "m1",
  channelId: "c1",
  authorId,
  authorName: "grace",
  authorAvatarUrl: null,
  text,
  sentAt: "2030-01-01T12:30:00Z",
  attachments: [],
  reactions: [],
  editCount: 0,
  editedAt: null,
});

const directory: MentionDirectory = { me: "ada", known: new Set(["ada", "linus"]) };

const renderMessage = (text: string, authorId?: string) =>
  render(
    <MentionDirectoryContext.Provider value={directory}>
      <MessageItem message={message(text, authorId)} myUserId="me" onEdit={vi.fn()} onToggleReaction={vi.fn()} />
    </MentionDirectoryContext.Provider>,
  );

describe("mentions in a message", () => {
  it("highlight people who exist and leave other @words as text", () => {
    renderMessage("hey @linus and @nobody");
    expect(screen.getByText("@linus")).toHaveClass("bg-text/10");
    expect(screen.getByText(/@nobody/)).not.toHaveClass("bg-text/10");
  });

  it("highlight @everyone", () => {
    renderMessage("@everyone standup");
    expect(screen.getByText("@everyone")).toHaveClass("bg-text");
  });

  it("pick out the whole row when you are mentioned", () => {
    const { container } = renderMessage("hi @ada");
    expect(container.querySelector("article")).toHaveClass("shadow-[inset_3px_0_0_var(--color-text)]");
  });

  it("do not pick out the row for a mention of someone else, or your own mention of yourself", () => {
    const other = renderMessage("hi @linus");
    expect(other.container.querySelector("article")).not.toHaveClass("shadow-[inset_3px_0_0_var(--color-text)]");
    other.unmount();

    const self = renderMessage("note to @ada", "me");
    expect(self.container.querySelector("article")).not.toHaveClass("shadow-[inset_3px_0_0_var(--color-text)]");
  });
});

describe("who may use @everyone", () => {
  it("is the owner and anyone with the moderation privilege", () => {
    expect(canMentionEveryone({ roles_ids: ["owner"] })).toBe(true);
    expect(canMentionEveryone({ roles_ids: ["moderator"], resolved_privileges: ["send_messages", "moderate_content"] })).toBe(true);
    expect(canMentionEveryone({ roles_ids: ["user"], resolved_privileges: ["send_messages"] })).toBe(false);
    expect(canMentionEveryone(undefined)).toBe(false);
  });
});
