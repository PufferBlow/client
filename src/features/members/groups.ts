import { isOnline } from "./presence";
import { roleOrder, rolesOf } from "../users/roles";
import type { UserProfile } from "../users/types";

export interface MemberGroupData {
  /** The role's id, or `members` for people who hold no role that says anything. */
  id: string;
  label: string;
  members: UserProfile[];
}

const byName = (a: UserProfile, b: UserProfile) => a.username.localeCompare(b.username);

/** Online people first, each half by name. */
const onlineFirst = (a: UserProfile, b: UserProfile) => Number(isOnline(b.status)) - Number(isOnline(a.status)) || byName(a, b);

/**
 * People grouped by their highest role, the highest group first: Owner, Moderator, then roles the instance
 * made (staff-badged ones first), and everyone else under Members. Inside a group the people who are online come
 * first. A person is in one group, the one for their top role.
 */
export function groupByRole(users: readonly UserProfile[]): MemberGroupData[] {
  const groups = new Map<string, MemberGroupData & { order: number }>();
  for (const user of users) {
    const top = rolesOf(user)[0];
    const id = top?.id ?? "members";
    let group = groups.get(id);
    if (!group) {
      group = { id, label: top?.name ?? "Members", members: [], order: top ? roleOrder(top) : Number.MAX_SAFE_INTEGER };
      groups.set(id, group);
    }
    group.members.push(user);
  }
  return [...groups.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map(({ order: _order, members, ...rest }) => ({ ...rest, members: [...members].sort(onlineFirst) }));
}
