import React from 'react';

interface TypingIndicatorProps {
  /** Set of usernames currently typing in this channel (excluding self). */
  users: string[];
}

/**
 * "Alice is typing..." bar. Renders nothing when no one is typing so the
 * caller can place it as a fixed-height slot without layout shift.
 *
 * Grammar:
 *   1 user  → "alice is typing…"
 *   2 users → "alice and bob are typing…"
 *   3 users → "alice, bob and 1 other are typing…"
 *   4+      → "alice and 3 others are typing…"
 */
export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (!users || users.length === 0) return null;

  let label: string;
  if (users.length === 1) {
    label = `${users[0]} is typing`;
  } else if (users.length === 2) {
    label = `${users[0]} and ${users[1]} are typing`;
  } else if (users.length === 3) {
    label = `${users[0]}, ${users[1]} and 1 other are typing`;
  } else {
    label = `${users[0]} and ${users.length - 1} others are typing`;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-text-muted px-3 py-1.5 italic">
      <span className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1 h-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
      <span>{label}…</span>
    </div>
  );
}

export default TypingIndicator;
