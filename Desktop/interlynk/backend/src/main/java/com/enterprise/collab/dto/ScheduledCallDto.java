package com.enterprise.collab.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

public class ScheduledCallDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateRequest {
        @NotBlank(message = "Title is required")
        private String title;

        @NotNull(message = "scheduledAt is required")
        private LocalDateTime scheduledAt;

        private Integer durationMinutes;

        /** "voice" or "video"; defaults to video when omitted. */
        private String callType;

        @NotNull(message = "inviteeIds is required")
        private List<Long> inviteeIds;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateRequest {
        private String title;
        private LocalDateTime scheduledAt;
        private Integer durationMinutes;
        private String callType;
        private List<Long> inviteeIds;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InviteeResponse {
        private Long userId;
        private String username;
        private String displayName;
        private String avatarUrl;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Response {
        private Long id;
        private String title;
        private LocalDateTime scheduledAt;
        private Integer durationMinutes;
        private String callType;
        private String status;
        private Long callRoomId;
        /** Human-shareable code, e.g. "abc-defg-hij". */
        private String meetingCode;
        /** Shareable relative join URL: "/join/{meetingCode}". */
        private String meetingLink;
        private Long createdByUserId;
        private String createdByUsername;
        private String createdByDisplayName;
        private List<InviteeResponse> invitees;
        private LocalDateTime createdAt;
    }
}
