import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/render";
import { Composer } from "./Composer";

// emoji-mart needs a real browser; the picker is replaced with one button per emoji we want to pick.
vi.mock("../ui/EmojiPicker", () => ({
  default: ({ onSelect }: { onSelect: (e: { native: string }) => void }) => (
    <div data-testid="picker">
      <button onClick={() => onSelect({ native: "🦄" })}>pick unicorn</button>
    </div>
  ),
}));

const setup = (props: { maxLength?: number } = {}) => {
  const onSend = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  renderWithProviders(<Composer channelName="general" onSend={onSend} {...props} />);
  return { onSend, user, field: () => screen.getByLabelText("Message #general") as HTMLInputElement };
};

describe("Composer emoji button", () => {
  it("sits just before the send button", () => {
    setup();
    const emoji = screen.getByRole("button", { name: "Add emoji" });
    const send = screen.getByRole("button", { name: "Send message" });
    expect(emoji.nextElementSibling).toBe(send);
  });

  it("opens the picker, and a second click closes it", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Add emoji" }));
    expect(await screen.findByRole("dialog", { name: "Choose an emoji" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add emoji" })).toHaveAttribute("aria-expanded", "true");

    // The popover treats a press outside as dismissal; pressing the toggle itself is outside too.
    await user.click(screen.getByRole("button", { name: "Add emoji" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("inserts the emoji at the caret, closes the picker and returns focus to the field", async () => {
    const { user, field } = setup();
    await user.type(field(), "hello world");
    field().setSelectionRange(5, 5); // after "hello"

    await user.click(screen.getByRole("button", { name: "Add emoji" }));
    await user.click(await screen.findByText("pick unicorn"));

    expect(field()).toHaveValue("hello🦄 world");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(field()).toHaveFocus());
  });

  it("replaces a selection", async () => {
    const { user, field } = setup();
    await user.type(field(), "abc def");
    field().setSelectionRange(0, 3);
    await user.click(screen.getByRole("button", { name: "Add emoji" }));
    await user.click(await screen.findByText("pick unicorn"));
    expect(field()).toHaveValue("🦄 def");
  });

  it("does not exceed the message length limit", async () => {
    const { user, field } = setup({ maxLength: 4 });
    await user.type(field(), "abc");
    await user.click(screen.getByRole("button", { name: "Add emoji" }));
    await user.click(await screen.findByText("pick unicorn")); // the emoji is two UTF-16 units: 3 + 2 > 4
    expect(field()).toHaveValue("abc");
  });

  it("sends the text with the emoji in it", async () => {
    const { user, field, onSend } = setup();
    await user.type(field(), "hi ");
    await user.click(screen.getByRole("button", { name: "Add emoji" }));
    await user.click(await screen.findByText("pick unicorn"));
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSend).toHaveBeenCalledWith({ text: "hi 🦄", files: [] });
  });
});
