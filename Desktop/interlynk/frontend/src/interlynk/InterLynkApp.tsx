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
  type Attachment,
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
  // Refs for stable access inside intervals/closures.
  const messagesRef = useRef<Record<string, Message[]>>({});
  messagesRef.current = messages;
  const dmMessagesRef = useRef<Record<string, DirectMessageItem[]>>({});
  dmMessagesRef.current = dmMessages;
  // Cache of most-recent live presence per userId (survives user registration order).
  const pendingPresenceRef = useRef<Record<string, string>>({});
  // Set of poll IDs for which the creator-end notification has already been fired.
  const firedPollEndsRef = useRef<Set<string>>(new Set());

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
        if (!u) continue;
        // Apply any live presence event that arrived before (or after) this user
        // was loaded from the API — prevents stale DB status from overwriting a
        // real-time "online" signal.
        const liveStatus = pendingPresenceRef.current[u.id];
        const incoming = liveStatus ? { ...u, status: liveStatus as User['status'] } : u;
        const cur = next[u.id];
        if (!cur || cur.status !== incoming.status || cur.name !== incoming.name || cur.avatar !== incoming.avatar) {
          next[u.id] = { ...cur, ...incoming };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const getUser = useCallback(
    (id: string): User => {
      if (currentUser && id === currentUser.id) return currentUser;
      return usersById[id] || { id, name: 'Unknown', color: '#d4a548', initials: '?' };
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
    async (content: string, attachments?: Attachment[]) => {
      const target = activeDmRef.current;
      const trimmed = content.trim();
      const hasAttach = attachments && attachments.length > 0;
      if (!target || (!trimmed && !hasAttach)) return;

      const msgContent = hasAttach
        ? `__ATTACH__${JSON.stringify({ text: trimmed, attachments })}`
        : trimmed;

      const msg = await api.sendDirectMessage(target, msgContent);
      setDmMessages((p) => {
        const arr = p[target] || [];
        if (arr.some((m) => m.id === msg.id)) return p;
        return { ...p, [target]: [...arr, msg] };
      });
      reloadConversations();
    },
    [reloadConversations]
  );

  const uploadDmAttachment = useCallback(
    (file: File | Blob, filename?: string) => api.uploadDmAttachment(file, filename),
    []
  );

  const createDmPoll = useCallback(
    async (question: string, options: string[], allowMultiple: boolean, durationMs?: number) => {
      const target = activeDmRef.current;
      if (!target) return;
      // Build poll entirely client-side — no backend poll endpoint needed for DMs.
      const pollId = `dm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const expiresAt = durationMs ? new Date(Date.now() + durationMs).toISOString() : undefined;
      const poll: import('./data').Poll = {
        id: pollId,
        messageId: '',
        question,
        allowMultiple,
        closed: false,
        totalVotes: 0,
        options: options.map((text, i) => ({ id: `${pollId}-${i}`, text, voteCount: 0, position: i })),
        votedOptionIds: [],
        expiresAt,
      };
      const msgContent = `__POLL__${JSON.stringify(poll)}`;
      const msg = await api.sendDirectMessage(target, msgContent);
      setDmMessages((p) => {
        const arr = p[target] || [];
        if (arr.some((m) => m.id === msg.id)) return p;
        return { ...p, [target]: [...arr, msg] };
      });
      reloadConversations();
    },
    [reloadConversations]
  );

  const votePollInDm = useCallback(
    async (dmUserId: string, pollId: string, optionIds: string[]) => {
      // Client-side vote — update option vote counts and votedOptionIds in the message.
      setDmMessages((prev) => {
        const arr = prev[dmUserId];
        if (!arr) return prev;
        const next = arr.map((m) => {
          if (!m.content.startsWith('__POLL__')) return m;
          try {
            const poll: import('./data').Poll = JSON.parse(m.content.slice('__POLL__'.length));
            if (poll.id !== pollId) return m;
            const prevVoted = new Set(poll.votedOptionIds);
            const nextVoted = new Set(optionIds);
            const updated: import('./data').Poll = {
              ...poll,
              votedOptionIds: optionIds,
              options: poll.options.map((o) => ({
                ...o,
                voteCount: o.voteCount
                  + (nextVoted.has(o.id) && !prevVoted.has(o.id) ? 1 : 0)
                  - (!nextVoted.has(o.id) && prevVoted.has(o.id) ? 1 : 0),
              })),
              totalVotes: poll.totalVotes
                + optionIds.filter((id) => !prevVoted.has(id)).length
                - [...prevVoted].filter((id) => !nextVoted.has(id)).length,
            };
            return { ...m, content: `__POLL__${JSON.stringify(updated)}` };
          } catch { return m; }
        });
        return { ...prev, [dmUserId]: next };
      });
    },
    []
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
        const next = arr.map((m) => {
          if (!m.poll || m.poll.id !== pollId) return m;
          // Preserve the original expiresAt if the server response omits it.
          return { ...m, poll: { ...updated, expiresAt: updated.expiresAt ?? m.poll.expiresAt } };
        });
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
          // own vote selection and the original expiry (broadcast omits both).
          const incoming = mapPoll(poll);
          return { ...m, poll: { ...incoming, votedOptionIds: m.poll.votedOptionIds, expiresAt: incoming.expiresAt ?? m.poll.expiresAt } };
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
      // Always cache so it can be applied when this user is first registered.
      pendingPresenceRef.current[userId] = status;
      setUsersById((prev) => {
        if (!prev[userId] || prev[userId].status === status) return prev;
        return { ...prev, [userId]: { ...prev[userId], status } };
      });
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
  /* ── Presence: online → away (15 min hidden) → offline (unload) ──
     Drives the status dot for the current user in real-time. The effect
     runs once per login (keyed on currentUser.id). */
  useEffect(() => {
    if (!currentUser) return;
    const AWAY_DELAY_MS = 15 * 60 * 1000; // 15 minutes
    let awayTimer: ReturnType<typeof setTimeout> | null = null;

    const applyPresence = (status: 'online' | 'away' | 'offline') => {
      api.updatePresence(status.toUpperCase());
      patchCurrentUser({ status });
      const meId = currentUserRef.current?.id;
      if (meId) pendingPresenceRef.current[meId] = status;
    };

    const goOnline = () => {
      if (awayTimer) { clearTimeout(awayTimer); awayTimer = null; }
      applyPresence('online');
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Don't mark away instantly — wait 15 min of background time.
        awayTimer = setTimeout(() => { applyPresence('away'); awayTimer = null; }, AWAY_DELAY_MS);
      } else {
        goOnline();
      }
    };

    const onUnload = () => {
      const token = useAuthStore.getState().token;
      if (!token) return;
      // keepalive: true lets the request complete even as the page closes.
      fetch('/api/chat/presence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'OFFLINE' }),
        keepalive: true,
      }).catch(() => {});
    };

    // Set initial presence based on whether the tab is currently visible.
    if (document.visibilityState === 'visible') {
      applyPresence('online');
    } else {
      awayTimer = setTimeout(() => { applyPresence('away'); awayTimer = null; }, AWAY_DELAY_MS);
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      if (awayTimer) clearTimeout(awayTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [currentUser?.id, patchCurrentUser]);

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
    async (username: string, password: string, rememberMe?: boolean) => {
      setAuthError(null);
      try {
        const result = await api.login(username, password, rememberMe);
        if ('mfaRequired' in result && result.mfaRequired) {
          // Hand the challenge back to the LoginScreen so it can show the
          // 6-digit-code form. We don't enter the app until /login/mfa
          // succeeds.
          return { mfaRequired: true as const, mfaChallenge: result.mfaChallenge };
        }
        await enterApp(result.user);
        return undefined;
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

  const loginMfa = useCallback(
    async (mfaChallenge: string, code: string) => {
      setAuthError(null);
      try {
        const { user } = await api.loginMfa(mfaChallenge, code);
        await enterApp(user);
      } catch (e: any) {
        const msg = e?.response?.data?.message
          || (e?.response?.status === 401
              ? 'Invalid verification code, or the challenge has expired.'
              : 'Could not reach the server. Please try again.');
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

  /* ── Global poll-expiry monitor ─────────────────────────
     Runs every second via a stable interval (uses refs so it never
     forces re-renders and doesn't recreate on every message update).
     Fires a toast notification to the poll creator when any of their
     polls expire — regardless of which screen they currently have open.  */
  useEffect(() => {
    const POLL_PREFIX = '__POLL__';
    const id = setInterval(() => {
      const meId = currentUserRef.current?.id;
      if (!meId) return;
      const now = Date.now();

      // Channel polls
      Object.values(messagesRef.current).forEach((msgs) => {
        msgs.forEach((m) => {
          const poll = m.poll;
          if (!poll || !poll.expiresAt || m.userId !== meId) return;
          if (firedPollEndsRef.current.has(poll.id)) return;
          if (poll.closed || new Date(poll.expiresAt).getTime() <= now) {
            firedPollEndsRef.current.add(poll.id);
            window.dispatchEvent(new CustomEvent('il-toast', {
              detail: {
                title: 'Your poll ended',
                message: `"${poll.question}" — ${poll.totalVotes} vote${poll.totalVotes !== 1 ? 's' : ''} received.`,
                tone: 'info',
              },
            }));
          }
        });
      });

      // DM polls (client-side, encoded in message content)
      Object.values(dmMessagesRef.current).forEach((msgs) => {
        msgs.forEach((m) => {
          if (!m.content.startsWith(POLL_PREFIX)) return;
          try {
            const poll = JSON.parse(m.content.slice(POLL_PREFIX.length));
            if (!poll?.id || !poll.expiresAt || m.senderId !== meId) return;
            if (firedPollEndsRef.current.has(poll.id)) return;
            if (poll.closed || new Date(poll.expiresAt).getTime() <= now) {
              firedPollEndsRef.current.add(poll.id);
              const votes = poll.totalVotes ?? 0;
              window.dispatchEvent(new CustomEvent('il-toast', {
                detail: {
                  title: 'Your poll ended',
                  message: `"${poll.question}" — ${votes} vote${votes !== 1 ? 's' : ''} received.`,
                  tone: 'info',
                },
              }));
            }
          } catch { /* noop */ }
        });
      });
    }, 1000);
    return () => clearInterval(id);
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
      // Ring every invitee into the new group room so they actually join (the
      // SFU path on accept). Without this the host sat alone in the room.
      for (const inv of call.invitees) {
        api.inviteToCall(session.roomId, inv.userId, call.callType)
          .catch((e) => console.warn('group invite failed for', inv.userId, e));
      }
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
    // Group invite (added to an existing call): join via the multi-party SFU
    // path — NO targetUserId, so the CallPanel never opens a 1:1 mesh. A normal
    // 1:1 call keeps the mesh path (targetUserId = the caller).
    const isGroup = Boolean(incomingCall.isGroup);
    setCallSession({
      roomId: incomingCall.roomId,
      callType: incomingCall.callType,
      title: incomingCall.callerDisplayName || incomingCall.callerUsername,
      targetUserId: isGroup ? null : incomingCall.callerUserId,
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
      login, loginMfa, logout, authError, patchCurrentUser,
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
      activeDm, activeDmUser, openDm, closeDm, dmMessages, dmLoading, sendDm, uploadDmAttachment,
      createDmPoll, votePollInDm,
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
      login, loginMfa, logout, authError, patchCurrentUser, activeChannel, selectChannel, activeView,
      sideOpen, rightOpen, showSettings, showTweaks, showNotif, showAdmin,
      channels, reloadChannels, createChannel,
      messages, messagesLoading, sendMessage, reactToMessage,
      uploadAttachment, createPoll, votePoll, markMessageRead, threadMsg,
      typingByChannel, notifyTyping, conversations, reloadConversations, dmUnread,
      activeDm, activeDmUser, openDm, closeDm, dmMessages, dmLoading, sendDm, uploadDmAttachment,
      createDmPoll, votePollInDm,
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
