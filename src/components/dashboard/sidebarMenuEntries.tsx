import { Bell, BellOff, CheckCheck, CopyPlus, Fingerprint, Globe, Link2, LogOut, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import type { MenuEntry } from "../ui/ContextMenu";
import type { Channel } from "../../features/channels/types";

/** Joins groups of actions with separators, skipping empty groups so no divider is ever doubled or dangling. */
export function joinGroups(groups: MenuEntry[][]): MenuEntry[] {
  const entries: MenuEntry[] = [];
  for (const group of groups.filter((g) => g.length > 0)) {
    if (entries.length > 0) entries.push({ kind: "separator", id: `sep-${entries.length}` });
    entries.push(...group);
  }
  return entries;
}

export interface ChannelMenuContext {
  unread: number;
  muted: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Links only make sense when the client is served over http(s), not from a packaged app. */
  canCopyLink: boolean;
  actions: {
    markRead: () => void;
    toggleMute: () => void;
    copyLink: () => void;
    copyId: () => void;
    create: () => void;
    duplicate: () => void;
    edit: () => void;
    remove: () => void;
  };
}

/**
 * Actions for a channel row. Voice channels can't be joined or notified about, so they only get
 * the copy and admin actions. Categories, DMs and groups don't exist in this app, so no menus
 * are built for them.
 */
export function channelMenuEntries(channel: Channel, ctx: ChannelMenuContext): MenuEntry[] {
  const { actions } = ctx;
  const isVoice = channel.channel_type === "voice";

  const reading: MenuEntry[] = isVoice
    ? []
    : [
        { kind: "item", id: "mark-read", label: "Mark as read", icon: <CheckCheck size={15} />, onSelect: actions.markRead, disabled: ctx.unread === 0 },
        {
          kind: "item",
          id: "mute",
          label: ctx.muted ? "Unmute channel" : "Mute channel",
          icon: ctx.muted ? <Bell size={15} /> : <BellOff size={15} />,
          onSelect: actions.toggleMute,
        },
      ];

  const copying: MenuEntry[] = [
    ...(ctx.canCopyLink ? [{ kind: "item", id: "copy-link", label: "Copy channel link", icon: <Link2 size={15} />, onSelect: actions.copyLink } as MenuEntry] : []),
    { kind: "item", id: "copy-id", label: "Copy channel ID", icon: <Fingerprint size={15} />, onSelect: actions.copyId },
  ];

  const managing: MenuEntry[] = [
    ...(ctx.canCreate
      ? [
          { kind: "item", id: "create", label: "Create channel", icon: <Plus size={15} />, onSelect: actions.create } as MenuEntry,
          { kind: "item", id: "duplicate", label: "Duplicate channel", icon: <CopyPlus size={15} />, onSelect: actions.duplicate } as MenuEntry,
        ]
      : []),
    ...(ctx.canEdit ? [{ kind: "item", id: "edit", label: "Edit channel", icon: <Pencil size={15} />, onSelect: actions.edit } as MenuEntry] : []),
  ];

  const destructive: MenuEntry[] = ctx.canDelete
    ? [{ kind: "item", id: "delete", label: "Delete channel", icon: <Trash2 size={15} />, onSelect: actions.remove, danger: true }]
    : [];

  return joinGroups([reading, copying, managing, destructive]);
}

export interface ServerMenuContext {
  totalUnread: number;
  allMuted: boolean;
  canCreate: boolean;
  isOwner: boolean;
  actions: {
    markAllRead: () => void;
    toggleMute: () => void;
    copyAddress: () => void;
    create: () => void;
    openControlPanel: () => void;
    /** Only for a server joined with an account from elsewhere: give the membership up. */
    leave?: () => void;
  };
}

/** Actions for the server (instance) tile and header. */
export function serverMenuEntries(ctx: ServerMenuContext): MenuEntry[] {
  const { actions } = ctx;
  return joinGroups([
    [
      { kind: "item", id: "mark-all-read", label: "Mark all as read", icon: <CheckCheck size={15} />, onSelect: actions.markAllRead, disabled: ctx.totalUnread === 0 },
      {
        kind: "item",
        id: "mute",
        label: ctx.allMuted ? "Unmute server" : "Mute server",
        icon: ctx.allMuted ? <Bell size={15} /> : <BellOff size={15} />,
        onSelect: actions.toggleMute,
      },
    ],
    [{ kind: "item", id: "copy-address", label: "Copy server address", icon: <Globe size={15} />, onSelect: actions.copyAddress }],
    ...(actions.leave ? [[{ kind: "item", id: "leave-server", label: "Leave server", icon: <LogOut size={15} />, onSelect: actions.leave, danger: true } as MenuEntry]] : []),
    [
      ...(ctx.canCreate ? [{ kind: "item", id: "create", label: "Create channel", icon: <Plus size={15} />, onSelect: actions.create } as MenuEntry] : []),
      ...(ctx.isOwner
        ? [{ kind: "item", id: "control-panel", label: "Server control panel", icon: <SlidersHorizontal size={15} />, onSelect: actions.openControlPanel } as MenuEntry]
        : []),
    ],
  ]);
}
