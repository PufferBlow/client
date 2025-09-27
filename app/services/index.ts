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

// Channel services
export {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel
} from './channel';
export type {
  CreateChannelRequest
} from './channel';

// Message services
export {
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  searchMessages
} from './message';
export type {
  Attachment,
  Reaction,
  SendMessageRequest,
  SearchResult
} from './message';

// Server services
export {
  getServers,
  getServer,
  createServer,
  updateServer,
  deleteServer,
  joinServer,
  leaveServer,
  getServerInvites,
  createInvite,
  deleteInvite
} from './server';
export type {
  Server,
  CreateServerRequest,
  Invite,
  CreateInviteRequest
} from './server';
