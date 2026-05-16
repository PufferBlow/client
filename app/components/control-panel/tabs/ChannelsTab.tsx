/**
 * ChannelsTab — admin view for listing, creating, and deleting channels on
 * the home instance. Channel data is owned by the parent ControlPanelPage and
 * passed in / out via `channels` + `setChannels`.
 */
import { useState } from "react";
import { Hash, Mic } from "lucide-react";
import { getAuthTokenFromCookies } from "../../../services/user";
import { listChannels, deleteChannel } from "../../../services/channel";
import { logger } from "../../../utils/logger";
import type { Channel } from "../../../models";
import type { ShowToast } from "../../Toast";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import {
  cx,
  controlPanelSectionClass,
  controlPanelButtonClass,
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

  // channels array will be empty initially, so we can't use that to detect loading
  // However, the parent component will pass loaded channels
  const hasChannels = channels && channels.length > 0;

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
        logger.ui.error("Failed to delete channel", { channelId: channel.channel_id, error: response.error });
        showToast({
          message: `Failed to delete channel: ${response.error || 'Unknown error'}`,
          tone: 'error',
          category: 'system',
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
    <div className="space-y-6">
      <div className={controlPanelSectionClass}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Manage Channels</h2>
          <button
            onClick={onOpenChannelModal}
            className={controlPanelButtonClass('primary')}
          >
            Create Channel
          </button>
        </div>

        {hasChannels ? (
          <div className="space-y-3">
            {channels.map((channel) => (
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
                  <button className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]">
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
            <p className="text-[var(--color-text-muted)]">Create your first channel to get started with discussions.</p>
          </div>
        )}
      </div>
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
