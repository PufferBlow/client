import { useChannelAdmin } from "../../features/channels/hooks";
import type { Channel, ChannelType } from "../../features/channels/types";
import { classifyAuthError } from "../../utils/authErrors";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { ChannelForm } from "./ChannelForm";

export type ChannelDialog =
  | { kind: "create"; template?: { name: string; type: ChannelType; isPrivate: boolean } }
  | { kind: "edit"; channel: Channel }
  | { kind: "delete"; channel: Channel }
  | null;

interface Props {
  dialog: ChannelDialog;
  onClose: () => void;
  /** Called after a channel has been deleted, e.g. to leave it if it was open. */
  onDeleted?: (channel: Channel) => void;
  /** Called after a successful create/edit/delete with a short description, for a toast. */
  onDone?: (message: string) => void;
}

const message = (err: unknown) => classifyAuthError(err, "Something went wrong. Try again.").message;

/**
 * Create, edit and delete-with-confirmation for channels. Shared by the control panel and the
 * sidebar menus so both go through the same requests and cache updates.
 */
export function ChannelDialogs(props: Props) {
  // Mounted only while a dialog is open, so each one starts with fresh mutation state (no stale errors).
  return props.dialog ? <ActiveDialog {...props} dialog={props.dialog} /> : null;
}

function ActiveDialog({ dialog, onClose, onDeleted, onDone }: Props & { dialog: NonNullable<ChannelDialog> }) {
  const { create, update, remove } = useChannelAdmin();

  if (dialog.kind === "create") {
    return (
      <ChannelForm
        channel={null}
        template={dialog.template}
        busy={create.isPending}
        error={create.error ? message(create.error) : undefined}
        onClose={onClose}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: () => {
              onClose();
              onDone?.(`Created #${values.channel_name}.`);
            },
          })
        }
      />
    );
  }

  if (dialog.kind === "edit") {
    const { channel } = dialog;
    return (
      <ChannelForm
        channel={channel}
        busy={update.isPending}
        error={update.error ? message(update.error) : undefined}
        onClose={onClose}
        onSubmit={({ channel_name, is_private }) =>
          update.mutate(
            { id: channel.channel_id, changes: { channel_name, is_private } },
            {
              onSuccess: () => {
                onClose();
                onDone?.("Channel updated.");
              },
            },
          )
        }
      />
    );
  }

  const { channel } = dialog;
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Delete ${channel.channel_name}?`}
      description="This removes the channel and its messages for everyone. It can't be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(channel.channel_id, {
                onSuccess: () => {
                  onClose();
                  onDeleted?.(channel);
                  onDone?.(`Deleted #${channel.channel_name}.`);
                },
              })
            }
          >
            Delete channel
          </Button>
        </>
      }
    >
      {remove.error && (
        <p role="alert" className="m-0 text-[13px] text-error">
          {message(remove.error)}
        </p>
      )}
    </Modal>
  );
}
