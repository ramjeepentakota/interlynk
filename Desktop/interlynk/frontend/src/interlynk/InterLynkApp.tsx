/* InterLynk root app — fully wired to the backend.
   Voice CHANNELS (Discord-style ambient voice rooms) have been removed.
   1-on-1 voice / video calling remains the only realtime-media surface. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './theme.css';
import {
  AppCtx,
  type Accent,
  type CallSession,
  type CallType,
  type IncomingCall,
  type Screen,
  type Theme,
  type UiNotification,
} from './context';
import {
  mapDirectMessage,
  mapMessage,
  mapUser,
  type Channel,
  type Conversation,
  type DirectMessageItem,
  type Message,
  type User,
} from './data';
import * as api from './api';
import {
  connectRealtime,
  disconnectRealtime,
  subscribeToChannel,
  publishTyping,
  publishCallSignal,
} from './realtime';
import { useAuthStore } from '@/store/useAppStore';
import { LoginScreen, CallPanel, IncomingCallOverlay, SettingsModal, TweaksPanel, CallEndBanner } from './Screens';
import { MainLayout } from './Panels';
import { ProfileCard } from './People';
import { AdminConsole } from './admin/AdminConsole';

const TWEAK_DEFAULTS = { theme: 'dark' as Theme, accent: 'violet' as Accent };

export default function InterLynkApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [theme, setTheme] = useState<Theme>(TWEAK_DEFAULTS.theme);
  const [accent, setAccent] = useState<Accent>(TWEAK_DEFAULTS.accent);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [activeView, setActiveView] = useState('chat');
  const [sideOpen, setSideOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showTweaks, setShowTweaks] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [threadMsg, setThreadMsg] = useState<Message | null>(null);
  const [typingByChannel, setTypingByChannel] = useState<Record<string, string[]>>({});

  // Direct messages (inbox)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dmUnread, setDmUnread] = useState(0);
  const [activeDm, setActiveDm] = useState<string | null>(null);
  const [activeDmUser, setActiveDmUser] = useState<User | null>(null);
  const [dmMessages, setDmMessages] = useState<Record<string, DirectMessageItem[]>>({});
  const [dmLoading, setDmLoading] = useState(false);

  // Profile card
  const [profileUser, setProfileUser] = useState<User | null>(null);

  const [notifications, setNotifications] = useState<UiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [inCall, setInCall] = useState(false);
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callEndReason, setCallEndReason] = useState<'declined' | 'ended' | null>(null);

  const activeChannelRef = useRef<string | null>(null);
  activeChannelRef.current = activeChannel;
  const activeDmRef = useRef<string | null>(null);
  activeDmRef.current = activeDm;
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;

  /* ── Theme attrs ──────────────────────────────────────── */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
  }, [theme, accent]);

  /* ── Tweak panel bridge (design tooling) ──────────────── */
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data?.type === '__activate_edit_mode') setShowTweaks(true);
      if (e.data?.type === '__deactivate_edit_mode') setShowTweaks(false);
    };
    window.addEventListener('message', h);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', h);
  }, []);

  const registerUsers = useCallback((users: (User | undefined)[]) => {
    setUsersById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const u of users) {
        if (u && (!next[u.id] || next[u.id].status !== u.status)) {
          next[u.id] = { ...next[u.id], ...u };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const getUser = useCallback(
    (id: string): User => {
      if (currentUser && id === currentUser.id) return currentUser;
      return usersById[id] || { id, name: 'Unknown', color: '#8b5cf6', initials: '?' };
    },
    [usersById, currentUser]
  );

  const searchUsers = useCallback(
    async (query: string): Promise<User[]> => {
      const results = await api.searchUsers(query);
      const me = currentUserRef.current?.id;
      const filtered = results.filter((u) => u.id !== me);
      registerUsers(filtered);
      return filtered;
    },
    [registerUsers]
  );

  /* ── Notifications ────────────────────────────────────── */
  const refreshNotifications = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        api.fetchNotifications(),
        api.fetchUnreadCount(),
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch {
      /* non-fatal */
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await api.markAllNotificationsRead();
    setNotifications((p) => p.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  /* ── Direct messages ──────────────────────────────────── */
  const refreshDmUnread = useCallback(async () => {
    try {
      setDmUnread(await api.fetchDmUnreadCount());
    } catch {
      /* non-fatal */
    }
  }, []);

  const reloadConversations = useCallback(async () => {
    try {
      const list = await api.fetchConversations();
      setConversations(list);
      registerUsers(list.map((c) => c.user));
    } catch {
      /* non-fatal */
    }
  }, [registerUsers]);

  const openDm = useCallback(
    (user: User) => {
      registerUsers([user]);
      setActiveDmUser(user);
      setActiveDm(user.id);
      setActiveChannel(null);
      setThreadMsg(null);
      setProfileUser(null);
      setDmLoading(true);
      api
        .fetchConversation(user.id)
        .then(({ messages: msgs, participants }) => {
          registerUsers(participants);
          setDmMessages((p) => ({ ...p, [user.id]: msgs }));
        })
        .catch(() => setDmMessages((p) => ({ ...p, [user.id]: p[user.id] || [] })))
        .finally(() => setDmLoading(false));
      api.markConversationRead(user.id).then(() => {
        reloadConversations();
        refreshDmUnread();
      });
    },
    [registerUsers, reloadConversations, refreshDmUnread]
  );

  const closeDm = useCallback(() => {
    setActiveDm(null);
    setActiveDmUser(null);
  }, []);

  const sendDm = useCallback(
    async (content: string) => {
      const target = activeDmRef.current;
      const trimmed = content.trim();
      if (!target || !trimmed) return;
      const msg = await api.sendDirectMessage(target, trimmed);
      setDmMessages((p) => {
        const arr = p[target] || [];
        if (arr.some((m) => m.id === msg.id)) return p;
        return { ...p, [target]: [...arr, msg] };
      });
      reloadConversations();
    },
    [reloadConversations]
  );

  const openProfile = useCallback((user: User) => setProfileUser(user), []);
  const closeProfile = useCallback(() => setProfileUser(null), []);

  /* ── Channels ─────────────────────────────────────────── */
  const reloadChannels = useCallback(async () => {
    const list = await api.fetchChannels();
    setChannels(list);
    list.forEach((c) => subscribeToChannel(Number(c.id)));
  }, []);

  const loadMessages = useCallback(
    async (channelId: string) => {
      setMessagesLoading(true);
      try {
        const { messages: msgs, senders } = await api.fetchMessages(channelId);
        registerUsers(senders);
        setMessages((p) => ({ ...p, [channelId]: msgs }));
      } catch (e) {
        console.error('Failed to load messages', e);
        setMessages((p) => ({ ...p, [channelId]: p[channelId] || [] }));
      } finally {
        setMessagesLoading(false);
      }
    },
    [registerUsers]
  );

  const selectChannel = useCallback(
    (id: string | null) => {
      setActiveChannel(id);
      setThreadMsg(null);
      if (id) {
        setActiveDm(null);
        setActiveDmUser(null);
        subscribeToChannel(Number(id));
        loadMessages(id);
        // Pull member roster so names/colours resolve.
        api
          .fetchChannelDetail(id)
          .then(({ members }) => registerUsers(members))
          .catch(() => undefined);
      }
    },
    [loadMessages, registerUsers]
  );

  const createChannel = useCallback(
    async (name: string) => {
      const ch = await api.createChannel(name);
      setChannels((p) => [...p, ch]);
      subscribeToChannel(Number(ch.id));
      selectChannel(ch.id);
    },
    [selectChannel]
  );

  /* ── Messaging ────────────────────────────────────────── */
  const appendMessage = useCallback((channelId: string, msg: Message) => {
    setMessages((prev) => {
      const arr = prev[channelId] || [];
      if (arr.some((m) => m.id === msg.id)) return prev;
      return { ...prev, [channelId]: [...arr, msg] };
    });
  }, []);

  const sendMessage = useCallback(
    async (channelId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const { message, sender } = await api.sendMessage(channelId, trimmed);
      if (sender) registerUsers([sender]);
      appendMessage(channelId, message);
    },
    [appendMessage, registerUsers]
  );

  const reactToMessage = useCallback(
    async (channelId: string, messageId: string, emoji: string) => {
      let willRemove = false;
      setMessages((prev) => {
        const arr = [...(prev[channelId] || [])];
        const idx = arr.findIndex((m) => m.id === messageId);
        if (idx === -1) return prev;
        const m = { ...arr[idx] };
        const reactions = [...(m.reactions || [])];
        const ri = reactions.findIndex((r) => r.emoji === emoji);
        if (ri > -1) {
          const r = reactions[ri];
          willRemove = r.reacted;
          reactions[ri] = {
            ...r,
            reacted: !r.reacted,
            count: r.reacted ? r.count - 1 : r.count + 1,
          };
          if (reactions[ri].count <= 0) reactions.splice(ri, 1);
        } else {
          reactions.push({ emoji, count: 1, reacted: true });
        }
        arr[idx] = { ...m, reactions };
        return { ...prev, [channelId]: arr };
      });
      try {
        if (willRemove) await api.removeReaction(messageId, emoji);
        else await api.addReaction(messageId, emoji);
      } catch {
        loadMessages(channelId);
      }
    },
    [loadMessages]
  );

  const notifyTyping = useCallback(
    (channelId: string, isTyping: boolean) => {
      if (!currentUser?.username) return;
      publishTyping(Number(channelId), currentUser.username, isTyping);
    },
    [currentUser]
  );

  /* ── Realtime event wiring ────────────────────────────── */
  useEffect(() => {
    const onMessage = (e: Event) => {
      const { channelId, raw } = (e as CustomEvent).detail;
      if (raw?.sender) registerUsers([mapUser(raw.sender)]);
      appendMessage(String(channelId), mapMessage(raw));
    };
    const onDeleted = (e: Event) => {
      const { channelId, messageId } = (e as CustomEvent).detail;
      setMessages((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] || []).filter((m) => m.id !== messageId),
      }));
    };
    const onTyping = (e: Event) => {
      const { channelId, username, isTyping } = (e as CustomEvent).detail;
      if (username === currentUser?.username) return;
      setTypingByChannel((prev) => {
        const set = new Set(prev[channelId] || []);
        if (isTyping) set.add(username);
        else set.delete(username);
        return { ...prev, [channelId]: [...set] };
      });
      if (isTyping) {
        setTimeout(() => {
          setTypingByChannel((prev) => {
            const set = new Set(prev[channelId] || []);
            set.delete(username);
            return { ...prev, [channelId]: [...set] };
          });
        }, 5000);
      }
    };
    const onPresence = (e: Event) => {
      const { userId, status } = (e as CustomEvent).detail;
      if (!userId) return;
      setUsersById((prev) =>
        prev[userId] ? { ...prev, [userId]: { ...prev[userId], status } } : prev
      );
    };
    const onIncoming = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setIncomingCall({ ...d, callType: d.callType === 'video' ? 'video' : 'voice' });
    };
    const onNotif = () => refreshNotifications();
    const onDm = (e: Event) => {
      const raw = (e as CustomEvent).detail;
      if (raw?.sender) registerUsers([mapUser(raw.sender)]);
      if (raw?.recipient) registerUsers([mapUser(raw.recipient)]);
      const meId = currentUserRef.current?.id;
      const senderId = String(raw.sender?.id ?? '');
      const recipientId = String(raw.recipient?.id ?? '');
      const otherId = senderId === meId ? recipientId : senderId;
      const mapped = mapDirectMessage(raw);
      if (activeDmRef.current && otherId === activeDmRef.current) {
        setDmMessages((p) => {
          const arr = p[otherId] || [];
          if (arr.some((m) => m.id === mapped.id)) return p;
          return { ...p, [otherId]: [...arr, mapped] };
        });
        if (senderId !== meId) api.markConversationRead(otherId);
      }
      reloadConversations();
      refreshDmUnread();
    };
    // Invited/added to a channel elsewhere — pull the new roster so it appears
    // in the sidebar live, ready to open.
    const onChannelAdded = () => { reloadChannels(); };
    // Removed from a channel — drop it from the sidebar; if it was open, close it.
    const onChannelRemoved = (e: Event) => {
      const { channelId } = (e as CustomEvent).detail;
      const removedId = channelId ? String(channelId) : null;
      if (removedId && activeChannelRef.current === removedId) selectChannel(null);
      reloadChannels();
    };

    window.addEventListener('il-message', onMessage);
    window.addEventListener('il-message-deleted', onDeleted);
    window.addEventListener('il-typing', onTyping);
    window.addEventListener('il-presence', onPresence);
    window.addEventListener('il-incoming-call', onIncoming);
    window.addEventListener('il-notification', onNotif);
    window.addEventListener('il-dm', onDm);
    window.addEventListener('il-channel-added', onChannelAdded);
    window.addEventListener('il-channel-removed', onChannelRemoved);
    return () => {
      window.removeEventListener('il-message', onMessage);
      window.removeEventListener('il-message-deleted', onDeleted);
      window.removeEventListener('il-typing', onTyping);
      window.removeEventListener('il-presence', onPresence);
      window.removeEventListener('il-incoming-call', onIncoming);
      window.removeEventListener('il-notification', onNotif);
      window.removeEventListener('il-dm', onDm);
      window.removeEventListener('il-channel-added', onChannelAdded);
      window.removeEventListener('il-channel-removed', onChannelRemoved);
    };
  }, [appendMessage, registerUsers, refreshNotifications, reloadConversations, refreshDmUnread, reloadChannels, selectChannel, currentUser]);

  /* ── Session bootstrap ────────────────────────────────── */
  const enterApp = useCallback(
    async (user: User) => {
      setCurrentUser(user);
      registerUsers([user]);
      setScreen('app');
      connectRealtime(() => {
        channels.forEach((c) => subscribeToChannel(Number(c.id)));
      });
      api.updatePresence('ONLINE');
      try {
        await reloadChannels();
      } catch (e) {
        console.error('Failed to load channels', e);
      }
      reloadConversations();
      refreshDmUnread();
      refreshNotifications();
    },
    [channels, reloadChannels, reloadConversations, refreshDmUnread, refreshNotifications, registerUsers]
  );

  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    api
      .fetchMe()
      .then(({ user }) => enterApp(user))
      .catch(() => {
        useAuthStore.getState().logout();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      setAuthError(null);
      try {
        const { user } = await api.login(username, password);
        await enterApp(user);
      } catch (e: any) {
        const msg =
          e?.response?.status === 401
            ? 'Invalid username or password.'
            : 'Could not reach the server. Please try again.';
        setAuthError(msg);
        throw e;
      }
    },
    [enterApp]
  );

  const logout = useCallback(async () => {
    await api.logout();
    disconnectRealtime();
    setCurrentUser(null);
    setChannels([]);
    setMessages({});
    setActiveChannel(null);
    setConversations([]);
    setDmMessages({});
    setActiveDm(null);
    setActiveDmUser(null);
    setDmUnread(0);
    setNotifications([]);
    setUnreadCount(0);
    setScreen('login');
  }, []);

  /* ── WebRTC signal handler (call-rejected / call-ended) ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const signal = (e as CustomEvent).detail;
      if (!signal) return;
      if (signal.type === 'call-rejected') {
        setInCall(false);
        setCallSession(null);
        // If the rejection arrived for the incoming-call overlay (we're the
        // callee and somehow rejected via another route), close it too.
        setIncomingCall(null);
        setCallEndReason('declined');
        setTimeout(() => setCallEndReason(null), 4000);
      } else if (signal.type === 'call-ended') {
        setInCall(false);
        setCallSession(null);
        // Caller cancelled before we picked up — dismiss the ringing overlay.
        setIncomingCall(null);
        setCallEndReason('ended');
        setTimeout(() => setCallEndReason(null), 4000);
      }
    };
    window.addEventListener('webrtc-signal', handler);
    return () => window.removeEventListener('webrtc-signal', handler);
  }, []);

  /* ── Calls (LiveKit-backed media + WS ringing) ────────── */
  const startChannelCall = useCallback(
    async (type: CallType) => {
      if (!activeChannel) return;
      const ch = channels.find((c) => c.id === activeChannel);
      const session = await api.createGroupCall(ch?.name || 'Call', type);
      await api.joinCall(session.roomId);
      setCallSession({
        roomId: session.roomId,
        callType: type,
        title: ch?.name || 'Call',
      });
      setInCall(true);
    },
    [activeChannel, channels]
  );

  const startDirectCall = useCallback(
    async (user: User, type: CallType) => {
      const session = await api.startDirectCall(Number(user.id), type);
      await api.joinCall(session.roomId);
      setProfileUser(null);
      setCallSession({
        roomId: session.roomId,
        callType: type,
        title: user.name,
        targetUserId: Number(user.id),
        isInitiator: true,
      });
      setInCall(true);
    },
    []
  );

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      await api.joinCall(incomingCall.roomId);
    } catch (e) {
      console.error('Failed to join call room', e);
    }
    // IMPORTANT: render the CallPanel (and therefore mount useWebRTC's listener)
    // BEFORE we tell the caller we accepted. Otherwise the caller's offer would
    // arrive at this client with no handler listening for the webrtc-signal
    // event and the call would never connect.
    setCallSession({
      roomId: incomingCall.roomId,
      callType: incomingCall.callType,
      title: incomingCall.callerDisplayName || incomingCall.callerUsername,
      targetUserId: incomingCall.callerUserId,
      isInitiator: false,
    });
    setIncomingCall(null);
    setInCall(true);

    // Notify the caller we accepted. Defer to the next tick so the CallPanel
    // (and its webrtc-signal listener) is mounted first.
    const me = useAuthStore.getState().user;
    if (me) {
      setTimeout(() => {
        publishCallSignal({
          type: 'call-accepted',
          roomId: incomingCall.roomId,
          senderUserId: Number(me.id),
          targetUserId: incomingCall.callerUserId,
          callType: incomingCall.callType,
        });
      }, 50);
    }
  }, [incomingCall]);

  const endCurrentCall = useCallback(async () => {
    if (callSession) {
      await api.leaveCall(callSession.roomId);
    }
    setInCall(false);
    setCallSession(null);
  }, [callSession]);

  const inviteToChannel = useCallback(async (channelId: string, username: string) => {
    await api.inviteToChannel(channelId, username);
  }, []);

  const ctx = useMemo(
    () => ({
      screen, setScreen,
      theme, setTheme,
      accent, setAccent,
      currentUser, usersById, getUser, registerUsers, searchUsers,
      login, logout, authError,
      activeChannel, selectChannel,
      activeView, setActiveView,
      sideOpen, setSideOpen,
      rightOpen, setRightOpen,
      showSettings, setShowSettings,
      showTweaks, setShowTweaks,
      showNotif, setShowNotif,
      showAdmin, setShowAdmin,
      channels, reloadChannels, createChannel,
      messages, messagesLoading, sendMessage, reactToMessage,
      threadMsg, setThreadMsg,
      typingByChannel, notifyTyping,
      conversations, reloadConversations, dmUnread,
      activeDm, activeDmUser, openDm, closeDm, dmMessages, dmLoading, sendDm,
      profileUser, openProfile, closeProfile,
      notifications, unreadCount, markAllNotificationsRead,
      inCall, setInCall, callSession,
      startChannelCall, startDirectCall, endCurrentCall,
      incomingCall, setIncomingCall, acceptIncomingCall,
      callEndReason, setCallEndReason,
      inviteToChannel,
    }),
    [
      screen, theme, accent, currentUser, usersById, getUser, registerUsers, searchUsers,
      login, logout, authError, activeChannel, selectChannel, activeView,
      sideOpen, rightOpen, showSettings, showTweaks, showNotif, showAdmin,
      channels, reloadChannels, createChannel,
      messages, messagesLoading, sendMessage, reactToMessage, threadMsg,
      typingByChannel, notifyTyping, conversations, reloadConversations, dmUnread,
      activeDm, activeDmUser, openDm, closeDm, dmMessages, dmLoading, sendDm,
      profileUser, openProfile, closeProfile, notifications, unreadCount,
      markAllNotificationsRead,
      inCall, callSession, startChannelCall, startDirectCall,
      endCurrentCall, incomingCall, acceptIncomingCall,
      callEndReason, inviteToChannel,
    ]
  );

  return (
    <AppCtx.Provider value={ctx}>
      {screen === 'login' ? <LoginScreen /> : inCall ? <CallPanel /> : <MainLayout />}
      {showAdmin && screen === 'app' && <AdminConsole />}
      {showSettings && <SettingsModal />}
      {profileUser && <ProfileCard />}
      {incomingCall && <IncomingCallOverlay />}
      {showTweaks && <TweaksPanel />}
      <CallEndBanner />
    </AppCtx.Provider>
  );
}
