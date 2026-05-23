/* InterLynk backend API layer.
   Thin wrappers over the shared axios client that return mapped
   domain objects. No mock data anywhere. */
import {
  authApi,
  channelApi,
  messageApi,
  notificationApi,
  callApi,
  dmApi,
  liveKitApi,
} from '@/api/client';
import apiClient from '@/api/client';
import { useAuthStore } from '@/store/useAppStore';
import {
  mapUser,
  mapChannel,
  mapMessage,
  mapConversation,
  mapDirectMessage,
  mapAttachment,
  mapPoll,
  type User,
  type Channel,
  type Message,
  type Conversation,
  type DirectMessageItem,
  type Attachment,
  type Poll,
} from './data';

export interface AuthResult {
  user: User;
  raw: any;
}

/* ── Auth ────────────────────────────────────────────────── */

export async function login(username: string, password: string): Promise<AuthResult> {
  const res = await authApi.login(username.trim(), password);
  const { accessToken, refreshToken, user } = res.data;
  if (!accessToken || !user) throw new Error('Invalid response from server');

  const frontendUser = {
    id: String(user.id),
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatarUrl,
    status: (user.presence || 'online') as any,
    role: user.roles?.[0] || 'USER',
    roles: user.roles || [],
    createdAt: user.createdAt,
    updatedAt: user.lastSeenAt || user.createdAt,
  };
  useAuthStore.getState().setUser(frontendUser as any);
  useAuthStore.getState().setTokens(accessToken, refreshToken);
  return { user: mapUser(user), raw: user };
}

export async function fetchMe(): Promise<AuthResult> {
  const res = await authApi.getProfile();
  return { user: mapUser(res.data), raw: res.data };
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    /* ignore network/401 on logout */
  }
  useAuthStore.getState().logout();
}

export async function searchUsers(query: string): Promise<User[]> {
  if (!query.trim()) return [];
  const res = await authApi.searchUsers(query.trim());
  return (res.data || []).map(mapUser);
}

export async function updateProfile(displayName: string): Promise<User> {
  const res = await authApi.updateProfile({ displayName });
  return mapUser(res.data);
}

/** Persist a new avatar (already a URL or a data: URL). Returns the updated
 *  user so the caller can refresh local state and broadcast the change. */
export async function updateAvatar(avatarUrl: string): Promise<User> {
  const res = await authApi.updateProfile({ avatarUrl });
  return mapUser(res.data);
}

/* ── Channels ────────────────────────────────────────────── */

export async function fetchChannels(): Promise<Channel[]> {
  const res = await channelApi.getChannels();
  return (res.data || []).map(mapChannel);
}

export async function fetchChannelDetail(
  channelId: string
): Promise<{ channel: Channel; members: User[] }> {
  const res = await channelApi.getChannel(channelId);
  const members = (res.data.members || []).map(mapUser);
  return { channel: mapChannel(res.data), members };
}

export async function createChannel(name: string, description = ''): Promise<Channel> {
  const res = await channelApi.createChannel({ name, type: 'PUBLIC', description });
  return mapChannel(res.data);
}

export async function deleteChannel(channelId: string): Promise<void> {
  await channelApi.deleteChannel(channelId);
}

export async function inviteToChannel(channelId: string, username: string): Promise<void> {
  await channelApi.addMember(channelId, username);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await authApi.changePassword(currentPassword, newPassword);
}

/* ── Messages ────────────────────────────────────────────── */

export interface MessagePage {
  messages: Message[];
  senders: User[];
  hasMore: boolean;
}

export async function fetchMessages(
  channelId: string,
  page = 0,
  size = 50
): Promise<MessagePage> {
  const res = await messageApi.getMessages(channelId, page, size);
  const list = res.data?.messages ?? res.data ?? [];
  const senders: User[] = [];
  const messages = list.map((m: any) => {
    if (m.sender) senders.push(mapUser(m.sender));
    return mapMessage(m);
  });
  // Backend returns newest-first pages; show oldest-first in the UI.
  messages.reverse();
  return { messages, senders, hasMore: Boolean(res.data?.hasNext) };
}

