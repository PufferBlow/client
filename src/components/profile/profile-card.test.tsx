import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { MemberList } from "../dashboard/MemberList";
import { MessageItem } from "../dashboard/MessageItem";
import { ProfileCardProvider } from "./ProfileCardProvider";
import { ProfileCard } from "./ProfileCard";
import { DEFAULT_SETTINGS } from "@pufferblow/spines";
import type { Message } from "../../features/messages/types";
import { jsonResponse, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";

const person = (over: Record<string, unknown> = {}) => ({
  user_id: "u-bo",
  username: "bo",
  about: "I like fish.",
  status: "online",
  accent_color: "#ffffff",
  avatar_url: "/assets/avatars/pb-avatar-wink-sky.svg",
  avatar_kind: "identicon",
  banner_kind: "default",
  origin_server: "localhost:7575",
  roles_ids: [],
  pronouns: "they/them",
  custom_status: "reading",
  profile_settings: { frame: "ring", tone: "sky", name_font: "marcellus", card_theme: "tinted" },
  ...over,
});
const me = person({ user_id: "me", username: "ada", pronouns: null, custom_status: null, profile_settings: null });

beforeEach(() => signIn("tok"));

const backend = (users = [me, person()], extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/users/list": { users },
    ...extra,
  });

const message = (over: Partial<Message> = {}): Message => ({
  id: "m1",
  channelId: "c1",
  authorId: "u-bo",
  authorName: "bo",
  authorAvatarUrl: null,
  text: "hello",
  sentAt: "2026-10-20T10:00:00Z",
  editCount: 0,
  editedAt: null,
  reactions: [],
  attachments: [],
  ...over,
});

