package com.enterprise.collab.controller;

import com.enterprise.collab.dto.ChatDto;
import com.enterprise.collab.service.EnterpriseChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Enterprise Chat Controller - All REST endpoints for advanced chat features
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class EnterpriseChatController {

    private final EnterpriseChatService enterpriseChatService;

    // ============ Read Receipts ============

    /**
     * Mark messages as read
     * PUT /api/chat/channels/{channelId}/read?messageId=123
     */
    @PutMapping("/channels/{channelId}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable Long channelId,
            @RequestParam Long messageId,
            Authentication authentication) {
        
        enterpriseChatService.markMessagesAsRead(channelId, messageId, authentication.getName());
        return ResponseEntity.ok().build();
    }

    /**
     * Get unread count
     * GET /api/chat/channels/{channelId}/unread
     */
    @GetMapping("/channels/{channelId}/unread")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @PathVariable Long channelId,
            Authentication authentication) {
        
        long count = enterpriseChatService.getUnreadCount(channelId, authentication.getName());
        Map<String, Long> response = new HashMap<>();
        response.put("unreadCount", count);
        return ResponseEntity.ok(response);
    }

    // ============ Message Search ============

    /**
     * Search messages in a channel
     * GET /api/chat/channels/{channelId}/search?q=hello
     */
    @GetMapping("/channels/{channelId}/search")
    public ResponseEntity<List<ChatDto.MessageResponse>> searchMessages(
            @PathVariable Long channelId,
            @RequestParam String q,
            Authentication authentication) {
        
        return ResponseEntity.ok(enterpriseChatService.searchMessages(channelId, q, authentication.getName()));
    }

    // ============ User Blocking ============

    /**
     * Block a user
     * POST /api/chat/block/{username}
     */
    @PostMapping("/block/{username}")
    public ResponseEntity<Map<String, String>> blockUser(
            @PathVariable String username,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        
        String reason = body.get("reason");
        enterpriseChatService.blockUser(authentication.getName(), username, reason);
        
        Map<String, String> response = new HashMap<>();
        response.put("message", "User blocked successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * Unblock a user
     * DELETE /api/chat/block/{username}
     */
    @DeleteMapping("/block/{username}")
    public ResponseEntity<Map<String, String>> unblockUser(
            @PathVariable String username,
            Authentication authentication) {
        
        enterpriseChatService.unblockUser(authentication.getName(), username);
        
        Map<String, String> response = new HashMap<>();
        response.put("message", "User unblocked successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * Get blocked users
     * GET /api/chat/blocked
     */
    @GetMapping("/blocked")
    public ResponseEntity<List<Long>> getBlockedUsers(Authentication authentication) {
        return ResponseEntity.ok(enterpriseChatService.getBlockedUserIds(authentication.getName()));
    }

    // ============ Presence ============

    /**
     * Update presence status
     * PUT /api/chat/presence
     */
    @PutMapping("/presence")
    public ResponseEntity<Void> updatePresence(
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        
        String status = body.get("status"); // ONLINE, AWAY, DO_NOT_DISTURB, OFFLINE
        enterpriseChatService.updatePresence(authentication.getName(), status);
        return ResponseEntity.ok().build();
    }

    /**
     * Get online users in channel
     * GET /api/chat/channels/{channelId}/online
     */
    @GetMapping("/channels/{channelId}/online")
    public ResponseEntity<Set<String>> getOnlineUsers(
            @PathVariable Long channelId) {
        
        return ResponseEntity.ok(enterpriseChatService.getOnlineUsersInChannel(channelId));
    }

    // ============ Typing Indicators (WebSocket triggered) ============

    /**
     * Start typing
     * POST /api/chat/channels/{channelId}/typing
     */
    @PostMapping("/channels/{channelId}/typing")
    public ResponseEntity<Void> startTyping(
            @PathVariable Long channelId,
            Authentication authentication) {
        
        enterpriseChatService.sendTypingIndicator(channelId, authentication.getName(), true);
        return ResponseEntity.ok().build();
    }

    /**
     * Stop typing
     * DELETE /api/chat/channels/{channelId}/typing
     */
    @DeleteMapping("/channels/{channelId}/typing")
    public ResponseEntity<Void> stopTyping(
            @PathVariable Long channelId,
            Authentication authentication) {
        
        enterpriseChatService.sendTypingIndicator(channelId, authentication.getName(), false);
        return ResponseEntity.ok().build();
    }
}
