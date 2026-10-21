import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Message } from "../../features/messages/types";
import { ApiError } from "../../services/api";
import { signIn } from "../../test/helpers";
import { PufferblowBrand } from "../ui/PufferblowBrand";
import { Avatar, CountBadge } from "./Avatar";
import { Composer } from "./Composer";
import { MentionDirectoryContext } from "../../lib/mentions";
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

  it("sends a file marked as spoiler under a SPOILER_ name", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { container } = render(<Composer channelName="general" onSend={onSend} />);

    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(["x"], "plot.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Mark plot.png as spoiler" }));
    expect(screen.getByText("SPOILER")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send message" }));

    const sent = (onSend.mock.calls[0]?.[0] as { files: File[] }).files;
    expect(sent.map((f) => [f.name, f.type])).toEqual([["SPOILER_plot.png", "image/png"]]);
  });

  it("attaches pasted files instead of pasting them as text", async () => {
    const user = userEvent.setup();
    render(<Composer channelName="general" onSend={vi.fn()} />);
    const shot = new File(["png"], "image.png", { type: "image/png" });

    fireEvent.paste(screen.getByLabelText("Message #general"), { clipboardData: { files: [shot], getData: () => "" } });
    expect(await screen.findByText("image.png")).toBeInTheDocument();
    expect(screen.getByText("3 B")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove image.png" }));
    expect(screen.queryByText("image.png")).not.toBeInTheDocument();
  });

  it("will not send attachments over the server's size limit", async () => {
    const user = userEvent.setup();
    const { container } = render(<Composer channelName="general" maxAttachmentMB={1} onSend={vi.fn()} />);
    const big = new File([new Uint8Array(1024 * 1024 + 1)], "big.bin");

    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, big);
    expect(screen.getByRole("alert")).toHaveTextContent("this server allows 1 MB per message");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
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

  it("blurs a spoiler attachment until it is revealed", async () => {
    const user = userEvent.setup();
    const attachments = [{ url: "https://cdn.example/a.png", filename: "SPOILER_ending.png", type: "image/png" }];
    const { container } = render(<MessageItem message={message({ text: "", attachments })} myUserId="me" {...handlers()} />);

    expect(screen.queryByRole("img", { name: "ending.png" })).not.toBeInTheDocument(); // hidden from assistive tech too
    await user.click(screen.getByRole("button", { name: "Spoiler attachment ending.png, select to reveal" }));
    expect(screen.getByRole("img", { name: "ending.png" })).toBeInTheDocument();
    expect(container.querySelector(".blur-2xl")).toBeNull();
  });

  it("plays video attachments inline and shows file sizes", () => {
    const attachments = [
      { url: "https://cdn.example/v.mp4", filename: "clip.mp4", type: "video/mp4" },
      { url: "https://cdn.example/r.pdf", filename: "report.pdf", type: "application/pdf", size: 2048 },
    ];
    const { container } = render(<MessageItem message={message({ text: "", attachments })} myUserId="me" {...handlers()} />);
    expect(container.querySelector("video")).toHaveAttribute("src", "https://cdn.example/v.mp4");
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("offers edit only on your own messages", () => {
    const { rerender } = render(<MessageItem message={message({ authorId: "me" })} myUserId="me" {...handlers()} />);
    expect(screen.getByRole("button", { name: "Edit message" })).toBeInTheDocument();

    rerender(<MessageItem message={message()} myUserId="me" {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Edit message" })).not.toBeInTheDocument();
  });

  it("does not treat anything as 'own' before the profile has loaded", () => {
    render(<MessageItem message={message({ authorId: "" })} myUserId={undefined} {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Delete message" })).not.toBeInTheDocument();
  });

  it("keeps delete off the toolbar (it is in the menu, behind a confirmation)", () => {
    render(<MessageItem message={message({ authorId: "me" })} myUserId="me" {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Delete message" })).not.toBeInTheDocument();
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
      expect(document.querySelector('img.rounded-full[src*="pb-avatar-"]')).toBeInTheDocument(); // the avatar
      expect(screen.getAllByText(timeText)).toHaveLength(1);
    });

    it("drops the avatar and name on continuations but keeps the text and a hover time", () => {
      render(<MessageItem message={message()} isGroupStart={false} myUserId="me" {...handlers()} />);
      expect(screen.queryByText("grace")).not.toBeInTheDocument();
      expect(document.querySelector('img.rounded-full[src*="pb-avatar-"]')).not.toBeInTheDocument();
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

  it("offers one quick reaction on the toolbar: the viewer's most used", async () => {
    const h = handlers();
    const user = userEvent.setup();
    const { rerender } = render(<MessageItem message={message()} myUserId="me" {...h} />);
    expect(screen.getByRole("button", { name: "Add 👍 reaction" })).toBeInTheDocument(); // the default
    expect(screen.queryByRole("button", { name: "Add ❤️ reaction" })).not.toBeInTheDocument();

    rerender(<MessageItem message={message()} myUserId="me" quickReaction="🔥" {...h} />);
    await user.click(screen.getByRole("button", { name: "Add 🔥 reaction" }));
    expect(h.onToggleReaction).toHaveBeenCalledWith("m1", "🔥", true);
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
  it("shows the fish for the name when there is no image, the same one every time", () => {
    const first = render(<Avatar name="Ada Lovelace" />);
    const fish = first.container.querySelector("img")!.getAttribute("src");
    expect(fish).toMatch(/pb-avatar-/);
    first.unmount();
    const second = render(<Avatar name="Ada Lovelace" />);
    expect(second.container.querySelector("img")).toHaveAttribute("src", fish);
  });

  it("loads the image from the instance and falls back to the fish if it fails", () => {
    signIn();
    const { container } = render(<Avatar name="Ada Lovelace" src="/storage/ava" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "http://localhost:7575/storage/ava");

    fireEvent.error(img);
    expect(container.querySelector("img")!.getAttribute("src")).toMatch(/pb-avatar-/);
  });

  it("uses the fish when the image cannot be resolved (signed out)", () => {
    const { container } = render(<Avatar name="Ada" src="/storage/ava" />);
    expect(container.querySelector("img")!.getAttribute("src")).toMatch(/pb-avatar-/);
  });

  it("dims an offline avatar and draws no dot", () => {
    const { container } = render(<Avatar name="Ada" presence="offline" />);
    expect(container.querySelector("span")).toBeNull();
    expect(container.firstElementChild).toHaveStyle({ opacity: "0.55" });
  });

  it("draws an idle dot hollow and an activity dot in sage", () => {
    const idle = render(<Avatar name="Ada" presence="idle" ringColor="#161616" />);
    expect(idle.container.querySelector("span")!.getAttribute("style")).toContain("inset 0 0 0 3px");
    idle.unmount();
    const call = render(<Avatar name="Ada" presence="online" activity />);
    expect(call.container.querySelector("span")).toHaveStyle({ background: "rgb(159, 212, 135)" });
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
  const variant = (container: HTMLElement) => container.querySelector("svg")?.getAttribute("data-variant");

  it("uses the full mark at normal sizes and the simplified mark below 32px", () => {
    expect(variant(render(<PufferblowBrand size={48} />).container)).toBe("full");
    expect(variant(render(<PufferblowBrand size={24} />).container)).toBe("small");
  });

  it("switches at exactly 32px", () => {
    expect(variant(render(<PufferblowBrand size={32} />).container)).toBe("full");
    expect(variant(render(<PufferblowBrand size={31} />).container)).toBe("small");
  });

  it("cuts the eyes and mouth out of the face", () => {
    const { container } = render(<PufferblowBrand />);
    const mask = container.querySelector("mask")!;
    expect(mask.querySelectorAll("circle")).toHaveLength(2);
    expect(mask.querySelectorAll("ellipse")).toHaveLength(1);
    expect(container.querySelector("rect[mask]")).toHaveAttribute("mask", `url(#${mask.id})`);
  });

  it("gives each mark its own mask, so several can share a page", () => {
    const { container } = render(
      <>
        <PufferblowBrand />
        <PufferblowBrand />
      </>,
    );
    const ids = [...container.querySelectorAll("mask")].map((m) => m.id);
    expect(new Set(ids).size).toBe(2);
  });

  it.each([
    ["paper", "#f2f2f2"],
    ["ink", "#000000"],
    ["gold", "#ffffff"],
  ] as const)("paints the %s tone", (tone, colour) => {
    const { container } = render(<PufferblowBrand tone={tone} />);
    expect(container.querySelector("rect[mask]")).toHaveAttribute("fill", colour);
  });

  it("is white by default, for dark surfaces", () => {
    const { container } = render(<PufferblowBrand />);
    expect(container.querySelector("rect[mask]")).toHaveAttribute("fill", "#f2f2f2");
  });

  it("is labelled for assistive tech", () => {
    render(<PufferblowBrand />);
    expect(screen.getByRole("img", { name: "Pufferblow" })).toBeInTheDocument();
  });
});

describe("puff reactions in a message", () => {
  it("draws a puff reaction as its face and sends it back as the reserved string", async () => {
    const onToggleReaction = vi.fn();
    const withPuff = { ...message(), reactions: [{ emoji: "puff:happy", count: 2, userIds: ["someone"] }] };
    render(<MessageItem message={withPuff} isGroupStart myUserId="me" onEdit={vi.fn().mockResolvedValue(undefined)} onToggleReaction={onToggleReaction} />);

    const chip = screen.getByRole("button", { name: "Happy reaction, 2" });
    expect(chip.querySelector("[data-puff='happy']")).not.toBeNull();
    await userEvent.click(chip);
    expect(onToggleReaction).toHaveBeenCalledWith(withPuff.id, "puff:happy", true);
    // it puffed: the face has the pop animation and spines
    expect(chip.querySelectorAll(".pb-anim-spike")).toHaveLength(8);
  });

  it("offers all six faces on the toolbar", async () => {
    const onToggleReaction = vi.fn();
    render(<MessageItem message={message()} isGroupStart myUserId="me" onEdit={vi.fn().mockResolvedValue(undefined)} onToggleReaction={onToggleReaction} />);
    expect(screen.getAllByRole("button", { name: /^Add .+ reaction$/ }).length).toBeGreaterThanOrEqual(6);
    await userEvent.click(screen.getByRole("button", { name: "Add Wink reaction" }));
    expect(onToggleReaction).toHaveBeenCalledWith(expect.any(String), "puff:wink", true);
  });
});

describe("role pill beside an author", () => {
  it("shows the author's role in its colour, and nothing for an ordinary member", () => {
    const withRole = (
      <MentionDirectoryContext.Provider value={{ known: new Set(), roles: new Map([["u-other", { name: "Admin", colour: "#a99cf2" }]]) }}>
        <MessageItem message={message()} isGroupStart myUserId="me" onEdit={vi.fn().mockResolvedValue(undefined)} onToggleReaction={vi.fn()} />
      </MentionDirectoryContext.Provider>
    );
    const first = render(withRole);
    expect(screen.getByText("Admin").getAttribute("style")).toContain("--role-colour: #a99cf2");
    first.unmount();

    render(<MessageItem message={message()} isGroupStart myUserId="me" onEdit={vi.fn().mockResolvedValue(undefined)} onToggleReaction={vi.fn()} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});
