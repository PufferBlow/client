import { UserListItem } from "../dashboard/UserListItem";
import { getResolvedRoleNames } from "../../services/user";
import type { ListUsersResponse } from "../../services/user";

type TooltipSource = "userpanel" | "members" | "messages";
type Users = ListUsersResponse["users"];

interface MembersListProps {
  users: Users;
  usersError: string | null;
  onClose: () => void;
  onUserClick: (
    userId: string,
    username: string,
    event: React.MouseEvent,
    source: TooltipSource,
  ) => void;
  onUserContextMenu: (
    userId: string,
    username: string,
    event: React.MouseEvent,
    source: TooltipSource,
  ) => void;
}

/**
 * Right-rail members list. Three branches:
 *
 *   1. usersError      → error card with a retry button.
 *   2. users.length=0  → empty state.
 *   3. otherwise       → users grouped by primary role, ordered by the
 *      `roleGroupPriority` array. Users without any of the priority
 *      roles fall into 'Member'.
 *
 * The MembersPanel wrapper (slide-in animation, visibility gate) stays
 * in DashboardPage — this component is just the inner content.
 */
export function MembersList({
  users,
  usersError,
  onClose,
  onUserClick,
  onUserContextMenu,
}: MembersListProps) {
  return (
    <div className="w-72 h-full bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex flex-col">
      {/* Header with close button */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)]">
        <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">
          Members
        </h3>
        <button
          onClick={onClose}
          className="pb-icon-btn hover:bg-[var(--color-surface-secondary)]"
          title="Close member list"
          aria-label="Close member list"
        >
          <svg
            className="pb-icon text-[var(--color-text-secondary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Scrollable Members Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent">
        {usersError ? (
          <div className="p-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-error)] text-[var(--color-on-error)]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.6-.833-2.37 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <p className="mb-2 text-center text-lg font-medium text-[var(--color-error)]">
              Failed to load members
            </p>
            <p className="text-center text-[var(--color-text-muted)] mb-4">{usersError}</p>
            <div className="text-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] rounded transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="p-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[var(--color-text-secondary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <p className="text-center text-lg font-medium mb-2 text-[var(--color-text-secondary)]">
              No members found
            </p>
            <p className="text-center text-[var(--color-text-muted)]">
              This server appears to be empty.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <GroupedMembers
              users={users}
              onUserClick={onUserClick}
              onUserContextMenu={onUserContextMenu}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Group users by their highest-priority role and render each group as a
 * collapsible-feeling section with a header. 'roleGroupPriority' is the
 * canonical display order; users without one of those roles fall into
 * 'Member'.
 */
function GroupedMembers({
  users,
  onUserClick,
  onUserContextMenu,
}: {
  users: Users;
  onUserClick: MembersListProps["onUserClick"];
  onUserContextMenu: MembersListProps["onUserContextMenu"];
}) {
  const roleGroupPriority = [
    "Server Owner",
    "Administrator",
    "Moderator",
    "Regular User",
    "Member",
  ];

  const groupedUsers = users.reduce(
    (acc, user) => {
      const roleNames = getResolvedRoleNames(user);
      const groupTitle =
        roleGroupPriority.find((roleName) => roleNames.includes(roleName)) ||
        roleNames[0] ||
        "Member";
      if (!acc[groupTitle]) {
        acc[groupTitle] = [];
      }
      acc[groupTitle].push(user);
      return acc;
    },
    {} as Record<string, Users>,
  );

  return (
    <>
      {roleGroupPriority
        .filter((title) => groupedUsers[title]?.length)
        .map((title) => {
          const userList = groupedUsers[title];
          return (
            <div key={title}>
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 bg-[var(--color-surface-tertiary)] px-2 py-1 rounded border border-[var(--color-border)]">
                {title} - {userList.length}
              </h4>
              <div className="space-y-1">
                {userList.map((user) => (
                  <UserListItem
                    key={user.user_id}
                    userId={user.user_id}
                    username={user.username}
                    status={user.status}
                    roleNames={getResolvedRoleNames(user)}
                    onClick={(e) =>
                      onUserClick(user.user_id, user.username, e, "members")
                    }
                    onContextMenu={(e) =>
                      onUserContextMenu(user.user_id, user.username, e, "members")
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
    </>
  );
}
