import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import {
  BarChart3,
  CheckSquare,
  CircleX,
  FileText,
  Folder,
  Hash,
  KeyRound,
  Lock,
  PlugZap,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { ChannelCreationModal } from "../../components/ChannelCreationModal";
import { useToast } from "../../components/Toast";
import { Button } from "../../components/Button";
import { ControlPanelContent } from "../control-panel/ControlPanelContent";
import { ControlPanelHeader } from "../control-panel/ControlPanelHeader";
import { ControlPanelSidebar } from "../control-panel/ControlPanelSidebar";
import { FileViewerModal } from "../control-panel/FileViewerModal";
import type { ControlPanelTab, ControlPanelTabId, StorageFile } from "../control-panel/types";
import { useControlPanelData } from "../control-panel/useControlPanelData";
import { getAuthTokenForRequests } from "../../services/authSession";
import { hasResolvedPrivilege, getAuthTokenFromCookies, useCurrentUserProfile } from "../../services/user";
import { logger } from "../../utils/logger";

export default function ControlPanelPage() {
  const showToast = useToast();
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    error: currentUserError,
  } = useCurrentUserProfile();
  const [activeTab, setActiveTab] = useState<ControlPanelTabId>("overview");
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [fileViewerModal, setFileViewerModal] = useState<{
    isOpen: boolean;
    file: StorageFile | null;
  }>({ isOpen: false, file: null });

  const canViewOverview = hasResolvedPrivilege(currentUser, "view_server_stats");
  const canViewModeration =
    hasResolvedPrivilege(currentUser, "moderate_content") ||
    hasResolvedPrivilege(currentUser, "ban_users") ||
    hasResolvedPrivilege(currentUser, "mute_users") ||
    hasResolvedPrivilege(currentUser, "delete_messages");
  const canViewMembers = hasResolvedPrivilege(currentUser, "view_users");
  const canViewRoles = hasResolvedPrivilege(currentUser, "manage_server_privileges");
  const canViewChannels =
    hasResolvedPrivilege(currentUser, "create_channels") ||
    hasResolvedPrivilege(currentUser, "edit_channels") ||
    hasResolvedPrivilege(currentUser, "delete_channels") ||
    hasResolvedPrivilege(currentUser, "manage_channel_users") ||
    hasResolvedPrivilege(currentUser, "view_private_channels");
  const canViewTasks = hasResolvedPrivilege(currentUser, "manage_background_tasks");
  const canViewSettings = hasResolvedPrivilege(currentUser, "manage_server_settings");
  const canViewStorage =
    hasResolvedPrivilege(currentUser, "view_files") ||
    hasResolvedPrivilege(currentUser, "upload_files") ||
    hasResolvedPrivilege(currentUser, "delete_files") ||
    hasResolvedPrivilege(currentUser, "manage_cdn");
  const canViewSecurity = hasResolvedPrivilege(currentUser, "manage_server_settings");
  const canViewBlockedIps = hasResolvedPrivilege(currentUser, "manage_blocked_ips");
  const canViewLogs = hasResolvedPrivilege(currentUser, "view_audit_logs");
  const canViewInstancePing = hasResolvedPrivilege(currentUser, "view_server_stats");

  const {
    isLoading,
    controlPanelAuthToken,
    controlPanelChannels,
    setControlPanelChannels,
    controlPanelUsers,
    controlPanelRoles,
    controlPanelPrivileges,
    fetchControlPanelData,
    refreshChannels,
    createControlPanelChannel,
    resolveControlPanelAuthToken,
  } = useControlPanelData({
    isCurrentUserLoading,
    currentUser,
    currentUserError,
    canViewChannels,
    canViewMembers,
    canViewRoles,
  });

  const dashboardTabs: ControlPanelTab[] = canViewOverview
    ? [{ id: "overview", label: "Overview", icon: <BarChart3 className="h-6 w-6" /> }]
    : [];

  const managementTabs: ControlPanelTab[] = [
    canViewModeration ? { id: "moderation", label: "Moderation", icon: <Shield className="h-6 w-6" /> } : null,
    canViewMembers ? { id: "members", label: "Members", icon: <Users className="h-6 w-6" /> } : null,
    canViewRoles ? { id: "roles", label: "Roles", icon: <KeyRound className="h-6 w-6" /> } : null,
    canViewChannels ? { id: "channels", label: "Channels", icon: <Hash className="h-6 w-6" /> } : null,
  ].filter(Boolean) as ControlPanelTab[];

  const configurationTabs: ControlPanelTab[] = [
    canViewTasks ? { id: "tasks", label: "Tasks", icon: <CheckSquare className="h-6 w-6" /> } : null,
    canViewSettings ? { id: "settings", label: "Settings", icon: <Settings className="h-6 w-6" /> } : null,
    canViewStorage ? { id: "storage", label: "Storage", icon: <Folder className="h-6 w-6" /> } : null,
  ].filter(Boolean) as ControlPanelTab[];

  const securityTabs: ControlPanelTab[] = [
    canViewSecurity ? { id: "security", label: "Security", icon: <Lock className="h-6 w-6" /> } : null,
    canViewBlockedIps ? { id: "blocked-ips", label: "Blocked IPs", icon: <CircleX className="h-6 w-6" /> } : null,
    canViewLogs ? { id: "logs", label: "Logs", icon: <FileText className="h-6 w-6" /> } : null,
    canViewInstancePing ? { id: "instance-ping", label: "Instance Ping", icon: <PlugZap className="h-6 w-6" /> } : null,
  ].filter(Boolean) as ControlPanelTab[];

  const tabs = [...dashboardTabs, ...managementTabs, ...configurationTabs, ...securityTabs];
  const hasSessionToken = Boolean(getAuthTokenForRequests() || getAuthTokenFromCookies());

  useEffect(() => {
    if (tabs.length === 0) {
      return;
    }

    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  const handleCreateChannel = async (channelData: {
    name: string;
    type: "text" | "voice";
    description?: string;
    isPrivate?: boolean;
  }) => {
    logger.ui.debug("Control panel create channel requested", {
      channelName: channelData.name,
      channelType: channelData.type,
      isPrivate: channelData.isPrivate,
    });

    try {
      const authToken = resolveControlPanelAuthToken();
      logger.ui.debug("Control panel channel creation auth state", { hasAuthToken: Boolean(authToken) });

      if (!authToken) {
        logger.ui.error("No auth token available for control panel channel creation");
        showToast({
          message: "Authentication error: Please log in again.",
          tone: "error",
          category: "system",
        });
        return;
      }

      const { response } = await createControlPanelChannel(channelData);

      if (response.success && response.data) {
        logger.ui.info("Channel created successfully from control panel", {
          channelName: channelData.name,
          isPrivate: channelData.isPrivate,
        });

        showToast({
          message: `Channel #${channelData.name} created successfully.`,
          tone: "success",
          category: "destructive",
        });

        await refreshChannels(authToken);
        setChannelCreationModalOpen(false);
        return;
      }

      if (response.error?.includes("409") || response.error?.includes("Channel name already exists")) {
        showToast({
          message: "Channel name already exists, please choose a different name.",
          tone: "error",
          category: "validation",
        });
      } else if (response.error?.includes("403") || response.error?.includes("Access denied")) {
        showToast({
          message: "Access denied. This account is missing the create_channels privilege on this instance.",
          tone: "error",
          category: "system",
        });
      } else {
        showToast({
          message: `Failed to create channel: ${response.error || "Unknown error"}`,
          tone: "error",
          category: "system",
        });
      }

      logger.ui.error("Failed to create channel from control panel", { error: response.error, channelData });
    } catch (error) {
      showToast({
        message: "An unexpected error occurred while creating the channel.",
        tone: "error",
        category: "system",
      });
      logger.ui.error("Unexpected error creating channel from control panel", { error, channelData });
    }
  };

  if (!isCurrentUserLoading && !hasSessionToken) {
    return <Navigate to="/login" replace />;
  }

  if (!isCurrentUserLoading && currentUserError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-6">
        <div className="w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Control Panel Unavailable</h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            We could not load the current user profile required for the control panel.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-xs text-[var(--color-text-secondary)]">
            {currentUserError instanceof Error ? currentUserError.message : "Unknown profile error"}
          </pre>
          <div className="mt-6 flex justify-end gap-3">
            <Link to="/dashboard">
              <Button variant="ghost">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isCurrentUserLoading && !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
        <div className="text-center text-[var(--color-text-secondary)]">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          <p>Loading control panel...</p>
        </div>
      </div>
    );
  }

  if (!isCurrentUserLoading && currentUser && tabs.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-6">
        <div className="w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)]">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--color-text)]">Control Panel Restricted</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                This account is signed in, but it does not currently hold any control-panel privileges on this home instance.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
            Ask the instance owner to assign a custom role with privileges like <code className="text-[var(--color-text)]">view_server_stats</code>, <code className="text-[var(--color-text)]">manage_server_privileges</code>, <code className="text-[var(--color-text)]">manage_server_settings</code>, or <code className="text-[var(--color-text)]">view_audit_logs</code> depending on the control-panel area you need.
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Link to="/dashboard">
              <Button variant="ghost">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative flex h-screen overflow-hidden bg-[var(--color-background)] font-sans select-none">
        <ControlPanelSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          dashboardTabs={dashboardTabs}
          managementTabs={managementTabs}
          configurationTabs={configurationTabs}
          securityTabs={securityTabs}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-background)]">
          <ControlPanelHeader activeLabel={tabs.find((tab) => tab.id === activeTab)?.label || "Control Panel"} />
          <ControlPanelContent
            activeTab={activeTab}
            tabs={tabs}
            showToast={showToast}
            controlPanelAuthToken={controlPanelAuthToken}
            controlPanelPrivileges={controlPanelPrivileges}
            controlPanelRoles={controlPanelRoles}
            controlPanelUsers={controlPanelUsers}
            controlPanelChannels={controlPanelChannels}
            setActiveTab={setActiveTab}
            setChannelCreationModalOpen={setChannelCreationModalOpen}
            setControlPanelChannels={setControlPanelChannels}
            fetchControlPanelData={fetchControlPanelData}
            fileViewerModal={fileViewerModal}
            setFileViewerModal={setFileViewerModal}
          />
        </div>
      </div>

      <ChannelCreationModal
        isOpen={channelCreationModalOpen}
        onClose={() => setChannelCreationModalOpen(false)}
        onCreateChannel={handleCreateChannel}
      />
      <FileViewerModal
        isOpen={fileViewerModal.isOpen}
        file={fileViewerModal.file}
        onClose={() => setFileViewerModal({ isOpen: false, file: null })}
      />
    </>
  );
}
