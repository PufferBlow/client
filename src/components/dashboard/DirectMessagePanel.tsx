import { useCallback, useState } from "react";
import { AtSign } from "lucide-react";
import type { Conversation } from "../../features/dms/api";
import {
  useDeleteDirectMessage,
  useDirectMessages,
  useEditDirectMessage,
  useSendDirectMessage,
  useToggleDirectReaction,
} from "../../features/dms/hooks";
import { toReplyPreview } from "../../features/messages/replies";
import { useServerInfo } from "../../features/server/hooks";
import { useTypingUsers } from "../../features/typing/store";
import { useTypingNotifier } from "../../features/typing/useTypingNotifier";
import { useMyProfile } from "../../features/users/hooks";
import { useToast } from "../../hooks/useToast";
import { ToastRegion } from "../ui/Toast";
import { Avatar } from "./Avatar";
import { Composer } from "./Composer";
import { MessageLog } from "./MessageLog";
import type { MessagePermissions } from "./messageMenu";

/** In a private conversation you can edit and delete only your own messages; there is no one to report to. */
const DM_PERMISSIONS: MessagePermissions = {
  canEdit: (message, viewer) => viewer !== undefined && message.authorId === viewer.user_id,
  canDelete: (message, viewer) => viewer !== undefined && message.authorId === viewer.user_id,
  canReport: () => false,
};

interface DirectMessagePanelProps {
  conversationId: string;
  /** How the API addresses the other person (`name` or `name@host`). */
  peer: string;
  /** From the conversation list, when it is there yet (a brand-new conversation isn't). */
  conversation?: Conversation;
}

/** One DM conversation: the same log and composer as a channel, with the other person in the header. */
export function DirectMessagePanel({ conversationId, peer, conversation }: DirectMessagePanelProps) {
  const { messages, isPending, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useDirectMessages(conversationId, peer);
  const { data: me } = useMyProfile();
  const { data: server } = useServerInfo();
  const { send, retry, discard } = useSendDirectMessage(conversationId, peer);
  const edit = useEditDirectMessage(conversationId);
  const remove = useDeleteDirectMessage(conversationId);
  const react = useToggleDirectReaction(conversationId);
  const { toast, show: showToast } = useToast();

  const name = conversation?.peerUsername ?? peer.split("@")[0] ?? peer;
  // In a 1:1 conversation the only other person who can be typing is the peer.
  const typingNames = useTypingUsers(conversationId).length > 0 ? [name] : [];
  const typing = useTypingNotifier({ conversationId });
  const [reply, setReply] = useState<{ conversationId: string; id: string } | null>(null);
  const replyTarget = reply?.conversationId === conversationId ? messages.find((m) => m.id === reply.id) : undefined;
  if (reply && !replyTarget) setReply(null);

  const { mutateAsync: editMessage } = edit;
  const { mutateAsync: toggleReaction } = react;
  const handleEdit = useCallback((id: string, text: string) => editMessage({ id, text }), [editMessage]);
  const handleReact = useCallback((id: string, emoji: string, present: boolean) => toggleReaction({ id, emoji, present }), [toggleReaction]);
  const handleReply = useCallback((id: string) => setReply({ conversationId, id }), [conversationId]);
  const cancelReply = useCallback(() => setReply(null), []);
  const loadOlder = useCallback(() => void fetchNextPage(), [fetchNextPage]);

  const handleSend = async (input: { text: string; files: File[] }) => {
    typing.reset();
    const replyTo = replyTarget ? toReplyPreview(replyTarget) : undefined;
    setReply(null);
    await send({ ...input, replyTo });
  };

  const avatar = <Avatar name={name} src={conversation?.peerAvatarUrl ?? null} seed={conversation?.peerUserId ?? peer} size={80} />;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[14px] bg-surface" aria-label={`Conversation with ${name}`}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-secondary px-[18px]">
        <AtSign size={18} className="text-text-tertiary" aria-hidden="true" />
        <Avatar name={name} src={conversation?.peerAvatarUrl ?? null} seed={conversation?.peerUserId ?? peer} size={26} presence={conversation?.peerStatus} />
        <h1 className="m-0 text-[15px] font-bold">{name}</h1>
        {peer.includes("@") && <span className="truncate text-[12.5px] text-text-muted">@{peer}</span>}
      </header>

      <MessageLog
        conversationId={conversationId}
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
            <div className="mb-3">{avatar}</div>
            <h2 className="m-0 font-display text-[30px] font-normal text-text">{name}</h2>
            <p className="m-0 mt-1 text-[14px] text-text-muted">
              This is the beginning of your direct message history with <b className="text-text-secondary">{name}</b>.
            </p>
          </div>
        }
        empty={
          <div className="m-auto flex flex-col items-center px-6 text-center">
            {avatar}
            <p className="m-0 mt-3 text-sm text-text-muted">
              No messages with <b className="text-text-secondary">{name}</b> yet. Say hello.
            </p>
          </div>
        }
        onEdit={handleEdit}
        onReact={handleReact}
        deletion={remove}
        onRetrySend={retry}
        onDiscard={discard}
        onReply={handleReply}
        permissions={DM_PERMISSIONS}
        showToast={showToast}
      />

      <Composer
        channelName={name}
        target={`@${name}`}
        maxLength={server?.max_message_length ?? undefined}
        maxAttachmentMB={server?.max_total_attachment_size ?? undefined}
        replyingTo={replyTarget ? { id: replyTarget.id, authorName: replyTarget.authorName } : undefined}
        onCancelReply={cancelReply}
        onSend={handleSend}
        onTyping={typing.notify}
        typingNames={typingNames}
      />

      <ToastRegion toast={toast} />
    </section>
  );
}
