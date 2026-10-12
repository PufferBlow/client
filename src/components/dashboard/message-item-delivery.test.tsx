import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Message } from "../../features/messages/types";
import { MessageItem } from "./MessageItem";

const message = (overrides: Partial<Message> = {}): Message => ({
  id: "local_n1",
  channelId: "c1",
  authorId: "me",
  authorName: "ada",
  authorAvatarUrl: null,
  text: "hello there",
  sentAt: "2030-01-01T12:30:00Z",
  attachments: [],
  reactions: [],
  editCount: 0,
  editedAt: null,
  ...overrides,
});

const handlers = () => ({ onEdit: vi.fn(), onDelete: vi.fn(), onToggleReaction: vi.fn(), onOpenMenu: vi.fn() });

describe("MessageItem delivery state", () => {
  it("shows a pending message dimmed with no actions", () => {
    render(<MessageItem message={message({ status: "pending", nonce: "n1" })} myUserId="me" {...handlers()} />);
    expect(screen.getByText("hello there")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("hello there")).toHaveClass("opacity-60");
    expect(screen.queryByRole("button", { name: "Edit message" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not open the message menu for a message that is not on the server", async () => {
    const h = handlers();
    render(<MessageItem message={message({ status: "pending" })} myUserId="me" {...h} />);
    await userEvent.setup().pointer({ keys: "[MouseRight]", target: screen.getByText("hello there") });
    expect(h.onOpenMenu).not.toHaveBeenCalled();
  });

  it("explains a failed message and offers Retry and Delete", async () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();
    const user = userEvent.setup();
    render(
      <MessageItem
        message={message({ status: "failed", nonce: "n1", failure: { message: "The connection dropped. Retry to send it.", retryable: true } })}
        myUserId="me"
        {...handlers()}
        onRetry={onRetry}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The connection dropped. Retry to send it.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith("local_n1");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDiscard).toHaveBeenCalledWith("local_n1");
  });

  it("offers no Retry when the server refused the message outright", () => {
    render(
      <MessageItem
        message={message({ status: "failed", failure: { message: "You cannot send messages in this channel.", retryable: false } })}
        myUserId="me"
        {...handlers()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("leaves delivered messages unchanged", () => {
    render(<MessageItem message={message({ id: "m1" })} myUserId="me" {...handlers()} />);
    expect(screen.getByRole("button", { name: "Edit message" })).toBeInTheDocument();
    expect(screen.getByText("hello there")).not.toHaveClass("opacity-60");
  });
});
