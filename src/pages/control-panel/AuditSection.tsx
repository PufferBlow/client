import { useMemo, useState } from "react";
import { Panel } from "../../components/control-panel/Panel";
import { tableClasses } from "../../components/control-panel/tableClasses";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { useAudit } from "../../features/admin/hooks";
import { actionLabel, type AuditEntry } from "../../features/admin/moderation";
import { classifyAuthError } from "../../utils/authErrors";

const select =
  "h-9 min-w-0 rounded-md border-0 bg-surface-secondary px-3 text-[13px] text-text outline-none focus:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_4px_var(--color-text)]";

/** The start of a day in local time, from the `YYYY-MM-DD` a date input gives. */
const startOf = (day: string) => new Date(`${day}T00:00:00`).getTime();
const endOf = (day: string) => new Date(`${day}T23:59:59.999`).getTime();

/** The details an entry carries beyond its title, as short `key: value` pairs. */
function details(entry: AuditEntry): string {
  return Object.entries(entry.metadata)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "object")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
    .join(" · ");
}

/** Audit log: every moderation and settings change, filtered by person, action and day. */
export function AuditSection() {
  const { data, isPending, error, refetch } = useAudit();
  const [person, setPerson] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const people = useMemo(() => [...new Map((data ?? []).flatMap((e) => (e.user ? [[e.user.id, e.user.username] as const] : []))).entries()].sort((a, b) => a[1].localeCompare(b[1])), [data]);
  const actions = useMemo(() => [...new Set((data ?? []).map((e) => e.type))].sort(), [data]);

  if (isPending) return <LoadingState message="Loading the audit log…" />;
  if (error || !data) return <ErrorState title="Couldn't load the audit log" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;

  const shown = data
    .filter((e) => (!person || e.user?.id === person) && (!action || e.type === action))
    .filter((e) => (!from || Date.parse(e.timestamp) >= startOf(from)) && (!to || Date.parse(e.timestamp) <= endOf(to)))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const filtered = person !== "" || action !== "" || from !== "" || to !== "";

  return (
    <Panel
      title={`${shown.length} ${shown.length === 1 ? "entry" : "entries"}`}
      description="Newest first. The log keeps the most recent 500 entries."
      grow
      flush
      action={
        filtered ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPerson("");
              setAction("");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        <select aria-label="Person" className={select} value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Everyone</option>
          {people.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="Action" className={select} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Any action</option>
          {actions.map((type) => (
            <option key={type} value={type}>
              {actionLabel(type)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[13px] text-text-tertiary">
          From
          <input aria-label="From" type="date" className={select} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-text-tertiary">
          To
          <input aria-label="To" type="date" className={select} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={filtered ? "Nothing matches" : "Nothing recorded yet"} description={filtered ? "Try a wider range or another person." : undefined} />
      ) : (
        <table className={tableClasses.table}>
          <thead>
            <tr>
              <th scope="col" className={tableClasses.head}>When</th>
              <th scope="col" className={tableClasses.head}>Who</th>
              <th scope="col" className={tableClasses.head}>What</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((entry) => (
              <tr key={entry.id} className={tableClasses.row}>
                <td className={`${tableClasses.cell} whitespace-nowrap text-text-tertiary`}>
                  <time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>
                </td>
                <td className={`${tableClasses.cell} font-semibold`}>{entry.user?.username ?? <span className="font-normal text-text-muted">System</span>}</td>
                <td className={tableClasses.cell}>
                  <div className="font-semibold">{entry.title}</div>
                  <div className="text-[13px] text-text-tertiary">{actionLabel(entry.type)}</div>
                  {details(entry) && <div className="mt-0.5 break-words font-mono text-xs text-text-muted">{details(entry)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
