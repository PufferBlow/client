import { useMemo } from "react";
import { isOnline } from "../../features/members/presence";
import { PRESENCE } from "../../features/members/presence";
import { useMyProfile, useUsers } from "../../features/users/hooks";
import type { UserProfile } from "../../features/users/types";
import { HostPill } from "../ui/HostPill";
import { Avatar } from "./Avatar";

const byName = (a: UserProfile, b: UserProfile) => a.username.localeCompare(b.username);

function MemberGroup({ label, members, home }: { label: string; members: UserProfile[]; home?: string }) {
  if (members.length === 0) return null;
  return (
    <section>
      <h3 className="pb-section-label m-0 px-1.5 pb-1.5 pt-3">
        {label} — {members.length}
      </h3>
      <ul className="m-0 list-none p-0">
        {members.map((member) => (
          <li
            key={member.user_id}
            className="flex items-center gap-2.5 rounded-sm p-1.5 transition-colors duration-(--motion-fast) hover:bg-surface-secondary"
          >
            <Avatar name={member.username} src={member.avatar_url} seed={member.user_id} size={32} presence={member.status} />
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <span className={`truncate text-sm font-semibold ${member.status === "offline" ? "text-text-muted" : "text-text-body"}`}>{member.username}</span>
                {/* Local people show no host; remote ones always do. */}
                {home && member.origin_server && member.origin_server !== home && <HostPill host={member.origin_server} />}
              </div>
              <div className="pb-meta truncate text-[11.5px]">{PRESENCE[member.status].label}</div>
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
  const { data: me } = useMyProfile();

  const { online, offline } = useMemo(() => {
    const sorted = [...(users ?? [])].sort(byName);
    return { online: sorted.filter((u) => isOnline(u.status)), offline: sorted.filter((u) => !isOnline(u.status)) };
  }, [users]);

  return (
    <aside aria-label="Members" className="w-60 shrink-0 overflow-y-auto rounded-lg bg-surface px-2.5 py-3">
      {isPending ? (
        <div className="flex flex-col gap-2 pt-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-sm bg-surface-secondary" />
          ))}
        </div>
      ) : error ? (
        <p className="pb-error px-2 pt-2">Couldn&apos;t load members.</p>
      ) : (
        <>
          <MemberGroup label="Online" members={online} home={me?.origin_server} />
          <MemberGroup label="Offline" members={offline} home={me?.origin_server} />
        </>
      )}
    </aside>
  );
}
