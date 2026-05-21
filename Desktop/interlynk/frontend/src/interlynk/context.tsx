/* InterLynk app context — backed by the live backend.
   Covers channels, direct messages (inbox), people search, voice channels and
   LiveKit-powered calls. */
import { createContext, useContext } from 'react';
import type { Channel, Conversation, DirectMessageItem, Message, User } from './data';

export type Screen = 'login' | 'app';
export type Theme = 'dark' | 'light';
export type Accent = 'violet' | 'rose' | 'emerald' | 'amber' | 'coral';
export type CallType = 'video' | 'voice';

export interface IncomingCall {
  roomId: number;
  callerUserId: number;
  callerUsername: string;
  callerDisplayName: string;
  callerAvatarUrl?: string;
  callType: CallType;
}

/** An active call/voice-channel session. The roomId doubles as the LiveKit room. */
export interface CallSession {
  roomId: number;
  callType: CallType;
  title: string;
  isVoiceChannel: boolean;
  /** Channel id when this session is a voice channel (used on leave). */
  channelId?: string;
  /** Target user ID for 1-on-1 WebRTC signaling. */
  targetUserId?: number | null;
  /** Whether current user initiated the call (WebRTC offer/answer role). */
  isInitiator?: boolean;
}

export interface UiNotification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AppCtxValue {
  screen: Screen;
  setScreen: (s: Screen) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: Accent;
  setAccent: (a: Accent) => void;

  // Auth / users
  currentUser: User | null;
  usersById: Record<string, User>;
  getUser: (id: string) => User;
  registerUsers: (users: (User | undefined)[]) => void;
  searchUsers: (query: string) => Promise<User[]>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;

  // Navigation
  activeChannel: string | null;
  selectChannel: (id: string | null) => void;
  activeView: string;
  setActiveView: (v: string) => void;
  sideOpen: boolean;
  setSideOpen: (v: boolean) => void;
  rightOpen: boolean;
  setRightOpen: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  showTweaks: boolean;
  setShowTweaks: (v: boolean) => void;
  showNotif: boolean;
  setShowNotif: (v: boolean) => void;
  showAdmin: boolean;
  setShowAdmin: (v: boolean) => void;

  // Channels
  channels: Channel[];
  voiceChannels: Channel[];
  reloadChannels: () => Promise<void>;
  createChannel: (name: string) => Promise<void>;

  // Messages
  messages: Record<string, Message[]>;
  messagesLoading: boolean;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  reactToMessage: (channelId: string, messageId: string, emoji: string) => Promise<void>;
  threadMsg: Message | null;
  setThreadMsg: (m: Message | null) => void;

  // Typing
  typingByChannel: Record<string, string[]>;
  notifyTyping: (channelId: string, isTyping: boolean) => void;

  // Direct messages (inbox)
  conversations: Conversation[];
  reloadConversations: () => Promise<void>;
  dmUnread: number;
  activeDm: string | null;
  activeDmUser: User | null;
  openDm: (user: User) => void;
  closeDm: () => void;
  dmMessages: Record<string, DirectMessageItem[]>;
  dmLoading: boolean;
  sendDm: (content: string) => Promise<void>;

  // Profile card
  profileUser: User | null;
  openProfile: (user: User) => void;
  closeProfile: () => void;

  // Notifications
  notifications: UiNotification[];
  unreadCount: number;
  markAllNotificationsRead: () => Promise<void>;

  // Voice channels
  voiceParticipants: Record<string, User[]>;
  refreshVoiceParticipants: (channelId: string) => Promise<void>;
  joinVoiceChannel: (channel: Channel) => Promise<void>;

  // Calls
  inCall: boolean;
  setInCall: (v: boolean) => void;
  callSession: CallSession | null;
  startChannelCall: (type: CallType) => Promise<void>;
  startDirectCall: (user: User, type: CallType) => Promise<void>;
  endCurrentCall: () => Promise<void>;
  incomingCall: IncomingCall | null;
  setIncomingCall: (c: IncomingCall | null) => void;
  acceptIncomingCall: () => Promise<void>;
  callEndReason: 'declined' | 'ended' | null;
  setCallEndReason: (r: 'declined' | 'ended' | null) => void;

  // Voice channels (create)
  createVoiceChannel: (name: string) => Promise<void>;

  // Channel members / invite
  inviteToChannel: (channelId: string, username: string) => Promise<void>;
}

export const AppCtx = createContext<AppCtxValue | null>(null);

export const useApp = (): AppCtxValue => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppCtx.Provider');
  return ctx;
};
