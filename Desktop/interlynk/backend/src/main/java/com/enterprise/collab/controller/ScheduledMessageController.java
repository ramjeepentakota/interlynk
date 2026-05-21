package com.enterprise.collab.controller;

import com.enterprise.collab.entity.ScheduledMessage;
import com.enterprise.collab.service.ScheduledMessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/scheduled-messages")
@RequiredArgsConstructor
public class ScheduledMessageController {

    private final ScheduledMessageService service;

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @RequestBody CreateRequest body,
            @AuthenticationPrincipal UserDetails principal) {
        ScheduledMessage sm = service.schedule(body.channelId, body.content, body.dispatchAt, principal.getUsername());
        return ResponseEntity.ok(view(sm));
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.listForUser(principal.getUsername()).stream()
                .map(ScheduledMessageController::view).collect(java.util.stream.Collectors.toList()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancel(@PathVariable Long id, @AuthenticationPrincipal UserDetails principal) {
        service.cancel(id, principal.getUsername());
        return ResponseEntity.noContent().build();
    }

    private static Map<String, Object> view(ScheduledMessage sm) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", sm.getId());
        m.put("channelId", sm.getChannel().getId());
        m.put("content", sm.getContent());
        m.put("dispatchAt", sm.getDispatchAt());
        m.put("status", sm.getStatus().name());
        m.put("deliveredMessageId", sm.getDeliveredMessageId());
        m.put("lastError", sm.getLastError());
        m.put("createdAt", sm.getCreatedAt());
        return m;
    }

    public static class CreateRequest {
        public Long channelId;
        public String content;
        public LocalDateTime dispatchAt;
    }
}
