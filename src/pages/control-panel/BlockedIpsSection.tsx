import { useState, type FormEvent } from "react";
import { Panel } from "../../components/control-panel/Panel";
import { tableClasses } from "../../components/control-panel/tableClasses";
import { FeedbackLine } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { useBlockedIpAdmin, useBlockedIps } from "../../features/admin/hooks";
import { classifyAuthError } from "../../utils/authErrors";

/** Blocked IP addresses: requests from these are turned away before they reach the server. */
export function BlockedIpsSection() {
  const { data, isPending, error, refetch } = useBlockedIps();
  const admin = useBlockedIpAdmin();
  const add = useSave("Blocked.");
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ip.trim() || !reason.trim()) return;
    void add.run(() => admin.block.mutateAsync({ ip: ip.trim(), reason: reason.trim() }).then(() => undefined)).then((ok) => {
      if (ok) {
        setIp("");
        setReason("");
      }
    });
  };

  return (
    <Panel title="Blocked IP addresses" description="Requests from these addresses are turned away before they reach the server. Add one when someone keeps causing trouble from the same place." grow>
      <div className="flex flex-col gap-4">
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto]">
          <Input aria-label="IP address" placeholder="203.0.113.7" value={ip} maxLength={45} onChange={(e) => setIp(e.target.value)} />
          <Input aria-label="Reason" placeholder="Reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" loading={add.loading} disabled={!ip.trim() || !reason.trim()}>
            Block
          </Button>
        </form>
        <FeedbackLine feedback={add.feedback} />
        {isPending ? (
          <LoadingState message="Loading blocked addresses…" />
        ) : error || !data ? (
          <ErrorState title="Couldn't load blocked addresses" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />
        ) : data.length === 0 ? (
          <p className="pb-meta m-0 text-[13px]">No addresses are blocked.</p>
        ) : (
          <table className={tableClasses.table}>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.head}>Address</th>
                <th scope="col" className={tableClasses.head}>Reason</th>
                <th scope="col" className={tableClasses.head}>Since</th>
                <th scope="col" className={`${tableClasses.head} text-right`}>Turned away</th>
                <th scope="col" className={tableClasses.head}><span className="sr-only">Unblock</span></th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr key={entry.ip} className={tableClasses.row}>
                  <td className={`${tableClasses.cell} font-mono text-[13px]`}>{entry.ip}</td>
                  <td className={`${tableClasses.cell} text-text-tertiary`}>{entry.reason ?? ""}</td>
                  <td className={`${tableClasses.cell} text-text-tertiary`}>{new Date(entry.blocked_at).toLocaleDateString()}</td>
                  <td className={`${tableClasses.cell} text-right tabular-nums`}>{entry.attempts ?? 0}</td>
                  <td className={`${tableClasses.cell} text-right`}>
                    <Button size="sm" variant="secondary" aria-label={`Unblock ${entry.ip}`} onClick={() => admin.unblock.mutate(entry.ip)}>
                      Unblock
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}
