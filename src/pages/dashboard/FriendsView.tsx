import { Select } from "../../components/ui/Select";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertCircle, AtSign, Check, MessageCircle, UserMinus, UserPlus, Users, Volume2, X } from "lucide-react";
import { Avatar, CountBadge } from "../../components/dashboard/Avatar";
import { HomeSidebar } from "../../components/dashboard/HomeSidebar";
import { Button, EmptyState, ErrorState, HostPill, LoadingState } from "@pufferblow/spines";
import {
  useAcceptFriendRequest,
  useBlocks,
  useFriendRequests,
  useFriends,
  useRemoveFriend,
  useRemoveFriendRequest,
  useSendFriendRequest,
  useUnblockUser,
} from "../../features/friends/hooks";
import type { Friend } from "../../features/friends/types";
import { isOnline, PRESENCE } from "../../features/members/presence";
import { classifyAuthError } from "../../utils/authErrors";
import { peerHandle } from "../../features/dms/api";
import { useOpenDirectMessage } from "../../features/dms/hooks";
import { useMyProfile } from "../../features/users/hooks";
import { useVoiceRoster, type InVoice } from "../../features/voice/useVoiceRoster";

type Tab = "online" | "all" | "pending" | "blocked";

const circleButton = "grid h-9 w-9 place-items-center rounded-full bg-surface-secondary text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text disabled:opacity-50";

const handleOf = (person: { username: string; host: string }) => `@${person.username}${person.host ? `@${person.host}` : ""}`;

/** What someone is up to: in a voice room, else their presence. Game activity has no source on an instance yet. */
function activityOf(friend: Friend, voice: ReadonlyMap<string, InVoice>): { text: string; live: boolean } {
  const room = voice.get(friend.userId);
  if (room) return { text: `In voice · ${room.channelName}`, live: true };
  return { text: PRESENCE[friend.status].label, live: false };
}

function PersonRow({ person, subtitle, live, children }: { person: Friend; subtitle: ReactNode; live?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border-t border-border-secondary p-2.5 transition-colors duration-(--motion-fast) hover:bg-surface-secondary">
      <Avatar name={person.username} src={person.avatarUrl} seed={person.userId} size={40} presence={person.status} activity={live} />
      <div className="min-w-0 flex-1 leading-snug">
        <div className="truncate text-[15px]">
          <b>{person.username}</b> <span className="text-[12.5px] text-text-muted">{handleOf(person)}</span>
        </div>
        <div className={`truncate text-[12.5px] ${live ? "text-in-game" : "text-text-tertiary"}`}>{subtitle}</div>
      </div>
      {children}
    </li>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="pb-section-label m-0 mb-1">{children}</h2>;
}

/** The request form, opened by the header's Add friend button; Escape or the close button puts it away. */
function AddFriendForm({ onClose }: { onClose: () => void }) {
  const [handle, setHandle] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const send = useSendFriendRequest();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const target = handle.trim();
    if (!target) return;
    send.mutate(target, {
      onSuccess: () => {
        setSentTo(target);
        setHandle("");
      },
    });
  };

  return (
    <form onSubmit={submit} aria-label="Add a friend" onKeyDown={(e) => e.key === "Escape" && onClose()} className="flex flex-col gap-2.5 rounded-lg bg-surface-secondary p-3.5">
      <div className="flex gap-2.5">
        <div className="flex h-11 flex-1 items-center gap-2.5 rounded-md bg-surface px-3.5 text-[14.5px] text-text-tertiary shadow-[0_0_0_2px_var(--color-surface-secondary),0_0_0_4px_var(--color-text)]">
          <AtSign size={16} aria-hidden="true" />
          <input
            autoFocus
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setSentTo(null);
            }}
            placeholder="username or username@instance"
            aria-label="Friend handle"
            autoCapitalize="none"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-muted"
          />
        </div>
        <Button type="submit" size="lg" className="h-11" loading={send.isPending} disabled={!handle.trim()}>
          Send request
        </Button>
        <Button type="button" variant="ghost" size="lg" className="h-11 px-3.5" aria-label="Close" title="Close" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
      {sentTo && !send.error && (
        <p role="status" className="m-0 flex items-center gap-1.5 text-[13px] text-success">
          <Check size={14} aria-hidden="true" />
          Request sent to {sentTo}.
        </p>
      )}
      {send.error && (
        <p role="alert" className="pb-error m-0 flex items-center gap-1.5 text-[13px]">
          <AlertCircle size={14} aria-hidden="true" />
          {classifyAuthError(send.error, "Couldn't send the request.").message}
        </p>
      )}
    </form>
  );
}

