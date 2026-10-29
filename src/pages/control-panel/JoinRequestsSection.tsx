import { useState } from "react";
import { Check, X } from "lucide-react";
import { Panel, Tag } from "../../components/control-panel/Panel";
import { tableClasses } from "../../components/control-panel/tableClasses";
import { FeedbackLine } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button, ErrorState, HostPill, LoadingState } from "@pufferblow/spines";
import { useDecideJoinRequest, useJoinRequests, type JoinRequest } from "../../features/admin/access";
import { classifyAuthError } from "../../utils/authErrors";

const TABS: { id: JoinRequest["status"]; label: string }[] = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "denied", label: "Declined" },
];

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/** Requests to join, for the owner and the moderators: who asked, what they said, and approve or decline. */
export function JoinRequestsSection() {
  const [tab, setTab] = useState<JoinRequest["status"]>("pending");
  const { data, isPending, error, refetch } = useJoinRequests(tab);
  const decide = useDecideJoinRequest();
  const save = useSave("Done.");

  const act = (request: JoinRequest, approve: boolean) => void save.run(() => decide.mutateAsync({ id: request.request_id, approve }).then(() => undefined));
  const mode = data?.join_mode;

  return (
    <Panel
      title="Join requests"
      description={
        mode === "request"
          ? "People ask to join; you decide. Someone from another server is let in the next time they check."
          : "Requests only arrive when the server is set to Request to join (Settings, Who can join). Earlier ones are kept here."
      }
      grow
    >
      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="Request status" className="flex w-fit gap-1 rounded-lg bg-background p-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={["flex items-center gap-1.5 rounded-md px-3.5 py-[7px] text-[13.5px]", tab === id ? "bg-surface-tertiary font-semibold text-text" : "text-text-tertiary hover:text-text"].join(" ")}
            >
              {label}
              {id === "pending" && !!data?.pending && <span className="min-w-5 rounded-pill bg-error px-1.5 text-center text-xs font-semibold text-on-error">{data.pending}</span>}
            </button>
          ))}
        </div>
        <FeedbackLine feedback={save.feedback} />

        {isPending ? (
          <LoadingState message="Loading requests…" shape="table" />
        ) : error || !data ? (
          <ErrorState title="Couldn't load requests" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />
        ) : data.requests.length === 0 ? (
          <p className="pb-meta m-0 text-[13px]">{tab === "pending" ? "Nobody is waiting." : "Nothing here yet."}</p>
        ) : (
          <table className={tableClasses.table}>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.head}>Who</th>
                <th scope="col" className={tableClasses.head}>Note</th>
                <th scope="col" className={tableClasses.head}>Asked</th>
                <th scope="col" className={tableClasses.head}>
                  <span className="sr-only">Decide</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.requests.map((request) => (
                <tr key={request.request_id} className={tableClasses.row}>
                  <td className={tableClasses.cell}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{request.handle.split("@")[0]}</span>
                      {request.kind === "federated" && request.home_host ? <HostPill host={request.home_host} /> : <Tag>This server</Tag>}
                    </div>
                  </td>
                  <td className={`${tableClasses.cell} max-w-[320px] text-text-tertiary`}>{request.message ?? ""}</td>
                  <td className={`${tableClasses.cell} text-text-tertiary`}>{when(request.created_at)}</td>
                  <td className={`${tableClasses.cell} text-right`}>
                    {request.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" disabled={decide.isPending} aria-label={`Decline ${request.handle}`} onClick={() => act(request, false)}>
                          <X size={14} aria-hidden="true" />
                          Decline
                        </Button>
                        <Button size="sm" disabled={decide.isPending} aria-label={`Approve ${request.handle}`} onClick={() => act(request, true)}>
                          <Check size={14} aria-hidden="true" />
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <Tag tone={request.status === "approved" ? "green" : "red"}>{request.status === "approved" ? "Approved" : "Declined"}</Tag>
                    )}
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
