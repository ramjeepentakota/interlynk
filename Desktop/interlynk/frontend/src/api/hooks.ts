import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  authApi,
  channelApi,
  notificationApi,
  searchApi,
  readReceiptApi,
  scheduledMessageApi,
} from './client';

/**
 * React-Query hooks layer. The codebase historically did all server state by
 * hand through Zustand; we keep that for chat-stream data (which arrives via
 * websocket and would fight a cache) but funnel everything else through
 * react-query so we get retries, deduped fetches, and automatic refetch on
 * mutation.
 *
 * Convention: query keys are tuples ['domain', 'subdomain', ...args] so we can
 * invalidate hierarchically (e.g. queryClient.invalidateQueries({ queryKey:
 * ['channel'] }) wipes everything channel-related).
 */

// ─── Current user ────────────────────────────────────────────────────────────

export const useCurrentUser = () =>
  useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await authApi.getProfile()).data,
  });

// ─── Channels ────────────────────────────────────────────────────────────────

export const useChannels = () =>
  useQuery({
    queryKey: ['channel', 'list'],
    queryFn: async () => (await channelApi.getChannels()).data,
  });

// ─── Notifications ───────────────────────────────────────────────────────────

export const useNotifications = (unreadOnly = false) =>
  useQuery({
    queryKey: ['notification', unreadOnly ? 'unread' : 'all'],
    queryFn: async () =>
      (
        await (unreadOnly
          ? notificationApi.getUnreadNotifications()
          : notificationApi.getNotifications())
      ).data,
    refetchInterval: 30_000, // safety-net poll; websocket invalidates on push
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => notificationApi.markAsRead(String(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification'] }),
  });
};

// ─── Full-text search ────────────────────────────────────────────────────────

export const useSearch = (query: string, scope: 'all' | 'messages' | 'users' = 'all') =>
  useQuery({
    queryKey: ['search', scope, query],
    queryFn: async () => (await searchApi.search(query, scope)).data,
    enabled: query.trim().length >= 2, // skip on empty / 1-char inputs
    staleTime: 60 * 1000,
  });

// ─── Read receipts ───────────────────────────────────────────────────────────

export const useChannelReadIds = (channelId: number | string | null) =>
  useQuery({
    queryKey: ['channel', 'read-ids', channelId],
    queryFn: async () => (await readReceiptApi.getReadIds(channelId!)).data,
    enabled: channelId != null,
  });

export const useMarkChannelRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { channelId: number | string; lastMessageId: number | string }) =>
      readReceiptApi.markRead(vars.channelId, vars.lastMessageId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['channel', 'read-ids', vars.channelId] });
      qc.invalidateQueries({ queryKey: ['notification'] });
    },
  });
};

// ─── Scheduled messages ──────────────────────────────────────────────────────

export const useScheduledMessages = () =>
  useQuery({
    queryKey: ['scheduled-message', 'list'],
    queryFn: async () => (await scheduledMessageApi.list()).data,
  });

export const useScheduleMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { channelId: number | string; content: string; dispatchAt: string }) =>
      scheduledMessageApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-message'] }),
  });
};

export const useCancelScheduledMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => scheduledMessageApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-message'] }),
  });
};
