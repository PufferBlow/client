import { Copy, Fingerprint, Flag, Pencil, SmilePlus, Trash2 } from "lucide-react";
import { Emoji } from "../ui/Emoji";
import type { MenuEntry } from "../ui/ContextMenu";
import { canDeleteMessage, canEditMessage, canReportMessage } from "../../features/messages/permissions";
import type { Message } from "../../features/messages/types";
import type { UserProfile } from "../../features/users/types";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉"];

export interface MessageMenuActions {
  react: (emoji: string, present: boolean) => void;
  openPicker: () => void;
  copyText: () => void;
  copyId: () => void;
  edit: () => void;
  requestDelete: () => void;
  report: () => void;
}

/**
 * The actions offered for one message. Only things the app and backend support are listed;
 * reply, pin, forward, mark-unread and permalinks are intentionally absent until they exist.
 */
export function messageMenuEntries(message: Message, viewer: UserProfile | undefined, actions: MessageMenuActions): MenuEntry[] {
  const mine = (emoji: string) => message.reactions.some((r) => r.emoji === emoji && viewer !== undefined && r.userIds.includes(viewer.user_id));
  const hasText = message.text.trim().length > 0;

  const entries: MenuEntry[] = [
    {
      kind: "choices",
      id: "react",
      label: "Add reaction",
      choices: QUICK_REACTIONS.map((emoji) => ({
        id: emoji,
        label: `${mine(emoji) ? "Remove" : "Add"} ${emoji} reaction`,
        content: <Emoji char={emoji} size={22} />,
        pressed: mine(emoji),
        onSelect: () => actions.react(emoji, !mine(emoji)),
      })),
    },
    { kind: "item", id: "more-reactions", label: "More reactions…", icon: <SmilePlus size={15} />, onSelect: actions.openPicker },
    { kind: "separator", id: "sep-react" },
  ];

  if (hasText) entries.push({ kind: "item", id: "copy-text", label: "Copy text", icon: <Copy size={15} />, onSelect: actions.copyText });
  entries.push({ kind: "item", id: "copy-id", label: "Copy message ID", icon: <Fingerprint size={15} />, onSelect: actions.copyId });

  if (canEditMessage(message, viewer)) {
    entries.push({ kind: "item", id: "edit", label: "Edit message", icon: <Pencil size={15} />, onSelect: actions.edit });
  }
  if (canReportMessage(message, viewer)) {
    entries.push({ kind: "item", id: "report", label: "Report message", icon: <Flag size={15} />, onSelect: actions.report });
  }
  if (canDeleteMessage(message, viewer)) {
    entries.push(
      { kind: "separator", id: "sep-danger" },
      { kind: "item", id: "delete", label: "Delete message", icon: <Trash2 size={15} />, onSelect: actions.requestDelete, danger: true },
    );
  }

  return entries;
}
