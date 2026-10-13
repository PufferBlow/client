import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Message } from "../../features/messages/types";
import { ApiError } from "../../services/api";
import { signIn } from "../../test/helpers";
import { PufferblowBrand } from "../ui/PufferblowBrand";
import { Avatar, CountBadge } from "./Avatar";
import { Composer } from "./Composer";
import { MessageItem } from "./MessageItem";

const message = (overrides: Partial<Message> = {}): Message => ({
  id: "m1",
  channelId: "c1",
  authorId: "u-other",
  authorName: "grace",
  authorAvatarUrl: null,
  text: "hello there",
  sentAt: "2030-01-01T12:30:00Z",
  attachments: [],
  reactions: [],
  editCount: 0,
  editedAt: null,
  ...overrides,
});

describe("Composer", () => {
  it("sends trimmed text, then clears the input", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Composer channelName="general" onSend={onSend} />);

    await user.type(screen.getByLabelText("Message #general"), "  hi all  ");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSend).toHaveBeenCalledWith({ text: "hi all", files: [] });
    await waitFor(() => expect(screen.getByLabelText("Message #general")).toHaveValue(""));
  });

  it("submits with Enter", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Composer channelName="general" onSend={onSend} />);

    await user.type(screen.getByLabelText("Message #general"), "enter{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("will not send an empty or whitespace-only message", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<Composer channelName="general" onSend={onSend} />);

    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    await user.type(screen.getByLabelText("Message #general"), "   ");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("attaches files, lists them, and lets you remove one", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { container } = render(<Composer channelName="general" onSend={onSend} />);

    const a = new File(["a"], "a.png", { type: "image/png" });
    const b = new File(["b"], "b.txt", { type: "text/plain" });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, [a, b]);

    expect(screen.getByText("a.png")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove a.png" }));
    expect(screen.queryByText("a.png")).not.toBeInTheDocument();

    // A file alone is enough to send.
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSend).toHaveBeenCalledWith({ text: "", files: [b] });
  });

  it("keeps the draft and shows the reason when sending fails", async () => {
    const onSend = vi.fn().mockRejectedValue(new ApiError(403, "auth.privilege_denied", "You can't send messages here."));
    const user = userEvent.setup();
    render(<Composer channelName="general" onSend={onSend} />);

    await user.type(screen.getByLabelText("Message #general"), "draft");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You can't send messages here.");
    expect(screen.getByLabelText("Message #general")).toHaveValue("draft");
  });

  it("applies the instance's maximum message length", () => {
    render(<Composer channelName="general" maxLength={500} onSend={vi.fn()} />);
    expect(screen.getByLabelText("Message #general")).toHaveAttribute("maxlength", "500");
  });

  it("adds a new line with Shift+Enter and sends every line with Enter", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Composer channelName="general" onSend={onSend} />);

    await user.type(screen.getByLabelText("Message #general"), "line one{Shift>}{Enter}{/Shift}line two");
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Message #general")).toHaveValue("line one\nline two");

    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith({ text: "line one\nline two", files: [] });
  });

  it("toggles bold, italics and underline around the selection with Ctrl+B/I/U", async () => {
    const user = userEvent.setup();
    render(<Composer channelName="general" onSend={vi.fn()} />);
    const field = screen.getByLabelText("Message #general") as HTMLTextAreaElement;

    await user.type(field, "make this bold");
    field.setSelectionRange(10, 14);
    await user.keyboard("{Control>}b{/Control}");
    expect(field).toHaveValue("make this **bold**");

    field.setSelectionRange(12, 16);
    await user.keyboard("{Control>}b{/Control}");
    expect(field).toHaveValue("make this bold");

    field.setSelectionRange(0, 4);
    await user.keyboard("{Control>}i{/Control}");
    expect(field).toHaveValue("*make* this bold");
  });

  it("counts down the characters left near the limit", async () => {
    const user = userEvent.setup();
    render(<Composer channelName="general" maxLength={100} onSend={vi.fn()} />);
    expect(screen.queryByLabelText(/characters left/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Message #general"), "x".repeat(85));
    expect(screen.getByLabelText("15 characters left")).toHaveTextContent("15");
  });

  it("blocks a double send while the first is in flight", async () => {
    let finish!: () => void;
    const onSend = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<Composer channelName="general" onSend={onSend} />);

    await user.type(screen.getByLabelText("Message #general"), "once");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    await user.type(screen.getByLabelText("Message #general"), "{Enter}");

    expect(onSend).toHaveBeenCalledTimes(1);
    finish();
  });
});

