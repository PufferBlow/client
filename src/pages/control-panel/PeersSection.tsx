import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { SpaceIcon } from "../../components/ui/SpaceIcon";
import { ago } from "../../features/health/format";
import { useInstanceHealth } from "../../features/health/hooks";
import type { PeerHost } from "../../features/health/types";
import { defaultBannerCss } from "../../lib/identity";
import { classifyAuthError } from "../../utils/authErrors";

type Status = "Federating" | "Pending" | "Limited" | "Blocked";
const STATUSES: readonly Status[] = ["Federating", "Pending", "Limited", "Blocked"];
const COLOUR: Record<Status, string> = { Federating: "#9fd487", Pending: "#e6c15c", Limited: "#9a9a9a", Blocked: "#e2654f" };

const MODES: ReadonlyArray<{ id: string; label: string; help: string }> = [
  { id: "open", label: "Open", help: "Any instance can federate unless you block it." },
  { id: "allow", label: "Allowlist", help: "Only instances you approve can federate. New requests wait in Pending." },
  { id: "closed", label: "Closed", help: "No federation. Members only see this instance." },
];

const NOT_YET = "Not available yet: this instance does not track it.";

/**
 * Peers: the instances this one is linked to. Today an instance knows its peers only from accepted
 * follows, so every peer is Federating and the rules (mode, per-instance policy, limit, block) are
 * shown but switched off, with a reason, until the instance can enforce them.
 */
