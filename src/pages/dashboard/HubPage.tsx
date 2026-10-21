import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Calendar, Flame, Gamepad2, Globe, Grid2x2, Hash, Search, Users, Volume2, type LucideIcon } from "lucide-react";
import { Avatar } from "../../components/dashboard/Avatar";
import { EmptyState } from "../../components/ui/EmptyState";
import { SpaceIcon } from "../../components/ui/SpaceIcon";
import { useChannels, useUnreadCounts } from "../../features/channels/hooks";
import { hasText } from "../../features/channels/types";
import { useChannelPings, useMutedChannels } from "../../features/notifications/hooks";
import { useServerInfo } from "../../features/server/hooks";
import { useMyProfile, useUsers } from "../../features/users/hooks";
import { useVoiceParticipants } from "../../features/voice/hooks";
import { bannerCss, defaultBannerCss, identity } from "../../lib/identity";
import { listAccounts } from "../../services/accounts";
import { getActiveAccountId } from "../../services/auth";
import { getStoredInstance } from "../../services/instance";
import { resolveAssetUrl } from "../../services/authed";
import type { Channel } from "../../features/channels/types";

const count = (n: number | null | undefined) => (n === null || n === undefined ? null : n.toLocaleString());

interface Tile {
  icon: LucideIcon;
  label: string;
  /** Where it goes; none means the part behind it is not built yet. */
  to?: string;
}

const TILES: Tile[] = [
  { icon: Grid2x2, label: "Spaces", to: "#spaces" },
  { icon: Volume2, label: "Voice", to: "/dashboard/channels" },
  { icon: Calendar, label: "Events" },
  { icon: Flame, label: "Trending" },
  { icon: Gamepad2, label: "LFG" },
  { icon: Globe, label: "Discover" },
];

const tileClass = "flex h-16 items-center justify-center gap-2.5 rounded-lg bg-surface-secondary font-heading text-[15px] font-semibold uppercase tracking-[0.06em] no-underline";

/** One voice room that has people in it; renders nothing while it is empty. */
function LiveRoom({ channel }: { channel: Channel }) {
  const { data: people = [] } = useVoiceParticipants(channel.channel_id);
  if (people.length === 0) return null;
  const shown = people.slice(0, 4);
  return (
    <li className="flex flex-col gap-2.5 rounded-lg bg-surface-secondary p-3">
      <div className="flex items-center gap-1.5 text-[14.5px] font-bold">
        <Volume2 size={14} aria-hidden="true" />
        {channel.channel_name}
      </div>
      <div className="flex items-center gap-2">
        <span className="flex flex-1 items-center">
          {shown.map((p) => (
            <span key={p.userId} className="-mr-2 rounded-full">
              <Avatar name={p.username || "?"} seed={p.userId} size={28} ringColor="var(--color-surface-secondary)" speaking={p.isSpeaking} />
            </span>
          ))}
          <span className="ml-4 text-xs text-text-tertiary">
            {people.length} in the room{people.length > shown.length ? ` · +${people.length - shown.length}` : ""}
          </span>
        </span>
        <Link to="/dashboard/channels" className="rounded-sm bg-surface-tertiary px-3.5 py-2 font-heading text-xs font-bold uppercase tracking-[0.1em] text-text no-underline">
          Join
        </Link>
      </div>
    </li>
  );
}

/**
 * Home: where you are, at a glance. The instance you are in as a feature banner, the instances you
 * have joined, who is talking right now, and where there is something unread. Events, trending, LFG
 * and discover wait for an instance that can offer them, and say so.
 */
