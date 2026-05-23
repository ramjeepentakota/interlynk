/* InterLynk app context — backed by the live backend.
   Covers channels, direct messages (inbox), people search, and 1-on-1
   voice / video calls. Voice CHANNELS (ambient, Discord-style) have been
   removed from the product. */
import { createContext, useContext } from 'react';
import type { Attachment, Channel, Conversation, DirectMessageItem, Message, User } from './data';

export type Screen = 'login' | 'app';
export type Theme = 'dark' | 'light';
export type Accent = 'gold' | 'rose' | 'emerald' | 'amber' | 'coral';

/** A 1-on-1 or group call is either an audio-only ("voice") call or a video
 *  call. This is NOT a Discord-style ambient voice channel — those have been
 *  removed. */
export type CallType = 'video' | 'voice';

export interface IncomingCall {
  roomId: number;
  callerUserId: number;
  callerUsername: string;
  callerDisplayName: string;
  callerAvatarUrl?: string;
  callType: CallType;
}

/** An active call session. The roomId doubles as the LiveKit room. */
export interface CallSession {
  roomId: number;
  callType: CallType;
  title: string;
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
  /** Mutate the signed-in user locally (e.g. after a profile-pic upload). */
  patchCurrentUser: (patch: Partial<User>) => void;

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
  reloadChannels: () => Promise<void>;
  createChannel: (name: string) => Promise<void>;

  // Messages
  messages: Record<string, Message[]>;
  messagesLoading: boolean;
  sendMessage: (channelId: string, content: string, attachments?: Attachment[]) => Promise<void>;
  reactToMessage: (channelId: string, messageId: string, emoji: string) => Promise<void>;
  /** Upload a file to the active channel; returns the persisted attachment. */
  uploadAttachment: (channelId: string, file: File | Blob, filename?: string) => Promise<Attachment>;
  /** Create a poll in a channel (posts a poll message). */
  createPoll: (channelId: string, question: string, options: string[], allowMultiple: boolean) => Promise<void>;
  /** Cast (or change) the current user's vote on a poll. */
  votePoll: (channelId: string, pollId: string, optionIds: string[]) => Promise<void>;
  /** Mark a single message read by the current user (advances the sender's ticks). */
  markMessageRead: (channelId: string, messageId: string) => void;
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

  // Calls (1-on-1 voice/video, no ambient voice channel)
  inCall: boolean;
  setInCall: (v: boolean) => void;
  callSession: CallSession | null;
  startChannelCall: (type: CallType) => Promise<void>;
  startDirectCall: (user: User, type: CallType) => Promise<void>;
  /** Host-launch a scheduled call: 1:1 rings the invitee, group opens a room. */
  startScheduledCall: (call: {
    callType: CallType;
    title: string;
    invitees: { userId: number; username: string; displayName?: string; avatarUrl?: string }[];
  }) => Promise<void>;
  /** Invitee/host join an EXISTING scheduled call room (status === ACTIVE). */
  joinScheduledCall: (call: { roomId: number; callType: CallType; title: string }) => Promise<void>;
  endCurrentCall: () => Promise<void>;
  incomingCall: IncomingCall | null;
  setIncomingCall: (c: IncomingCall | null) => void;
  acceptIncomingCall: () => Promise<void>;
  callEndReason: 'declined' | 'ended' | null;
  setCallEndReason: (r: 'declined' | 'ended' | null) => void;

  // Channel members / invite
  inviteToChannel: (channelId: string, username: string) => Promise<void>;
}

export const AppCtx = createContext<AppCtxValue | null>(null);

export const useApp = (): AppCtxValue => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppCtx.Provider');
  return ctx;
};
