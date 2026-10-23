import type { KeyboardEvent, MouseEvent } from "react";
import { NavLink } from "react-router";
import { BellOff, ChevronDown, Globe, Hash, Lock, MoreHorizontal } from "lucide-react";
import { groupChannels, useCategories } from "../../features/channels/categories";
import { useChannels, useUnreadCounts } from "../../features/channels/hooks";
import { hasText, type Channel } from "../../features/channels/types";
import { useChannelPings, useMutedChannels } from "../../features/notifications/hooks";
import { useServerInfo } from "../../features/server/hooks";
import { useToast } from "../../hooks/useToast";
import { resolveAssetUrl } from "../../services/authed";
import { ToastRegion } from "../ui/Toast";
import { CountBadge } from "./Avatar";
import { useChannelMenu, useServerMenu, type MenuPoint } from "./useSidebarMenus";
import { VoiceBar } from "./VoiceBar";
import { VoiceChannelRow } from "./VoiceChannelRow";

type OpenChannelMenu = (channelId: string, point: MenuPoint) => void;

const isMenuKey = (e: KeyboardEvent) => e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey);

function GroupLabel({ children }: { children: string }) {
  return (
    <div className="pb-section-label flex items-center gap-1.5 px-2.5 pb-1.5 pt-3.5">
      <ChevronDown size={11} aria-hidden="true" />
      {children}
    </div>
  );
}

/** The "more" button that stands in for right-click on touch screens and for keyboard users. */
function MoreButton({ label, onOpen }: { label: string; onOpen: (point: MenuPoint) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="menu"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onOpen({ x: rect.left, y: rect.bottom + 4 });
      }}
      className="absolute right-1 top-1/2 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-text-tertiary hover:bg-active hover:text-text focus-visible:grid group-focus-within:grid group-hover:grid pointer-coarse:grid"
    >
      <MoreHorizontal size={15} aria-hidden="true" />
    </button>
  );
}

/**
 * `unread` messages only highlight the channel; the red count is for `pings`: replies to you and
 * @-mentions.
 */
function TextChannelLink({ channel, unread, pings, muted, onMenu }: { channel: Channel; unread: number; pings: number; muted: boolean; onMenu: OpenChannelMenu }) {
  const Icon = channel.is_private ? Lock : Hash;
  const id = channel.channel_id;
  const showUnread = (unread > 0 || pings > 0) && !muted;
  return (
    <div
      className="group relative"
      onContextMenu={(e: MouseEvent) => {
        e.preventDefault();
        onMenu(id, { x: e.clientX, y: e.clientY });
      }}
    >
      <NavLink
        to={`/dashboard/channels/${encodeURIComponent(id)}`}
        onKeyDown={(e) => {
          if (!isMenuKey(e)) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          onMenu(id, { x: rect.left + 24, y: rect.bottom });
        }}
        className={({ isActive }) =>
          [
            "flex h-[34px] items-center gap-2 rounded-sm pl-2.5 pr-8 text-[14.5px] transition-colors duration-(--motion-fast) hover:bg-surface-secondary",
            isActive
              ? "bg-surface-tertiary font-semibold text-text"
              : showUnread
                ? "font-semibold text-text"
                : muted
                  ? "text-text-faint"
                  : "font-medium text-text-tertiary hover:text-text-body",
          ].join(" ")
        }
      >
        {showUnread && <span aria-hidden="true" className="absolute -left-2 top-1/2 h-2 w-1 -translate-y-1/2 rounded-r bg-text" />}
        <Icon size={16} aria-hidden="true" />
        <span className="flex-1 truncate">{channel.channel_name}</span>
        {muted && <BellOff size={12} aria-label="Muted" className="shrink-0" />}
        {!muted && <CountBadge count={pings} />}
      </NavLink>
      <MoreButton label={`Channel actions for ${channel.channel_name}`} onOpen={(point) => onMenu(id, point)} />
    </div>
  );
}

