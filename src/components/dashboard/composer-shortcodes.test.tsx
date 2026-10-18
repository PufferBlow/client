import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mentionable } from "../../lib/mentions";
import { Composer } from "./Composer";

const people: Mentionable[] = [{ id: "u1", name: "tadeusz", avatarUrl: null }];

const setup = (mentionables?: Mentionable[]) => {
  const onSend = vi.fn().mockResolvedValue(undefined);
  render(<Composer channelName="general" mentionables={mentionables} onSend={onSend} />);
  return { user: userEvent.setup(), field: screen.getByLabelText("Message #general") as HTMLTextAreaElement, onSend };
};

const options = () => screen.queryAllByRole("option").map((o) => o.getAttribute("aria-label"));

describe("emoji shortcodes in the composer", () => {
  it("suggest emoji after a colon and two letters", async () => {
    const { user, field } = setup();
    await user.type(field, "nice :ta");
    expect(options()).toContain(":tada:");
    expect(screen.getByRole("listbox", { name: "Emoji" })).toBeInTheDocument();
  });

  it("wait for the second letter", async () => {
    const { user, field } = setup();
    await user.type(field, ":t");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("insert the chosen emoji with Enter, without sending", async () => {
    const { user, field, onSend } = setup();
    await user.type(field, "go :tad");
    await user.keyboard("{Enter}");
    expect(field).toHaveValue("go 🎉 ");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("insert the one you click", async () => {
    const { user, field } = setup();
    await user.type(field, ":tada");
    await user.click(screen.getByRole("option", { name: ":tada:" }));
    expect(field).toHaveValue("🎉 ");
  });

  it("turn a typed :name: into the emoji when the closing colon is typed", async () => {
    const { user, field } = setup();
    await user.type(field, "yay :tada:");
    expect(field).toHaveValue("yay 🎉");
  });

  it("leave an unknown :name: alone", async () => {
    const { user, field } = setup();
    await user.type(field, ":nope_nope:");
    expect(field).toHaveValue(":nope_nope:");
  });

  it("are written out as emoji when sent, but not inside code", async () => {
    const { user, field, onSend } = setup();
    await user.click(field);
    await user.paste("pasted :+1: and `:tada:`");
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith({ text: "pasted 👍 and `:tada:`", files: [] });
  });

  it("do not take over from an @mention being typed", async () => {
    const { user, field } = setup(people);
    await user.type(field, "@tad");
    expect(options()).toEqual(["tadeusz"]);
  });
});
