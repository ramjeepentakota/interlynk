package com.enterprise.collab.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/** DTOs for Module 4 — Security &amp; Compliance, RBAC, Audit / eDiscovery. */
public class AdminSecurityDto {

    /* ── MFA ─────────────────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MfaStatusResponse {
        private Long userId;
        private String username;
        /** True once the user has confirmed the first TOTP code and enrollment is active. */
        private boolean enabled;
        /** True if the admin has flagged MFA as mandatory for this user. */
        private boolean required;
        /** True when a TOTP secret exists but the user has not yet verified a code. */
        private boolean pendingConfirmation;
        /** Number of unused (and still-valid) backup recovery codes for this user. */
        private int backupCodesRemaining;
        private LocalDateTime enrolledAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MfaEnrollResponse {
        private String secret;       // base32 TOTP secret (return only at enrollment)
        private String otpauthUrl;   // e.g. otpauth://totp/Narada:alice?secret=...&issuer=Narada
        /** Plain-text backup codes — shown ONCE; only bcrypt hashes are persisted. */
        private List<String> backupCodes;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MfaConfirmRequest {
        /** 6-digit TOTP code from the user's authenticator app. */
        @NotBlank @Size(min = 6, max = 8)
        private String code;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MfaSetRequest {
        /**
         * Toggling {@code enabled} only disables an existing enrollment; the
         * user cannot be enabled via this endpoint — they must complete the
         * enroll → confirm flow first.
         */
        private Boolean enabled;
        private Boolean required;
    }

    /* ── Roles &amp; permissions (RBAC) ─────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PermissionCatalogEntry {
        private String key;
        private String category;
        private String description;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class RoleResponse {
        private Long id;
        private String name;
        private String description;
        private List<String> permissions;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private boolean systemRole;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateRoleRequest {
        @NotBlank @Size(max = 50) private String name;
        @Size(max = 255) private String description;
        private List<String> permissions;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdateRoleRequest {
        @Size(max = 255) private String description;
        private List<String> permissions;
    }

    /* ── Conditional access ──────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ConditionalAccessResponse {
        private Long id;
        private String name;
        private String description;
        private String state;
        private String rulesJson;
        private String trustedIpRanges;
        private boolean blockAction;
        private boolean requireMfa;
        private boolean blockLegacyAuth;
        private int sessionMinutes;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateConditionalAccessRequest {
        @NotBlank @Size(max = 100) private String name;
        @Size(max = 500) private String description;
        private String state;
        private String rulesJson;
        private String trustedIpRanges;
        private Boolean blockAction;
        private Boolean requireMfa;
        private Boolean blockLegacyAuth;
        private Integer sessionMinutes;
    }

    /* ── DLP ─────────────────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DlpPolicyResponse {
        private Long id;
        private String name;
        private String description;
        private String action;
        private String detectors;
        private String scope;
        private boolean appliesToExternal;
        private boolean appliesToInternal;
        private boolean active;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateDlpRequest {
        @NotBlank @Size(max = 100) private String name;
        @Size(max = 500) private String description;
        private String action;
        @Size(max = 2000) private String detectors;
        private String scope;
        private Boolean appliesToExternal;
        private Boolean appliesToInternal;
        private Boolean active;
    }

    /* ── Sensitivity labels ──────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SensitivityLabelResponse {
        private Long id;
        private String name;
        private String description;
        private String color;
        private int priority;
        private boolean requiresEncryption;
        private String watermarkText;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateLabelRequest {
        @NotBlank @Size(max = 80) private String name;
        @Size(max = 500) private String description;
        @Size(max = 9)   private String color;
        private Integer priority;
        private Boolean requiresEncryption;
        @Size(max = 200) private String watermarkText;
    }

    /* ── Information barriers ────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class InformationBarrierResponse {
        private Long id;
        private String name;
        private String description;
        private String segmentType;
        private String segmentA;
        private String segmentB;
        private String action;
        private boolean active;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateBarrierRequest {
        @NotBlank @Size(max = 120) private String name;
        @Size(max = 500) private String description;
        private String segmentType;
        @NotBlank @Size(max = 120) private String segmentA;
        @NotBlank @Size(max = 120) private String segmentB;
        private String action;
        private Boolean active;
    }

    /* ── Retention policies ──────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class RetentionPolicyResponse {
        private Long id;
        private String name;
        private String description;
        private String appliesTo;
        private String scope;
        private int retainDays;
        private String afterAction;
        private boolean active;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateRetentionRequest {
        @NotBlank @Size(max = 100) private String name;
        @Size(max = 500) private String description;
        private String appliesTo;
        private String scope;
        private Integer retainDays;
        private String afterAction;
        private Boolean active;
    }

    /* ── eDiscovery ──────────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class EDiscoveryResult {
        private Long messageId;
        private Long senderId;
        private String senderUsername;
        private Long channelId;
        private String channelName;
        private String content;
        private LocalDateTime createdAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PagedEDiscovery {
        private List<EDiscoveryResult> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean last;
    }

    /* ── Audit (advanced) ────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AuditEntry {
        private Long id;
        private Long userId;
        private String username;
        private String action;
        private String entityType;
        private Long entityId;
        private String details;
        private String ipAddress;
        private LocalDateTime timestamp;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PagedAudit {
        private List<AuditEntry> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean last;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SimpleResponse {
        private boolean success;
        private String message;
    }
}
