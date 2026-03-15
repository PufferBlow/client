import { Link, Navigate } from "react-router";
import { useState, useEffect, type ReactNode } from "react";
import {
  BarChart3,
  Shield,
  Users,
  KeyRound,
  Hash,
  CheckSquare,
  Settings,
  Folder,
  Lock,
  CircleX,
  FileText
} from "lucide-react";
import { ChannelCreationModal } from "../../components/ChannelCreationModal";
import { TasksTab, StorageTab, OverviewTab, MembersTab, ChannelsTab, SettingsTab, SecurityTab, BlockedIPsTab, LogsTab, ModerationTab } from "../control-panel/ControlPanelTabs";
import { RolesTab } from "../control-panel/RoleManagement";
import { getAuthTokenFromCookies, hasResolvedPrivilege, listUsers, type ListUsersResponse, useCurrentUserProfile } from "../../services/user";
import { listChannels, createChannel } from "../../services/channel";
import {
  listInstancePrivileges,
  listInstanceRoles,
  type InstancePrivilege,
  type InstanceRole,
} from "../../services/system";
import { getAuthTokenForRequests } from "../../services/authSession";
import { logger } from "../../utils/logger";
import type { Channel } from "../../models";
import { useToast } from "../../components/Toast";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/Button";

// Storage File interface
type StorageFile = {
  id: string;
  filename: string;
  path: string;
  size: number;
  type: string;
  uploaded_at: string;
  uploader: string;
  is_orphaned: boolean;
  url: string;
};

type ControlPanelTabId =
  | 'overview'
  | 'moderation'
  | 'members'
  | 'roles'
  | 'channels'
  | 'tasks'
  | 'logs'
  | 'settings'
  | 'storage'
  | 'security'
  | 'blocked-ips';

