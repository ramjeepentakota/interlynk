package com.enterprise.collab.controller;

import com.enterprise.collab.dto.CallDto;
import com.enterprise.collab.entity.CallRoom;
import com.enterprise.collab.security.JwtTokenProvider;
import com.enterprise.collab.service.CallService;
import javax.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
@Slf4j
public class CallController {
    
    private final CallService callService;
    private final JwtTokenProvider jwtTokenProvider;
    private final SimpMessagingTemplate messagingTemplate;
    
    @PostMapping("/room")
    public ResponseEntity<CallDto.CallRoomResponse> createRoom(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        Long userId = getUserIdFromRequest(httpRequest);
        String name = (String) request.get("name");
        String typeStr = (String) request.get("type");
        CallRoom.CallRoomType type = CallRoom.CallRoomType.valueOf(typeStr != null ? typeStr : "GROUP");
        
        return ResponseEntity.ok(callService.createCallRoom(name, type, userId));
    }
    
    @GetMapping("/rooms")
    public ResponseEntity<List<CallDto.CallRoomResponse>> getActiveRooms() {
        return ResponseEntity.ok(callService.getActiveRooms());
    }
    
    @GetMapping("/room/{roomId}")
    public ResponseEntity<CallDto.CallRoomResponse> getRoom(@PathVariable Long roomId) {
        return callService.getRoom(roomId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/room/{roomId}/join")
    public ResponseEntity<CallDto.ParticipantResponse> joinRoom(
            @PathVariable Long roomId,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(callService.addParticipant(roomId, userId));
    }
    
    @PostMapping("/room/{roomId}/leave")
    public ResponseEntity<Void> leaveRoom(
            @PathVariable Long roomId,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        callService.removeParticipant(roomId, userId);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/room/{roomId}/end")
    public ResponseEntity<CallDto.CallRoomResponse> endCall(@PathVariable Long roomId) {
        return ResponseEntity.ok(callService.endCall(roomId));
    }
    
    @GetMapping("/room/{roomId}/participants")
    public ResponseEntity<List<CallDto.ParticipantResponse>> getRoomParticipants(@PathVariable Long roomId) {
        return ResponseEntity.ok(callService.getRoomParticipants(roomId));
    }
    
    @PutMapping("/room/{roomId}/state")
    public ResponseEntity<CallDto.ParticipantResponse> updateParticipantState(
            @PathVariable Long roomId,
            @RequestBody Map<String, Boolean> state,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(callService.updateParticipantState(
                roomId, 
                userId, 
                state.get("isMuted"), 
                state.get("isVideoEnabled"), 
                state.get("isScreenSharing")));
    }
    
    @PostMapping("/direct")
    public ResponseEntity<CallDto.CallRoomResponse> createDirectCall(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        Long user1Id = getUserIdFromRequest(httpRequest);
        Long user2Id = request.get("userId") != null ? ((Number) request.get("userId")).longValue() : null;
        String callType = request.get("callType") != null ? (String) request.get("callType") : "voice";

        if (user2Id == null) {
            return ResponseEntity.badRequest().build();
        }

        CallDto.CallRoomResponse room = callService.createDirectCall(user1Id, user2Id);

        // Look up caller info
        com.enterprise.collab.entity.User caller = callService.getUserById(user1Id);

        // Push incoming call notification to callee via their private WS queue
        CallDto.IncomingCallNotification notification = CallDto.IncomingCallNotification.builder()
                .roomId(room.getId())
                .callerUserId(user1Id)
                .callerUsername(caller.getUsername())
                .callerDisplayName(caller.getDisplayName())
                .callerAvatarUrl(caller.getAvatarUrl())
                .callType(callType)
                .build();

        callService.sendIncomingCallNotification(user2Id, notification);

        return ResponseEntity.ok(room);
    }
    
    @PostMapping("/room/{roomId}/invite")
    public ResponseEntity<Void> inviteToRoom(
            @PathVariable Long roomId,
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        Long callerId = getUserIdFromRequest(httpRequest);
        Long targetUserId = request.get("userId") != null ? ((Number) request.get("userId")).longValue() : null;
        String callType = request.get("callType") != null ? (String) request.get("callType") : "voice";
        callService.inviteToRoom(roomId, callerId, targetUserId, callType);
        return ResponseEntity.ok().build();
    }

    // WebSocket endpoint for call signaling
    @MessageMapping("/call/signal")
    public void handleSignal(@Payload Map<String, Object> signal) {
        log.info("Received call signal type [{}] from user {} to user {}",
                signal.get("type"), signal.get("senderUserId"), signal.get("targetUserId"));

        Long roomId = signal.get("roomId") != null ? ((Number) signal.get("roomId")).longValue() : null;
        Long senderUserId = signal.get("senderUserId") != null ? ((Number) signal.get("senderUserId")).longValue() : null;
        Long targetUserId = signal.get("targetUserId") != null ? ((Number) signal.get("targetUserId")).longValue() : null;
        String type = (String) signal.get("type");
        String sdp = (String) signal.get("sdp");
        String candidate = (String) signal.get("candidate");
        String callType = (String) signal.get("callType");

        if (roomId == null || senderUserId == null || targetUserId == null) {
            log.warn("Invalid signal: missing roomId, senderUserId, or targetUserId");
            return;
        }

        CallDto.SignalRequest req = CallDto.SignalRequest.builder()
                .roomId(roomId)
                .senderUserId(senderUserId)
                .targetUserId(targetUserId)
                .type(type)
                .sdp(sdp)
                .candidate(candidate)
                .callType(callType)
                .build();

        callService.sendSignal(roomId, req);
    }
    
    private Long getUserIdFromRequest(HttpServletRequest request) {
        String token = jwtTokenProvider.getTokenFromRequest(request);
        return jwtTokenProvider.getUserIdFromToken(token);
    }
}