function SidebarHeader({ onMenu }: { onMenu: (point: MenuPoint) => void }) {
  const { data: server } = useServerInfo();
  const banner = resolveAssetUrl(server?.banner_url);

  return (
    <div
      className="relative h-[118px] shrink-0 bg-cover bg-center"
      style={{
        background: banner
          ? `linear-gradient(transparent 30%, rgba(10, 10, 10,.85)), url("${banner}") center / cover`
          : "radial-gradient(120% 100% at 20% 10%, #3a3a3a 0%, #1a1a1a 75%)",
      }}
    >
      <button
        type="button"
        aria-label="Server menu"
        aria-haspopup="menu"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onMenu({ x: rect.left, y: rect.bottom + 4 });
        }}
        className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-lg bg-black/30 text-[#dadada] hover:bg-black/50"
      >
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <div className="absolute inset-x-3.5 bottom-3 flex items-end justify-between">
        <div className="min-w-0">
          <h2 className="pb-panel-header truncate text-xl">
            {server?.server_name ?? " "}
          </h2>
          {server && (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#dadada]">
              <Globe size={11} aria-hidden="true" />
              {server.server_id}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChannelSidebar() {
  const { data: channels, isPending, error } = useChannels();
  const { data: unread = {} } = useUnreadCounts();
  const pings = useChannelPings();
  const muted = useMutedChannels();
  const { toast, show } = useToast();
  const channelMenu = useChannelMenu(show);
  const serverMenu = useServerMenu(show);

  const { data: categories = [] } = useCategories();
  // Channels in a category are shown with it, text and voice together; the rest keep the two plain groups.
  const groups = groupChannels(channels ?? [], categories);
  const categorised = groups.filter((g) => g.category !== null);
  const loose = groups.find((g) => g.category === null)?.channels ?? [];
  const textChannels = loose.filter(hasText);
  const voiceChannels = loose.filter((c) => c.channel_type === "voice");
  const nothing = (channels ?? []).length === 0;

  const renderChannel = (channel: Channel) =>
    channel.channel_type === "voice" ? (
      <VoiceChannelRow
        key={channel.channel_id}
        channel={channel}
        onMenu={channelMenu.open}
        moreButton={<MoreButton label={`Channel actions for ${channel.channel_name}`} onOpen={(point) => channelMenu.open(channel.channel_id, point)} />}
      />
    ) : (
      <TextChannelLink
        key={channel.channel_id}
        channel={channel}
        unread={unread[channel.channel_id] ?? 0}
        pings={pings[channel.channel_id] ?? 0}
        muted={muted.has(channel.channel_id)}
        onMenu={channelMenu.open}
      />
    );

  return (
    <aside className="flex w-[288px] shrink-0 flex-col overflow-hidden mb-[70px] rounded-lg bg-surface max-md:hidden">
      <SidebarHeader onMenu={serverMenu.open} />

      <nav aria-label="Channels" className="min-h-0 flex-1 overflow-y-auto px-2 pt-1">
        {isPending ? (
          <div className="flex flex-col gap-2 px-2 pt-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-6 animate-pulse rounded-sm bg-surface-secondary" />
            ))}
          </div>
        ) : error ? (
          <p className="pb-error px-3 pt-4">Couldn&apos;t load channels.</p>
        ) : (
          <>
            {categorised.map(({ category, channels: inside }) => (
              <section key={category!.category_id} aria-label={category!.name}>
                <GroupLabel>{category!.name}</GroupLabel>
                <div className="flex flex-col gap-px">{inside.map(renderChannel)}</div>
              </section>
            ))}
            {textChannels.length > 0 && (
              <section>
                <GroupLabel>Channels</GroupLabel>
                <div className="flex flex-col gap-px">{textChannels.map(renderChannel)}</div>
              </section>
            )}
            {voiceChannels.length > 0 && (
              <section>
                <GroupLabel>Voice</GroupLabel>
                <div className="flex flex-col gap-px">
                  {voiceChannels.map((channel) => (
                    <VoiceChannelRow
                      key={channel.channel_id}
                      channel={channel}
                      onMenu={channelMenu.open}
                      moreButton={<MoreButton label={`Channel actions for ${channel.channel_name}`} onOpen={(point) => channelMenu.open(channel.channel_id, point)} />}
                    />
                  ))}
                </div>
              </section>
            )}
            {nothing && (
              <p className="px-3 pt-4 text-[13px] text-text-muted">No channels yet.</p>
            )}
          </>
        )}
      </nav>

      <VoiceBar />
      <div aria-hidden="true" className="h-[76px] shrink-0" />

      {channelMenu.node}
      {serverMenu.node}
      <ToastRegion toast={toast} />
    </aside>
  );
}