export default function ControlPanel() {
  const showToast = useToast();
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    error: currentUserError,
  } = useCurrentUserProfile();
  const [activeTab, setActiveTab] = useState<ControlPanelTabId>('overview');
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [controlPanelAuthToken, setControlPanelAuthToken] = useState('');

  // Channels state for the control panel
  const [controlPanelChannels, setControlPanelChannels] = useState<Channel[]>([]);

  // Users state for the control panel
  const [controlPanelUsers, setControlPanelUsers] = useState<ListUsersResponse['users']>([]);
  const [controlPanelRoles, setControlPanelRoles] = useState<InstanceRole[]>([]);
  const [controlPanelPrivileges, setControlPanelPrivileges] = useState<InstancePrivilege[]>([]);

  // FileViewerModal state
  const [fileViewerModal, setFileViewerModal] = useState<{
    isOpen: boolean;
    file: StorageFile | null;
  }>({ isOpen: false, file: null });

  const canViewOverview = hasResolvedPrivilege(currentUser, 'view_server_stats');
  const canViewModeration =
    hasResolvedPrivilege(currentUser, 'moderate_content') ||
    hasResolvedPrivilege(currentUser, 'ban_users') ||
    hasResolvedPrivilege(currentUser, 'mute_users') ||
    hasResolvedPrivilege(currentUser, 'delete_messages');
  const canViewMembers = hasResolvedPrivilege(currentUser, 'view_users');
  const canViewRoles = hasResolvedPrivilege(currentUser, 'manage_server_privileges');
  const canViewChannels =
    hasResolvedPrivilege(currentUser, 'create_channels') ||
    hasResolvedPrivilege(currentUser, 'edit_channels') ||
    hasResolvedPrivilege(currentUser, 'delete_channels') ||
    hasResolvedPrivilege(currentUser, 'manage_channel_users') ||
    hasResolvedPrivilege(currentUser, 'view_private_channels');
  const canViewTasks = hasResolvedPrivilege(currentUser, 'manage_background_tasks');
  const canViewSettings = hasResolvedPrivilege(currentUser, 'manage_server_settings');
  const canViewStorage =
    hasResolvedPrivilege(currentUser, 'view_files') ||
    hasResolvedPrivilege(currentUser, 'upload_files') ||
    hasResolvedPrivilege(currentUser, 'delete_files') ||
    hasResolvedPrivilege(currentUser, 'manage_cdn');
  const canViewSecurity = hasResolvedPrivilege(currentUser, 'manage_server_settings');
  const canViewBlockedIps = hasResolvedPrivilege(currentUser, 'manage_blocked_ips');
  const canViewLogs = hasResolvedPrivilege(currentUser, 'view_audit_logs');

  type ControlPanelTab = {
    id: ControlPanelTabId;
    label: string;
    icon: ReactNode;
  };

  const dashboardTabs: ControlPanelTab[] = canViewOverview
    ? [{ id: 'overview', label: 'Overview', icon: <BarChart3 className="w-6 h-6" /> }]
    : [];

  const managementTabs: ControlPanelTab[] = [
    canViewModeration ? { id: 'moderation', label: 'Moderation', icon: <Shield className="w-6 h-6" /> } : null,
    canViewMembers ? { id: 'members', label: 'Members', icon: <Users className="w-6 h-6" /> } : null,
    canViewRoles ? { id: 'roles', label: 'Roles', icon: <KeyRound className="w-6 h-6" /> } : null,
    canViewChannels ? { id: 'channels', label: 'Channels', icon: <Hash className="w-6 h-6" /> } : null,
  ].filter(Boolean) as ControlPanelTab[];

  const configurationTabs: ControlPanelTab[] = [
    canViewTasks ? { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-6 h-6" /> } : null,
    canViewSettings ? { id: 'settings', label: 'Settings', icon: <Settings className="w-6 h-6" /> } : null,
    canViewStorage ? { id: 'storage', label: 'Storage', icon: <Folder className="w-6 h-6" /> } : null,
  ].filter(Boolean) as ControlPanelTab[];

  const securityTabs: ControlPanelTab[] = [
    canViewSecurity ? { id: 'security', label: 'Security', icon: <Lock className="w-6 h-6" /> } : null,
    canViewBlockedIps ? { id: 'blocked-ips', label: 'Blocked IPs', icon: <CircleX className="w-6 h-6" /> } : null,
    canViewLogs ? { id: 'logs', label: 'Logs', icon: <FileText className="w-6 h-6" /> } : null,
  ].filter(Boolean) as ControlPanelTab[];

  const tabs = [...dashboardTabs, ...managementTabs, ...configurationTabs, ...securityTabs];
  const hasSessionToken = Boolean(getAuthTokenForRequests() || getAuthTokenFromCookies());
  const resolveControlPanelAuthToken = (authTokenOverride?: string) =>
    authTokenOverride || getAuthTokenForRequests() || getAuthTokenFromCookies() || '';

  // Fetch channels and users for control panel
  const fetchControlPanelData = async (authTokenOverride?: string) => {
      const authToken = resolveControlPanelAuthToken(authTokenOverride);
      setControlPanelAuthToken(authToken);

      if (!authToken) {
        logger.ui.error("No auth token available for control panel data fetching");
        setIsLoading(false);
        return;
      }

      try {
        logger.ui.info("Fetching control panel data with auth token", { tokenPresent: !!authToken });

        // Fetch channels
        if (canViewChannels) {
          const channelsResponse = await listChannels(authToken);
          if (channelsResponse.success && channelsResponse.data?.channels) {
            setControlPanelChannels(channelsResponse.data.channels);
            logger.ui.info("Channels fetched successfully for control panel", {
              count: channelsResponse.data.channels.length,
              channelNames: channelsResponse.data.channels.map(c => c.channel_name)
            });
          } else {
            logger.ui.error("Failed to fetch channels for control panel", {
              error: channelsResponse.error,
              authTokenPresent: !!authToken
            });
            setControlPanelChannels([]);
          }
        } else {
          setControlPanelChannels([]);
        }

        if (canViewMembers || canViewRoles) {
          const usersResponse = await listUsers(authToken);
          if (usersResponse.success && usersResponse.data?.users) {
            setControlPanelUsers(usersResponse.data.users);
            logger.ui.info("Users fetched successfully for control panel", {
              count: usersResponse.data.users.length,
              usernames: usersResponse.data.users.slice(0, 5).map(u => u.username)
            });
          } else {
            logger.ui.error("Failed to fetch users for control panel", {
              error: usersResponse.error,
              authTokenPresent: !!authToken
            });
            setControlPanelUsers([]);
          }
        } else {
          setControlPanelUsers([]);
        }

        if (canViewRoles) {
          const rolesResponse = await listInstanceRoles(authToken);
          if (rolesResponse.success && rolesResponse.data?.roles) {
            setControlPanelRoles(rolesResponse.data.roles);
          } else {
            logger.ui.warn("Failed to fetch instance roles for control panel", {
              error: rolesResponse.error,
            });
            setControlPanelRoles([]);
          }
        } else {
          setControlPanelRoles([]);
        }

        if (canViewRoles) {
          const privilegesResponse = await listInstancePrivileges(authToken);
          if (privilegesResponse.success && privilegesResponse.data?.privileges) {
            setControlPanelPrivileges(privilegesResponse.data.privileges);
          } else {
            logger.ui.warn("Failed to fetch instance privileges for control panel", {
              error: privilegesResponse.error,
            });
            setControlPanelPrivileges([]);
          }
        } else {
          setControlPanelPrivileges([]);
        }
      } catch (error) {
        logger.ui.error("Unexpected error fetching control panel data", { error });
        setControlPanelChannels([]);
        setControlPanelUsers([]);
        setControlPanelRoles([]);
        setControlPanelPrivileges([]);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    if (isCurrentUserLoading) {
      return;
    }

    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    void fetchControlPanelData();
  }, [
    canViewChannels,
    canViewMembers,
    canViewRoles,
    currentUser,
    currentUserError,
    isCurrentUserLoading,
  ]);

  useEffect(() => {
    if (tabs.length === 0) {
      return;
    }
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  const handleCreateChannel = async (channelData: { name: string; type: 'text' | 'voice'; description?: string; isPrivate?: boolean }) => {
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

      const response = await createChannel({
        channel_name: channelData.name,
        is_private: channelData.isPrivate || false,
        channel_type: channelData.type
      }, authToken);

      if (response.success && response.data) {
        logger.ui.info("Channel created successfully from control panel", {
          channelName: channelData.name,
          isPrivate: channelData.isPrivate
        });

        showToast({
          message: `Channel #${channelData.name} created successfully.`,
          tone: "success",
          category: "destructive",
        });

        // Refresh channels list
        const channelsResponse = await listChannels(authToken);
        if (channelsResponse.success && channelsResponse.data) {
          setControlPanelChannels(channelsResponse.data.channels);
        }

        // Close modal
        setChannelCreationModalOpen(false);
      } else {
        // Handle specific error codes
        if (response.error?.includes('409') || response.error?.includes('Channel name already exists')) {
          showToast({
            message: "Channel name already exists, please choose a different name.",
            tone: "error",
            category: "validation",
          });
        } else if (response.error?.includes('403') || response.error?.includes('Access denied')) {
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
      }
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
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            Control Panel Unavailable
          </h1>
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

  // Show skeleton loading state
  if (isLoading) {
    return (
      <>
        <div className="h-screen bg-[var(--color-background)] flex font-sans select-none relative overflow-hidden">
          {/* Nord-themed Sidebar Skeleton */}
          <div className="w-64 bg-[var(--color-background-secondary)] border-r border-[var(--color-border)] flex flex-col">
            {/* Server Branding Header Skeleton */}
            <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 bg-[var(--color-background-tertiary)]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[var(--color-surface-tertiary)] rounded-full"></div>
                <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-32"></div>
              </div>
              <div className="ml-auto">
                <div className="w-6 h-6 bg-[var(--color-surface-tertiary)] rounded"></div>
              </div>
            </div>

            {/* Navigation Section Skeleton */}
            <div className="flex-1 overflow-y-auto py-3">
              <div className="px-2">
                {/* Overview/Dashboard Section */}
                <div className="mb-6">
                  <div className="px-4 py-2 mb-2">
                    <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-24"></div>
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: 1 }).map((_, i) => (
                      <div key={`overview-${i}`} className="px-3 py-2 rounded-md">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-[var(--color-surface-tertiary)] rounded"></div>
                          <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-20"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Management Section */}
                <div className="mb-6">
                  <div className="px-4 py-2 mb-2">
                    <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-40"></div>
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={`management-${i}`} className="px-3 py-2 rounded-md">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-[var(--color-surface-tertiary)] rounded"></div>
                          <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-16"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Configuration Section */}
                <div className="mb-6">
                  <div className="px-4 py-2 mb-2">
                    <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-44"></div>
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={`config-${i}`} className="px-3 py-2 rounded-md">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-[var(--color-surface-tertiary)] rounded"></div>
                          <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-18"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security Section */}
                <div className="mb-6">
                  <div className="px-4 py-2 mb-2">
                    <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-32"></div>
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={`security-${i}`} className="px-3 py-2 rounded-md">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-[var(--color-surface-tertiary)] rounded"></div>
                          <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-20"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Back to Dashboard Button Skeleton */}
            <div className="m-2 p-2">
              <div className="hover:bg-[var(--color-surface-secondary)] rounded-lg transition-all duration-200 flex items-center space-x-3 text-[var(--color-text)] cursor-pointer p-2">
                <div className="w-5 h-5 ml-3">
                  <div className="w-5 h-5 bg-[var(--color-surface-tertiary)] rounded"></div>
                </div>
                <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-28"></div>
              </div>
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="flex-1 flex flex-col bg-[var(--color-background)] overflow-hidden">
            {/* Header Skeleton */}
            <div className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-6 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-40"></div>
              </div>
              <div className="ml-auto">
                <div className="h-6 bg-[var(--color-surface-tertiary)] rounded w-12 px-2 py-1"></div>
              </div>
            </div>

            {/* Content Area Skeleton */}
            <div className="flex-1 p-6 overflow-y-auto bg-[var(--color-background)]">
              {/* Server Information Card Skeleton */}
              <div className="bg-[var(--color-surface-secondary)] rounded-lg p-6 border border-[var(--color-border)] mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-32"></div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-[var(--color-hover)] rounded-full"></div>
                    <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-12"></div>
                  </div>
                </div>
                <div className="bg-[var(--color-surface)] rounded-lg p-4 border border-[var(--color-border)]">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-[var(--color-surface-tertiary)] rounded-xl"></div>
                    <div className="flex-1">
                      <div className="h-6 bg-[var(--color-surface-tertiary)] rounded w-48 mb-2"></div>
                      <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-64 mb-3"></div>
                      <div className="flex items-center space-x-4">
                        <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-20"></div>
                        <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-4"></div>
                        <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-24"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Server Statistics Cards Skeleton */}
              <div className="bg-[var(--color-surface-secondary)] rounded-lg p-6 border border-[var(--color-border)] mb-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-36"></div>
                  <div className="flex space-x-2">
                    <div className="px-4 py-2 bg-[var(--color-surface-tertiary)] rounded-lg">
                      <div className="h-4 bg-[var(--color-hover)] rounded w-12"></div>
                    </div>
                    <div className="px-4 py-2 bg-[var(--color-surface)] rounded-lg">
                      <div className="h-4 bg-[var(--color-hover)] rounded w-10"></div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Key Metrics Skeleton */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-[var(--color-surface)] rounded-lg p-4 border border-[var(--color-border)]">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="h-4 bg-[var(--color-surface-tertiary)] rounded mb-2 w-20"></div>
                            <div className="h-8 bg-[var(--color-surface-tertiary)] rounded w-12"></div>
                          </div>
                          <div className="w-8 h-8 bg-[var(--color-surface-tertiary)] rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detailed Stats Grid Skeleton */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-[var(--color-surface)] rounded-lg p-4">
                        <div className="flex items-center mb-3">
                          <div className="w-5 h-5 bg-[var(--color-surface-tertiary)] rounded mr-2"></div>
                          <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-24"></div>
                        </div>
                        {i === 2 ? (
                          <div>
                            <div className="h-6 bg-[var(--color-surface-tertiary)] rounded mb-2"></div>
                            <div className="w-full bg-[var(--color-surface-tertiary)] rounded-full h-2"></div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <div className="h-6 bg-[var(--color-surface-tertiary)] rounded mb-1"></div>
                              <div className="h-3 bg-[var(--color-surface-tertiary)] rounded"></div>
                            </div>
                            <div className="text-center">
                              <div className="h-6 bg-[var(--color-surface-tertiary)] rounded mb-1"></div>
                              <div className="h-3 bg-[var(--color-surface-tertiary)] rounded"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Additional Stats Skeleton */}
                  <div className="bg-[var(--color-surface)] rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <div className="w-5 h-5 bg-[var(--color-surface-tertiary)] rounded mr-2"></div>
                      <div className="h-4 bg-[var(--color-surface-tertiary)] rounded w-32"></div>
                    </div>
                    <div className="text-center">
                      <div className="h-6 bg-[var(--color-surface-tertiary)] rounded mb-1 w-8 mx-auto"></div>
                      <div className="h-3 bg-[var(--color-surface-tertiary)] rounded w-32 mx-auto"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Skeleton */}
              <div className="bg-[var(--color-surface-secondary)] rounded-lg p-6 border border-[var(--color-border)]">
                <div className="h-4 bg-[var(--color-surface-tertiary)] rounded mb-4 w-32"></div>
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 p-3 bg-[var(--color-surface)] rounded-lg">
                      <div className="w-8 h-8 bg-[var(--color-surface-tertiary)] rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-[var(--color-surface-tertiary)] rounded mb-1 w-24"></div>
                        <div className="h-3 bg-[var(--color-surface-tertiary)] rounded w-32"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const openConfigurationTab = () => {
    const nextTab = configurationTabs[0]?.id || securityTabs[0]?.id || managementTabs[0]?.id || dashboardTabs[0]?.id;
    if (nextTab) {
      setActiveTab(nextTab);
    }
  };

  // FileViewerModal Component
  const FileViewerModal = ({ isOpen, file, onClose }: { isOpen: boolean; file: StorageFile | null; onClose: () => void }) => {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (isOpen && file) {
        loadFileContent(file);
      }
    }, [isOpen, file]);

    const loadFileContent = async (file: StorageFile) => {
      setLoading(true);
      setContent(null);

      try {
        // Get file type with fallback
        const fileType = file.type || '';

        if (fileType.startsWith('text/') || fileType === 'application/json') {
          // For text files, fetch content
          const response = await fetch(file.url);
          if (response.ok) {
            const text = await response.text();
            setContent(text); // Display text content
            logger.ui.info('File content loaded successfully', { filename: file.filename });
          }
        }
      } catch (error) {
        setContent('Error loading file content');
      } finally {
        setLoading(false);
      }
    };

    const formatFileSize = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const renderFileContent = () => {
      if (!file) return null;

      // Get file type with fallback
      const fileType = file.type || '';

      if (fileType.startsWith('image/')) {
        return (
          <div className="flex justify-center">
            <img
              src={file.url}
              alt={file.filename}
              className="max-w-full max-h-96 rounded-lg border border-[var(--color-border)] object-contain"
            />
          </div>
        );
      } else if (fileType.startsWith('video/')) {
        return (
          <div className="flex justify-center">
            <video
              src={file.url}
              controls
              className="max-w-full max-h-96 rounded-lg border border-[var(--color-border)]"
              preload="metadata"
            />
          </div>
        );
      } else if (fileType.startsWith('audio/')) {
        return (
          <div className="flex justify-center">
            <audio
              src={file.url}
              controls
              className="w-full max-w-md"
            />
          </div>
        );
      } else if (fileType === 'application/pdf') {
        return (
          <div className="flex justify-center">
            <iframe
              src={file.url}
              className="h-96 w-full rounded-lg border border-[var(--color-border)]"
              title={file.filename}
            />
          </div>
        );
      } else if (content) {
        return (
          <div className="bg-[var(--color-surface-tertiary)] rounded-lg p-4 max-h-96 overflow-auto">
            <pre className="text-[var(--color-text)] text-sm whitespace-pre-wrap break-words font-mono">
              {content}
            </pre>
          </div>
        );
      } else if (loading) {
        return (
          <div className="flex justify-center items-center py-12">
            <div className="text-center text-[var(--color-text-secondary)]">
              <div className="w-8 h-8 animate-spin border-2 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading file content...</p>
            </div>
          </div>
        );
      } else {
        return (
          <div className="flex justify-center">
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] px-6 py-3 rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download File</span>
            </a>
          </div>
        );
      }
    };

    if (!isOpen || !file) return null;

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={file.filename}
        description={`${formatFileSize(file.size)} | ${file.type} | Uploaded ${new Date(file.uploaded_at).toLocaleDateString()} by ${file.uploader}`}
        widthClassName="max-w-4xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <a href={file.url} target="_blank" rel="noopener noreferrer">
              <Button>Download</Button>
            </a>
          </div>
        }
      >
        <div className="max-h-[65vh] overflow-y-auto">{renderFileContent()}</div>
      </Modal>
    );
  };

  if (!isCurrentUserLoading && currentUser && tabs.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)]">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--color-text)]">Control Panel Restricted</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">This account is signed in, but it does not currently hold any control-panel privileges on this home instance.</p>
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
        <div className="flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-background-secondary)]">
          {/* Server Branding Header */}
          <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 bg-[var(--color-background-tertiary)]">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] font-semibold text-[var(--color-text)]">
                P
              </div>
              <span className="text-[var(--color-text)] font-semibold text-sm">Server Control Panel</span>
            </div>
            <div className="ml-auto">
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Host</span>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="flex-1 overflow-y-auto py-3">
            <div className="px-2">
              {/* Overview/Dashboard Section */}
              <div className="mb-6">
                <div className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Dashboard
                </div>
                {dashboardTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`mb-1 flex w-full items-center space-x-3 rounded-lg border px-3 py-2 text-left transition-colors duration-200 ${activeTab === tab.id
                        ? 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)]'
                        : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                      }`}
                  >
                    <div className={`${activeTab === tab.id ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'} transition-colors`}>
                      {tab.icon}
                    </div>
                    <span className="font-medium text-sm">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Management Section */}
              {managementTabs.length > 0 && (
                <div className="mb-6">
                  <div className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Community Management
                  </div>
                  {managementTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`mb-1 flex w-full items-center space-x-3 rounded-lg border px-3 py-2 text-left transition-colors duration-200 ${activeTab === tab.id
                          ? 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)]'
                          : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                        }`}
                    >
                      <div className={`${activeTab === tab.id ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'} transition-colors`}>
                        {tab.icon}
                      </div>
                      <span className="font-medium text-sm">{tab.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Configuration Section */}
              {configurationTabs.length > 0 && (
                <div className="mb-6">
                  <div className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Instance Configuration
                  </div>
                  {configurationTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`mb-1 flex w-full items-center space-x-3 rounded-lg border px-3 py-2 text-left transition-colors duration-200 ${activeTab === tab.id
                          ? 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)]'
                          : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                        }`}
                    >
                      <div className={`${activeTab === tab.id ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'} transition-colors`}>
                        {tab.icon}
                      </div>
                      <span className="font-medium text-sm">{tab.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Security Section */}
              {securityTabs.length > 0 && (
                <div className="mb-6">
                  <div className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Security & Advanced
                  </div>
                  {securityTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`mb-1 flex w-full items-center space-x-3 rounded-lg border px-3 py-2 text-left transition-colors duration-200 ${activeTab === tab.id
                          ? 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)]'
                          : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                        }`}
                    >
                      <div className={`${activeTab === tab.id ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'} transition-colors`}>
                        {tab.icon}
                      </div>
                      <span className="font-medium text-sm">{tab.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Back to Dashboard Button */}
          <Link
            to="/dashboard"
            className="m-2 flex items-center space-x-3 rounded-lg border border-transparent p-2 text-[var(--color-text-secondary)] transition-colors duration-200 hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
            title="Back to Dashboard"
          >
            <div className="w-8 h-8 flex items-center justify-center ml-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <span className="font-medium text-sm">Back to Dashboard</span>
          </Link>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-background)]">
          {/* Header */}
          <div className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-6 flex-shrink-0">
            <div className="flex items-center space-x-4">
              <h1 className="text-[var(--color-text)] font-semibold text-base">
                {tabs.find(tab => tab.id === activeTab)?.label || 'Control Panel'}
              </h1>
            </div>
            <div className="ml-auto">
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Host</span>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-[var(--color-background)]">
            {activeTab === 'overview' && <OverviewTab onSettingsClick={openConfigurationTab} />}
            {activeTab === 'moderation' && <ModerationTab showToast={showToast} />}
            {activeTab === 'members' && (
              <MembersTab
                roles={controlPanelRoles}
                users={controlPanelUsers}
                onOpenRolesTab={() => setActiveTab('roles')}
                showToast={showToast}
              />
            )}
            {activeTab === 'roles' && (
              <RolesTab
                authToken={controlPanelAuthToken}
                privileges={controlPanelPrivileges}
                roles={controlPanelRoles}
                users={controlPanelUsers}
                onRolesChanged={async () => {
                  await fetchControlPanelData(controlPanelAuthToken);
                }}
                showToast={showToast}
              />
            )}
            {activeTab === 'channels' && <ChannelsTab
              onOpenChannelModal={() => setChannelCreationModalOpen(true)}
              channels={controlPanelChannels}
              setChannels={setControlPanelChannels}
              showToast={showToast}
            />}
            {activeTab === 'tasks' && <TasksTab showToast={showToast} />}
            {activeTab === 'logs' && <LogsTab showToast={showToast} />}
            {activeTab === 'settings' && <SettingsTab showToast={showToast} />}
            {activeTab === 'storage' && <StorageTab
              showToast={showToast}
              fileViewerModal={fileViewerModal}
              setFileViewerModal={setFileViewerModal}
            />}
            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'blocked-ips' && <BlockedIPsTab showToast={showToast} />}
          </div>
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



