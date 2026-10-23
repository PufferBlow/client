import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { SpaceIcon } from "../../components/ui/SpaceIcon";
import { type ImportResult, parseHostList, usePeerAdmin, usePeers } from "../../features/federation/peers";
import { classifyAuthError } from "../../utils/authErrors";

const MAX_IMPORT = 500;

/**
 * Blocklist: the instances this one refuses. Blocking someone here is the same as setting a peer to
 * Blocked on the Peers page; this is the place to see them all, add many at once (a shared list), and
 * let one back in.
 */
export function BlocklistSection() {
  const { data, isPending, error, refetch } = usePeers();
  const admin = usePeerAdmin();
  const [host, setHost] = useState("");
  const [list, setList] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (isPending) return <LoadingState message="Loading the blocklist…" shape="table" />;
  if (error || !data) return <ErrorState title="Couldn't load the blocklist" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;

  const blocked = data.peers.filter((p) => p.status === "blocked");
  const hosts = parseHostList(list);

  const attempt = async (change: Promise<unknown>) => {
    setProblem(null);
    try {
      await change;
    } catch (failure) {
      setProblem(classifyAuthError(failure, "That did not work. Try again.").message);
    }
  };

  const blockOne = (event: FormEvent) => {
    event.preventDefault();
    const value = host.trim();
    if (!value) return;
    void attempt(
      // A host that is already a peer is switched to blocked; a new one is added blocked.
      (data.peers.some((p) => p.host === value.toLowerCase()) ? admin.setStatus.mutateAsync({ host: value.toLowerCase(), status: "blocked" }) : admin.add.mutateAsync({ host: value, status: "blocked" })).then(() => setHost("")),
    );
  };

  const importList = (event: FormEvent) => {
    event.preventDefault();
    setResult(null);
    void attempt(admin.importHosts.mutateAsync({ hosts, status: "blocked" }).then((done) => (setResult(done), setList(""))));
  };

  return (
    <div className="grid flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Blocked instances" className="flex min-w-0 flex-col gap-4 rounded-lg bg-background-secondary p-4">
        <form onSubmit={blockOne} aria-label="Block an instance" className="flex items-start gap-2">
          <Input aria-label="Instance to block" placeholder="Block an instance, like noise.example" value={host} onChange={(e) => setHost(e.target.value)} className="h-10" />
          <Button type="submit" variant="danger" disabled={!host.trim()} loading={admin.add.isPending || admin.setStatus.isPending}>
            Block
          </Button>
        </form>
        {problem && (
          <p role="alert" className="pb-error m-0">
            {problem}
          </p>
        )}
        {blocked.length === 0 ? (
          <EmptyState title="Nobody is blocked" description="Blocked instances cannot send this one anything, and nothing is sent to them." />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {blocked.map((p) => (
              <li key={p.host} className="flex h-[50px] items-center gap-3 rounded-md px-2.5 hover:bg-surface-secondary">
                <SpaceIcon id={p.host} name={p.host} size={34} />
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{p.host}</span>
                <Button variant="ghost" size="sm" aria-label={`Unblock ${p.host}`} disabled={admin.setStatus.isPending} onClick={() => void attempt(admin.setStatus.mutateAsync({ host: p.host, status: "pending" }))}>
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="pb-meta m-0 text-xs">Unblocking moves an instance to Pending: it is let in again if the mode is Open, and waits for you otherwise.</p>
      </section>

      <aside aria-label="Import a list" className="flex flex-col gap-3 rounded-lg bg-background-secondary p-4">
        <span className="pb-section-label text-text-tertiary">Import a shared blocklist</span>
        <form onSubmit={importList} className="flex flex-col gap-3">
          <textarea
            aria-label="Hosts to block"
            rows={8}
            value={list}
            onChange={(e) => setList(e.target.value)}
            placeholder={"noise.example\nspam.example\n# comments are ignored"}
            className="w-full resize-y rounded-md border-0 bg-surface-secondary p-3 text-[13.5px] text-text placeholder:text-text-muted focus:outline-none focus:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_4px_var(--color-text)]"
          />
          <span className="pb-meta text-xs">{hosts.length > MAX_IMPORT ? `That is ${hosts.length} hosts; at most ${MAX_IMPORT} at a time.` : `${hosts.length} host${hosts.length === 1 ? "" : "s"} to block. Instances you already know keep their status.`}</span>
          <Button type="submit" variant="secondary" disabled={hosts.length === 0 || hosts.length > MAX_IMPORT} loading={admin.importHosts.isPending}>
            Import
          </Button>
        </form>
        {result && (
          <p role="status" className="m-0 text-[13px] leading-snug text-text-body">
            Blocked {result.added.length}, skipped {result.skipped.length} already known{result.invalid.length ? `, ${result.invalid.length} not valid (${result.invalid.slice(0, 3).join(", ")}${result.invalid.length > 3 ? "…" : ""})` : ""}.
          </p>
        )}
      </aside>
    </div>
  );
}
