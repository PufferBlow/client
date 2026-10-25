import { HostPill, lookOf, RoleBadge, SkeletonRow } from "@pufferblow/spines";
import { useMemo } from "react";
import { groupByRole } from "../../features/members/groups";
import { PRESENCE } from "../../features/members/presence";
import { useMyProfile, useUsers } from "../../features/users/hooks";
import type { UserProfile } from "../../features/users/types";
import { useProfileCard } from "../profile/profileCardContext";
import { shownBadge } from "../../features/users/roles";
import { Avatar } from "./Avatar";

/** One person. Their frame and name style follow them here; their card theme and banner stay on the card. */
function MemberRow({ member, home }: { member: UserProfile; home?: string }) {
  const profileCard = useProfileCard();
  const look = lookOf(member);
  const offline = member.status === "offline";
  const customFont = look.settings.name_font !== "barlow";
  const badge = shownBadge(member);

  return (
    <li>
      <button
        type="button"
        aria-label={`View ${member.username}'s profile`}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          profileCard.open(member.user_id, { x: rect.left - 308, y: rect.top });
        }}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm border-0 bg-transparent p-1.5 text-left transition-colors duration-(--motion-fast) hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Avatar name={member.username} src={member.avatar_url} seed={member.user_id} size={32} presence={member.status} frame={look.ringSmall} />
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={`truncate text-sm font-semibold ${offline ? "text-text-muted" : "text-text-body"}`}
              style={customFont ? { font: look.nameStyle.fontSmall, letterSpacing: look.nameStyle.letterSpacing, textTransform: look.nameStyle.textTransform } : undefined}
            >
              {member.username}
            </span>
            {badge && <RoleBadge badge={badge.badge} size={20} label={badge.name} />}
            {/* Local people show no host; remote ones always do. */}
            {home && member.origin_server && member.origin_server !== home && <HostPill host={member.origin_server} />}
          </div>
          <div className="pb-meta truncate text-[11.5px]">{member.custom_status || PRESENCE[member.status].label}</div>
        </div>
      </button>
    </li>
  );
}

function MemberGroup({ label, members, home }: { label: string; members: UserProfile[]; home?: string }) {
  if (members.length === 0) return null;
  return (
    <section aria-label={label}>
      <h3 className="pb-section-label m-0 px-1.5 pb-1.5 pt-3">
        {label} — {members.length}
      </h3>
      <ul className="m-0 list-none p-0">
        {members.map((member) => (
          <MemberRow key={member.user_id} member={member} home={home} />
        ))}
      </ul>
    </section>
  );
}

/** Everyone on the instance. The backend has no per-channel member list. */
export function MemberList() {
  const { data: users, isPending, error } = useUsers();
  const { data: me } = useMyProfile();

  const groups = useMemo(() => groupByRole(users ?? []), [users]);

  return (
    <aside aria-label="Members" className="w-60 shrink-0 overflow-y-auto rounded-lg bg-surface px-2.5 py-3">
      {isPending ? (
        <div role="status" className="flex flex-col pt-2" aria-busy="true">
          <span className="sr-only">Loading members…</span>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} index={i} avatar={32} />
          ))}
        </div>
      ) : error ? (
        <p className="pb-error px-2 pt-2">Couldn&apos;t load members.</p>
      ) : (
        <>
          {groups.map((group) => (
            <MemberGroup key={group.id} label={group.label} members={group.members} home={me?.origin_server} />
          ))}
        </>
      )}
    </aside>
  );
}
