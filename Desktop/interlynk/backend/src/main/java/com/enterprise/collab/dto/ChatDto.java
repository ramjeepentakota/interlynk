package com.enterprise.collab.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

public class ChatDto {
    
    // ============ Channel DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateChannelRequest {
        @NotBlank(message = "Channel name is required")
        @Size(min = 2, max = 100, message = "Channel name must be between 2 and 100 characters")
        private String name;
        
        @Size(max = 500, message = "Description must not exceed 500 characters")
        private String description;
        
        @NotBlank(message = "Channel type is required")
        private String type; // TEXT, VOICE, PUBLIC, PRIVATE
        
        private Long teamId;
        
        private String category;
        
        private Integer maxParticipants; // For voice channels
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateChannelRequest {
        @Size(min = 2, max = 100, message = "Channel name must be between 2 and 100 characters")
        private String name;
        
        @Size(max = 500, message = "Description must not exceed 500 characters")
        private String description;
        
        private String type;
        
        private String category;
        
        private Integer position;
        
        private Integer maxParticipants;
        
        private Boolean isLocked;
        
        private Boolean isActive;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChannelResponse {
        private Long id;
        private String name;
        private String description;
        private String type;
        private String teamName;
        private Long teamId;
        private String createdByUsername;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private int memberCount;
        private int unreadCount;
        private Boolean isActive;
        private Integer position;
        private String category;
        private Integer maxParticipants;
        private Boolean isLocked;
        private Long voiceRoomId;
        private String voiceRoomStatus;
        private List<ChannelMemberResponse> members;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChannelListResponse {
        private Long id;
        private String name;
        private String description;
        private String type;
        private String teamName;
        private Long teamId;
        private LocalDateTime createdAt;
        private int memberCount;
        private String lastMessageContent;
        private LocalDateTime lastMessageTime;
        private Boolean isActive;
        private Integer position;
        private String category;
        private Integer maxParticipants;
        private Boolean isLocked;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChannelMemberResponse {
        private Long id;
        private String username;
        private String displayName;
        private String avatarUrl;
        private String role; // ADMIN, MODERATOR, MEMBER
        private LocalDateTime joinedAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AddTeamToChannelRequest {
        @NotNull(message = "Team ID is required")
        private Long teamId;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChannelByTeamResponse {
        private Long channelId;
        private String channelName;
        private String channelType;
        private String category;
        private Integer position;
        private Boolean isLocked;
        private int memberCount;
    }
    
    // ============ Message DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SendMessageRequest {
        @NotBlank(message = "Message content is required")
        @Size(max = 4000, message = "Message must not exceed 4000 characters")
        private String content;
        
        private List<AttachmentDto> attachments;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MessageResponse {
        private Long id;
        private String content;
        private String formattedContent;  // HTML formatted content
        private String messageType;
        private boolean isEdited;
        private boolean isPinned;
        private boolean isRead;  // Read receipt status
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private Long senderId;
        private String senderUsername;
        private String senderDisplayName;
        private UserDto sender;
        private Long channelId;
        private Long parentId;
        private List<ReactionSummaryDto> reactions;
        private List<AttachmentDto> attachments;
        private int replyCount;
        private Long readAt;  // Timestamp when message was read
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MessageListResponse {
        private List<MessageResponse> messages;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean hasNext;
        private boolean hasPrevious;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class EditMessageRequest {
        @NotBlank(message = "Message content is required")
        @Size(max = 4000, message = "Message must not exceed 4000 characters")
        private String content;
    }
    
    // ============ Reaction DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReactionRequest {
        @NotBlank(message = "Emoji is required")
        private String emoji;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReactionDto {
        private String emoji;
        private String username;
        private LocalDateTime createdAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReactionSummaryDto {
        private String emoji;
        private int count;
        private boolean reactedByCurrentUser;
        private List<String> users;
    }
    
    // ============ Direct Message DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SendDirectMessageRequest {
        @NotNull(message = "Recipient ID is required")
        private Long recipientId;
        
        @NotBlank(message = "Message content is required")
        @Size(max = 4000, message = "Message must not exceed 4000 characters")
        private String content;
        
        private List<AttachmentDto> attachments;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DirectMessageResponse {
        private Long id;
        private String content;
        private String messageType;
        private boolean isEdited;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private UserDto sender;
        private UserDto recipient;
        private boolean isRead;
        private LocalDateTime readAt;
        private List<AttachmentDto> attachments;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ConversationResponse {
        private Long oderId;
        private UserDto otherUser;
        private String lastMessageContent;
        private LocalDateTime lastMessageTime;
        private int unreadCount;
    }
    
    // ============ Thread DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ThreadResponse {
        private MessageResponse parentMessage;
        private List<MessageResponse> replies;
        private int totalReplies;
    }
    
    // ============ Common DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserDto {
        private Long id;
        private String username;
        private String displayName;
        private String avatarUrl;
        private String status;
        private String presence;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AttachmentDto {
        private Long id;
        private String fileName;
        private String fileUrl;
        private String fileType;
        private long fileSize;
        private String uploadedBy;
        private LocalDateTime uploadedAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MessageResponseDto {
        private String message;
        private boolean success;
    }
    
    // ============ Attachment Response DTO ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AttachmentResponse {
        private Long id;
        private String fileName;
        private String fileUrl;
        private String fileType;
        private long fileSize;
    }
    
    // ============ WebSocket Request DTOs ============
    
    /**
     * WebSocket message request for real-time chat
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class WebSocketMessageRequest {
        private String username;
        private String content;
        private Long channelId;
        private List<AttachmentDto> attachments;
    }
    
    /**
     * Typing indicator request
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TypingIndicatorRequest {
        private String username;
        private String channelId;
        private Boolean isTyping;
    }
    
}
