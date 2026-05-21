/* InterLynk domain types + backend DTO mappers.
   All mock/dummy data has been removed — every value here is derived
   from live backend responses. */

export interface User {
  id: string;
  name: string;
  username?: string;
  initials?: string;
  color?: string;
  status?: 'online' | 'away' | 'busy' | 'dnd' | 'offline';
  role?: 'ADMIN' | 'MOD' | 'MEMBER';
  avatar?: string;
}

export interface Channel {
  id: string;
  name: string;
  type?: 'text' | 'announcement' | 'voice';
  unread?: number;
  description?: string;
  locked?: boolean;
  memberCount?: number;
  maxParticipants?: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

/** A direct-message conversation summary (one per other person). */
export interface Conversation {
  userId: string;
  user: User;
  lastMessage: string;
  lastTime: string;
  lastTimeRaw?: string;
  unread: number;
}

/** A single direct (person-to-person) message. */
export interface DirectMessageItem {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  time: string;
  date: string;
  isRead: boolean;
  createdAt?: string;
}

export interface Message {
  id: string;
  userId: string;
  content: string;
  time: string;
  date: string;
  reactions?: Reaction[];
  replies?: number;
  isEdited?: boolean;
}

export const STATUS_COLORS: Record<string, string> = {
  online: '#22c55e',
  away: '#f59e0b',
  busy: '#ef4444',
  dnd: '#ef4444',
  offline: '#5a587c',
};

/* ── Helpers ─────────────────────────────────────────────── */

const AVATAR_COLORS = [
  '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981',
  '#ec4899', '#a78bfa', '#84cc16', '#06b6d4',
  '#f97316', '#3b82f6',
];

/** Deterministic accent colour from a stable id/username. */
export function colorFor(seed: string | number | undefined): string {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initialsFor(name: string | undefined): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function presenceToStatus(p?: string): User['status'] {
  switch ((p || '').toUpperCase()) {
    case 'ONLINE': return 'online';
    case 'AWAY': return 'away';
    case 'BUSY': return 'busy';
    case 'DO_NOT_DISTURB':
    case 'DND': return 'dnd';
    default: return 'offline';
  }
}

function roleToBadge(roles?: string[] | string): User['role'] {
  const list = Array.isArray(roles) ? roles : roles ? [roles] : [];
  const upper = list.map((r) => r.toUpperCase());
  if (upper.includes('ADMIN')) return 'ADMIN';
  if (upper.includes('MANAGER') || upper.includes('MODERATOR') || upper.includes('MOD')) return 'MOD';
  return 'MEMBER';
}

/** Maps a backend UserDto / UserProfileDto / sender object to the UI User. */
export function mapUser(dto: any): User {
  if (!dto) return { id: 'unknown', name: 'Unknown' };
  const id = String(dto.id ?? dto.userId ?? dto.username ?? 'unknown');
  const name = dto.displayName || dto.username || dto.name || 'Unknown';
  return {
    id,
    name,
    username: dto.username,
    initials: initialsFor(name),
    color: colorFor(id),
    status: presenceToStatus(dto.presence || dto.status),
    role: roleToBadge(dto.roles ?? dto.role),
    avatar: dto.avatarUrl || dto.avatar || undefined,
  };
}

function channelKind(type?: string): Channel['type'] {
  const t = (type || '').toUpperCase();
  if (t === 'ANNOUNCEMENT') return 'announcement';
  if (t === 'VOICE') return 'voice';
  return 'text';
}

/** Maps a backend ChannelListResponse / ChannelResponse to the UI Channel. */
export function mapChannel(dto: any): Channel {
  return {
    id: String(dto.id),
    name: dto.name,
    type: channelKind(dto.type),
    description: dto.description || '',
    locked: Boolean(dto.isLocked),
    unread: dto.unreadCount ?? 0,
    memberCount: dto.memberCount ?? 0,
    maxParticipants: dto.maxParticipants ?? undefined,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Backend sends LocalDateTime without zone; treat as UTC ISO. */
function parseDate(raw?: string): Date | null {
  if (!raw) return null;
  const iso = raw.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTime(raw?: string): string {
  const d = parseDate(raw);
  if (!d) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad(m)} ${ampm}`;
}

export function formatDateLabel(raw?: string): string {
  const d = parseDate(raw);
  if (!d) return '';
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayMs = 86400000;
  const diff = Math.round((startOf(now) - startOf(d)) / dayMs);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Maps a backend ChatDto.MessageResponse to the UI Message. */
export function mapMessage(dto: any): Message {
  const reactions: Reaction[] = (dto.reactions || []).map((r: any) => ({
    emoji: r.emoji,
    count: r.count ?? (r.users ? r.users.length : 0),
    reacted: Boolean(r.reactedByCurrentUser),
  }));
  return {
    id: String(dto.id),
    userId: String(dto.senderId ?? dto.sender?.id ?? 'unknown'),
    content: dto.content ?? '',
    time: formatTime(dto.createdAt),
    date: formatDateLabel(dto.createdAt),
    reactions,
    replies: dto.replyCount ?? 0,
    isEdited: Boolean(dto.isEdited),
  };
}

/** Maps a backend ChatDto.ConversationResponse to the UI Conversation. */
export function mapConversation(dto: any): Conversation {
  const user = mapUser(dto.otherUser);
  return {
    userId: user.id,
    user,
    lastMessage: dto.lastMessageContent ?? '',
    lastTime: formatTime(dto.lastMessageTime),
    lastTimeRaw: dto.lastMessageTime,
    unread: dto.unreadCount ?? 0,
  };
}

/** Maps a backend ChatDto.DirectMessageResponse to the UI DirectMessageItem. */
export function mapDirectMessage(dto: any): DirectMessageItem {
  return {
    id: String(dto.id),
    senderId: String(dto.sender?.id ?? dto.senderId ?? 'unknown'),
    recipientId: String(dto.recipient?.id ?? dto.recipientId ?? 'unknown'),
    content: dto.content ?? '',
    time: formatTime(dto.createdAt),
    date: formatDateLabel(dto.createdAt),
    isRead: Boolean(dto.isRead),
    createdAt: dto.createdAt,
  };
}
