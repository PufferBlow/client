import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Navigate, useParams } from "react-router";
import { ChannelSidebar } from "../../components/dashboard/ChannelSidebar";
import { ChatPanel } from "../../components/dashboard/ChatPanel";
import { MemberList } from "../../components/dashboard/MemberList";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { useChannels } from "../../features/channels/hooks";
import { hasText } from "../../features/channels/types";
import { classifyAuthError } from "../../utils/authErrors";

function MainPane({ children }: { children: ReactNode }) {
  return <section className="flex min-w-0 flex-1 items-center justify-center rounded-[14px] bg-surface">{children}</section>;
}

const MEMBERS_KEY = "pb_members_open";

/** Open by default on wide windows, closed on narrow ones; afterwards whatever the person last chose. */
function initialMembersOpen(): boolean {
  try {
    const saved = localStorage.getItem(MEMBERS_KEY);
    if (saved !== null) return saved === "1";
  } catch {
    /* storage unavailable: fall back to the window width */
  }
  return window.innerWidth >= 1280;
}

export function ServerView() {
  const { channelId } = useParams();
  const [membersOpen, setMembersOpen] = useState(initialMembersOpen);
  const toggleMembers = useCallback(() => {
    setMembersOpen((open) => {
      try {
        localStorage.setItem(MEMBERS_KEY, open ? "0" : "1");
      } catch {
        /* the choice just won't persist */
      }
      return !open;
    });
  }, []);
  const { data: channels, isPending, error, refetch } = useChannels();

  useEffect(() => {
    localStorage.setItem("pb_last_route", "/dashboard");
  }, []);

  const textChannels = (channels ?? []).filter(hasText);
  const channel = textChannels.find((c) => c.channel_id === channelId);

  let main: ReactNode;
  if (isPending) {
    main = <MainPane><LoadingState message="Loading channels…" /></MainPane>;
  } else if (error) {
    main = (
      <MainPane>
        <ErrorState title="Couldn't load channels" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />
      </MainPane>
    );
  } else if (textChannels.length === 0) {
    main = <MainPane><EmptyState title="No text channels yet" description="An admin can create one from the control panel." /></MainPane>;
  } else if (!channel) {
    // No channel selected (or a stale link): open the first one.
    return <Navigate to={`/dashboard/channels/${encodeURIComponent(textChannels[0]!.channel_id)}`} replace />;
  } else {
    main = <ChatPanel key={channel.channel_id} channel={channel} membersOpen={membersOpen} onToggleMembers={toggleMembers} />;
  }

  return (
    <>
      <ChannelSidebar />
      {main}
      {membersOpen && <MemberList />}
    </>
  );
}
