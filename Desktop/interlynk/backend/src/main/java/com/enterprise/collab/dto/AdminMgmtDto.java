package com.enterprise.collab.dto;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for Module 1 — Dashboard &amp; Overview + User Management.
 * Kept separate from the legacy {@code AdminDto} so the new, richer
 * admin surface can evolve without touching existing endpoints.
 */
public class AdminMgmtDto {

    /* ── User Management ─────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AdminUserResponse {
        private Long id;
        private String username;
        private String email;
        private String displayName;
        private String avatarUrl;
        private String status;
        private String presence;
        private String jobTitle;
        private String department;
        private String phoneNumber;
        private boolean guest;
        private List<String> roles;
        private String suspendedReason;
        private LocalDateTime suspendedAt;
        private LocalDateTime lastSeenAt;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PagedUsersResponse {
        private List<AdminUserResponse> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdateUserRequest {
        @Size(max = 100) private String displayName;
        @Size(max = 500) private String avatarUrl;
        @Size(max = 120) private String jobTitle;
        @Size(max = 120) private String department;
        @Size(max = 40)  private String phoneNumber;
        private String status;       // ACTIVE | INACTIVE | SUSPENDED | BLOCKED
        private List<String> roles;  // null → leave unchanged
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SuspendRequest {
        @NotBlank(message = "A reason is required when suspending a user")
        @Size(max = 255)
        private String reason;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ResetPasswordRequest {
        @Size(min = 8, max = 100, message = "Password must be 8–100 characters")
        private String newPassword; // if blank, a random one is generated and returned
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ResetPasswordResponse {
        private boolean success;
        private String temporaryPassword; // populated only when auto-generated
        private String message;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class InviteGuestRequest {
        @NotBlank @Email private String email;
        @Size(max = 100) private String displayName;
        private List<Long> channelIds;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class BulkImportRow {
        private String username;
        private String email;
        private String displayName;
        private String department;
        private String jobTitle;
        private String role;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class BulkImportResult {
        private int total;
        private int created;
        private int skipped;
        private List<String> errors;
        private List<String> generatedCredentials; // "username:tempPassword"
    }

    /* ── Login history & activity ────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class LoginHistoryEntry {
        private Long id;
        private String username;
        private boolean success;
        private String failureReason;
        private String ipAddress;
        private String userAgent;
        private LocalDateTime loginAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ActivityEntry {
        private Long id;
        private String action;
        private String entityType;
        private Long entityId;
        private String details;
        private LocalDateTime timestamp;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PagedResponse<T> {
        private List<T> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean last;
    }

    /* ── Dashboard & Overview ────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DashboardSummary {
        private long totalUsers;
        private long activeUsers;
        private long suspendedUsers;
        private long blockedUsers;
        private long guestUsers;
        private long onlineNow;
        private long newUsersLast7Days;
        private long totalTeams;
        private long totalChannels;
        private long totalMessages;
        private long messagesLast24h;
        private long activeCalls;
        private long loginsLast24h;
        private long failedLoginsLast24h;
        private List<ServiceHealth> serviceHealth;
        private List<Alert> alerts;
        private List<TimeBucket> loginTrend7d;
        private List<RecentActivity> recentActivity;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ServiceHealth {
        private String name;
        private String status;  // UP | DEGRADED | DOWN
        private String detail;
        private Long latencyMs;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Alert {
        private String severity; // INFO | WARNING | CRITICAL
        private String title;
        private String message;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class TimeBucket {
        private String label;   // e.g. "May 13"
        private long value;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class RecentActivity {
        private String action;
        private String entityType;
        private String username;
        private String details;
        private LocalDateTime timestamp;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UsageAnalytics {
        private List<TimeBucket> messagesPerDay;
        private List<TimeBucket> loginsPerDay;
        private List<DepartmentCount> usersByDepartment;
        private List<StatusCount> usersByStatus;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DepartmentCount {
        private String department;
        private long count;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class StatusCount {
        private String status;
        private long count;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SimpleResponse {
        private boolean success;
        private String message;
    }
}
