import { Link } from "react-router";
import { useState, useEffect } from "react";
import { ChannelCreationModal } from "../components/ChannelCreationModal";

export function meta() {
  return [
    { title: "Server Control Panel - Pufferblow" },
    { name: "description", content: "Manage and configure your server settings" },
  ];
}

export default function ControlPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'channels' | 'settings' | 'security'>('overview');
  const [channelCreationModalOpen, setChannelCreationModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Mock loading state

  // Mock loading simulation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Simulate 2 second loading

    return () => clearTimeout(timer);
  }, []);

  const handleCreateChannel = async (channelData: { name: string; type: 'text' | 'voice'; description?: string; isPrivate?: boolean }) => {
    // Mock channel creation - in a real app, this would call an API
    console.log('Creating channel:', channelData);
    setChannelCreationModalOpen(false);
  };

  // Show skeleton loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none relative animate-pulse">
        {/* Sidebar Skeleton */}
        <div className="w-16 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col items-center py-4 space-y-2">
          {/* Back to Dashboard Skeleton */}
          <div className="w-12 h-12 bg-gray-600 rounded-2xl flex items-center justify-center mb-4">
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
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ) },
    { id: 'members', label: 'Members', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ) },
    { id: 'channels', label: 'Channels', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ) },
  ];

  return (
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
          {activeTab === 'members' && <MembersTab />}
          {activeTab === 'channels' && <ChannelsTab onOpenChannelModal={() => setChannelCreationModalOpen(true)} />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'security' && <SecurityTab />}
        </div>
      </div>

      <ChannelCreationModal
        isOpen={channelCreationModalOpen}
        onClose={() => setChannelCreationModalOpen(false)}
        onCreateChannel={handleCreateChannel}
      />
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
function MembersTab() {
  const [searchTerm, setSearchTerm] = useState('');

  const mockMembers = [
    { id: '1', username: 'Alice', role: 'Member', status: 'online', joinedAt: '2023-01-15' },
    { id: '2', username: 'Bob', role: 'Admin', status: 'offline', joinedAt: '2023-01-10' },
    { id: '3', username: 'Charlie', role: 'Moderator', status: 'online', joinedAt: '2023-02-20' },
    { id: '4', username: 'Diana', role: 'Member', status: 'idle', joinedAt: '2023-03-05' },
  ];

  const filteredMembers = mockMembers.filter(member =>
    member.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          {filteredMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  member.status === 'online' ? 'bg-green-500' :
                  member.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-white font-medium">{member.username}</span>
                <span className={`px-2 py-1 text-xs rounded ${
                  member.role === 'Admin' ? 'bg-red-600' :
                  member.role === 'Moderator' ? 'bg-purple-600' : 'bg-gray-600'
                } text-white`}>
                  {member.role}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                Joined {member.joinedAt}
              </div>
              <div className="flex space-x-2">
                <button className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Channels Tab Component
function ChannelsTab({ onOpenChannelModal }: { onOpenChannelModal: () => void }) {
  const [channels, setChannels] = useState([
    { id: '1', name: 'general', type: 'text', isPrivate: false },
    { id: '2', name: 'random', type: 'text', isPrivate: false },
    { id: '3', name: 'announcements', type: 'text', isPrivate: false },
    { id: '4', name: 'voice-chat', type: 'voice', isPrivate: true },
  ]);

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
            <div key={channel.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-gray-400">#</span>
                <span className="text-white font-medium">{channel.name}</span>
                {channel.isPrivate && (
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
                <span className={`px-2 py-1 text-xs rounded text-white ${
                  channel.type === 'voice' ? 'bg-purple-600' : 'bg-gray-600'
                }`}>
                  {channel.type}
                </span>
              </div>
              <div className="flex space-x-2">
                <button className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button className="text-gray-400 hover:text-red-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
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
