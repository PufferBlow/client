import { ContextMenu, type ContextMenuItem } from "./ui/ContextMenu";

/**
 * Right-click menu shown when a user opens the context menu on a message.
 *
 * Items are organized into four visual groups (separated by dividers) so
 * destructive actions don't sit next to friendly ones:
 *
 *   1. Engage:  Add Reaction · Reply · Reply in DM
 *   2. Clipboard: Copy Message · Copy Message ID · Copy Message Link
 *   3. Self / mod: Edit (own) · Delete (own or moderator)
 *   4. Moderation: Report Message · Report User · Timeout · Ban
 *
 * Each item is rendered only when its handler is provided AND its
 * capability flag is true, so the rendered shape adapts to who is
 * looking at it. Examples:
 *
 *   - Sender opens their own message: sees Edit + Delete, doesn't see
 *     Reply-in-DM / Report User / Timeout / Ban (they'd target self).
 *   - Moderator on someone else's message: sees Delete (mod power) +
 *     Timeout + Ban + Report; doesn't see Edit (not their content).
 *   - Regular user on someone else's message: sees Reply, Reactions,
 *     Copy, Report. No moderation rows.
 *
 * Tones (danger = red, warning = yellow) are applied via the ContextMenu
 * tone map so destructive actions stand out visually.
 */
interface MessageContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;

  // ── Engage ──────────────────────────────────────────────────────────
  onAddReaction?: () => void;
  onReply?: () => void;
  onReplyInDM?: () => void;
  /** Send a friend request to the message sender. Hidden when the
   *  viewer is the sender (`isSelf`), when already friends, or when
   *  a request is already pending in either direction — the caller
   *  decides via `friendActionState` below which state to show. */
  onSendFriendRequest?: () => void;
  /** Drives the friend-request row label / disabled state:
   *    - undefined (default) → not friends, show "Send Friend Request"
   *    - 'pending-out'       → viewer already sent a request
   *    - 'pending-in'        → the sender sent the viewer a request
   *    - 'friends'           → already friends, hide the row
   *    - 'blocked'           → viewer blocked this user, hide the row
   *  The caller is expected to compute this from the friend-graph
   *  query that backs the Friends panel. */
  friendActionState?: 'pending-out' | 'pending-in' | 'friends' | 'blocked';

  // ── Clipboard ───────────────────────────────────────────────────────
  /** Copies the message's text content to the clipboard. */
  onCopyMessage?: () => void;
  /** Downloads the message's media attachments. When set this row
   *  REPLACES `onCopyMessage` — for media-only messages (image /
   *  video / gif / audio with no text) the text-copy is useless,
   *  and the more useful affordance is a Download row in the same
   *  slot. Caller decides which to pass based on whether the
   *  message carries media. */
  onDownload?: () => void;
  /** Copies the message's UUID to the clipboard. */
  onCopyMessageId?: () => void;
  /** Copies a deep link to the message. Optional -- not all surfaces
   *  carry the data needed to build one. */
  onCopyMessageLink?: () => void;

  // ── Self / mod ──────────────────────────────────────────────────────
  onEdit?: () => void;
  onDelete?: () => void;

  // ── Moderation ──────────────────────────────────────────────────────
  onReportMessage?: () => void;
  onReportUser?: () => void;
  onTimeoutUser?: () => void;
  onBanUser?: () => void;

  // ── Capability flags ────────────────────────────────────────────────
  /** Viewer is the message sender. Enables Edit; hides per-sender
   *  actions like Reply-in-DM and Report User (you don't report
   *  yourself). */
  isSelf?: boolean;
  /** Viewer can edit -- in practice always equal to `isSelf` since
   *  others can't edit your message, but separated so a future "mod
   *  edit" power could enable it independently. */
  canEdit?: boolean;
  /** Viewer can delete: either it's their own message, or they hold
   *  the `delete_messages` privilege on this instance. */
  canDelete?: boolean;
  /** Viewer holds the `ban_users` privilege. */
  canBan?: boolean;
  /** Viewer holds the `mute_users` privilege (timeout uses the same
   *  underlying capability as mute). */
  canTimeout?: boolean;
  /** Whether to surface the Report Message / Report User rows at all.
   *  Default true; set to false on system messages or bot output. */
  canReport?: boolean;

  // ── Label overrides for callers acting on multiple messages at once
  // (the message-group context menu pluralizes "Copy Message ID" ->
  // "Copy Message IDs", "Report Message" -> "Report Messages"). Left
  // optional so single-message callers don't have to pass anything.
  copyMessageIdLabel?: string;
  reportMessageLabel?: string;
}

