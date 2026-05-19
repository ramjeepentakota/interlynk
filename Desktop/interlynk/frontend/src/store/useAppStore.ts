import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  User, 
  Workspace, 
  Channel, 
  Message, 
  CallRoom, 
  VoiceChannel, 
  Notification,
  UserStatus,
  PanelType 
} from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setTokens: (token: string, refreshToken: string) => void;
  logout: () => void;
}

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  addWorkspace: (workspace: Workspace) => void;
}

interface ChannelState {
  channels: Channel[];
  currentChannel: Channel | null;
  setChannels: (channels: Channel[]) => void;
  setCurrentChannel: (channel: Channel | null) => void;
  addChannel: (channel: Channel) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  // Security helper: check if user is member of current channel
  isCurrentChannelMember: (userId: string) => boolean;
}

interface MessageState {
  messages: Message[];
  threadMessages: Message[];
  isLoading: boolean;
  isSending: boolean;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (messageId: string) => void;
  setThreadMessages: (messages: Message[]) => void;
  addThreadMessage: (message: Message) => void;
  setLoading: (isLoading: boolean) => void;
  setSending: (isSending: boolean) => void;
  clearChannelMessages: (channelId: string) => void;
}

interface IncomingCall {
  roomId: number;
  callerUserId: number;
  callerUsername: string;
  callerDisplayName: string;
  callerAvatarUrl?: string;
  callType: 'voice' | 'video';
}

export interface RemoteUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
}

interface CallState {
  currentCall: CallRoom | null;
  isInCall: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  incomingCall: IncomingCall | null;
  remoteUser: RemoteUser | null;
  setCurrentCall: (call: CallRoom | null) => void;
  setInCall: (isInCall: boolean) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  setIncomingCall: (call: IncomingCall | null) => void;
  clearIncomingCall: () => void;
  setRemoteUser: (user: RemoteUser | null) => void;
}

interface VoiceState {
  currentVoiceChannel: VoiceChannel | null;
  isInVoiceChannel: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  setCurrentVoiceChannel: (channel: VoiceChannel | null) => void;
  setInVoiceChannel: (isInVoiceChannel: boolean) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
}

interface UIState {
  sidebarOpen: boolean;
  rightSidebarOpen: boolean;
  activePanel: PanelType;
  theme: 'dark' | 'light';
  searchOpen: boolean;
  settingsOpen: boolean;
  toggleSidebar: () => void;
  toggleRightSidebar: () => void;
  setActivePanel: (panel: PanelType) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleSearch: () => void;
  toggleSettings: () => void;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  setUnreadCount: (count: number) => void;
}

interface TypingState {
  typingUsers: { userId: string; user: { id: string; displayName: string; avatar?: string }; channelId: string }[];
  addTypingUser: (user: { userId: string; user: { id: string; displayName: string; avatar?: string }; channelId: string }) => void;
  removeTypingUser: (userId: string) => void;
  clearTypingUsers: () => void;
}

// Auth Store
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTokens: (token, refreshToken) => set({ token, refreshToken, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

// Workspace Store
export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  workspaces: [],
  currentWorkspace: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  addWorkspace: (workspace) => set((state) => ({ workspaces: [...state.workspaces, workspace] })),
}));

// Channel Store
export const useChannelStore = create<ChannelState>()(
  persist(
    (set, get) => ({
      channels: [],
      currentChannel: null,
      setChannels: (channels) => set({ channels }),
      setCurrentChannel: (channel) => set({ currentChannel: channel }),
      addChannel: (channel) => set((state) => ({ channels: [...state.channels, channel] })),
      updateChannel: (channelId, updates) =>
        set((state) => ({
          channels: state.channels.map((ch) => (ch.id === channelId ? { ...ch, ...updates } : ch)),
          currentChannel: state.currentChannel?.id === channelId 
            ? { ...state.currentChannel, ...updates } 
            : state.currentChannel,
        })),
      // Security helper: check if user is member of current channel
      isCurrentChannelMember: (userId: string) => {
        const { currentChannel } = get();
        if (!currentChannel || !currentChannel.members) return false;
        return currentChannel.members.some(m => m.id === userId || m.username === userId);
      },
    }),
    {
      name: 'channel-storage',
    }
  )
);

