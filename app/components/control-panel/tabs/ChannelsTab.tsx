/**
 * ChannelsTab — admin view for listing, creating, editing, and deleting
 * channels on the home instance. Channel data is owned by the parent
 * ControlPanelPage and passed in / out via `channels` + `setChannels`.
 *
 * Edit constraint: `channel_type` (text vs voice) is rendered as a
 * read-only badge in the edit modal. Switching mediums on an existing
 * channel would orphan messages (text -> voice) or participant rows
 * (voice -> text), so the API rejects it; the UI surfaces the same
 * rule by not offering the control. To change a channel's medium,
 * delete and recreate.
 */
import { useEffect, useState } from "react";
import { Hash, Mic } from "lucide-react";
import { getAuthTokenFromCookies } from "../../../services/user";
import { listChannels, deleteChannel, updateChannel } from "../../../services/channel";
import { logger } from "../../../utils/logger";
import { showApiError } from "../../../services/showApiError";
import type { Channel } from "../../../models";
import type { ShowToast } from "../../Toast";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { Modal } from "../../ui/Modal";
import { Button } from "../../Button";
import {
  cx,
  controlPanelSectionClass,
  controlPanelButtonClass,
  controlPanelInputClass,
  controlPanelRowClass,
} from "../shared";

export function ChannelsTab({
  onOpenChannelModal,
  channels,
  setChannels,
  showToast
}: {
  onOpenChannelModal: () => void;
  channels: Channel[];
  setChannels: (channels: Channel[]) => void;
  showToast: ShowToast;
}) {
  const [deleteConfirmChannel, setDeleteConfirmChannel] = useState<Channel | null>(null);
  // Channel-type filter. "all" shows every channel; the other values
  // narrow to a single kind. Private is its own bucket regardless of
  // medium, matching the sidebar's channel grouping pattern.
  const [typeFilter, setTypeFilter] = useState<"all" | "text" | "voice" | "private">("all");
  // Edit-channel modal state. `editingChannel` is the snapshot of the
  // row that opened the modal; `editForm` is the live in-modal draft.
  // Two separate values so cancel/close discards the draft without
  // touching the source row, and the channel_type badge always shows
  // the original (immutable) value.
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editForm, setEditForm] = useState<{ channel_name: string; is_private: boolean }>({
    channel_name: "",
    is_private: false,
  });
  const [editSaving, setEditSaving] = useState(false);

  // Sync the draft form whenever a different channel is selected for
  // editing. Resetting on every open also wipes stale half-typed state
  // from a previous edit that the user cancelled.
  useEffect(() => {
    if (editingChannel) {
      setEditForm({
        channel_name: editingChannel.channel_name,
        is_private: !!editingChannel.is_private,
      });
    }
  }, [editingChannel]);

  const filteredChannels = channels.filter((channel) => {
    if (typeFilter === "all") return true;
    if (typeFilter === "private") return !!channel.is_private;
    if (typeFilter === "voice") return !channel.is_private && channel.channel_type === "voice";
    // "text"
    return !channel.is_private && channel.channel_type !== "voice";
  });

  // channels array will be empty initially, so we can't use that to detect loading
  // However, the parent component will pass loaded channels
  const hasChannels = filteredChannels.length > 0;

  const handleSaveEdit = async () => {
    if (!editingChannel) return;
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      showToast({ message: 'Authentication token not found.', tone: 'error', category: 'system' });
      return;
    }

    const trimmedName = editForm.channel_name.trim();
    if (!trimmedName) {
      showToast({ message: 'Channel name cannot be empty.', tone: 'error', category: 'validation' });
      return;
    }

    // Only send fields that actually changed. Sending unchanged
    // fields would still work, but keeps the audit log noise down and
    // avoids tripping the name-collision check on the channel's own
    // current name.
    const payload: { channel_name?: string; is_private?: boolean } = {};
    if (trimmedName !== editingChannel.channel_name) {
      payload.channel_name = trimmedName;
    }
    if (!!editForm.is_private !== !!editingChannel.is_private) {
      payload.is_private = editForm.is_private;
    }

    if (Object.keys(payload).length === 0) {
      setEditingChannel(null);
      return;
    }

    setEditSaving(true);
    try {
      const response = await updateChannel(editingChannel.channel_id, payload, authToken);
      if (response.success) {
        logger.ui.info("Channel updated successfully", {
          channelId: editingChannel.channel_id,
          fields: Object.keys(payload),
        });
        showToast({
          message: `Channel #${trimmedName} updated successfully.`,
          tone: 'success',
          category: 'destructive',
        });

        const listResponse = await listChannels(authToken);
        if (listResponse.success && listResponse.data && listResponse.data.channels) {
          setChannels(listResponse.data.channels);
        }
        setEditingChannel(null);
      } else {
        // showApiError picks tone/category from the typed AppError
        // and uses the server's pre-formatted user_message. The
        // collision case (resource.already_exists / 409) is handled
        // automatically — the envelope's user_message is "That
        // already exists." which is correct here. Specific code
        // checks let us tighten the copy when we know the context.
        const err = showApiError(showToast, response, {
          action: "update the channel",
        });
        logger.ui.error("Failed to update channel", {
          channelId: editingChannel.channel_id,
          code: err.code,
          requestId: err.requestId,
        });
      }
    } catch (error) {
      logger.ui.error("Error updating channel", { channelId: editingChannel.channel_id, error });
      showToast({
        message: 'An unexpected error occurred while updating the channel.',
        tone: 'error',
        category: 'system',
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteChannel = async (channel: Channel) => {
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) return;

    try {
      const response = await deleteChannel(channel.channel_id, authToken);
      if (response.success) {
        logger.ui.info("Channel deleted successfully", { channelId: channel.channel_id, channelName: channel.channel_name });

        showToast({
          message: `Channel #${channel.channel_name} deleted successfully.`,
          tone: 'success',
          category: 'destructive',
        });

        // Refresh the channel list
        const listResponse = await listChannels(authToken);
        if (listResponse.success && listResponse.data && listResponse.data.channels) {
          setChannels(listResponse.data.channels);
        }
        setDeleteConfirmChannel(null);
      } else {
        const err = showApiError(showToast, response, {
          action: "delete the channel",
        });
        logger.ui.error("Failed to delete channel", {
          channelId: channel.channel_id,
          code: err.code,
          requestId: err.requestId,
        });
      }
    } catch (error) {
      logger.ui.error("Error deleting channel", { channelId: channel.channel_id, error });
      showToast({
        message: 'An unexpected error occurred while deleting the channel.',
        tone: 'error',
        category: 'system',
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-6">
      <div className={cx(controlPanelSectionClass, "flex min-h-0 flex-1 flex-col")}>
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Manage Channels</h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Type filter. Pill segmented control -- same visual
                language as the other control-panel segments. */}
            {(
              [
                { id: "all", label: "All", count: channels.length },
                {
                  id: "text",
                  label: "Text",
                  count: channels.filter((c) => !c.is_private && c.channel_type !== "voice").length,
                },
                {
                  id: "voice",
                  label: "Voice",
                  count: channels.filter((c) => !c.is_private && c.channel_type === "voice").length,
                },
                {
                  id: "private",
                  label: "Private",
                  count: channels.filter((c) => !!c.is_private).length,
                },
              ] as const
            ).map((entry) => {
              const isActive = typeFilter === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTypeFilter(entry.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {entry.label}
                  <span className="rounded-full bg-[var(--color-surface-secondary)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--color-text-muted)]">
                    {entry.count}
                  </span>
                </button>
              );
            })}
            <button
              onClick={onOpenChannelModal}
              className={controlPanelButtonClass('primary')}
            >
              Create Channel
            </button>
          </div>
        </div>

        {hasChannels ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {filteredChannels.map((channel) => (
              <div key={channel.channel_id} className={cx(controlPanelRowClass, "flex items-center justify-between p-4")}>
                <div className="flex items-center space-x-3">
                  <span className="text-[var(--color-text-secondary)]">#</span>
                  <span className="font-medium text-[var(--color-text)]">{channel.channel_name}</span>
                  {channel.is_private && (
                    <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  {channel.channel_type === 'voice' ? (
                    <>
                      <Mic className="w-3 h-3 mr-1" />
                      <span>voice</span>
                    </>
                  ) : (
                    <>
                      <Hash className="w-3 h-3 mr-1" />
                      <span>text</span>
                    </>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingChannel(channel)}
                    className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                    title={`Edit ${channel.channel_name}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmChannel(channel)}
                    className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-error)]"
                    title={`Delete ${channel.channel_name}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-[var(--color-text-secondary)] py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2">No channels found</p>
            <p className="text-[var(--color-text-muted)]">
              {typeFilter === "all"
                ? "Create your first channel to get started with discussions."
                : `No ${typeFilter} channels yet. Switch the filter or create one.`}
            </p>
          </div>
        )}
      </div>
      {/* Edit-channel modal. The channel_type is shown as a fixed
          badge — switching text<->voice is intentionally not
          supported (see file-top comment). */}
      <Modal
        isOpen={Boolean(editingChannel)}
        onClose={() => {
          if (editSaving) return;
          setEditingChannel(null);
        }}
        title={editingChannel ? `Edit #${editingChannel.channel_name}` : "Edit Channel"}
        widthClassName="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditingChannel(null)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        }
      >
        {editingChannel && (
          <div className="space-y-5">
            {/* Channel type — read-only. Rendered as the same icon +
                label pair used in the list so the operator can see at
                a glance which medium this channel is locked to. */}
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Channel Type
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2.5">
                {editingChannel.channel_type === "voice" ? (
                  <>
                    <Mic className="h-4 w-4 text-[var(--color-text-secondary)]" />
                    <span className="text-sm text-[var(--color-text)]">Voice channel</span>
                  </>
                ) : (
                  <>
                    <Hash className="h-4 w-4 text-[var(--color-text-secondary)]" />
                    <span className="text-sm text-[var(--color-text)]">Text channel</span>
                  </>
                )}
                <span className="ml-auto rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Locked
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Switching between text and voice isn't supported — it would orphan messages or
                participant rows. To change the medium, delete and recreate the channel.
              </p>
            </div>

            {/* Channel name */}
            <div>
              <label
                htmlFor="edit-channel-name"
                className="mb-1 block text-sm font-medium text-[var(--color-text)]"
              >
                Channel Name
              </label>
              <input
                id="edit-channel-name"
                type="text"
                value={editForm.channel_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, channel_name: e.target.value }))}
                disabled={editSaving}
                className={controlPanelInputClass}
                placeholder="channel-name"
                autoFocus
              />
            </div>

            {/* Privacy toggle */}
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-4 py-3">
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">Private channel</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Only the server owner, admins, and invited users can see private channels.
                </div>
              </div>
              <label className="flex cursor-pointer items-center">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={editForm.is_private}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, is_private: e.target.checked }))
                    }
                    disabled={editSaving}
                  />
                  <div
                    className={`h-6 w-11 rounded-full transition-colors ${
                      editForm.is_private
                        ? "bg-[var(--color-primary)]"
                        : "bg-[var(--color-surface-tertiary)]"
                    }`}
                  />
                  <div
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      editForm.is_private ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </label>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteConfirmChannel)}
        title="Delete Channel"
        description={deleteConfirmChannel
          ? `Delete #${deleteConfirmChannel.channel_name}? All messages in this channel will be permanently removed.`
          : ""}
        confirmLabel="Delete Channel"
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => setDeleteConfirmChannel(null)}
        onConfirm={() => {
          if (deleteConfirmChannel) {
            void handleDeleteChannel(deleteConfirmChannel);
          }
        }}
      />
    </div>
  );
}
