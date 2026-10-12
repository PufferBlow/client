import { useMemo } from "react";
import { isOnline } from "../../features/members/presence";
import { PRESENCE } from "../../features/members/presence";
import { useUsers } from "../../features/users/hooks";
import type { UserProfile } from "../../features/users/types";
import { Avatar } from "./Avatar";

const byName = (a: UserProfile, b: UserProfile) => a.username.localeCompare(b.username);

function MemberGroup({ label, members }: { label: string; members: UserProfile[] }) {
  if (members.length === 0) return null;
  return (
    <section>
      <h3 className="m-0 px-1.5 pb-1.5 pt-2.5 font-heading text-[11.5px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        {label} — {members.length}
      </h3>
      <ul className="m-0 list-none p-0">
        {members.map((member) => (
          <li
            key={member.user_id}
            className={["flex items-center gap-2.5 rounded-[10px] p-1.5 hover:bg-surface-secondary", member.status === "offline" ? "opacity-60" : ""].join(" ")}
          >
            <Avatar name={member.username} src={member.avatar_url} seed={member.user_id} size={34} presence={member.status} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold">{member.username}</div>
              <div className="truncate text-[11.5px] text-text-tertiary">{PRESENCE[member.status].label}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Everyone on the instance. The backend has no per-channel member list. */
export function MemberList() {
  const { data: users, isPending, error } = useUsers();

  const { online, offline } = useMemo(() => {
    const sorted = [...(users ?? [])].sort(byName);
    return { online: sorted.filter((u) => isOnline(u.status)), offline: sorted.filter((u) => !isOnline(u.status)) };
  }, [users]);

  return (
    <aside aria-label="Members" className="w-60 shrink-0 overflow-y-auto rounded-[14px] bg-surface px-2.5 py-3 max-xl:hidden">
      {isPending ? (
        <div className="flex flex-col gap-2 pt-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-[10px] bg-surface-secondary" />
          ))}
        </div>
      ) : error ? (
        <p className="px-2 pt-2 text-[13px] text-error">Couldn&apos;t load members.</p>
      ) : (
        <>
          <MemberGroup label="Online" members={online} />
          <MemberGroup label="Offline" members={offline} />
        </>
      )}
    </aside>
  );
}
