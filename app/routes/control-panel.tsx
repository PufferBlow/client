import { Link } from "react-router";
import { useState, useEffect } from "react";
import { ChannelCreationModal } from "../components/ChannelCreationModal";
import { UserProfileModal } from "../components/UserProfileModal";
import { getAuthTokenFromCookies, listUsers, type ListUsersResponse } from "../services/user";
import { listChannels, deleteChannel, createChannel } from "../services/channel";
import { logger } from "../utils/logger";
import type { Channel } from "../models";

export function meta() {
  return [
    { title: "Server Control Panel - Pufferblow" },
    { name: "description", content: "Manage and configure your server settings" },
  ];
}

export default function ControlPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'members' | 'channels' | 'tasks' | 'settings' | 'security'>('overview');
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Mock loading state

  // Settings state
  const [serverName, setServerName] = useState('General Server');
  const [description, setDescription] = useState('A decentralized messaging community');
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxImageSize, setMaxImageSize] = useState(5); // MB
  const [maxVideoSize, setMaxVideoSize] = useState(100); // MB
  const [maxFileSize, setMaxFileSize] = useState(50); // MB
  const [maxMessageLength, setMaxMessageLength] = useState(4000);
  const [allowedImageTypes, setAllowedImageTypes] = useState('PNG, JPG, JPEG, GIF, WebP');
  const [allowedVideoTypes, setAllowedVideoTypes] = useState('MP4, WebM');
  const [allowedFileTypes, setAllowedFileTypes] = useState('PDF, DOC, DOCX, TXT, ZIP');

  // Channels state for the control panel
  const [controlPanelChannels, setControlPanelChannels] = useState<Channel[]>([]);

  // Users state for the control panel
  const [controlPanelUsers, setControlPanelUsers] = useState<ListUsersResponse['users']>([]);

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

  // Mock loading simulation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Simulate 2 second loading

    return () => clearTimeout(timer);
  }, []);

  // Fetch channels and users for control panel
  useEffect(() => {
    const fetchChannels = async () => {
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) return;

      const response = await listChannels(authToken);
      if (response.success && response.data && response.data.channels) {
        setControlPanelChannels(response.data.channels);
        logger.ui.info("Channels fetched successfully for control panel", { count: response.data.channels.length });
      } else {
        logger.ui.error("Failed to fetch channels for control panel", { error: response.error });
        setControlPanelChannels([]);
      }
    };

    const fetchUsers = async () => {
      const authToken = getAuthTokenFromCookies() || '';

      if (!authToken) return;

      const response = await listUsers(authToken);
      if (response.success && response.data && response.data.users) {
        setControlPanelUsers(response.data.users);
        logger.ui.info("Users fetched successfully for control panel", { count: response.data.users.length });
      } else {
        logger.ui.error("Failed to fetch users for control panel", { error: response.error });
        setControlPanelUsers([]);
      }
    };

    fetchChannels();
    fetchUsers();
  }, []);

  const handleCreateChannel = async (channelData: { name: string; type: 'text' | 'voice'; description?: string; isPrivate?: boolean }) => {
    try {
      const authToken = getAuthTokenFromCookies() || '';

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
        <div className="h-screen bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none relative animate-pulse">
          {/* Sidebar Skeleton */}
          <div className="w-16 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col items-center py-4 space-y-2">
            {/* Back to Dashboard Skeleton */}
            <div className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-2xl flex items-center justify-center text-white mb-4">
              <div className="w-6 h-6 bg-gray-500 rounded"></div>
            </div>
            {/* Tab Icons Skeleton */}
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-12 h-12 bg-gray-700 rounded-2xl"></div>
              ))}
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="flex-1 flex flex-col">
            {/* Header Skeleton */}
            <div className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-6">
              <div className="w-64 h-6 bg-gray-700 rounded"></div>
              <div className="ml-auto w-16 h-6 bg-gray-700 rounded"></div>
            </div>

            {/* Content Area Skeleton */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Statistics Cards Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
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
                  <div key={i} className="bg-gray-700 rounded-lg p-4">
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

              {/* Recent Activity Skeleton */}
              <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)] mt-6">
                <div className="h-6 bg-gray-700 rounded mb-4 w-48"></div>
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
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
      <ChannelCreationModal
        isOpen={channelCreationModalOpen}
        onClose={() => setChannelCreationModalOpen(false)}
        onCreateChannel={handleCreateChannel}
      />


    </>
  );
}

  const tabs = [
    { id: 'overview', label: 'Overview', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ) },
    { id: 'moderation', label: 'Moderation', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ) },
    { id: 'members', label: 'Members', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ) },
    { id: 'channels', label: 'Channels', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 01-9 9H9l-6 3V9a9 9 0 019-9h3a9 9 0 019 9z" />
      </svg>
    ) },
    { id: 'tasks', label: 'Tasks', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ) },
    { id: 'settings', label: 'Settings', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ) },
    { id: 'security', label: 'Security', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ) },
  ];

  return (
    <>
      <div className="h-screen bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none relative">
        {/* Sidebar */}
        <div className="w-16 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col items-center py-4 space-y-2">
          {/* Back to Dashboard */}
          <Link
            to="/dashboard"
            className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-2xl flex items-center justify-center text-white mb-4 transition-colors"
            title="Back to Dashboard"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>

          {/* Navigation Tabs */}
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title={`${tab.label} - ${tab.id === 'overview' ? 'View server statistics and recent activity' :
                                    tab.id === 'members' ? 'Manage server members and roles' :
                                    tab.id === 'channels' ? 'Create and manage channels' :
                                    tab.id === 'settings' ? 'Configure server settings and limits' :
                                    'Manage security and moderation'}`}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-white">
                {tabs.find(tab => tab.id === activeTab)?.label} - Server Control Panel
              </h1>
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">OWNER</span>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'moderation' && <ModerationTab showToast={showToast} />}
            {activeTab === 'members' && <MembersTab users={controlPanelUsers} showToast={showToast} />}
            {activeTab === 'channels' && <ChannelsTab
              onOpenChannelModal={() => setChannelCreationModalOpen(true)}
              channels={controlPanelChannels}
              setChannels={setControlPanelChannels}
              showToast={showToast}
            />}
            {activeTab === 'tasks' && <TasksTab showToast={showToast} />}
            {activeTab === 'settings' && <SettingsTab />}
            {activeTab === 'security' && <SecurityTab />}
          </div>
        </div>
      </div>
      <ChannelCreationModal
        isOpen={channelCreationModalOpen}
        onClose={() => setChannelCreationModalOpen(false)}
        onCreateChannel={handleCreateChannel}
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

// Overview Tab Component
function OverviewTab() {
  const [viewMode, setViewMode] = useState<'numbers' | 'diagram'>('numbers');

  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-white">Server Statistics</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('numbers')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'numbers'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
              }`}
            >
              Numbers
            </button>
            <button
              onClick={() => setViewMode('diagram')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'diagram'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
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
              <div className="bg-gradient-to-br from-slate-700 to-slate-600 rounded-lg p-4 border border-slate-600">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg text-slate-300">Online Now</div>
                    <div className="text-3xl font-bold text-white">47</div>
                  </div>
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-800 to-emerald-700 rounded-lg p-4 border border-emerald-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg text-emerald-300">New This Week</div>
                    <div className="text-3xl font-bold text-white">+157</div>
                  </div>
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="bg-gradient-to-br from-cyan-800 to-cyan-700 rounded-lg p-4 border border-cyan-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg text-cyan-300">Messages Today</div>
                    <div className="text-3xl font-bold text-white">2.8k</div>
                  </div>
                  <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </div>
              <div className="bg-gradient-to-br from-amber-800 to-amber-700 rounded-lg p-4 border border-amber-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg text-amber-300">Server Health</div>
                    <div className="text-3xl font-bold text-white">92%</div>
                  </div>
                  <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <div className="text-xl font-bold text-slate-300">124</div>
                    <div className="text-xs text-gray-400">Total Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-300">12</div>
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

              {/* Resource Usage */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Resource Usage
                </h3>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-300">4.2GB</div>
                  <div className="text-xs text-gray-400 mb-2">Storage Used</div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div className="bg-gradient-to-r from-emerald-600 to-amber-600 h-2 rounded-full" style={{ width: '42%' }}></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">of total capacity</div>
                </div>
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
            {/* Mock Diagram/Chart Area */}
            <div className="bg-gray-700 rounded-lg p-6 h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Activity Trends</h3>
                <p className="text-gray-400">Interactive charts would be displayed here showing:</p>
                <ul className="text-sm text-gray-500 mt-2 space-y-1">
                  <li>• Daily message activity over time</li>
                  <li>• Member growth patterns</li>
                  <li>• Channel usage statistics</li>
                  <li>• Peak activity hours</li>
                </ul>
              </div>
            </div>

            {/* Additional Diagram Components */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-md font-semibold text-white mb-3">Messages per Hour (Last 24h)</h4>
                <div className="h-32 flex items-end space-x-2">
                  {Array.from({ length: 24 }, (_, i) => (
                    <div
                      key={i}
                      className="bg-blue-500 rounded-t flex-1 transition-all hover:bg-blue-400"
                      style={{ height: `${Math.random() * 80 + 20}%` }}
                      title={`${i}:00 - ${Math.floor(Math.random() * 20 + 5)} messages`}
                    ></div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>00:00</span>
                  <span>12:00</span>
                  <span>23:59</span>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-md font-semibold text-white mb-3">Member Activity</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Very Active</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-600 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full w-3/4"></div>
                      </div>
                      <span className="text-white text-sm">110</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Active</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-600 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full w-1/2"></div>
                      </div>
                      <span className="text-white text-sm">9</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Inactive</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-600 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full w-1/4"></div>
                      </div>
                      <span className="text-white text-sm">5</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <h2 className="text-lg font-medium text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">
              J
            </div>
            <div className="flex-1">
              <div className="text-sm text-white">John joined the server</div>
              <div className="text-xs text-gray-400">2 minutes ago</div>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
              A
            </div>
            <div className="flex-1">
              <div className="text-sm text-white">Alice created #general-discussion</div>
              <div className="text-xs text-gray-400">1 hour ago</div>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm">
              M
            </div>
            <div className="flex-1">
              <div className="text-sm text-white">Moderator role assigned to Charlie</div>
              <div className="text-xs text-gray-400">3 hours ago</div>
            </div>
          </div>
        </div>
      </div>

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
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--color-surface)] shadow-sm ${
                    user.status === 'online' ? 'bg-green-400' :
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

  // No need for local fetch - channels are passed down from parent

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
function SettingsTab() {
  const [serverName, setServerName] = useState('General Server');
  const [description, setDescription] = useState('A decentralized messaging community');
  const [isPrivate, setIsPrivate] = useState(false);

  // Media and file upload settings
  const [maxImageSize, setMaxImageSize] = useState(5); // MB
  const [maxVideoSize, setMaxVideoSize] = useState(100); // MB
  const [maxFileSize, setMaxFileSize] = useState(50); // MB
  const [maxMessageLength, setMaxMessageLength] = useState(4000);

  const [allowedImageTypes, setAllowedImageTypes] = useState('PNG, JPG, JPEG, GIF, WebP');
  const [allowedVideoTypes, setAllowedVideoTypes] = useState('MP4, WebM');
  const [allowedFileTypes, setAllowedFileTypes] = useState('PDF, DOC, DOCX, TXT, ZIP');

  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <h2 className="text-lg font-medium text-white mb-6">Server Settings</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Server Name
            </label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPrivate"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="mr-3"
            />
            <label htmlFor="isPrivate" className="text-sm font-medium text-gray-300">
              Make server private (invite only)
            </label>
          </div>

          {/* Media Upload Settings */}
          <div className="pt-4 border-t border-gray-600">
            <h3 className="text-md font-medium text-white mb-4">Media & File Upload Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300">Image Upload</h4>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Maximum Image Size (MB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={maxImageSize}
                    onChange={(e) => setMaxImageSize(parseInt(e.target.value))}
                    className="w-full bg-gray-700 text-white px-3 py-2 text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Supported Image Types
                  </label>
                  <input
                    type="text"
                    value={allowedImageTypes}
                    onChange={(e) => setAllowedImageTypes(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                    placeholder="PNG, JPG, JPEG, GIF"
                  />
                  <p className="text-xs text-gray-500 mt-1">Comma-separated list of allowed file extensions</p>
                </div>
              </div>

              {/* Video Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300">Video Upload</h4>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Maximum Video Size (MB)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={maxVideoSize}
                    onChange={(e) => setMaxVideoSize(parseInt(e.target.value))}
                    className="w-full bg-gray-700 text-white px-3 py-2 text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Supported Video Types
                  </label>
                  <input
                    type="text"
                    value={allowedVideoTypes}
                    onChange={(e) => setAllowedVideoTypes(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                    placeholder="MP4, WebM"
                  />
                  <p className="text-xs text-gray-500 mt-1">Comma-separated list of allowed file extensions</p>
                </div>
              </div>

              {/* File Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300">File Upload</h4>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Maximum File Size (MB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={maxFileSize}
                    onChange={(e) => setMaxFileSize(parseInt(e.target.value))}
                    className="w-full bg-gray-700 text-white px-3 py-2 text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Supported File Types
                  </label>
                  <input
                    type="text"
                    value={allowedFileTypes}
                    onChange={(e) => setAllowedFileTypes(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                    placeholder="PDF, DOC, DOCX, TXT"
                  />
                  <p className="text-xs text-gray-500 mt-1">Comma-separated list of allowed file extensions</p>
                </div>
              </div>

              {/* Message Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300">Message Limits</h4>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Maximum Message Length (characters)
                  </label>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    value={maxMessageLength}
                    onChange={(e) => setMaxMessageLength(parseInt(e.target.value))}
                    className="w-full bg-gray-700 text-white px-3 py-2 text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Prevents database storage issues from excessively long messages
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-600">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
              Save Changes
            </button>
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
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === 'reports'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            Reports ({mockReportedMessages.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === 'users'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            Reported Users
          </button>
          <button
            onClick={() => setActiveSubTab('messages')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === 'messages'
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
                          <span className={`px-2 py-1 rounded text-xs ${
                            report.status === 'pending' ? 'bg-yellow-600 text-white' :
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
