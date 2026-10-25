import { useState } from "react";
import { Avatar } from "../../components/dashboard/Avatar";
import { Panel, Tag } from "../../components/control-panel/Panel";
import { tableClasses } from "../../components/control-panel/tableClasses";
import { FeedbackLine } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button, EmptyState, ErrorState, Input, LoadingState, Modal } from "@pufferblow/spines";
import { useModerationAdmin, useModerationStates, useRoleAdmin, useRoles } from "../../features/admin/hooks";
import { durationLabel, TIMEOUT_CHOICES } from "../../features/admin/moderation";
import { PRESENCE } from "../../features/members/presence";
import { useMyProfile, useUsers } from "../../features/users/hooks";
import { OWNER_ROLE_ID, roleNames } from "../../features/users/roles";
import type { UserProfile } from "../../features/users/types";
import { classifyAuthError } from "../../utils/authErrors";

type Action = { kind: "roles" | "timeout" | "ban" | "unban" | "clear-timeout"; member: UserProfile };

function RolesDialog({ member, onClose }: { member: UserProfile; onClose: () => void }) {
  const roles = useRoles();
  const admin = useRoleAdmin();
  const { run, loading, feedback } = useSave("Roles updated.");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(member.roles_ids ?? []));

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Roles for ${member.username}`}
      description="Everything ticked is what they hold. With none ticked they get the default role."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            loading={loading}
            onClick={() => void run(() => admin.assign.mutateAsync({ userId: member.user_id, rolesIds: [...picked] }).then(() => undefined))}
          >
            Save roles
          </Button>
        </>
      }
    >
      {roles.isPending ? (
        <LoadingState message="Loading roles…" />
      ) : roles.error || !roles.data ? (
        <p className="pb-error m-0">{classifyAuthError(roles.error, "Couldn't load the roles.").message}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {roles.data.map((role) => (
            <label key={role.role_id} className="flex cursor-pointer items-center gap-2.5 rounded-md bg-surface-secondary px-3 py-2 text-[13.5px] text-text-body">
              <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={picked.has(role.role_id)} onChange={() => toggle(role.role_id)} />
              {role.role_name}
            </label>
          ))}
          <FeedbackLine feedback={feedback} />
        </div>
      )}
    </Modal>
  );
}

function ModerationDialog({ action, onClose }: { action: Action; onClose: () => void }) {
  const admin = useModerationAdmin();
  const { member, kind } = action;
  const { run, loading, feedback } = useSave(
    { timeout: "Timeout set.", ban: "Banned.", unban: "Unbanned.", "clear-timeout": "Timeout cleared.", roles: "" }[kind],
  );
  const [minutes, setMinutes] = useState<number>(TIMEOUT_CHOICES[1]);
  const [reason, setReason] = useState("");

  const confirm = () =>
    run(async () => {
      const why = reason.trim() || undefined;
      if (kind === "timeout") await admin.timeout.mutateAsync({ userId: member.user_id, minutes, reason: why });
      else if (kind === "ban") await admin.ban.mutateAsync({ userId: member.user_id, reason: why });
      else if (kind === "unban") await admin.unban.mutateAsync(member.user_id);
      else await admin.clearTimeout.mutateAsync(member.user_id);
    });

  const titles = { timeout: "Time out", ban: "Ban", unban: "Unban", "clear-timeout": "End the timeout of", roles: "" } as const;
  const asksWhy = kind === "timeout" || kind === "ban";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${titles[kind]} ${member.username}?`}
      description={
        kind === "ban"
          ? "They will not be able to use this server until you unban them."
          : kind === "timeout"
            ? "They can read, but not speak or send messages, until the timeout ends."
            : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant={kind === "ban" ? "danger" : "primary"} loading={loading} onClick={() => void confirm()}>
            {titles[kind].replace(" of", "")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {kind === "timeout" && (
          <div role="radiogroup" aria-label="Length" className="flex flex-wrap gap-2">
            {TIMEOUT_CHOICES.map((m) => (
              <Button key={m} size="sm" variant={minutes === m ? "primary" : "secondary"} role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)}>
                {durationLabel(m)}
              </Button>
            ))}
          </div>
        )}
        {asksWhy && (
          <label className="flex flex-col gap-[7px] text-[13px] text-text-tertiary">
            Reason (kept in the audit log)
            <Input aria-label="Reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </label>
        )}
        <FeedbackLine feedback={feedback} />
      </div>
    </Modal>
  );
}