describe("ProfileCard", () => {
  it("shows the name in the chosen font, the handle, the status line and pronouns", () => {
    renderWithProviders(<ProfileCard profile={person() as never} />);
    const card = within(screen.getByRole("article", { name: "bo's profile" }));
    const name = card.getByRole("heading", { name: "bo" });
    expect(name.getAttribute("style")).toContain("var(--pb-font-display)"); // Marcellus
    expect(card.getByText("bo@localhost:7575")).toBeInTheDocument();
    expect(card.getByText("they/them")).toBeInTheDocument();
    expect(card.getByText("reading")).toBeInTheDocument();
  });

  it("draws a draft instead of the saved settings", () => {
    renderWithProviders(<ProfileCard profile={person() as never} draft={{ ...DEFAULT_SETTINGS, card_theme: "duo", tone: "coral" }} />);
    expect(screen.getByRole("article").getAttribute("style")).toContain("linear-gradient");
  });

  it("shows only the sections that are on, and no buttons unless it was given actions", () => {
    const { rerender } = renderWithProviders(<ProfileCard profile={person({ roles_ids: ["owner"] }) as never} />);
    expect(within(screen.getByRole("list", { name: "Roles" })).getByText("Owner")).toBeInTheDocument();
    expect(screen.queryByText("Also on")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <ProfileCard
        profile={person({ profile_settings: { sections: { badges: false, accounts: true } }, roles_ids: ["owner"] }) as never}
        onMessage={vi.fn()}
      />,
    );
    expect(screen.queryByRole("list", { name: "Roles" })).not.toBeInTheDocument();
    expect(screen.getByText("Also on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Message/ })).toBeInTheDocument();
  });

  it("shows every role as a tag, staff first, with its badge, and folds the rest into +N", () => {
    const roles = ["owner", "coach", "artist", "veteran", "helper", "streamer", "guest"];
    const badge = (tier: string, glyph: string) => ({ tier, tone: "violet", glyph });
    const resolved = [
      { role_id: "coach", role_name: "Coach", badge: badge("community", "target") },
      { role_id: "artist", role_name: "Artist", badge: badge("community", "brush") },
      { role_id: "veteran", role_name: "Veteran", badge: badge("community", "flame") },
      { role_id: "helper", role_name: "Helper", badge: badge("community", "lifebuoy") },
      { role_id: "streamer", role_name: "Streamer", badge: badge("community", "broadcast") },
      { role_id: "guest", role_name: "Guest", badge: badge("system", "globe") },
    ];
    renderWithProviders(<ProfileCard profile={person({ roles_ids: roles, resolved_roles: resolved }) as never} />);
    const list = screen.getByRole("list", { name: "Roles" });
    const tags = within(list).getAllByRole("listitem");
    expect(tags).toHaveLength(6); // five tags and the +2
    expect(tags[0]).toHaveTextContent("Owner");
    expect(tags[0]!.querySelector("svg")).toHaveAttribute("data-tier", "staff");
    expect(tags[1]).toHaveTextContent("Coach");
    expect(tags[5]).toHaveTextContent("+2");
  });

  it("keeps a dot for a role without a badge", () => {
    renderWithProviders(<ProfileCard profile={person({ roles_ids: ["plain"], resolved_roles: [{ role_id: "plain", role_name: "Plain", badge: null }] }) as never} />);
    const tag = within(screen.getByRole("list", { name: "Roles" })).getByText("Plain");
    expect(tag.querySelector("svg")).toBeNull();
    expect(tag.querySelector("span")).not.toBeNull();
  });

  it("is honest when there is no about text", () => {
    renderWithProviders(<ProfileCard profile={person({ about: "" }) as never} />);
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });
});

describe("opening a card from the app", () => {
  it("opens from a member, offers Message, and closes on Escape", async () => {
    backend(undefined, { "GET /api/v1/dms/conversations": { conversations: [] } });
    const { user } = renderWithProviders(
      <ProfileCardProvider>
        <MemberList />
      </ProfileCardProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "View bo's profile" }));

    const dialog = await screen.findByRole("dialog", { name: "bo's profile" });
    expect(within(dialog).getByText("I like fish.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Message/ })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers Edit profile instead of Message on your own card", async () => {
    backend();
    const { user } = renderWithProviders(
      <ProfileCardProvider>
        <MemberList />
      </ProfileCardProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "View ada's profile" }));

    const dialog = await screen.findByRole("dialog", { name: "ada's profile" });
    expect(within(dialog).queryByRole("button", { name: /Message/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Edit profile/ }));
    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/settings");
  });

  it("opens from a message's avatar or name", async () => {
    backend();
    const { user } = renderWithProviders(
      <ProfileCardProvider>
        <MessageItem message={message()} isGroupStart myUserId="me" onEdit={vi.fn()} onToggleReaction={vi.fn()} />
      </ProfileCardProvider>,
    );
    await user.click(screen.getByRole("button", { name: "View bo's profile" }));
    expect(await screen.findByRole("dialog", { name: "bo's profile" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "bo" }));
    expect(await screen.findByRole("dialog", { name: "bo's profile" })).toBeInTheDocument();
  });

  it("closes when you click elsewhere", async () => {
    backend();
    const { user } = renderWithProviders(
      <ProfileCardProvider>
        <MemberList />
        <p>elsewhere</p>
      </ProfileCardProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "View bo's profile" }));
    await screen.findByRole("dialog");

    await user.click(screen.getByText("elsewhere"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open for someone it knows nothing about", async () => {
    backend([me]);
    const { user } = renderWithProviders(
      <ProfileCardProvider>
        <MessageItem message={message({ authorId: "ghost", authorName: "ghost" })} isGroupStart myUserId="me" onEdit={vi.fn()} onToggleReaction={vi.fn()} />
      </ProfileCardProvider>,
    );
    await screen.findByText("hello");
    await user.click(screen.getByRole("button", { name: "View ghost's profile" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("what follows a person into lists", () => {
  it("shows the chosen name style in the member list, and their status line in place of a presence label", async () => {
    backend();
    renderWithProviders(<MemberList />);
    const row = await screen.findByRole("button", { name: "View bo's profile" });

    expect(within(row).getByText("bo").getAttribute("style")).toContain("var(--pb-font-display)");
    expect(within(row).getByText("reading")).toBeInTheDocument();
    // someone with no choices keeps the standard look
    expect(within(screen.getByRole("button", { name: "View ada's profile" })).getByText("ada").getAttribute("style")).toBeNull();
  });
});

void jsonResponse;

describe("ProfileCard, per the Design Language", () => {
  it("is 280 wide with a divider and a more button that copies the handle", async () => {
    const { user } = renderWithProviders(<ProfileCard profile={person() as never} size="compact" onMessage={vi.fn()} />);
    expect(screen.getByRole("article").className).toContain("w-[280px]");
    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy handle" }));
    expect(await navigator.clipboard.readText()).toBe("bo@localhost:7575");
  });
});
