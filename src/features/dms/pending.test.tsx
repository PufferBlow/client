import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flattenMessages, messageKeys, type MessageCache } from "../messages/cache";
import { userKeys } from "../users/hooks";
import { sendDirectMessage, setDirectReaction, uploadAttachment } from "./api";
import { useSendDirectMessage, useToggleDirectReaction } from "./hooks";

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  uploadAttachment: vi.fn(),
  sendDirectMessage: vi.fn(),
  setDirectReaction: vi.fn(),
}));

describe("pending direct messages", () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const rows = () => flattenMessages(client.getQueryData<MessageCache>(messageKeys.channel("dm-1")));

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(userKeys.profile, { user_id: "me", username: "ada", origin_server: "x" });
    client.setQueryData<MessageCache>(messageKeys.channel("dm-1"), { pageParams: ["1"], pages: [{ messages: [], nextCursor: null }] });
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() });
  });

  it("previews files on the pending row and adds a reaction made while sending once it arrives", async () => {
    let finish!: (value: { messageId: string; conversationId: string }) => void;
    vi.mocked(uploadAttachment).mockResolvedValue({ url: "/storage/cat.png", filename: "cat.png", type: "image/png", size: 3 });
    vi.mocked(sendDirectMessage).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    vi.mocked(setDirectReaction).mockResolvedValue([{ emoji: "🎉", count: 1, userIds: ["me"] }]);
    const { result } = renderHook(() => ({ send: useSendDirectMessage("dm-1", "bob"), react: useToggleDirectReaction("dm-1") }), { wrapper });

    await act(async () => {
      void result.current.send.send({ text: "look", files: [new File(["png"], "cat.png", { type: "image/png" })] });
    });
    expect(rows()[0]).toMatchObject({ status: "pending", attachments: [{ url: "blob:preview", filename: "cat.png" }] });

    const localId = rows()[0]!.id;
    await act(() => result.current.react.mutateAsync({ id: localId, emoji: "🎉", present: true }));
    expect(rows()[0]!.reactions).toEqual([{ emoji: "🎉", count: 1, userIds: ["me"] }]);
    expect(setDirectReaction).not.toHaveBeenCalled();

    await act(async () => finish({ messageId: "dm_m1", conversationId: "dm-1" }));
    await waitFor(() => expect(setDirectReaction).toHaveBeenCalledWith("dm_m1", "🎉", true));
    expect(rows()[0]).toMatchObject({ id: "dm_m1", attachments: [{ url: "/storage/cat.png" }], reactions: [{ emoji: "🎉", count: 1 }] });
  });
});
