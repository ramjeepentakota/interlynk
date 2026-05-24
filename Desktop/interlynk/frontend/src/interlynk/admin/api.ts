/* InterLynk Admin Console — backend API layer (Module 1).
   Thin typed wrappers over the shared axios client. No mock data. */
import apiClient from '@/api/client';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BLOCKED';
  presence: string;
  jobTitle?: string;
  department?: string;
  phoneNumber?: string;
  guest: boolean;
  roles: string[];
  suspendedReason?: string;
  suspendedAt?: string;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PagedUsers {
  content: AdminUser[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface Paged<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface LoginHistoryEntry {
  id: number;
  username: string;
  success: boolean;
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
  loginAt: string;
}

export interface ActivityEntry {
  id: number;
  action: string;
  entityType: string;
  entityId?: number;
  details?: string;
  timestamp: string;
}

export interface ServiceHealth {
  name: string;
  status: 'UP' | 'DEGRADED' | 'DOWN';
  detail: string;
  latencyMs?: number;
}

export interface Alert {
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
}

export interface TimeBucket {
  label: string;
  value: number;
}

export interface RecentActivity {
  action: string;
  entityType: string;
  username: string;
  details: string;
  timestamp: string;
}

export interface DashboardSummary {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  blockedUsers: number;
  guestUsers: number;
  onlineNow: number;
  newUsersLast7Days: number;
  totalTeams: number;
  totalChannels: number;
  totalMessages: number;
  messagesLast24h: number;
  activeCalls: number;
  loginsLast24h: number;
  failedLoginsLast24h: number;
  serviceHealth: ServiceHealth[];
  alerts: Alert[];
  loginTrend7d: TimeBucket[];
  recentActivity: RecentActivity[];
}

export interface UsageAnalytics {
  messagesPerDay: TimeBucket[];
  loginsPerDay: TimeBucket[];
  usersByDepartment: { department: string; count: number }[];
  usersByStatus: { status: string; count: number }[];
}

export interface ResetPasswordResult {
  success: boolean;
  temporaryPassword?: string;
  message: string;
}

export interface BulkImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: string[];
  generatedCredentials: string[];
}

const BASE = '/api/admin';

/* ── Dashboard ───────────────────────────────────────────── */
export const getDashboard = () =>
  apiClient.get<DashboardSummary>(`${BASE}/dashboard`).then((r) => r.data);

export const getHealth = () =>
  apiClient.get<ServiceHealth[]>(`${BASE}/dashboard/health`).then((r) => r.data);

export const getAnalytics = (days = 14) =>
  apiClient.get<UsageAnalytics>(`${BASE}/dashboard/analytics?days=${days}`).then((r) => r.data);

/* ── Users ───────────────────────────────────────────────── */
export interface UserQuery {
  q?: string;
  status?: string;
  guest?: boolean;
  department?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: string;
}

export const searchUsers = (query: UserQuery) => {
  const p = new URLSearchParams();
  if (query.q) p.set('q', query.q);
  if (query.status) p.set('status', query.status);
  if (query.guest != null) p.set('guest', String(query.guest));
  if (query.department) p.set('department', query.department);
  p.set('page', String(query.page ?? 0));
  p.set('size', String(query.size ?? 25));
  p.set('sortBy', query.sortBy ?? 'createdAt');
  p.set('sortDir', query.sortDir ?? 'desc');
  return apiClient.get<PagedUsers>(`${BASE}/users/search?${p}`).then((r) => r.data);
};

export const getDepartments = () =>
  apiClient.get<string[]>(`${BASE}/users/departments`).then((r) => r.data);

export const getUserDetail = (id: number) =>
  apiClient.get<AdminUser>(`${BASE}/users/${id}/detail`).then((r) => r.data);

export const createUser = (data: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}) => apiClient.post(`${BASE}/users`, data).then((r) => r.data);

export const updateUser = (
  id: number,
  data: Partial<{
    displayName: string;
    jobTitle: string;
    department: string;
    phoneNumber: string;
    status: string;
    roles: string[];
  }>
) => apiClient.put<AdminUser>(`${BASE}/users/${id}/profile`, data).then((r) => r.data);

export const suspendUser = (id: number, reason: string) =>
  apiClient.post<AdminUser>(`${BASE}/users/${id}/suspend`, { reason }).then((r) => r.data);