export async function sendMessage(
  channelId: string,
  content: string,
  attachments?: Attachment[]
): Promise<{ message: Message; sender?: User }> {
  const payload = attachments && attachments.length > 0
    ? attachments.map((a) => ({
        filename: a.fileName,
        url: a.fileUrl,
        size: a.fileSize,
        fileType: a.fileType,
      }))
    : undefined;
  const res = await messageApi.sendMessage(channelId, content, undefined, payload);
  return {
    message: mapMessage(res.data),
    sender: res.data.sender ? mapUser(res.data.sender) : undefined,
  };
}

/** Upload a single file to a channel. Returns the persisted attachment record
 *  the backend will accept inside a subsequent sendMessage call. */
export async function uploadAttachment(
  channelId: string,
  file: File | Blob,
  filename?: string
): Promise<Attachment> {
  const form = new FormData();
  // FormData needs a real filename for the multipart "filename=" header,
  // which the backend uses as the original-name fallback when storing the file.
  const f =
    file instanceof File ? file : new File([file], filename || 'upload.bin', { type: (file as Blob).type });
  form.append('file', f, filename || f.name);
  const res = await messageApi.uploadAttachment(channelId, form);
  const data = res.data || {};
  return mapAttachment({
    id: data.id,
    fileName: data.fileName || f.name,
    fileUrl: data.fileUrl || '',
    fileType: data.fileType || f.type || 'application/octet-stream',
    fileSize: data.fileSize ?? f.size ?? 0,
  });
}

/* ── Polls ───────────────────────────────────────────────── */

export async function createPoll(
  channelId: string,
  question: string,
  options: string[],
  allowMultiple: boolean
): Promise<{ message: Message; sender?: User }> {
  const res = await apiClient.post(`/api/channels/${channelId}/polls`, { question, options, allowMultiple });
  return {
    message: mapMessage(res.data),
    sender: res.data.sender ? mapUser(res.data.sender) : undefined,
  };
}

export async function votePoll(pollId: string, optionIds: string[]): Promise<Poll> {
  const res = await apiClient.post(`/api/polls/${pollId}/vote`, { optionIds: optionIds.map((id) => Number(id)) });
  return mapPoll(res.data);
}

/** Mark messages in a channel as read up to (and including) the given message,
 *  using the existing ReadReceiptService endpoint. Best-effort. The backend
 *  backfills receipts for everything older than this marker and broadcasts a
 *  'messages_read' delta to the channel topic. */
export async function markMessageRead(channelId: string, messageId: string): Promise<void> {
  try {
    await apiClient.post(`/api/channels/${channelId}/read`, { lastMessageId: Number(messageId) });
  } catch {
    /* best-effort */
  }
}

export async function editMessage(messageId: string, content: string): Promise<Message> {
  const res = await messageApi.updateMessage(messageId, content);
  return mapMessage(res.data);
}

export async function deleteMessage(messageId: string): Promise<void> {
  await messageApi.deleteMessage(messageId);
}

export async function addReaction(messageId: string, emoji: string): Promise<void> {
  await messageApi.reactToMessage(messageId, emoji);
}

export async function removeReaction(messageId: string, emoji: string): Promise<void> {
  await messageApi.removeReaction(messageId, emoji);
}

export interface ThreadResult {
  parent: Message;
  replies: Message[];
  senders: User[];
  total: number;
}

export async function fetchThread(messageId: string): Promise<ThreadResult> {
  const res = await messageApi.getThreadMessages(messageId);
  const senders: User[] = [];
  const collect = (m: any) => {
    if (m?.sender) senders.push(mapUser(m.sender));
    return mapMessage(m);
  };
  return {
    parent: collect(res.data.parentMessage),
    replies: (res.data.replies || []).map(collect),
    senders,
    total: res.data.totalReplies ?? (res.data.replies || []).length,
  };
}

