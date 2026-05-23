/* InterLynk realtime layer — single STOMP/WebSocket connection shared by
   chat (live messages, typing) and calls (WebRTC signaling).

   Components communicate with this module through window CustomEvents:
   - 'il-message'          { channelId, raw }     new/edited message for a channel
   - 'il-message-deleted'  { channelId, messageId }
   - 'il-read-receipt'     { channelId, userId, messageIds }  messages read by a user (from backend 'messages_read')
   - 'il-poll-update'      { channelId, poll }    updated poll vote counts
   - 'il-typing'           { channelId, username, isTyping }
   - 'il-presence'         { username, userId, status }
   - 'il-incoming-call'    { roomId, callerUserId, callerUsername, callerDisplayName, callType }
   - 'webrtc-signal'       raw signal (consumed by useWebRTC)

   Connection notes
   ----------------
   We use a **native** WebSocket (STOMP brokerURL) rather than SockJS. Behind the
   HTTPS dev proxy SockJS silently falls back to xhr-streaming, which the proxy
   recycles every ~2 minutes — every recycle drops the socket, and historically
   only the global queues were re-subscribed, so live channel messages and call
   ringing went dead until a manual refresh. A native wss:// upgrade through the
   Vite `ws: true` proxy stays open indefinitely (STOMP heartbeats keep it warm),
   and `resubscribeAll()` below restores *every* subscription on each (re)connect
   so realtime survives transient drops with no refresh.
*/
import { Client, type StompSubscription } from '@stomp/stompjs';
import { useAuthStore } from '@/store/useAppStore';

let client: Client | null = null;
let connected = false;

// `desired*` is the intent (what we want subscribed); `live*` is what is
// currently subscribed on the active socket. Intent survives reconnects; live
// state is rebuilt from intent every time the socket comes up.
const desiredChannels = new Set<number>();
const liveChannels = new Set<number>();
const liveSubs: StompSubscription[] = [];
let subscribedGlobals = false;

export function getStompClient(): Client | null {
  return client;
}

export function isRealtimeConnected(): boolean {
  return connected;
}

/** Build a ws://|wss:// broker URL that matches the page's security context so
 *  the browser never blocks it as mixed content. */
function buildBrokerURL(): string {
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const configured = import.meta.env.VITE_API_URL ?? '';

  // Same-origin (default): the dev/prod proxy forwards /ws to the backend.
  if (!configured) {
    return `${wsProto}//${window.location.host}/ws`;
  }

  // Absolute backend URL configured — derive its ws scheme, but never downgrade
  // to ws:// from an https:// page (the browser would hard-block it). In that
  // case fall back to the same-origin proxy.
  try {
    const u = new URL(configured, window.location.href);
    if (window.location.protocol === 'https:' && u.protocol === 'http:') {
      console.warn(
        `[realtime] Ignoring insecure VITE_API_URL "${configured}" on an https page ` +
          `(would be blocked as mixed content). Using same-origin proxy instead.`
      );
      return `wss://${window.location.host}/ws`;
    }
    const scheme = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${scheme}//${u.host}/ws`;
  } catch {
    return `${wsProto}//${window.location.host}/ws`;
  }
}

