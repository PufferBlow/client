import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useChatScroll } from "./useChatScroll";
import type { Message } from "./types";

const msg = (id: string, authorId = "other"): Message => ({
  id,
  channelId: "c1",
  authorId,
  authorName: authorId,
  authorAvatarUrl: null,
  text: id,
  sentAt: "2030-01-01T00:00:00Z",
  attachments: [],
  reactions: [],
  editCount: 0,
  editedAt: null,
});

/** jsdom has no layout: give the scroller the metrics a real one would have. */
const metrics = { scrollHeight: 2000, clientHeight: 500 };

let observed: IntersectionObserverCallback | null = null;
beforeEach(() => {
  observed = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observed = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

interface HarnessProps {
  messages: Message[];
  hasOlder?: boolean;
  loadOlder?: () => void;
  conversationId?: string;
}

function Harness({ messages, hasOlder = false, loadOlder = () => undefined, conversationId = "c1" }: HarnessProps) {
  const scroll = useChatScroll({ conversationId, messages, myUserId: "me", hasOlder, loadingOlder: false, loadOlder });
  return (
    <div>
      <div
        data-testid="scroller"
        ref={(el) => {
          scroll.scrollerRef.current = el;
          if (el) {
            Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => metrics.scrollHeight });
            Object.defineProperty(el, "clientHeight", { configurable: true, get: () => metrics.clientHeight });
          }
        }}
        onScroll={scroll.onScroll}
      >
        <div ref={scroll.contentRef}>
          <div ref={scroll.topSentinelRef} />
          {messages.map((m) => (
            <p key={m.id}>{m.text}</p>
          ))}
        </div>
      </div>
      {scroll.showJumpButton && (
        <button onClick={scroll.jumpToBottom}>{scroll.unseen > 0 ? `${scroll.unseen} new` : "Jump to present"}</button>
      )}
    </div>
  );
}

const scroller = () => screen.getByTestId("scroller");
const scrollTo = (top: number) => {
  scroller().scrollTop = top;
  fireEvent.scroll(scroller());
};

describe("useChatScroll", () => {
  it("opens at the bottom", () => {
    render(<Harness messages={[msg("a"), msg("b")]} />);
    expect(scroller().scrollTop).toBe(metrics.scrollHeight);
  });

  it("follows new messages while at the bottom", () => {
    const { rerender } = render(<Harness messages={[msg("a")]} />);
    scrollTo(1500); // at the bottom: 2000 - 1500 - 500 = 0
    rerender(<Harness messages={[msg("a"), msg("b")]} />);
    expect(scroller().scrollTop).toBe(metrics.scrollHeight);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("stays put and counts new messages while scrolled up, then jumps back down", () => {
    const { rerender } = render(<Harness messages={[msg("a")]} />);
    scrollTo(200);
    expect(screen.getByRole("button", { name: "Jump to present" })).toBeInTheDocument();

    rerender(<Harness messages={[msg("a"), msg("b"), msg("c")]} />);
    expect(scroller().scrollTop).toBe(200);
    fireEvent.click(screen.getByRole("button", { name: "2 new" }));

    expect(scroller().scrollTop).toBe(metrics.scrollHeight);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("always follows the reader's own new message", () => {
    const { rerender } = render(<Harness messages={[msg("a")]} />);
    scrollTo(200);
    rerender(<Harness messages={[msg("a"), msg("mine", "me")]} />);
    expect(scroller().scrollTop).toBe(metrics.scrollHeight);
  });

  it("loads older history as the top comes into reach, keeping the reader's place", () => {
    const loadOlder = vi.fn();
    const { rerender } = render(<Harness messages={[msg("b")]} hasOlder loadOlder={loadOlder} />);
    scrollTo(300);

    act(() => observed?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(loadOlder).toHaveBeenCalledTimes(1);

    metrics.scrollHeight = 2600; // the older page added 600px above
    rerender(<Harness messages={[msg("a"), msg("b")]} hasOlder loadOlder={loadOlder} />);
    expect(scroller().scrollTop).toBe(900);
    metrics.scrollHeight = 2000;
  });

  it("starts over at the bottom in another conversation", () => {
    const { rerender } = render(<Harness messages={[msg("a")]} />);
    scrollTo(100);
    rerender(<Harness messages={[msg("x")]} conversationId="c2" />);
    expect(scroller().scrollTop).toBe(metrics.scrollHeight);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
