/**
 * Panel that fills the channel-sidebar column when the user has the
 * rail's Direct-Messages slot selected.
 *
 * The DM surface itself isn't wired up to the server yet — the
 * `/api/v1/dms` endpoint family exists on the API but the client
 * doesn't render a conversation list or composer for it. This panel
 * is the visible affordance: tells the user where DMs live in the
 * navigation and what to expect when the full surface lands.
 *
 * Same panel shell as ChannelSidebarHeader + ChannelList so the
 * sidebar's outer border / radius / scrollbar don't shift when the
 * user toggles between server view and DM view. Just the inner
 * content changes.
 */
export function DirectMessagesPanel() {
  return (
    <>
      {/* Header — mirrors the ChannelSidebarHeader's vertical
          rhythm so the rail-to-panel handoff doesn't jump when the
          user toggles. No banner gradient (DMs aren't a server, so
          there's nothing to brand); the title sits in the same
          slot where a server name normally does. */}
      <div className="border-b border-[var(--color-border)] px-3 py-3">
        <h1 className="text-base font-bold text-[var(--color-text)]">
          Direct messages
        </h1>
        <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
          Conversations with other Pufferblow users
        </p>
      </div>

      {/* Body — empty state for now. When the DM list arrives this
          gets replaced by a scrollable list of recent conversations
          (one row per peer, last-message preview, unread dot — same
          shape as the channel rows). The empty state copy is
          intentionally specific about what's coming so the user
          doesn't think the slot is broken. */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)]"
          aria-hidden="true"
        >
          <svg
            className="h-5 w-5 text-[var(--color-text-secondary)]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          No conversations yet
        </h2>
        <p className="mt-2 max-w-[22ch] text-xs leading-relaxed text-[var(--color-text-secondary)]">
          Direct messages let you talk to other users without joining
          a shared server. The full conversation list ships in a
          follow-up release.
        </p>
      </div>
    </>
  );
}
