package com.enterprise.collab.controller;

import com.enterprise.collab.dto.ChatDto;
import com.enterprise.collab.service.DirectMessageService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Person-to-person direct messaging ("inbox").
 *
 * All endpoints are authenticated (see {@code SecurityConfig}: {@code /api/**}).
 * The acting user is resolved from the JWT principal via {@link Authentication}.
 */
@RestController
@RequestMapping("/api/dm")
@RequiredArgsConstructor
public class DirectMessageController {

    private final DirectMessageService directMessageService;

    /** List my conversations (one row per other person, newest first). */
    @GetMapping("/conversations")
    public ResponseEntity<List<ChatDto.ConversationResponse>> getConversations(Authentication authentication) {
        return ResponseEntity.ok(directMessageService.getConversations(authentication.getName()));
    }

    /** Full thread with another user (oldest first); marks incoming messages read. */
    @GetMapping("/conversations/{userId}")
    public ResponseEntity<List<ChatDto.DirectMessageResponse>> getConversation(
            @PathVariable Long userId,
            Authentication authentication) {
        return ResponseEntity.ok(directMessageService.getConversation(authentication.getName(), userId));
    }

    /** Send a direct message to another user. */
    @PostMapping
    public ResponseEntity<ChatDto.DirectMessageResponse> sendMessage(
            @Valid @RequestBody ChatDto.SendDirectMessageRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(directMessageService.sendMessage(
                authentication.getName(), request.getRecipientId(), request.getContent()));
    }

    /** Mark an entire conversation as read. */
    @PostMapping("/conversations/{userId}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long userId, Authentication authentication) {
        directMessageService.markConversationRead(authentication.getName(), userId);
        return ResponseEntity.ok().build();
    }

    /** Total unread direct-message count for the badge. */
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(Authentication authentication) {
        Map<String, Long> body = new HashMap<>();
        body.put("count", directMessageService.getUnreadCount(authentication.getName()));
        return ResponseEntity.ok(body);
    }
}
