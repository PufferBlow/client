import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { Composer } from "../../components/dashboard/Composer";
import type { Message } from "../messages/types";
import { applyEvent } from "../realtime/applyEvent";
import { MessageCommandsContext } from "../realtime/commandsContext";
import { toRealtimeEvent } from "../realtime/events";
import type { MessageCommands } from "../realtime/messageCommands";
import { parseServerFrame, type EventFrame } from "../realtime/protocol";
import fixture from "../realtime/__fixtures__/event_typing_started.json";
import { userKeys } from "../users/hooks";
import { typingLabel } from "./label";
import { clearTyping, noteTyping, useTypingUsers } from "./store";
import { TYPING_REPEAT_MS, useTypingNotifier } from "./useTypingNotifier";

describe("typing store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows someone until their announcement expires, and a renewal keeps them", () => {
    const { result } = renderHook(() => useTypingUsers("c1"));
    act(() => noteTyping("c1", "ada", 8000));
    expect(result.current).toEqual(["ada"]);

    act(() => vi.advanceTimersByTime(6000));
    act(() => noteTyping("c1", "ada", 8000)); // renewed
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current).toEqual(["ada"]);

    act(() => vi.advanceTimersByTime(2001));
    expect(result.current).toEqual([]);
  });

  it("keeps scopes apart and drops someone as soon as they are cleared", () => {
    const { result } = renderHook(() => useTypingUsers("c1"));
    act(() => {
      noteTyping("c1", "ada", 8000);
      noteTyping("c1", "bob", 8000);
      noteTyping("c2", "cy", 8000);
    });
    expect(result.current).toEqual(["ada", "bob"]);

    act(() => clearTyping("c1", "ada"));
    expect(result.current).toEqual(["bob"]);
  });

  it("keeps the same snapshot while nothing changes", () => {
    act(() => noteTyping("c1", "ada", 8000));
    const { result, rerender } = renderHook(() => useTypingUsers("c1"));
    const first = result.current;
    act(() => noteTyping("c1", "ada", 8000)); // a renewal is not a change
    rerender();
    expect(result.current).toBe(first);
  });
});

describe("typing events", () => {
  const frame = () => parseServerFrame(JSON.stringify(fixture.frame)) as EventFrame;

  it("maps the shared fixture", () => {
    expect(toRealtimeEvent(frame())).toEqual({ kind: "typing", scope: "c_general", userId: "u_ada", expiresInMs: 8000 });
  });

  it("scopes a DM to its conversation and caps a silly expiry", () => {
    const dm = { ...frame(), channelId: null, data: { conversation_id: "dm-1", user_id: "u_ada", expires_in_ms: 10 ** 9 } };
    expect(toRealtimeEvent(dm)).toEqual({ kind: "typing", scope: "dm-1", userId: "u_ada", expiresInMs: 30_000 });
  });

  it("ignores an event with no one in it", () => {
    expect(toRealtimeEvent({ ...frame(), data: { channel_id: "c1" } })).toBeNull();
  });
});

describe("applyEvent and typing", () => {
  const message = { id: "m1", channelId: "c1", authorId: "ada", authorName: "ada", authorAvatarUrl: null, text: "hi", sentAt: "t", attachments: [], reactions: [], editCount: 0, editedAt: null } satisfies Message;

  it("notes others typing, not yourself, and a message from them ends it", () => {
    const client = new QueryClient();
    client.setQueryData(userKeys.profile, { user_id: "me", username: "me" });
    const { result } = renderHook(() => useTypingUsers("c1"));

    act(() => {
      applyEvent(client, { kind: "typing", scope: "c1", userId: "me", expiresInMs: 8000 }, { activeChannelId: "c1" });
      applyEvent(client, { kind: "typing", scope: "c1", userId: "ada", expiresInMs: 8000 }, { activeChannelId: "c1" });
    });
    expect(result.current).toEqual(["ada"]);

    act(() => applyEvent(client, { kind: "message", message }, { activeChannelId: "c1" }));
    expect(result.current).toEqual([]);
  });
});

describe("useTypingNotifier", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (target: Parameters<typeof useTypingNotifier>[0]) => {
    const startTyping = vi.fn().mockResolvedValue(true);
    const commands = { startTyping } as unknown as MessageCommands;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MessageCommandsContext.Provider value={commands}>{children}</MessageCommandsContext.Provider>
    );
    const { result } = renderHook(() => useTypingNotifier(target), { wrapper });
    return { startTyping, result };
  };

  it("announces at most once per repeat interval, and again right after a send", async () => {
    const { startTyping, result } = setup({ channelId: "c1" });

    result.current.notify();
    result.current.notify();
    await vi.advanceTimersByTimeAsync(0);
    expect(startTyping).toHaveBeenCalledTimes(1);
    expect(startTyping).toHaveBeenCalledWith({ channelId: "c1" });

    await vi.advanceTimersByTimeAsync(TYPING_REPEAT_MS);
    result.current.notify();
    await vi.advanceTimersByTimeAsync(0);
    expect(startTyping).toHaveBeenCalledTimes(2);

    result.current.reset();
    result.current.notify();
    await vi.advanceTimersByTimeAsync(0);
    expect(startTyping).toHaveBeenCalledTimes(3);
  });

  it("addresses a DM by its conversation", async () => {
    const { startTyping, result } = setup({ conversationId: "dm-1" });
    result.current.notify();
    await vi.advanceTimersByTimeAsync(0);
    expect(startTyping).toHaveBeenCalledWith({ conversationId: "dm-1" });
  });

  it("does nothing without a connection", () => {
    const { result } = renderHook(() => useTypingNotifier({ channelId: "c1" }));
    expect(() => result.current.notify()).not.toThrow();
  });
});

describe("typing in the composer", () => {
  it("reads naturally for one to three people, then generalises", () => {
    expect(typingLabel(["Ada"])).toEqual({ names: ["Ada"], rest: " is typing…" });
    expect(typingLabel(["Ada", "Bob"]).rest).toBe(" are typing…");
    expect(typingLabel(["A", "B", "C", "D"])).toEqual({ names: [], rest: "Several people are typing…" });
  });

  it("reports typing as the user writes, but not for whitespace", async () => {
    const onTyping = vi.fn();
    render(<Composer channelName="general" onSend={vi.fn()} onTyping={onTyping} />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: "Message #general" }), "  ");
    expect(onTyping).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox", { name: "Message #general" }), "hi");
    expect(onTyping).toHaveBeenCalled();
  });

  it("shows who is typing under the field", () => {
    render(<Composer channelName="general" onSend={vi.fn()} typingNames={["Ada", "Bob", "Cy"]} />);
    expect(screen.getByText(/are typing…/).closest("[aria-live]")).toHaveTextContent("Ada, Bob and Cy are typing…");
  });
});
