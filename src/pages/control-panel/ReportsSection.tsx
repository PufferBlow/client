import { useState } from "react";
import { Panel, Tag } from "../../components/control-panel/Panel";
import { FeedbackLine } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button, EmptyState, ErrorState, LoadingState } from "@pufferblow/spines";
import type { Report } from "../../features/admin/api";
import { useModerationAdmin, useReports } from "../../features/admin/hooks";
import { durationLabel } from "../../features/admin/moderation";
import { classifyAuthError } from "../../utils/authErrors";

type Filter = "pending" | "resolved" | "all";
const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];
const TIMEOUT_MINUTES = 60;

/** Who a report is about: the person reported, or the sender of the message. */
function subjectOf(report: Report): { id: string | null; name: string } {
  if (report.type === "user_report") return { id: report.target_user?.id ?? null, name: report.target_user?.username ?? "Unknown" };
  return { id: report.sender?.id ?? null, name: report.sender?.username ?? "Unknown" };
}

function ReportRow({ report }: { report: Report }) {
  const admin = useModerationAdmin();
  const { run, loading, feedback } = useSave("Done.");
  const subject = subjectOf(report);
  const pending = report.status === "pending";

  const resolve = (action: string, before?: () => Promise<unknown>) =>
    run(async () => {
      if (before) await before();
      await admin.resolve.mutateAsync({ reportId: report.id, action });
    });

  return (
    <li className="flex flex-col gap-3 rounded-lg bg-surface-secondary p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={pending ? "brass" : "green"}>{pending ? "Pending" : "Resolved"}</Tag>
        <Tag>{report.type === "user_report" ? "Person" : "Message"}</Tag>
        <span className="text-sm font-semibold">{report.category}</span>
        <span className="ml-auto text-xs text-text-muted">{new Date(report.reported_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
      </div>
      <p className="m-0 text-[13.5px] text-text-body">
        <span className="text-text-tertiary">{report.reporter?.username ?? "Someone"} reported </span>
        <strong>{subject.name}</strong>
        {report.type === "message_report" && report.message_ids && report.message_ids.length > 1 ? ` (${report.message_ids.length} messages)` : ""}
      </p>
      {report.description && <p className="m-0 whitespace-pre-wrap break-words rounded-md bg-background-secondary px-3 py-2 text-[13.5px] text-text-body">{report.description}</p>}
      {pending && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" loading={loading} onClick={() => void resolve("dismissed")}>
            Dismiss
          </Button>
          <Button size="sm" variant="secondary" loading={loading} onClick={() => void resolve("warned")}>
            Mark as warned
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!subject.id}
            loading={loading}
            onClick={() => void resolve("timed_out", () => admin.timeout.mutateAsync({ userId: subject.id!, minutes: TIMEOUT_MINUTES, reason: `Report: ${report.category}` }))}
          >
            Time out {durationLabel(TIMEOUT_MINUTES)}
          </Button>
          <Button size="sm" variant="danger" disabled={!subject.id} loading={loading} onClick={() => void resolve("banned", () => admin.ban.mutateAsync({ userId: subject.id!, reason: `Report: ${report.category}` }))}>
            Ban
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
      )}
    </li>
  );
}

/** Reports from members, what was done about each, and the addresses that are blocked. */
export function ReportsSection() {
  const { data, isPending, error, refetch } = useReports();
  const [filter, setFilter] = useState<Filter>("pending");

  let reports: React.ReactNode;
  if (isPending) reports = <LoadingState message="Loading reports…" />;
  else if (error || !data) reports = <ErrorState title="Couldn't load reports" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;
  else {
    const shown = data.filter((r) => filter === "all" || r.status === filter);
    reports =
      shown.length === 0 ? (
        <EmptyState title={filter === "pending" ? "Nothing waiting" : "No reports"} description={filter === "pending" ? "Reports from members will show up here." : undefined} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {shown.map((report) => (
            <ReportRow key={report.id} report={report} />
          ))}
        </ul>
      );
  }

  return (
    <>
      <Panel
        title="Reports"
        description="Dismiss a report, or act on the person it is about. Each answer is recorded in the audit log. Blocked IP addresses have their own page."
        grow
        action={
          <div role="group" aria-label="Show" className="flex gap-1.5">
            {FILTERS.map((f) => (
              <Button key={f.id} size="sm" variant={filter === f.id ? "primary" : "secondary"} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </Button>
            ))}
          </div>
        }
      >
        {reports}
      </Panel>
    </>
  );
}
