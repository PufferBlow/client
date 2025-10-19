import { Link } from "react-router";
import { useState, useEffect, useRef } from "react";
import { ChannelCreationModal } from "../components/ChannelCreationModal";
import { getAuthTokenFromCookies, listUsers, type ListUsersResponse } from "../services/user";
import { listChannels, deleteChannel, createChannel } from "../services/channel";
import {
  getUserRegistrationsChart,
  getMessageActivityChart,
  getOnlineUsersChart,
  getChannelCreationChart,
  getUserStatusChart,
  getServerInfo,
  updateServerInfo,
  uploadServerAvatar,
  uploadServerBanner,
  getRecentActivity,
  getServerUsage,
  getActivityMetrics,
  getServerOverview,
  getServerLogs,
  clearServerLogs,
  type Period,
  type ChartData,
  type RawStats,
  type ServerUsage,
  type ActivityMetrics,
  type ServerOverview
} from "../services/system";
import { convertToFullCdnUrl, listBlockedIPs, blockIP, unblockIP } from "../services/apiClient";
import { logger } from "../utils/logger";
import type { Channel } from "../models";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

export function meta() {
  return [
    { title: "Server Control Panel - Pufferblow" },
    { name: "description", content: "Manage and configure your server settings" },
  ];
}

// CDN File interface
type CDNFile = {
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
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'members' | 'channels' | 'tasks' | 'logs' | 'settings' | 'cdn' | 'security' | 'blocked-ips'>('overview');
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Channels state for the control panel
  const [controlPanelChannels, setControlPanelChannels] = useState<Channel[]>([]);

  // Users state for the control panel
  const [controlPanelUsers, setControlPanelUsers] = useState<ListUsersResponse['users']>([]);

  // FileViewerModal state
  const [fileViewerModal, setFileViewerModal] = useState<{
    isOpen: boolean;
    file: CDNFile | null;
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
        is_private: channelData.isPrivate || false
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
        <div className="h-screen bg-[var(--color-background)] flex font-sans select-none relative overflow-hidden">
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
    {
      id: 'overview', label: 'Overview', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'moderation', label: 'Moderation', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      id: 'members', label: 'Members', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    },
    {
      id: 'channels', label: 'Channels', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 01-9 9H9l-6 3V9a9 9 0 019-9h3a9 9 0 019 9z" />
        </svg>
      )
    },
    {
      id: 'tasks', label: 'Tasks', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    {
      id: 'settings', label: 'Settings', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: 'cdn', label: 'CDN', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'security', label: 'Security', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      id: 'blocked-ips', label: 'Blocked IPs', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: 'logs', label: 'Logs', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
  ];

  // FileViewerModal Component
  const FileViewerModal = ({ isOpen, file, onClose }: { isOpen: boolean; file: CDNFile | null; onClose: () => void }) => {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (isOpen && file) {
        loadFileContent(file);
      }
    }, [isOpen, file]);

    const loadFileContent = async (file: CDNFile) => {
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
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
      <div className="h-screen bg-[var(--color-background)] flex font-sans select-none relative overflow-hidden">
        {/* Nord-themed Sidebar */}
        <div className="w-64 bg-[var(--color-background-secondary)] border-r border-[var(--color-border)] flex flex-col">
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
        <div className="flex-1 flex flex-col bg-[var(--color-background)] overflow-hidden">
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
            {activeTab === 'cdn' && <CDNTab
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

function TasksTab({
  showToast
}: {
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [tasks, setTasks] = useState([
    {
      id: '1',
      name: 'Daily Backup',
      description: 'Automatically backup the database every day at midnight',
      script: 'backup.py',
      isEnabled: true,
      isManual: false,
      lastRun: '2024-01-16T02:00:00Z',
      schedule: 'Daily at 00:00',
      status: 'running'
    },
    {
      id: '2',
      name: 'User Activity Report',
      description: 'Generate weekly user activity statistics',
      script: 'user_reports.py',
      isEnabled: true,
      isManual: true,
      lastRun: '2024-01-14T09:30:00Z',
      schedule: 'On Demand',
      status: 'idle'
    },
    {
      id: '3',
      name: 'Database Cleanup',
      description: 'Remove old logs and temporary files',
      script: 'cleanup.py',
      isEnabled: false,
      isManual: false,
      lastRun: '2024-01-10T23:00:00Z',
      schedule: 'Weekly on Sunday',
      status: 'disabled'
    },
    {
      id: '4',
      name: 'Spam Detection Training',
      description: 'Update AI spam detection models with new data',
      script: 'spam_train.py',
      isEnabled: true,
      isManual: true,
      lastRun: '2024-01-15T18:15:00Z',
      schedule: 'On Demand',
      status: 'idle'
    }
  ]);

  const handleToggleTask = (taskId: string) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, isEnabled: !task.isEnabled, status: task.isEnabled ? 'disabled' : 'idle' }
        : task
    ));
    showToast('Task status updated successfully!', 'success');
  };

  const handleRunTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: 'running' } : t
    ));

    // Simulate running the task
    setTimeout(() => {
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'completed', lastRun: new Date().toISOString() }
          : t
      ));
      showToast(`Task "${task.name}" completed successfully!`, 'success');
    }, 3000);
  };

  const statusColors = {
    idle: 'text-gray-400',
    running: 'text-green-400',
    completed: 'text-blue-400',
    disabled: 'text-red-400',
    error: 'text-red-500'
  };

  const statusIcons = {
    idle: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    running: (
      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    completed: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    disabled: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-white">Automated Tasks</h2>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            Add New Task
          </button>
        </div>

        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium text-white">{task.name}</h3>
                    <span className={`flex items-center space-x-1 text-sm ${statusColors[task.status as keyof typeof statusColors]}`}>
                      {statusIcons[task.status as keyof typeof statusIcons]}
                      <span>{task.status}</span>
                    </span>
                    {task.isManual ? (
                      <span className="px-2 py-1 rounded text-xs bg-blue-600 text-white">Manual</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-green-600 text-white">Scheduled</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{task.description}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Script: {task.script}</span>
                    <span>Schedule: {task.schedule}</span>
                    <span>Last Run: {new Date(task.lastRun).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={task.isEnabled}
                      onChange={() => handleToggleTask(task.id)}
                      className="rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">Enabled</span>
                  </label>
                </div>

                <div className="flex space-x-2">
                  {task.isManual && task.isEnabled && (
                    <button
                      onClick={() => handleRunTask(task.id)}
                      disabled={task.status === 'running'}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center space-x-1"
                    >
                      {task.status === 'running' ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Running...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>Run Now</span>
                        </>
                      )}
                    </button>
                  )}
                  <button className="text-gray-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-500/30">
          <h3 className="text-lg font-medium text-white mb-2">About Automated Tasks</h3>
          <p className="text-gray-400 text-sm">
            Tasks are Python scripts that run scheduled operations for server maintenance, reporting, or automation.
            You can enable/disable automatic execution or run tasks manually. Scripts should be placed in the server's
            tasks directory and follow the established API conventions.
          </p>
        </div>
      </div>
    </div>
  );
}

// CDN Tab Component
// CDN Tab Component
function CDNTab({
  showToast,
  fileViewerModal,
  setFileViewerModal
}: {
  showToast: (message: string, type: 'success' | 'error') => void;
  fileViewerModal: { isOpen: boolean; file: CDNFile | null };
  setFileViewerModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; file: CDNFile | null }>>;
}) {
  const [files, setFiles] = useState<CDNFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState('uploads');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<CDNFile | null>(null);
  const [isCleaningOrphaned, setIsCleaningOrphaned] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isDeletingFile, setIsDeletingFile] = useState(false);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const authToken = getAuthTokenFromCookies() || '';

    if (!authToken) {
      showToast('Authentication token not found', 'error');
      setIsUploading(false);
      return;
    }

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Basic validation
        const maxSizeMB = 10; // 10MB limit
        const allowedTypes = [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp3',
          'application/pdf', 'text/plain', 'application/zip'
        ];

        if (file.size > maxSizeMB * 1024 * 1024) {
          throw new Error(`File "${file.name}" is too large. Maximum size: ${maxSizeMB}MB`);
        }

        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File type "${file.type}" is not allowed`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('directory', selectedDirectory);

        // Create a unique ID for this file's progress
        const fileId = Date.now() + '_' + Math.random();

        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

        const response = await fetch(`/api/v1/cdn/upload?auth_token=${authToken}`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
          return { success: true, file };
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || `Upload failed for "${file.name}"`);
        }
      });

      const results = await Promise.allSettled(uploadPromises);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        showToast(`Uploaded ${successful} files, ${failed} failed`, successful > 0 ? 'error' : 'error');
      } else {
        showToast(`Successfully uploaded ${successful} file${successful > 1 ? 's' : ''}!`, 'success');
      }

      // Refresh the file list after upload
      await loadFiles();

      // Clear progress after a short delay
      setTimeout(() => setUploadProgress({}), 2000);

    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    handleFileUpload(files);
    // Clear the input after handling
    event.target.value = '';
  };

  // CDN File interface
  type CDNFile = {
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

  useEffect(() => {
    loadFiles();
  }, [selectedDirectory]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) {
        setError('Authentication token not found');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/v1/cdn/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_token: authToken,
          directory: selectedDirectory
        })
      });

      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load files');
        setFiles([]);
      }
    } catch (err) {
      setError('Network error occurred');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (file: CDNFile) => {
    try {
      const authToken = getAuthTokenFromCookies() || '';

      const response = await fetch('/api/v1/cdn/delete-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_token: authToken,
          file_url: file.url
        })
      });

      if (response.ok) {
        setFiles(prev => prev.filter(f => f !== file));
        showToast(`File "${file.filename}" deleted successfully!`, 'success');
        setDeleteConfirmFile(null);
      } else {
        const errorData = await response.json();
        showToast(`Failed to delete file: ${errorData.error}`, 'error');
      }
    } catch (err) {
      showToast('Network error occurred while deleting file', 'error');
    }
  };

  const handleCleanupOrphanedFiles = async () => {
    setIsCleaningOrphaned(true);

    try {
      const authToken = getAuthTokenFromCookies() || '';

      const response = await fetch('/api/v1/cdn/cleanup-orphaned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_token: authToken,
          subdirectory: selectedDirectory // Use current selected directory
        })
      });

      if (response.ok) {
        const data = await response.json();
        showToast(`Cleaned up ${data.deleted_count} orphaned files`, 'success');
        loadFiles(); // Refresh the list
      } else {
        const errorData = await response.json();
        showToast(`Cleanup failed: ${errorData.error}`, 'error');
      }
    } catch (err) {
      showToast('Network error occurred during cleanup', 'error');
    } finally {
      setIsCleaningOrphaned(false);
    }
  };

  const filteredFiles = files.filter(file =>
    file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Directory selector options
  const directories = [
    { value: 'uploads', label: 'Uploads' },
    { value: 'avatars', label: 'Avatars' },
    { value: 'banners', label: 'Banners' },
    { value: 'attachments', label: 'Attachments' },
    { value: 'stickers', label: 'Stickers' },
    { value: 'all', label: 'All Files' }
  ];

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🔊';
    if (type === 'application/pdf') return '📄';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    return '📄';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-600 rounded w-48"></div>
            <div className="h-32 bg-gray-600 rounded"></div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-600 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="text-center text-red-400 py-8">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Error Loading CDN Files</h3>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={loadFiles}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CDN Statistics Header */}
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-white">CDN File Manager</h2>
            <p className="text-gray-400 text-sm mt-1">Manage uploaded files and attachments</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleCleanupOrphanedFiles}
              disabled={isCleaningOrphaned}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm"
            >
              {isCleaningOrphaned ? (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{isCleaningOrphaned ? 'Cleaning...' : 'Clean Orphaned'}</span>
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">Total Files</div>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white">{files.length.toLocaleString()}</div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">Total Size</div>
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatFileSize(files.reduce((total, file) => total + file.size, 0))}
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">Image Files</div>
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white">
              {files.filter(f => f.type && f.type.startsWith('image/')).length.toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">Orphaned Files</div>
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-white">
              {files.filter(f => f.is_orphaned).length.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <h2 className="text-lg font-medium text-white mb-6">Upload Files</h2>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Upload Zone */}
          <div className="flex-1">
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 transition-colors hover:border-blue-400 hover:bg-gray-750/30">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h3 className="text-lg font-medium text-white mb-2">Upload Files to CDN</h3>
                <p className="text-gray-400 mb-4">Drop files here or click to browse</p>

                {/* Directory selection for upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Upload to:</label>
                  <select
                    value={selectedDirectory}
                    onChange={(e) => setSelectedDirectory(e.target.value)}
                    className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 mx-auto block"
                  >
                    {directories.slice(0, -1).map(dir => (
                      <option key={dir.value} value={dir.value}>{dir.label}</option>
                    ))}
                  </select>
                </div>

                <input
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  accept="image/*,video/*,audio/*,application/pdf,text/plain,application/zip"
                  className="hidden"
                  id="cdn-file-upload"
                />
                <label
                  htmlFor="cdn-file-upload"
                  className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors inline-flex items-center space-x-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  style={{ pointerEvents: isUploading ? 'none' : 'auto' }}
                >
                  {isUploading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Select Files</span>
                    </>
                  )}
                </label>
              </div>

              {/* Upload Progress */}
              {Object.keys(uploadProgress).length > 0 && (
                <div className="mt-6 space-y-2">
                  {Object.entries(uploadProgress).map(([fileId, progress]) => (
                    <div key={fileId} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Uploading...</span>
                        <span className="text-sm text-white">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* File Type Information */}
            <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
              <h4 className="text-sm font-medium text-white mb-2">Supported File Types:</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                <div>• Images (PNG, JPG, GIF, WebP)</div>
                <div>• Videos (MP4, WebM)</div>
                <div>• Audio (MP3, MP4)</div>
                <div>• Documents (PDF, TXT)</div>
                <div>• Archives (ZIP)</div>
                <div>• Max size: 10MB per file</div>
              </div>
            </div>
          </div>

          {/* Quick Upload Buttons */}
          <div className="lg:w-64 space-y-3">
            <h3 className="text-sm font-medium text-white mb-3">Quick Upload:</h3>

            <button
              onClick={() => document.getElementById('cdn-file-upload')?.click()}
              disabled={isUploading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-start space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>Upload Files</span>
            </button>

            {/* Batch Upload Info */}
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-gray-300">Batch Upload</span>
              </div>
              <p className="text-xs text-gray-400">
                Select multiple files to upload them all at once to the current directory.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Directory and Search Controls */}
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          {/* Directory Selector */}
          <div className="flex items-center space-x-3">
            <label className="text-white font-medium">Directory:</label>
            <select
              value={selectedDirectory}
              onChange={(e) => setSelectedDirectory(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              {directories.map(dir => (
                <option key={dir.value} value={dir.value}>{dir.label}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* File List */}
        {filteredFiles.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2">
              {files.length === 0 ? `No files found in ${selectedDirectory}` : 'No files match your search'}
            </p>
            <p className="text-gray-500 text-sm">
              {files.length === 0 ? 'Files will appear here once uploaded' : 'Try adjusting your search terms'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors"
              >
                {/* File Info */}
                <div className="flex items-center space-x-4 flex-1">
                  {/* File Icon */}
                  <div className="w-10 h-10 flex items-center justify-center text-lg">
                    {getFileTypeIcon(file.type || 'unknown')}
                  </div>

                  {/* File Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-white font-medium truncate">{file.filename}</h4>
                      {file.is_orphaned && (
                        <span className="px-2 py-1 bg-red-600 text-white text-xs rounded font-medium">
                          Orphaned
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{file.type}</span>
                      <span>•</span>
                      <span>Uploaded {new Date(file.uploaded_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>by {file.uploader}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFileViewerModal({ isOpen: true, file });
                    }}
                    className="text-gray-400 hover:text-blue-400 transition-colors p-2"
                    title="View file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => setDeleteConfirmFile(file)}
                    className="text-gray-400 hover:text-red-400 transition-colors p-2"
                    title="Delete file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete File Confirmation Modal */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)]/95 backdrop-blur-md rounded-xl w-full max-w-md mx-auto shadow-2xl border border-[var(--color-border)]">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--color-text)]">Delete File</h3>
                <button
                  onClick={() => setDeleteConfirmFile(null)}
                  className="text-gray-400 hover:text-white transition-colors p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* File Info */}
              <div className="bg-[var(--color-background-secondary)] rounded-lg p-4 mb-6 border border-[var(--color-border)]">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center text-lg bg-[var(--color-surface-tertiary)] rounded-lg">
                    {getFileTypeIcon(deleteConfirmFile.type || 'unknown')}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[var(--color-text)] font-medium truncate">{deleteConfirmFile.filename}</h4>
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      {formatFileSize(deleteConfirmFile.size)} • {deleteConfirmFile.type}
                    </div>
                  </div>
                </div>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Uploaded {new Date(deleteConfirmFile.uploaded_at).toLocaleDateString()} by {deleteConfirmFile.uploader}
                </p>
              </div>

              {/* Warning Message */}
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-sm">
                    <h4 className="text-red-400 font-medium mb-1">Permanently Delete File</h4>
                    <p className="text-gray-300">
                      This action cannot be undone. The file will be permanently removed from the CDN and cannot be recovered.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteConfirmFile(null)}
                  className="px-4 py-2 text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteFile(deleteConfirmFile)}
                  className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Overview Tab Component
function RecentActivity() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfileModal, setUserProfileModal] = useState<{
    isOpen: boolean;
    user: any;
    position?: { x: number; y: number };
    triggerRect?: DOMRect | null;
  }>({ isOpen: false, user: null });

  const fetchRecentActivity = async () => {
    const authToken = getAuthTokenFromCookies() || '';

    if (!authToken) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      const response = await getRecentActivity(authToken, 10);
      if (response.success && response.data) {
        // Transform API data to component format
        const formattedActivities = (response.data.activities || []).map((activity: any) => ({
          id: activity.id,
          type: activity.type,
          title: activity.title,
          description: activity.description || '',
          timestamp: activity.timestamp,
          user: activity.user || null,
          metadata: activity.metadata || {}
        }));
        setActivities(formattedActivities);
        setError(null); // Clear any previous error
      } else {
        setError('Failed to load recent activity');
      }
    } catch (err) {
      setError('Failed to fetch recent activity');
      logger.api.error('Failed to fetch recent activity', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivity();

    // Set up automatic refresh every 30 seconds for real-time data
    const interval = setInterval(() => {
      fetchRecentActivity();
    }, 30000); // 30 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  // Extract username from activity description for server settings updates
  const parseActivityDescription = (activity: any) => {
    const description = activity.description || activity.title || '';

    // Check if it's a server settings update description
    if (description.includes('updated') && description.includes('to')) {
      // Look for patterns like "User updated server settings" or "server_settings_updated by username"
      const match = description.match(/updated by (\w+): (.+ changed to .+)/) ||
        description.match(/(\w+) changed (.+)/);

      if (match) {
        const username = match[1];
        const action = match[2] || description.replace(`by ${username}: `, '');

        return {
          username,
          action,
          userId: activity.user?.id || activity.metadata?.user_id
        };
      }
    }

    return {
      username: null,
      action: description,
      userId: activity.user?.id
    };
  };

  const handleUsernameClick = (username: string, userId: string | undefined, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!username || !userId) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Mock user data for display
    const user = {
      id: userId,
      username: username,
      avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}&backgroundColor=5865f2`,
      status: 'online' as const, // Mock status
      bio: `${username} performed this server action`,
      joinedAt: '2023-01-15', // Mock join date
      roles: ['Admin', 'Owner'] // Mock roles for server setting changers
    };

    // Position the modal relative to the clicked username
    const position = {
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 5
    };

    setUserProfileModal({
      isOpen: true,
      user,
      position,
      triggerRect: rect
    });
  };

  const handleCloseUserProfile = () => {
    setUserProfileModal({ isOpen: false, user: null });
  };

  if (loading) {
    return (
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <h2 className="text-[var(--color-text)] font-semibold mb-4">Recent Activity</h2>
        <div className="animate-pulse space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-[var(--color-background-secondary)] rounded-lg">
            <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-600 rounded mb-1 w-24"></div>
              <div className="h-3 bg-gray-600 rounded w-32"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <h2 className="text-[var(--color-text)] font-semibold mb-4">Recent Activity</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-center text-red-400">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
      <h2 className="text-[var(--color-text)] font-semibold mb-4">Recent Activity</h2>
      {activities.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center text-[var(--color-text-secondary)]">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No recent activity</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity: any) => {
            // Map activity types to colors and icons
            const getActivityStyle = (type: string) => {
              switch (type) {
                case 'user_joined':
                  return { color: 'var(--color-success)', icon: '👤' };
                case 'channel_created':
                  return { color: 'var(--color-primary)', icon: '📝' };
                case 'moderation':
                  return { color: 'var(--color-warning)', icon: '⚠️' };
                case 'message_sent':
                  return { color: 'var(--color-text-secondary)', icon: '💬' };
                case 'setting_changed':
                  return { color: 'var(--color-error)', icon: '⚙️' };
                case 'file_upload':
                  return { color: 'var(--color-success)', icon: '📁' };
                default:
                  return { color: 'var(--color-text-secondary)', icon: '📌' };
              }
            };

            const style = getActivityStyle(activity.type);

            // Parse activity description for clickable username
            const parsedDesc = parseActivityDescription(activity);

            return (
              <div key={activity.id} className="flex items-center space-x-3 p-3 bg-[var(--color-background-secondary)] rounded-lg hover:bg-[var(--color-hover)] transition-all duration-200 cursor-pointer">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: style.color }}
                >
                  {style.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-[var(--color-text)]">{activity.title}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    {parsedDesc.username && parsedDesc.userId ? (
                      <span>
                        <span
                          onClick={(e) => handleUsernameClick(parsedDesc.username, parsedDesc.userId, e)}
                          className="text-blue-500 font-semibold hover:text-blue-400 underline decoration-2 decoration-blue-500 hover:decoration-blue-400 cursor-pointer transition-colors select-none bg-blue-50 dark:bg-blue-900/30 px-1 rounded"
                          title={`Click to view ${parsedDesc.username}'s profile`}
                        >
                          @{parsedDesc.username}
                        </span>
                        {' '}
                        {parsedDesc.action.replace(parsedDesc.username, '').replace('updated by ', '').replace('changed ', 'changed ').replace(' by ', '')}
                      </span>
                    ) : (
                      parsedDesc.action || activity.description
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User Profile Modal */}
      {userProfileModal.isOpen && (
        <UserProfileModal
          isOpen={true}
          onClose={handleCloseUserProfile}
          user={userProfileModal.user}
          currentUserId="user_current_admin"
          position={userProfileModal.position}
          triggerRect={userProfileModal.triggerRect}
        />
      )}
    </div>
  );
}

