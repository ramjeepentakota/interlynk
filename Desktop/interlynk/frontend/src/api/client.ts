import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAppStore';

// API base URL.
// By default the frontend talks to its OWN origin (relative URLs). In dev,
// Vite proxies /api and /ws to the Spring Boot backend; in prod, an HTTPS
// reverse proxy (nginx/Caddy/etc.) does the same. This keeps the browser on
// a single secure origin so getUserMedia + cookies + CORS all behave.
// Override with VITE_API_URL when you really need a cross-origin backend.
//
// Guard against mixed content: an absolute http:// backend URL on an https://
// page is blocked by the browser. Fall back to same-origin (the proxy) so
// requests stay on https:// and the realtime WebSocket isn't killed.
const API_BASE_URL = (() => {
  const configured = import.meta.env.VITE_API_URL ?? '';
  if (
    configured &&
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    configured.startsWith('http://')
  ) {
    console.warn(
      `[api] Ignoring insecure VITE_API_URL "${configured}" on an https page; using same-origin proxy instead.`
    );
    return '';
  }
  return configured;
})();

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    console.log('API Request - Token:', token ? 'present' : 'missing');
    
    // Only use token if it exists and is not the demo token
    if (token && token !== 'demo-token' && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Added Authorization header');
    } else {
      console.log('No Authorization header added - token:', token);
    }
    // If no valid token, don't add Authorization header - let the request proceed
    // The backend will return 401 and we'll handle it in the response interceptor
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && originalRequest) {
      // Check if this is a login/register request - don't try to refresh
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register')) {
        return Promise.reject(error);
      }
      
      // Try to refresh token (but not for demo tokens)
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken && refreshToken !== 'demo-refresh-token') {
        try {
          const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
            refreshToken,
          });
          // Backend returns { accessToken, refreshToken } (TokenRefreshResponse)
          const newToken = response.data.accessToken ?? response.data.token;
          const newRefresh = response.data.refreshToken ?? refreshToken;
          useAuthStore.getState().setTokens(newToken, newRefresh);
          
          // Retry the original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        } catch {
          // Refresh failed, logout user
          useAuthStore.getState().logout();
        }
      } else {
        // No valid refresh token, logout user
        useAuthStore.getState().logout();
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (username: string, password: string, rememberMe?: boolean) =>
    apiClient.post('/api/v1/auth/login', { username, password, rememberMe: !!rememberMe }),

  /** Stage 2 of an MFA-protected sign-in: redeem the mfaChallenge + 6-digit code (or backup code). */
  loginMfa: (mfaChallenge: string, code: string) =>
    apiClient.post('/api/v1/auth/login/mfa', { mfaChallenge, code }),

  register: (email: string, username: string, displayName: string, password: string) =>
    apiClient.post('/api/v1/auth/register', { email, username, displayName, password }),
  
  logout: () => apiClient.post('/api/v1/auth/logout'),
  
  refreshToken: (refreshToken: string) =>
    apiClient.post('/api/v1/auth/refresh', { refreshToken }),
  
  getProfile: () => apiClient.get('/api/v1/auth/me'),
  
  updateProfile: (data: { displayName?: string; avatarUrl?: string }) =>
    apiClient.put('/api/v1/auth/profile', data),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/api/v1/auth/change-password', { currentPassword, newPassword }),
  
  searchUsers: (query: string) =>
    apiClient.get(`/api/v1/auth/users/search?query=${encodeURIComponent(query)}`),
};

// Workspace API
export const workspaceApi = {
  getWorkspaces: () => apiClient.get('/api/workspaces'),
  
  getWorkspace: (id: string) => apiClient.get(`/api/workspaces/${id}`),
  
  createWorkspace: (data: { name: string; slug: string; description?: string }) =>
    apiClient.post('/api/workspaces', data),
  
  updateWorkspace: (id: string, data: { name?: string; description?: string; icon?: string }) =>
    apiClient.put(`/api/workspaces/${id}`, data),
  
  deleteWorkspace: (id: string) => apiClient.delete(`/api/workspaces/${id}`),
  
  getMembers: (workspaceId: string) => apiClient.get(`/api/workspaces/${workspaceId}/members`),
  
  inviteMember: (workspaceId: string, email: string, role: string) =>
    apiClient.post(`/api/workspaces/${workspaceId}/members`, { email, role }),
  
  removeMember: (workspaceId: string, userId: string) =>
    apiClient.delete(`/api/workspaces/${workspaceId}/members/${userId}`),

  // ─── Workspace files (Monaco editor) ───────────────────────────────
  getFiles: (workspaceId: string | number) =>
    apiClient.get<Array<{ filePath: string; language?: string; updatedAt?: string }>>(
      `/api/workspaces/${workspaceId}/files`,
    ),

  getFile: (workspaceId: string | number, filePath: string) =>
    apiClient.get<{ filePath: string; content: string; language?: string }>(
      `/api/workspaces/${workspaceId}/files/${encodeURIComponent(filePath)}`,
    ),

  saveFile: (workspaceId: string | number, filePath: string, content: string) =>
    apiClient.post<{ filePath: string; updatedAt: string }>(
      `/api/workspaces/${workspaceId}/files`,
      { filePath, content },
    ),
};