/** Members: who is here, what they hold, and the tools to look after them. */
export function MembersSection() {
  const { data: me } = useMyProfile();
  const { data, isPending, error, refetch } = useUsers();
  const states = useModerationStates();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<Action | null>(null);

  if (isPending) return <LoadingState message="Loading members…" />;
  if (error) return <ErrorState title="Couldn't load members" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;
  if (data.length === 0) return <EmptyState title="No members yet" />;

  const shown = [...data]
    .filter((m) => m.username.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.username.localeCompare(b.username));
  const known = states.data;

  return (
    <>
      <Panel
        title={`${data.length} ${data.length === 1 ? "member" : "members"}`}
        description="Change roles, time someone out, or ban them. Everything is recorded in the audit log."
        grow
        flush
        action={
          <div className="w-56">
            <Input aria-label="Search members" placeholder="Search members" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        }
      >
        <table className={tableClasses.table}>
          <thead>
            <tr>
              <th scope="col" className={tableClasses.head}>Member</th>
              <th scope="col" className={tableClasses.head}>Status</th>
              <th scope="col" className={tableClasses.head}>Roles</th>
              <th scope="col" className={`${tableClasses.head} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((member) => {
              const state = known?.get(member.user_id);
              const isOwner = (member.roles_ids ?? []).includes(OWNER_ROLE_ID);
              const self = member.user_id === me?.user_id;
              const timedOut = state?.timeoutUntil ?? null;
              const act = (kind: Action["kind"]) => setAction({ kind, member });
              return (
                <tr key={member.user_id} className={tableClasses.row}>
                  <td className={tableClasses.cell}>
                    <span className="inline-flex items-center gap-3">
                      <Avatar name={member.username} src={member.avatar_url} seed={member.user_id} size={32} presence={member.status} ringColor="var(--color-background-secondary)" />
                      <span className="font-semibold">{member.username}</span>
                      {self && <span className="text-xs text-text-muted">you</span>}
                    </span>
                  </td>
                  <td className={`${tableClasses.cell} text-text-tertiary`}>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {PRESENCE[member.status].label}
                      {state?.banned && <Tag tone="red">Banned</Tag>}
                      {timedOut && <Tag tone="brass">Timed out until {timedOut.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</Tag>}
                    </span>
                  </td>
                  <td className={tableClasses.cell}>
                    <span className="inline-flex flex-wrap gap-1.5">
                      {roleNames(member).map((name) => (
                        <Tag key={name} tone={name.toLowerCase() === "owner" ? "brass" : "neutral"}>{name}</Tag>
                      ))}
                    </span>
                  </td>
                  <td className={`${tableClasses.cell} text-right`}>
                    <span className="inline-flex flex-wrap justify-end gap-1.5">
                      <Button size="sm" variant="secondary" aria-label={`Roles of ${member.username}`} disabled={isOwner} onClick={() => act("roles")}>
                        Roles
                      </Button>
                      {!isOwner && !self && (
                        <>
                          {timedOut ? (
                            <Button size="sm" variant="secondary" aria-label={`End the timeout of ${member.username}`} onClick={() => act("clear-timeout")}>
                              End timeout
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" aria-label={`Time out ${member.username}`} onClick={() => act("timeout")}>
                              Time out
                            </Button>
                          )}
                          {state?.banned ? (
                            <Button size="sm" variant="secondary" aria-label={`Unban ${member.username}`} onClick={() => act("unban")}>
                              Unban
                            </Button>
                          ) : (
                            <Button size="sm" variant="danger" aria-label={`Ban ${member.username}`} onClick={() => act("ban")}>
                              Ban
                            </Button>
                          )}
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className={`${tableClasses.cell} text-center text-text-tertiary`}>
                  No one called &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
      {action?.kind === "roles" && <RolesDialog member={action.member} onClose={() => setAction(null)} />}
      {action && action.kind !== "roles" && <ModerationDialog action={action} onClose={() => setAction(null)} />}
    </>
  );
}
