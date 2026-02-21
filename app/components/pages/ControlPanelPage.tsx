import { Link } from "react-router";
import { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  Shield,
  Users,
  Hash,
  CheckSquare,
  Settings,
  Folder,
  Lock,
  CircleX,
  FileText,
  Mic
} from "lucide-react";
import { ChannelCreationModal } from "../../components/ChannelCreationModal";
import { TasksTab, StorageTab, OverviewTab, MembersTab, ChannelsTab, SettingsTab, SecurityTab, BlockedIPsTab, LogsTab, ModerationTab } from "../control-panel/ControlPanelTabs";
import { getAuthTokenFromCookies, listUsers, type ListUsersResponse } from "../../services/user";
import { listChannels, createChannel } from "../../services/channel";
import { logger } from "../../utils/logger";
import type { Channel } from "../../models";

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

export default function ControlPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'members' | 'channels' | 'tasks' | 'logs' | 'settings' | 'storage' | 'security' | 'blocked-ips'>('overview');
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Channels state for the control panel
  const [controlPanelChannels, setControlPanelChannels] = useState<Channel[]>([]);

  // Users state for the control panel
  const [controlPanelUsers, setControlPanelUsers] = useState<ListUsersResponse['users']>([]);

  // FileViewerModal state
  const [fileViewerModal, setFileViewerModal] = useState<{
    isOpen: boolean;
    file: StorageFile | null;
  }>({ isOpen: false, file: null });

  // Toast notifications - replace browser alerts
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ isOpen: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => setToast({ isOpen: false, message: '', type: 'success' }), 3000);
  };

  // Fetch channels and users for control panel
  useEffect(() => {
    const fetchData = async () => {
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) {
        logger.ui.error("No auth token available for control panel data fetching");
        setIsLoading(false);
        return;
      }

      try {
        logger.ui.info("Fetching control panel data with auth token", { tokenPresent: !!authToken });

        // Fetch channels
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

        // Fetch users
        const usersResponse = await listUsers(authToken);
        if (usersResponse.success && usersResponse.data?.users) {
          setControlPanelUsers(usersResponse.data.users);
          logger.ui.info("Users fetched successfully for control panel", {
            count: usersResponse.data.users.length,
            usernames: usersResponse.data.users.slice(0, 5).map(u => u.username) // Show first 5 users
          });
        } else {
          logger.ui.error("Failed to fetch users for control panel", {
            error: usersResponse.error,
            authTokenPresent: !!authToken
          });
          setControlPanelUsers([]);
        }
      } catch (error) {
        logger.ui.error("Unexpected error fetching control panel data", { error });
        setControlPanelChannels([]);
        setControlPanelUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCreateChannel = async (channelData: { name: string; type: 'text' | 'voice'; description?: string; isPrivate?: boolean }) => {
    console.log("🔍 handleCreateChannel called with:", channelData);

    try {
      const authToken = getAuthTokenFromCookies() || '';
      console.log("🔍 Auth token present:", !!authToken);

      if (!authToken) {
        console.error("❌ No auth token available for channel creation");
        showToast('Authentication error: Please log in again.', 'error');
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

        // Show success toast
        showToast(`Channel #${channelData.name} created successfully!`, 'success');

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
          showToast('Channel name already exists, please choose a different name.', 'error');
        } else if (response.error?.includes('403') || response.error?.includes('Access denied')) {
          showToast('Access denied. Only admins and moderators can create channels.', 'error');
        } else {
          showToast(`Failed to create channel: ${response.error || 'Unknown error'}`, 'error');
        }
        logger.ui.error("Failed to create channel from control panel", { error: response.error, channelData });
      }
    } catch (error) {
      showToast('An unexpected error occurred while creating the channel.', 'error');
      logger.ui.error("Unexpected error creating channel from control panel", { error, channelData });
    }
  };

  // Show skeleton loading state
  if (isLoading) {
    return (
      <>
        <div className="pb-theme-scope h-screen bg-[var(--color-background)] flex font-sans select-none relative overflow-hidden">
          {/* Nord-themed Sidebar Skeleton */}
          <div className="w-64 bg-[var(--color-background-secondary)] border-r border-[var(--color-border)] flex flex-col">
            {/* Server Branding Header Skeleton */}
            <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 bg-[var(--color-background-tertiary)]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                <div className="h-4 bg-gray-600 rounded w-32"></div>
              </div>
              <div className="ml-auto">
                <div className="w-6 h-6 bg-gray-600 rounded"></div>
              </div>
            </div>

            {/* Navigation Section Skeleton */}
            <div className="flex-1 overflow-y-auto py-3">
              <div className="px-2">
                {/* Overview/Dashboard Section */}
                <div className="mb-6">
                  <div className="px-4 py-2 mb-2">
                    <div className="h-4 bg-gray-600 rounded w-24"></div>
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: 1 }).map((_, i) => (
                      <div key={`overview-${i}`} className="px-3 py-2 rounded-md">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-gray-600 rounded"></div>
                          <div className="h-4 bg-gray-600 rounded w-20"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Management Section */}
                <div className="mb-6">
                  <div className="px-4 py-2 mb-2">
                    <div className="h-4 bg-gray-600 rounded w-40"></div>
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={`management-${i}`} className="px-3 py-2 rounded-md">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-gray-600 rounded"></div>
                          <div className="h-4 bg-gray-600 rounded w-16"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Configuration Section */}
                <div className="mb-6">
                  <div className="px-4 py-2 mb-2">
                    <div className="h-4 bg-gray-600 rounded w-44"></div>
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={`config-${i}`} className="px-3 py-2 rounded-md">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-gray-600 rounded"></div>
                          <div className="h-4 bg-gray-600 rounded w-18"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security Section */}
                <div className="mb-6">
                  <div className="px-4 py-2 mb-2">
                    <div className="h-4 bg-gray-600 rounded w-32"></div>
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={`security-${i}`} className="px-3 py-2 rounded-md">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-gray-600 rounded"></div>
                          <div className="h-4 bg-gray-600 rounded w-20"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Back to Dashboard Button Skeleton */}
            <div className="m-2 p-2">
              <div className="hover:bg-gray-700 rounded-lg transition-all duration-200 flex items-center space-x-3 text-gray-300 cursor-pointer p-2">
                <div className="w-5 h-5 ml-3">
                  <div className="w-5 h-5 bg-gray-600 rounded"></div>
                </div>
                <div className="h-4 bg-gray-600 rounded w-28"></div>
              </div>
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="flex-1 flex flex-col bg-[var(--color-background)] overflow-hidden">
            {/* Header Skeleton */}
            <div className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-6 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <div className="h-4 bg-gray-600 rounded w-40"></div>
              </div>
              <div className="ml-auto">
                <div className="h-6 bg-gray-600 rounded w-12 px-2 py-1"></div>
              </div>
            </div>

            {/* Content Area Skeleton */}
            <div className="flex-1 p-6 overflow-y-auto bg-[var(--color-background)]">
              {/* Server Information Card Skeleton */}
              <div className="bg-gray-700 rounded-lg p-6 border border-gray-600 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 bg-gray-600 rounded w-32"></div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <div className="h-4 bg-gray-600 rounded w-12"></div>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-gray-600 rounded-xl"></div>
                    <div className="flex-1">
                      <div className="h-6 bg-gray-600 rounded w-48 mb-2"></div>
                      <div className="h-4 bg-gray-600 rounded w-64 mb-3"></div>
                      <div className="flex items-center space-x-4">
                        <div className="h-4 bg-gray-600 rounded w-20"></div>
                        <div className="h-4 bg-gray-600 rounded w-4"></div>
                        <div className="h-4 bg-gray-600 rounded w-24"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Server Statistics Cards Skeleton */}
              <div className="bg-gray-700 rounded-lg p-6 border border-gray-600 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="h-4 bg-gray-600 rounded w-36"></div>
                  <div className="flex space-x-2">
                    <div className="px-4 py-2 bg-gray-600 rounded-lg">
                      <div className="h-4 bg-gray-500 rounded w-12"></div>
                    </div>
                    <div className="px-4 py-2 bg-gray-800 rounded-lg">
                      <div className="h-4 bg-gray-500 rounded w-10"></div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Key Metrics Skeleton */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="h-4 bg-gray-600 rounded mb-2 w-20"></div>
                            <div className="h-8 bg-gray-600 rounded w-12"></div>
                          </div>
                          <div className="w-8 h-8 bg-gray-600 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detailed Stats Grid Skeleton */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center mb-3">
                          <div className="w-5 h-5 bg-gray-600 rounded mr-2"></div>
                          <div className="h-4 bg-gray-600 rounded w-24"></div>
                        </div>
                        {i === 2 ? (
                          <div>
                            <div className="h-6 bg-gray-600 rounded mb-2"></div>
                            <div className="w-full bg-gray-600 rounded-full h-2"></div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <div className="h-6 bg-gray-600 rounded mb-1"></div>
                              <div className="h-3 bg-gray-600 rounded"></div>
                            </div>
                            <div className="text-center">
                              <div className="h-6 bg-gray-600 rounded mb-1"></div>
                              <div className="h-3 bg-gray-600 rounded"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Additional Stats Skeleton */}
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <div className="w-5 h-5 bg-gray-600 rounded mr-2"></div>
                      <div className="h-4 bg-gray-600 rounded w-32"></div>
                    </div>
                    <div className="text-center">
                      <div className="h-6 bg-gray-600 rounded mb-1 w-8 mx-auto"></div>
                      <div className="h-3 bg-gray-600 rounded w-32 mx-auto"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Skeleton */}
              <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                <div className="h-4 bg-gray-600 rounded mb-4 w-32"></div>
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg">
                      <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-600 rounded mb-1 w-24"></div>
                        <div className="h-3 bg-gray-600 rounded w-32"></div>
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-6 h-6" /> },
    { id: 'moderation', label: 'Moderation', icon: <Shield className="w-6 h-6" /> },
    { id: 'members', label: 'Members', icon: <Users className="w-6 h-6" /> },
    { id: 'channels', label: 'Channels', icon: <Hash className="w-6 h-6" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-6 h-6" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-6 h-6" /> },
    { id: 'storage', label: 'Storage', icon: <Folder className="w-6 h-6" /> },
    { id: 'security', label: 'Security', icon: <Lock className="w-6 h-6" /> },
    { id: 'blocked-ips', label: 'Blocked IPs', icon: <CircleX className="w-6 h-6" /> },
    { id: 'logs', label: 'Logs', icon: <FileText className="w-6 h-6" /> },
  ];

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
              className="max-w-full max-h-96 object-contain rounded-lg shadow-lg"
            />
          </div>
        );
      } else if (fileType.startsWith('video/')) {
        return (
          <div className="flex justify-center">
            <video
              src={file.url}
              controls
              className="max-w-full max-h-96 rounded-lg shadow-lg"
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
              className="w-full h-96 border rounded-lg shadow-lg"
              title={file.filename}
            />
          </div>
        );
      } else if (content) {
        return (
          <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-auto">
            <pre className="text-gray-100 text-sm whitespace-pre-wrap break-words font-mono">
              {content}
            </pre>
          </div>
        );
      } else if (loading) {
        return (
          <div className="flex justify-center items-center py-12">
            <div className="text-center text-gray-400">
              <div className="w-8 h-8 animate-spin border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center space-x-2"
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
      <div className="pb-theme-scope fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700">
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div>
              <h3 className="text-lg font-semibold text-white truncate max-w-md">{file.filename}</h3>
              <p className="text-gray-400 text-sm mt-1">
                {formatFileSize(file.size)} • {file.type} •
                Uploaded {new Date(file.uploaded_at).toLocaleDateString()} by {file.uploader}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-full">
            {renderFileContent()}
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t border-gray-700 bg-gray-750">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Close
            </button>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download</span>
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="pb-theme-scope h-screen bg-[var(--color-background)] flex font-sans select-none relative overflow-hidden">
        {/* Nord-themed Sidebar */}
        <div className="w-64 bg-[var(--color-background-secondary)]/80 backdrop-blur-xl border-r border-[var(--color-border)]/50 flex flex-col shadow-2xl">
          {/* Server Branding Header */}
          <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 bg-[var(--color-background-tertiary)]">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[var(--color-accent)] rounded-full flex items-center justify-center font-bold text-[var(--color-background)]">
                P
              </div>
              <span className="text-[var(--color-text)] font-semibold text-sm">Server Control Panel</span>
            </div>
            <div className="ml-auto">
              <span className="bg-[var(--color-error)] text-white text-xs px-1.5 py-0.5 rounded-full font-bold">HOST</span>
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
                {tabs.slice(0, 1).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full px-3 py-2 mb-1 rounded-md flex items-center space-x-3 transition-all duration-200 cursor-pointer text-left ${activeTab === tab.id
                        ? 'bg-[var(--color-active)] text-[var(--color-text)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                      }`}
                  >
                    <div className={`${activeTab === tab.id ? 'text-[var(--color-primary)]' : ''} transition-colors`}>
                      {tab.icon}
                    </div>
                    <span className="font-medium text-sm">{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="ml-auto w-1 h-6 bg-[var(--color-primary)] rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>

              {/* Management Section */}
              <div className="mb-6">
                <div className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Community Management
                </div>
                {tabs.slice(1, 4).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full px-3 py-2 mb-1 rounded-md flex items-center space-x-3 transition-all duration-200 cursor-pointer text-left ${activeTab === tab.id
                        ? 'bg-[var(--color-active)] text-[var(--color-text)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                      }`}
                  >
                    <div className={`${activeTab === tab.id ? 'text-[var(--color-primary)]' : ''} transition-colors`}>
                      {tab.icon}
                    </div>
                    <span className="font-medium text-sm">{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="ml-auto w-1 h-6 bg-[var(--color-primary)] rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>

              {/* Configuration Section */}
              <div className="mb-6">
                <div className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Server Configuration
                </div>
                {tabs.slice(4, 7).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full px-3 py-2 mb-1 rounded-md flex items-center space-x-3 transition-all duration-200 cursor-pointer text-left ${activeTab === tab.id
                        ? 'bg-[var(--color-active)] text-[var(--color-text)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                      }`}
                  >
                    <div className={`${activeTab === tab.id ? 'text-[var(--color-primary)]' : ''} transition-colors`}>
                      {tab.icon}
                    </div>
                    <span className="font-medium text-sm">{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="ml-auto w-1 h-6 bg-[var(--color-primary)] rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>

              {/* Security Section */}
              <div className="mb-6">
                <div className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Security & Advanced
                </div>
                {tabs.slice(7).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full px-3 py-2 mb-1 rounded-md flex items-center space-x-3 transition-all duration-200 cursor-pointer text-left ${activeTab === tab.id
                        ? 'bg-[var(--color-active)] text-[var(--color-text)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                      }`}
                  >
                    <div className={`${activeTab === tab.id ? 'text-[var(--color-primary)]' : ''} transition-colors`}>
                      {tab.icon}
                    </div>
                    <span className="font-medium text-sm">{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="ml-auto w-1 h-6 bg-[var(--color-primary)] rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Back to Dashboard Button */}
          <Link
            to="/dashboard"
            className="m-2 p-2 hover:bg-[var(--color-hover)] rounded-lg transition-all duration-200 flex items-center space-x-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer"
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
        <div className="flex-1 flex flex-col bg-[var(--color-background)]/80 backdrop-blur-xl overflow-hidden shadow-2xl border-l border-[var(--color-border)]/50">
          {/* Header */}
          <div className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-6 flex-shrink-0">
            <div className="flex items-center space-x-4">
              <h1 className="text-[var(--color-text)] font-semibold text-base">
                {tabs.find(tab => tab.id === activeTab)?.label}
              </h1>
            </div>
            <div className="ml-auto">
              <span className="bg-[var(--color-error)] text-[var(--color-background)] text-xs px-2 py-1 rounded-full font-bold">HOST</span>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-[var(--color-background)]">
            {activeTab === 'overview' && <OverviewTab onSettingsClick={() => setActiveTab('settings')} />}
            {activeTab === 'moderation' && <ModerationTab showToast={showToast} />}
            {activeTab === 'members' && <MembersTab users={controlPanelUsers} showToast={showToast} />}
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
