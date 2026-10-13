import { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Lock, Loader2, Users } from "lucide-react";
import { useMarkChannelRead } from "../../features/channels/hooks";
import type { Channel } from "../../features/channels/types";
import type { Message } from "../../features/messages/types";
import { groupMessages } from "../../features/messages/grouping";
import { useChatScroll } from "../../features/messages/useChatScroll";
import { useDeleteMessage, useEditMessage, useMessages, useReportMessage, useSendMessage, useToggleReaction } from "../../features/messages/hooks";
import { useServerInfo } from "../../features/server/hooks";
import { useMyProfile } from "../../features/users/hooks";
import { useToast } from "../../hooks/useToast";
import { copyToClipboard } from "../../lib/clipboard";
import { recordReaction, useTopReactions } from "../../lib/reactionUsage";
import { ContextMenu } from "../ui/ContextMenu";
import { EmojiPickerPopover } from "../ui/EmojiPickerPopover";
import { ErrorState } from "../ui/ErrorState";
import { ToastRegion } from "../ui/Toast";
import { LoadingState } from "../ui/LoadingState";
import { classifyAuthError } from "../../utils/authErrors";
import { ChannelSearch } from "./ChannelSearch";
import { Composer } from "./Composer";
import { JumpToPresent } from "./JumpToPresent";
import { DeleteMessageDialog, ReportMessageDialog } from "./MessageDialogs";
import { MessageItem, type MenuPoint } from "./MessageItem";
import { messageMenuEntries } from "./messageMenu";

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
  // Held with its channel so switching channels can't carry a reply over.
  const [reply, setReply] = useState<{ channelId: string; id: string } | null>(null);


  const newestId = messages.at(-1)?.id;
  const rows = useMemo(() => groupMessages(messages), [messages]);

  // Stable callbacks let memoised rows skip re-rendering when something else changes.
  const { mutateAsync: editMessage } = edit;
  const { mutate: toggleReaction } = react;
  const { reset: resetDelete } = remove;
  const handleEdit = useCallback((id: string, text: string) => editMessage({ id, text }), [editMessage]);
    const handleReaction = useCallback(
    (id: string, emoji: string, present: boolean) => {
      if (present) recordReaction(emoji);
      toggleReaction({ id, emoji, present }, { onError: (err) => showToast(classifyAuthError(err, "Couldn't update the reaction.").message, "error") });
    },
    [toggleReaction, showToast],
  );
  const topReactions = useTopReactions(4);
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
  const replyTarget = reply?.channelId === channelId ? byId(reply.id) : undefined;

  // A message that disappears (deleted elsewhere, history refetched) takes its menu and dialogs with it.
  if (menu && !menuMessage) setMenu(null);
  if (picker && !pickerMessage) setPicker(null);
  if (deleteId && !deleteMessageTarget) setDeleteId(null);
  if (reportId && !reportTarget) setReportId(null);
  if (reply && !replyTarget) setReply(null);

  const handleReply = useCallback((id: string) => setReply({ channelId, id }), [channelId]);
  const cancelReply = useCallback(() => setReply(null), []);

  /** Sends, as a reply when one is being written; the composer only clears once this resolves. */
  const handleSend = async (input: { text: string; files: File[] }) => {
    const replyTo = replyTarget
      ? {
          id: replyTarget.id,
          authorId: replyTarget.authorId,
          authorName: replyTarget.authorName,
          authorAvatarUrl: replyTarget.authorAvatarUrl,
          text: replyTarget.text,
          hasAttachments: replyTarget.attachments.length > 0,
          deleted: false,
        }
      : undefined;
    await send({ ...input, replyTo });
    setReply(null);
  };

  const copy = async (text: string, done: string) => {
    const ok = await copyToClipboard(text);
    showToast(ok ? done : "Couldn't copy to the clipboard.", ok ? "info" : "error");
  };

  // Keep the channel read while it is open: once on entry, and again as new messages arrive.
  useEffect(() => {
    if (newestId !== undefined) markRead.mutate(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `markRead` is a new object each render
  }, [channelId, newestId]);

  const scroll = useChatScroll({
    conversationId: channelId,
    messages,
    myUserId: me?.user_id,
    hasOlder: hasNextPage,
    loadingOlder: isFetchingNextPage,
    loadOlder: useCallback(() => void fetchNextPage(), [fetchNextPage]),
  });
  const { scrollerRef, release } = scroll;

  /** Scroll a message into view and flash it. Older messages that are not loaded cannot be reached from here. */
  const jumpToId = useCallback((id: string) => {
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
  }, [showToast, scrollerRef, release]);
  const jumpTo = (message: Message) => jumpToId(message.id);

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

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollerRef} onScroll={scroll.onScroll} data-message-list className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2.5">
          {isPending ? (
            <LoadingState message="Loading messages…" />
          ) : error ? (
            <ErrorState title="Couldn't load messages" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />
          ) : (
            <>
              {messages.length === 0 ? (
                <p className="m-auto text-sm text-text-muted">No messages in #{channel.channel_name} yet. Say hello.</p>
              ) : (
                <div ref={scroll.contentRef} className="mt-auto">
                  {/* Older history loads as this comes within reach; the button is the fallback. */}
                  <div ref={scroll.topSentinelRef} aria-hidden="true" className="h-px" />
                  {hasNextPage ? (
                    <button
                      type="button"
                      onClick={scroll.requestOlder}
                      disabled={isFetchingNextPage}
                      className="mx-auto mb-3 mt-1 flex items-center gap-2 rounded-full bg-surface-secondary px-4 py-1.5 text-[13px] text-text-tertiary hover:text-text disabled:opacity-60"
                    >
                      {isFetchingNextPage && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                      {isFetchingNextPage ? "Loading older messages…" : "Load older messages"}
                    </button>
                  ) : (
                    <div className="mb-4 mt-2 px-[18px]">
                      <div className="mb-3 grid size-14 place-items-center rounded-full bg-surface-secondary">
                        <Icon size={26} className="text-text-tertiary" aria-hidden="true" />
                      </div>
                      <h2 className="m-0 font-heading text-[24px] font-semibold text-text">Welcome to #{channel.channel_name}</h2>
                      <p className="m-0 mt-1 text-[14px] text-text-muted">This is the start of the #{channel.channel_name} channel.</p>
                    </div>
                  )}
                  {rows.map(({ message, startsGroup }) => (
                    <MessageItem
                      key={message.id}
                      message={message}
                      isGroupStart={startsGroup}
                      myUserId={me?.user_id}
                      onEdit={handleEdit}
                      quickReaction={topReactions[0]}
                      onToggleReaction={handleReaction}
                      onOpenMenu={handleOpenMenu}
                      onOpenPicker={handleOpenPicker}
                      editing={editingId === message.id}
                      onEditingChange={handleEditingChange}
                      onRetry={retry}
                      onDiscard={discard}
                      onReply={handleReply}
                      onJumpTo={jumpToId}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {scroll.showJumpButton && <JumpToPresent unseen={scroll.unseen} onClick={scroll.jumpToBottom} />}
      </div>

      <Composer
        channelName={channel.channel_name}
        maxLength={server?.max_message_length ?? undefined}
        maxAttachmentMB={server?.max_total_attachment_size ?? undefined}
        replyingTo={replyTarget ? { id: replyTarget.id, authorName: replyTarget.authorName } : undefined}
        onCancelReply={cancelReply}
        onSend={handleSend}
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
            reply: () => handleReply(menuMessage.id),
            copyText: () => void copy(menuMessage.text, "Message text copied."),
            copyId: () => void copy(menuMessage.id, "Message ID copied."),
            edit: () => setEditingId(menuMessage.id),
            requestDelete: () => handleRequestDelete(menuMessage.id),
            report: () => {
              report.reset();
              setReportId(menuMessage.id);
            },
            quickReactions: topReactions,
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