function FriendsList({ friends, empty, voice }: { friends: Friend[]; empty: string; voice: ReadonlyMap<string, InVoice> }) {
  const remove = useRemoveFriend();
  const openDm = useOpenDirectMessage();
  const { data: me } = useMyProfile();
  if (friends.length === 0) return <p className="m-auto text-sm text-text-muted">{empty}</p>;
  const title = (
    <SectionTitle>
      {friends.length} {friends.length === 1 ? "friend" : "friends"}
    </SectionTitle>
  );
  return (
    <>
      {title}
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {friends.map((f) => {
          const activity = activityOf(f, voice);
          return (
            <PersonRow key={f.userId} person={f} subtitle={activity.text} live={activity.live}>
              <button type="button" className={circleButton} aria-label={`Message ${f.username}`} title="Message" disabled={openDm.isPending} onClick={() => openDm.mutate(peerHandle(f, me?.origin_server))}>
                <MessageCircle size={16} />
              </button>
              <button type="button" className={`${circleButton} hover:text-error-text`} aria-label={`Remove ${f.username} from friends`} disabled={remove.isPending} onClick={() => remove.mutate(f.userId)}>
                <UserMinus size={16} />
              </button>
            </PersonRow>
          );
        })}
      </ul>
    </>
  );
}

function PendingList() {
  const { data, isPending, error, refetch } = useFriendRequests();
  const accept = useAcceptFriendRequest();
  const dismiss = useRemoveFriendRequest();

  if (isPending) return <LoadingState message="Loading requests…" />;
  if (error) return <ErrorState title="Couldn't load requests" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;
  if (data.incoming.length === 0 && data.outgoing.length === 0) return <p className="m-auto text-sm text-text-muted">No pending requests.</p>;

  const busy = accept.isPending || dismiss.isPending;
  return (
    <>
      {data.incoming.length > 0 && (
        <section>
          <SectionTitle>Incoming — {data.incoming.length}</SectionTitle>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {data.incoming.map((r) => (
              <PersonRow key={r.friendshipId} person={r} subtitle="Wants to be friends">
                <button type="button" className={circleButton} aria-label={`Decline ${r.username}`} disabled={busy} onClick={() => dismiss.mutate(r.friendshipId)}>
                  <X size={16} />
                </button>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-primary text-on-primary transition-colors hover:bg-white disabled:opacity-50" aria-label={`Accept ${r.username}`} disabled={busy} onClick={() => accept.mutate(r.friendshipId)}>
                  <Check size={16} />
                </button>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}
      {data.outgoing.length > 0 && (
        <section>
          <SectionTitle>Sent — {data.outgoing.length}</SectionTitle>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {data.outgoing.map((r) => (
              <PersonRow key={r.friendshipId} person={r} subtitle="Waiting for a response">
                <button type="button" className={circleButton} aria-label={`Cancel request to ${r.username}`} disabled={busy} onClick={() => dismiss.mutate(r.friendshipId)}>
                  <X size={16} />
                </button>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function BlockedList() {
  const { data, isPending, error, refetch } = useBlocks();
  const unblock = useUnblockUser();

  if (isPending) return <LoadingState message="Loading blocked users…" />;
  if (error) return <ErrorState title="Couldn't load blocked users" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;
  if (data.length === 0) return <p className="m-auto text-sm text-text-muted">You haven&apos;t blocked anyone.</p>;

  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {data.map((b) => (
        <li key={b.userId} className="flex items-center gap-3 rounded-lg border-t border-border-secondary p-2.5">
          <Avatar name={b.username} src={b.avatarUrl} seed={b.userId} size={40} />
          <div className="min-w-0 flex-1 truncate text-[15px]">
            <b>{b.username}</b> <span className="text-[12.5px] text-text-muted">{handleOf(b)}</span>
          </div>
          <Button variant="secondary" size="sm" loading={unblock.isPending} onClick={() => unblock.mutate(b.userId)}>
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Friends who are in a voice room right now: the one thing an instance can tell us about what they are doing. */
function ActiveNow({ friends, voice }: { friends: Friend[]; voice: ReadonlyMap<string, InVoice> }) {
  const live = friends.filter((f) => voice.has(f.userId));
  return (
    <aside aria-label="Active now" className="flex w-[290px] shrink-0 flex-col gap-3 overflow-y-auto rounded-lg bg-background-secondary px-3.5 py-[18px] max-xl:hidden">
      <h2 className="pb-title m-0 px-0.5">Active now</h2>
      {live.length === 0 ? (
        <EmptyState title="It's quiet" description="When a friend is in a voice room, they show up here." />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {live.map((f) => {
            const room = voice.get(f.userId)!;
            return (
              <li key={f.userId} className="flex flex-col gap-2 rounded-lg bg-surface-secondary p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={f.username} src={f.avatarUrl} seed={f.userId} size={36} presence={f.status} activity ringColor="var(--color-surface-secondary)" speaking={room.participant.isSpeaking} />
                  <div className="min-w-0 leading-snug">
                    <div className="truncate text-[14.5px]">
                      <b>{f.username}</b> {f.host && <HostPill host={f.host} />}
                    </div>
                    <div className="truncate text-[12.5px] text-in-game">In voice · {room.channelName}</div>
                  </div>
                </div>
                <Link to="/dashboard/channels" className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-2 text-[12.5px] text-text-tertiary no-underline hover:text-text">
                  <Volume2 size={14} aria-hidden="true" />
                  <span className="flex-1 truncate">{room.channelName}</span>
                  <span className="font-semibold text-text">Join</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export function FriendsView() {
  const [tab, setTab] = useState<Tab>("online");
    const [adding, setAdding] = useState(false);
  const [instance, setInstance] = useState("");
  const friends = useFriends();
  const requests = useFriendRequests();
  const voice = useVoiceRoster();
  const { data: me } = useMyProfile();

  useEffect(() => {
    localStorage.setItem("pb_last_route", "/dashboard");
  }, []);

  const home = me?.origin_server ?? "";
  const hostOf = (f: Friend) => f.host || home;
  const everyone = friends.data ?? [];
  const hosts = useMemo(() => [...new Set(everyone.map(hostOf))].filter(Boolean).sort(), [everyone, home]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = instance ? everyone.filter((f) => hostOf(f) === instance) : everyone;
  const online = all.filter((f) => isOnline(f.status));
  const pendingCount = requests.data?.incoming.length ?? 0;

  const tabs: { id: Tab; label: string; badge?: number; count?: number }[] = [
    { id: "online", label: "Online", count: online.length },
    { id: "all", label: "All", count: all.length },
    { id: "pending", label: "Pending", badge: pendingCount },
    { id: "blocked", label: "Blocked" },
  ];

  let body: ReactNode;
  if (tab === "pending") body = <PendingList />;
  else if (tab === "blocked") body = <BlockedList />;
  else if (friends.isPending) body = <LoadingState message="Loading friends…" />;
  else if (friends.error) body = <ErrorState title="Couldn't load friends" message={classifyAuthError(friends.error, "Try again.").message} onRetry={() => void friends.refetch()} />;
  else body = <FriendsList friends={tab === "online" ? online : all} empty={tab === "online" ? "Nobody is online right now." : "No friends yet. Use Add friend to send a request."} voice={voice} />;

  return (
    <>
      <HomeSidebar />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg bg-surface" aria-label="Friends">
        <header className="flex h-[60px] shrink-0 items-center gap-3.5 border-b border-border-secondary px-[18px]">
          <h1 className="m-0 flex items-center gap-2 font-heading text-xl font-semibold">
            <Users size={19} aria-hidden="true" />
            Friends
          </h1>
          <div role="tablist" className="flex gap-1 rounded-lg bg-background p-1">
            {tabs.map(({ id, label, badge, count }) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={["flex items-center gap-1.5 rounded-[9px] px-3.5 py-[7px] text-[13.5px]", tab === id ? "bg-surface-tertiary font-semibold text-text" : "text-text-tertiary hover:text-text"].join(" ")}
              >
                {label}
                {badge !== undefined && <CountBadge count={badge} />}
                {count !== undefined && <span className="min-w-5 rounded-pill bg-surface-secondary px-1.5 py-px text-center text-xs font-semibold tabular-nums text-text-body">{count}</span>}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {hosts.length > 1 && (
              <Select label="Instance" className="rounded-pill! bg-transparent! px-3.5! text-[13.5px]! text-text-tertiary! shadow-[inset_0_0_0_1px_var(--color-border)]" value={instance} onChange={setInstance} options={[{ value: "", label: "All instances" }, ...hosts.map((h) => ({ value: h, label: h }))]} />
            )}
            <Button size="sm" aria-expanded={adding} onClick={() => setAdding((open) => !open)}>
              <UserPlus size={15} aria-hidden="true" />
              Add friend
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-[18px]">
          {adding && <AddFriendForm onClose={() => setAdding(false)} />}
          {body}
        </div>
      </section>
      <ActiveNow friends={everyone} voice={voice} />
    </>
  );
}