// Channel API
export const channelApi = {
  getChannels: (workspaceId?: string) => apiClient.get('/api/channels'),
  
  getChannel: (channelId: string) => apiClient.get(`/api/channels/${channelId}`),
  
  createChannel: (data: { name: string; type: string; description?: string }) =>
    apiClient.post('/api/channels', data),
  
  updateChannel: (channelId: string, data: { name?: string; description?: string; position?: number }) =>
    apiClient.put(`/api/channels/${channelId}`, data),
  
  deleteChannel: (channelId: string) => apiClient.delete(`/api/channels/${channelId}`),
  
  addMember: (channelId: string, username: string) =>
    apiClient.post(`/api/channels/${channelId}/members?username=${username}`),

  removeMember: (channelId: string, username: string) =>
    apiClient.delete(`/api/channels/${channelId}/members?username=${username}`),
};

// Direct Message (person-to-person inbox) API
export const dmApi = {
  getConversations: () => apiClient.get('/api/dm/conversations'),

  getConversation: (userId: string | number) =>
    apiClient.get(`/api/dm/conversations/${userId}`),

  sendMessage: (recipientId: string | number, content: string) =>
    apiClient.post('/api/dm', { recipientId: Number(recipientId), content }),

  markRead: (userId: string | number) =>
    apiClient.post(`/api/dm/conversations/${userId}/read`),

  getUnreadCount: () => apiClient.get('/api/dm/unread-count'),
};

// LiveKit (SFU) media token API
export const liveKitApi = {
  getToken: (room: string | number, canPublish = true) =>
    apiClient.get(`/api/calls/livekit/token?room=${encodeURIComponent(String(room))}&canPublish=${canPublish}`),
};

// Self-hosted mediasoup SFU join-token API (group calls)
export const sfuApi = {
  getToken: (room: string | number, canPublish = true) =>
    apiClient.get(`/api/calls/sfu/token?room=${encodeURIComponent(String(room))}&canPublish=${canPublish}`),
};

