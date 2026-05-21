package com.enterprise.collab.controller;

import com.enterprise.collab.entity.User;
import com.enterprise.collab.repository.UserRepository;
import com.enterprise.collab.service.LiveKitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Issues LiveKit (SFU) join tokens to the browser so a call/voice-channel can
 * carry real multi-party audio/video. The {@code room} is the call-room id (or
 * voice-channel call-room id) the caller is already a participant of.
 *
 * Response shape:
 * <pre>
 *   { "configured": true, "url": "wss://...", "token": "ey...", "identity": "alice" }
 *   { "configured": false }   // when LiveKit env is not set up
 * </pre>
 */
@RestController
@RequestMapping("/api/calls/livekit")
@RequiredArgsConstructor
public class LiveKitTokenController {

    private final LiveKitService liveKitService;
    private final UserRepository userRepository;

    @GetMapping("/token")
    public ResponseEntity<Map<String, Object>> getToken(
            @RequestParam("room") String room,
            @RequestParam(value = "canPublish", defaultValue = "true") boolean canPublish,
            Authentication authentication) {

        Map<String, Object> body = new HashMap<>();

        if (!liveKitService.isConfigured()) {
            body.put("configured", false);
            return ResponseEntity.ok(body);
        }

        String username = authentication.getName();
        String displayName = userRepository.findByUsername(username)
                .map(User::getDisplayName)
                .orElse(username);

        String token = liveKitService.createToken(room, username, displayName, canPublish);

        body.put("configured", true);
        body.put("url", liveKitService.getUrl());
        body.put("token", token);
        body.put("identity", username);
        return ResponseEntity.ok(body);
    }
}
