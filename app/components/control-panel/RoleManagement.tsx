import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "../Button";
import type { ShowToast } from "../Toast";
import { Modal } from "../ui/Modal";
import { convertToFullStorageUrl } from "../../services/apiClient";
import {
  createInstanceRole,
  deleteInstanceRole,
  type InstancePrivilege,
  type InstanceRole,
  updateInstanceRole,
  updateInstanceUserRoles,
} from "../../services/system";

type MemberRecord = {
  user_id: string;
  username: string;
  roles_ids: string[];
  avatar_url?: string | null;
};

type RoleCatalogModalProps = {
  authToken: string;
  isOpen: boolean;
  onClose: () => void;
  privileges: InstancePrivilege[];
  roles: InstanceRole[];
  showToast: ShowToast;
  onRolesChanged: () => Promise<void>;
};

type MemberRoleEditorModalProps = {
  authToken: string;
  isOpen: boolean;
  onClose: () => void;
  roles: InstanceRole[];
  showToast: ShowToast;
  user: MemberRecord | null;
  onRolesChanged: () => Promise<void>;
};

type RolesTabProps = {
  authToken: string;
  privileges: InstancePrivilege[];
  roles: InstanceRole[];
  showToast: ShowToast;
  users: MemberRecord[];
  onRolesChanged: () => Promise<void>;
};

const toneByRoleId: Record<string, string> = {
  owner: "var(--color-info)",
  admin: "var(--color-error)",
  moderator: "var(--color-warning)",
  user: "var(--color-text-muted)",
};

const textToneByRoleId: Record<string, string> = {
  owner: "var(--color-text)",
  admin: "var(--color-text)",
  moderator: "var(--color-text)",
  user: "var(--color-text)",
};

const getRoleTone = (roleId: string) => toneByRoleId[roleId] ?? "var(--color-primary)";

const getRoleBadgeStyle = (roleId: string) => {
  const tone = getRoleTone(roleId);

  return {
    background: `color-mix(in srgb, ${tone} 14%, var(--color-surface-secondary) 86%)`,
    borderColor: `color-mix(in srgb, ${tone} 32%, var(--color-border-secondary))`,
    color: textToneByRoleId[roleId] ?? "var(--color-text)",
  };
};

const getRoleCardStyle = (roleId: string, isActive = false) => {
  const tone = getRoleTone(roleId);

  return {
    background: isActive
      ? `color-mix(in srgb, ${tone} 16%, var(--color-surface-secondary) 84%)`
      : "var(--color-surface-secondary)",
    borderColor: isActive
      ? `color-mix(in srgb, ${tone} 34%, var(--color-border))`
      : "var(--color-border)",
    boxShadow: isActive
      ? `0 0 0 1px color-mix(in srgb, ${tone} 18%, transparent)`
      : "none",
  };
};

const formatTokenLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

export function RoleBadgeList({
  roleIds,
  roles,
}: {
  roleIds: string[] | undefined;
  roles: InstanceRole[];
}) {
  const roleMap = useMemo(() => new Map(roles.map((role) => [role.role_id, role])), [roles]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(roleIds || []).map((roleId) => {
        const role = roleMap.get(roleId);
        if (!role) return null;

        return (
          <span
            key={role.role_id}
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={getRoleBadgeStyle(role.role_id)}
            title={role.role_name}
          >
            {role.role_name}
          </span>
        );
      })}
    </div>
  );
}

function PrivilegeChip({ privilegeId }: { privilegeId: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]"
      title={privilegeId}
    >
      {formatTokenLabel(privilegeId)}
    </span>
  );
}