// Message API
export const messageApi = {
  getMessages: (channelId: string, page = 0, size = 50) =>
    apiClient.get(`/api/channels/${channelId}/messages?page=${page}&size=${size}`),
  
  sendMessage: (channelId: string, content: string, replyToId?: string, attachments?: Array<{ filename: string; url: string; size: number; fileType: string }>) =>
    apiClient.post(`/api/channels/${channelId}/messages`, { content, replyToId, attachments }),
  
  updateMessage: (messageId: string, content: string) =>
    apiClient.put(`/api/messages/${messageId}`, { content }),
  
  deleteMessage: (messageId: string) => apiClient.delete(`/api/messages/${messageId}`),
  
  reactToMessage: (messageId: string, emoji: string) =>
    apiClient.post(`/api/messages/${messageId}/reactions`, { emoji }),
  
  removeReaction: (messageId: string, emoji: string) =>
    apiClient.delete(`/api/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`),

  getThreadMessages: (messageId: string) =>
    apiClient.get(`/api/messages/${messageId}/thread`),
  
  sendThreadMessage: (messageId: string, content: string) =>
    apiClient.post(`/api/messages/${messageId}/reply`, { content }),
  
  uploadAttachment: (channelId: string, formData: FormData) =>
    apiClient.post(`/api/channels/${channelId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
};

// Call API
export const callApi = {
  getActiveCalls: () => apiClient.get('/api/calls/rooms'),
  
  getCall: (callId: string) => apiClient.get(`/api/calls/room/${callId}`),
  
  createCall: (data: { name: string; type: string }) =>
    apiClient.post('/api/calls/room', data),
  
  joinCall: (callId: string) => apiClient.post(`/api/calls/room/${callId}/join`),
  
  leaveCall: (callId: string) => apiClient.post(`/api/calls/room/${callId}/leave`),
  
  endCall: (callId: string) => apiClient.post(`/api/calls/room/${callId}/end`),
  
  getParticipants: (callId: string) => apiClient.get(`/api/calls/room/${callId}/participants`),
  
  updateState: (callId: string, state: { isMuted?: boolean; isVideoEnabled?: boolean; isScreenSharing?: boolean }) =>
    apiClient.put(`/api/calls/room/${callId}/state`, state),
  
  createDirectCall: (userId: number, callType: 'voice' | 'video' = 'voice') =>
    apiClient.post('/api/calls/direct', { userId, callType }),

  // Invite (add) another user into an EXISTING call room. The backend rings
  // them with a GROUP incoming call so they join via the multi-party SFU path.
  inviteToCall: (callId: string | number, userId: number, callType: 'voice' | 'video' = 'voice') =>
    apiClient.post(`/api/calls/room/${callId}/invite`, { userId, callType }),
};

// Notification API
export const notificationApi = {
  getNotifications: () => apiClient.get('/api/notifications'),

  getUnreadNotifications: () => apiClient.get('/api/notifications/unread'),

  markAsRead: (notificationId: string) =>
    apiClient.post(`/api/notifications/${notificationId}/read`),

  markAllAsRead: () => apiClient.post('/api/notifications/read-all'),

  getUnreadCount: () => apiClient.get('/api/notifications/count'),
};

// Code Execution API
export const codeExecutionApi = {
  executeCode: (code: string, language: string) =>
    apiClient.post('/api/code/execute', { code, language }),
  
  getExecutionHistory: (page = 0, size = 20) =>
    apiClient.get(`/api/code/history?page=${page}&size=${size}`),
};

// Code Review API
export const codeReviewApi = {
  getPullRequests: (status?: string) =>
    apiClient.get(`/api/code-reviews/prs${status ? `?status=${status}` : ''}`),
  
  getPullRequest: (prId: string) => apiClient.get(`/api/code-reviews/prs/${prId}`),
  
  createPullRequest: (data: { title: string; description: string; sourceBranch: string; targetBranch: string }) =>
    apiClient.post('/api/code-reviews/prs', data),
  
  mergePullRequest: (prId: string) => apiClient.post(`/api/code-reviews/prs/${prId}/merge`),
  
  closePullRequest: (prId: string) => apiClient.post(`/api/code-reviews/prs/${prId}/close`),
  
  addComment: (prId: string, data: { content: string; line?: number }) =>
    apiClient.post(`/api/code-reviews/prs/${prId}/comments`, data),
  
  approvePullRequest: (prId: string) => apiClient.post(`/api/code-reviews/prs/${prId}/approve`),
  
  rejectPullRequest: (prId: string) => apiClient.post(`/api/code-reviews/prs/${prId}/reject`),
};

// Admin API
export const adminApi = {
  getUsers: () => apiClient.get('/api/admin/users'),
  
  getUser: (userId: string) => apiClient.get(`/api/admin/users/${userId}`),
  
  createUser: (data: { username: string; email: string; password: string; displayName?: string; role?: string }) =>
    apiClient.post('/api/admin/users', data),
  
  updateUser: (userId: string, data: { displayName?: string; role?: string; status?: string }) =>
    apiClient.put(`/api/admin/users/${userId}`, data),
  
  updateUserRoles: (userId: string, roles: string[]) =>
    apiClient.put(`/api/admin/users/${userId}/roles`, { roles }),
  
  updateUserStatus: (userId: string, status: string) =>
    apiClient.put(`/api/admin/users/${userId}/status`, { status }),
  
  deleteUser: (userId: string) => apiClient.delete(`/api/admin/users/${userId}`),
  
  getTeams: () => apiClient.get('/api/admin/teams'),
  
  createTeam: (data: { name: string; description?: string }) =>
    apiClient.post('/api/admin/teams', data),
  
  getAuditLogs: (page = 0, size = 50) =>
    apiClient.get(`/api/admin/audit-logs?page=${page}&size=${size}`),
  
  getSystemStats: () => apiClient.get('/api/admin/stats'),
  
  getSystemSettings: () => apiClient.get('/api/admin/settings'),
  
  updateSystemSettings: (settings: Record<string, string>) =>
    apiClient.put('/api/admin/settings', settings),
  
  // Channel Access Management
  getChannels: () => apiClient.get('/api/admin/channels'),
  
  getChannel: (channelId: string) => apiClient.get(`/api/admin/channels/${channelId}`),
  
  updateChannel: (channelId: string, data: { name?: string; description?: string; category?: string; isActive?: boolean; isLocked?: boolean; maxParticipants?: number }) =>
    apiClient.put(`/api/admin/channels/${channelId}`, data),
  
  addChannelMember: (channelId: string, userId: string) =>
    apiClient.post(`/api/admin/channels/${channelId}/members/${userId}`),
  
  removeChannelMember: (channelId: string, userId: string) =>
    apiClient.delete(`/api/admin/channels/${channelId}/members/${userId}`),
  
  // Voice Channel Access Management
  getVoiceChannels: () => apiClient.get('/api/admin/voice-channels'),
  
  updateVoiceChannelSettings: (channelId: string, data: { maxParticipants?: number; isLocked?: boolean; isActive?: boolean }) =>
    apiClient.put(`/api/admin/voice-channels/${channelId}/settings`, data),
  
  // User Access Management
  getUserAccess: (userId: string) => apiClient.get(`/api/admin/users/${userId}/access`),
  
  updateUserAccess: (userId: string, data: { roles?: string[]; channelIds?: number[] }) =>
    apiClient.put(`/api/admin/users/${userId}/access`, data),
  
  // Roles Management
  getRoles: () => apiClient.get('/api/admin/roles'),
  
  createRole: (data: { name: string; description?: string; permissions?: string }) =>
    apiClient.post('/api/admin/roles', data),
  
  deleteRole: (roleId: string) => apiClient.delete(`/api/admin/roles/${roleId}`),
};

// ─── New endpoints introduced in production-hardening pass ────────────────────

export const searchApi = {
  /** Cross-channel full-text search. scope: 'all' | 'messages' | 'users'. */
  search: (query: string, scope: 'all' | 'messages' | 'users' = 'all', limit = 50) =>
    apiClient.get('/api/search', { params: { q: query, scope, limit } }),
};

export const readReceiptApi = {
  markRead: (channelId: number | string, lastMessageId: number | string) =>
    apiClient.post(`/api/channels/${channelId}/read`, { lastMessageId }),
  getReadIds: (channelId: number | string) =>
    apiClient.get<number[]>(`/api/channels/${channelId}/read`),
};

export const scheduledMessageApi = {
  list: () => apiClient.get('/api/scheduled-messages'),
  create: (data: { channelId: number | string; content: string; dispatchAt: string }) =>
    apiClient.post('/api/scheduled-messages', data),
  cancel: (id: number | string) => apiClient.delete(`/api/scheduled-messages/${id}`),
};

export interface ScheduledCallInvitee {
  userId: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface ScheduledCall {
  id: number;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  callType: 'voice' | 'video';
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  callRoomId: number | null;
  /** Shareable meeting code, e.g. "abc-defg-hij". */
  meetingCode?: string | null;
  /** Shareable relative join URL ("/join/{code}"). */
  meetingLink?: string | null;
  createdByUserId: number;
  createdByUsername: string;
  createdByDisplayName?: string;
  invitees: ScheduledCallInvitee[];
  createdAt: string;
}

export const scheduledCallApi = {
  // Upcoming (PENDING/ACTIVE) calls you host or were invited to.
  list: () => apiClient.get<ScheduledCall[]>('/api/scheduled-calls'),

  get: (id: number | string) => apiClient.get<ScheduledCall>(`/api/scheduled-calls/${id}`),

  // scheduledAt must be an ISO local datetime, e.g. "2026-05-23T15:30:00".
  create: (data: {
    title: string;
    scheduledAt: string;
    durationMinutes?: number;
    callType?: 'voice' | 'video';
    inviteeIds: number[];
  }) => apiClient.post<ScheduledCall>('/api/scheduled-calls', data),

  update: (
    id: number | string,
    data: Partial<{
      title: string;
      scheduledAt: string;
      durationMinutes: number;
      callType: 'voice' | 'video';
      inviteeIds: number[];
    }>,
  ) => apiClient.put<ScheduledCall>(`/api/scheduled-calls/${id}`, data),

  cancel: (id: number | string) => apiClient.delete(`/api/scheduled-calls/${id}`),

  // Join (or launch) the call's single shared room. The backend creates ONE
  // room on first join and returns it on every subsequent call, so every
  // participant lands in the SAME room (this is what groups them in the SFU).
  joinLive: (id: number | string) =>
    apiClient.post<ScheduledCall>(`/api/scheduled-calls/${id}/join`),

  // Resolve a shareable meeting code to the scheduled call (title/time/status).
  getByCode: (code: string) =>
    apiClient.get<ScheduledCall>(`/api/scheduled-calls/by-code/${encodeURIComponent(code)}`),

  // Join via the shareable meeting code. The caller is added as an on-the-fly
  // invitee if needed, then routed into the same shared room as everyone else.
  joinByCode: (code: string) =>
    apiClient.post<ScheduledCall>(`/api/scheduled-calls/by-code/${encodeURIComponent(code)}/join`),
};

export const webhookAdminApi = {
  list: () => apiClient.get('/api/admin/webhooks'),
  create: (data: { name: string; url: string; events: string; secret?: string; active?: boolean }) =>
    apiClient.post('/api/admin/webhooks', data),
  update: (id: number | string, data: Partial<{ name: string; url: string; events: string; secret: string; active: boolean }>) =>
    apiClient.put(`/api/admin/webhooks/${id}`, data),
  delete: (id: number | string) => apiClient.delete(`/api/admin/webhooks/${id}`),
};

export default apiClient;
