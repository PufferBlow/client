import { Avatar } from "../../components/dashboard/Avatar";
import { Panel, Tag } from "../../components/control-panel/Panel";
import { tableClasses } from "../../components/control-panel/tableClasses";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { PRESENCE } from "../../features/members/presence";
import { useUsers } from "../../features/users/hooks";
import { roleNames } from "../../features/users/roles";
import { classifyAuthError } from "../../utils/authErrors";

export function MembersSection() {
  const { data, isPending, error, refetch } = useUsers();

  if (isPending) return <LoadingState message="Loading members…" />;
  if (error) return <ErrorState title="Couldn't load members" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;
  if (data.length === 0) return <EmptyState title="No members yet" />;

  const sorted = [...data].sort((a, b) => a.username.localeCompare(b.username));

  return (
    <Panel title={`${sorted.length} ${sorted.length === 1 ? "member" : "members"}`} description="Role and moderation tools are coming soon." flush>
      <table className={tableClasses.table}>
        <thead>
          <tr>
            <th scope="col" className={tableClasses.head}>Member</th>
            <th scope="col" className={tableClasses.head}>Status</th>
            <th scope="col" className={tableClasses.head}>Roles</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((member) => (
            <tr key={member.user_id} className={tableClasses.row}>
              <td className={tableClasses.cell}>
                <span className="inline-flex items-center gap-3">
                  <Avatar name={member.username} src={member.avatar_url} seed={member.user_id} size={32} presence={member.status} ringColor="var(--color-surface-secondary)" />
                  <span className="font-semibold">{member.username}</span>
                </span>
              </td>
              <td className={`${tableClasses.cell} text-text-tertiary`}>{PRESENCE[member.status].label}</td>
              <td className={tableClasses.cell}>
                <span className="inline-flex flex-wrap gap-1.5">
                  {roleNames(member).map((name) => (
                    <Tag key={name} tone={name.toLowerCase() === "owner" ? "brass" : "neutral"}>{name}</Tag>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** Placeholder for sections that have a place in the navigation but no screen yet. */
export function ComingSoon({ planned }: { planned: readonly string[] }) {
  return (
    <Panel title="Coming soon" description="This part of the control panel isn't built yet. It will cover:">
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-text-secondary">
        {planned.map((item) => (
          <li key={item} className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
