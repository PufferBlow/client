import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mentionable } from "../../lib/mentions";
import { Composer } from "./Composer";

const people: Mentionable[] = [
  { id: "u1", name: "grace", avatarUrl: null },
  { id: "u2", name: "ada", avatarUrl: null },
  { id: "u3", name: "gregor", avatarUrl: null },
];
const everyone: Mentionable = { id: "everyone", name: "everyone", avatarUrl: null, everyone: true };

const setup = (mentionables: Mentionable[] | null = people) => {
  const onSend = vi.fn().mockResolvedValue(undefined);
  render(<Composer channelName="general" mentionables={mentionables ?? undefined} onSend={onSend} />);
  return { user: userEvent.setup(), field: screen.getByLabelText("Message #general") as HTMLTextAreaElement, onSend };
};

const options = () => screen.queryAllByRole("option").map((o) => o.getAttribute("aria-label"));

describe("mention suggestions in the composer", () => {
  it("appear when you type @ and narrow as you type", async () => {
    const { user, field } = setup();
    await user.type(field, "hi @");
    expect(options()).toHaveLength(3);
    await user.type(field, "gr");
    expect(options()).toEqual(["grace", "gregor"]);
  });

  it("insert the chosen name with Enter, without sending the message", async () => {
    const { user, field, onSend } = setup();
    await user.type(field, "hi @gr");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(field).toHaveValue("hi @gregor ");
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("insert with Tab", async () => {
    const { user, field } = setup();
    await user.type(field, "@ad");
    await user.keyboard("{Tab}");
    expect(field).toHaveValue("@ada ");
  });

  it("insert the one you click", async () => {
    const { user, field } = setup();
    await user.type(field, "@");
    await user.click(screen.getByRole("option", { name: "gregor" }));
    expect(field).toHaveValue("@gregor ");
  });

  it("go away on Escape, and stay away for that word", async () => {
    const { user, field } = setup();
    await user.type(field, "@gr");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.type(field, "a"); // the word changed: suggestions return
    expect(options()).toEqual(["grace"]);
  });

  it("do not appear inside an email address or when nothing matches", async () => {
    const { user, field } = setup();
    await user.type(field, "mail ann@gr");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.clear(field);
    await user.type(field, "@zzz");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("let Enter send as usual when no list is open", async () => {
    const { user, field, onSend } = setup();
    await user.type(field, "hello{Enter}");
    expect(onSend).toHaveBeenCalledWith({ text: "hello", files: [] });
  });

  it("do not offer @everyone unless it was given", async () => {
    const { user, field } = setup(people);
    await user.type(field, "@every");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("put @everyone in the list for someone who may use it", async () => {
    const { user, field } = setup([everyone, ...people]);
    await user.type(field, "@every");
    expect(options()[0]).toBe("everyone");
    await user.keyboard("{Enter}");
    expect(field).toHaveValue("@everyone ");
  });

  it("are off without a list of people", async () => {
    const { user, field } = setup(null);
    await user.type(field, "@gr");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
