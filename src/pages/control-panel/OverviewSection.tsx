import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, Globe } from "lucide-react";
import { Panel, StatCard, Tag } from "../../components/control-panel/Panel";
import { ErrorState, LoadingState } from "@pufferblow/spines";
import { useChannels } from "../../features/channels/hooks";
import { useServerInfo } from "../../features/server/hooks";
import { useUsers } from "../../features/users/hooks";
import { isOnline } from "../../features/members/presence";
import { classifyAuthError } from "../../utils/authErrors";

const formatCount = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n.toLocaleString());

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "No limit";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border-secondary py-2.5 text-sm last:border-b-0">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="m-0 min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

export function OverviewSection() {
  const server = useServerInfo();
  const channels = useChannels();
  const users = useUsers();

  if (server.isPending) return <LoadingState message="Loading server details…" shape="cards" />;
  if (server.error) {
    return (
      <ErrorState
        title="Couldn't load the server"
        message={classifyAuthError(server.error, "Try again.").message}
        onRetry={() => void server.refetch()}
      />
    );
  }

  const info = server.data;
  const memberCount = info.members_count ?? users.data?.length ?? null;
  const onlineCount = info.online_members ?? users.data?.filter((u) => isOnline(u.status)).length ?? null;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Members" value={formatCount(memberCount)} hint="Accounts on this server" />
        <StatCard label="Online now" value={formatCount(onlineCount)} />
        <StatCard label="Channels" value={formatCount(channels.data?.length)} hint="Text, voice and mixed" />
        <StatCard label="Version" value={<span className="font-sans text-2xl">{info.version || "–"}</span>} />
      </div>

      <div className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Server details" description="What members see when they join." grow>
          <dl className="m-0">
            <DetailRow label="Name">{info.server_name}</DetailRow>
            <DetailRow label="Address">
              <span className="inline-flex items-center gap-1.5">
                <Globe size={13} className="text-text-muted" aria-hidden="true" />
                {info.server_id}
              </span>
            </DetailRow>
            <DetailRow label="Description">{info.server_description || <span className="text-text-muted">None</span>}</DetailRow>
            <DetailRow label="Visibility">{info.is_private ? <Tag tone="brass">Private</Tag> : <Tag tone="green">Public</Tag>}</DetailRow>
            <DetailRow label="Max message length">{info.max_message_length ? `${info.max_message_length.toLocaleString()} characters` : "No limit"}</DetailRow>
            <DetailRow label="Max attachments per message">{formatBytes(info.max_total_attachment_size)}</DetailRow>
          </dl>
        </Panel>

        <Panel title="Jump to" description="The parts of the server you can manage." grow>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {(
              [
                ["channels", "Review channels"],
                ["members", "Review members"],
                ["settings", "Server settings"],
              ] as const
            ).map(([id, label]) => (
              <li key={id}>
                <Link
                  to={`/control-panel/${id}`}
                  className="flex h-10 items-center justify-between rounded-[10px] px-3 text-sm text-text-secondary no-underline hover:bg-surface-tertiary hover:text-text"
                >
                  {label}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
