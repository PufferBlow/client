import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hash, Lock, Users } from "lucide-react";
import { useMarkChannelRead } from "../../features/channels/hooks";
import { useChannelPings } from "../../features/notifications/hooks";
import type { Channel } from "../../features/channels/types";
import type { Message } from "../../features/messages/types";
import { toReplyPreview } from "../../features/messages/replies";
import { useDeleteMessage, useEditMessage, useMessages, useReportMessage, useSendMessage, useToggleReaction } from "../../features/messages/hooks";
import { useServerInfo } from "../../features/server/hooks";
import { useMyProfile, useUsers } from "../../features/users/hooks";
import { canMentionEveryone } from "../../features/users/roles";
import { EVERYONE, MentionDirectoryContext, type Mentionable, type MentionDirectory } from "../../lib/mentions";
import { useToast } from "../../hooks/useToast";
import { ToastRegion } from "../ui/Toast";
import { classifyAuthError } from "../../utils/authErrors";
import { ChannelSearch } from "./ChannelSearch";
import { Composer } from "./Composer";
import { ReportMessageDialog } from "./MessageDialogs";
import { MessageLog, type MessageLogHandle } from "./MessageLog";

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
  const { data: users } = useUsers();

  // Who can be mentioned here, and who the log should recognise as a mention.
  const mentionables = useMemo<Mentionable[]>(() => {
    const people = (users ?? []).map((u) => ({ id: u.user_id, name: u.username, avatarUrl: u.avatar_url }));
    return canMentionEveryone(me) ? [{ id: EVERYONE, name: EVERYONE, avatarUrl: null, everyone: true }, ...people] : people;
  }, [users, me]);
  const directory = useMemo<MentionDirectory>(
    () => ({ me: me?.username, known: new Set((users ?? []).map((u) => u.username.toLowerCase())) }),
    [users, me?.username],
  );
  const { data: server } = useServerInfo();

  const { send, retry, discard } = useSendMessage(channelId);
  const edit = useEditMessage(channelId);
  const remove = useDeleteMessage(channelId);
  const react = useToggleReaction(channelId);
  const report = useReportMessage();
  const markRead = useMarkChannelRead();
  const { toast, show: showToast } = useToast();
  const log = useRef<MessageLogHandle>(null);

  const [reportId, setReportId] = useState<string | null>(null);
  // Held with its channel so switching channels can't carry a reply over.
  const [reply, setReply] = useState<{ channelId: string; id: string } | null>(null);

  const byId = (id: string | null) => (id === null ? undefined : messages.find((m) => m.id === id));
  const reportTarget = byId(reportId);
  const replyTarget = reply?.channelId === channelId ? byId(reply.id) : undefined;
  if (reportId && !reportTarget) setReportId(null);
  if (reply && !replyTarget) setReply(null);

  // Stable callbacks let memoised rows skip re-rendering when something else changes.
  const { mutateAsync: editMessage } = edit;
  const { mutateAsync: toggleReaction } = react;
  const handleEdit = useCallback((id: string, text: string) => editMessage({ id, text }), [editMessage]);
  const handleReact = useCallback((id: string, emoji: string, present: boolean) => toggleReaction({ id, emoji, present }), [toggleReaction]);
  const handleReply = useCallback((id: string) => setReply({ channelId, id }), [channelId]);
  const cancelReply = useCallback(() => setReply(null), []);
  const handleReport = useCallback(
    (id: string) => {
      report.reset();
      setReportId(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `report` is a new object each render
    [],
  );
  const loadOlder = useCallback(() => void fetchNextPage(), [fetchNextPage]);

  /** Sends, as a reply when one is being written; the composer only clears once this resolves. */
  const handleSend = async (input: { text: string; files: File[] }) => {
    await send({ ...input, replyTo: replyTarget ? toReplyPreview(replyTarget) : undefined });
    setReply(null);
  };

  // Keep the channel read while it is open: once on entry, and again as new messages arrive.
  const newestId = messages.at(-1)?.id;
  useEffect(() => {
    if (newestId !== undefined) markRead.mutate(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `markRead` is a new object each render
  }, [channelId, newestId]);

  // A reply or ping that lands while you are reading this channel is seen the moment it arrives.
  const pingsHere = useChannelPings()[channelId] ?? 0;
  useEffect(() => {
    if (pingsHere > 0) markRead.mutate(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `markRead` is a new object each render
  }, [channelId, pingsHere]);

  const Icon = channel.is_private ? Lock : Hash;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[14px] bg-surface" aria-label={`#${channel.channel_name}`}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-secondary px-[18px]">
        <Icon size={18} className="text-text-tertiary" aria-hidden="true" />
        <h1 className="m-0 font-heading text-[19px] font-semibold">{channel.channel_name}</h1>
        <div className="ml-auto flex items-center gap-1">
          <ChannelSearch channelId={channelId} channelName={channel.channel_name} onPick={(message: Message) => log.current?.jumpTo(message.id)} />
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

      <MentionDirectoryContext.Provider value={directory}>
      <MessageLog
        ref={log}
        conversationId={channelId}
        messages={messages}
        isPending={isPending}
        error={error}
        onRetryLoad={() => void refetch()}
        hasOlder={hasNextPage}
        loadingOlder={isFetchingNextPage}
        loadOlder={loadOlder}
        me={me}
        intro={
          <div className="mb-4 mt-2 px-[18px]">
            <div className="mb-3 grid size-14 place-items-center rounded-full bg-surface-secondary">
              <Icon size={26} className="text-text-tertiary" aria-hidden="true" />
            </div>
            <h2 className="m-0 font-heading text-[24px] font-semibold text-text">Welcome to #{channel.channel_name}</h2>
            <p className="m-0 mt-1 text-[14px] text-text-muted">This is the start of the #{channel.channel_name} channel.</p>
          </div>
        }
        empty={<p className="m-auto text-sm text-text-muted">No messages in #{channel.channel_name} yet. Say hello.</p>}
        onEdit={handleEdit}
        onReact={handleReact}
        deletion={remove}
        onRetrySend={retry}
        onDiscard={discard}
        onReply={handleReply}
        onReport={handleReport}
        showToast={showToast}
      />
      </MentionDirectoryContext.Provider>

      <Composer
        channelName={channel.channel_name}
        mentionables={mentionables}
        maxLength={server?.max_message_length ?? undefined}
        maxAttachmentMB={server?.max_total_attachment_size ?? undefined}
        replyingTo={replyTarget ? { id: replyTarget.id, authorName: replyTarget.authorName } : undefined}
        onCancelReply={cancelReply}
        onSend={handleSend}
      />

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
