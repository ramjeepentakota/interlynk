package com.enterprise.collab.controller;

import com.enterprise.collab.dto.CallDto;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.repository.UserRepository;
import com.enterprise.collab.service.CallService;
import com.enterprise.collab.service.SfuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Issues mediasoup SFU join tokens so the browser can join a call room's media
 * session. The {@code room} is the call-room id the caller is a participant of.
 *
 * Response shape (mirrors the LiveKit token endpoint for an easy frontend swap):
 * <pre>
 *   { "configured": true, "url": "https://host:4443", "token": "ey...", "identity": "alice" }
 *   { "configured": false }   // when the SFU is not set up
 * </pre>
 */
@RestController
@RequestMapping("/api/calls/sfu")
@RequiredArgsConstructor
public class SfuTokenController {

    private final SfuService sfuService;
    private final UserRepository userRepository;
    private final CallService callService;

    @GetMapping("/token")
    public ResponseEntity<Map<String, Object>> getToken(
            @RequestParam("room") String room,
            @RequestParam(value = "canPublish", defaultValue = "true") boolean canPublish,
            Authentication authentication) {

        Map<String, Object> body = new HashMap<>();

        if (!sfuService.isConfigured()) {
            body.put("configured", false);
            return ResponseEntity.ok(body);
        }

        String username = authentication.getName();

        long roomId;
        try {
            roomId = Long.parseLong(room);
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid room id");
        }

        // Resolve the user once; we need both displayName and userId below.
        User callerUser = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        // Auto-join if not already an active participant. This handles two cases:
        // 1. The front-end's fire-and-forget joinCall() failed silently.
        // 2. The SFU-token probe is called before joinCall() completes (race).
        // Security: the room must exist and be active for addParticipant() to succeed.
        List<CallDto.ParticipantResponse> participants = callService.getRoomParticipants(roomId);
        boolean isParticipant = participants.stream()
                .anyMatch(p -> username.equals(p.getUsername()));
        if (!isParticipant) {
            try {
                callService.addParticipant(roomId, callerUser.getId());
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Cannot obtain a media token for this call room.");
            }
        }

        String displayName = callerUser.getDisplayName() != null ? callerUser.getDisplayName() : username;

        String token = sfuService.createToken(room, username, displayName, canPublish);

        body.put("configured", true);
        body.put("url", sfuService.getUrl());
        body.put("token", token);
        body.put("identity", username);
        return ResponseEntity.ok(body);
    }
}
