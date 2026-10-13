import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Message } from "../../features/messages/types";
import type * as DmsApi from "../../features/dms/api";
import { readOutgoing } from "../../features/dms/outgoing";
import { galleryRows } from "../../lib/files";
import { MessageItem } from "./MessageItem";

const forwardMessage = vi.fn();
vi.mock("../../features/dms/api", async (importOriginal) => ({
  ...(await importOriginal<typeof DmsApi>()),
  forwardMessage: (...args: unknown[]) => forwardMessage(...args),
}));
vi.mock("../../features/dms/hooks", () => ({
  useConversations: () => ({
    isPending: false,
    error: null,
    data: [
      { id: "d1", peerUserId: "u1", peerUsername: "ann", peerHost: "home.example", peerAvatarUrl: null },
      { id: "d2", peerUserId: "u2", peerUsername: "bob", peerHost: "far.example", peerAvatarUrl: null },
    ],
  }),
}));
vi.mock("../../features/channels/hooks", () => ({
  useChannels: () => ({
    data: [
      { channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "" },
      { channel_id: "c2", channel_name: "lounge", channel_type: "voice", is_private: false, created_at: "" },
    ],
  }),
}));
vi.mock("../../features/users/hooks", () => ({ useMyProfile: () => ({ data: { user_id: "me", origin_server: "home.example" } }) }));

const image = (n: number) => ({ url: `https://cdn.example/${n}.png`, filename: `pic${n}.png`, type: "image/png" });
const video = { url: "https://cdn.example/clip.mp4", filename: "clip.mp4", type: "video/mp4" };

const message = (attachments: Message["attachments"]): Message => ({
  id: "m1",
  channelId: "c1",
  authorId: "u-other",
  authorName: "grace",
  authorAvatarUrl: null,
  text: "",
  sentAt: "2030-01-01T12:30:00Z",
  attachments,
  reactions: [],
  editCount: 0,
  editedAt: null,
});

const renderItem = (attachments: Message["attachments"]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MessageItem message={message(attachments)} myUserId="me" onEdit={vi.fn()} onToggleReaction={vi.fn()} />
    </QueryClientProvider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
  forwardMessage.mockReset();
});

describe("galleryRows", () => {
  it("splits tiles into Discord-style rows", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 10].map(galleryRows)).toEqual([[1], [2], [1, 2], [2, 2], [2, 3], [3, 3], [1, 3, 3], [1, 3, 3, 3]]);
    expect(galleryRows(0)).toEqual([]);
  });
});

