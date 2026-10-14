import { useCallback, useRef } from "react";
import { useMessageCommands } from "../realtime/commandsContext";
import type { TypingTarget } from "../realtime/messageCommands";

/**
 * How often to repeat `typing.start` while someone keeps typing. Well inside the server's 8 s
 * expiry, so the indicator doesn't flicker off between announcements.
 */
export const TYPING_REPEAT_MS = 5_000;

/**
 * Returns `notify`, to call on every keystroke, and `reset`, to call when the message is sent.
 * Announcements are throttled to one per {@link TYPING_REPEAT_MS}; failures are ignored (typing is
 * a hint, never worth an error).
 */
export function useTypingNotifier(target: TypingTarget) {
  const commands = useMessageCommands();
  const lastSent = useRef(0);
  const { channelId, conversationId } = target;

  const notify = useCallback(() => {
    if (!commands) return;
    const now = Date.now();
    if (now - lastSent.current < TYPING_REPEAT_MS) return;
    lastSent.current = now;
    const announce = conversationId ? { conversationId } : { channelId: channelId ?? "" };
    void Promise.resolve()
      .then(() => commands.startTyping(announce))
      .catch(() => undefined);
  }, [commands, channelId, conversationId]);

  // After sending, the next keystroke starts a new message and should announce right away.
  const reset = useCallback(() => {
    lastSent.current = 0;
  }, []);

  return { notify, reset };
}
