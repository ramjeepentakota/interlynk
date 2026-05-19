package com.enterprise.collab.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

public class NotificationDto {
    
    // ============ Request DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateNotificationRequest {
        @NotNull(message = "User ID is required")
        private Long userId;
        
        @NotBlank(message = "Type is required")
        private String type;
        
        @NotBlank(message = "Title is required")
        private String title;
        
        private String message;
        private String link;
    }
    
    // ============ Response DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NotificationResponse {
        private Long id;
        private String type;
        private String title;
        private String message;
        private String link;
        private boolean isRead;
        private LocalDateTime createdAt;
        private LocalDateTime readAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NotificationListResponse {
        private List<NotificationResponse> notifications;
        private int unreadCount;
        private int totalCount;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MessageResponse {
        private String message;
        private boolean success;
    }
}