export const unsuspendUser = (id: number) =>
  apiClient.post<AdminUser>(`${BASE}/users/${id}/unsuspend`).then((r) => r.data);

export const blockUser = (id: number, blocked: boolean) =>
  apiClient.post<AdminUser>(`${BASE}/users/${id}/block`, { blocked }).then((r) => r.data);

export const resetPassword = (id: number, newPassword?: string) =>
  apiClient
    .post<ResetPasswordResult>(`${BASE}/users/${id}/reset-password`, { newPassword })
    .then((r) => r.data);

export const deleteUser = (id: number) =>
  apiClient.delete(`${BASE}/users/${id}/purge`).then((r) => r.data);

export const inviteGuest = (data: { email: string; displayName?: string }) =>
  apiClient.post<ResetPasswordResult>(`${BASE}/users/invite-guest`, data).then((r) => r.data);

export const importUsersCsv = (csv: string) =>
  apiClient
    .post<BulkImportResult>(`${BASE}/users/import`, csv, {
      headers: { 'Content-Type': 'text/plain' },
    })
    .then((r) => r.data);

export const exportUsersCsv = () =>
  apiClient.get(`${BASE}/users/export`, { responseType: 'blob' }).then((r) => r.data as Blob);

export const getUserLoginHistory = (id: number, page = 0, size = 25) =>
  apiClient
    .get<Paged<LoginHistoryEntry>>(`${BASE}/users/${id}/login-history?page=${page}&size=${size}`)
    .then((r) => r.data);

export const getAllLoginHistory = (page = 0, size = 50) =>
  apiClient
    .get<Paged<LoginHistoryEntry>>(`${BASE}/users/login-history?page=${page}&size=${size}`)
    .then((r) => r.data);

export const getUserActivity = (id: number, page = 0, size = 25) =>
  apiClient
    .get<Paged<ActivityEntry>>(`${BASE}/users/${id}/activity?page=${page}&size=${size}`)
    .then((r) => r.data);

/* ───────────────────────────────────────────────────────── */
/*  Module 2 — Teams · Channels · Messaging Policies         */
/* ───────────────────────────────────────────────────────── */

