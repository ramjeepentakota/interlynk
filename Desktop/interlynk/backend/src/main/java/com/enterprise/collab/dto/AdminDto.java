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
import java.util.Map;

public class AdminDto {
    
    // ============ User Management DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateUserRequest {
        @NotBlank(message = "Username is required")
        @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
        private String username;
        
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        private String email;
        
        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
        private String password;
        
        @Size(max = 100, message = "Display name must not exceed 100 characters")
        private String displayName;
        
        private List<String> roles;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateUserRequest {
        @Size(max = 100, message = "Display name must not exceed 100 characters")
        private String displayName;
        
        @Size(max = 500, message = "Avatar URL must not exceed 500 characters")
        private String avatarUrl;
        
        private String status;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserResponse {
        private Long id;
        private String username;
        private String email;
        private String displayName;
        private String avatarUrl;
        private String status;
        private String presence;
        private List<String> roles;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private LocalDateTime lastSeenAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserListResponse {
        private List<UserResponse> users;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
    }
    
    // ============ Team Management DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateTeamRequest {
        @NotBlank(message = "Team name is required")
        @Size(min = 2, max = 100, message = "Team name must be between 2 and 100 characters")
        private String name;
        
        @Size(max = 500, message = "Description must not exceed 500 characters")
        private String description;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TeamResponse {
        private Long id;
        private String name;
        private String description;
        private String createdByUsername;
        private LocalDateTime createdAt;
        private int memberCount;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TeamListResponse {
        private List<TeamResponse> teams;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AddTeamMemberRequest {
        @NotBlank(message = "Username is required")
        private String username;
        
        @NotBlank(message = "Role is required")
        private String role; // LEAD, MEMBER
    }
    
    // ============ License Management DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GenerateLicenseRequest {
        @NotBlank(message = "Issued to is required")
        private String issuedTo;
        
        private Integer maxUsers;
        
        private LocalDateTime expiresAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LicenseResponse {
        private Long id;
        private String licenseKey;
        private Integer maxUsers;
        private Integer currentUsers;
        private String issuedTo;
        private LocalDateTime createdAt;
        private LocalDateTime expiresAt;
        private boolean isActive;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LicenseListResponse {
        private List<LicenseResponse> licenses;
    }
    
    // ============ System Stats DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SystemStatsResponse {
        private long totalUsers;
        private long activeUsers;
        private long inactiveUsers;
        private long totalTeams;
        private long totalChannels;
        private long totalMessages;
        private long activeCalls;
        private long totalRepositories;
        private long totalStorageUsed;
        private long licenseMaxUsers;
        private long licenseCurrentUsers;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DashboardResponse {
        private SystemStatsResponse stats;
        private List<RecentActivity> recentActivity;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RecentActivity {
        private String action;
        private String entityType;
        private String username;
        private String details;
        private LocalDateTime timestamp;
    }
    
    // ============ Audit Log DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuditLogResponse {
        private Long id;
        private String action;
        private String entityType;
        private Long entityId;
        private String username;
        private String details;
        private String ipAddress;
        private String userAgent;
        private LocalDateTime timestamp;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuditLogListResponse {
        private List<AuditLogResponse> logs;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
    }
    
    // ============ Role Management DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateUserRolesRequest {
        private List<String> roles;
    }
    
    // ============ System Settings DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SystemSettingResponse {
        private String key;
        private String value;
        private String description;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateSystemSettingRequest {
        @NotBlank(message = "Value is required")
        private String value;
    }
    
    // ============ Response DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MessageResponse {
        private String message;
        private boolean success;
    }
}
