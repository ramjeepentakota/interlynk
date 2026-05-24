package com.enterprise.collab.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

public class CallDto {
    
    // ============ Call Room DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateCallRoomRequest {
        @NotBlank(message = "Call name is required")
        private String name;
        
        @NotBlank(message = "Call type is required")
        private String type; // ONE_TO_ONE, GROUP
        
        private List<Long> participantIds;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CallRoomResponse {
        private Long id;
        private String name;
        private String type;
        private String status;
        private Long hostId;
        private String createdByUsername;
        private LocalDateTime createdAt;
        private LocalDateTime startedAt;
        private LocalDateTime endedAt;
        private List<ParticipantResponse> participants;
        private int participantCount;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CallRoomListResponse {
        private List<CallRoomResponse> rooms;
        private int activeRoomCount;
    }
    
    // ============ Participant DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ParticipantResponse {
        private Long id;
        private Long userId;
        private String username;
        private String displayName;
        private String avatarUrl;
        private boolean isMuted;
        private boolean isVideoEnabled;
        private boolean isScreenSharing;
        private boolean isHandRaised;
        private LocalDateTime joinedAt;
        private LocalDateTime leftAt;
    }
    
    // ============ Call State DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CallStateUpdateRequest {
        private Boolean isMuted;
        private Boolean isVideoEnabled;
        private Boolean isScreenSharing;
        private Boolean isHandRaised;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CallStateResponse {
        private Long participantId;
        private boolean isMuted;
        private boolean isVideoEnabled;
        private boolean isScreenSharing;
        private boolean isHandRaised;
    }
    
    // ============ WebRTC Signaling DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SignalRequest {
        @NotNull(message = "Room ID is required")
        private Long roomId;

        @NotNull(message = "Sender user ID is required")
        private Long senderUserId;

        @NotNull(message = "Target user ID is required")
        private Long targetUserId;

        private String type; // offer, answer, ice-candidate, call-invite, call-rejected, call-ended
        private String sdp;
        private String candidate;
        private String callType; // voice, video
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SignalResponse {
        private Long roomId;
        private Long senderUserId;
        private String type;
        private String sdp;
        private String candidate;
        private String callType;
    }

    // ============ Incoming Call Notification DTO ============

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class IncomingCallNotification {
        private Long roomId;
        private Long callerUserId;
        private String callerUsername;
        private String callerDisplayName;
        private String callerAvatarUrl;
        private String callType; // voice, video
        // true when this is an invite into an existing GROUP/multi-party room
        // (added to a call). The callee then joins via the SFU group path
        // instead of the 1:1 mesh path. Defaults false for normal 1:1 calls.
        // @JsonProperty pins the JSON key to "isGroup" — without it Jackson would
        // strip the "is" prefix from Lombok's isGroup() getter and emit "group",
        // which the frontend (reads n.isGroup) would never see.
        @lombok.Builder.Default
        @com.fasterxml.jackson.annotation.JsonProperty("isGroup")
        private boolean isGroup = false;
    }
    
    // ============ Direct Call DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateDirectCallRequest {
        @NotNull(message = "User ID is required")
        private Long userId;
    }
    
    // ============ Call Invite DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CallInviteRequest {
        @NotNull(message = "Room ID is required")
        private Long roomId;
        
        private List<Long> userIds;
    }
    
    // ============ Response DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CallResponse {
        private String message;
        private boolean success;
    }
}
