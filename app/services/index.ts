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
  addUserToChannel,
  removeUserFromChannel
} from './channel';
export type {
  CreateChannelRequest
} from './channel';

// Storage services (Server Owner only)
export {
  listStorageFiles,
  deleteStorageFile,
  getStorageFileInfo,
  cleanupOrphanedFiles
} from './storage';
export type {
  StorageFile,
  StorageFileInfo
} from './storage';

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

// Message services
export {
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  searchMessages,
  loadMessages,
  markMessageAsRead
} from './message';
export type {
  Attachment,
  Reaction,
  SendMessageRequest,
  SearchResult
} from './message';

// Moderation and reporting services
export {
  submitMessageReport,
  submitUserReport,
  banUser,
  unbanUser,
  timeoutUser,
  clearUserTimeout,
} from './moderation';

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

// Decentralized auth services
export {
  issueDecentralizedChallenge,
  verifyDecentralizedChallenge,
  introspectDecentralizedSession,
  revokeDecentralizedSession,
  persistNodeSessionToken,
  clearNodeSessionToken
} from './decentralizedAuth';
export type {
  DecentralizedChallengeResponse,
  DecentralizedVerifyResponse,
  DecentralizedSessionIntrospectResponse
} from './decentralizedAuth';

// Session auth lifecycle services
export {
  startBackgroundAuthRefresh,
  stopBackgroundAuthRefresh,
  refreshAuthSession,
  logoutCurrentSession
} from './authSession';
export type {
  PersistedSessionTokens,
  RefreshSessionResult
} from './authSession';

// Ping services
export {
  sendPing,
  pingInstance,
  ackPing,
  getPingHistory,
  getPendingPings,
  getPingStats,
  dismissPing,
  isPingExpired,
  pingStatusLabel,
} from './ping';
export type {
  SendPingRequest,
  InstancePingRequest,
  SendPingResponse,
  AckPingResponse,
  PingHistoryResponse,
  PingPendingResponse,
  PingStatsResponse,
} from '../models/Ping';

// ActivityPub and federated DM services
export {
  resolveActorHandle,
  getActorDocument,
  getActorOutbox,
  followRemoteAccount,
  sendFederatedDirectMessage,
  loadFederatedDirectMessages,
  getWebFinger,
  getActivityPubActor,
  getActivityPubOutbox,
  followRemoteActor,
  sendDirectMessage,
  loadDirectMessages
} from './activitypub';
export type {
  WebFingerResponse,
  ActivityPubActorDocument,
  ActivityPubOutboxPage,
  FollowRemoteActorResponse,
  SendDirectMessageRequest,
  SendDirectMessageResponse,
  DirectMessagePayload,
  LoadDirectMessagesResponse
} from './activitypub';
