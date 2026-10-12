import { useState } from "react";
import { useMatch, useNavigate } from "react-router";
import { ChannelDialogs, type ChannelDialog } from "../channels/ChannelDialogs";
import { ContextMenu } from "../ui/ContextMenu";
import { useChannels, useMarkAllChannelsRead, useMarkChannelRead, useUnreadCounts } from "../../features/channels/hooks";
import { canCreateChannels, canDeleteChannels, canEditChannels } from "../../features/channels/permissions";
import { useMuteAllChannels, useMuteChannel, useMutedChannels } from "../../features/notifications/hooks";
import { useServerInfo } from "../../features/server/hooks";
import { useMyProfile } from "../../features/users/hooks";
import { isServerOwner } from "../../features/users/roles";
import { copyToClipboard } from "../../lib/clipboard";
import { classifyAuthError } from "../../utils/authErrors";
import { channelMenuEntries, serverMenuEntries } from "./sidebarMenuEntries";

export type Notify = (text: string, tone?: "info" | "error") => void;
export interface MenuPoint {
  x: number;
  y: number;
}

const failure = (error: unknown, fallback: string) => classifyAuthError(error, fallback).message;

function useCopy(notify: Notify) {
  return async (text: string, done: string) => {
    const ok = await copyToClipboard(text);
    notify(ok ? done : "Couldn't copy to the clipboard.", ok ? "info" : "error");
  };
}

/**
 * Right-click (or "more") menu for channel rows in the sidebar. Returns `open` to attach to rows
 * and `node` to render once. Targets are tracked by channel id and looked up in the live list, so
 * a channel that is renamed, deleted or reordered never leaves a stale menu behind.
 */
export function useChannelMenu(notify: Notify) {
  const navigate = useNavigate();
  const activeChannelId = useMatch("/dashboard/channels/:channelId")?.params.channelId;
  const copy = useCopy(notify);

  const [menu, setMenu] = useState<({ id: string } & MenuPoint) | null>(null);
  const [dialog, setDialog] = useState<ChannelDialog>(null);

  const { data: channels } = useChannels();
  const { data: unread } = useUnreadCounts();
  const { data: me } = useMyProfile();
  const muted = useMutedChannels();
  const markRead = useMarkChannelRead();
  const mute = useMuteChannel();

  const channel = menu ? channels?.find((c) => c.channel_id === menu.id) : undefined;
  if (menu && channels && !channel) setMenu(null);

  return {
    open: (channelId: string, point: MenuPoint) => setMenu({ id: channelId, ...point }),
    node: (
      <>
        {menu && channel && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            label={`Actions for ${channel.channel_name}`}
            onClose={() => setMenu(null)}
            entries={channelMenuEntries(channel, {
              unread: unread?.[channel.channel_id] ?? 0,
              muted: muted.has(channel.channel_id),
              canCreate: canCreateChannels(me),
              canEdit: canEditChannels(me),
              canDelete: canDeleteChannels(me),
              canCopyLink: /^https?:$/.test(window.location.protocol),
              actions: {
                markRead: () =>
                  markRead.mutate(channel.channel_id, { onError: (e) => notify(failure(e, "Couldn't mark the channel as read."), "error") }),
                toggleMute: () =>
                  mute.mutate(
                    { channelId: channel.channel_id, muted: !muted.has(channel.channel_id) },
                    { onError: (e) => notify(failure(e, "Couldn't change the mute setting."), "error") },
                  ),
                copyLink: () => void copy(`${window.location.origin}/dashboard/channels/${encodeURIComponent(channel.channel_id)}`, "Channel link copied."),
                copyId: () => void copy(channel.channel_id, "Channel ID copied."),
                create: () => setDialog({ kind: "create" }),
                duplicate: () =>
                  setDialog({
                    kind: "create",
                    template: { name: `${channel.channel_name}-copy`, type: channel.channel_type, isPrivate: channel.is_private },
                  }),
                edit: () => setDialog({ kind: "edit", channel }),
                remove: () => setDialog({ kind: "delete", channel }),
              },
            })}
          />
        )}
        <ChannelDialogs
          dialog={dialog}
          onClose={() => setDialog(null)}
          onDone={(message) => notify(message)}
          onDeleted={(deleted) => {
            if (deleted.channel_id === activeChannelId) navigate("/dashboard/channels");
          }}
        />
      </>
    ),
  };
}

/** Right-click (or "more") menu for the server tile and sidebar header. */
export function useServerMenu(notify: Notify) {
  const navigate = useNavigate();
  const copy = useCopy(notify);

  const [menu, setMenu] = useState<MenuPoint | null>(null);
  const [dialog, setDialog] = useState<ChannelDialog>(null);

  const { data: server } = useServerInfo();
  const { data: channels } = useChannels();
  const { data: unread } = useUnreadCounts();
  const { data: me } = useMyProfile();
  const muted = useMutedChannels();
  const markAll = useMarkAllChannelsRead();
  const muteAll = useMuteAllChannels();

  const channelIds = (channels ?? []).map((c) => c.channel_id);
  const allMuted = channelIds.length > 0 && channelIds.every((id) => muted.has(id));
  const totalUnread = Object.values(unread ?? {}).reduce((sum, n) => sum + n, 0);

  return {
    open: (point: MenuPoint) => setMenu(point),
    node: (
      <>
        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            label="Server actions"
            onClose={() => setMenu(null)}
            entries={serverMenuEntries({
              totalUnread,
              allMuted,
              canCreate: canCreateChannels(me),
              isOwner: isServerOwner(me),
              actions: {
                markAllRead: () => markAll.mutate(undefined, { onError: (e) => notify(failure(e, "Couldn't mark everything as read."), "error") }),
                toggleMute: () =>
                  muteAll.mutate(
                    { muted: !allMuted, channelIds },
                    { onError: (e) => notify(failure(e, "Couldn't change the mute setting."), "error") },
                  ),
                copyAddress: () => void copy(server?.server_id ?? "", "Server address copied."),
                create: () => setDialog({ kind: "create" }),
                openControlPanel: () => navigate("/control-panel"),
              },
            })}
          />
        )}
        <ChannelDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={(message) => notify(message)} />
      </>
    ),
  };
}
