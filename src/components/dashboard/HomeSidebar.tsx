import { NavLink } from "react-router";
import { Users } from "lucide-react";
import { peerHandle, type Conversation } from "../../features/dms/api";
import { useConversations } from "../../features/dms/hooks";
import { useMyProfile } from "../../features/users/hooks";
import { Avatar } from "./Avatar";

/** Where a conversation row links to: the conversation, with the peer to load it by. */
function conversationPath(conversation: Conversation, myHost: string | undefined): string {
  const peer = peerHandle({ username: conversation.peerUsername, host: conversation.peerHost }, myHost);
  return `/dashboard/dms/${encodeURIComponent(conversation.id)}?peer=${encodeURIComponent(peer)}`;
}

/** The left column of the home screen: Friends, then the direct-message conversations. */
export function HomeSidebar({ activeConversationId }: { activeConversationId?: string }) {
  const { data: conversations = [], isPending } = useConversations();
  const { data: me } = useMyProfile();

  return (
    <aside className="flex w-[288px] shrink-0 flex-col overflow-hidden rounded-[14px] bg-surface max-md:hidden" aria-label="Home">
      <div className="px-2 pt-3">
        <NavLink
          to="/dashboard/friends"
          end
          className={({ isActive }) =>
            `flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-[14.5px] font-semibold transition-colors ${
              isActive ? "bg-surface-tertiary text-text" : "text-text-tertiary hover:bg-surface-secondary hover:text-text"
            }`
          }
        >
          <Users size={17} aria-hidden="true" />
          Friends
        </NavLink>
      </div>
      <h2 className="m-0 px-4 pb-1.5 pt-4 font-heading text-[11.5px] font-semibold uppercase tracking-[0.12em] text-text-muted">Direct messages</h2>
      <nav aria-label="Direct messages" className="min-h-0 flex-1 overflow-y-auto px-2">
        {!isPending && conversations.length === 0 ? (
          <p className="m-0 px-2 py-1 text-[12.5px] text-text-muted">No conversations yet. Message a friend to start one.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {conversations.map((c) => {
              const active = c.id === activeConversationId;
              return (
                <li key={c.id}>
                  <NavLink
                    to={conversationPath(c, me?.origin_server)}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-[46px] items-center gap-2.5 rounded-[10px] px-2 transition-colors ${
                      active ? "bg-surface-tertiary" : "hover:bg-surface-secondary"
                    }`}
                  >
                    <Avatar name={c.peerUsername} src={c.peerAvatarUrl} seed={c.peerUserId} size={32} presence={c.peerStatus} />
                    <div className="min-w-0 leading-tight">
                      <div className={`truncate text-sm font-medium ${active ? "text-text" : "text-text-secondary"}`}>{c.peerUsername}</div>
                      {c.lastMessagePreview && (
                        <div className="truncate text-[11.5px] text-text-muted">
                          {c.lastMessageSenderIsMe ? "You: " : ""}
                          {c.lastMessagePreview}
                        </div>
                      )}
                    </div>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      <div aria-hidden="true" className="h-[76px] shrink-0" />
    </aside>
  );
}
