import { useEffect, useMemo, useState } from "react";

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
  moderator: "var(--color-accent)",
  user: "var(--color-text-muted)",
};

const textToneByRoleId: Record<string, string> = {
  owner: "var(--color-on-info)",
  admin: "var(--color-on-error)",
  moderator: "var(--color-on-primary)",
  user: "var(--color-text)",
};

const badgeStyle = (roleId: string) => ({
  backgroundColor: toneByRoleId[roleId] ?? "var(--color-primary)",
  color: textToneByRoleId[roleId] ?? "var(--color-on-primary)",
});

export function RoleBadgeList({
  roleIds,
  roles,
}: {
  roleIds: string[] | undefined;
  roles: InstanceRole[];
}) {
  const roleMap = useMemo(
    () => new Map(roles.map((role) => [role.role_id, role])),
    [roles],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(roleIds || []).map((roleId) => {
        const role = roleMap.get(roleId);
        if (!role) return null;
        return (
          <span
            key={role.role_id}
            className="rounded px-1.5 py-0.5 text-xs font-medium"
            style={badgeStyle(role.role_id)}
            title={role.role_name}
          >
            {role.role_name.toUpperCase()}
          </span>
        );
      })}
    </div>
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
        message: editingRoleId
          ? "Role updated successfully."
          : "Role created successfully.",
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
      description="Create custom roles from the instance privilege catalog and keep permissions local to this home instance."
      widthClassName="max-w-5xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              Current Roles
            </h3>
            <Button onClick={() => beginEdit()}>New Role</Button>
          </div>
          <div className="space-y-3">
            {roles.map((role) => (
              <div
                key={role.role_id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">
                        {role.role_name}
                      </span>
                      {role.is_system ? (
                        <span className="rounded bg-[var(--color-surface-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                          System
                        </span>
                      ) : null}
                      <span className="rounded bg-[var(--color-surface-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                        {role.user_count} member{role.user_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {role.privileges_ids.map((privilegeId) => (
                        <span
                          key={privilegeId}
                          className="rounded bg-[var(--color-surface-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]"
                        >
                          {privilegeId}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => beginEdit(role)}
                      disabled={role.is_system}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleDelete(role.role_id)}
                      disabled={role.is_system || isDeletingRoleId === role.role_id}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              {editingRoleId ? "Edit Custom Role" : "Create Custom Role"}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Choose from the existing privilege catalog. Built-in roles stay immutable.
            </p>
          </div>

          <label className="block text-sm text-[var(--color-text-secondary)]">
            Role Name
            <input
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
              placeholder="Role name"
            />
          </label>

          <div className="space-y-3">
            {Object.entries(groupedPrivileges).map(([category, categoryPrivileges]) => (
              <div
                key={category}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3"
              >
                <h4 className="text-sm font-semibold capitalize text-[var(--color-text)]">
                  {category.replaceAll("_", " ")}
                </h4>
                <div className="mt-3 space-y-2">
                  {categoryPrivileges.map((privilege) => (
                    <label
                      key={privilege.privilege_id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPrivilegeIds.includes(privilege.privilege_id)}
                        onChange={() => togglePrivilege(privilege.privilege_id)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-medium text-[var(--color-text)]">
                          {privilege.privilege_name}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {privilege.privilege_id}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => beginEdit()}>
              Reset
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingRoleId ? "Save Changes" : "Create Role"}
            </Button>
          </div>
        </div>
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
      description="Assign instance roles dynamically. Changes apply only to this home instance."
      widthClassName="max-w-2xl"
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
      <div className="space-y-3">
        {roles.map((role) => {
          const isProtectedOwnerRole =
            role.role_id === "owner" && !user.roles_ids.includes("owner");
          return (
            <label
              key={role.role_id}
              className={`flex items-start gap-3 rounded-lg border border-[var(--color-border)] px-4 py-3 ${
                isProtectedOwnerRole
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer bg-[var(--color-surface-secondary)]"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedRoleIds.includes(role.role_id)}
                onChange={() => toggleRole(role.role_id)}
                disabled={isProtectedOwnerRole}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-text)]">
                    {role.role_name}
                  </span>
                  {role.is_system ? (
                    <span className="rounded bg-[var(--color-surface-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                      System
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {role.privileges_ids.join(", ")}
                </div>
              </div>
            </label>
          );
        })}
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
        searchTerm === ""
          ? true
          : user.username.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, users],
  );

  const systemRoles = roles.filter((role) => role.is_system);
  const customRoles = roles.filter((role) => !role.is_system);
  const totalAssignments = roles.reduce((sum, role) => sum + role.user_count, 0);

  const openRoleEditorForUser = (user: MemberRecord) => {
    setSelectedUser(user);
    setMemberRoleEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="text-sm text-[var(--color-text-secondary)]">System Roles</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--color-text)]">
            {systemRoles.length}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Built-in roles protected by the instance.
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="text-sm text-[var(--color-text-secondary)]">Custom Roles</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--color-text)]">
            {customRoles.length}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Owner-defined roles built from the privilege catalog.
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="text-sm text-[var(--color-text-secondary)]">Privilege Assignments</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--color-text)]">
            {totalAssignments}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Total role-to-member assignments on this instance.
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">Role Catalog</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Create and edit instance-local roles from the current privilege catalog.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              {privileges.length} available privilege{privileges.length === 1 ? "" : "s"}
            </div>
            <Button onClick={() => setRoleCatalogOpen(true)}>Manage Roles</Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {roles.map((role) => (
            <div
              key={role.role_id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">
                      {role.role_name}
                    </span>
                    {role.is_system ? (
                      <span className="rounded bg-[var(--color-surface-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                        System
                      </span>
                    ) : (
                      <span className="rounded bg-[var(--color-primary)] px-2 py-0.5 text-xs text-[var(--color-on-primary)]">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {role.user_count} assigned member{role.user_count === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {role.privileges_ids.map((privilegeId) => (
                  <span
                    key={privilegeId}
                    className="rounded bg-[var(--color-surface-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]"
                  >
                    {privilegeId}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">Member Role Assignment</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Pick a member and update the instance roles assigned to them.
            </p>
          </div>
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-4 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <div className="mt-6 space-y-3">
          {filteredUsers.map((user) => (
            <div
              key={user.user_id}
              className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex items-center gap-3">
                {user.avatar_url ? (
                  <img
                    src={convertToFullStorageUrl(user.avatar_url)}
                    alt={user.username}
                    className="h-10 w-10 rounded-full border border-[var(--color-border-secondary)] object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-on-primary)]">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="space-y-1">
                  <div className="font-medium text-[var(--color-text)]">{user.username}</div>
                  <RoleBadgeList roleIds={user.roles_ids} roles={roles} />
                </div>
              </div>
              <Button variant="ghost" onClick={() => openRoleEditorForUser(user)}>
                Edit Roles
              </Button>
            </div>
          ))}
          {filteredUsers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 text-sm text-[var(--color-text-secondary)]">
              No members matched that search.
            </div>
          ) : null}
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
