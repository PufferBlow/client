import { forwardRef, useCallback, useImperativeHandle, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { callLogOf } from "../../features/calls/log";
import type { Message } from "../../features/messages/types";
import { groupMessages } from "../../features/messages/grouping";
import { useChatScroll } from "../../features/messages/useChatScroll";
import type { UserProfile } from "../../features/users/types";
import { copyToClipboard } from "../../lib/clipboard";
import { recordReaction } from "../../lib/reactionUsage";
import { ContextMenu } from "../ui/ContextMenu";
import { EmojiPickerPopover } from "../ui/EmojiPickerPopover";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";
import { classifyAuthError } from "../../utils/authErrors";
import { JumpToPresent } from "./JumpToPresent";
import { DeleteMessageDialog } from "./MessageDialogs";
import { CallLogRow } from "./CallLogRow";
import { MessageItem, type MenuPoint } from "./MessageItem";
import { CHANNEL_PERMISSIONS, messageMenuEntries, type MessagePermissions } from "./messageMenu";

export interface MessageLogHandle {
  /** Scroll a message into view and flash it (it has to be loaded). */
  jumpTo: (id: string) => void;
}

interface MessageLogProps {
  /** The channel or DM conversation; scroll position starts over when it changes. */
  conversationId: string;
  /** Oldest first. */
  messages: Message[];
  isPending: boolean;
  error: unknown;
  onRetryLoad: () => void;
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  me: UserProfile | undefined;
  /** Shown above the first message once all history is loaded. */
  intro: ReactNode;
  /** Shown instead of the log when there are no messages at all. */
  empty: ReactNode;
  onEdit: (id: string, text: string) => Promise<unknown>;
  onReact: (id: string, emoji: string, present: boolean) => Promise<unknown> | void;
  /** The delete mutation: the log asks for confirmation, then runs it. */
  deletion: { mutate: (id: string, options: { onSuccess: () => void }) => void; isPending: boolean; error: unknown; reset: () => void };
  onRetrySend?: (id: string) => void;
  onDiscard?: (id: string) => void;
  onReply: (id: string) => void;
  permissions?: MessagePermissions;
  /** Offered in the menu when the permissions allow it. */
  onReport?: (id: string) => void;
  /** Pin and unpin from the menu: the ids pinned now, and what to do. Omit where the viewer cannot pin. */
  pins?: { ids: ReadonlySet<string>; toggle: (id: string, pin: boolean) => void };
  showToast: (text: string, tone?: "info" | "error") => void;
}

/**
 * A chat log, shared by channels and DMs: the grouped messages with their hover toolbar,
 * right-click menu, reaction picker and delete confirmation, plus scrolling (follows new
 * messages, loads older ones as the top nears, jump-to-present). The header and the composer
 * belong to the caller.
 */
export const MessageLog = forwardRef<MessageLogHandle, MessageLogProps>(function MessageLog(
  {
    conversationId,
    messages,
    isPending,
    error,
    onRetryLoad,
    hasOlder,
    loadingOlder,
    loadOlder,
    me,
    intro,
    empty,
    onEdit,
    onReact,
    deletion,
    onRetrySend,
    onDiscard,
    onReply,
    permissions = CHANNEL_PERMISSIONS,
    onReport,
    pins,
    showToast,
  },
  ref,
) {
  // Everything the menu can target is held as an id and looked up in the live list, so a message
  // edited, deleted or updated in real time can never leave a stale copy behind.
  const [menu, setMenu] = useState<({ id: string } & MenuPoint) | null>(null);
  const [picker, setPicker] = useState<({ id: string } & MenuPoint) | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const rows = useMemo(() => groupMessages(messages), [messages]);

  const byId = (id: string | null) => (id === null ? undefined : messages.find((m) => m.id === id));
  const menuMessage = byId(menu?.id ?? null);
  const pickerMessage = byId(picker?.id ?? null);
  const deleteTarget = byId(deleteId);

  // A message that disappears (deleted elsewhere, history refetched) takes its menu and dialog with it.
  if (menu && !menuMessage) setMenu(null);
  if (picker && !pickerMessage) setPicker(null);

  /** Toggles the reaction on the message the picker was opened for, then closes it. */
  const react = (key: string) => {
    if (!pickerMessage) return;
    const present = pickerMessage.reactions.some((r) => r.emoji === key && me !== undefined && r.userIds.includes(me.user_id));
    handleReaction(pickerMessage.id, key, !present);
    setPicker(null);
  };
  if (deleteId && !deleteTarget) setDeleteId(null);

  // Stable callbacks let memoised rows skip re-rendering when something else changes.
  const handleReaction = useCallback(
    (id: string, emoji: string, present: boolean) => {
      if (present) recordReaction(emoji);
      const result = onReact(id, emoji, present);
      if (result) result.catch((err: unknown) => showToast(classifyAuthError(err, "Couldn't update the reaction.").message, "error"));
    },
    [onReact, showToast],
  );
  const handleOpenMenu = useCallback((id: string, point: MenuPoint) => setMenu({ id, ...point }), []);
  const handleOpenPicker = useCallback((id: string, point: MenuPoint) => setPicker({ id, ...point }), []);
  const handleEditingChange = useCallback((id: string, editing: boolean) => setEditingId(editing ? id : null), []);
  const { reset: resetDelete } = deletion;
  const requestDelete = useCallback(
    (id: string) => {
      resetDelete();
      setDeleteId(id);
    },
    [resetDelete],
  );

  const copy = async (text: string, done: string) => {
    const ok = await copyToClipboard(text);
    showToast(ok ? done : "Couldn't copy to the clipboard.", ok ? "info" : "error");
  };

  const scroll = useChatScroll({ conversationId, messages, myUserId: me?.user_id, hasOlder, loadingOlder, loadOlder });
  const { scrollerRef, release } = scroll;

  const jumpTo = useCallback(
    (id: string) => {
      const row = Array.from(scrollerRef.current?.querySelectorAll<HTMLElement>("[data-message-id]") ?? []).find((el) => el.dataset.messageId === id);
      if (!row) {
        showToast("That message is further back than what's loaded. Load older messages to reach it.", "info");
        return;
      }
      release();
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.focus({ preventScroll: true });
      row.classList.add("bg-primary/15");
      setTimeout(() => row.classList.remove("bg-primary/15"), 1800);
    },
    [showToast, scrollerRef, release],
  );
  useImperativeHandle(ref, () => ({ jumpTo }), [jumpTo]);

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollerRef} onScroll={scroll.onScroll} data-message-list className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2.5">
          {isPending ? (
            <LoadingState message="Loading messages…" shape="messages" />
          ) : error ? (
            <ErrorState title="Couldn't load messages" message={classifyAuthError(error, "Try again.").message} onRetry={onRetryLoad} />
          ) : messages.length === 0 ? (
            empty
          ) : (
            <div ref={scroll.contentRef} className="mt-auto">
              {/* Older history loads as this comes within reach; the button is the fallback. */}
              <div ref={scroll.topSentinelRef} aria-hidden="true" className="h-px" />
              {hasOlder ? (
                <button
                  type="button"
                  onClick={scroll.requestOlder}
                  disabled={loadingOlder}
                  className="mx-auto mb-3 mt-1 flex items-center gap-2 rounded-full bg-surface-secondary px-4 py-1.5 text-[13px] text-text-tertiary hover:text-text disabled:opacity-60"
                >
                  {loadingOlder && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                  {loadingOlder ? "Loading older messages…" : "Load older messages"}
                </button>
              ) : (
                intro
              )}
              {rows.map(({ message, startsGroup }) => {
                // A call's line is drawn as what happened, not as something a person said.
                const call = callLogOf(message.attachments);
                if (call) return <CallLogRow key={message.id} message={message} log={call} myUserId={me?.user_id} />;
                return (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isGroupStart={startsGroup}
                    myUserId={me?.user_id}
                    onEdit={onEdit}
                    onToggleReaction={handleReaction}
                    onOpenMenu={handleOpenMenu}
                    onOpenPicker={handleOpenPicker}
                    editing={editingId === message.id}
                    onEditingChange={handleEditingChange}
                    onRetry={onRetrySend}
                    onDiscard={onDiscard}
                    onReply={onReply}
                    onJumpTo={jumpTo}
                  />
                );
              })}
            </div>
          )}
        </div>
        {scroll.showJumpButton && <JumpToPresent unseen={scroll.unseen} onClick={scroll.jumpToBottom} />}
      </div>

      {menu && menuMessage && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label="Message actions"
          onClose={() => setMenu(null)}
          entries={messageMenuEntries(
            menuMessage,
            me,
            {
              react: (emoji, present) => handleReaction(menuMessage.id, emoji, present),
              openPicker: () => setPicker({ id: menuMessage.id, x: menu.x, y: menu.y }),
              reply: () => onReply(menuMessage.id),
              copyText: () => void copy(menuMessage.text, "Message text copied."),
              copyId: () => void copy(menuMessage.id, "Message ID copied."),
              edit: () => setEditingId(menuMessage.id),
              requestDelete: () => requestDelete(menuMessage.id),
              report: () => onReport?.(menuMessage.id),
              pin: pins && menuMessage.status === undefined ? { pinned: pins.ids.has(menuMessage.id), toggle: () => pins.toggle(menuMessage.id, !pins.ids.has(menuMessage.id)) } : undefined,
            },
            onReport ? permissions : { ...permissions, canReport: () => false },
          )}
        />
      )}

      {picker && pickerMessage && (
        <EmojiPickerPopover
          x={picker.x}
          y={picker.y}
          onClose={() => setPicker(null)}
          onSelect={(emoji) => react(emoji)}
          // A custom emoji or a sticker reacts as `sticker:<id>`, the key the instance keeps for it.
          onCustom={(item) => react(`sticker:${item.sticker_id}`)}
          onSticker={(item) => react(`sticker:${item.sticker_id}`)}
        />
      )}

      {deleteTarget && (
        <DeleteMessageDialog
          message={deleteTarget}
          busy={deletion.isPending}
          error={deletion.error ? classifyAuthError(deletion.error, "Couldn't delete the message.").message : undefined}
          onClose={() => setDeleteId(null)}
          onConfirm={() =>
            deletion.mutate(deleteTarget.id, {
              onSuccess: () => {
                setDeleteId(null);
                showToast("Message deleted.");
              },
            })
          }
        />
      )}
    </>
  );
});
