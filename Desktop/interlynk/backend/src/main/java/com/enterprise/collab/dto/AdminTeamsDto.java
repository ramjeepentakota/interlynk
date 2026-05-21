package com.enterprise.collab.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for Module 2 — Teams &amp; Channels Management + Policies.
 */
public class AdminTeamsDto {

    /* ── Teams ───────────────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AdminTeamResponse {
        private Long id;
        private String name;
        private String description;
        private String visibility;     // PUBLIC | PRIVATE | ORG_WIDE
        private String templateName;
        private boolean archived;
        private LocalDateTime archivedAt;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private String createdByUsername;
        private Long messagingPolicyId;
        private String messagingPolicyName;
        private int memberCount;
        private int ownerCount;
        private int channelCount;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PagedTeams {
        private List<AdminTeamResponse> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateTeamRequest {
        @NotBlank @Size(min = 2, max = 100) private String name;
        @Size(max = 500) private String description;
        private String visibility;            // PUBLIC | PRIVATE | ORG_WIDE
        @Size(max = 60) private String templateName;
        private Long messagingPolicyId;
        private List<String> ownerUsernames;  // initial owners
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdateTeamRequest {
        @Size(max = 100) private String name;
        @Size(max = 500) private String description;
        private String visibility;
        @Size(max = 60) private String templateName;
        private Long messagingPolicyId; // -1 → detach, null → unchanged
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class TeamMemberResponse {
        private Long userId;
        private String username;
        private String displayName;
        private String email;
        private String roleInTeam;
        private LocalDateTime joinedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AddMemberRequest {
        @NotBlank private String username;
        /** OWNER | LEAD | MEMBER | GUEST */
        private String role;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ChangeRoleRequest {
        @NotBlank private String role;
    }

    /* ── Channels ────────────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AdminChannelResponse {
        private Long id;
        private String name;
        private String description;
        private String type;          // TEXT | VOICE | PUBLIC | PRIVATE | DIRECT
        private String visibility;    // STANDARD | PRIVATE | SHARED
        private boolean archived;
        private boolean active;
        private boolean locked;
        private String category;
        private Integer maxParticipants;
        private Long teamId;
        private String teamName;
        private int memberCount;
        private LocalDateTime createdAt;
        private LocalDateTime archivedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PagedChannels {
        private List<AdminChannelResponse> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateChannelRequest {
        @NotBlank @Size(max = 100) private String name;
        @Size(max = 500) private String description;
        private String type;          // TEXT | VOICE | PUBLIC | PRIVATE
        private String visibility;    // STANDARD | PRIVATE | SHARED
        private Long teamId;
        private String category;
        private Integer maxParticipants;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdateChannelRequest {
        @Size(max = 100) private String name;
        @Size(max = 500) private String description;
        private String visibility;
        private Boolean locked;
        private Boolean active;
        private String category;
        private Integer maxParticipants;
    }

    /* ── Messaging Policies ──────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MessagingPolicyResponse {
        private Long id;
        private String name;
        private String description;
        private boolean defaultPolicy;
        private boolean allowOwnerDelete;
        private boolean allowUserDelete;
        private boolean allowUserEdit;
        private boolean allowGifs;
        private boolean allowStickers;
        private boolean allowMemes;
        private boolean readReceiptsEnabled;
        private boolean allowExternalChat;
        private boolean allowFileAttachments;
        private boolean allowUrlPreviews;
        private int maxAttachmentMb;
        private int retentionDays;
        private boolean chatSupervision;
        private int teamsUsingThisPolicy;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreatePolicyRequest {
        @NotBlank @Size(max = 80) private String name;
        @Size(max = 500) private String description;
        private Boolean defaultPolicy;
        private Boolean allowOwnerDelete;
        private Boolean allowUserDelete;
        private Boolean allowUserEdit;
        private Boolean allowGifs;
        private Boolean allowStickers;
        private Boolean allowMemes;
        private Boolean readReceiptsEnabled;
        private Boolean allowExternalChat;
        private Boolean allowFileAttachments;
        private Boolean allowUrlPreviews;
        private Integer maxAttachmentMb;
        private Integer retentionDays;
        private Boolean chatSupervision;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SimpleResponse {
        private boolean success;
        private String message;
    }
}
