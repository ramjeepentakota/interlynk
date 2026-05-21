import { useEffect, useRef, useState } from 'react';

/**
 * Listens for `il-typing` window events (dispatched by the realtime layer
 * when a STOMP message arrives on /topic/channel/{id}/typing) and tracks
 * which users are currently typing in a given channel.
 *
 * Why window events: the existing realtime layer at src/interlynk/realtime.ts
 * already publishes app-wide window CustomEvents for STOMP messages — wiring
 * a parallel context provider would be redundant. Listening here keeps this
 * hook usable from any chat-view component without prop-drilling.
 *
 * Expiry: each "typing=true" event extends a per-user TTL by 4s. If the
 * stop-event is missed (e.g. dropped websocket) the indicator self-clears.
 */

interface TypingPayload {
  channelId: number | string;
  username: string;
  typing: boolean;
}

const TTL_MS = 4000;

export function useTypingIndicator(channelId: number | string | null, selfUsername?: string | null): string[] {
  const [users, setUsers] = useState<string[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (channelId == null) {
      setUsers([]);
      timers.current.clear();
      return;
    }

    const onTyping = (e: Event) => {
      const detail = (e as CustomEvent<TypingPayload>).detail;
      if (!detail) return;
      if (String(detail.channelId) !== String(channelId)) return;
      if (selfUsername && detail.username === selfUsername) return;

      const username = detail.username;

      // Clear any existing timer for this user.
      const existing = timers.current.get(username);
      if (existing) window.clearTimeout(existing);

      if (detail.typing) {
        const timer = window.setTimeout(() => {
          timers.current.delete(username);
          setUsers((curr) => curr.filter((u) => u !== username));
        }, TTL_MS);
        timers.current.set(username, timer);
        setUsers((curr) => (curr.includes(username) ? curr : [...curr, username]));
      } else {
        timers.current.delete(username);
        setUsers((curr) => curr.filter((u) => u !== username));
      }
    };

    window.addEventListener('il-typing', onTyping);
    return () => {
      window.removeEventListener('il-typing', onTyping);
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
      setUsers([]);
    };
  }, [channelId, selfUsername]);

  return users;
}

export default useTypingIndicator;