describe("MessageItem", () => {
  const handlers = () => ({ onEdit: vi.fn().mockResolvedValue(undefined), onDelete: vi.fn(), onToggleReaction: vi.fn() });

  it("shows the author and text", () => {
    render(<MessageItem message={message()} myUserId="me" {...handlers()} />);
    expect(screen.getByText("grace")).toBeInTheDocument();
    expect(screen.getByText("hello there")).toBeInTheDocument();
  });

  it("offers edit and delete only on your own messages", () => {
    const { rerender } = render(<MessageItem message={message({ authorId: "me" })} myUserId="me" {...handlers()} />);
    expect(screen.getByRole("button", { name: "Edit message" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete message" })).toBeInTheDocument();

    rerender(<MessageItem message={message()} myUserId="me" {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Edit message" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete message" })).not.toBeInTheDocument();
  });

  it("does not treat anything as 'own' before the profile has loaded", () => {
    render(<MessageItem message={message({ authorId: "" })} myUserId={undefined} {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Delete message" })).not.toBeInTheDocument();
  });

  it("deletes through the callback", async () => {
    const h = handlers();
    const user = userEvent.setup();
    render(<MessageItem message={message({ authorId: "me" })} myUserId="me" {...h} />);

    await user.click(screen.getByRole("button", { name: "Delete message" }));
    expect(h.onDelete).toHaveBeenCalledWith("m1");
  });

  it("edits inline and saves with Enter", async () => {
    const h = handlers();
    const user = userEvent.setup();
    render(<MessageItem message={message({ authorId: "me" })} myUserId="me" {...h} />);

    await user.click(screen.getByRole("button", { name: "Edit message" }));
    const input = screen.getByRole("textbox", { name: "Edit message" });
    expect(input).toHaveValue("hello there");
    await user.clear(input);
    await user.type(input, "fixed{Enter}");

    expect(h.onEdit).toHaveBeenCalledWith("m1", "fixed");
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Edit message" })).not.toBeInTheDocument());
  });

  it("cancels an edit with Escape and does not save", async () => {
    const h = handlers();
    const user = userEvent.setup();
    render(<MessageItem message={message({ authorId: "me" })} myUserId="me" {...h} />);

    await user.click(screen.getByRole("button", { name: "Edit message" }));
    await user.type(screen.getByRole("textbox", { name: "Edit message" }), " more{Escape}");

    expect(h.onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("hello there")).toBeInTheDocument();
  });

  it("closes without a request when nothing changed", async () => {
    const h = handlers();
    const user = userEvent.setup();
    render(<MessageItem message={message({ authorId: "me" })} myUserId="me" {...h} />);

    await user.click(screen.getByRole("button", { name: "Edit message" }));
    await user.type(screen.getByRole("textbox", { name: "Edit message" }), "{Enter}");
    expect(h.onEdit).not.toHaveBeenCalled();
  });

  it("stays in edit mode when saving fails", async () => {
    const h = { ...handlers(), onEdit: vi.fn().mockRejectedValue(new Error("nope")) };
    const user = userEvent.setup();
    render(<MessageItem message={message({ authorId: "me" })} myUserId="me" {...h} />);

    await user.click(screen.getByRole("button", { name: "Edit message" }));
    await user.type(screen.getByRole("textbox", { name: "Edit message" }), "!{Enter}");

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Edit message" })).not.toBeDisabled());
  });

  describe("grouping", () => {
    const timeText = /\d{1,2}:\d{2}/;

    it("shows the avatar, name and time on the first message of a group", () => {
      render(<MessageItem message={message()} isGroupStart myUserId="me" {...handlers()} />);
      expect(screen.getByText("grace")).toBeInTheDocument();
      expect(screen.getByText("G")).toBeInTheDocument(); // avatar initial
      expect(screen.getAllByText(timeText)).toHaveLength(1);
    });

    it("drops the avatar and name on continuations but keeps the text and a hover time", () => {
      render(<MessageItem message={message()} isGroupStart={false} myUserId="me" {...handlers()} />);
      expect(screen.queryByText("grace")).not.toBeInTheDocument();
      expect(screen.queryByText("G")).not.toBeInTheDocument();
      expect(screen.getByText("hello there")).toBeInTheDocument();
      expect(screen.getAllByText(timeText)).toHaveLength(1);
    });

    it("still announces the author of a continuation", () => {
      render(<MessageItem message={message()} isGroupStart={false} myUserId="me" {...handlers()} />);
      expect(screen.getByRole("article", { name: /^grace at / })).toBeInTheDocument();
    });

    it("keeps the edited marker on continuations", () => {
      render(<MessageItem message={message({ editCount: 1 })} isGroupStart={false} myUserId="me" {...handlers()} />);
      expect(screen.getByText("(edited)")).toBeInTheDocument();
    });

    it("keeps tools and reactions on continuations", () => {
      const reactions = [{ emoji: "👍", count: 2, userIds: [] }];
      render(<MessageItem message={message({ authorId: "me", reactions })} isGroupStart={false} myUserId="me" {...handlers()} />);
      expect(screen.getByRole("button", { name: "Edit message" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /👍s*2/ })).toBeInTheDocument();
    });
  });

  it("marks edited messages", () => {
    render(<MessageItem message={message({ editCount: 1 })} myUserId="me" {...handlers()} />);
    expect(screen.getByText("(edited)")).toBeInTheDocument();
  });

  it("shows reactions, highlights yours, and toggles them", async () => {
    const h = handlers();
    const user = userEvent.setup();
    const reactions = [
      { emoji: "👍", count: 2, userIds: ["me", "x"] },
      { emoji: "🎉", count: 1, userIds: ["x"] },
    ];
    render(<MessageItem message={message({ reactions })} myUserId="me" {...h} />);

    const mine = screen.getByRole("button", { name: /👍\s*2/ });
    const theirs = screen.getByRole("button", { name: /🎉\s*1/ });
    expect(mine).toHaveAttribute("aria-pressed", "true");
    expect(theirs).toHaveAttribute("aria-pressed", "false");

    await user.click(mine);
    expect(h.onToggleReaction).toHaveBeenLastCalledWith("m1", "👍", false); // remove
    await user.click(theirs);
    expect(h.onToggleReaction).toHaveBeenLastCalledWith("m1", "🎉", true); // add
  });

  it("adds a quick reaction from the toolbar", async () => {
    const h = handlers();
    const user = userEvent.setup();
    render(<MessageItem message={message()} myUserId="me" {...h} />);

    await user.click(screen.getByRole("button", { name: "Add ❤️ reaction" }));
    expect(h.onToggleReaction).toHaveBeenCalledWith("m1", "❤️", true);
  });

  it("renders image attachments inline from the instance and other files as links", () => {
    signIn();
    render(
      <MessageItem
        message={message({
          attachments: [
            { url: "/storage/abc", filename: "pic.png", type: "image/png" },
            { url: "/storage/def", filename: "notes.pdf", type: "application/pdf" },
          ],
        })}
        myUserId="me"
        {...handlers()}
      />,
    );

    expect(screen.getByRole("img", { name: "pic.png" })).toHaveAttribute("src", "http://localhost:7575/storage/abc");
    expect(screen.getByRole("link", { name: /notes\.pdf/ })).toHaveAttribute("href", "http://localhost:7575/storage/def");
  });

  it("keeps whitespace in message text but never renders it as HTML", () => {
    render(<MessageItem message={message({ text: "<img src=x onerror=alert(1)>\nline two" })} myUserId="me" {...handlers()} />);
    expect(screen.getByText(/line two/)).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });
});

describe("Avatar", () => {
  it("shows initials when there is no image", () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("loads the image from the instance and falls back to initials if it fails", () => {
    signIn();
    const { container } = render(<Avatar name="Ada Lovelace" src="/storage/ava" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "http://localhost:7575/storage/ava");

    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("skips the image when it cannot be resolved (signed out)", () => {
    const { container } = render(<Avatar name="Ada" src="/storage/ava" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("draws a presence dot in the status colour", () => {
    const { container } = render(<Avatar name="Ada" presence="dnd" />);
    expect(container.querySelector("span")).toHaveStyle({ background: "rgb(226, 101, 79)" });
  });
});

describe("CountBadge", () => {
  it.each([
    [0, null],
    [-3, null],
    [5, "5"],
    [99, "99"],
    [100, "99+"],
  ])("renders %i as %j", (count, text) => {
    const { container } = render(<CountBadge count={count} />);
    if (text === null) expect(container).toBeEmptyDOMElement();
    else expect(container).toHaveTextContent(text);
  });
});

describe("PufferblowBrand", () => {
  const paths = (container: HTMLElement) => container.querySelectorAll("path").length;

  it("uses the full mark at normal sizes and the simplified mark below 32px", () => {
    const large = render(<PufferblowBrand size={48} />);
    const small = render(<PufferblowBrand size={24} />);
    expect(paths(large.container)).toBeGreaterThan(paths(small.container));
  });

  it("switches at exactly 32px", () => {
    const at32 = render(<PufferblowBrand size={32} />);
    const at31 = render(<PufferblowBrand size={31} />);
    expect(paths(at32.container)).toBeGreaterThan(paths(at31.container));
  });

  it.each([
    ["gold", "#e3ae4f"],
    ["ink", "#1c1408"],
    ["paper", "#efe6d4"],
  ] as const)("paints the %s tone", (tone, colour) => {
    const { container } = render(<PufferblowBrand tone={tone} />);
    expect(container.querySelector("circle")).toHaveAttribute("fill", colour);
  });

  it("is labelled for assistive tech", () => {
    render(<PufferblowBrand />);
    expect(screen.getByRole("img", { name: "Pufferblow" })).toBeInTheDocument();
  });
});
