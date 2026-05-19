import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAppStore';

// API base URL - change this to your backend URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082';

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
          const { token: newToken } = response.data;
          useAuthStore.getState().setTokens(newToken, refreshToken);
          
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
  login: (username: string, password: string) =>
    apiClient.post('/api/v1/auth/login', { username, password }),
  
  register: (email: string, username: string, displayName: string, password: string) =>
    apiClient.post('/api/v1/auth/register', { email, username, displayName, password }),
  
  logout: () => apiClient.post('/api/v1/auth/logout'),
  
  refreshToken: (refreshToken: string) =>
    apiClient.post('/api/v1/auth/refresh', { refreshToken }),
  
  getProfile: () => apiClient.get('/api/v1/auth/me'),
  
  updateProfile: (data: { displayName?: string; avatar?: string }) =>
    apiClient.put('/api/v1/auth/profile', data),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/api/v1/auth/change-password', { currentPassword, newPassword }),
  
  searchUsers: (query: string) =>
    apiClient.get(`/api/auth/users/search?query=${encodeURIComponent(query)}`),
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
    apiClient.delete(`/api/messages/${messageId}/reactions`),
  
  getThreadMessages: (messageId: string) =>
    apiClient.get(`/api/messages/${messageId}/reply`),
  
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
};

// Notification API
export const notificationApi = {
  getNotifications: (page = 0, size = 20) =>
    apiClient.get(`/api/notifications?page=${page}&size=${size}`),
  
  markAsRead: (notificationId: string) =>
    apiClient.put(`/api/notifications/${notificationId}/read`),
  
  markAllAsRead: () => apiClient.put('/api/notifications/read-all'),
  
  deleteNotification: (notificationId: string) =>
    apiClient.delete(`/api/notifications/${notificationId}`),
  
  getUnreadCount: () => apiClient.get('/api/notifications/unread-count'),
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

export default apiClient;
