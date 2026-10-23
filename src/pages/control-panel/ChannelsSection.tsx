import { useState } from "react";
import { Hash, Lock, Pencil, Plus, Trash2, Volume2 } from "lucide-react";
import { Panel, Tag } from "../../components/control-panel/Panel";
import { tableClasses } from "../../components/control-panel/tableClasses";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { useCategories } from "../../features/channels/categories";
import { useChannels } from "../../features/channels/hooks";
import type { Channel } from "../../features/channels/types";
import { classifyAuthError } from "../../utils/authErrors";
import { ChannelDialogs, type ChannelDialog } from "../../components/channels/ChannelDialogs";
import { CategoriesPanel } from "./CategoriesPanel";

const TYPE_LABEL: Record<Channel["channel_type"], string> = { text: "Text", voice: "Voice", mixed: "Text + voice" };

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "–" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const iconButton =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-text-tertiary hover:bg-surface-tertiary hover:text-text";

export function ChannelsSection() {
  const { data, isPending, error, refetch } = useChannels();
  const { data: categories = [] } = useCategories();
  const [dialog, setDialog] = useState<ChannelDialog>(null);
  const message = (err: unknown) => classifyAuthError(err, "Something went wrong. Try again.").message;

  if (isPending) return <LoadingState message="Loading channels…" />;
  if (error) return <ErrorState title="Couldn't load channels" message={message(error)} onRetry={() => void refetch()} />;

  const newButton = (
    <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
      <Plus size={15} aria-hidden="true" />
      New channel
    </Button>
  );

  const categoryName = (id: string | null | undefined) => categories.find((c) => c.category_id === id)?.name;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <CategoriesPanel channels={data} />
      {data.length === 0 ? (
        <EmptyState title="No channels yet" description="Channels you create will show up here." action={newButton} />
      ) : (
        <Panel title={`${data.length} ${data.length === 1 ? "channel" : "channels"}`} description="Create, rename or remove channels." action={newButton} flush grow>
          <table className={tableClasses.table}>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.head}>Name</th>
                <th scope="col" className={tableClasses.head}>Type</th>
                <th scope="col" className={tableClasses.head}>Category</th>
                <th scope="col" className={tableClasses.head}>Access</th>
                <th scope="col" className={tableClasses.head}>Created</th>
                <th scope="col" className={tableClasses.head}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.map((channel) => {
                const Icon = channel.channel_type === "voice" ? Volume2 : channel.is_private ? Lock : Hash;
                return (
                  <tr key={channel.channel_id} className={tableClasses.row}>
                    <td className={tableClasses.cell}>
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <Icon size={15} className="text-text-tertiary" aria-hidden="true" />
                        {channel.channel_name}
                      </span>
                    </td>
                    <td className={tableClasses.cell}>{TYPE_LABEL[channel.channel_type]}</td>
                    <td className={`${tableClasses.cell} text-text-tertiary`}>{categoryName(channel.category_id) ?? "–"}</td>
                    <td className={tableClasses.cell}>{channel.is_private ? <Tag tone="brass">Private</Tag> : <Tag>Everyone</Tag>}</td>
                    <td className={`${tableClasses.cell} text-text-tertiary`}>{formatDate(channel.created_at)}</td>
                    <td className={`${tableClasses.cell} text-right`}>
                      <span className="inline-flex gap-1">
                        <button type="button" className={iconButton} aria-label={`Edit ${channel.channel_name}`} onClick={() => setDialog({ kind: "edit", channel })}>
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button type="button" className={iconButton} aria-label={`Delete ${channel.channel_name}`} onClick={() => setDialog({ kind: "delete", channel })}>
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}

      <ChannelDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
