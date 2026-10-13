import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Message } from "./types";

/** Within this many pixels of the bottom counts as "at the bottom" (new messages follow). */
const STICK_PX = 120;
/** Further up than this, the jump-to-bottom button shows. */
const JUMP_BUTTON_PX = 400;
/** Start fetching older history this far before the top is actually reached. */
const PRELOAD_MARGIN_PX = 600;

interface Options {
  /** Changes when the conversation does: scroll state starts over at the bottom. */
  conversationId: string;
  /** Oldest first. */
  messages: Message[];
  myUserId: string | undefined;
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
}

/**
 * Scrolling for a chat log: follows new messages while the reader is at the bottom (also while
 * images and embeds finish loading and change the height), always follows the reader's own new
 * message, loads older history as the top comes near and keeps the reader's place when it lands,
 * and tracks how far up they are for a jump-to-bottom button with an unseen-message count.
 */
export function useChatScroll({ conversationId, messages, myUserId, hasOlder, loadingOlder, loadOlder }: Options) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const heightBeforePrepend = useRef<number | null>(null);
  const [farFromBottom, setFarFromBottom] = useState(false);
  const [unseen, setUnseen] = useState(0);

  const oldestId = messages[0]?.id;
  const hasMessages = messages.length > 0;
  const newest = messages.at(-1);
  const previous = useRef<{ conversationId: string; oldestId?: string; newestId?: string; count: number }>({ conversationId, count: 0 });

  const toBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (!el) return;
    if (smooth && typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  }, []);

  // React to the list changing: a new conversation, older history prepended, or new messages.
  useLayoutEffect(() => {
    const el = scroller.current;
    const before = previous.current;
    previous.current = { conversationId, oldestId, newestId: newest?.id, count: messages.length };
    if (!el) return;

    if (before.conversationId !== conversationId) {
      stick.current = true;
      heightBeforePrepend.current = null;
      setUnseen(0);
      setFarFromBottom(false);
      toBottom();
      return;
    }

    if (heightBeforePrepend.current !== null && before.oldestId !== oldestId) {
      // Older messages landed above: keep what the reader was looking at in place.
      el.scrollTop += el.scrollHeight - heightBeforePrepend.current;
      heightBeforePrepend.current = null;
      return;
    }

    if (newest && newest.id !== before.newestId) {
      const mine = myUserId !== undefined && newest.authorId === myUserId;
      if (stick.current || mine) {
        stick.current = true;
        setUnseen(0);
        toBottom();
      } else if (before.newestId !== undefined && messages.length > before.count) {
        setUnseen((n) => n + (messages.length - before.count));
      }
    }
  }, [conversationId, oldestId, newest, messages.length, myUserId, toBottom]);

  // Stay pinned while content below the fold grows (images, embeds, code highlighting).
  useEffect(() => {
    const el = content.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stick.current && heightBeforePrepend.current === null) toBottom();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // `hasMessages`: the content element only exists once the first page is in.
  }, [toBottom, conversationId, hasMessages]);

  const requestOlder = useCallback(() => {
    if (!hasOlder || loadingOlder) return;
    heightBeforePrepend.current = scroller.current?.scrollHeight ?? null;
    loadOlder();
  }, [hasOlder, loadingOlder, loadOlder]);

  // Load older history as the top comes into reach.
  useEffect(() => {
    const root = scroller.current;
    const sentinel = topSentinel.current;
    if (!root || !sentinel || !hasOlder || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) requestOlder();
      },
      { root, rootMargin: `${PRELOAD_MARGIN_PX}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlder, requestOlder, messages.length]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick.current = distance < STICK_PX;
    setFarFromBottom(distance > JUMP_BUTTON_PX);
    if (stick.current) setUnseen(0);
  }, []);

  const jumpToBottom = useCallback(() => {
    stick.current = true;
    setUnseen(0);
    setFarFromBottom(false);
    toBottom(true);
  }, [toBottom]);

  /** Stop following new messages, e.g. while the reader is taken to an older one. */
  const release = useCallback(() => {
    stick.current = false;
  }, []);

  return {
    scrollerRef: scroller,
    contentRef: content,
    topSentinelRef: topSentinel,
    onScroll,
    requestOlder,
    jumpToBottom,
    release,
    showJumpButton: farFromBottom || unseen > 0,
    unseen,
  };
}
