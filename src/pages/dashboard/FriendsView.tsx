import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, AtSign, Check, UserMinus, UserPlus, Users, X } from "lucide-react";
import { Avatar, CountBadge } from "../../components/dashboard/Avatar";
import { UserPanel } from "../../components/dashboard/UserPanel";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
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

type Tab = "online" | "all" | "pending" | "blocked";

const circleButton = "grid h-9 w-9 place-items-center rounded-full bg-surface-secondary text-text-tertiary transition-colors hover:text-text disabled:opacity-50";

const handleOf = (person: { username: string; host: string }) => `@${person.username}${person.host ? `@${person.host}` : ""}`;

function Sidebar({ friends }: { friends: Friend[] }) {
  return (
    <aside className="flex w-[236px] shrink-0 flex-col overflow-hidden rounded-[14px] bg-surface max-md:hidden">
      <div className="px-2 pt-3">
        <span className="flex h-10 items-center gap-2.5 rounded-[10px] bg-surface-tertiary px-3 text-[14.5px] font-semibold" aria-current="page">
          <Users size={17} aria-hidden="true" />
          Friends
        </span>
      </div>
      <h2 className="m-0 px-4 pb-1.5 pt-4 font-heading text-[11.5px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        All friends — {friends.length}
      </h2>
      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto px-2 py-0">
        {friends.map((f) => (
          <li key={f.userId} className="flex h-[46px] items-center gap-2.5 rounded-[10px] px-2 hover:bg-surface-secondary">
            <Avatar name={f.username} src={f.avatarUrl} seed={f.userId} size={32} presence={f.status} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium">{f.username}</div>
              <div className="truncate text-[11px] text-text-muted">{f.host || "This instance"}</div>
            </div>
          </li>
        ))}
      </ul>
      <UserPanel />
    </aside>
  );
}

function PersonRow({ person, subtitle, children }: { person: Friend; subtitle: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border-t border-border-secondary p-2.5 hover:bg-surface-secondary">
      <Avatar name={person.username} src={person.avatarUrl} seed={person.userId} size={40} presence={person.status} />
      <div className="min-w-0 flex-1 leading-snug">
        <div className="truncate text-[15px]">
          <b>{person.username}</b> <span className="text-[12.5px] text-text-muted">{handleOf(person)}</span>
        </div>
        <div className="truncate text-[12.5px] text-text-tertiary">{subtitle}</div>
      </div>
      {children}
    </li>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 mb-1 font-heading text-[11.5px] font-semibold uppercase tracking-[0.12em] text-text-muted">{children}</h2>;
}

function AddFriendForm() {
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
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-[14px] bg-surface-secondary p-3.5">
      <div className="flex gap-2.5">
        <div className="flex h-[46px] flex-1 items-center gap-2.5 rounded-xl border border-border-secondary bg-background px-3.5 text-[14.5px] text-text-tertiary focus-within:border-primary/50">
          <AtSign size={16} aria-hidden="true" />
          <input
            id="add-friend"
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
        <Button type="submit" size="lg" className="h-[46px] font-heading uppercase tracking-[0.08em]" loading={send.isPending} disabled={!handle.trim()}>
          Send request
        </Button>
      </div>
      {sentTo && !send.error && (
        <p role="status" className="m-0 flex items-center gap-1.5 text-[13px] text-success">
          <Check size={14} aria-hidden="true" />
          Request sent to {sentTo}.
        </p>
      )}
      {send.error && (
        <p role="alert" className="m-0 flex items-center gap-1.5 text-[13px] text-error">
          <AlertCircle size={14} aria-hidden="true" />
          {classifyAuthError(send.error, "Couldn't send the request.").message}
        </p>
      )}
    </form>
  );
}

function FriendsList({ friends, empty }: { friends: Friend[]; empty: string }) {
  const remove = useRemoveFriend();
  if (friends.length === 0) return <p className="m-auto text-sm text-text-muted">{empty}</p>;
  return (
    <>
      <SectionTitle>{friends.length} {friends.length === 1 ? "friend" : "friends"}</SectionTitle>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {friends.map((f) => (
          <PersonRow key={f.userId} person={f} subtitle={PRESENCE[f.status].label}>
            <button type="button" className={`${circleButton} hover:text-error`} aria-label={`Remove ${f.username} from friends`} disabled={remove.isPending} onClick={() => remove.mutate(f.userId)}>
              <UserMinus size={16} />
            </button>
          </PersonRow>
        ))}
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
                <button type="button" className={`${circleButton} bg-primary text-on-primary hover:text-on-primary hover:brightness-110`} aria-label={`Accept ${r.username}`} disabled={busy} onClick={() => accept.mutate(r.friendshipId)}>
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
        <li key={b.userId} className="flex items-center gap-3 rounded-xl border-t border-border-secondary p-2.5">
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

export function FriendsView() {
  const [tab, setTab] = useState<Tab>("online");
  const friends = useFriends();
  const requests = useFriendRequests();

  useEffect(() => {
    localStorage.setItem("pb_last_route", "/dashboard");
  }, []);

  const all = friends.data ?? [];
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
  else body = <FriendsList friends={tab === "online" ? online : all} empty={tab === "online" ? "Nobody is online right now." : "No friends yet. Send a request above."} />;

  return (
    <>
      <Sidebar friends={all} />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[14px] bg-surface" aria-label="Friends">
        <header className="flex h-[60px] shrink-0 items-center gap-3.5 border-b border-border-secondary px-[18px]">
          <h1 className="m-0 flex items-center gap-2 font-heading text-xl font-semibold">
            <Users size={19} aria-hidden="true" />
            Friends
          </h1>
          <div role="tablist" className="flex gap-1 rounded-xl bg-background p-1">
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
                {count !== undefined && <span className="text-xs opacity-60">{count}</span>}
              </button>
            ))}
          </div>
          <Button size="sm" className="ml-auto font-heading uppercase tracking-[0.08em]" onClick={() => document.getElementById("add-friend")?.focus()}>
            <UserPlus size={15} aria-hidden="true" />
            Add friend
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-[18px]">
          <AddFriendForm />
          {body}
        </div>
      </section>
    </>
  );
}
