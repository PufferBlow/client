/**
 * MembersTab — admin roster of all users on the instance, with role badges
 * and quick moderation actions (timeout, ban, edit roles).
 *
 * Role assignment now happens directly in this tab via
 * MemberRoleEditorModal — the old "Edit Roles" menu item used to jump
 * the user over to the Roles tab to find the same person again, which
 * was an awkward two-step flow for what is fundamentally a per-member
 * action. The Roles tab is still where you build role definitions; this
 * tab is now where you assign them.
 */
import React, { useEffect, useRef, useState } from "react";
import { getAuthTokenFromCookies, type ListUsersResponse } from "../../../services/user";
import { banUser, timeoutUser } from "../../../services/moderation";
import type { ShowToast } from "../../Toast";
import { ModerationActionModal, type ModerationActionSubmit } from "../../ModerationActionModal";
import { MemberRoleEditorModal, RoleBadgeList } from "../RoleManagement";
import { ControlPanelAvatar } from "../ControlPanelAvatar";
import {
  cx,
  controlPanelSectionClass,
  controlPanelButtonClass,
  controlPanelInputClass,
  controlPanelRowClass,
} from "../shared";

export function MembersTab({
  authToken,
  roles,
  users,
  onOpenRolesTab,
  onRolesChanged,
  showToast
}: {
  authToken: string;
  roles: import("../../../services/system").InstanceRole[];
  users: ListUsersResponse['users'];
  onOpenRolesTab: () => void;
  onRolesChanged: () => Promise<void>;
  showToast: ShowToast;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedUserMenu, setSelectedUserMenu] = useState<typeof users[0] | null>(null);
  const [userMenuPosition, setUserMenuPosition] = useState({ x: 0, y: 0 });
  // Moderation modal — same single-field pattern used in DashboardPage so a
  // moderator can never trigger two simultaneous prompts.
  const [moderationAction, setModerationAction] = useState<{
    kind: 'timeout' | 'ban';
    userId: string;
    username: string;
  } | null>(null);
  const [moderationSubmitting, setModerationSubmitting] = useState(false);
  // Role editor modal — opened from the per-member "Edit Roles" menu
  // item below. Lives in this tab so assignment can happen without
  // jumping to the Roles tab to find the same user again.
  const [roleEditorUser, setRoleEditorUser] = useState<{
    user_id: string;
    username: string;
    roles_ids: string[];
    avatar_url?: string | null;
  } | null>(null);
  // Refs for the dropdown menu and the trigger button. The outside-
  // click handler uses them to decide whether a mousedown should
  // close the menu. Without these the handler would fire on the menu
  // items themselves and clear `selectedUserMenu` before the click
  // handler had a chance to read it, which broke "Edit Roles".
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuTriggerRef = useRef<HTMLElement | null>(null);

  // Show loading state when no users are loaded yet
  if (!users || users.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col space-y-6">
        <div className={cx(controlPanelSectionClass, "flex min-h-0 flex-1 flex-col")}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-[var(--color-text)]">Manage Members</h2>
            <button className={cx(controlPanelButtonClass('secondary'), "cursor-not-allowed opacity-60 whitespace-nowrap")}>
              Invite Member
            </button>
          </div>

          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center px-4 py-3">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 bg-[var(--color-surface-tertiary)] rounded-full"></div>
                  <div>
                    <div className="h-4 bg-[var(--color-surface-tertiary)] rounded mb-1 w-24"></div>
                    <div className="h-3 bg-[var(--color-surface-tertiary)] rounded w-32"></div>
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="h-3 bg-[var(--color-surface-tertiary)] rounded"></div>
                </div>
                <div className="w-12">
                  <div className="w-5 h-5 bg-[var(--color-surface-tertiary)] rounded"></div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center text-[var(--color-text-secondary)] py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p>Loading members...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleUserMenu = (user: typeof users[0], event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // Remember which trigger opened the menu so the outside-click
    // handler can ignore a re-click on it (otherwise the close-on-
    // outside fires first and the same click immediately reopens).
    userMenuTriggerRef.current = target;
    setSelectedUserMenu(user);
    setUserMenuPosition({
      x: Math.min(rect.left + window.scrollX, window.innerWidth - 200),
      y: rect.bottom + window.scrollY + 5
    });
    setUserMenuOpen(!userMenuOpen || selectedUserMenu?.user_id !== user.user_id);
  };

  const handleUserAction = (action: 'editRoles' | 'timeout' | 'ban') => {
    if (!selectedUserMenu) return;

    const targetUserId = selectedUserMenu.user_id;
    const targetUsername = selectedUserMenu.username;

    if (action === 'editRoles') {
      // Open the role editor for THIS user, in this tab. The Roles tab
      // remains the place to define roles, but assigning them to a
      // specific member happens here so the moderator doesn't lose the
      // context they're working in.
      setRoleEditorUser({
        user_id: selectedUserMenu.user_id,
        username: selectedUserMenu.username,
        roles_ids: selectedUserMenu.roles_ids || [],
        avatar_url: selectedUserMenu.avatar_url || selectedUserMenu.avatar || null,
      });
      setUserMenuOpen(false);
      setSelectedUserMenu(null);
      return;
    }

    // Defer the actual ban/timeout call into handleModerationSubmit so the
    // modal can collect a duration + reason with proper inputs (and inline
    // validation) instead of stacked window.prompt dialogs.
    setModerationAction({ kind: action, userId: targetUserId, username: targetUsername });
  };

  const handleModerationSubmit = async (data: ModerationActionSubmit) => {
    if (!moderationAction) return;
    const { kind, userId, username } = moderationAction;
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      showToast({
        message: 'You need to be signed in to moderate users.',
        tone: 'error',
        category: 'system',
      });
      setModerationAction(null);
      return;
    }

    setModerationSubmitting(true);
    try {
      if (kind === 'timeout') {
        const response = await timeoutUser(userId, {
          auth_token: authToken,
          duration_minutes: data.durationMinutes!,
          reason: data.reason,
        });
        if (!response.success) {
          showToast({
            message: `Failed to timeout ${username}: ${response.error || 'Unknown error'}`,
            tone: 'error',
            category: 'system',
          });
          return;
        }
        const minutes = data.durationMinutes!;
        showToast({
          message: `${username} has been timed out for ${minutes} minute${minutes === 1 ? '' : 's'}.`,
          tone: 'success',
          category: 'destructive',
        });
      } else {
        const response = await banUser(userId, {
          auth_token: authToken,
          reason: data.reason,
        });
        if (!response.success) {
          showToast({
            message: `Failed to ban ${username}: ${response.error || 'Unknown error'}`,
            tone: 'error',
            category: 'system',
          });
          return;
        }
        showToast({
          message: `${username} has been banned from this home instance.`,
          tone: 'success',
          category: 'destructive',
        });
      }
      setModerationAction(null);
      setUserMenuOpen(false);
      setSelectedUserMenu(null);
    } finally {
      setModerationSubmitting(false);
    }
  };

  // Close menu on outside click. We have to scope this carefully: a
  // blanket `setSelectedUserMenu(null)` on every mousedown would
  // clear the user reference before the menu item's own click
  // handler can read it, which is exactly the bug that left "Edit
  // Roles" doing nothing. We bail out for mousedowns inside the
  // dropdown (so menu items resolve normally) and for mousedowns on
  // the trigger that opened the menu (so re-clicking the 3-dot
  // doesn't close-then-immediately-reopen).
  useEffect(() => {
    if (!userMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (userMenuRef.current && target && userMenuRef.current.contains(target)) {
        return;
      }
      if (userMenuTriggerRef.current && target && userMenuTriggerRef.current.contains(target)) {
        return;
      }
      setUserMenuOpen(false);
      setSelectedUserMenu(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-6">
      <ModerationActionModal
        action={
          moderationAction
            ? { kind: moderationAction.kind, username: moderationAction.username }
            : null
        }
        isSubmitting={moderationSubmitting}
        onSubmit={handleModerationSubmit}
        onCancel={() => {
          if (moderationSubmitting) return;
          setModerationAction(null);
        }}
      />

      {/* Role editor modal. Stays inside MembersTab so closing it
          returns the moderator to the same scroll position in the
          roster they were already working in. */}
      <MemberRoleEditorModal
        authToken={authToken}
        isOpen={Boolean(roleEditorUser)}
        onClose={() => setRoleEditorUser(null)}
        roles={roles}
        showToast={showToast}
        user={roleEditorUser}
        onRolesChanged={onRolesChanged}
      />

      <div className={cx(controlPanelSectionClass, "flex min-h-0 flex-1 flex-col")}>
        {/* Header. The Open Roles + Invite Member buttons used to share
            a single inline row with the search input. The input is
            `w-full` so it ballooned and squeezed the buttons until
            their labels wrapped. Now: the search input owns a flex-1
            slot, and both action buttons sit in a no-shrink group with
            `whitespace-nowrap` so they always have enough width for
            their label regardless of the surrounding layout. */}
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Manage Members</h2>
          <div className="flex flex-1 flex-wrap items-center gap-3 lg:justify-end">
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cx(controlPanelInputClass, "min-w-0 flex-1 lg:max-w-sm")}
            />
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={onOpenRolesTab}
                className={cx(controlPanelButtonClass('secondary'), "whitespace-nowrap")}
              >
                Open Roles
              </button>
              <button className={cx(controlPanelButtonClass('primary'), "whitespace-nowrap")}>
                Invite Member
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {/* Filter users based on search term */}
          {users.filter(user =>
            searchTerm === '' ||
            user.username.toLowerCase().includes(searchTerm.toLowerCase())
          ).map((user) => (
            <div
              key={user.user_id}
              className={cx(controlPanelRowClass, "flex items-center px-4 py-3 cursor-pointer")}
            >
              {/* User info on the left */}
              <div className="flex items-center space-x-3 flex-1">
                <div className="relative">
                  <ControlPanelAvatar
                    username={user.username}
                    avatarUrl={user.avatar_url || user.avatar}
                    className="h-10 w-10 rounded-full border border-[var(--color-border-secondary)]"
                  />
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--color-surface)] shadow-sm ${user.status === 'online' ? 'bg-[var(--color-success)]' :
                      user.status === 'idle' ? 'bg-[var(--color-warning)]' :
                        user.status === 'dnd' ? 'bg-[var(--color-error)]' :
                          'bg-[var(--color-border)]'
                    }`}></div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-[var(--color-text)]">{user.username}</span>
                  <RoleBadgeList roleIds={user.roles_ids} roles={roles} />
                </div>
              </div>

              {/* Joined date in the middle */}
              <div className="flex-1 text-center text-[var(--color-text-secondary)]">
                Joined {new Date(user.created_at || '2023-01-01').toLocaleDateString()}
              </div>

              {/* Three dots menu on the right */}
              <div className="w-12 flex justify-end">
                <button
                  onClick={(event) => { event.stopPropagation(); handleUserMenu(user, event); }}
                  className="p-1 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Menu Dropdown */}
      {userMenuOpen && selectedUserMenu && (
        <div
          ref={userMenuRef}
          className="fixed z-50 w-48 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] py-1 shadow-lg"
          style={{ left: userMenuPosition.x, top: userMenuPosition.y }}
        >
          <button
            onClick={() => handleUserAction('editRoles')}
            className="flex w-full items-center space-x-2 px-3 py-2 text-left text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-secondary)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit Roles</span>
          </button>

          <button
            onClick={() => void handleUserAction('timeout')}
            className="flex w-full items-center space-x-2 px-3 py-2 text-left text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-secondary)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
            <span>Timeout</span>
          </button>

          <button
            onClick={() => void handleUserAction('ban')}
            className="flex w-full items-center space-x-2 px-3 py-2 text-left text-[var(--color-error)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--color-error)_12%,transparent)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Ban</span>
          </button>
        </div>
      )}
    </div>
  );
}
