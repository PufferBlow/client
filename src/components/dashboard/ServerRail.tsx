import { saveActiveAccount } from "../../services/accounts";
import { NavLink, useMatch, useNavigate } from "react-router";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useUnreadCounts } from "../../features/channels/hooks";
import { useConversations } from "../../features/dms/hooks";
import { useDmUnread } from "../../features/dms/unread";
import { useChannelPings, useMutedChannels } from "../../features/notifications/hooks";
import { useServerInfo } from "../../features/server/hooks";
import { useServerAppearance } from "../../features/server/look";
import { useMyProfile } from "../../features/users/hooks";
import { isServerOwner } from "../../features/users/roles";
import { useToast } from "../../hooks/useToast";
import { useSortable } from "../../lib/useSortable";
import { PufferblowBrand } from "../ui/PufferblowBrand";
import { SpaceIcon } from "../ui/SpaceIcon";
import { usePublicHealth } from "../../features/health/hooks";
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
 * A Pufferblow "space" is an instance you have joined: the one you are in, and every other instance
 * you hold an account on. Only the one you are in is connected, so the others show no live counts;
 * choosing one signs you in as that account and starts the app over for it.
 */
/** `clearUserPanel`: leave room at the bottom for the user card floating over the rail. */
export function ServerRail({ clearUserPanel = true }: { clearUserPanel?: boolean } = {}) {
  const navigate = useNavigate();
  const onFriends = useMatch("/dashboard/friends") !== null;
  const onDms = useMatch("/dashboard/dms/*") !== null;
  const onHome = onFriends || onDms;
  const onServer = useMatch("/dashboard/channels/*") !== null;
  const onControlPanel = useMatch("/control-panel/*") !== null;
  const { data: server } = useServerInfo();
  const appearance = useServerAppearance();
  // Hidden while the instance is well; a dot when it says it is having trouble.
  const troubled = usePublicHealth().data?.status === "degraded";
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
  // The servers in the person's own order. One instance is joined at a time today, so there is one to place.
  const { ordered, itemProps } = useSortable(["current"], "pb_server_order");

  return (
    <nav aria-label="Servers" className={`flex w-[72px] shrink-0 flex-col items-center gap-2.5 overflow-y-auto pt-1.5 ${clearUserPanel ? "pb-[76px]" : "pb-2"}`}>
      <div className="group/tile relative flex w-full justify-center">
        <Indicator selected={onHome} unread={unreadDms > 0} />
        <NavLink
          to="/dashboard/friends"
          end
          aria-label="Home"
          title="Home"
          className={`${tileBase} ${onHome ? "rounded-[12px]" : "rounded-[14px]"} ${
            onHome ? "bg-primary text-black" : "bg-surface-secondary text-[#f2f2f2] hover:bg-primary hover:text-black"
          }`}
        >
          <PufferblowBrand size={30} tone="current" />
          <CountBadge count={unreadDms} className="absolute -bottom-1.5 -right-1.5 border-[3px] border-background" />
        </NavLink>
      </div>

      <div className="h-0.5 w-7 rounded bg-border-secondary" />

      {ordered.map((id) =>
        id === "current" ? (
      <div key="current" {...itemProps("current")} className="group/tile relative flex w-full justify-center data-[dragging=true]:opacity-40 data-[drop-target=true]:before:absolute data-[drop-target=true]:before:-top-1.5 data-[drop-target=true]:before:h-0.5 data-[drop-target=true]:before:w-8 data-[drop-target=true]:before:rounded data-[drop-target=true]:before:bg-text">
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
        >
          <SpaceIcon
            id={appearance.id}
            name={serverName}
            src={appearance.avatar}
            look={{ iconStyle: appearance.look.iconStyle, tone: appearance.look.tone }}
            size={48}
            radius="inherit"
            className="absolute inset-0"
          />
          <CountBadge count={totalPings} className="absolute -bottom-1.5 -right-1.5 border-[3px] border-background" />
          {troubled && totalPings === 0 && (
            <span role="img" aria-label="This instance is having trouble" title={`${serverName} is having trouble`} className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-warning shadow-[0_0_0_3px_var(--color-background)]" />
          )}
        </NavLink>
      </div>
        ) : null,
      )}

      <div className="group/tile relative flex w-full justify-center">
        <button
          type="button"
          aria-label="Add an instance"
          title="Add an instance"
          onClick={() => {
            saveActiveAccount(); // keep this account on the device while another is added
            navigate("/login?add=1");
          }}
          className={`${iconTileBase} rounded-full bg-surface-secondary text-text-tertiary hover:rounded-[14px] hover:bg-surface-tertiary hover:text-text`}
        >
          <Plus size={20} aria-hidden="true" />
        </button>
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
