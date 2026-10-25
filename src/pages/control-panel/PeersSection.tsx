import { useMemo, useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import { Button, defaultBannerCss, EmptyState, ErrorState, Input, LoadingState, SpaceIcon } from "@pufferblow/spines";
import {
  FEDERATION_MODES,
  PEER_STATUSES,
  type FederationMode,
  type Peer,
  type PeerStatus,
  type PolicyKey,
  usePeerAdmin,
  usePeers,
} from "../../features/federation/peers";
import { ago } from "../../features/health/format";
import { classifyAuthError } from "../../utils/authErrors";

const STATUS_LABEL: Record<PeerStatus, string> = { federating: "Federating", pending: "Pending", limited: "Limited", blocked: "Blocked" };
const STATUS_COLOUR: Record<PeerStatus, string> = { federating: "#9fd487", pending: "#e6c15c", limited: "#9a9a9a", blocked: "#e2654f" };
const STATUS_TINT: Record<PeerStatus, string> = {
  federating: "rgba(159,212,135,.14)",
  pending: "rgba(230,193,92,.14)",
  limited: "rgba(154,154,154,.14)",
  blocked: "rgba(226,101,79,.14)",
};

const MODES: Record<FederationMode, { label: string; help: string }> = {
  open: { label: "Open", help: "Any instance can federate unless you block it." },
  allowlist: { label: "Allowlist", help: "Only instances you approve can federate. New ones wait in Pending." },
  closed: { label: "Closed", help: "No federation. Members only see this instance." },
};

const POLICIES: ReadonlyArray<{ key: PolicyKey; name: string; help: string }> = [
  { key: "media", name: "Media", help: "Show pictures and files from this instance" },
  { key: "voice", name: "Cross-instance voice", help: "Its users can join your voice rooms (recorded; not enforced yet)" },
  { key: "discover", name: "Show in Discover", help: "List its public spaces for your members (recorded; not enforced yet)" },
];

const COLUMNS = "grid-cols-[minmax(0,1fr)_70px_110px_104px_14px]";

function StatusPill({ status }: { status: PeerStatus }) {
  return (
    <span className="inline-flex h-6 w-fit items-center gap-1.5 rounded-pill px-2.5 font-heading text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: STATUS_COLOUR[status], background: STATUS_TINT[status] }}>
      <span className="size-1.5 rounded-full" style={{ background: STATUS_COLOUR[status] }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** The sentence a failed change gets: the server's reason, or a retry hint. */
function reason(error: unknown): string {
  return classifyAuthError(error, "That did not work. Try again.").message;
}

/**
 * Peers: the instances this one federates with, and the rules for each. The mode frames everything
 * (open, allowlist, closed); a peer's status (federating, pending, limited, blocked) and its three
 * switches decide what is shared with it. Only the media switch is enforced today; the others are
 * recorded for the parts that will use them, and say so.
 */
export function PeersSection() {
  const { data, isPending, error, refetch } = usePeers();
  const admin = usePeerAdmin();
  const [filter, setFilter] = useState<PeerStatus | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [newHost, setNewHost] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const peers = data?.peers;
  const rows = useMemo(() => (peers ?? []).filter((p) => !filter || p.status === filter), [peers, filter]);
  const selected: Peer | undefined = rows.find((p) => p.host === picked) ?? rows[0];

  const run = async (change: Promise<unknown>) => {
    setProblem(null);
    try {
      await change;
    } catch (failure) {
      setProblem(reason(failure));
    }
  };

  const addPeer = (event: FormEvent) => {
    event.preventDefault();
    const host = newHost.trim();
    if (!host) return;
    void run(admin.add.mutateAsync({ host, status: "federating" }).then(() => setNewHost("")));
  };

  if (isPending) return <LoadingState message="Loading peers…" shape="table" />;
  if (error || !data) return <ErrorState title="Couldn't load peers" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;

  return (
    <div className="grid flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section aria-label="Peers" className="flex min-w-0 flex-col gap-4 rounded-lg bg-background-secondary p-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {PEER_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter === status}
              aria-label={`${STATUS_LABEL[status]}: ${data.counts[status]}`}
              onClick={() => setFilter(filter === status ? null : status)}
              className={`flex flex-col gap-3 rounded-lg border-0 p-3.5 text-left text-text transition-colors duration-(--motion-fast) hover:bg-surface-tertiary ${filter === status ? "bg-surface-tertiary" : "bg-surface-secondary"}`}
            >
              <span className="pb-section-label flex items-center gap-[7px] text-text-tertiary">
                <span className="size-[7px] rounded-full" style={{ background: STATUS_COLOUR[status] }} />
                {STATUS_LABEL[status]}
              </span>
              <span className="pb-data-figure">{data.counts[status]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3.5 rounded-lg bg-surface-secondary px-3 py-2.5">
          <span className="pb-section-label text-text-tertiary">Mode</span>
          <div role="group" aria-label="Federation mode" className="flex gap-1 rounded-md bg-surface p-1">
            {FEDERATION_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={mode === data.mode}
                disabled={admin.setMode.isPending}
                onClick={() => mode !== data.mode && void run(admin.setMode.mutateAsync(mode))}
                className={`h-7 rounded-[7px] border-0 px-3 text-[13px] font-semibold ${mode === data.mode ? "bg-surface-tertiary text-text" : "bg-transparent text-text-faint hover:text-text"}`}
              >
                {MODES[mode].label}
              </button>
            ))}
          </div>
          <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-text-tertiary">{MODES[data.mode].help}</span>
        </div>

        <form onSubmit={addPeer} className="flex items-start gap-2" aria-label="Add a peer">
          <Input aria-label="Instance to add" placeholder="Add an instance, like mesh.garden" value={newHost} onChange={(e) => setNewHost(e.target.value)} className="h-10" />
          <Button type="submit" size="md" variant="secondary" loading={admin.add.isPending} disabled={!newHost.trim()}>
            Add peer
          </Button>
        </form>

        {problem && (
          <p role="alert" className="pb-error m-0">
            {problem}
          </p>
        )}

        {rows.length === 0 ? (
          data.peers.length === 0 ? (
            <EmptyState title="No peers yet" description="Instances show up here when they first reach this one, when someone follows a person there, or when you add one." />
          ) : (
            <EmptyState title={`Nothing is ${filter ? STATUS_LABEL[filter].toLowerCase() : "here"}`} description="No instance has that status." />
          )
        ) : (
          <div className="flex flex-col">
            <div className={`pb-section-label grid ${COLUMNS} items-center gap-3 border-b border-border-secondary px-2.5 pb-2 text-text-muted`}>
              <span>{filter ? STATUS_LABEL[filter] : `Instances · ${rows.length}`}</span>
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
                    className={`grid h-[50px] w-full ${COLUMNS} items-center gap-3 rounded-md border-0 px-2.5 text-left text-text-faint transition-colors duration-(--motion-fast) hover:bg-surface-secondary ${selected?.host === p.host ? "bg-surface-tertiary" : "bg-transparent"}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <SpaceIcon id={p.host} name={p.host} size={34} />
                      <span className="truncate text-[14.5px] font-semibold text-text">{p.host}</span>
                    </span>
                    <span className="text-right text-[13.5px] tabular-nums text-text-body">{p.follows}</span>
                    <span className="text-[13px] text-text-body">{ago(p.last_activity)}</span>
                    <span className="inline-flex items-center gap-[7px] text-[13px] font-semibold text-text-body">
                      <span className="size-2 rounded-full" style={{ background: STATUS_COLOUR[p.status] }} />
                      {STATUS_LABEL[p.status]}
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
          <PeerDetails
            key={selected.host}
            peer={selected}
            busy={admin.setStatus.isPending || admin.setPolicy.isPending || admin.remove.isPending || admin.checkNow.isPending}
            onStatus={(status) => void run(admin.setStatus.mutateAsync({ host: selected.host, status }))}
            onPolicy={(key, value) => void run(admin.setPolicy.mutateAsync({ host: selected.host, policy: { [key]: value } }))}
            onCheck={() => void run(admin.checkNow.mutateAsync(selected.host).then((found) => !found && setProblem(`${selected.host} did not say what it is.`)))}
            onRemove={() => void run(admin.remove.mutateAsync(selected.host).then(() => setPicked(null)))}
          />
        ) : (
          <div className="grid flex-1 place-items-center p-6">
            <EmptyState title="Pick a peer" description="Its details and rules show up here." />
          </div>
        )}
      </aside>
    </div>
  );
}

function PeerDetails({
  peer,
  busy,
  onStatus,
  onPolicy,
  onCheck,
  onRemove,
}: {
  peer: Peer;
  busy: boolean;
  onStatus: (status: PeerStatus) => void;
  onPolicy: (key: PolicyKey, value: boolean) => void;
  onCheck: () => void;
  onRemove: () => void;
}) {
  const known = [peer.software, peer.version].filter(Boolean).join(" ");
  // A blocked or pending instance gets nothing, whatever the switches were: they cannot be changed until it is let in.
  const switchesLocked = peer.status === "blocked" || peer.status === "pending";
  return (
    <>
      <div className="h-[88px] shrink-0" style={{ background: defaultBannerCss(peer.host) }} />
      <div className="flex flex-1 flex-col gap-3.5 px-4 pb-4">
        <span className="-mt-7 w-fit rounded-[30%] shadow-[0_0_0_4px_var(--color-background-secondary)]">
          <SpaceIcon id={peer.host} name={peer.host} size={56} />
        </span>
        <div className="flex flex-col gap-1">
          <span className="pb-title text-[22px]">{peer.host}</span>
          <span className="pb-meta text-[12.5px]">{known ? `${known}${peer.users !== null ? ` · ${peer.users} users` : ""}` : "Software not known. Use Check now."}</span>
        </div>
        <StatusPill status={peer.status} />
        <div className="h-px bg-border-secondary" />
        <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-3.5">
          {[
            ["Follows", String(peer.follows)],
            ["Last activity", ago(peer.last_activity)],
            ["Latency", peer.latency_ms === null ? "–" : `${peer.latency_ms} ms`],
            ["Last delivery", peer.last_delivery_at ? `${ago(peer.last_delivery_at)}${peer.last_delivery_ok === false ? " (failed)" : ""}` : "–"],
          ].map(([name, value]) => (
            <div key={name} className="flex min-w-0 flex-col gap-1">
              <dt className="pb-meta text-xs">{name}</dt>
              <dd className="m-0 text-[15px] font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="h-px bg-border-secondary" />
        <span className="pb-section-label text-text-tertiary">Policy for this instance</span>
        {POLICIES.map(({ key, name, help }) => (
          <div key={key} className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-3" title={switchesLocked ? `Nothing is shared with a ${peer.status} instance.` : undefined}>
            <div className="flex flex-col gap-0.5">
              <span className="text-[13.5px] font-semibold">{name}</span>
              <span className="pb-meta text-xs leading-snug">{help}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={peer.policy[key]}
              aria-label={name}
              disabled={switchesLocked || busy}
              onClick={() => onPolicy(key, !peer.policy[key])}
              className={`relative h-5 w-9 rounded-[10px] border-0 p-0 transition-colors duration-(--motion-fast) disabled:opacity-50 ${peer.policy[key] ? "bg-text" : "bg-surface-tertiary"}`}
            >
              <span className={`absolute top-0.5 size-4 rounded-full transition-[left] duration-(--motion-fast) ${peer.policy[key] ? "left-[18px] bg-background" : "left-0.5 bg-text-muted"}`} />
            </button>
          </div>
        ))}
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex gap-2">
            {peer.status !== "federating" && (
              <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => onStatus("federating")}>
                Accept
              </Button>
            )}
            {peer.status !== "limited" && peer.status !== "blocked" && (
              <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => onStatus("limited")}>
                Limit
              </Button>
            )}
            {peer.status !== "blocked" && (
              <Button variant="danger" className="flex-1" disabled={busy} onClick={() => onStatus("blocked")}>
                Block
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" disabled={busy} onClick={onCheck}>
              Check now
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" disabled={busy} onClick={onRemove}>
              Remove
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
