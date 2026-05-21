import React from 'react';

interface MentionTextProps {
  /** Plain message body, possibly containing @user / @here / @channel tokens. */
  text: string;
  /** Optional: highlight the viewer's own @mention more strongly. */
  currentUsername?: string | null;
  className?: string;
}

const MENTION_RE = /(?<![A-Za-z0-9_])@([A-Za-z0-9._-]{2,40})/g;
const SPECIAL_TOKENS = new Set(['here', 'channel', 'all', 'everyone']);

/**
 * Render a message body with @mentions wrapped in clickable spans. Mirrors the
 * backend MentionService regex exactly so client and server agree on what is
 * a mention. URLs and other markup are NOT processed here — keep this
 * component single-purpose.
 *
 * Why a component: every place that renders message content (channel list,
 * thread view, search results, notification body) needs mention styling, and
 * a string-replace approach loses the highlight-self capability.
 */
export function MentionText({ text, currentUsername, className }: MentionTextProps) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[1];
    const tokenLower = token.toLowerCase();
    const isSelf = !!currentUsername && tokenLower === currentUsername.toLowerCase();
    const isSpecial = SPECIAL_TOKENS.has(tokenLower);

    parts.push(
      <span
        key={match.index}
        className={
          'inline px-1 rounded font-medium ' +
          (isSelf
            ? 'bg-primary/20 text-primary'
            : isSpecial
              ? 'bg-warning/15 text-warning'
              : 'bg-primary/10 text-primary/90')
        }
        title={isSpecial ? `Group mention: @${token}` : `@${token}`}
      >
        @{token}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return <span className={className}>{parts}</span>;
}

export default MentionText;