// Message Store - NOT persisted to localStorage to avoid stale data issues
// Messages are always fetched fresh from the API when joining a channel
export const useMessageStore = create<MessageState>()(
  (set, get) => ({
    messages: [],
    threadMessages: [],
    isLoading: false,
    isSending: false,
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => {
      // Deduplicate: if a message with this ID already exists, skip the add
      if (state.messages.some((m) => m.id === message.id)) return state;
      return { messages: [...state.messages, message] };
    }),
    updateMessage: (messageId, updates) =>
      set((state) => ({
        messages: state.messages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg)),
      })),
    deleteMessage: (messageId) =>
      set((state) => ({
        messages: state.messages.filter((msg) => msg.id !== messageId),
      })),
    setThreadMessages: (messages) => set({ threadMessages: messages }),
    addThreadMessage: (message) => set((state) => ({ threadMessages: [...state.threadMessages, message] })),
    setLoading: (isLoading) => set({ isLoading }),
    setSending: (isSending) => set({ isSending }),
    // Clear messages for a specific channel (when switching channels)
    clearChannelMessages: (channelId: string) => set((state) => ({
      messages: state.messages.filter((msg) => msg.channelId !== channelId),
    })),
  })
);

// Call Store
export const useCallStore = create<CallState>()((set) => ({
  currentCall: null,
  isInCall: false,
  isMuted: false,
  isVideoEnabled: true,
  isScreenSharing: false,
  incomingCall: null,
  remoteUser: null,
  setCurrentCall: (call) => set({ currentCall: call }),
  setInCall: (isInCall) => set({ isInCall }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleVideo: () => set((state) => ({ isVideoEnabled: !state.isVideoEnabled })),
  toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),
  setIncomingCall: (call) => set({ incomingCall: call }),
  clearIncomingCall: () => set({ incomingCall: null }),
  setRemoteUser: (user) => set({ remoteUser: user }),
}));

// Voice Store
export const useVoiceStore = create<VoiceState>()((set) => ({
  currentVoiceChannel: null,
  isInVoiceChannel: false,
  isMuted: false,
  isDeafened: false,
  setCurrentVoiceChannel: (channel) => set({ currentVoiceChannel: channel }),
  setInVoiceChannel: (isInVoiceChannel) => set({ isInVoiceChannel }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleDeafen: () => set((state) => ({ isDeafened: !state.isDeafened })),
}));

// UI Store
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      rightSidebarOpen: true,
      activePanel: 'CHAT',
      theme: 'dark',
      searchOpen: false,
      settingsOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
      setActivePanel: (panel) => set({ activePanel: panel }),
      setTheme: (theme) => set({ theme }),
      toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),
      toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
    }),
    {
      name: 'ui-storage',
    }
  )
);

// Notification Store
export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications], unreadCount: state.unreadCount + 1 })),
  markAsRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
  setUnreadCount: (count) => set({ unreadCount: count }),
}));

// Typing Store
export const useTypingStore = create<TypingState>()((set) => ({
  typingUsers: [],
  addTypingUser: (user) =>
    set((state) => ({
      typingUsers: state.typingUsers.filter((u) => u.userId !== user.userId).concat(user),
    })),
  removeTypingUser: (userId) =>
    set((state) => ({
      typingUsers: state.typingUsers.filter((u) => u.userId !== userId),
    })),
  clearTypingUsers: () => set({ typingUsers: [] }),
}));

// Initialize app - called on app start
// Note: Channels will be fetched from API when user logs in
export const initializeApp = () => {
  // Don't create default channel - wait for API to provide channels
  const { currentChannel } = useChannelStore.getState();
  if (!currentChannel) {
    useChannelStore.getState().setChannels([]);
    useChannelStore.getState().setCurrentChannel(null);
  }
};