export function RoleCatalogModal({
  authToken,
  isOpen,
  onClose,
  privileges,
  roles,
  showToast,
  onRolesChanged,
}: RoleCatalogModalProps) {
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [selectedPrivilegeIds, setSelectedPrivilegeIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingRoleId, setIsDeletingRoleId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEditingRoleId(null);
      setRoleName("");
      setSelectedPrivilegeIds([]);
    }
  }, [isOpen]);

  const groupedPrivileges = useMemo(() => {
    return privileges.reduce<Record<string, InstancePrivilege[]>>((acc, privilege) => {
      acc[privilege.category] = acc[privilege.category] || [];
      acc[privilege.category].push(privilege);
      return acc;
    }, {});
  }, [privileges]);

  const privilegeSections = useMemo(
    () =>
      Object.entries(groupedPrivileges)
        .map(([category, categoryPrivileges]) => [
          category,
          [...categoryPrivileges].sort((left, right) =>
            left.privilege_name.localeCompare(right.privilege_name),
          ),
        ] as const)
        .sort(([left], [right]) => formatTokenLabel(left).localeCompare(formatTokenLabel(right))),
    [groupedPrivileges],
  );

  const editingRole = useMemo(
    () => roles.find((role) => role.role_id === editingRoleId) ?? null,
    [editingRoleId, roles],
  );

  const isViewingSystemRole = editingRole?.is_system ?? false;

  const beginEdit = (role?: InstanceRole) => {
    setEditingRoleId(role?.role_id ?? null);
    setRoleName(role?.role_name ?? "");
    setSelectedPrivilegeIds(role?.privileges_ids ?? []);
  };

  const togglePrivilege = (privilegeId: string) => {
    setSelectedPrivilegeIds((current) =>
      current.includes(privilegeId)
        ? current.filter((entry) => entry !== privilegeId)
        : [...current, privilegeId],
    );
  };

  const handleSave = async () => {
    if (isViewingSystemRole) {
      showToast({
        message: "System roles are read-only.",
        tone: "warning",
        category: "validation",
      });
      return;
    }

    if (!roleName.trim()) {
      showToast({
        message: "Role name is required.",
        tone: "warning",
        category: "validation",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = editingRoleId
        ? await updateInstanceRole(editingRoleId, {
            auth_token: authToken,
            role_name: roleName.trim(),
            privileges_ids: selectedPrivilegeIds,
          })
        : await createInstanceRole({
            auth_token: authToken,
            role_name: roleName.trim(),
            privileges_ids: selectedPrivilegeIds,
          });

      if (!response.success) {
        showToast({
          message: response.error || "Failed to save role.",
          tone: "error",
          category: "system",
        });
        return;
      }

      showToast({
        message: editingRoleId ? "Role updated successfully." : "Role created successfully.",
        tone: "success",
        category: "destructive",
      });
      await onRolesChanged();
      beginEdit();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    const role = roles.find((entry) => entry.role_id === roleId);
    if (role?.is_system) {
      return;
    }

    setIsDeletingRoleId(roleId);
    try {
      const response = await deleteInstanceRole(roleId, authToken);
      if (!response.success) {
        showToast({
          message: response.error || "Failed to delete role.",
          tone: "error",
          category: "system",
        });
        return;
      }

      showToast({
        message: "Role deleted successfully.",
        tone: "success",
        category: "destructive",
      });
      await onRolesChanged();
      if (editingRoleId === roleId) {
        beginEdit();
      }
    } finally {
      setIsDeletingRoleId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Instance Roles"
      description="Create custom roles, inspect built-in access, and compose permissions without the dialog spilling out of the page."
      widthClassName="max-w-6xl"
      bodyClassName="p-0"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="flex h-full min-h-[min(70vh,46rem)] flex-col lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)] lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--color-border)] px-5 py-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              <Shield className="h-3.5 w-3.5" />
              Permission Catalog
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[var(--color-text)]">Role Library</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Select a role to inspect its permissions or start a fresh custom role.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Roles
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{roles.length}</div>
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Privileges
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{privileges.length}</div>
              </div>
            </div>
            <Button className="mt-4 w-full" startIcon={<Plus className="h-4 w-4" />} onClick={() => beginEdit()}>
              New Custom Role
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              {roles.map((role) => {
                const isActive = editingRoleId === role.role_id;
                return (
                  <button
                    key={role.role_id}
                    type="button"
                    onClick={() => beginEdit(role)}
                    className="w-full rounded-[1.25rem] border p-4 text-left transition-colors"
                    style={getRoleCardStyle(role.role_id, isActive)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--color-text)]">
                            {role.role_name}
                          </span>
                          <span
                            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                            style={getRoleBadgeStyle(role.role_id)}
                          >
                            {role.is_system ? "System" : "Custom"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                          <span>{role.user_count} member{role.user_count === 1 ? "" : "s"}</span>
                          <span className="h-1 w-1 rounded-full bg-[var(--color-text-muted)]" />
                          <span>{role.privileges_ids.length} permissions</span>
                        </div>
                      </div>
                      {role.is_system ? (
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {role.privileges_ids.slice(0, 3).map((privilegeId) => (
                        <PrivilegeChip key={privilegeId} privilegeId={privilegeId} />
                      ))}
                      {role.privileges_ids.length > 3 ? (
                        <span className="inline-flex items-center rounded-full border border-[var(--color-border-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-muted)]">
                          +{role.privileges_ids.length - 3} more
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        startIcon={<Pencil className="h-4 w-4" />}
                        onClick={(event) => {
                          event.stopPropagation();
                          beginEdit(role);
                        }}
                      >
                        {role.is_system ? "View" : "Edit"}
                      </Button>
                      {!role.is_system ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          startIcon={<Trash2 className="h-4 w-4" />}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDelete(role.role_id);
                          }}
                          disabled={isDeletingRoleId === role.role_id}
                        >
                          {isDeletingRoleId === role.role_id ? "Deleting..." : "Delete"}
                        </Button>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-[var(--color-surface)]">
          <div className="border-b border-[var(--color-border)] px-5 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {editingRole
                    ? isViewingSystemRole
                      ? "System Role Preview"
                      : "Custom Role Editor"
                    : "Create Custom Role"}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[var(--color-text)]">
                  {editingRole ? editingRole.role_name : "Build a new role"}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {isViewingSystemRole
                    ? "Built-in roles are locked, but you can inspect every permission they carry."
                    : "Use permission groups below to shape the exact access this role should grant."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm xl:min-w-[18rem]">
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    Type
                  </div>
                  <div className="mt-2 font-semibold text-[var(--color-text)]">
                    {editingRole ? (editingRole.is_system ? "System" : "Custom") : "Draft"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    Selected
                  </div>
                  <div className="mt-2 font-semibold text-[var(--color-text)]">{selectedPrivilegeIds.length}</div>
                </div>
                <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    Groups
                  </div>
                  <div className="mt-2 font-semibold text-[var(--color-text)]">{privilegeSections.length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-5">
            <div
              className="rounded-[1.25rem] border px-4 py-4"
              style={
                isViewingSystemRole
                  ? {
                      background:
                        "color-mix(in srgb, var(--color-info) 10%, var(--color-surface-secondary) 90%)",
                      borderColor:
                        "color-mix(in srgb, var(--color-info) 28%, var(--color-border-secondary))",
                    }
                  : {
                      background: "var(--color-surface-secondary)",
                      borderColor: "var(--color-border)",
                    }
              }
            >
              <label className="block text-sm text-[var(--color-text-secondary)]">
                Role Name
                <input
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  disabled={isViewingSystemRole}
                  className="mt-2 w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-2.5 text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Role name"
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-secondary)] px-2.5 py-1">
                  <KeyRound className="h-3.5 w-3.5" />
                  {selectedPrivilegeIds.length} selected permissions
                </span>
                {isViewingSystemRole ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-secondary)] px-2.5 py-1">
                    <Lock className="h-3.5 w-3.5" />
                    Locked built-in role
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-secondary)] px-2.5 py-1">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Changes apply to this instance only
                  </span>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-4">
                {privilegeSections.map(([category, categoryPrivileges]) => {
                  const selectedCount = categoryPrivileges.filter((privilege) =>
                    selectedPrivilegeIds.includes(privilege.privilege_id),
                  ).length;

                  return (
                    <div
                      key={category}
                      className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--color-text)]">
                            {formatTokenLabel(category)}
                          </h4>
                          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            {categoryPrivileges.length} permission{categoryPrivileges.length === 1 ? "" : "s"} in this group
                          </p>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">
                          {selectedCount} selected
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2">
                        {categoryPrivileges.map((privilege) => {
                          const isSelected = selectedPrivilegeIds.includes(privilege.privilege_id);

                          return (
                            <label
                              key={privilege.privilege_id}
                              className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                                isViewingSystemRole
                                  ? "cursor-default"
                                  : "cursor-pointer hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-hover)]"
                              }`}
                              style={
                                isSelected
                                  ? {
                                      background:
                                        "color-mix(in srgb, var(--color-primary) 10%, var(--color-surface) 90%)",
                                      borderColor:
                                        "color-mix(in srgb, var(--color-primary) 28%, var(--color-border-secondary))",
                                    }
                                  : {
                                      background: "var(--color-surface)",
                                      borderColor: "var(--color-border-secondary)",
                                    }
                              }
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePrivilege(privilege.privilege_id)}
                                disabled={isViewingSystemRole}
                                className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-[var(--color-text)]">
                                  {privilege.privilege_name}
                                </div>
                                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                                  {privilege.privilege_id}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
              <Button variant="ghost" onClick={() => beginEdit()}>
                Reset
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isViewingSystemRole}>
                {isSaving ? "Saving..." : editingRoleId ? "Save Changes" : "Create Role"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}

export function MemberRoleEditorModal({
  authToken,
  isOpen,
  onClose,
  roles,
  showToast,
  user,
  onRolesChanged,
}: MemberRoleEditorModalProps) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedRoleIds(user?.roles_ids || []);
  }, [user]);

  if (!user) {
    return null;
  }

  const toggleRole = (roleId: string) => {
    if (roleId === "owner" && !user.roles_ids.includes("owner")) {
      return;
    }

    setSelectedRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((entry) => entry !== roleId)
        : [...current, roleId],
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const normalizedRoleIds = selectedRoleIds.length > 0 ? selectedRoleIds : ["user"];
      const response = await updateInstanceUserRoles(user.user_id, {
        auth_token: authToken,
        roles_ids: normalizedRoleIds,
      });

      if (!response.success) {
        showToast({
          message: response.error || "Failed to update member roles.",
          tone: "error",
          category: "system",
        });
        return;
      }

      showToast({
        message: `Updated roles for ${user.username}.`,
        tone: "success",
        category: "destructive",
      });
      await onRolesChanged();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Roles for ${user.username}`}
      description="Assign instance roles with a scroll-safe role list that keeps privilege details readable."
      widthClassName="max-w-3xl"
      bodyClassName="p-0"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Roles"}
          </Button>
        </div>
      }
    >
      <div className="flex h-full min-h-[min(62vh,38rem)] flex-col">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-5 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                <img
                  src={convertToFullStorageUrl(user.avatar_url)}
                  alt={user.username}
                  className="h-14 w-14 rounded-2xl border border-[var(--color-border-secondary)] object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-lg font-semibold text-[var(--color-text)]">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-lg font-semibold text-[var(--color-text)]">{user.username}</div>
                <div className="mt-2">
                  <RoleBadgeList roleIds={selectedRoleIds.length > 0 ? selectedRoleIds : ["user"]} roles={roles} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[14rem]">
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Assigned
                </div>
                <div className="mt-2 font-semibold text-[var(--color-text)]">{selectedRoleIds.length || 1}</div>
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Available
                </div>
                <div className="mt-2 font-semibold text-[var(--color-text)]">{roles.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-3">
            {roles.map((role) => {
              const isProtectedOwnerRole = role.role_id === "owner" && !user.roles_ids.includes("owner");
              const isSelected = selectedRoleIds.includes(role.role_id);

              return (
                <label
                  key={role.role_id}
                  className={`block rounded-[1.25rem] border p-4 transition-colors ${
                    isProtectedOwnerRole
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:border-[var(--color-border-secondary)]"
                  }`}
                  style={getRoleCardStyle(role.role_id, isSelected)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRole(role.role_id)}
                      disabled={isProtectedOwnerRole}
                      className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--color-text)]">{role.role_name}</span>
                        <span
                          className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          style={getRoleBadgeStyle(role.role_id)}
                        >
                          {role.is_system ? "System" : "Custom"}
                        </span>
                        {isProtectedOwnerRole ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-secondary)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                            <Lock className="h-3.5 w-3.5" />
                            Owner locked
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                        <span>{role.privileges_ids.length} permissions</span>
                        <span className="h-1 w-1 rounded-full bg-[var(--color-text-muted)]" />
                        <span>{role.user_count} assigned member{role.user_count === 1 ? "" : "s"}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {role.privileges_ids.slice(0, 4).map((privilegeId) => (
                          <PrivilegeChip key={privilegeId} privilegeId={privilegeId} />
                        ))}
                        {role.privileges_ids.length > 4 ? (
                          <span className="inline-flex items-center rounded-full border border-[var(--color-border-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-muted)]">
                            +{role.privileges_ids.length - 4} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function RolesTab({
  authToken,
  privileges,
  roles,
  showToast,
  users,
  onRolesChanged,
}: RolesTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleCatalogOpen, setRoleCatalogOpen] = useState(false);
  const [memberRoleEditorOpen, setMemberRoleEditorOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<MemberRecord | null>(null);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        searchTerm === "" ? true : user.username.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, users],
  );

  const privilegeCategoryCounts = useMemo(
    () =>
      Object.entries(
        privileges.reduce<Record<string, number>>((acc, privilege) => {
          acc[privilege.category] = (acc[privilege.category] || 0) + 1;
          return acc;
        }, {}),
      )
        .sort(([, left], [, right]) => right - left)
        .slice(0, 5),
    [privileges],
  );

  const systemRoles = roles.filter((role) => role.is_system);
  const customRoles = roles.filter((role) => !role.is_system);
  const totalAssignments = roles.reduce((sum, role) => sum + role.user_count, 0);

  const openRoleEditorForUser = (user: MemberRecord) => {
    setSelectedUser(user);
    setMemberRoleEditorOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div
        className="relative overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 34%), linear-gradient(140deg, rgba(255,255,255,0.04), transparent 58%)",
        }}
      >
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
              <Shield className="h-3.5 w-3.5" />
              Roles And Permissions
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
              Shape access with a cleaner, scroll-safe roles workspace.
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Review your built-in roles, compose custom permissions, and assign access to members from one control-panel surface.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[30rem]">
            <div className="rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <Shield className="h-3.5 w-3.5" />
                System Roles
              </div>
              <div className="mt-3 text-3xl font-semibold text-[var(--color-text)]">{systemRoles.length}</div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Built-in roles stay locked and auditable.
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <Sparkles className="h-3.5 w-3.5" />
                Custom Roles
              </div>
              <div className="mt-3 text-3xl font-semibold text-[var(--color-text)]">{customRoles.length}</div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Instance-local role presets you can change anytime.
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <Users className="h-3.5 w-3.5" />
                Assignments
              </div>
              <div className="mt-3 text-3xl font-semibold text-[var(--color-text)]">{totalAssignments}</div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Total role-to-member links active right now.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              <KeyRound className="h-3.5 w-3.5" />
              Role Catalog
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[var(--color-text)]">Build and inspect permission sets</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Custom roles come from your instance privilege catalog, while system roles remain visible for comparison.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-4 py-2 text-sm text-[var(--color-text-secondary)]">
              {privileges.length} available permission{privileges.length === 1 ? "" : "s"}
            </div>
            <Button startIcon={<Plus className="h-4 w-4" />} onClick={() => setRoleCatalogOpen(true)}>
              Manage Roles
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_19rem]">
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map((role) => (
              <div
                key={role.role_id}
                className="rounded-[1.25rem] border p-4"
                style={getRoleCardStyle(role.role_id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">{role.role_name}</span>
                      <span
                        className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={getRoleBadgeStyle(role.role_id)}
                      >
                        {role.is_system ? "System" : "Custom"}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                      {role.user_count} assigned member{role.user_count === 1 ? "" : "s"}
                    </div>
                  </div>
                  {role.is_system ? (
                    <Lock className="h-4 w-4 text-[var(--color-text-muted)]" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-[var(--color-text-muted)]" />
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {role.privileges_ids.slice(0, 4).map((privilegeId) => (
                    <PrivilegeChip key={privilegeId} privilegeId={privilegeId} />
                  ))}
                  {role.privileges_ids.length > 4 ? (
                    <span className="inline-flex items-center rounded-full border border-[var(--color-border-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-muted)]">
                      +{role.privileges_ids.length - 4} more
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              <BadgeCheck className="h-3.5 w-3.5" />
              Permission Surface
            </div>
            <div className="mt-4 space-y-3">
              {privilegeCategoryCounts.map(([category, count]) => (
                <div
                  key={category}
                  className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-[var(--color-text)]">
                      {formatTokenLabel(category)}
                    </div>
                    <div className="text-sm font-semibold text-[var(--color-text)]">{count}</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Privileges available in this category
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              <Users className="h-3.5 w-3.5" />
              Member Assignment
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[var(--color-text)]">Assign roles without leaving the page</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Search for a member, review their current role mix, then open a focused editor for access changes.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-5">
            <label className="block text-sm text-[var(--color-text-secondary)]">
              Find member
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] py-2.5 pl-10 pr-3 text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-primary)]"
                />
              </div>
            </label>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Members</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{users.length}</div>
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Results</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{filteredUsers.length}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.user_id}
                className="flex flex-col gap-4 rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {user.avatar_url ? (
                    <img
                      src={convertToFullStorageUrl(user.avatar_url)}
                      alt={user.username}
                      className="h-12 w-12 rounded-2xl border border-[var(--color-border-secondary)] object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-text)]">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 space-y-2">
                    <div className="truncate text-sm font-semibold text-[var(--color-text)]">{user.username}</div>
                    <RoleBadgeList roleIds={user.roles_ids} roles={roles} />
                  </div>
                </div>
                <Button variant="secondary" onClick={() => openRoleEditorForUser(user)}>
                  Edit Roles
                </Button>
              </div>
            ))}
            {filteredUsers.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-8 text-sm text-[var(--color-text-secondary)]">
                No members matched that search.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <RoleCatalogModal
        authToken={authToken}
        isOpen={roleCatalogOpen}
        onClose={() => setRoleCatalogOpen(false)}
        privileges={privileges}
        roles={roles}
        showToast={showToast}
        onRolesChanged={onRolesChanged}
      />

      <MemberRoleEditorModal
        authToken={authToken}
        isOpen={memberRoleEditorOpen}
        onClose={() => {
          setMemberRoleEditorOpen(false);
          setSelectedUser(null);
        }}
        roles={roles}
        showToast={showToast}
        user={selectedUser}
        onRolesChanged={onRolesChanged}
      />
    </div>
  );
}
