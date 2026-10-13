import { Copy, Fingerprint, Flag, Pencil, Reply, SmilePlus, Trash2 } from "lucide-react";
import { Emoji } from "../ui/Emoji";
import type { MenuEntry } from "../ui/ContextMenu";
import { canDeleteMessage, canEditMessage, canReportMessage } from "../../features/messages/permissions";
import type { Message } from "../../features/messages/types";
import type { UserProfile } from "../../features/users/types";

export interface MessageMenuActions {
  react: (emoji: string, present: boolean) => void;
  openPicker: () => void;
  reply: () => void;
  copyText: () => void;
  copyId: () => void;
  edit: () => void;
  requestDelete: () => void;
  report: () => void;
  /** The quick reactions offered at the top (the viewer's most used). */
  quickReactions: string[];
}

/** Who may do what to a message. Channels use the role-based rules; DMs pass their own. */
export interface MessagePermissions {
  canEdit: (message: Message, viewer: UserProfile | undefined) => boolean;
  canDelete: (message: Message, viewer: UserProfile | undefined) => boolean;
  canReport: (message: Message, viewer: UserProfile | undefined) => boolean;
}

export const CHANNEL_PERMISSIONS: MessagePermissions = {
  canEdit: canEditMessage,
  canDelete: canDeleteMessage,
  canReport: canReportMessage,
};

/**
 * The actions offered for one message. Only things the app and backend support are listed;
 * pin, forward, mark-unread and permalinks are intentionally absent until they exist.
 */
export function messageMenuEntries(
  message: Message,
  viewer: UserProfile | undefined,
  actions: MessageMenuActions,
  permissions: MessagePermissions = CHANNEL_PERMISSIONS,
): MenuEntry[] {
  const mine = (emoji: string) => message.reactions.some((r) => r.emoji === emoji && viewer !== undefined && r.userIds.includes(viewer.user_id));
  const hasText = message.text.trim().length > 0;

  const entries: MenuEntry[] = [
    {
      kind: "choices",
      id: "react",
      label: "Add reaction",
      choices: actions.quickReactions.map((emoji) => ({
        id: emoji,
        label: `${mine(emoji) ? "Remove" : "Add"} ${emoji} reaction`,
        content: <Emoji char={emoji} size={22} />,
        pressed: mine(emoji),
        onSelect: () => actions.react(emoji, !mine(emoji)),
      })),
    },
    { kind: "item", id: "more-reactions", label: "More reactions…", icon: <SmilePlus size={15} />, onSelect: actions.openPicker },
    { kind: "separator", id: "sep-react" },
    { kind: "item", id: "reply", label: "Reply", icon: <Reply size={15} />, onSelect: actions.reply },
  ];

  if (hasText) entries.push({ kind: "item", id: "copy-text", label: "Copy text", icon: <Copy size={15} />, onSelect: actions.copyText });
  entries.push({ kind: "item", id: "copy-id", label: "Copy message ID", icon: <Fingerprint size={15} />, onSelect: actions.copyId });

  if (permissions.canEdit(message, viewer)) {
    entries.push({ kind: "item", id: "edit", label: "Edit message", icon: <Pencil size={15} />, onSelect: actions.edit });
  }
  if (permissions.canReport(message, viewer)) {
    entries.push({ kind: "item", id: "report", label: "Report message", icon: <Flag size={15} />, onSelect: actions.report });
  }
  if (permissions.canDelete(message, viewer)) {
    entries.push(
      { kind: "separator", id: "sep-danger" },
      { kind: "item", id: "delete", label: "Delete message", icon: <Trash2 size={15} />, onSelect: actions.requestDelete, danger: true },
    );
  }

  return entries;
}
