package com.enterprise.collab.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/** DTOs for Module 3 — Meetings &amp; Calling. */
public class AdminMeetingsDto {

    /* ── Meeting policies ────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MeetingPolicyResponse {
        private Long id;
        private String name;
        private String description;
        private boolean defaultPolicy;
        private boolean allowRecording;
        private boolean autoRecord;
        private boolean allowTranscription;
        private boolean allowAiRecap;
        private String lobbyMode;
        private boolean allowAnonymousJoin;
        private boolean allowScreenShare;
        private boolean allowWhiteboard;
        private boolean allowBreakoutRooms;
        private boolean allowMeetingChat;
        private boolean allowReactions;
        private boolean allowPolls;
        private boolean attendanceReports;
        private boolean allowWebinars;
        private boolean allowLiveEvents;
        private int maxAttendees;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateMeetingPolicyRequest {
        @NotBlank @Size(max = 80) private String name;
        @Size(max = 500) private String description;
        private Boolean defaultPolicy;
        private Boolean allowRecording;
        private Boolean autoRecord;
        private Boolean allowTranscription;
        private Boolean allowAiRecap;
        private String lobbyMode;
        private Boolean allowAnonymousJoin;
        private Boolean allowScreenShare;
        private Boolean allowWhiteboard;
        private Boolean allowBreakoutRooms;
        private Boolean allowMeetingChat;
        private Boolean allowReactions;
        private Boolean allowPolls;
        private Boolean attendanceReports;
        private Boolean allowWebinars;
        private Boolean allowLiveEvents;
        private Integer maxAttendees;
    }

    /* ── Phone numbers ───────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PhoneNumberResponse {
        private Long id;
        private String e164;
        private String label;
        private String assignmentType;
        private Long assignedToId;
        private String assignedToLabel;
        private String callerIdName;
        private String carrier;
        private String emergencyAddress;
        private String countryCode;
        private LocalDateTime createdAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PagedPhoneNumbers {
        private List<PhoneNumberResponse> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreatePhoneNumberRequest {
        @NotBlank @Size(max = 24) private String e164;
        @Size(max = 80) private String label;
        @Size(max = 80) private String callerIdName;
        private String carrier;          // PSTN | SIP | INTERNAL
        @Size(max = 4)  private String countryCode;
        @Size(max = 255) private String emergencyAddress;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AssignPhoneNumberRequest {
        /** USER | CALL_QUEUE | AUTO_ATTENDANT | EMERGENCY | UNASSIGNED */
        @NotBlank private String assignmentType;
        private Long assignedToId;
    }

    /* ── Call queues ─────────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CallQueueResponse {
        private Long id;
        private String name;
        private String description;
        private String routingMethod;
        private String greetingLanguage;
        private int maxWaitSeconds;
        private int maxSize;
        private String overflowAction;
        private String overflowTarget;
        private boolean active;
        private int agentCount;
        private List<AgentSummary> agents;
        private LocalDateTime createdAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AgentSummary {
        private Long userId;
        private String username;
        private String displayName;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateCallQueueRequest {
        @NotBlank @Size(max = 120) private String name;
        @Size(max = 500) private String description;
        private String routingMethod;
        private String greetingLanguage;
        private Integer maxWaitSeconds;
        private Integer maxSize;
        private String overflowAction;
        private String overflowTarget;
        private List<Long> agentIds;
    }

    /* ── Auto attendants ─────────────────────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AutoAttendantResponse {
        private Long id;
        private String name;
        private String description;
        private String language;
        private String timeZone;
        private String greetingText;
        private String greetingAudioUrl;
        private String menuJson;
        private String businessHoursJson;
        private boolean active;
        private LocalDateTime createdAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateAutoAttendantRequest {
        @NotBlank @Size(max = 120) private String name;
        @Size(max = 500) private String description;
        private String language;
        private String timeZone;
        @Size(max = 1000) private String greetingText;
        private String greetingAudioUrl;
        private String menuJson;
        private String businessHoursJson;
    }

    /* ── Voicemail settings (per user) ───────────────────── */

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class VoicemailResponse {
        private Long id;
        private Long userId;
        private String username;
        private boolean enabled;
        private String greetingText;
        private boolean transcriptionEnabled;
        private boolean emailNotification;
        private int maxDurationSeconds;
        private int autoDeleteDays;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdateVoicemailRequest {
        private Boolean enabled;
        @Size(max = 1000) private String greetingText;
        private Boolean transcriptionEnabled;
        private Boolean emailNotification;
        private Integer maxDurationSeconds;
        private Integer autoDeleteDays;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SimpleResponse {
        private boolean success;
        private String message;
    }
}