export function HubPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data: server } = useServerInfo();
  const { data: channels = [] } = useChannels();
  const { data: unread = {} } = useUnreadCounts();
  const { data: users = [] } = useUsers();
  const { data: me } = useMyProfile();
  const pings = useChannelPings();
  const muted = useMutedChannels();
  const here = getStoredInstance();
  const activeId = getActiveAccountId();
  const accounts = useMemo(() => listAccounts(), []);

  const text = channels.filter(hasText);
  const voice = channels.filter((c) => c.channel_type === "voice" || c.channel_type === "mixed");
  const first = text[0];
  const online = count(server?.online_members);
  const members = count(server?.members_count);
  const host = here?.raw ?? "";
  const banner = server?.banner_url ? `url("${resolveAssetUrl(server.banner_url)}") center / cover` : host ? defaultBannerCss(host, "80% 60%") : bannerCss(identity("pufferblow").hex, "ripple");

  const totalUnread = Object.entries(unread).reduce((sum, [id, n]) => (muted.has(id) ? sum : sum + n), 0);
  const totalPings = Object.entries(pings).reduce((sum, [id, n]) => (muted.has(id) ? sum : sum + n), 0);

  const busy = text
    .map((c) => ({ channel: c, unread: muted.has(c.channel_id) ? 0 : (unread[c.channel_id] ?? 0), pings: muted.has(c.channel_id) ? 0 : (pings[c.channel_id] ?? 0) }))
    .filter((r) => r.unread > 0 || r.pings > 0)
    .sort((a, b) => b.pings - a.pings || b.unread - a.unread)
    .slice(0, 6);

  const needle = query.trim().toLowerCase();
  const found = needle.length < 2 ? null : {
    channels: channels.filter((c) => c.channel_name.toLowerCase().includes(needle)).slice(0, 5),
    people: users.filter((u) => u.username.toLowerCase().includes(needle)).slice(0, 5),
  };

  return (
    <>
      <main aria-label="Home" className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-5">
        <div className="flex items-center gap-3">
          <div role="search" className="relative flex-1">
            <div className="flex h-11 items-center gap-2.5 rounded-pill bg-surface-secondary px-4 text-sm text-text-tertiary focus-within:shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-text)]">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search channels and people"
                aria-label="Search channels and people"
                className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            {found && (
              <div className="absolute inset-x-0 top-[calc(100%+8px)] z-20 rounded-lg bg-surface-tertiary p-1.5 shadow-popover">
                {found.channels.length + found.people.length === 0 ? (
                  <p className="m-0 px-3 py-4 text-center text-[13px] text-text-muted">Nothing matches “{query.trim()}”.</p>
                ) : (
                  <ul className="m-0 list-none p-0">
                    {found.channels.map((c) => (
                      <li key={c.channel_id}>
                        <Link to={`/dashboard/channels/${encodeURIComponent(c.channel_id)}`} className="flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-text no-underline hover:bg-surface-secondary">
                          {c.channel_type === "voice" ? <Volume2 size={15} aria-hidden="true" /> : <Hash size={15} aria-hidden="true" />}
                          {c.channel_name}
                        </Link>
                      </li>
                    ))}
                    {found.people.map((u) => (
                      <li key={u.user_id}>
                        <button type="button" onClick={() => navigate("/dashboard/friends")} className="flex w-full items-center gap-2.5 rounded-sm border-0 bg-transparent px-3 py-2 text-left text-sm text-text hover:bg-surface-secondary">
                          <Avatar name={u.username} src={u.avatar_url} seed={u.user_id} size={22} ringColor="var(--color-surface-tertiary)" />
                          {u.username}
                          <span className="pb-meta ml-auto text-xs">{u.origin_server}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <Link
            to="/dashboard/friends"
            aria-label="Friends and messages"
            title="Friends and messages"
            className="grid size-[42px] place-items-center rounded-full bg-surface-secondary text-text-tertiary no-underline transition-colors hover:bg-surface-tertiary hover:text-text"
          >
            <Users size={18} aria-hidden="true" />
          </Link>
        </div>

        <section aria-label={server ? `${server.server_name}` : "Your instance"} className="relative h-[218px] shrink-0 overflow-hidden rounded-xl" style={{ background: banner }}>
          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(242,242,242,0.03)_0_2px,transparent_2px_16px)]" />
          <div className="absolute inset-0 bg-linear-to-t from-background/90 via-background/30 to-transparent" />
          <div className="absolute bottom-6 left-6 flex max-w-[520px] flex-col gap-2.5">
            <span className="self-start rounded-pill bg-text px-2.5 py-[5px] font-heading text-[11px] font-bold uppercase leading-none tracking-[0.14em] text-on-primary">Home instance</span>
            <h1 className="m-0 font-display text-[44px] font-normal leading-none">{server?.server_name ?? " "}</h1>
            <p className="m-0 text-sm text-text-body">
              {host}
              {online ? ` · ${online} online` : ""}
              {members ? ` · ${members} members` : ""}
            </p>
            {(first || voice.length > 0) && (
              <div className="mt-1 flex gap-2.5">
                {first && (
                  <Link to={`/dashboard/channels/${encodeURIComponent(first.channel_id)}`} className="pb-label-button inline-flex h-10 items-center gap-2 rounded-md bg-primary px-[18px] text-on-primary no-underline">
                    <Hash size={15} aria-hidden="true" />
                    Open #{first.channel_name}
                  </Link>
                )}
                {voice.length > 0 && (
                  <Link to="/dashboard/channels" className="pb-label-button inline-flex h-10 items-center gap-2 rounded-md bg-surface-secondary px-4 text-text no-underline">
                    <Volume2 size={15} aria-hidden="true" />
                    Voice
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>

        <nav aria-label="Browse" className="grid grid-cols-3 gap-2.5 lg:grid-cols-6">
          {TILES.map(({ icon: Icon, label, to }) =>
            to ? (
              <a key={label} href={to.startsWith("#") ? to : undefined} onClick={to.startsWith("#") ? undefined : (e) => (e.preventDefault(), navigate(to))} className={`${tileClass} text-text transition-colors hover:bg-surface-tertiary`}>
                <Icon size={20} aria-hidden="true" />
                {label}
              </a>
            ) : (
              <span key={label} aria-disabled="true" title="Not available on this instance yet" className={`${tileClass} cursor-not-allowed text-text-faint`}>
                <Icon size={20} aria-hidden="true" />
                {label}
              </span>
            ),
          )}
        </nav>

        <div id="spaces" className="flex items-baseline justify-between">
          <h2 className="pb-title m-0">Your spaces</h2>
          <span className="pb-meta text-[13px]">{accounts.length + (activeId ? 0 : 1) > 1 ? `${accounts.length} instances` : "1 instance"}</span>
        </div>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-6">
          {[...(here ? [{ id: here.raw, name: server?.server_name ?? here.raw, host: here.raw, banner: server?.banner_url ? `url("${resolveAssetUrl(server.banner_url)}") center / cover` : defaultBannerCss(here.raw), picture: server?.avatar_url ? resolveAssetUrl(server.avatar_url) : null, unread: totalPings || totalUnread, here: true }] : []), ...accounts.filter((a) => a.id !== activeId).map((a) => ({ id: a.instance.raw, name: a.instance.raw, host: a.instance.raw, banner: defaultBannerCss(a.instance.raw), picture: null as string | null, unread: 0, here: false }))].map((space) => (
            <li key={space.id}>
              <button
                type="button"
                onClick={() => (space.here ? navigate("/dashboard/channels") : navigate("/accounts"))}
                aria-label={space.here ? `${space.name}, the instance you are in` : `${space.name}, switch to it`}
                className="relative block aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-lg border-0 p-0 text-left transition-shadow hover:shadow-[0_0_0_2px_var(--color-text)]"
                style={{ background: space.banner }}
              >
                <span className="absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_4px_rgba(10,10,10,0.35)]" style={{ borderRadius: 20 }}>
                  <SpaceIcon id={space.id} name={space.name} src={space.picture} size={64} radius={20} />
                </span>
                {space.unread > 0 && (
                  <span className="absolute right-2.5 top-2.5 grid h-[22px] min-w-6 place-items-center rounded-[11px] bg-error px-[7px] text-[11px] font-bold leading-none text-white">{space.unread > 99 ? "99+" : space.unread}</span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/90 to-transparent px-2.5 pb-2.5 pt-8">
                  <span className="block font-heading text-[15px] font-semibold leading-tight text-text">{space.name}</span>
                  <span className="block text-[11px] text-text-tertiary">{space.here ? "You are here" : space.host}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>

      <aside aria-label="Right now" className="flex w-[300px] shrink-0 flex-col gap-3.5 overflow-y-auto rounded-lg bg-background-secondary p-4 max-xl:hidden">
        <h2 className="pb-section-label m-0 flex items-center gap-2 text-text-tertiary">
          <span className="size-2 rounded-full bg-in-game shadow-[0_0_0_4px_rgba(159,212,135,0.18)]" aria-hidden="true" />
          Live now
        </h2>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {voice.map((c) => (
            <LiveRoom key={c.channel_id} channel={c} />
          ))}
        </ul>
        {voice.length === 0 && <p className="pb-meta m-0 text-[13px]">No voice rooms here yet.</p>}

        <h2 className="pb-section-label mt-1.5 text-text-tertiary">Needs a look</h2>
        {busy.length === 0 ? (
          <EmptyState title="All caught up" description="Nothing unread in this instance." />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {busy.map(({ channel, unread: n, pings: p }) => (
              <li key={channel.channel_id}>
                <Link to={`/dashboard/channels/${encodeURIComponent(channel.channel_id)}`} className="block rounded-md px-2 py-2.5 leading-snug no-underline hover:bg-surface-secondary">
                  <span className="block text-sm text-text">
                    <b className="font-semibold">#{channel.channel_name}</b> <span className="text-text-tertiary">in {server?.server_name ?? host}</span>
                  </span>
                  <span className="pb-meta block text-xs">
                    {p > 0 ? `${p} for you` : `${n} unread`}
                    {p > 0 && n > p ? ` · ${n} unread` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {me && <p className="pb-meta mt-auto text-xs">Signed in as {me.username}</p>}
      </aside>
    </>
  );
}