export async function sendThreadReply(
  messageId: string,
  content: string
): Promise<{ message: Message; sender?: User }> {
  const res = await messageApi.sendThreadMessage(messageId, content);
  return {
    message: mapMessage(res.data),
    sender: res.data.sender ? mapUser(res.data.sender) : undefined,
  };
}

/* ── Notifications ───────────────────────────────────────── */

export interface UiNotification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export async function fetchNotifications(): Promise<UiNotification[]> {
  const res = await notificationApi.getNotifications();
  return (res.data || []).map((n: any) => ({
    id: String(n.id),
    title: n.title || n.type || 'Notification',
    message: n.message || n.content || '',
    isRead: Boolean(n.isRead ?? n.read),
    createdAt: n.createdAt,
  }));
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await notificationApi.getUnreadCount();
  return res.data?.count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await notificationApi.markAsRead(id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await notificationApi.markAllAsRead();
}

/* ── Presence ────────────────────────────────────────────── */

export async function updatePresence(status: string): Promise<void> {
  try {
    await apiClient.put('/api/chat/presence', { status });
  } catch {
    /* presence is best-effort */
  }
}

/* ── Calls ───────────────────────────────────────────────── */

export interface CallSession {
  roomId: number;
  targetUserId: number | null;
}

export async function startDirectCall(
  targetUserId: number,
  callType: 'voice' | 'video'
): Promise<CallSession> {
  const res = await callApi.createDirectCall(targetUserId, callType);
  return { roomId: res.data.id, targetUserId };
}

export async function createGroupCall(
  name: string,
  _callType: 'voice' | 'video'
): Promise<CallSession> {
  // Both audio-only and video group calls live in the GROUP room type now —
  // the previous VOICE_CHANNEL room type was the backing for the removed
  // ambient voice-channel feature and is no longer used.
  const res = await callApi.createCall({ name, type: 'GROUP' });
  return { roomId: res.data.id, targetUserId: null };
}

export async function joinCall(roomId: number): Promise<void> {
  await callApi.joinCall(String(roomId));
}

export async function leaveCall(roomId: number): Promise<void> {
  try {
    await callApi.leaveCall(String(roomId));
  } catch {
    /* ignore */
  }
}

export async function fetchCallParticipants(roomId: number): Promise<User[]> {
  const res = await callApi.getParticipants(String(roomId));
  return (res.data || []).map((p: any) => mapUser(p.user || p));
}

/* ── Direct Messages (person-to-person inbox) ────────────── */

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await dmApi.getConversations();
  return (res.data || []).map(mapConversation);
}

export async function fetchConversation(
  userId: string | number
): Promise<{ messages: DirectMessageItem[]; participants: User[] }> {
  const res = await dmApi.getConversation(userId);
  const list = res.data || [];
  const participants: User[] = [];
  const messages = list.map((m: any) => {
    if (m.sender) participants.push(mapUser(m.sender));
    if (m.recipient) participants.push(mapUser(m.recipient));
    return mapDirectMessage(m);
  });
  return { messages, participants };
}

export async function sendDirectMessage(
  recipientId: string | number,
  content: string
): Promise<DirectMessageItem> {
  const res = await dmApi.sendMessage(recipientId, content);
  return mapDirectMessage(res.data);
}

export async function markConversationRead(userId: string | number): Promise<void> {
  try {
    await dmApi.markRead(userId);
  } catch {
    /* best-effort */
  }
}

export async function fetchDmUnreadCount(): Promise<number> {
  try {
    const res = await dmApi.getUnreadCount();
    return res.data?.count ?? 0;
  } catch {
    return 0;
  }
}

/* ── LiveKit (SFU) media ─────────────────────────────────── */

export interface LiveKitToken {
  configured: boolean;
  url?: string;
  token?: string;
  identity?: string;
}

export async function fetchLiveKitToken(
  room: string | number,
  canPublish = true
): Promise<LiveKitToken> {
  try {
    const res = await liveKitApi.getToken(room, canPublish);
    return res.data as LiveKitToken;
  } catch {
    return { configured: false };
  }
}
