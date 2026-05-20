import type { CSSProperties } from "react";
import { createFallbackAvatarUrl, resolveSenderAvatarUrl } from "../services/user";
import type { Message } from "../models";

interface MessageReplyContextProps {
  /** Author username pulled from the "> Replying to @X" header. */
  author: string;
  /** One-line excerpt of the parent message. May be empty for
   *  attachment-only parents. */
  excerpt: string;
  /** The parent message looked up in the channel's message list.
   *  `null` when we couldn't find it (deleted, off-screen, on a page
   *  we haven't loaded yet). When null the card still renders so the
   *  reader can see who was replied to — it just isn't clickable. */
  parent: Message | null;
  /** Map of user_id -> appearance fields, used to resolve the
   *  parent's avatar to a fully-qualified URL. */
  parentAvatar: string | null;
  /** Click handler that scrolls the message list to the parent and
   *  flashes the highlight ring. The DashboardPage owns the
   *  scroll-to-message helper; we just forward the parent's id. */
  onJump?: (parentMessageId: string) => void;
}

/**
 * Discord-style reply context strip rendered above a reply
 * message's body. Replaces the raw "> Replying to @X" markdown
 * blockquote that `buildReplyMessage` writes into the message text:
 * the blockquote is what travels over the wire, this component is
 * what the reader actually sees.
 *
 * Visual shape:
 *
 *   ╰─ ⤴  ◉  username   short excerpt of the parent message…
 *
 *   - The little hook / curl on the left ("╰─") is a single SVG that
 *     draws an L-shape connecting the reply down into the row below.
 *     It's the same shape every Discord-shaped client uses, and the
 *     reason this card is so immediately recognizable as "this is a
 *     reply" without any explicit label.
 *   - The avatar matches the rest of the dashboard's avatar style
 *     (small round portrait), resolved through the unified
 *     `resolveSenderAvatarUrl` helper so the same face the reader
 *     sees on the parent's own row is reused here.
 *   - The body text is muted (text-secondary) so it doesn't
 *     compete with the actual reply body underneath.
 *
 * Click affordance:
 *
 *   The whole strip is a button when we have a `parent.message_id`
 *   to jump to, with hover styling on the background. When we
 *   couldn't resolve the parent (deleted message, off-screen
 *   pagination, federation edge case) it falls back to a div with
 *   a "(original message unavailable)" placeholder so the reader
 *   still has the context, just without the jump-to action.
 *
 * Keyboard: the button has the default browser focus ring + Enter /
 * Space activation. No special handling needed beyond using a real
 * `<button>` element.
 */
export function MessageReplyContext({
  author,
  excerpt,
  parent,
  parentAvatar,
  onJump,
}: MessageReplyContextProps) {
  const clickable = !!parent && !!onJump;
  const avatarUrl = parentAvatar || createFallbackAvatarUrl(author || "user");
  const previewText = excerpt.trim()
    ? excerpt
    : parent
      ? "Attachment-only message"
      : "Original message unavailable";

  const sharedClasses =
    "flex items-center gap-2 px-1.5 py-1 rounded-md text-xs min-w-0";
  // The hook glyph + label live on every render; only the wrapper
  // element type changes (button vs div) based on whether we have
  // something to jump to.
  const innerContent = (
    <>
      <Hook />
      <img
        src={avatarUrl}
        alt=""
        className="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-[var(--color-border)]"
      />
      <span
        className="font-medium text-[var(--color-text)] truncate max-w-[8rem] shrink-0"
        title={`@${author}`}
      >
        @{author}
      </span>
      <span
        className="text-[var(--color-text-secondary)] truncate min-w-0 flex-1"
        title={previewText}
      >
        {previewText}
      </span>
    </>
  );

  if (clickable && parent) {
    return (
      <button
        type="button"
        onClick={(e) => {
          // Stop propagation so the click doesn't also fire the
          // message row's hover / context-menu handlers above it.
          e.stopPropagation();
          onJump?.(parent.message_id);
        }}
        title={`Jump to @${author}'s message`}
        className={`${sharedClasses} group/reply transition-colors hover:bg-[var(--color-hover)]`}
        style={{ WebkitAppearance: "none" } as CSSProperties}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div
      className={`${sharedClasses} opacity-90`}
      // No pointer cursor — non-clickable. The avatar + name still
      // gives the reader full context of who was replied to.
    >
      {innerContent}
    </div>
  );
}

/**
 * Static "╰─⤴" hook glyph used as the left-side anchor of the
 * reply card. Drawn as an inline SVG rather than a Unicode char so
 * it scales cleanly with the surrounding font size and inherits
 * `currentColor`.
 */
function Hook() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Quarter-bend from the bottom-left up and to the right,
          terminating in a small arrow head — the same visual idiom
          Discord uses for the reply rail. */}
      <path d="M3 13 V 7 a 3 3 0 0 1 3 -3 H 13" />
      <polyline points="10,1 13,4 10,7" />
    </svg>
  );
}

/**
 * Helper for the dashboard's render site: build the avatar URL for
 * the parent message using whatever fields we have — prefer the
 * users-list entry, then fall back to whatever the parent's own row
 * carried in `sender_avatar_url`, then to a deterministic identicon.
 *
 * Re-exported here (instead of inlined in DashboardPage) so the
 * resolution logic lives next to the component that consumes it.
 */
export function buildReplyParentAvatarUrl(
  parent: Message | null,
  usersById: Map<
    string,
    {
      user_id: string;
      username?: string | null;
      avatar_url?: string | null;
    }
  >,
  fallbackUsername: string,
): string {
  const cached = parent ? usersById.get(parent.sender_user_id) : undefined;
  return resolveSenderAvatarUrl(
    cached ?? (parent
      ? {
          user_id: parent.sender_user_id,
          username: parent.username,
          avatar_url: parent.sender_avatar_url,
        }
      : { username: fallbackUsername }),
    parent?.sender_avatar_url ?? null,
    cached?.username || parent?.username || fallbackUsername,
  );
}