describe("attachment viewer", () => {
  it("opens an image full screen and closes again", async () => {
    const user = userEvent.setup();
    renderItem([image(1)]);

    await user.click(screen.getByRole("button", { name: "Open pic1.png" }));
    const viewer = screen.getByRole("dialog", { name: "Viewing pic1.png" });
    expect(within(viewer).getByRole("img", { name: "pic1.png" })).toBeInTheDocument();
    for (const name of ["Zoom in", "Zoom out", "Forward", "Download", "Close"]) {
      expect(within(viewer).getByRole("button", { name })).toBeInTheDocument();
    }

    await user.click(within(viewer).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open pic1.png" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("zooms an image within its limits", async () => {
    const user = userEvent.setup();
    renderItem([image(1)]);
    await user.click(screen.getByRole("button", { name: "Open pic1.png" }));
    const viewer = screen.getByRole("dialog");

    expect(within(viewer).getByRole("button", { name: "Zoom out" })).toBeDisabled();
    await user.click(within(viewer).getByRole("button", { name: "Zoom in" }));
    expect(within(viewer).getByRole("img", { name: "pic1.png" }).style.transform).toContain("scale(1.5)");
    expect(within(viewer).getByRole("button", { name: "Zoom out" })).toBeEnabled();
  });

  it("opens a video with controls and no zoom", async () => {
    const user = userEvent.setup();
    renderItem([video]);
    await user.click(screen.getByRole("button", { name: "Open clip.mp4" }));

    const viewer = screen.getByRole("dialog", { name: "Viewing clip.mp4" });
    expect(viewer.querySelector("video")).toHaveAttribute("controls");
    expect(within(viewer).queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
    expect(within(viewer).getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("steps through several attachments with the arrows and the keyboard", async () => {
    const user = userEvent.setup();
    renderItem([image(1), image(2), image(3)]);
    await user.click(screen.getByRole("button", { name: "Open pic2.png" }));

    const viewer = screen.getByRole("dialog", { name: "Viewing pic2.png" });
    await user.click(within(viewer).getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Viewing pic3.png" })).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Viewing pic1.png" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Show pic2.png" }));
    expect(screen.getByRole("dialog", { name: "Viewing pic2.png" })).toBeInTheDocument();
  });

  it("reveals a spoiler before it can be opened", async () => {
    const user = userEvent.setup();
    renderItem([{ ...image(1), filename: "SPOILER_pic1.png" }]);

    await user.click(screen.getByRole("button", { name: "Spoiler attachment pic1.png, select to reveal" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open pic1.png" }));
    expect(screen.getByRole("dialog", { name: "Viewing pic1.png" })).toBeInTheDocument();
  });

  it("forwards the message to a conversation, addressing a remote peer as name@host", async () => {
    const user = userEvent.setup();
    forwardMessage.mockResolvedValue({ conversationId: "dm-9" });
    renderItem([image(1)]);
    await user.click(screen.getByRole("button", { name: "Open pic1.png" }));
    await user.click(screen.getByRole("button", { name: "Forward" }));

    const dialog = screen.getByRole("dialog", { name: "Forward to" });
    await user.click(within(dialog).getByRole("button", { name: /bob/ }));

    await waitFor(() => expect(forwardMessage).toHaveBeenCalledWith("m1", { peer: "bob@far.example" }));
    expect(await screen.findByText("Forwarded to bob.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Forward to" })).not.toBeInTheDocument();
  });

  it("forwards the message into a text channel of this server, skipping voice channels", async () => {
    const user = userEvent.setup();
    forwardMessage.mockResolvedValue({ conversationId: null });
    renderItem([image(1)]);
    await user.click(screen.getByRole("button", { name: "Open pic1.png" }));
    await user.click(screen.getByRole("button", { name: "Forward" }));

    const dialog = screen.getByRole("dialog", { name: "Forward to" });
    expect(within(dialog).queryByRole("button", { name: /lounge/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /general/ }));

    await waitFor(() => expect(forwardMessage).toHaveBeenCalledWith("m1", { channelId: "c1" }));
    expect(await screen.findByText("Forwarded to #general.")).toBeInTheDocument();
    expect(readOutgoing("me")).toEqual([]); // a channel is not a DM conversation
  });

  it("uses the bare username for someone on this instance", async () => {
    const user = userEvent.setup();
    forwardMessage.mockResolvedValue({ conversationId: "dm-9" });
    renderItem([image(1)]);
    await user.click(screen.getByRole("button", { name: "Open pic1.png" }));
    await user.click(screen.getByRole("button", { name: "Forward" }));
    await user.click(within(screen.getByRole("dialog", { name: "Forward to" })).getByRole("button", { name: /ann/ }));

    await waitFor(() => expect(forwardMessage).toHaveBeenCalledWith("m1", { peer: "ann" }));
  });

  it("forwards to an address on another server, and only accepts a valid one", async () => {
    const user = userEvent.setup();
    forwardMessage.mockResolvedValue({ conversationId: "dm-9" });
    renderItem([image(1)]);
    await user.click(screen.getByRole("button", { name: "Open pic1.png" }));
    await user.click(screen.getByRole("button", { name: "Forward" }));

    const send = screen.getByRole("button", { name: "Forward to this address" });
    const field = screen.getByLabelText("Address on another server");
    await user.type(field, "carol");
    expect(send).toBeDisabled();
    await user.type(field, "@elsewhere.example");
    await user.click(send);

    await waitFor(() => expect(forwardMessage).toHaveBeenCalledWith("m1", { peer: "carol@elsewhere.example" }));
    expect(await screen.findByText("Forwarded to carol@elsewhere.example.")).toBeInTheDocument();
    // The server won't list a first message to someone new until they answer, so it is kept locally.
    expect(readOutgoing("me")).toMatchObject([{ id: "dm-9", peerUsername: "carol", peerHost: "elsewhere.example" }]);
  });

  it("says so when forwarding fails and stays open", async () => {
    const user = userEvent.setup();
    forwardMessage.mockRejectedValue(new Error("nope"));
    renderItem([image(1)]);
    await user.click(screen.getByRole("button", { name: "Open pic1.png" }));
    await user.click(screen.getByRole("button", { name: "Forward" }));
    await user.click(within(screen.getByRole("dialog", { name: "Forward to" })).getByRole("button", { name: /ann/ }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Forward to" })).toBeInTheDocument();
  });
});

describe("forwarded messages", () => {
  it("are marked as forwarded without saying where from", () => {
    render(
      <MessageItem
        message={{ ...message([]), text: "look at this", forwarded: true }}
        myUserId="me"
        onEdit={vi.fn()}
        onToggleReaction={vi.fn()}
      />,
    );
    expect(screen.getByText("Forwarded")).toBeInTheDocument();
    expect(screen.getByText("look at this")).toBeInTheDocument();
  });

  it("have no label otherwise", () => {
    render(<MessageItem message={{ ...message([]), text: "plain" }} myUserId="me" onEdit={vi.fn()} onToggleReaction={vi.fn()} />);
    expect(screen.queryByText("Forwarded")).not.toBeInTheDocument();
  });
});