export function PeersSection() {
  const { data: health, isPending, error, refetch } = useInstanceHealth();
  const [filter, setFilter] = useState<Status | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const peers = health?.peers;
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, s === "Federating" ? (peers?.length ?? 0) : 0])) as Record<Status, number>, [peers]);
  const rows = useMemo(() => (filter && filter !== "Federating" ? [] : (peers ?? [])), [peers, filter]);
  const selected: PeerHost | undefined = rows.find((p) => p.host === picked) ?? rows[0];

  if (isPending) return <LoadingState message="Loading peers…" />;
  if (error) return <ErrorState title="Couldn't load peers" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section aria-label="Peers" className="flex min-w-0 flex-col gap-4 rounded-lg bg-background-secondary p-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter === status}
              aria-label={`${status}: ${counts[status]}`}
              onClick={() => setFilter(filter === status ? null : status)}
              className={`flex flex-col gap-3 rounded-lg border-0 p-3.5 text-left text-text transition-colors duration-(--motion-fast) hover:bg-surface-tertiary ${filter === status ? "bg-surface-tertiary" : "bg-surface-secondary"}`}
            >
              <span className="pb-section-label flex items-center gap-[7px] text-text-tertiary">
                <span className="size-[7px] rounded-full" style={{ background: COLOUR[status] }} />
                {status}
              </span>
              <span className="pb-data-figure">{counts[status]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3.5 rounded-lg bg-surface-secondary px-3 py-2.5">
          <span className="pb-section-label text-text-tertiary">Mode</span>
          <div role="group" aria-label="Federation mode" className="flex gap-1 rounded-md bg-surface p-1">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={mode.id === "open"}
                disabled={mode.id !== "open"}
                title={mode.id === "open" ? undefined : NOT_YET}
                className={`h-7 rounded-[7px] border-0 px-3 text-[13px] font-semibold ${mode.id === "open" ? "bg-surface-tertiary text-text" : "bg-transparent text-text-faint"}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-text-tertiary">{MODES[0]!.help} Allowlist and Closed need support this instance does not have yet.</span>
        </div>

        {rows.length === 0 ? (
          peers && peers.length === 0 ? (
            <EmptyState title="No peers yet" description="When someone here follows a person on another instance, and it accepts, that instance shows up here." />
          ) : (
            <EmptyState title={`Nothing is ${filter?.toLowerCase()}`} description="This instance does not track that state yet." />
          )
        ) : (
          <div className="flex flex-col">
            <div className="pb-section-label grid grid-cols-[minmax(0,1fr)_70px_110px_104px_14px] items-center gap-3 border-b border-border-secondary px-2.5 pb-2 text-text-muted">
              <span>{filter ? `${filter}` : `Instances · ${rows.length}`}</span>
              <span className="text-right">Follows</span>
              <span>Last activity</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pt-1.5">
              {rows.map((p) => (
                <li key={p.host}>
                  <button
                    type="button"
                    aria-pressed={selected?.host === p.host}
                    onClick={() => setPicked(p.host)}
                    className={`grid h-[50px] w-full grid-cols-[minmax(0,1fr)_70px_110px_104px_14px] items-center gap-3 rounded-md border-0 px-2.5 text-left text-text-faint transition-colors duration-(--motion-fast) hover:bg-surface-secondary ${selected?.host === p.host ? "bg-surface-tertiary" : "bg-transparent"}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <SpaceIcon id={p.host} name={p.host} size={34} />
                      <span className="truncate text-[14.5px] font-semibold text-text">{p.host}</span>
                    </span>
                    <span className="text-right text-[13.5px] tabular-nums text-text-body">{p.follows}</span>
                    <span className="text-[13px] text-text-body">{ago(p.last_activity)}</span>
                    <span className="inline-flex items-center gap-[7px] text-[13px] font-semibold text-text-body">
                      <span className="size-2 rounded-full" style={{ background: COLOUR.Federating }} />
                      Federating
                    </span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <aside aria-label="Peer details" className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-background-secondary max-xl:hidden">
        {selected ? (
          <>
            <div className="h-[88px] shrink-0" style={{ background: defaultBannerCss(selected.host) }} />
            <div className="flex flex-1 flex-col gap-3.5 px-4 pb-4">
              <span className="-mt-7 w-fit rounded-[30%] shadow-[0_0_0_4px_var(--color-background-secondary)]">
                <SpaceIcon id={selected.host} name={selected.host} size={56} />
              </span>
              <div className="flex flex-col gap-1">
                <span className="pb-title text-[22px]">{selected.host}</span>
                <span className="pb-meta text-[12.5px]">Software and contact are not known yet.</span>
              </div>
              <span className="inline-flex h-6 w-fit items-center gap-1.5 rounded-pill px-2.5 font-heading text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: COLOUR.Federating, background: "rgba(159,212,135,.14)" }}>
                <span className="size-1.5 rounded-full" style={{ background: COLOUR.Federating }} />
                Federating
              </span>
              <div className="h-px bg-border-secondary" />
              <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-3.5">
                {[
                  ["Follows", String(selected.follows)],
                  ["Last activity", ago(selected.last_activity)],
                  ["Latency", "–"],
                  ["Last delivery", "–"],
                ].map(([name, value]) => (
                  <div key={name} className="flex min-w-0 flex-col gap-1">
                    <dt className="pb-meta text-xs">{name}</dt>
                    <dd className="m-0 text-[15px] font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="h-px bg-border-secondary" />
              <span className="pb-section-label text-text-tertiary">Policy for this instance</span>
              {[
                ["Media", "Load images, clips and avatars from this instance"],
                ["Cross-instance voice", "Its users can join your voice rooms"],
                ["Show in Discover", "List its public spaces for your members"],
              ].map(([name, help]) => (
                <div key={name} className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-3 opacity-60" title={NOT_YET}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13.5px] font-semibold">{name}</span>
                    <span className="pb-meta text-xs leading-snug">{help}</span>
                  </div>
                  <span role="switch" aria-checked="false" aria-disabled="true" aria-label={name} className="relative h-5 w-9 rounded-[10px] bg-surface-tertiary">
                    <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-text-muted" />
                  </span>
                </div>
              ))}
              <div className="mt-auto flex gap-2">
                <button type="button" disabled title={NOT_YET} className="pb-label-button h-10 flex-1 rounded-md border-0 bg-surface-secondary text-text-faint">
                  Limit
                </button>
                <button type="button" disabled title={NOT_YET} className="pb-label-button h-10 flex-1 rounded-md border-0 bg-error/14 text-error-text opacity-50">
                  Block
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-6">
            <EmptyState title="Pick a peer" description="Its details and rules show up here." />
          </div>
        )}
      </aside>
    </div>
  );
}