function OverviewTab({ onSettingsClick }: { onSettingsClick: () => void }) {
  const [viewMode, setViewMode] = useState<'numbers' | 'diagram'>('numbers');
  const [bannerExpanded, setBannerExpanded] = useState(false);
  const [chartData, setChartData] = useState<{
    userRegistrations?: ChartData;
    messageActivity?: ChartData;
    onlineUsers?: ChartData;
    channelCreation?: ChartData;
    userStatus?: ChartData;
  }>({});
  const [rawStats, setRawStats] = useState<{
    userRegistrations?: RawStats;
    messageActivity?: RawStats;
    onlineUsers?: RawStats;
    channelCreation?: RawStats;
    userStatus?: RawStats;
  }>({});
  const [serverUsage, setServerUsage] = useState<ServerUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>({ period: '7d' });
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetrics | null>(null);
  const [serverOverview, setServerOverview] = useState<ServerOverview | null>(null);

  // Load chart data and server usage
  useEffect(() => {
    const loadChartData = async () => {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        setError('Authentication token not found');
        return;
      }

      setLoading(true);
      setError(null);

      // Load activity metrics and server overview
      try {
        const [activityMetricsRes, serverOverviewRes] = await Promise.allSettled([
          getActivityMetrics(authToken),
          getServerOverview(authToken)
        ]);

        if (activityMetricsRes.status === 'fulfilled' && activityMetricsRes.value.success && activityMetricsRes.value.data) {
          setActivityMetrics(activityMetricsRes.value.data.activity_metrics);
        }

        if (serverOverviewRes.status === 'fulfilled' && serverOverviewRes.value.success && serverOverviewRes.value.data) {
          setServerOverview(serverOverviewRes.value.data.server_overview);
        }
      } catch (err) {
        console.error('Failed to load activity metrics/server overview:', err);
      }

      try {
        const [
          serverUsageRes,
          userRegistrationsRes,
          messageActivityRes,
          onlineUsersRes,
          channelCreationRes,
          userStatusRes
        ] = await Promise.allSettled([
          getServerUsage(),
          getUserRegistrationsChart(selectedPeriod, authToken),
          getMessageActivityChart(selectedPeriod, authToken),
          getOnlineUsersChart(selectedPeriod, authToken),
          getChannelCreationChart(selectedPeriod, authToken),
          getUserStatusChart(authToken)
        ]);

        // Handle server usage
        if (serverUsageRes.status === 'fulfilled') {
          if (serverUsageRes.value.success && serverUsageRes.value.data) {
            console.log('Server usage data received:', serverUsageRes.value.data.server_usage);
            setServerUsage(serverUsageRes.value.data.server_usage);
            setUsageLoading(false);
          } else {
            console.error('Server usage API failed:', serverUsageRes.value?.error);
            setUsageError('Failed to load server usage data');
            setUsageLoading(false);
          }
        } else {
          console.error('Server usage API promise rejected:', serverUsageRes.reason);
          setUsageError('Failed to load server usage data');
          setUsageLoading(false);
        }

        const newChartData: typeof chartData = {};

        // Helper function to format chart data for Chart.js
        const formatChartData = (backendData: any, chartType: string) => {
          if (!backendData || typeof backendData !== 'object') {
            return null;
          }

          // If already in Chart.js format, return as-is
          if ('labels' in backendData && 'datasets' in backendData && Array.isArray(backendData.datasets)) {
            return backendData;
          }

          // If backend returns a different format, try to transform it
          // This is a fallback for various possible backend response formats
          try {
            let labels: string[] = [];
            let data: number[] = [];

            // Handle different possible data formats from backend
            if (Array.isArray(backendData)) {
              labels = backendData.map(item => item.label || item.name || item.x || `Item ${backendData.indexOf(item) + 1}`);
              data = backendData.map(item => parseFloat(item.value || item.y || item.data || 0));
            } else if (typeof backendData === 'object') {
              // Handle object format
              labels = Object.keys(backendData).filter(key => key !== 'labels' && key !== 'datasets');
              data = Object.values(backendData).filter(val => typeof val === 'number' && !labels.includes(val as any)) as number[];
            }

            // Ensure we have valid data
            if (labels.length === 0 && data.length === 0) {
              labels = ['No Data'];
              data = [0];
            }

            // Modern color schemes based on chart type
            const getChartColors = (type: string) => {
              const palettes = {
                'Line': {
                  borderColor: 'rgb(34, 197, 94)',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  borderWidth: 2,
                  tension: 0.4,
                  fill: true,
                  pointBackgroundColor: 'rgb(34, 197, 94)',
                  pointBorderColor: '#ffffff',
                  pointBorderWidth: 2,
                  pointHoverRadius: 6,
                  pointHoverBackgroundColor: 'rgb(34, 197, 94)',
                  pointHoverBorderColor: '#ffffff',
                  pointHoverBorderWidth: 3,
                },
                'Bar': {
                  backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(147, 51, 234, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                  ],
                  borderColor: [
                    'rgb(59, 130, 246)',
                    'rgb(147, 51, 234)',
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)',
                    'rgb(239, 68, 68)',
                  ],
                  borderWidth: 0,
                  borderRadius: 4,
                  borderSkipped: false,
                },
                'Pie': {
                  backgroundColor: [
                    'rgba(59, 130, 246, 0.9)',
                    'rgba(147, 51, 234, 0.9)',
                    'rgba(16, 185, 129, 0.9)',
                    'rgba(245, 158, 11, 0.9)',
                    'rgba(239, 68, 68, 0.9)',
                    'rgba(6, 182, 212, 0.9)',
                  ],
                  borderColor: [
                    'rgb(59, 130, 246)',
                    'rgb(147, 51, 234)',
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)',
                    'rgb(239, 68, 68)',
                    'rgb(6, 182, 212)',
                  ],
                  borderWidth: 1,
                  offset: 4,
                }
              };

              return palettes[type as keyof typeof palettes] || palettes.Line;
            };

            const chartTypeCapitalized = chartType === 'userStatus' ? 'Pie' : (chartType === 'messageActivity' || chartType === 'channelCreation' ? 'Bar' : 'Line');
            const colors = getChartColors(chartTypeCapitalized);

            // Create proper Chart.js format with modern styling
            return {
              labels: labels,
              datasets: [{
                label: chartType.replace(/([A-Z])/g, ' $1').toLowerCase(),
                data: data,
                hoverOffset: chartType === 'Pie' ? 8 : 0,
                ...colors
              }]
            };

          } catch (error) {
            logger.api.error(`Failed to format chart data for ${chartType}`, { backendData, error });
            return null;
          }
        };

        const userRegistrationsData = userRegistrationsRes.status === 'fulfilled' && userRegistrationsRes.value.success && userRegistrationsRes.value.data
          ? formatChartData(userRegistrationsRes.value.data.chart_data, 'User Registrations')
          : null;
        if (userRegistrationsData) {
          newChartData.userRegistrations = userRegistrationsData;
        }

        const messageActivityData = messageActivityRes.status === 'fulfilled' && messageActivityRes.value.success && messageActivityRes.value.data
          ? formatChartData(messageActivityRes.value.data.chart_data, 'Message Activity')
          : null;
        if (messageActivityData) {
          newChartData.messageActivity = messageActivityData;
        }

        const onlineUsersData = onlineUsersRes.status === 'fulfilled' && onlineUsersRes.value.success && onlineUsersRes.value.data
          ? formatChartData(onlineUsersRes.value.data.chart_data, 'Online Users')
          : null;
        if (onlineUsersData) {
          newChartData.onlineUsers = onlineUsersData;
        }

        const channelCreationData = channelCreationRes.status === 'fulfilled' && channelCreationRes.value.success && channelCreationRes.value.data
          ? formatChartData(channelCreationRes.value.data.chart_data, 'Channel Creation')
          : null;
        if (channelCreationData) {
          newChartData.channelCreation = channelCreationData;
        }

        const userStatusData = userStatusRes.status === 'fulfilled' && userStatusRes.value.success && userStatusRes.value.data
          ? formatChartData(userStatusRes.value.data.chart_data, 'User Status')
          : null;
        if (userStatusData) {
          newChartData.userStatus = userStatusData;
        }

        setChartData(newChartData);

        // Check if any requests failed and set appropriate error
        const failedRequests = [
          serverUsageRes,
          userRegistrationsRes,
          messageActivityRes,
          onlineUsersRes,
          channelCreationRes,
          userStatusRes
        ].filter(res => res.status === 'rejected' || (res.status === 'fulfilled' && !res.value.success));

        if (failedRequests.length > 0) {
          setError('Some chart data could not be loaded');
        }

      } catch (err) {
        setError('Failed to load chart data');
        logger.api.error('Failed to load chart data', err);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [selectedPeriod]);

  // Period selector component
  const PeriodSelector = () => (
    <div className="flex space-x-2 mb-4">
      {(['1h', '24h', '7d', '30d', '90d', '1y'] as const).map((period) => (
        <button
          key={period}
          onClick={() => setSelectedPeriod({ period })}
          className={`px-3 py-1 rounded text-sm transition-colors ${selectedPeriod.period === period
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
        >
          {period}
        </button>
      ))}
    </div>
  );

  const [serverInfo, setServerInfo] = useState<{
    server_name: string;
    version: string;
    creation_date: string | null;
    max_users: number | null;
    total_users?: number;
    server_description?: string;
    avatar_url?: string | null;
    banner_url?: string | null;
  } | null>(null);

  // Load server info for overview
  useEffect(() => {
    const loadServerInfo = async () => {
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) return;

      try {
        const response = await getServerInfo();
        if (response.success && response.data) {
          setServerInfo(response.data.server_info ? response.data.server_info : null);
        }
      } catch (err) {
        logger.api.error('Failed to load server info for overview', err);
      }
    };

    loadServerInfo();
  }, []);

  return (
    <div className="space-y-6">
      {/* Server Information Dashboard */}
      {serverInfo && (
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[var(--color-text)] font-semibold">Server Overview</h2>
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-[var(--color-success)] rounded-full animate-pulse"></div>
              <span className="text-[var(--color-success)] font-medium">Online</span>
            </div>
          </div>

          {/* Server Identity Card */}
          <div className="bg-[var(--color-background-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="flex items-start space-x-4">
              {serverInfo?.avatar_url ? (
                <img
                  src={convertToFullCdnUrl(serverInfo.avatar_url)}
                  alt={serverInfo.server_name}
                  className="w-16 h-16 rounded-xl border-2 border-[var(--color-border)] object-cover shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] rounded-xl flex items-center justify-center border-2 border-[var(--color-border)] shadow-lg">
                  <span className="text-white font-bold text-2xl">
                    {serverInfo.server_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-[var(--color-text)] font-bold text-xl mb-2">{serverInfo.server_name}</h3>
                <p className="text-[var(--color-text-secondary)] mb-3">{serverInfo.server_description}</p>
                <div className="flex items-center space-x-4 text-sm text-[var(--color-text-muted)]">
                  <span>Version {serverInfo.version}</span>
                  <span>•</span>
                  <span>Created {serverInfo.creation_date ? new Date(serverInfo.creation_date).toLocaleDateString() : 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Server Statistics */}
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[var(--color-text)] font-semibold">Server Statistics</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('numbers')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'numbers'
                  ? 'bg-[var(--color-primary)] text-[var(--color-background)] shadow-lg'
                  : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                }`}
            >
              Numbers
            </button>

            <button
              onClick={() => setViewMode('diagram')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'diagram'
                  ? 'bg-[var(--color-primary)] text-[var(--color-background)] shadow-lg'
                  : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]'
                }`}
            >
              Diagram
            </button>
          </div>
        </div>

        {viewMode === 'numbers' ? (
          <div className="space-y-6">
            {/* Key Metrics - Most Important First */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[var(--color-surface)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg text-[var(--color-text-secondary)]">Online Now</div>
                    <div className="text-3xl font-bold text-white">
                      {activityMetrics?.current_online?.toLocaleString() ?? rawStats.onlineUsers?.currently_online?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <svg className="w-8 h-8 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div className="bg-[var(--color-surface)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg text-[var(--color-success)]">New This Week</div>
                    <div className="text-3xl font-bold text-white">
                      +{rawStats.userRegistrations?.new_this_week?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <svg className="w-8 h-8 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="bg-[var(--color-surface)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg text-[var(--color-info)]">Messages Today</div>
                    <div className="text-3xl font-bold text-white">
                      {serverOverview?.messages_this_period?.toLocaleString() ?? rawStats.messageActivity?.messages_today?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <svg className="w-8 h-8 text-[var(--color-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </div>
              <div className="bg-[var(--color-surface)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg text-[var(--color-warning)]">Total Channels</div>
                    <div className="text-3xl font-bold text-white">
                      {activityMetrics?.total_channels?.toLocaleString() ?? rawStats.channelCreation?.total_channels?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <svg className="w-8 h-8 text-[var(--color-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Detailed Stats in Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Server Overview */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Server Overview
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-300">
                      {rawStats.userRegistrations?.total_users?.toLocaleString() ?? '—'}
                    </div>
                    <div className="text-xs text-gray-400">Total Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-300">
                      {rawStats.channelCreation?.total_channels?.toLocaleString() ?? '—'}
                    </div>
                    <div className="text-xs text-gray-400">Active Channels</div>
                  </div>
                </div>
              </div>

              {/* Activity Metrics */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Activity Metrics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-300">12</div>
                    <div className="text-xs text-gray-400">Messages/Hour</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-300">89%</div>
                    <div className="text-xs text-gray-400">Active Users</div>
                  </div>
                </div>
              </div>

              {/* Server Resources Dashboard */}
              <div className="bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-background-secondary)] to-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-[var(--color-text)] flex items-center">
                    <svg className="w-6 h-6 mr-3 text-[var(--color-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7 7V5a2 2 0 114 0v14m0 0l-4-4m4 4l4-4" />
                    </svg>
                    Server Resources
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[var(--color-success)] rounded-full animate-pulse"></div>
                      <span className="text-xs text-[var(--color-success)] font-medium">Live</span>
                    </div>
                    <button
                      onClick={() => {
                        setUsageLoading(true);
                        setUsageError(null);
                        // Add cache-busting timestamp to ensure fresh data
                        getServerUsage().then(response => {
                          if (response.success && response.data) {
                            // Force state update with new data
                            setServerUsage(prevState => ({ ...prevState, ...response.data!.server_usage, timestamp: Date.now() }));
                            console.log('Updated server usage data:', response.data!.server_usage);
                          } else {
                            setUsageError('Failed to load server usage data');
                          }
                          setUsageLoading(false);
                        }).catch((error) => {
                          console.error('Server usage API error:', error);
                          setUsageError('Failed to load server usage data');
                          setUsageLoading(false);
                        });
                      }}
                      disabled={usageLoading}
                      className="bg-[var(--color-info)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center space-x-2 hover:shadow-lg"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>{usageLoading ? 'Updating...' : 'Refresh'}</span>
                    </button>
                  </div>
                </div>

                {usageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <svg className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <p className="text-cyan-400 text-sm font-medium">Scanning server resources...</p>
                    </div>
                  </div>
                ) : usageError ? (
                  <div className="text-center py-6">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <h4 className="text-red-400 font-medium mb-2">Resource Monitoring Error</h4>
                      <p className="text-gray-400 text-sm mb-4">{usageError}</p>
                      <button
                        onClick={() => {
                          setUsageLoading(true);
                          setUsageError(null);
                          getServerUsage().then(response => {
                            if (response.success && response.data) {
                              setServerUsage(response.data.server_usage);
                            } else {
                              setUsageError('Failed to load server usage data');
                            }
                            setUsageLoading(false);
                          }).catch(() => {
                            setUsageError('Failed to load server usage data');
                            setUsageLoading(false);
                          });
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </div>
                ) : serverUsage ? (
                  <>
                    {/* Main Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {/* CPU Usage */}
                      <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">CPU</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white mb-1">{serverUsage.cpu_percent}%</div>
                          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(serverUsage.cpu_percent, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500">Utilization</div>
                        </div>
                      </div>

                      {/* Memory Usage */}
                      <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7 7V5a2 2 0 114 0v14m0 0l-4-4m4 4l4-4" />
                            </svg>
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Memory</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white mb-1">{serverUsage.ram_percent}%</div>
                          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                            <div
                              className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(serverUsage.ram_percent, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500">{serverUsage.ram_used_gb}GB / {serverUsage.ram_total_gb}GB</div>
                        </div>
                      </div>

                      {/* Storage Usage */}
                      <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Storage</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white mb-1">{serverUsage.storage_percent}%</div>
                          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(serverUsage.storage_percent, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500">{serverUsage.storage_used_gb}GB / {serverUsage.storage_total_gb}GB</div>
                        </div>
                      </div>

                      {/* Disk I/O */}
                      <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m-6 0v10M6 20h12v-4a2 2 0 00-2-2H8a2 2 0 00-2 2v4z" />
                            </svg>
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Disk I/O</span>
                          </div>
                        </div>
                        <div className="text-center space-y-1">
                          <div className="text-xs text-cyan-400 font-medium">{serverUsage.disk_read_mb_per_sec}MB/s Read</div>
                          <div className="text-xs text-orange-400 font-medium">{serverUsage.disk_write_mb_per_sec}MB/s Write</div>
                          <div className="text-xs text-gray-500 mt-2">IO Throughput</div>
                        </div>
                      </div>
                    </div>

                    {/* System Status Bar */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-green-400">System Online</span>
                          </div>
                          <div className="h-4 w-px bg-gray-600"></div>
                          <span className="text-sm text-gray-400">Uptime:</span>
                          <span className="text-sm font-semibold text-white">{serverUsage.uptime_formatted}</span>
                        </div>

                        {/* Last Updated */}
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Updated {new Date(serverUsage.timestamp * 1000).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    No usage data available
                  </div>
                )}
              </div>

              {/* Peak Performance */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Peak Performance
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-300">127</div>
                    <div className="text-xs text-gray-400">Peak Online</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-300">367</div>
                    <div className="text-xs text-gray-400">Msgs 24H</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Growth Stats */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Growth Insights
              </h3>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-300 mb-1">15</div>
                <div className="text-sm text-gray-400">New Channels Created This Month</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Time Period Selector */}
            <PeriodSelector />

            {loading ? (
              <div className="bg-gray-700 rounded-lg p-6 h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center animate-spin">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Loading Charts</h3>
                  <p className="text-gray-400">Fetching chart data...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-gray-700 rounded-lg p-6 h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-600 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Error Loading Charts</h3>
                  <p className="text-gray-400">{error}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Chart Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* User Registrations Chart */}
                  {chartData.userRegistrations && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-white mb-3">User Registrations</h4>
                      <Line
                        data={chartData.userRegistrations}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: true, labels: { color: 'white' } },
                          },
                          scales: {
                            x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                            y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                          },
                        }}
                      />
                    </div>
                  )}

                  {/* Message Activity Chart */}
                  {chartData.messageActivity && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-white mb-3">Message Activity</h4>
                      <Bar
                        data={chartData.messageActivity}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: true, labels: { color: 'white' } },
                          },
                          scales: {
                            x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                            y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                          },
                        }}
                      />
                    </div>
                  )}

                  {/* Online Users Chart */}
                  {chartData.onlineUsers && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-white mb-3">Online Users</h4>
                      <Line
                        data={chartData.onlineUsers}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: true, labels: { color: 'white' } },
                          },
                          scales: {
                            x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                            y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                          },
                        }}
                      />
                    </div>
                  )}

                  {/* Channel Creation Chart */}
                  {chartData.channelCreation && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-white mb-3">Channel Creations</h4>
                      <Bar
                        data={chartData.channelCreation}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: true, labels: { color: 'white' } },
                          },
                          scales: {
                            x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                            y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                          },
                        }}
                      />
                    </div>
                  )}

                  {/* User Status Chart */}
                  {chartData.userStatus && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-white mb-3">User Status Distribution</h4>
                      <Pie
                        data={chartData.userStatus}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: true, labels: { color: 'white' } },
                          },
                        }}
                      />
                    </div>
                  )}
                </div>

                {Object.keys(chartData).length === 0 && !loading && (
                  <div className="bg-gray-700 rounded-lg p-6 h-64 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-600 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">No Chart Data Available</h3>
                      <p className="text-gray-400">Chart data is not currently available from the server.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <RecentActivity />

    </div>
  );
}

// Members Tab Component
function MembersTab({
  users,
  showToast
}: {
  users: ListUsersResponse['users'];
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  // Show loading state when no users are loaded yet
  if (!users || users.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-white">Manage Members</h2>
            <button className="bg-gray-600 text-white px-4 py-2 rounded-lg cursor-not-allowed">
              Invite Member
            </button>
          </div>

          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center px-4 py-3">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 bg-gray-600 rounded-full"></div>
                  <div>
                    <div className="h-4 bg-gray-600 rounded mb-1 w-24"></div>
                    <div className="h-3 bg-gray-600 rounded w-32"></div>
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="h-3 bg-gray-600 rounded"></div>
                </div>
                <div className="w-12">
                  <div className="w-5 h-5 bg-gray-600 rounded"></div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center text-gray-400 py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p>Loading members...</p>
          </div>
        </div>
      </div>
    );
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [membersListVisible, setMembersListVisible] = useState(true); // For control panel
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedUserMenu, setSelectedUserMenu] = useState<typeof users[0] | null>(null);
  const [userMenuPosition, setUserMenuPosition] = useState({ x: 0, y: 0 });

  const handleUserMenu = (user: typeof users[0], event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setSelectedUserMenu(user);
    setUserMenuPosition({
      x: Math.min(rect.left + window.scrollX, window.innerWidth - 200),
      y: rect.bottom + window.scrollY + 5
    });
    setUserMenuOpen(!userMenuOpen || selectedUserMenu?.user_id !== user.user_id);
  };

  const handleUserAction = (action: 'editRoles' | 'mute' | 'ban') => {
    if (!selectedUserMenu) return;

    switch (action) {
      case 'editRoles':
        showToast(`Edit roles for ${selectedUserMenu.username}`, 'success');
        break;
      case 'mute':
        showToast(`${selectedUserMenu.username} has been muted`, 'success');
        break;
      case 'ban':
        showToast(`${selectedUserMenu.username} has been banned`, 'success');
        break;
    }

    setUserMenuOpen(false);
    setSelectedUserMenu(null);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      setUserMenuOpen(false);
      setSelectedUserMenu(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-white">Manage Members</h2>
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            />
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
              Invite Member
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {/* Filter users based on search term */}
          {users.filter(user =>
            searchTerm === '' ||
            user.username.toLowerCase().includes(searchTerm.toLowerCase())
          ).map((user) => (
            <div
              key={user.user_id}
              className="flex items-center px-4 py-3 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
            >
              {/* User info on the left */}
              <div className="flex items-center space-x-3 flex-1">
                <div className="relative">
                  <img
                    src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=5865f2`}
                    alt={user.username}
                    className="w-10 h-10 rounded-full shadow-md border-2 border-green-300"
                  />
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--color-surface)] shadow-sm ${user.status === 'online' ? 'bg-green-400' :
                      user.status === 'idle' ? 'bg-yellow-400' :
                        user.status === 'dnd' ? 'bg-red-400' :
                          'bg-gray-400'
                    }`}></div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{user.username}</span>
                  {user.is_owner && (
                    <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">OWNER</span>
                  )}
                  {user.is_admin && !user.is_owner && (
                    <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                  )}
                </div>
              </div>

              {/* Joined date in the middle */}
              <div className="flex-1 text-center text-gray-400">
                Joined {new Date(user.created_at || '2023-01-01').toLocaleDateString()}
              </div>

              {/* Three dots menu on the right */}
              <div className="w-12 flex justify-end">
                <button
                  onClick={(event) => { event.stopPropagation(); handleUserMenu(user, event); }}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Menu Dropdown */}
      {userMenuOpen && selectedUserMenu && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 w-48"
          style={{ left: userMenuPosition.x, top: userMenuPosition.y }}
        >
          <button
            onClick={() => handleUserAction('editRoles')}
            className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit Roles</span>
          </button>

          <button
            onClick={() => handleUserAction('mute')}
            className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
            <span>Mute</span>
          </button>

          <button
            onClick={() => handleUserAction('ban')}
            className="w-full px-3 py-2 text-left text-red-400 hover:bg-red-900 hover:bg-opacity-20 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Ban</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ChannelsTab({
  onOpenChannelModal,
  channels,
  setChannels,
  showToast
}: {
  onOpenChannelModal: () => void;
  channels: Channel[];
  setChannels: (channels: Channel[]) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
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

        // Show success toast
        showToast(`Channel #${channel.channel_name} deleted successfully!`, 'success');

        // Refresh the channel list
        const listResponse = await listChannels(authToken);
        if (listResponse.success && listResponse.data && listResponse.data.channels) {
          setChannels(listResponse.data.channels);
        }
        setDeleteConfirmChannel(null);
      } else {
        console.error("Failed to delete channel:", response.error);
        logger.ui.error("Failed to delete channel", { channelId: channel.channel_id, error: response.error });
        showToast(`Failed to delete channel: ${response.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error("Error deleting channel:", error);
      logger.ui.error("Error deleting channel", { channelId: channel.channel_id, error });
      showToast('An unexpected error occurred while deleting the channel.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-white">Manage Channels</h2>
          <button
            onClick={onOpenChannelModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Create Channel
          </button>
        </div>

        {hasChannels ? (
          <div className="space-y-3">
            {channels.map((channel) => (
              <div key={channel.channel_id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-gray-400">#</span>
                  <span className="text-white font-medium">{channel.channel_name}</span>
                  {channel.is_private && (
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  <span className="px-2 py-1 text-xs rounded text-white bg-gray-600">
                    text
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button className="text-gray-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmChannel(channel)}
                    className="text-gray-400 hover:text-red-400 transition-colors"
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
          <div className="text-center text-gray-400 py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2">No channels found</p>
            <p className="text-gray-500">Create your first channel to get started with discussions.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white">Delete Channel</h3>
            </div>
            <div className="mb-6">
              <p className="text-gray-300 mb-2">
                Are you sure you want to delete <span className="font-semibold text-white">#{deleteConfirmChannel.channel_name}</span>?
              </p>
              <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded">
                ⚠️ This action cannot be undone. All messages in this channel will be permanently deleted.
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmChannel(null)}
                className="px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteChannel(deleteConfirmChannel)}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Settings Tab Component
function SettingsTab({
  showToast
}: {
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [serverInfo, setServerInfo] = useState<{
    server_name: string;
    server_description: string;
    version: string;
    max_users: number | null;
    is_private: boolean;
    creation_date: string | null;
    max_message_length?: number;
    max_image_size?: number;
    max_video_size?: number;
    max_sticker_size?: number;
    allowed_image_types?: string;
    allowed_video_types?: string;
    allowed_file_types?: string;
    allowed_sticker_types?: string;
    avatar_url?: string | null;
    banner_url?: string | null;
  }>({
    server_name: 'Loading...',
    server_description: 'Loading...',
    version: 'Loading...',
    max_users: null,
    is_private: false,
    creation_date: null,
    max_message_length: undefined,
    max_image_size: undefined,
    max_video_size: undefined,
    max_sticker_size: undefined,
    allowed_image_types: undefined,
    allowed_video_types: undefined,
    allowed_file_types: undefined,
    allowed_sticker_types: undefined,
    avatar_url: null,
    banner_url: null,
  });
  const [originalServerInfo, setOriginalServerInfo] = useState<typeof serverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load server info on component mount
  useEffect(() => {
    const loadServerInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getServerInfo();
        if (response.success && response.data) {
          const info = response.data.server_info;
          setServerInfo({
            server_name: info.server_name,
            server_description: info.server_description,
            version: info.version,
            max_users: info.max_users,
            is_private: info.is_private,
            creation_date: info.creation_date,
            max_message_length: info.max_message_length,
            max_image_size: info.max_image_size,
            max_video_size: info.max_video_size,
            max_sticker_size: info.max_sticker_size,
            avatar_url: info.avatar_url,
            banner_url: info.banner_url,
          });
          setOriginalServerInfo(JSON.parse(JSON.stringify({
            ...info,
            avatar_url: info.avatar_url,
            banner_url: info.banner_url
          }))); // Deep copy
        } else {
          setError('Failed to load server information');
        }
      } catch (err) {
        setError('Failed to load server information');
        logger.api.error('Failed to load server info', err);
      } finally {
        setLoading(false);
      }
    };

    loadServerInfo();
  }, []);

  // Handle avatar upload immediately when selected
  const handleAvatarUpload = async (file: File) => {
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('auth_token', authToken);
      formData.append('avatar', file);

      const response = await fetch('/api/v1/system/upload-avatar', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        const fullAvatarUrl = convertToFullCdnUrl(result.avatar_url);
        setServerInfo(prev => ({ ...prev, avatar_url: fullAvatarUrl }));
        setOriginalServerInfo(prev => prev ? { ...prev, avatar_url: fullAvatarUrl } : null); // Update original to avoid "unsaved changes"
        logger.ui.info('Server avatar updated successfully', result);
      } else {
        setError('Failed to upload avatar');
        logger.ui.error('Failed to upload avatar', response);
      }
    } catch (err) {
      setError('Failed to upload avatar');
      logger.api.error('Failed to upload avatar', err);
    }
  };

  // Handle banner upload immediately when selected
  const handleBannerUpload = async (file: File) => {
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('auth_token', authToken);
      formData.append('banner', file);

      const response = await fetch('/api/v1/system/upload-banner', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setServerInfo(prev => ({ ...prev, banner_url: result.banner_url }));
        setOriginalServerInfo(prev => prev ? { ...prev, banner_url: result.banner_url } : null); // Update original to avoid "unsaved changes"
        logger.ui.info('Server banner updated successfully', result);
      } else {
        setError('Failed to upload banner');
        logger.ui.error('Failed to upload banner', response);
      }
    } catch (err) {
      setError('Failed to upload banner');
      logger.api.error('Failed to upload banner', err);
    }
  };

  const handleSave = async () => {
    // Form validation
    if (!serverInfo.server_name?.trim()) {
      setError('Server name cannot be empty');
      return;
    }

    if (serverInfo.server_name.length > 100) {
      setError('Server name cannot exceed 100 characters');
      return;
    }

    // Only validate message length if it's been explicitly set and is within valid range
    const messageLengthToCheck = serverInfo.max_message_length !== undefined ? serverInfo.max_message_length : null;
    // if (messageLengthToCheck !== null && messageLengthToCheck !== undefined &&
    //     (messageLengthToCheck < 100 || messageLengthToCheck > 10000)) {
    //   setError('Maximum message length must be between 100 and 10000 characters');
    //   return;
    // }

    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const changes: any = {};
      if (serverInfo.server_name !== originalServerInfo?.server_name) {
        changes.server_name = serverInfo.server_name.trim();
      }
      if (serverInfo.server_description !== originalServerInfo?.server_description) {
        changes.server_description = (serverInfo.server_description || '').trim();
      }
      if (serverInfo.is_private !== originalServerInfo?.is_private) {
        changes.is_private = serverInfo.is_private;
      }
      // Only include max_message_length in changes if it has been explicitly set
      if (serverInfo.max_message_length !== undefined && serverInfo.max_message_length !== originalServerInfo?.max_message_length) {
        changes.max_message_length = serverInfo.max_message_length;
      }

      if (Object.keys(changes).length === 0) {
        setError('No changes to save');
        setSaving(false);
        return;
      }

      const response = await updateServerInfo({
        auth_token: authToken,
        ...changes
      });

      if (response.success && response.data) {
        setOriginalServerInfo(JSON.parse(JSON.stringify(serverInfo))); // Update original after save
        showToast(`Server settings updated successfully! Updated: ${response.data.updated_fields.join(', ')}`, 'success');
        logger.ui.info('Server settings updated successfully', { updated_fields: response.data.updated_fields, changes });
      } else {
        setError(response.error || 'Failed to update server settings');
        logger.ui.error('Failed to update server settings', response);
        showToast('Failed to update server settings', 'error');
      }
    } catch (err) {
      setError('Failed to save server settings');
      logger.api.error('Failed to save server settings', err);
      showToast('Failed to save server settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Helper function to convert data URL to File object
  const dataURLToFile = (dataURL: string, filename: string): File => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Avatar and banner are uploaded immediately when selected, so they shouldn't count as "unsaved changes"
  const hasChanges = originalServerInfo &&
    (serverInfo.server_name !== originalServerInfo.server_name ||
      serverInfo.server_description !== originalServerInfo.server_description ||
      serverInfo.is_private !== originalServerInfo.is_private ||
      serverInfo.max_users !== originalServerInfo.max_users ||
      serverInfo.max_message_length !== originalServerInfo.max_message_length);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="animate-pulse space-y-6">
            <div className="h-6 bg-gray-600 rounded w-48"></div>
            <div className="space-y-4">
              <div className="h-16 bg-gray-600 rounded"></div>
              <div className="h-24 bg-gray-600 rounded"></div>
              <div className="h-12 bg-gray-600 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <h2 className="text-lg font-medium text-white mb-6">Server Settings</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Server Information */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-white">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Server Name
              </label>
              <input
                type="text"
                value={serverInfo.server_name}
                onChange={(e) => setServerInfo({ ...serverInfo, server_name: e.target.value })}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={serverInfo.server_description}
                onChange={(e) => setServerInfo({ ...serverInfo, server_description: e.target.value })}
                rows={3}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                disabled={saving}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                checked={serverInfo.is_private}
                onChange={(e) => setServerInfo({ ...serverInfo, is_private: e.target.checked })}
                className="mr-3"
                disabled={saving}
              />
              <label htmlFor="isPrivate" className="text-sm font-medium text-gray-300">
                Make server private (invite only)
              </label>
            </div>



            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Maximum Message Length
              </label>
              <input
                type="number"
                value={serverInfo.max_message_length ?? ''}
                onChange={(e) => setServerInfo({ ...serverInfo, max_message_length: e.target.value ? parseInt(e.target.value) : undefined })}
                min="100"
                max="10000"
                placeholder="Default (4000)"
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                disabled={saving}
              />
            </div>
          </div>

          {/* Server Appearance */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-white">Server Appearance</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Server Avatar */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    {serverInfo.avatar_url ? (
                      <img
                        src={convertToFullCdnUrl(serverInfo.avatar_url)}
                        alt="Server Avatar"
                        className="w-20 h-20 rounded-xl border-2 border-[var(--color-border)] object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] rounded-xl flex items-center justify-center border-2 border-[var(--color-border)] shadow-lg">
                        <span className="text-white font-bold text-2xl">
                          {serverInfo.server_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => setServerInfo({ ...serverInfo, avatar_url: null })}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      disabled={saving}
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-1">Server Avatar</h4>
                    <p className="text-gray-400 text-sm mb-2">Upload a static image or animated GIF</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Show local preview first
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            setServerInfo({ ...serverInfo, avatar_url: result });
                          };
                          reader.readAsDataURL(file);

                          // Then upload to server
                          await handleAvatarUpload(file);
                        }
                      }}
                      disabled={saving}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="cursor-pointer inline-flex items-center space-x-2 px-3 py-2 bg-[var(--color-accent)] hover:bg-opacity-80 text-white text-sm rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Upload Avatar</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Server Banner */}
              <div className="space-y-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <h4 className="text-white font-medium mb-1">Server Banner</h4>
                      <p className="text-gray-400 text-sm mb-2">Upload a banner image or GIF for the server header</p>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Show local preview first
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const result = event.target?.result as string;
                              setServerInfo({ ...serverInfo, banner_url: result });
                            };
                            reader.readAsDataURL(file);

                            // Then upload to server
                            await handleBannerUpload(file);
                          }
                        }}
                        disabled={saving}
                        className="hidden"
                        id="banner-upload"
                      />
                      <label
                        htmlFor="banner-upload"
                        className="cursor-pointer inline-flex items-center space-x-2 px-3 py-2 bg-[var(--color-accent)] hover:bg-opacity-80 text-white text-sm rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span>Upload Banner</span>
                      </label>
                    </div>
                  </div>

                  {/* Banner Preview */}
                  {serverInfo.banner_url && (
                    <div className="relative group">
                      <img
                        src={convertToFullCdnUrl(serverInfo.banner_url)}
                        alt="Server Banner"
                        className="w-full h-24 object-cover rounded-lg border border-[var(--color-border)]"
                        style={{ aspectRatio: '16/2' }}
                      />
                      <button
                        onClick={() => setServerInfo({ ...serverInfo, banner_url: null })}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white text-xs font-bold opacity-75 group-hover:opacity-100 transition-opacity"
                        disabled={saving}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* File Format Info */}
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-gray-300">
                  <strong>GIF Support:</strong> Both static and animated GIF files are supported for avatar and banner images.
                  Recommended sizes: Avatar (128x128px), Banner (1200x300px).
                  <div className="mt-1 text-xs text-gray-400">
                    Supported formats: PNG, JPEG/JPG, GIF, WebP
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* File Upload Restrictions */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-white">File Upload Restrictions</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Allowed Image Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_image_types || 'PNG, JPG, JPEG, GIF, WebP'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_image_types: e.target.value })}
                  placeholder="PNG, JPG, JPEG, GIF, WebP"
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Allowed Video Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_video_types || 'MP4, WebM'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_video_types: e.target.value })}
                  placeholder="MP4, WebM"
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Allowed Document Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_file_types || 'PDF, DOC, DOCX, TXT, ZIP'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_file_types: e.target.value })}
                  placeholder="PDF, DOC, DOCX, TXT, ZIP"
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Allowed Sticker Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_sticker_types || 'PNG, GIF'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_sticker_types: e.target.value })}
                  placeholder="PNG, GIF"
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  disabled={saving}
                />
              </div>
            </div>
          </div>



          <div className="pt-4 border-t border-gray-600">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
            {hasChanges && !saving && (
              <span className="ml-3 text-sm text-yellow-400">
                You have unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Security Tab Component
function SecurityTab() {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <h2 className="text-lg font-medium text-white mb-6">Security Settings</h2>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <div className="text-white font-medium">Content Moderation</div>
              <div className="text-gray-400 text-sm">Automatically filter inappropriate content</div>
            </div>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
              Enable
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <div className="text-white font-medium">Spam Protection</div>
              <div className="text-gray-400 text-sm">Prevent spam messages and raids</div>
            </div>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
              Enable
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <div className="text-white font-medium">IP Logging</div>
              <div className="text-gray-400 text-sm">Log IP addresses for security monitoring</div>
            </div>
            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
              Disable
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <div className="text-white font-medium">Two-Factor Authentication</div>
              <div className="text-gray-400 text-sm">Require 2FA for all administrators</div>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
              Configure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Blocked IPs Tab Component
function BlockedIPsTab({
  showToast
}: {
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [blockedIPs, setBlockedIPs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newIP, setNewIP] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isAddingIP, setIsAddingIP] = useState(false);
  const [deleteConfirmIP, setDeleteConfirmIP] = useState<any>(null);

  // Load blocked IPs on component mount
  useEffect(() => {
    loadBlockedIPs();
  }, []);

  const loadBlockedIPs = async () => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        setError('Authentication token not found');
        setLoading(false);
        return;
      }

      const response = await listBlockedIPs(authToken);
      if (response.success && response.data) {
        setBlockedIPs(response.data.blocked_ips || []);
      } else {
        setError(response.error || 'Failed to load blocked IPs');
        setBlockedIPs([]);
      }
    } catch (err) {
      setError('Failed to load blocked IPs');
      setBlockedIPs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockIP = async () => {
    if (!newIP.trim() || !newReason.trim()) {
      showToast('Please provide both IP address and reason', 'error');
      return;
    }

    // Basic IP validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!ipRegex.test(newIP.trim())) {
      showToast('Please provide a valid IP address', 'error');
      return;
    }

    setIsAddingIP(true);

    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        showToast('Authentication token not found', 'error');
        return;
      }

      const response = await blockIP(authToken, newIP.trim(), newReason.trim());
      if (response.success) {
        showToast(`IP ${newIP} has been blocked successfully!`, 'success');
        setNewIP('');
        setNewReason('');
        await loadBlockedIPs(); // Refresh the list
      } else {
        showToast(response.error || 'Failed to block IP', 'error');
      }
    } catch (err) {
      showToast('Failed to block IP', 'error');
    } finally {
      setIsAddingIP(false);
    }
  };

  const handleUnblockIP = async (ip: string) => {
    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        showToast('Authentication token not found', 'error');
        return;
      }

      const response = await unblockIP(authToken, ip);
      if (response.success) {
        showToast(`IP ${ip} has been unblocked successfully!`, 'success');
        await loadBlockedIPs(); // Refresh the list
        setDeleteConfirmIP(null);
      } else {
        showToast(response.error || 'Failed to unblock IP', 'error');
      }
    } catch (err) {
      showToast('Failed to unblock IP', 'error');
    }
  };

  const filteredIPs = blockedIPs.filter(ip =>
    searchTerm === '' ||
    ip.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ip.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-600 rounded w-48"></div>
            <div className="h-32 bg-gray-600 rounded"></div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-600 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="text-center text-red-400 py-8">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Error Loading Blocked IPs</h3>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={loadBlockedIPs}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blocked IPs Management Header */}
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-white">Blocked IP Addresses</h2>
            <p className="text-gray-400 text-sm mt-1">Manage IP addresses that are blocked from accessing the server</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{blockedIPs.length}</div>
            <div className="text-sm text-gray-400">Total Blocked</div>
          </div>
        </div>

        {/* Add New IP Block */}
        <div className="bg-gray-700 rounded-lg p-4 mb-6">
          <h3 className="text-md font-medium text-white mb-4">Block New IP Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                IP Address
              </label>
              <input
                type="text"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                placeholder="192.168.1.1 or 2001:db8::1"
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                disabled={isAddingIP}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reason
              </label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Reason for blocking"
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                disabled={isAddingIP}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleBlockIP}
                disabled={isAddingIP || !newIP.trim() || !newReason.trim()}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {isAddingIP ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Blocking...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Block IP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search blocked IPs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={loadBlockedIPs}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {/* Blocked IPs List */}
        {filteredIPs.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2">
              {blockedIPs.length === 0 ? 'No blocked IPs' : 'No IPs match your search'}
            </p>
            <p className="text-gray-500 text-sm">
              {blockedIPs.length === 0 ? 'IP addresses will appear here once blocked' : 'Try adjusting your search terms'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIPs.map((blockedIP, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors"
              >
                {/* IP Info */}
                <div className="flex items-center space-x-4 flex-1">
                  {/* IP Icon */}
                  <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>

                  {/* IP Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-white font-medium">{blockedIP.ip}</h4>
                      <span className="px-2 py-1 bg-red-600 text-white text-xs rounded font-medium">
                        Blocked
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span>Reason: {blockedIP.reason}</span>
                      <span>•</span>
                      <span>Blocked: {new Date(blockedIP.blocked_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setDeleteConfirmIP(blockedIP)}
                    className="text-gray-400 hover:text-green-400 transition-colors p-2"
                    title="Unblock IP"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Information Panel */}
        <div className="mt-6 p-4 bg-gradient-to-r from-red-900/20 to-orange-900/20 rounded-lg border border-red-500/30">
          <h3 className="text-lg font-medium text-white mb-2">About IP Blocking</h3>
          <p className="text-gray-400 text-sm">
            Blocked IP addresses are automatically prevented from accessing the server by the rate limiting middleware.
            IPs are typically blocked when they exceed rate limits or engage in malicious activities.
            You can manually block IPs here for security purposes, or unblock them if needed.
          </p>
        </div>
      </div>

      {/* Unblock Confirmation Modal */}
      {deleteConfirmIP && (
        <div className="fixed inset-0 backdrop-blur-lg bg-white bg-opacity-5 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white">Unblock IP Address</h3>
            </div>
            <div className="mb-6">
              <p className="text-gray-300 mb-2">
                Are you sure you want to unblock <span className="font-semibold text-white">{deleteConfirmIP.ip}</span>?
              </p>
              <div className="text-sm text-green-400 bg-green-900/20 p-3 rounded">
                <strong>Note:</strong> This IP address will be able to access the server again.
                Make sure this IP is no longer a threat before unblocking.
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmIP(null)}
                className="px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnblockIP(deleteConfirmIP.ip)}
                className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
              >
                Unblock IP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple User Profile Modal for viewing user information
function UserProfileModal({
  isOpen,
  onClose,
  user,
  currentUserId,
  position,
  triggerRect
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  currentUserId: string;
  position?: { x: number; y: number };
  triggerRect?: DOMRect | null;
}) {
  if (!isOpen || !user) return null;

  return (
    <div
      className="fixed z-50 bg-gray-800 rounded-lg shadow-lg border border-gray-600 py-2 w-64"
      style={{
        left: position?.x || '50%',
        top: position?.y || '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)'
      }}
    >
      <div className="px-4 py-2">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-3">
          <img
            src={user.avatar}
            alt={user.username}
            className="w-8 h-8 rounded-full border border-gray-600"
          />
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium truncate">{user.username}</div>
            <div className="text-xs text-gray-400">{user.bio}</div>
          </div>
        </div>

        {/* Joined date */}
        <div className="text-xs text-gray-500 pb-2">
          Joined {new Date(user.joinedAt).toLocaleDateString()}
        </div>

        {/* Actions (if different from current user) */}
        {user.id !== currentUserId && (
          <div className="border-t border-gray-600 pt-2">
            <button className="w-full text-left px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
              Start Conversation
            </button>
            <button className="w-full text-left px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
              Add Friend
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Logs Tab Component
function LogsTab({
  showToast
}: {
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [logs, setLogs] = useState<string[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        setError('Authentication token not found');
        setLoading(false);
        return;
      }

      const request: any = {};
      // Add search and level filters if provided
      if (searchTerm.trim()) {
        request.lines = 1000; // Fetch more lines when searching to ensure results
        // Note: server-side filtering would be better, but implementing client-side for now
      }
      // Add level filter
      if (logLevel !== 'all') {
        request.level = logLevel.toUpperCase() as 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
      }

      const response = await getServerLogs(authToken, request);
      if (response.success && response.data) {
        // Extract the actual log lines from the content field if available
        let logLines: string[] = [];
        const logsData = response.data.logs;

        if (logsData) {
          if (Array.isArray(logsData)) {
            // If logs is an array of objects with content/raw fields
            logLines = (logsData as any[]).map((log: any) => {
              // Ensure we always return a string, even if the field contains other types
              const raw = log.raw || log.content || log;
              return typeof raw === 'string' ? raw : String(raw);
            });
          } else if (typeof logsData === 'string') {
            // If logs is a string, split by newlines
            logLines = (logsData as string).split('\n').filter((line: string) => line.trim() !== '');
          } else {
            logLines = [];
          }
        } else {
          logLines = [];
        }

        setLogs(logLines);
        applyFilters(logLines, searchTerm, logLevel);
      } else {
        setError(response.error || 'Failed to load logs');
      }
    } catch (err) {
      setError('Failed to load logs');
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (logList: string[], search: string, level: string) => {
    let filtered = logList;

    // Filter by log level
    if (level !== 'all') {
      filtered = filtered.filter(line => {
        const upperLine = line.toUpperCase();
        switch (level) {
          case 'error':
            return upperLine.includes('ERROR') || upperLine.includes('[ERROR]');
          case 'warning':
            return upperLine.includes('WARN') || upperLine.includes('[WARN]') ||
                   upperLine.includes('WARNING') || upperLine.includes('[WARNING]');
          case 'info':
            return upperLine.includes('INFO') || upperLine.includes('[INFO]');
          case 'debug':
            return upperLine.includes('DEBUG') || upperLine.includes('[DEBUG]');
          default:
            return true;
        }
      });
    }

    // Filter by search term
    if (search.trim()) {
      filtered = filtered.filter(line =>
        line.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters(logs, searchTerm, logLevel);
  }, [logs, searchTerm, logLevel]);

  const ansiToHtml = (text: any): string => {
    // Ensure text is a string
    if (typeof text !== 'string') {
      text = String(text);
    }

    // Basic ANSI color parsing - converts common ANSI codes to HTML spans
    // \x1b[31m = red, \x1b[32m = green, \x1b[33m = yellow, etc.
    // Using CSS custom properties to match the app's color scheme
    let html = text
      .replace(/\x1b\[31m/g, '<span style="color: var(--color-error);">') // Red for errors
      .replace(/\x1b\[32m/g, '<span style="color: var(--color-success);">') // Green for success
      .replace(/\x1b\[33m/g, '<span style="color: var(--color-warning);">') // Yellow for warnings
      .replace(/\x1b\[34m/g, '<span style="color: var(--color-primary);">') // Blue for info
      .replace(/\x1b\[35m/g, '<span style="color: var(--color-accent);">') // Magenta/purple
      .replace(/\x1b\[36m/g, '<span style="color: var(--color-info);">') // Cyan/blue
      .replace(/\x1b\[37m/g, '<span style="color: var(--color-text);">') // White/bright text
      .replace(/\x1b\[0m/g, '</span>') // Reset
      .replace(/\x1b\[1m/g, '<span style="font-weight: bold;">') // Bold
      .replace(/\x1b\[4m/g, '<span style="text-decoration: underline;">'); // Underline

    // Close any unclosed spans
    const openSpans = (html.match(/<span/g) || []).length;
    const closeSpans = (html.match(/<\/span>/g) || []).length;
    if (openSpans > closeSpans) {
      html += '</span>'.repeat(openSpans - closeSpans);
    }

    return html;
  };

  const downloadLogs = () => {
    const logContent = logs.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `server-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Logs downloaded successfully!', 'success');
  };

  const clearLogs = async () => {
    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        showToast('Authentication token not found', 'error');
        return;
      }

      const response = await fetch('/api/v1/system/logs/clear', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setLogs([]);
        setFilteredLogs([]);
        showToast('Logs cleared successfully!', 'success');
      } else {
        showToast('Failed to clear logs', 'error');
      }
    } catch (err) {
      showToast('Failed to clear logs', 'error');
      console.error('Failed to clear logs:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Logs Header */}
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-white">Server Logs</h2>
            <p className="text-gray-400 text-sm mt-1">Live server logs with filtering and color support</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              {filteredLogs.length} / {logs.length} entries
            </div>
            <button
              onClick={loadLogs}
              disabled={loading}
              className={`bg-[var(--color-primary)] hover:opacity-90 disabled:bg-[var(--color-surface)] disabled:text-[var(--color-text-secondary)] text-[var(--color-background)] px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 border border-transparent hover:border-[var(--color-primary-dark)]`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{loading ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Filter by level */}
          <div className="flex items-center space-x-2">
            <label className="text-white font-medium">Level:</label>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          {/* Auto-scroll toggle */}
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-gray-600 text-blue-600"
              />
              <span className="text-sm text-gray-300">Auto-scroll</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-2">
            <button
              onClick={downloadLogs}
              className="bg-[var(--color-success)] hover:opacity-90 text-[var(--color-text)] px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 text-sm border border-transparent hover:border-[var(--color-success-dark)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download Logs</span>
            </button>
            <button
              onClick={clearLogs}
              className="bg-[var(--color-error)] hover:opacity-90 text-[var(--color-background)] px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 text-sm border border-transparent hover:border-[var(--color-error-dark)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-12">
            <svg className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p>Loading server logs...</p>
          </div>
        ) : error ? (
          <div className="text-center text-red-400 py-8">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Error Loading Logs</h3>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={loadLogs}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          /* Logs Display */
          <div className="bg-[var(--color-background-secondary)] rounded-lg border border-[var(--color-border)]">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h3 className="text-white font-medium">
                Server Logs
                {filteredLogs.length !== logs.length && (
                  <span className="text-gray-400 text-sm ml-2">
                    (filtered)
                  </span>
                )}
              </h3>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto font-mono text-sm bg-[var(--color-background-tertiary)]">
              {filteredLogs.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  {logs.length === 0 ? (
                    <>
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>No logs available</p>
                      <p className="text-xs text-gray-500 mt-2">Server logs will appear here when they become available</p>
                    </>
                  ) : (
                    <p>No logs match your search criteria</p>
                  )}
                </div>
              ) : (
                <>
                  {filteredLogs.map((line, index) => (
                    <div
                      key={index}
                      className="mb-1 hover:bg-gray-800 px-2 py-1 rounded text-gray-300"
                      dangerouslySetInnerHTML={{ __html: ansiToHtml(line) }}
                    />
                  ))}
                  <div ref={logsEndRef} />
                </>
              )}
            </div>
          </div>
        )}

        {/* Information Panel */}
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-500/30">
          <h3 className="text-lg font-medium text-white mb-2">About Server Logs</h3>
          <p className="text-gray-400 text-sm">
            Server logs capture all system activity including requests, errors, warnings, and debug information.
            Color codes are preserved for better readability. Use filters to focus on specific types of logs or search by content.
          </p>
        </div>
      </div>
    </div>
  );
}

