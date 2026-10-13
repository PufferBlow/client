import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Hash, Lock, Loader2, Users } from "lucide-react";
import { useMarkChannelRead } from "../../features/channels/hooks";
import type { Channel } from "../../features/channels/types";
import type { Message } from "../../features/messages/types";
import { groupMessages } from "../../features/messages/grouping";
import { useDeleteMessage, useEditMessage, useMessages, useReportMessage, useSendMessage, useToggleReaction } from "../../features/messages/hooks";
import { useServerInfo } from "../../features/server/hooks";
import { useMyProfile } from "../../features/users/hooks";
import { useToast } from "../../hooks/useToast";
import { copyToClipboard } from "../../lib/clipboard";
import { ContextMenu } from "../ui/ContextMenu";
import { EmojiPickerPopover } from "../ui/EmojiPickerPopover";
import { ErrorState } from "../ui/ErrorState";
import { ToastRegion } from "../ui/Toast";
import { LoadingState } from "../ui/LoadingState";
import { classifyAuthError } from "../../utils/authErrors";
import { ChannelSearch } from "./ChannelSearch";
import { Composer } from "./Composer";
import { DeleteMessageDialog, ReportMessageDialog } from "./MessageDialogs";
import { MessageItem, type MenuPoint } from "./MessageItem";
import { messageMenuEntries } from "./messageMenu";

const NEAR_BOTTOM_PX = 120;

interface ChatPanelProps {
  channel: Channel;
  /** Whether the member list is showing on the right. */
  membersOpen?: boolean;
  onToggleMembers?: () => void;
}

