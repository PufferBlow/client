import { NavLink, useMatch } from "react-router";
import { SlidersHorizontal } from "lucide-react";
import { useUnreadCounts } from "../../features/channels/hooks";
import { useConversations } from "../../features/dms/hooks";
import { useDmUnread } from "../../features/dms/unread";
import { useChannelPings, useMutedChannels } from "../../features/notifications/hooks";
import { useServerInfo } from "../../features/server/hooks";
import { useMyProfile } from "../../features/users/hooks";
import { isServerOwner } from "../../features/users/roles";
import { useToast } from "../../hooks/useToast";
import { initialsFor } from "../../lib/avatar";
import { identity } from "../../lib/identity";
import { PufferblowBrand } from "../ui/PufferblowBrand";
import { resolveAssetUrl } from "../../services/authed";
import { ToastRegion } from "../ui/Toast";
import { CountBadge } from "./Avatar";
import { useServerMenu } from "./useSidebarMenus";

/** Left-edge pill: 36px when open, 20px on hover, 8px when unread, hidden otherwise. */
function Indicator({ selected, unread }: { selected: boolean; unread: boolean }) {
  const size = selected ? "h-9" : unread ? "h-2 group-hover/tile:h-5" : "h-0 group-hover/tile:h-5";
  return (
    <span
      aria-hidden="true"
      className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r bg-text transition-[height] duration-(--motion-base) ease-(--motion-ease-out) ${size}`}
    />
  );
}

const tileBase =
  "relative grid h-12 w-12 place-items-center font-display text-lg text-on-primary transition-[border-radius,filter] hover:rounded-[12px] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Tiles that hold an icon rather than initials set their own text colour. */
const iconTileBase = tileBase.replace(" text-on-primary", "");

/**
 * A Pufferblow "server" is the instance you are signed in to, so the rail shows that one
 * instance. Joining other instances needs a separate account on each and isn't supported yet.
 */
export function ServerRail() {
  const onFriends = useMatch("/dashboard/friends") !== null;
  const onDms = useMatch("/dashboard/dms/*") !== null;
  const onHome = onFriends || onDms;
  const onServer = useMatch("/dashboard/channels/*") !== null;
  const onControlPanel = useMatch("/control-panel/*") !== null;
  const { data: server } = useServerInfo();
  const { data: unread } = useUnreadCounts();
  const { data: me } = useMyProfile();
  const isOwner = isServerOwner(me);
  const { toast, show } = useToast();
  const serverMenu = useServerMenu(show);

  const muted = useMutedChannels();
  const pings = useChannelPings();
  const { data: conversations = [] } = useConversations();
  const { total: unreadDms } = useDmUnread(conversations);

  // Unread messages only light the server's marker; the red count is replies to you and pings.
  const anyUnread = Object.entries(unread ?? {}).some(([id, n]) => n > 0 && !muted.has(id));
  const totalPings = Object.entries(pings).reduce((sum, [id, n]) => (muted.has(id) ? sum : sum + n), 0);
  const serverName = server?.server_name ?? "Server";
  // A space with no picture gets its identity colour, the same on every client.
  const spaceColour = identity(server?.server_id ?? serverName).hex;

  return (
    <nav aria-label="Servers" className="flex w-[72px] shrink-0 flex-col items-center gap-2.5 overflow-y-auto pb-[76px] pt-1.5">
      <div className="group/tile relative flex w-full justify-center">
        <Indicator selected={onHome} unread={unreadDms > 0} />
        <NavLink
          to="/dashboard/friends"
          aria-label="Friends"
          title="Friends"
          className={`${tileBase} ${onHome ? "rounded-[12px]" : "rounded-[14px]"} ${
            onHome ? "bg-primary text-black" : "bg-surface-secondary text-[#f2f2f2] hover:bg-primary hover:text-black"
          }`}
        >
          <PufferblowBrand size={30} tone="current" />
          <CountBadge count={unreadDms} className="absolute -bottom-1.5 -right-1.5 border-[3px] border-background" />
        </NavLink>
      </div>

      <div className="h-0.5 w-7 rounded bg-border-secondary" />

      <div className="group/tile relative flex w-full justify-center">
        <Indicator selected={onServer} unread={anyUnread || totalPings > 0} />
        <NavLink
          to="/dashboard/channels"
          onContextMenu={(e) => {
            e.preventDefault();
            serverMenu.open({ x: e.clientX, y: e.clientY });
          }}
          onKeyDown={(e) => {
            if (e.key !== "ContextMenu" && !(e.key === "F10" && e.shiftKey)) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            serverMenu.open({ x: rect.right + 4, y: rect.top });
          }}
          aria-label={server ? `${serverName} on ${server.server_id}` : "Server"}
          title={serverName}
          className={`${tileBase} ${onServer ? "rounded-[12px]" : "rounded-[14px]"} bg-surface-secondary`}
          style={server?.avatar_url ? undefined : { background: spaceColour }}
        >
          {server?.avatar_url ? (
            <img src={resolveAssetUrl(server.avatar_url)} alt="" className="h-full w-full rounded-[inherit] object-cover" />
          ) : (
            initialsFor(serverName)
          )}
          <CountBadge count={totalPings} className="absolute -bottom-1.5 -right-1.5 border-[3px] border-background" />
        </NavLink>
      </div>

      {isOwner && (
        <div className="group/tile relative mt-auto flex w-full justify-center">
          <Indicator selected={onControlPanel} unread={false} />
          <NavLink
            to="/control-panel"
            aria-label="Server control panel"
            title="Server control panel"
            className={`${iconTileBase} ${onControlPanel ? "rounded-[12px]" : "rounded-[14px]"} bg-surface text-primary hover:bg-surface-secondary`}
          >
            <SlidersHorizontal size={20} aria-hidden="true" />
          </NavLink>
        </div>
      )}
      {serverMenu.node}
      <ToastRegion toast={toast} />
    </nav>
  );
}
