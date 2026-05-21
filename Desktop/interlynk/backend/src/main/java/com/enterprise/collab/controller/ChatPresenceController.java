package com.enterprise.collab.controller;

import com.enterprise.collab.service.ReadReceiptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Lightweight controller for two real-time UX primitives:
 *
 *   POST /api/channels/{id}/read         — mark all messages up to a given
 *                                          messageId as read; broadcasts a
 *                                          delta to channel topic.
 *   GET  /api/channels/{id}/read         — list message ids the caller has
 *                                          read (used for unread badges).
 *   STOMP /app/channel/{id}/typing       — broadcast a typing-start/stop event
 *                                          to /topic/channel/{id}/typing.
 *
 * Typing events are fire-and-forget; they never touch the DB. The client is
 * expected to throttle (one event every ~3s while typing, plus one on stop).
 */
@RestController
@RequiredArgsConstructor
@Slf4j
@RequestMapping("/api/channels")
public class ChatPresenceController {

    private final ReadReceiptService readReceiptService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping("/{channelId}/read")
    public ResponseEntity<Map<String, Object>> markRead(
            @PathVariable Long channelId,
            @RequestBody MarkReadRequest body,
            @AuthenticationPrincipal UserDetails principal) {
        ReadReceiptService.ReadReceiptResult result =
                readReceiptService.markChannelReadUpTo(channelId, body.lastMessageId, principal.getUsername());
        Map<String, Object> out = new HashMap<>();
        out.put("updated", result.updated);
        out.put("messageIds", result.messageIds);
        return ResponseEntity.ok(out);
    }

    @GetMapping("/{channelId}/read")
    public ResponseEntity<List<Long>> getReadIds(
            @PathVariable Long channelId,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(readReceiptService.readMessageIds(channelId, principal.getUsername()));
    }

    /**
     * STOMP destination: client SENDs to /app/channel/{channelId}/typing.
     * We re-broadcast to /topic/channel/{channelId}/typing so all subscribers
     * (except the sender, if their client filters by username) can render
     * "X is typing…" indicators. Payload: { typing: true|false }.
     */
    @MessageMapping("/channel/{channelId}/typing")
    public void typing(
            @org.springframework.messaging.handler.annotation.DestinationVariable Long channelId,
            @Payload TypingEvent event,
            Principal principal) {
        if (principal == null) return;
        Map<String, Object> out = new HashMap<>();
        out.put("type", "typing");
        out.put("channelId", channelId);
        out.put("username", principal.getName());
        out.put("typing", event != null && event.typing);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId + "/typing", out);
    }

    public static class MarkReadRequest {
        public Long lastMessageId;
    }

    public static class TypingEvent {
        public boolean typing;
    }
}
