import React from 'react';
import { Check, CheckCheck } from 'lucide-react';

interface ReadReceiptProps {
  /** Number of OTHER users who have read this message (excludes sender). */
  readBy: number;
  /** Whether the message has been delivered (not just sent). */
  delivered?: boolean;
  /** Tooltip text — typically a "Seen by alice, bob..." list. */
  title?: string;
}

/**
 * Small Whatsapp/Teams-style indicator:
 *   – not delivered:   nothing
 *   – delivered:       single tick (✓)
 *   – seen by ≥1:      double tick + count
 *
 * Rendered inline at the trailing edge of the sender's own message bubble.
 * Renders nothing for messages from other users (the sender doesn't care
 * which of the channel's members read theirs).
 */
export function ReadReceipt({ readBy, delivered = true, title }: ReadReceiptProps) {
  if (!delivered) return null;

  if (readBy <= 0) {
    return (
      <span title="Delivered" className="inline-flex items-center text-text-muted">
        <Check className="w-3.5 h-3.5" />
      </span>
    );
  }

  return (
    <span
      title={title ?? `Seen by ${readBy}`}
      className="inline-flex items-center gap-0.5 text-primary"
    >
      <CheckCheck className="w-3.5 h-3.5" />
      {readBy > 1 && <span className="text-[10px] font-medium">{readBy}</span>}
    </span>
  );
}

export default ReadReceipt;
