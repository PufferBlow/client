import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Panel, Tag } from "../../components/control-panel/Panel";
import { FeedbackLine } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import type { Privilege, Role } from "../../features/admin/api";
import { usePrivileges, useRoleAdmin, useRoles } from "../../features/admin/hooks";
import { classifyAuthError } from "../../utils/authErrors";

const NEW = "__new__";

/** Privileges grouped by their category, categories in the order the server lists them. */
function groupByCategory(privileges: readonly Privilege[]): Array<[string, Privilege[]]> {
  const groups = new Map<string, Privilege[]>();
  for (const p of privileges) groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  return [...groups.entries()];
}

const label = (text: string) => text.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function RoleEditor({ role, privileges, onDone }: { role: Role | null; privileges: readonly Privilege[]; onDone: (id: string | null) => void }) {
  const admin = useRoleAdmin();
  const { run, loading, feedback } = useSave(role ? "Role saved." : "Role created.");
  const removal = useSave("Role deleted.");
  const [name, setName] = useState(role?.role_name ?? "");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(role?.privileges_ids ?? []));
  const readOnly = role?.is_system === true;
  const groups = useMemo(() => groupByCategory(privileges), [privileges]);

  const same = role && name.trim() === role.role_name && picked.size === role.privileges_ids.length && role.privileges_ids.every((id) => picked.has(id));
  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    const body = { role_name: name.trim(), privileges_ids: [...picked] };
    let createdId: string | null = null;
    const ok = await run(async () => {
      if (role) await admin.update.mutateAsync({ roleId: role.role_id, ...body });
      else createdId = (await admin.create.mutateAsync(body)).role.role_id;
    });
    if (ok && createdId) onDone(createdId);
  };

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-[7px] text-[13px] text-text-tertiary">
        Role name
        <Input aria-label="Role name" value={name} maxLength={40} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
      </label>

      {readOnly && <p className="m-0 text-[13px] text-text-tertiary">This role is built in, so it cannot be changed or deleted. It grants what is ticked below.</p>}

      <div className="flex flex-col gap-4">
        {groups.map(([category, items]) => (
          <fieldset key={category} className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="pb-section-label mb-2 p-0">{label(category)}</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {items.map((p) => (
                <label key={p.privilege_id} className="flex cursor-pointer items-center gap-2.5 rounded-md bg-surface-secondary px-3 py-2 text-[13.5px] text-text-body has-[:disabled]:cursor-default">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-primary)]"
                    checked={picked.has(p.privilege_id)}
                    disabled={readOnly}
                    onChange={() => toggle(p.privilege_id)}
                  />
                  {p.privilege_name}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void save()} loading={loading} disabled={name.trim() === "" || (role !== null && same === true)}>
            {role ? "Save role" : "Create role"}
          </Button>
          {role && (
            <Button
              variant="danger"
              loading={removal.loading}
              disabled={role.user_count > 0}
              title={role.user_count > 0 ? "Take this role off its members first" : undefined}
              onClick={async () => {
                if (await removal.run(() => admin.remove.mutateAsync(role.role_id).then(() => undefined))) onDone(null);
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              Delete role
            </Button>
          )}
          <FeedbackLine feedback={feedback ?? removal.feedback} />
        </div>
      )}
    </div>
  );
}

/** Roles: what each one lets a person do, and the place to make your own. */
export function RolesSection() {
  const roles = useRoles();
  const privileges = usePrivileges();
  const [selected, setSelected] = useState<string | null>(null);

  if (roles.isPending || privileges.isPending) return <LoadingState message="Loading roles…" />;
  if (roles.error || !roles.data || privileges.error || !privileges.data) {
    return (
      <ErrorState
        title="Couldn't load roles"
        message={classifyAuthError(roles.error ?? privileges.error, "Try again.").message}
        onRetry={() => {
          void roles.refetch();
          void privileges.refetch();
        }}
      />
    );
  }

  const current = selected === NEW ? null : (roles.data.find((r) => r.role_id === selected) ?? roles.data[0] ?? null);
  const editing = selected === NEW ? NEW : (current?.role_id ?? NEW);

  return (
    <div className="grid flex-1 items-stretch gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <Panel
        title={`${roles.data.length} ${roles.data.length === 1 ? "role" : "roles"}`}
        description="Built-in roles are fixed; add your own."
        grow
        action={
          <Button size="sm" onClick={() => setSelected(NEW)}>
            <Plus size={14} aria-hidden="true" />
            New role
          </Button>
        }
      >
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {roles.data.map((role) => (
            <li key={role.role_id}>
              <button
                type="button"
                aria-pressed={editing === role.role_id}
                onClick={() => setSelected(role.role_id)}
                className={`flex w-full items-center gap-3 rounded-lg border-0 px-3 py-2.5 text-left transition-colors ${
                  editing === role.role_id ? "bg-text text-on-primary" : "bg-surface-secondary text-text-body hover:bg-surface-tertiary"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{role.role_name}</span>
                  <span className={`block text-xs ${editing === role.role_id ? "text-on-primary/70" : "text-text-muted"}`}>
                    {role.user_count} {role.user_count === 1 ? "member" : "members"} · {role.privileges_ids.length} {role.privileges_ids.length === 1 ? "privilege" : "privileges"}
                  </span>
                </span>
                {role.is_system && <Tag>Built in</Tag>}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={editing === NEW ? "New role" : (current?.role_name ?? "Role")} description="Tick what people with this role may do." grow>
        <RoleEditor key={editing} role={editing === NEW ? null : current} privileges={privileges.data} onDone={(id) => setSelected(id)} />
      </Panel>
    </div>
  );
}