// Moderation Tab Component
function ModerationTab({
  showToast
}: {
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<'reports' | 'users' | 'messages'>('reports');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [touchTimeout, setTouchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Long-press message selection handlers
  const handleMessagePointerDown = (messageId: string) => {
    const timeout = setTimeout(() => {
      setSelectedMessageId(messageId);
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms for long-press
    setTouchTimeout(timeout);
  };

  const handleMessagePointerUp = () => {
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      setTouchTimeout(null);
    }
  };

  const handleMessagePointerLeave = () => {
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      setTouchTimeout(null);
    }
  };

  const clearMessageSelection = () => {
    setSelectedMessageId(null);
  };
  const [userProfileModal, setUserProfileModal] = useState<{
    isOpen: boolean;
    user: any;
    position?: { x: number; y: number };
    triggerRect?: DOMRect | null;
  }>({ isOpen: false, user: null });

  // Mock reported messages data
  const mockReportedMessages = [
    {
      id: '1',
      messageId: 'msg_12345',
      messageContent: 'This is a reported message with inappropriate content',
      senderUser: 'EvilUser123',
      senderId: 'user_s01',
      reportedBy: 'Alice',
      reporterId: 'user_001',
      category: 'Nudity or Sexual Content',
      description: 'This message contains inappropriate content',
      reportedAt: '2024-01-15T10:30:00Z',
      status: 'pending'
    },
    {
      id: '2',
      messageId: 'msg_12346',
      messageContent: 'Another reported message',
      senderUser: 'ToxicPlayer',
      senderId: 'user_s02',
      reportedBy: 'Bob',
      reporterId: 'user_002',
      category: 'Harassment or Bullying',
      description: 'User is being harassed',
      reportedAt: '2024-01-14T14:22:00Z',
      status: 'pending'
    },
    {
      id: '3',
      messageId: 'msg_12347',
      messageContent: 'Spam message example',
      senderUser: 'SpammerBot',
      senderId: 'user_s03',
      reportedBy: 'Charlie',
      reporterId: 'user_003',
      category: 'Spam or Solicitation',
      description: 'This appears to be spam',
      reportedAt: '2024-01-13T09:15:00Z',
      status: 'resolved'
    }
  ];

  // Mock reported users data
  const mockReportedUsers = [
    {
      id: '1',
      userId: 'user_123',
      username: 'BadUser',
      reportedBy: 'Alice',
      reportCount: 5,
      lastReport: '2024-01-15T10:30:00Z',
      status: 'active',
      reason: 'Multiple harassment reports'
    }
  ];

  const handleResolveReport = (reportId: string, action: 'delete' | 'warn' | 'ban' | 'dismiss') => {
    clearMessageSelection();
    showToast(`Report ${action === 'delete' ? 'deleted message' :
      action === 'warn' ? 'sent warning' :
        action === 'ban' ? 'banned user' : 'dismissed'} successfully!`, 'success');
  };

  const handleUserAction = (userId: string, action: 'warn' | 'ban' | 'timeout' | 'clear') => {
    showToast(`User ${action === 'warn' ? 'warned' :
      action === 'ban' ? 'banned' :
        action === 'timeout' ? 'timed out' : 'cleared reports'} successfully!`, 'success');
  };

  const handleOpenUserProfile = (report: any, userType: 'sender' | 'reporter', event: React.MouseEvent) => {
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const userId = userType === 'sender' ? report.senderId : report.reporterId;
    const username = userType === 'sender' ? report.senderUser : report.reportedBy;

    // Mock user data for display
    const user = {
      id: userId,
      username: username,
      avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}&backgroundColor=5865f2`,
      status: 'online' as const, // Mock status
      bio: `${username} is ${userType === 'sender' ? 'the sender of this reported message' : 'the user who reported this message'}`,
      joinedAt: '2023-01-15', // Mock join date
      roles: userType === 'reporter' ? ['Member'] : ['Member'] // Mock roles
    };

    // Position the modal relative to the clicked username
    const position = {
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 5
    };

    setUserProfileModal({
      isOpen: true,
      user,
      position,
      triggerRect: rect
    });
  };

  const handleCloseUserProfile = () => {
    setUserProfileModal({ isOpen: false, user: null });
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => setActiveSubTab('reports')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSubTab === 'reports'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
          >
            Reports ({mockReportedMessages.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSubTab === 'users'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
          >
            Reported Users
          </button>
          <button
            onClick={() => setActiveSubTab('messages')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSubTab === 'messages'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
          >
            Message Queue
          </button>
        </div>

        {/* Content based on active sub-tab */}
        {activeSubTab === 'reports' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white">Reported Messages & Users</h2>
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 w-64"
              />
            </div>

            <div className="space-y-4">
              {mockReportedMessages
                .filter(report =>
                  searchTerm === '' ||
                  report.messageContent.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  report.reportedBy.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((report) => (
                  <div key={report.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-red-400 text-sm font-medium">Message by</span>
                            <span
                              onClick={(e) => handleOpenUserProfile(report, 'sender', e)}
                              className="text-red-400 text-sm font-medium hover:text-red-300 cursor-pointer transition-colors hover:underline"
                              title={`View ${report.senderUser}'s profile`}
                            >
                              {report.senderUser}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-400 text-sm">Reported by</span>
                            <span
                              onClick={(e) => handleOpenUserProfile(report, 'reporter', e)}
                              className="text-gray-400 text-sm hover:text-gray-300 cursor-pointer transition-colors hover:underline"
                              title={`View ${report.reportedBy}'s profile`}
                            >
                              {report.reportedBy}
                            </span>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${report.status === 'pending' ? 'bg-yellow-600 text-white' :
                              'bg-green-600 text-white'
                            }`}>
                            {report.status}
                          </span>
                        </div>
                        <div
                          className="bg-gray-800 rounded p-3 mb-2 cursor-pointer hover:bg-gray-750 transition-colors duration-200"
                          onPointerDown={() => handleMessagePointerDown(report.messageId)}
                          onPointerUp={handleMessagePointerUp}
                          onPointerLeave={handleMessagePointerLeave}
                        >
                          <p className="text-white text-sm">{report.messageContent}</p>
                        </div>
                        <div className="text-xs text-gray-400">
                          {report.category} • {new Date(report.reportedAt).toLocaleString()}
                        </div>
                        {report.description && (
                          <div className="text-xs text-gray-500 mt-1">
                            "{report.description}"
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleResolveReport(report.id, 'delete')}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Delete Message
                      </button>
                      <button
                        onClick={() => handleResolveReport(report.id, 'warn')}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Warn User
                      </button>
                      <button
                        onClick={() => handleResolveReport(report.id, 'dismiss')}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeSubTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white">Reported Users</h2>
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 w-64"
              />
            </div>

            <div className="space-y-4">
              {mockReportedUsers
                .filter(user =>
                  searchTerm === '' ||
                  user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  user.reason.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((user) => (
                  <div key={user.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img
                          src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=5865f2`}
                          alt={user.username}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <div className="text-white font-medium">{user.username}</div>
                          <div className="text-gray-400 text-sm">{user.reportCount} reports</div>
                          <div className="text-gray-500 text-xs">{user.reason}</div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUserAction(user.id, 'warn')}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Warn
                        </button>
                        <button
                          onClick={() => handleUserAction(user.id, 'timeout')}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Timeout
                        </button>
                        <button
                          onClick={() => handleUserAction(user.id, 'ban')}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Ban
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeSubTab === 'messages' && (
          <div>
            <h2 className="text-lg font-medium text-white mb-6">Message Moderation Queue</h2>
            <div className="text-center text-gray-400 py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p>No messages in moderation queue</p>
              <p className="text-sm text-gray-500 mt-2">
                All messages are currently passing automatic moderation
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Message Selection Modal Overlay */}
      {selectedMessageId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-md mx-auto shadow-2xl border border-gray-700 transform scale-105">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Message Options</h3>
                <button
                  onClick={clearMessageSelection}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <p className="text-white text-sm">
                  {mockReportedMessages.find(msg => msg.messageId === selectedMessageId)?.messageContent}
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleResolveReport(
                    mockReportedMessages.find(msg => msg.messageId === selectedMessageId)?.id || '',
                    'delete'
                  )}
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Message</span>
                </button>

                <button
                  onClick={() => handleResolveReport(
                    mockReportedMessages.find(msg => msg.messageId === selectedMessageId)?.id || '',
                    'warn'
                  )}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span>Send Warning</span>
                </button>

                <button
                  onClick={() => handleResolveReport(
                    mockReportedMessages.find(msg => msg.messageId === selectedMessageId)?.id || '',
                    'dismiss'
                  )}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Dismiss Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {userProfileModal.isOpen && (
        <UserProfileModal
          isOpen={true}
          onClose={handleCloseUserProfile}
          user={userProfileModal.user}
          currentUserId="user_current_admin" // Mock current admin user ID
          position={userProfileModal.position}
          triggerRect={userProfileModal.triggerRect}
        />
      )}
    </div>
  );
}
