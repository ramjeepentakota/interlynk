/* InterLynk root app — fully wired to the backend.
   Voice CHANNELS (Discord-style ambient voice rooms) have been removed.
   1-on-1 voice / video calling remains the only realtime-media surface. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './theme.css';
import './responsive.css';
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
  formatDateLabel,
  formatTime,
  mapDirectMessage,
  mapMessage,
  mapPoll,
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
import { LoginScreen, CallPanel, IncomingCallOverlay, SettingsModal, TweaksPanel, CallEndBanner, ToastHost } from './Screens';
import { MainLayout } from './Panels';
import { ProfileCard } from './People';
import { AdminConsole } from './admin/AdminConsole';
import { ScheduledCallsModal } from './ScheduledCalls';

const TWEAK_DEFAULTS = { theme: 'light' as Theme, accent: 'gold' as Accent };

export default function InterLynkApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [theme, setTheme] = useState<Theme>(TWEAK_DEFAULTS.theme);
  const [accent, setAccent] = useState<Accent>(TWEAK_DEFAULTS.accent);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [activeView, setActiveView] = useState('chat');
  const isMobileInit = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(max-width: 768px)').matches
    : false;
  const [sideOpen, setSideOpen] = useState(!isMobileInit);
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

  const patchCurrentUser = useCallback((patch: Partial<User>) => {
    setCurrentUser((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch } as User;
      // Keep usersById in sync so anywhere the user is rendered (sidebar
      // panel, channel members, profile card) picks up the new avatar
      // without needing to re-fetch.
      setUsersById((p) => ({ ...p, [next.id]: { ...p[next.id], ...next } }));
      return next;
    });
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
      if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches) {
        setSideOpen(false);
      }
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
        if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches) {
          setSideOpen(false);
        }
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
    async (channelId: string, content: string, attachments?: import('./data').Attachment[]) => {
      const trimmed = content.trim();
      // Allow attachment-only messages (e.g. a voice note or image with no caption).
      if (!trimmed && (!attachments || attachments.length === 0)) return;
      const me = currentUserRef.current;
      // Optimistic echo so the sender sees the message instantly with a single
      // "sent" tick; reconciled to the server row (double tick) once it returns.
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (me) {
        const nowIso = new Date().toISOString();
        appendMessage(channelId, {
          id: tempId,
          userId: me.id,
          content: trimmed,
          time: formatTime(nowIso),
          date: formatDateLabel(nowIso),
          createdAt: nowIso,
          attachments,
          delivered: false,
        });
      }
      try {
        const { message, sender } = await api.sendMessage(channelId, trimmed, attachments);
        if (sender) registerUsers([sender]);
        // Drop the optimistic row and add the real one (deduped if the realtime
        // broadcast already delivered it).
        setMessages((prev) => {
          const arr = (prev[channelId] || []).filter((m) => m.id !== tempId);
          if (arr.some((m) => m.id === message.id)) return { ...prev, [channelId]: arr };
          return { ...prev, [channelId]: [...arr, message] };
        });
      } catch (e) {
        // Remove the optimistic row on failure so the composer can restore text.
        setMessages((prev) => ({
          ...prev,
          [channelId]: (prev[channelId] || []).filter((m) => m.id !== tempId),
        }));
        throw e;
      }
    },
    [appendMessage, registerUsers]
  );

  const uploadAttachment = useCallback(
    (channelId: string, file: File | Blob, filename?: string) =>
      api.uploadAttachment(channelId, file, filename),
    []
  );

  const createPoll = useCallback(
    async (channelId: string, question: string, options: string[], allowMultiple: boolean) => {
      const { message, sender } = await api.createPoll(channelId, question, options, allowMultiple);
      if (sender) registerUsers([sender]);
      appendMessage(channelId, message);
    },
    [appendMessage, registerUsers]
  );

  const votePoll = useCallback(
    async (channelId: string, pollId: string, optionIds: string[]) => {
      // Optimistically reflect the caller's own selection; reconcile to the
      // authoritative poll (with correct counts) from the response.
      const updated = await api.votePoll(pollId, optionIds);
      setMessages((prev) => {
        const arr = prev[channelId];
        if (!arr) return prev;
        const next = arr.map((m) => (m.poll && m.poll.id === pollId ? { ...m, poll: updated } : m));
        return { ...prev, [channelId]: next };
      });
    },
    []
  );

  // Track which messages we've already reported as read so we don't spam the
  // backend with duplicate receipts as the user scrolls.
  const readSentRef = useRef<Set<string>>(new Set());
  const markMessageRead = useCallback(
    (channelId: string, messageId: string) => {
      // Optimistic temp echoes have no server id yet — never report them.
      if (messageId.startsWith('tmp-') || readSentRef.current.has(messageId)) return;
      readSentRef.current.add(messageId);
      api.markMessageRead(channelId, messageId);
    },
    []
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
    const onReadReceipt = (e: Event) => {
      const { channelId, userId, messageIds } = (e as CustomEvent).detail as {
        channelId: string; userId: string | null; messageIds: string[];
      };
      if (!userId || !messageIds?.length) return;
      const ids = new Set(messageIds);
      setMessages((prev) => {
        const arr = prev[channelId];
        if (!arr) return prev;
        let changed = false;
        const next = arr.map((m) => {
          if (!ids.has(m.id)) return m;
          const readBy = new Set(m.readBy || []);
          if (readBy.has(userId)) return m;
          readBy.add(userId);
          changed = true;
          return { ...m, readBy: [...readBy] };
        });
        return changed ? { ...prev, [channelId]: next } : prev;
      });
    };
    const onPollUpdate = (e: Event) => {
      const { channelId, poll } = (e as CustomEvent).detail as { channelId: string; poll: any };
      if (!poll) return;
      const pollId = String(poll.id);
      setMessages((prev) => {
        const arr = prev[channelId];
        if (!arr) return prev;
        let changed = false;
        const next = arr.map((m) => {
          if (!m.poll || m.poll.id !== pollId) return m;
          changed = true;
          // Counts-only broadcast: refresh option totals but preserve THIS user's
          // own vote selection (the broadcast intentionally omits it).
          const incoming = mapPoll(poll);
          return { ...m, poll: { ...incoming, votedOptionIds: m.poll.votedOptionIds } };
        });
        return changed ? { ...prev, [channelId]: next } : prev;
      });
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
    const onNotif = (e: Event) => {
      refreshNotifications();
      const raw = (e as CustomEvent).detail as { title?: string; content?: string; type?: string } | undefined;
      if (raw && raw.title) {
        // Surface the incoming notification as a transient toast — important
        // for scheduled-call CALL_INVITE notifications so invitees see them
        // without needing to open the bell popover.
        window.dispatchEvent(new CustomEvent('il-toast', { detail: {
          title: raw.title,
          message: raw.content || '',
          tone: raw.type === 'CALL_CANCELLED' ? 'warn' : 'info',
        } }));
      }
    };
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
    window.addEventListener('il-read-receipt', onReadReceipt);
    window.addEventListener('il-poll-update', onPollUpdate);
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
      window.removeEventListener('il-read-receipt', onReadReceipt);
      window.removeEventListener('il-poll-update', onPollUpdate);
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
      // Critical-path: only the createDirectCall HTTP roundtrip is awaited
      // (we need the roomId before mounting the panel). joinCall registers
      // the caller as a backend participant — important for room bookkeeping
      // but NOT required by the P2P media layer — so it runs in the
      // background. This trims a full HTTP roundtrip off the time between
      // click and the "Calling…" UI appearing.
      const session = await api.startDirectCall(Number(user.id), type);
      setProfileUser(null);
      setCallSession({
        roomId: session.roomId,
        callType: type,
        title: user.name,
        targetUserId: Number(user.id),
        isInitiator: true,
      });
      setInCall(true);
      api.joinCall(session.roomId).catch((e) => console.warn('joinCall (caller) failed — continuing anyway', e));
    },
    []
  );

  const startScheduledCall = useCallback(
    async (call: {
      callType: CallType;
      title: string;
      invitees: { userId: number; username: string; displayName?: string; avatarUrl?: string }[];
    }) => {
      // 1:1 → reuse the direct-call ring so WebRTC wires up exactly like a
      // normal call. Group → open a GROUP room the invitees join from their list.
      if (call.invitees.length === 1) {
        const inv = call.invitees[0];
        await startDirectCall(
          {
            id: String(inv.userId),
            name: inv.displayName || inv.username,
            username: inv.username,
            avatar: inv.avatarUrl,
          },
          call.callType
        );
        return;
      }
      const session = await api.createGroupCall(call.title, call.callType);
      await api.joinCall(session.roomId);
      setCallSession({ roomId: session.roomId, callType: call.callType, title: call.title });
      setInCall(true);
    },
    [startDirectCall]
  );

  const joinScheduledCall = useCallback(
    async (call: { roomId: number; callType: CallType; title: string }) => {
      // Hop straight into the existing room — the backend already created it
      // when the scheduled call flipped to ACTIVE.
      setCallSession({ roomId: call.roomId, callType: call.callType, title: call.title });
      setInCall(true);
      api.joinCall(call.roomId).catch((e) => console.warn('joinCall (scheduled) failed — continuing anyway', e));
    },
    []
  );

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    // Critical path: set the callSession + inCall SYNCHRONOUSLY so the
    // CallPanel mounts on the next render — no awaits in between. The
    // backend joinCall runs in the background (not on the media path) and
    // the call-accepted notification is now sent from inside the CallPanel
    // via a useEffect, which guarantees the webrtc-signal listener is
    // registered before we tell the caller to send the offer. This removes
    // the previous 50 ms setTimeout race entirely.
    setCallSession({
      roomId: incomingCall.roomId,
      callType: incomingCall.callType,
      title: incomingCall.callerDisplayName || incomingCall.callerUsername,
      targetUserId: incomingCall.callerUserId,
      isInitiator: false,
    });
    setIncomingCall(null);
    setInCall(true);
    api.joinCall(incomingCall.roomId).catch((e) => console.warn('joinCall (callee) failed — continuing anyway', e));
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
      login, logout, authError, patchCurrentUser,
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
      uploadAttachment, createPoll, votePoll, markMessageRead,
      threadMsg, setThreadMsg,
      typingByChannel, notifyTyping,
      conversations, reloadConversations, dmUnread,
      activeDm, activeDmUser, openDm, closeDm, dmMessages, dmLoading, sendDm,
      profileUser, openProfile, closeProfile,
      notifications, unreadCount, markAllNotificationsRead,
      inCall, setInCall, callSession,
      startChannelCall, startDirectCall, startScheduledCall, joinScheduledCall, endCurrentCall,
      incomingCall, setIncomingCall, acceptIncomingCall,
      callEndReason, setCallEndReason,
      inviteToChannel,
    }),
    [
      screen, theme, accent, currentUser, usersById, getUser, registerUsers, searchUsers,
      login, logout, authError, patchCurrentUser, activeChannel, selectChannel, activeView,
      sideOpen, rightOpen, showSettings, showTweaks, showNotif, showAdmin,
      channels, reloadChannels, createChannel,
      messages, messagesLoading, sendMessage, reactToMessage,
      uploadAttachment, createPoll, votePoll, markMessageRead, threadMsg,
      typingByChannel, notifyTyping, conversations, reloadConversations, dmUnread,
      activeDm, activeDmUser, openDm, closeDm, dmMessages, dmLoading, sendDm,
      profileUser, openProfile, closeProfile, notifications, unreadCount,
      markAllNotificationsRead,
      inCall, callSession, startChannelCall, startDirectCall, startScheduledCall, joinScheduledCall,
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
      {screen === 'app' && <ScheduledCallsModal />}
      <CallEndBanner />
      <ToastHost />
    </AppCtx.Provider>
  );
}