export interface AdminTeam {
  id: number;
  name: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'ORG_WIDE';
  templateName?: string;
  archived: boolean;
  archivedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByUsername?: string;
  messagingPolicyId?: number;
  messagingPolicyName?: string;
  memberCount: number;
  ownerCount: number;
  channelCount: number;
}
export interface PagedTeams {
  content: AdminTeam[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
export interface TeamMemberRow {
  userId: number;
  username: string;
  displayName: string;
  email: string;
  roleInTeam: 'OWNER' | 'LEAD' | 'MEMBER' | 'GUEST';
  joinedAt?: string;
}
export interface AdminChannel {
  id: number;
  name: string;
  description?: string;
  type: string;
  visibility: 'STANDARD' | 'PRIVATE' | 'SHARED';
  archived: boolean;
  active: boolean;
  locked: boolean;
  category?: string;
  maxParticipants?: number;
  teamId?: number;
  teamName?: string;
  memberCount: number;
  createdAt?: string;
  archivedAt?: string;
}
export interface PagedChannels {
  content: AdminChannel[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
export interface MessagingPolicy {
  id: number;
  name: string;
  description?: string;
  defaultPolicy: boolean;
  allowOwnerDelete: boolean;
  allowUserDelete: boolean;
  allowUserEdit: boolean;
  allowGifs: boolean;
  allowStickers: boolean;
  allowMemes: boolean;
  readReceiptsEnabled: boolean;
  allowExternalChat: boolean;
  allowFileAttachments: boolean;
  allowUrlPreviews: boolean;
  maxAttachmentMb: number;
  retentionDays: number;
  chatSupervision: boolean;
  teamsUsingThisPolicy: number;
  createdAt?: string;
  updatedAt?: string;
}

/* Teams */
export const listTeams = (params: { q?: string; archived?: boolean; visibility?: string; page?: number; size?: number } = {}) => {
  const p = new URLSearchParams();
  if (params.q) p.set('q', params.q);
  if (params.archived != null) p.set('archived', String(params.archived));
  if (params.visibility) p.set('visibility', params.visibility);
  p.set('page', String(params.page ?? 0));
  p.set('size', String(params.size ?? 25));
  return apiClient.get<PagedTeams>(`${BASE}/teams?${p}`).then((r) => r.data);
};
export const getTeam = (id: number) =>
  apiClient.get<AdminTeam>(`${BASE}/teams/${id}`).then((r) => r.data);
export const createTeam = (data: { name: string; description?: string; visibility?: string; templateName?: string; messagingPolicyId?: number; ownerUsernames?: string[] }) =>
  apiClient.post<AdminTeam>(`${BASE}/teams`, data).then((r) => r.data);
export const updateTeam = (id: number, data: Partial<{ name: string; description: string; visibility: string; templateName: string; messagingPolicyId: number }>) =>
  apiClient.put<AdminTeam>(`${BASE}/teams/${id}`, data).then((r) => r.data);
export const archiveTeam = (id: number) =>
  apiClient.post<AdminTeam>(`${BASE}/teams/${id}/archive`).then((r) => r.data);
export const restoreTeam = (id: number) =>
  apiClient.post<AdminTeam>(`${BASE}/teams/${id}/restore`).then((r) => r.data);
export const deleteTeam = (id: number) =>
  apiClient.delete(`${BASE}/teams/${id}`).then((r) => r.data);
export const getTeamMembers = (id: number) =>
  apiClient.get<TeamMemberRow[]>(`${BASE}/teams/${id}/members`).then((r) => r.data);
export const addTeamMember = (id: number, username: string, role: string) =>
  apiClient.post<TeamMemberRow>(`${BASE}/teams/${id}/members`, { username, role }).then((r) => r.data);
export const changeTeamRole = (id: number, userId: number, role: string) =>
  apiClient.put<TeamMemberRow>(`${BASE}/teams/${id}/members/${userId}/role`, { role }).then((r) => r.data);
export const removeTeamMember = (id: number, userId: number) =>
  apiClient.delete(`${BASE}/teams/${id}/members/${userId}`).then((r) => r.data);

/* Channels (mgmt) */
export const listAdminChannels = (params: { q?: string; teamId?: number; type?: string; visibility?: string; archived?: boolean; page?: number; size?: number } = {}) => {
  const p = new URLSearchParams();
  if (params.q) p.set('q', params.q);
  if (params.teamId) p.set('teamId', String(params.teamId));
  if (params.type) p.set('type', params.type);
  if (params.visibility) p.set('visibility', params.visibility);
  if (params.archived != null) p.set('archived', String(params.archived));
  p.set('page', String(params.page ?? 0));
  p.set('size', String(params.size ?? 25));
  return apiClient.get<PagedChannels>(`${BASE}/channel-mgmt?${p}`).then((r) => r.data);
};
export const createAdminChannel = (data: { name: string; description?: string; type?: string; visibility?: string; teamId?: number; category?: string; maxParticipants?: number }) =>
  apiClient.post<AdminChannel>(`${BASE}/channel-mgmt`, data).then((r) => r.data);
export const updateAdminChannel = (id: number, data: Partial<{ name: string; description: string; visibility: string; locked: boolean; active: boolean; category: string; maxParticipants: number }>) =>
  apiClient.put<AdminChannel>(`${BASE}/channel-mgmt/${id}`, data).then((r) => r.data);
export const archiveChannel = (id: number) =>
  apiClient.post<AdminChannel>(`${BASE}/channel-mgmt/${id}/archive`).then((r) => r.data);
export const restoreChannel = (id: number) =>
  apiClient.post<AdminChannel>(`${BASE}/channel-mgmt/${id}/restore`).then((r) => r.data);
export const deleteAdminChannel = (id: number) =>
  apiClient.delete(`${BASE}/channel-mgmt/${id}`).then((r) => r.data);

/* Channel membership / access control (grant who can join a channel) */
export interface AdminChannelMember {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  presence?: string;
}
export const getAdminChannelDetail = (id: number) =>
  apiClient
    .get<{ id: number; name: string; type: string; members?: AdminChannelMember[]; memberCount?: number }>(`${BASE}/channels/${id}`)
    .then((r) => r.data);
export const addAdminChannelMember = (channelId: number, userId: number) =>
  apiClient.post(`${BASE}/channels/${channelId}/members/${userId}`).then((r) => r.data);
export const removeAdminChannelMember = (channelId: number, userId: number) =>
  apiClient.delete(`${BASE}/channels/${channelId}/members/${userId}`).then((r) => r.data);

/* Messaging policies */
export const listPolicies = () =>
  apiClient.get<MessagingPolicy[]>(`${BASE}/policies/messaging`).then((r) => r.data);
export const createPolicy = (data: Partial<MessagingPolicy> & { name: string }) =>
  apiClient.post<MessagingPolicy>(`${BASE}/policies/messaging`, data).then((r) => r.data);
export const updatePolicy = (id: number, data: Partial<MessagingPolicy>) =>
  apiClient.put<MessagingPolicy>(`${BASE}/policies/messaging/${id}`, data).then((r) => r.data);
export const deletePolicy = (id: number) =>
  apiClient.delete(`${BASE}/policies/messaging/${id}`).then((r) => r.data);

/* ───────────────────────────────────────────────────────── */
/*  Module 3 — Meetings & Calling                            */
/* ───────────────────────────────────────────────────────── */

export interface MeetingPolicy {
  id: number;
  name: string;
  description?: string;
  defaultPolicy: boolean;
  allowRecording: boolean;
  autoRecord: boolean;
  allowTranscription: boolean;
  allowAiRecap: boolean;
  lobbyMode: 'EVERYONE' | 'ORG_ONLY' | 'INVITED_ONLY';
  allowAnonymousJoin: boolean;
  allowScreenShare: boolean;
  allowWhiteboard: boolean;
  allowBreakoutRooms: boolean;
  allowMeetingChat: boolean;
  allowReactions: boolean;
  allowPolls: boolean;
  attendanceReports: boolean;
  allowWebinars: boolean;
  allowLiveEvents: boolean;
  maxAttendees: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PhoneNumber {
  id: number;
  e164: string;
  label?: string;
  assignmentType: 'USER' | 'CALL_QUEUE' | 'AUTO_ATTENDANT' | 'EMERGENCY' | 'UNASSIGNED';
  assignedToId?: number;
  assignedToLabel?: string;
  callerIdName?: string;
  carrier: 'PSTN' | 'SIP' | 'INTERNAL';
  emergencyAddress?: string;
  countryCode?: string;
  createdAt?: string;
}

export interface PagedPhoneNumbers {
  content: PhoneNumber[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface CallQueueAgent {
  userId: number;
  username: string;
  displayName: string;
}

export interface CallQueue {
  id: number;
  name: string;
  description?: string;
  routingMethod: 'ATTENDANT' | 'SERIAL' | 'ROUND_ROBIN' | 'LONGEST_IDLE';
  greetingLanguage: string;
  maxWaitSeconds: number;
  maxSize: number;
  overflowAction: 'OVERFLOW_VOICEMAIL' | 'OVERFLOW_DISCONNECT' | 'OVERFLOW_REDIRECT';
  overflowTarget?: string;
  active: boolean;
  agentCount: number;
  agents: CallQueueAgent[];
  createdAt?: string;
}

export interface AutoAttendant {
  id: number;
  name: string;
  description?: string;
  language: string;
  timeZone: string;
  greetingText?: string;
  greetingAudioUrl?: string;
  menuJson?: string;
  businessHoursJson?: string;
  active: boolean;
  createdAt?: string;
}

export interface VoicemailSettings {
  id: number;
  userId: number;
  username: string;
  enabled: boolean;
  greetingText?: string;
  transcriptionEnabled: boolean;
  emailNotification: boolean;
  maxDurationSeconds: number;
  autoDeleteDays: number;
}

/* Meeting policies */
export const listMeetingPolicies = () =>
  apiClient.get<MeetingPolicy[]>(`${BASE}/policies/meetings`).then((r) => r.data);
export const createMeetingPolicy = (data: Partial<MeetingPolicy> & { name: string }) =>
  apiClient.post<MeetingPolicy>(`${BASE}/policies/meetings`, data).then((r) => r.data);
export const updateMeetingPolicy = (id: number, data: Partial<MeetingPolicy>) =>
  apiClient.put<MeetingPolicy>(`${BASE}/policies/meetings/${id}`, data).then((r) => r.data);
export const deleteMeetingPolicy = (id: number) =>
  apiClient.delete(`${BASE}/policies/meetings/${id}`).then((r) => r.data);

/* Phone numbers */
export const listPhoneNumbers = (params: { q?: string; assignmentType?: string; page?: number; size?: number } = {}) => {
  const p = new URLSearchParams();
  if (params.q) p.set('q', params.q);
  if (params.assignmentType) p.set('assignmentType', params.assignmentType);
  p.set('page', String(params.page ?? 0));
  p.set('size', String(params.size ?? 25));
  return apiClient.get<PagedPhoneNumbers>(`${BASE}/calling/numbers?${p}`).then((r) => r.data);
};
export const createPhoneNumber = (data: { e164: string; label?: string; callerIdName?: string; carrier?: string; countryCode?: string; emergencyAddress?: string }) =>
  apiClient.post<PhoneNumber>(`${BASE}/calling/numbers`, data).then((r) => r.data);
export const assignPhoneNumber = (id: number, data: { assignmentType: string; assignedToId?: number }) =>
  apiClient.post<PhoneNumber>(`${BASE}/calling/numbers/${id}/assign`, data).then((r) => r.data);
export const deletePhoneNumber = (id: number) =>
  apiClient.delete(`${BASE}/calling/numbers/${id}`).then((r) => r.data);

/* Call queues */
export const listCallQueues = () =>
  apiClient.get<CallQueue[]>(`${BASE}/calling/queues`).then((r) => r.data);
export const createCallQueue = (data: Partial<CallQueue> & { name: string; agentIds?: number[] }) =>
  apiClient.post<CallQueue>(`${BASE}/calling/queues`, data).then((r) => r.data);
export const updateCallQueue = (id: number, data: Partial<CallQueue> & { agentIds?: number[] }) =>
  apiClient.put<CallQueue>(`${BASE}/calling/queues/${id}`, data).then((r) => r.data);
export const deleteCallQueue = (id: number) =>
  apiClient.delete(`${BASE}/calling/queues/${id}`).then((r) => r.data);

/* Auto attendants */
export const listAutoAttendants = () =>
  apiClient.get<AutoAttendant[]>(`${BASE}/calling/attendants`).then((r) => r.data);
export const createAutoAttendant = (data: Partial<AutoAttendant> & { name: string }) =>
  apiClient.post<AutoAttendant>(`${BASE}/calling/attendants`, data).then((r) => r.data);
export const updateAutoAttendant = (id: number, data: Partial<AutoAttendant>) =>
  apiClient.put<AutoAttendant>(`${BASE}/calling/attendants/${id}`, data).then((r) => r.data);
export const deleteAutoAttendant = (id: number) =>
  apiClient.delete(`${BASE}/calling/attendants/${id}`).then((r) => r.data);

/* Voicemail */
export const getVoicemail = (userId: number) =>
  apiClient.get<VoicemailSettings>(`${BASE}/calling/voicemail/${userId}`).then((r) => r.data);
export const updateVoicemail = (userId: number, data: Partial<VoicemailSettings>) =>
  apiClient.put<VoicemailSettings>(`${BASE}/calling/voicemail/${userId}`, data).then((r) => r.data);

/* ───────────────────────────────────────────────────────── */
/*  Module 4 — Security, RBAC, Audit, eDiscovery, Compliance */
/* ───────────────────────────────────────────────────────── */

export interface MfaStatus {
  userId: number;
  username: string;
  enabled: boolean;
  required: boolean;
  /** True when a secret has been generated but the user has not yet confirmed a code. */
  pendingConfirmation: boolean;
  backupCodesRemaining: number;
  enrolledAt?: string;
}
export interface MfaEnrollResult {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}
export interface PermissionCatalogEntry {
  key: string;
  category: string;
  description: string;
}
export interface AdminRole {
  id: number;
  name: string;
  description?: string;
  permissions: string[];
  systemRole: boolean;
  createdAt?: string;
  updatedAt?: string;
}
export interface ConditionalAccess {
  id: number;
  name: string;
  description?: string;
  state: 'ENFORCED' | 'REPORT_ONLY' | 'DISABLED';
  rulesJson?: string;
  trustedIpRanges?: string;
  blockAction: boolean;
  requireMfa: boolean;
  blockLegacyAuth: boolean;
  sessionMinutes: number;
  createdAt?: string;
  updatedAt?: string;
}
export interface Dlp {
  id: number;
  name: string;
  description?: string;
  action: 'AUDIT' | 'WARN' | 'BLOCK' | 'TOMBSTONE';
  detectors?: string;
  scope: 'CHATS' | 'FILES' | 'BOTH';
  appliesToExternal: boolean;
  appliesToInternal: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}
export interface Label {
  id: number;
  name: string;
  description?: string;
  color?: string;
  priority: number;
  requiresEncryption: boolean;
  watermarkText?: string;
}
export interface Barrier {
  id: number;
  name: string;
  description?: string;
  segmentType: 'DEPARTMENT' | 'ROLE';
  segmentA: string;
  segmentB: string;
  action: 'BLOCK' | 'WARN';
  active: boolean;
}
export interface Retention {
  id: number;
  name: string;
  description?: string;
  appliesTo: 'MESSAGES' | 'FILES' | 'BOTH';
  scope: string;
  retainDays: number;
  afterAction: 'DELETE' | 'ARCHIVE' | 'LEGAL_HOLD';
  active: boolean;
}
export interface AuditEntry {
  id: number;
  userId?: number;
  username?: string;
  action: string;
  entityType?: string;
  entityId?: number;
  details?: string;
  ipAddress?: string;
  timestamp: string;
}
export interface PagedAudit {
  content: AuditEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
export interface EDiscoveryResult {
  messageId: number;
  senderId?: number;
  senderUsername?: string;
  channelId?: number;
  channelName?: string;
  content: string;
  createdAt: string;
}
export interface PagedEDiscovery {
  content: EDiscoveryResult[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/* MFA */
export const getMfaStatus = (userId: number) =>
  apiClient.get<MfaStatus>(`${BASE}/security/users/${userId}/mfa`).then((r) => r.data);
export const setMfa = (userId: number, data: { enabled?: boolean; required?: boolean }) =>
  apiClient.put<MfaStatus>(`${BASE}/security/users/${userId}/mfa`, data).then((r) => r.data);
export const enrollMfa = (userId: number) =>
  apiClient.post<MfaEnrollResult>(`${BASE}/security/users/${userId}/mfa/enroll`).then((r) => r.data);
export const confirmMfa = (userId: number, code: string) =>
  apiClient.post<MfaStatus>(`${BASE}/security/users/${userId}/mfa/confirm`, { code }).then((r) => r.data);

/**
 * Fetch the QR-code PNG as a {@link Blob} via the authenticated axios client
 * (so the JWT Authorization header is included) and return an object-URL
 * suitable for binding to {@code <img src>}. Callers must call
 * {@link URL.revokeObjectURL} on the returned string when the modal closes.
 */
export const fetchMfaQrObjectUrl = async (userId: number): Promise<string> => {
  const res = await apiClient.get(`${BASE}/security/users/${userId}/mfa/qr.png`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(res.data as Blob);
};

/* RBAC */
export const listPermissionCatalog = () =>
  apiClient.get<PermissionCatalogEntry[]>(`${BASE}/security/permissions`).then((r) => r.data);
export const listAdminRoles = () =>
  apiClient.get<AdminRole[]>(`${BASE}/security/roles`).then((r) => r.data);
export const createAdminRole = (data: { name: string; description?: string; permissions?: string[] }) =>
  apiClient.post<AdminRole>(`${BASE}/security/roles`, data).then((r) => r.data);
export const updateAdminRole = (id: number, data: { description?: string; permissions?: string[] }) =>
  apiClient.put<AdminRole>(`${BASE}/security/roles/${id}`, data).then((r) => r.data);
export const deleteAdminRole = (id: number) =>
  apiClient.delete(`${BASE}/security/roles/${id}`).then((r) => r.data);

/* Compliance — CA / DLP / Labels / Barriers / Retention */
export const listCa = () => apiClient.get<ConditionalAccess[]>(`${BASE}/compliance/conditional-access`).then((r) => r.data);
export const createCa = (data: Partial<ConditionalAccess> & { name: string }) => apiClient.post<ConditionalAccess>(`${BASE}/compliance/conditional-access`, data).then((r) => r.data);
export const updateCa = (id: number, data: Partial<ConditionalAccess>) => apiClient.put<ConditionalAccess>(`${BASE}/compliance/conditional-access/${id}`, data).then((r) => r.data);
export const deleteCa = (id: number) => apiClient.delete(`${BASE}/compliance/conditional-access/${id}`).then((r) => r.data);

export const listDlp = () => apiClient.get<Dlp[]>(`${BASE}/compliance/dlp`).then((r) => r.data);
export const createDlp = (data: Partial<Dlp> & { name: string }) => apiClient.post<Dlp>(`${BASE}/compliance/dlp`, data).then((r) => r.data);
export const updateDlp = (id: number, data: Partial<Dlp>) => apiClient.put<Dlp>(`${BASE}/compliance/dlp/${id}`, data).then((r) => r.data);
export const deleteDlp = (id: number) => apiClient.delete(`${BASE}/compliance/dlp/${id}`).then((r) => r.data);

export const listLabels = () => apiClient.get<Label[]>(`${BASE}/compliance/labels`).then((r) => r.data);
export const createLabel = (data: Partial<Label> & { name: string }) => apiClient.post<Label>(`${BASE}/compliance/labels`, data).then((r) => r.data);
export const updateLabel = (id: number, data: Partial<Label>) => apiClient.put<Label>(`${BASE}/compliance/labels/${id}`, data).then((r) => r.data);
export const deleteLabel = (id: number) => apiClient.delete(`${BASE}/compliance/labels/${id}`).then((r) => r.data);

export const listBarriers = () => apiClient.get<Barrier[]>(`${BASE}/compliance/barriers`).then((r) => r.data);
export const createBarrier = (data: Partial<Barrier> & { name: string; segmentA: string; segmentB: string }) => apiClient.post<Barrier>(`${BASE}/compliance/barriers`, data).then((r) => r.data);
export const updateBarrier = (id: number, data: Partial<Barrier>) => apiClient.put<Barrier>(`${BASE}/compliance/barriers/${id}`, data).then((r) => r.data);
export const deleteBarrier = (id: number) => apiClient.delete(`${BASE}/compliance/barriers/${id}`).then((r) => r.data);

export const listRetention = () => apiClient.get<Retention[]>(`${BASE}/compliance/retention`).then((r) => r.data);
export const createRetention = (data: Partial<Retention> & { name: string }) => apiClient.post<Retention>(`${BASE}/compliance/retention`, data).then((r) => r.data);
export const updateRetention = (id: number, data: Partial<Retention>) => apiClient.put<Retention>(`${BASE}/compliance/retention/${id}`, data).then((r) => r.data);
export const deleteRetention = (id: number) => apiClient.delete(`${BASE}/compliance/retention/${id}`).then((r) => r.data);

/* Audit + eDiscovery */
export const searchAudit = (params: { userId?: number; action?: string; entityType?: string; from?: string; to?: string; page?: number; size?: number }) => {
  const p = new URLSearchParams();
  if (params.userId) p.set('userId', String(params.userId));
  if (params.action) p.set('action', params.action);
  if (params.entityType) p.set('entityType', params.entityType);
  if (params.from) p.set('from', params.from);
  if (params.to) p.set('to', params.to);
  p.set('page', String(params.page ?? 0));
  p.set('size', String(params.size ?? 50));
  return apiClient.get<PagedAudit>(`${BASE}/audit?${p}`).then((r) => r.data);
};
export const exportAuditCsv = (params: { userId?: number; action?: string; entityType?: string; from?: string; to?: string } = {}) => {
  const p = new URLSearchParams();
  if (params.userId) p.set('userId', String(params.userId));
  if (params.action) p.set('action', params.action);
  if (params.entityType) p.set('entityType', params.entityType);
  if (params.from) p.set('from', params.from);
  if (params.to) p.set('to', params.to);
  return apiClient.get(`${BASE}/audit/export?${p}`, { responseType: 'blob' }).then((r) => r.data as Blob);
};
export const eDiscovery = (params: { senderId?: number; channelId?: number; keyword?: string; from?: string; to?: string; page?: number; size?: number }) => {
  const p = new URLSearchParams();
  if (params.senderId) p.set('senderId', String(params.senderId));
  if (params.channelId) p.set('channelId', String(params.channelId));
  if (params.keyword) p.set('keyword', params.keyword);
  if (params.from) p.set('from', params.from);
  if (params.to) p.set('to', params.to);
  p.set('page', String(params.page ?? 0));
  p.set('size', String(params.size ?? 50));
  return apiClient.get<PagedEDiscovery>(`${BASE}/audit/ediscovery?${p}`).then((r) => r.data);
};
