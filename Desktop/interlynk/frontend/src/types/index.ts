// User Types
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  status: UserStatus;
  role?: UserRole;
  roles?: string[];
  createdAt: string;
  updatedAt: string;
}

export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

export type UserRole = 'ADMIN' | 'USER' | 'GUEST';

// Workspace Types
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members: WorkspaceMember[];
  channels: Channel[];
  teams: Team[];
}

export interface WorkspaceMember {
  userId: string;
  user: User;
  workspaceId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

// Team Types
export interface Team {
  id: string;
  name: string;
  workspaceId: string;
  description?: string;
  icon?: string;
  members: TeamMember[];
  createdAt: string;
}

export interface TeamMember {
  userId: string;
  user: User;
  teamId: string;
  role: TeamRole;
  joinedAt: string;
}

export type TeamRole = 'LEADER' | 'MEMBER';

// Channel Types
export interface ChannelMember {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: 'ADMIN' | 'MODERATOR' | 'MEMBER';
  joinedAt: string;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  workspaceId: string;
  teamId?: string;
  description?: string;
  isPrivate: boolean;
  position: number;
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  members?: ChannelMember[];
  memberCount?: number;
  createdByUsername?: string;
  isLocked?: boolean;
}

export type ChannelType = 'TEXT' | 'VOICE' | 'VIDEO' | 'ANNOUNCEMENT' | 'PUBLIC' | 'PRIVATE';

// Message Types
export interface Message {
  id: string;
  content: string;
  channelId: string;
  senderId: string;
  sender: User;
  replyToId?: string;
  replyTo?: Message;
  attachments: Attachment[];
  reactions: Reaction[];
  threadCount: number;
  isEdited: boolean;
  isPinned?: boolean;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  fileType: string;
  size: number;
  messageId: string;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  user: User;
  messageId: string;
  count: number;
  hasReacted: boolean;
}

// Thread Types
export interface Thread {
  id: string;
  parentMessageId: string;
  messages: Message[];
  participants: User[];
  createdAt: string;
}

// Call Types
export interface CallRoom {
  id: string;
  name: string;
  type: CallType;
  channelId?: string;
  isActive: boolean;
  hostId: string;
  participants: CallParticipant[];
  maxParticipants: number;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

export type CallType = 'AUDIO' | 'VIDEO' | 'VOICE_CHANNEL' | 'GROUP' | 'ONE_TO_ONE' | 'DIRECT';

export interface CallParticipant {
  id: string;
  userId: string;
  user: User;
  callRoomId: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  isHandRaised: boolean;
  joinedAt: string;
}

// Voice Channel Types
export interface VoiceChannel {
  id: string;
  channelId: string;
  channel: Channel;
  participants: VoiceParticipant[];
}

export interface VoiceParticipant {
  userId: string;
  user: User;
  channelId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  joinedAt: string;
}

// Code Collaboration Types
export interface CodeSession {
  id: string;
  name: string;
  language: string;
  content: string;
  participants: User[];
  cursorPositions: CursorPosition[];
  createdAt: string;
  updatedAt: string;
}

export interface CursorPosition {
  userId: string;
  user: User;
  line: number;
  column: number;
}

export interface CodeRepository {
  id: string;
  name: string;
  description?: string;
  language: string;
  files: CodeFile[];
  createdAt: string;
  updatedAt: string;
}

export interface CodeFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirectory: boolean;
  children?: CodeFile[];
}

export interface CodeExecution {
  id: string;
  code: string;
  language: string;
  output: string;
  error?: string;
  status: ExecutionStatus;
  executionTime: number;
  createdAt: string;
}

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR';

// Code Review Types
export interface PullRequest {
  id: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  author: User;
  reviewers: User[];
  status: PullRequestStatus;
  comments: PullRequestComment[];
  createdAt: string;
  updatedAt: string;
}

export type PullRequestStatus = 'OPEN' | 'MERGED' | 'CLOSED';

export interface PullRequestComment {
  id: string;
  content: string;
  author: User;
  pullRequestId: string;
  line?: number;
  createdAt: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  userId: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export type NotificationType = 
  | 'MESSAGE' 
  | 'MENTION' 
  | 'REPLY' 
  | 'REACTION'
  | 'CALL_INVITE'
  | 'PULL_REQUEST'
  | 'SYSTEM';

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}

// UI State Types
export interface UIState {
  sidebarOpen: boolean;
  rightSidebarOpen: boolean;
  activePanel: PanelType;
  theme: 'dark' | 'light';
}

export type PanelType = 'CHAT' | 'CALL' | 'VOICE' | 'CODE' | 'SETTINGS';

// WebSocket Event Types
export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
}

export type WebSocketEventType = 
  | 'MESSAGE_SENT'
  | 'MESSAGE_UPDATED'
  | 'MESSAGE_DELETED'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'TYPING_START'
  | 'TYPING_STOP'
  | 'CALL_STARTED'
  | 'CALL_ENDED'
  | 'USER_STATUS_CHANGED';
