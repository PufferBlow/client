// API Client
export { ApiClient, createApiClient } from './apiClient';
export type { ApiResponse } from './apiClient';

// User services
export {
  login,
  signup,
  getUserProfile,
  extractUserIdFromToken
} from './user';
export type {
  LoginCredentials,
  SignupCredentials,
  AuthToken,
  UserProfile
} from './user';

// Channel services (enhanced with all API reference features)
export {
  getChannels,
  listChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  loadMessages,
  sendMessage,
  addUserToChannel,
  removeUserFromChannel,
  deleteMessage,
  markMessageAsRead
} from './channel';
export type {
  CreateChannelRequest
} from './channel';

// CDN services (Server Owner only)
export {
  listCDNFiles,
  deleteCDNFile,
  getCDNFileInfo,
  cleanupOrphanedFiles
} from './cdn';
export type {
  CDNFile,
  CDNFileInfo
} from './cdn';

// Security services (Server Owner only)
export {
  listBlockedIPs,
  blockIP,
  unblockIP
} from './security';
export type {
  BlockedIP,
  BlockIPRequest
} from './security';

// Background Tasks services (Server Owner only)
export {
  getBackgroundTaskStatuses,
  runBackgroundTask
} from './backgroundTasks';
export type {
  BackgroundTask
} from './backgroundTasks';

// System Statistics & Charts
export {
  getServerStats,
  getLatestRelease,
  getUserRegistrationsChart,
  getMessageActivityChart,
  getOnlineUsersChart,
  getChannelCreationChart,
  getUserStatusChart
} from './system';
export type {
  ServerStats,
  GithubRelease,
  ChartData,
  Period
} from './system';

// WebSocket Real-time Messaging
export {
  GlobalWebSocket,
  createGlobalWebSocket,
  createChannelWebSocket,
  getHostPortForWebSocket
} from './websocket';
export type {
  WebSocketMessage,
  WebSocketCallbacks
} from './websocket';