function emit(name: string, detail: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function subscribeGlobals() {
  if (!client || !connected || subscribedGlobals) return;
  subscribedGlobals = true;

  liveSubs.push(
    client.subscribe('/topic/user/presence', (msg) => {
      try {
        const p = JSON.parse(msg.body);
        emit('il-presence', {
          username: p.username,
          userId: p.userId ? String(p.userId) : null,
          status: (p.presence || p.status || 'offline').toLowerCase(),
        });
      } catch { /* noop */ }
    })
  );

  liveSubs.push(
    client.subscribe('/user/queue/notifications', (msg) => {
      try {
        emit('il-notification', JSON.parse(msg.body));
      } catch { /* noop */ }
    })
  );

  // Private per-user channel events (invited to / removed from a channel,
  // including voice). Delivered via Spring user destinations
  // (convertAndSendToUser → /user/queue/...), so only this authenticated session
  // receives them — same private-delivery guarantee as DMs and call signaling.
  // Without this the invitee would not see a newly-granted channel until reload.
  liveSubs.push(
    client.subscribe('/user/queue/channel-events', (msg) => {
      try {
        const body = JSON.parse(msg.body);
        const channelId = body.channelId != null ? String(body.channelId) : null;
        if (body.type === 'added_to_channel') {
          emit('il-channel-added', { channelId, channelName: body.channelName, channelType: body.channelType });
        } else if (body.type === 'removed_from_channel') {
          emit('il-channel-removed', { channelId, channelName: body.channelName });
        }
      } catch { /* noop */ }
    })
  );

  // Person-to-person direct messages delivered to this user's private queue.
  liveSubs.push(
    client.subscribe('/user/queue/dm', (msg) => {
      try {
        emit('il-dm', JSON.parse(msg.body));
      } catch { /* noop */ }
    })
  );

  liveSubs.push(
    client.subscribe('/user/queue/call/incoming', (msg) => {
      try {
        const n = JSON.parse(msg.body);
        emit('il-incoming-call', {
          roomId: n.roomId,
          callerUserId: n.callerUserId,
          callerUsername: n.callerUsername,
          callerDisplayName: n.callerDisplayName,
          callerAvatarUrl: n.callerAvatarUrl,
          callType: n.callType || 'voice',
        });
      } catch { /* noop */ }
    })
  );

  liveSubs.push(
    client.subscribe('/user/queue/call/signal', (msg) => {
      try {
        emit('webrtc-signal', JSON.parse(msg.body));
      } catch { /* noop */ }
    })
  );
}

/** Actually open the channel subscriptions on the live socket. Safe to call
 *  repeatedly — it no-ops when disconnected or already subscribed. */
function openChannelSubscription(channelId: number) {
  if (!client || !connected || liveChannels.has(channelId)) return;
  liveChannels.add(channelId);

  liveSubs.push(
    client.subscribe(`/topic/channel/${channelId}`, (frame) => {
      try {
        const body = JSON.parse(frame.body);
        if (body.type === 'message_deleted') {
          emit('il-message-deleted', { channelId, messageId: String(body.messageId) });
          return;
        }
        if (body.type === 'messages_read') {
          emit('il-read-receipt', {
            channelId: String(body.channelId ?? channelId),
            userId: body.userId != null ? String(body.userId) : null,
            messageIds: (body.messageIds || []).map((id: unknown) => String(id)),
          });
          return;
        }
        if (body.type === 'poll_update') {
          emit('il-poll-update', { channelId: String(body.channelId ?? channelId), poll: body.poll });
          return;
        }
        if (body.id !== undefined && body.content !== undefined) {
          emit('il-message', { channelId: String(body.channelId ?? channelId), raw: body });
        }
      } catch { /* noop */ }
    })
  );

  liveSubs.push(
    client.subscribe(`/topic/channel/${channelId}/typing`, (frame) => {
      try {
        const t = JSON.parse(frame.body);
        emit('il-typing', {
          channelId: String(channelId),
          username: t.username,
          isTyping: Boolean(t.isTyping),
        });
      } catch { /* noop */ }
    })
  );
}

/** Register intent to receive a channel's realtime events. Records the channel
 *  so it is (re)subscribed automatically on the current and every future
 *  connection — callers may invoke this before the socket is up. */
export function subscribeToChannel(channelId: number) {
  if (Number.isNaN(channelId)) return;
  desiredChannels.add(channelId);
  openChannelSubscription(channelId);
}

/** Rebuild every subscription from intent. Called on each (re)connect, when all
 *  prior STOMP subscriptions have been discarded by the broker. */
function resubscribeAll() {
  subscribeGlobals();
  desiredChannels.forEach((id) => openChannelSubscription(id));
}

/** Mark the live socket as gone. Keeps `desiredChannels` so the next connect
 *  restores them; only the live bookkeeping is reset. */
function resetLiveState() {
  connected = false;
  (window as { __stompClient?: Client | null }).__stompClient = null;
  liveChannels.clear();
  liveSubs.length = 0;
  subscribedGlobals = false;
}

/** Publish a chat message over WebSocket (also persisted server-side). */
export function publishMessage(channelId: number, username: string, content: string) {
  if (!client?.connected) return false;
  client.publish({
    destination: `/app/chat/channel/${channelId}`,
    body: JSON.stringify({ username, content, channelId }),
  });
  return true;
}

export function publishTyping(channelId: number, username: string, isTyping: boolean) {
  if (!client?.connected) return;
  client.publish({
    destination: `/app/typing/channel/${channelId}`,
    body: JSON.stringify({ username, channelId: String(channelId), isTyping }),
  });
}

export function connectRealtime(onReady?: () => void) {
  const token = useAuthStore.getState().token;
  if (!token) return;

  if (client && client.connectHeaders?.Authorization === `Bearer ${token}`) {
    if (connected) onReady?.();
    return;
  }

  if (client) {
    client.deactivate();
    client = null;
    resetLiveState();
  }

  client = new Client({
    brokerURL: buildBrokerURL(),
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 4000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      connected = true;
      // Expose the STOMP client globally so the WebRTC call layer can publish
      // signals (offer/answer/ice/call-accepted/call-rejected/call-ended) and
      // the incoming-call overlay can publish rejections.
      (window as { __stompClient?: Client | null }).__stompClient = client;
      // A fresh socket has no live subscriptions — rebuild them all from intent
      // so live messages, typing, presence and call ringing survive reconnects.
      liveChannels.clear();
      liveSubs.length = 0;
      subscribedGlobals = false;
      resubscribeAll();
      onReady?.();
    },
    onDisconnect: () => {
      resetLiveState();
    },
    onWebSocketClose: () => {
      resetLiveState();
    },
    onStompError: (f) => console.error('STOMP error', f.headers['message']),
  });

  client.activate();
}

export function disconnectRealtime() {
  if (client) {
    client.deactivate();
    client = null;
  }
  resetLiveState();
  // A full teardown also forgets intent — the next session re-declares its
  // channels via reloadChannels()/selectChannel().
  desiredChannels.clear();
}

/** Publish an arbitrary call-signaling frame over the shared STOMP connection. */
export function publishCallSignal(payload: Record<string, unknown>): boolean {
  if (!client?.connected) return false;
  client.publish({
    destination: '/app/call/signal',
    body: JSON.stringify(payload),
  });
  return true;
}