function icon(path: string | string[]) {
  const paths = Array.isArray(path) ? path : [path];
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {paths.map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

export function MessageContextMenu({
  isOpen,
  position,
  onClose,
  onAddReaction,
  onReply,
  onReplyInDM,
  onSendFriendRequest,
  friendActionState,
  onCopyMessage,
  onDownload,
  onCopyMessageId,
  onCopyMessageLink,
  onEdit,
  onDelete,
  onReportMessage,
  onReportUser,
  onTimeoutUser,
  onBanUser,
  isSelf = false,
  canEdit = false,
  canDelete = false,
  canBan = false,
  canTimeout = false,
  canReport = true,
  copyMessageIdLabel,
  reportMessageLabel,
}: MessageContextMenuProps) {
  const items: ContextMenuItem[] = [];

  // Helper that appends a separator only when we just appended a real
  // action item. Prevents empty groups from leaving orphan dividers
  // (e.g. if Reply is the only action and the next group is empty).
  let pushedSinceLastSeparator = false;
  const pushAction = (item: ContextMenuItem) => {
    items.push(item);
    pushedSinceLastSeparator = true;
  };
  const pushSeparator = (id: string) => {
    if (!pushedSinceLastSeparator) return;
    items.push({ id, separator: true });
    pushedSinceLastSeparator = false;
  };

  // Group 1: Engage
  if (onAddReaction) {
    pushAction({
      id: "react",
      label: "Add Reaction",
      icon: icon("M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"),
      onSelect: onAddReaction,
    });
  }
  if (onReply) {
    pushAction({
      id: "reply",
      label: "Reply",
      icon: icon("M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"),
      onSelect: onReply,
    });
  }
  if (onReplyInDM && !isSelf) {
    pushAction({
      id: "reply-dm",
      label: "Reply in DM",
      icon: icon("M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"),
      onSelect: onReplyInDM,
    });
  }
  // "Send Friend Request" / "Cancel Friend Request" / "Accept Friend
  // Request" — the label and onSelect both flip based on the current
  // edge in the friend graph (caller computes `friendActionState`).
  // Hidden entirely for own messages, for accepted friends, and when
  // the viewer has blocked this user (the action would just bounce
  // off the 403 the server returns).
  if (
    onSendFriendRequest &&
    !isSelf &&
    friendActionState !== "friends" &&
    friendActionState !== "blocked"
  ) {
    const label =
      friendActionState === "pending-out"
        ? "Cancel Friend Request"
        : friendActionState === "pending-in"
          ? "Accept Friend Request"
          : "Send Friend Request";
    pushAction({
      id: "friend-request",
      label,
      icon: icon("M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M12.5 7a4 4 0 11-8 0 4 4 0 018 0z M20 8v6 M23 11h-6"),
      onSelect: onSendFriendRequest,
    });
  }

  // Group 2: Clipboard
  pushSeparator("sep-clipboard");
  // Download REPLACES Copy Message when the parent set onDownload.
  // The choice is the parent's: messages with media attachments
  // pass onDownload (text-copy is useless when the primary content
  // is binary); text-only messages pass onCopyMessage. The two
  // never co-exist in the same slot — they occupy the same line.
  if (onDownload) {
    pushAction({
      id: "download",
      label: "Download",
      icon: icon("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10 12 15 17 10 M12 15V3"),
      onSelect: onDownload,
    });
  } else if (onCopyMessage) {
    pushAction({
      id: "copy-message",
      label: "Copy Message",
      icon: icon("M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"),
      onSelect: onCopyMessage,
    });
  }
  if (onCopyMessageId) {
    pushAction({
      id: "copy-message-id",
      label: copyMessageIdLabel || "Copy Message ID",
      icon: icon("M7 8h10M7 12h6m-6 4h10M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"),
      onSelect: onCopyMessageId,
    });
  }
  if (onCopyMessageLink) {
    pushAction({
      id: "copy-message-link",
      label: "Copy Message Link",
      icon: icon("M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.768-1.767m0-5.657l1.767-1.768a4 4 0 115.657 5.657l-4 4a4 4 0 01-5.657 0"),
      onSelect: onCopyMessageLink,
    });
  }

  // Group 3: Self / mod actions on the message itself
  pushSeparator("sep-self");
  if (canEdit && onEdit) {
    pushAction({
      id: "edit",
      label: "Edit Message",
      icon: icon("M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"),
      onSelect: onEdit,
    });
  }
  if (canDelete && onDelete) {
    pushAction({
      id: "delete",
      label: "Delete Message",
      tone: "danger",
      icon: icon("M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"),
      onSelect: onDelete,
    });
  }

  // Group 4: Moderation -- targets the sender. Hidden for own messages
  // (you can't ban yourself) and gated by the relevant privileges.
  pushSeparator("sep-mod");
  if (canReport && onReportMessage && !isSelf) {
    pushAction({
      id: "report-message",
      label: reportMessageLabel || "Report Message",
      tone: "warning",
      icon: icon("M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"),
      onSelect: onReportMessage,
    });
  }
  if (canReport && onReportUser && !isSelf) {
    pushAction({
      id: "report-user",
      label: "Report User",
      tone: "warning",
      icon: icon("M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"),
      onSelect: onReportUser,
    });
  }
  if (canTimeout && onTimeoutUser && !isSelf) {
    pushAction({
      id: "timeout-user",
      label: "Timeout User",
      tone: "warning",
      icon: icon("M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"),
      onSelect: onTimeoutUser,
    });
  }
  if (canBan && onBanUser && !isSelf) {
    pushAction({
      id: "ban-user",
      label: "Ban User",
      tone: "danger",
      icon: icon("M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"),
      onSelect: onBanUser,
    });
  }

  // Trim trailing separator if the last group ended up empty (e.g. no
  // moderation rights, no reportable status).
  if (items.length > 0 && "separator" in items[items.length - 1]) {
    items.pop();
  }

  return (
    <ContextMenu isOpen={isOpen} position={position} onClose={onClose} items={items} minWidth={220} />
  );
}
