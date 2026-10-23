import { useMemo, useState } from "react";
import { Panel } from "../../components/control-panel/Panel";
import { tableClasses } from "../../components/control-panel/tableClasses";
import { Button } from "../../components/ui/Button";
import { DatePicker } from "../../components/ui/DatePicker";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { Select } from "../../components/ui/Select";
import { useAudit } from "../../features/admin/hooks";
import { actionLabel, type AuditEntry } from "../../features/admin/moderation";
import { classifyAuthError } from "../../utils/authErrors";

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

  if (isPending) return <LoadingState message="Loading the audit log…" shape="table" />;
  if (error || !data) return <ErrorState title="Couldn't load the audit log" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;

  const newest = data.reduce((latest, e) => Math.max(latest, Date.parse(e.timestamp) || 0), 0);
  const newestDay = newest ? new Date(newest).toLocaleDateString("en-CA") : undefined; // YYYY-MM-DD, in local time

  const shown = data
    .filter((e) => (!person || e.user?.id === person) && (!action || e.type === action))
    .filter((e) => (!from || Date.parse(e.timestamp) >= startOf(from)) && (!to || Date.parse(e.timestamp) <= endOf(to)))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const filtered = person !== "" || action !== "" || from !== "" || to !== "";

  return (
    <Panel
      title={`${shown.length} ${shown.length === 1 ? "entry" : "entries"}`}
      description="Newest first. The log keeps the most recent 200 entries."
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
        <Select label="Person" className="w-44" value={person} onChange={setPerson} options={[{ value: "", label: "Everyone" }, ...people.map(([id, name]) => ({ value: id, label: name }))]} />
        <Select label="Action" className="w-52" value={action} onChange={setAction} options={[{ value: "", label: "Any action" }, ...actions.map((type) => ({ value: type, label: actionLabel(type) }))]} />
        <span className="flex items-center gap-2 text-[13px] text-text-tertiary">
          From
          <DatePicker label="From" initialMonth={newestDay} value={from} max={to || undefined} onChange={setFrom} />
        </span>
        <span className="flex items-center gap-2 text-[13px] text-text-tertiary">
          To
          <DatePicker label="To" initialMonth={newestDay} value={to} min={from || undefined} onChange={setTo} />
        </span>
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