export function ChatPanel({ channel, membersOpen = false, onToggleMembers }: ChatPanelProps) {
  const channelId = channel.channel_id;
  const { messages, isPending, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useMessages(channelId);
  const { data: me } = useMyProfile();
  const { data: server } = useServerInfo();

  const { send, retry, discard } = useSendMessage(channelId);
  const edit = useEditMessage(channelId);
  const remove = useDeleteMessage(channelId);
  const react = useToggleReaction(channelId);
  const report = useReportMessage();
  const markRead = useMarkChannelRead();
  const { toast, show: showToast } = useToast();

  // Everything the menu can target is held as an id and looked up in the live list below, so a
  // message edited, deleted or updated in real time can never leave a stale copy behind.
  const [menu, setMenu] = useState<({ id: string } & MenuPoint) | null>(null);
  const [picker, setPicker] = useState<({ id: string } & MenuPoint) | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const heightBeforeLoad = useRef<number | null>(null);

  const newestId = messages.at(-1)?.id;
  const rows = useMemo(() => groupMessages(messages), [messages]);

  // Stable callbacks let memoised rows skip re-rendering when something else changes.
  const { mutateAsync: editMessage } = edit;
  const { mutate: toggleReaction } = react;
  const { reset: resetDelete } = remove;
  const handleEdit = useCallback((id: string, text: string) => editMessage({ id, text }), [editMessage]);
    const handleReaction = useCallback(
    (id: string, emoji: string, present: boolean) =>
      toggleReaction({ id, emoji, present }, { onError: (err) => showToast(classifyAuthError(err, "Couldn't update the reaction.").message, "error") }),
    [toggleReaction, showToast],
  );
  const handleOpenMenu = useCallback((id: string, point: MenuPoint) => setMenu({ id, ...point }), []);
  const handleOpenPicker = useCallback((id: string, point: MenuPoint) => setPicker({ id, ...point }), []);
  const handleEditingChange = useCallback((id: string, editing: boolean) => setEditingId(editing ? id : null), []);
  const handleRequestDelete = useCallback(
    (id: string) => {
      resetDelete();
      setDeleteId(id);
    },
    [resetDelete],
  );

  const byId = (id: string | null) => (id === null ? undefined : messages.find((m) => m.id === id));
  const menuMessage = byId(menu?.id ?? null);
  const pickerMessage = byId(picker?.id ?? null);
  const deleteMessageTarget = byId(deleteId);
  const reportTarget = byId(reportId);

  // A message that disappears (deleted elsewhere, history refetched) takes its menu and dialogs with it.
  if (menu && !menuMessage) setMenu(null);
  if (picker && !pickerMessage) setPicker(null);
  if (deleteId && !deleteMessageTarget) setDeleteId(null);
  if (reportId && !reportTarget) setReportId(null);

  const copy = async (text: string, done: string) => {
    const ok = await copyToClipboard(text);
    showToast(ok ? done : "Couldn't copy to the clipboard.", ok ? "info" : "error");
  };

  // Keep the channel read while it is open: once on entry, and again as new messages arrive.
  useEffect(() => {
    if (newestId !== undefined) markRead.mutate(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `markRead` is a new object each render
  }, [channelId, newestId]);

  // Scroll behaviour: restore position after older messages are prepended, otherwise follow new ones.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (heightBeforeLoad.current !== null) {
      el.scrollTop += el.scrollHeight - heightBeforeLoad.current;
      heightBeforeLoad.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, channelId]);

  useEffect(() => {
    stickToBottom.current = true;
  }, [channelId]);

  const handleScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const loadOlder = () => {
    heightBeforeLoad.current = scroller.current?.scrollHeight ?? null;
    void fetchNextPage();
  };

  /** Scroll a search result into view and flash it. Older messages that are not loaded cannot be reached from here. */
  const jumpTo = (message: Message) => {
    const row = Array.from(scroller.current?.querySelectorAll<HTMLElement>("[data-message-id]") ?? []).find((el) => el.dataset.messageId === message.id);
    if (!row) {
      showToast("That message is further back than what's loaded. Load older messages to reach it.", "info");
      return;
    }
    stickToBottom.current = false;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.focus({ preventScroll: true });
    row.classList.add("bg-primary/15");
    setTimeout(() => row.classList.remove("bg-primary/15"), 1800);
  };

  const Icon = channel.is_private ? Lock : Hash;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[14px] bg-surface" aria-label={`#${channel.channel_name}`}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-secondary px-[18px]">
        <Icon size={18} className="text-text-tertiary" aria-hidden="true" />
        <h1 className="m-0 font-heading text-[19px] font-semibold">{channel.channel_name}</h1>
        <div className="ml-auto flex items-center gap-1">
          <ChannelSearch channelId={channelId} channelName={channel.channel_name} onPick={jumpTo} />
          {onToggleMembers && (
            <button
              type="button"
              aria-label={membersOpen ? "Hide member list" : "Show member list"}
              aria-pressed={membersOpen}
              title={membersOpen ? "Hide member list" : "Show member list"}
              onClick={onToggleMembers}
              className={`grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-surface-secondary hover:text-text focus-visible:outline-2 focus-visible:outline-focus ${
                membersOpen ? "bg-surface-secondary text-primary" : "text-text-tertiary"
              }`}
            >
              <Users size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div ref={scroller} onScroll={handleScroll} data-message-list className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2.5">
        {isPending ? (
          <LoadingState message="Loading messages…" />
        ) : error ? (
          <ErrorState title="Couldn't load messages" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />
        ) : (
          <>
            {hasNextPage && (
              <button
                type="button"
                onClick={loadOlder}
                disabled={isFetchingNextPage}
                className="mx-auto mb-3 mt-1 flex items-center gap-2 rounded-full bg-surface-secondary px-4 py-1.5 text-[13px] text-text-tertiary hover:text-text disabled:opacity-60"
              >
                {isFetchingNextPage && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                Load older messages
              </button>
            )}
            {messages.length === 0 ? (
              <p className="m-auto text-sm text-text-muted">No messages in #{channel.channel_name} yet. Say hello.</p>
            ) : (
              <div className="mt-auto">
                {rows.map(({ message, startsGroup }) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isGroupStart={startsGroup}
                    myUserId={me?.user_id}
                    onEdit={handleEdit}
                    onDelete={handleRequestDelete}
                    onToggleReaction={handleReaction}
                    onOpenMenu={handleOpenMenu}
                    onOpenPicker={handleOpenPicker}
                    editing={editingId === message.id}
                    onEditingChange={handleEditingChange}
                    onRetry={retry}
                    onDiscard={discard}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Composer
        channelName={channel.channel_name}
        maxLength={server?.max_message_length ?? undefined}
        maxAttachmentMB={server?.max_total_attachment_size ?? undefined}
        onSend={send}
      />

      {menu && menuMessage && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label="Message actions"
          onClose={() => setMenu(null)}
          entries={messageMenuEntries(menuMessage, me, {
            react: (emoji, present) => handleReaction(menuMessage.id, emoji, present),
            openPicker: () => setPicker({ id: menuMessage.id, x: menu.x, y: menu.y }),
            copyText: () => void copy(menuMessage.text, "Message text copied."),
            copyId: () => void copy(menuMessage.id, "Message ID copied."),
            edit: () => setEditingId(menuMessage.id),
            requestDelete: () => handleRequestDelete(menuMessage.id),
            report: () => {
              report.reset();
              setReportId(menuMessage.id);
            },
          })}
        />
      )}

      {picker && pickerMessage && (
        <EmojiPickerPopover
          x={picker.x}
          y={picker.y}
          onClose={() => setPicker(null)}
          onSelect={(emoji) => {
            const present = pickerMessage.reactions.some((r) => r.emoji === emoji && me !== undefined && r.userIds.includes(me.user_id));
            handleReaction(pickerMessage.id, emoji, !present);
            setPicker(null);
          }}
        />
      )}

      {deleteMessageTarget && (
        <DeleteMessageDialog
          message={deleteMessageTarget}
          busy={remove.isPending}
          error={remove.error ? classifyAuthError(remove.error, "Couldn't delete the message.").message : undefined}
          onClose={() => setDeleteId(null)}
          onConfirm={() =>
            remove.mutate(deleteMessageTarget.id, {
              onSuccess: () => {
                setDeleteId(null);
                showToast("Message deleted.");
              },
            })
          }
        />
      )}

      {reportTarget && (
        <ReportMessageDialog
          message={reportTarget}
          busy={report.isPending}
          error={report.error ? classifyAuthError(report.error, "Couldn't send the report.").message : undefined}
          onClose={() => setReportId(null)}
          onSubmit={(category, description) =>
            report.mutate(
              { id: reportTarget.id, category, description },
              {
                onSuccess: () => {
                  setReportId(null);
                  showToast("Report sent. Thank you.");
                },
              },
            )
          }
        />
      )}

      <ToastRegion toast={toast} />
    </section>
  );
}
