package com.enterprise.collab.service;

import com.enterprise.collab.dto.CallDto;
import com.enterprise.collab.entity.CallParticipant;
import com.enterprise.collab.entity.CallRoom;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.CallParticipantRepository;
import com.enterprise.collab.repository.CallRoomRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CallService {
    
    private final CallRoomRepository callRoomRepository;
    private final CallParticipantRepository callParticipantRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    
    // ============ Room Operations ============
    
    @Transactional
    public CallDto.CallRoomResponse createCallRoom(String name, CallRoom.CallRoomType type, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        
        CallRoom room = CallRoom.builder()
                .name(name)
                .type(type)
                .createdBy(user)
                .isActive(true)
                .build();
        
        room = callRoomRepository.save(room);
        
        log.info("Call room created: {} by user {}", name, userId);
        
        return mapToCallRoomResponse(room);
    }
    
    @Transactional(readOnly = true)
    public List<CallDto.CallRoomResponse> getActiveRooms() {
        return callRoomRepository.findByIsActiveTrue().stream()
                .map(this::mapToCallRoomResponse)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public Optional<CallDto.CallRoomResponse> getRoom(Long roomId) {
        return callRoomRepository.findById(roomId)
                .map(this::mapToCallRoomResponse);
    }

    public User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
    }
    
    public CallDto.CallRoomResponse getRoomOrThrow(Long roomId) {
        return callRoomRepository.findById(roomId)
                .map(this::mapToCallRoomResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Call room", "id", roomId));
    }
    
    // ============ Participant Operations ============
    
    @Transactional
    public CallDto.ParticipantResponse addParticipant(Long roomId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        
        CallRoom room = callRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Call room", "id", roomId));
        
        if (!room.getIsActive()) {
            throw new BadRequestException("Cannot join an inactive call room");
        }
        
        // Check if already an active participant (use the leftAt-filtered query to
        // avoid IncorrectResultSizeDataAccessException when the same user has left-and-rejoined)
        Optional<CallParticipant> existingParticipant = callParticipantRepository
                .findByCallRoomIdAndUserIdAndLeftAtIsNull(roomId, userId);

        if (existingParticipant.isPresent()) {
            log.info("User {} is already an active participant in call room {}, returning existing participant", userId, roomId);
            return mapToParticipantResponse(existingParticipant.get());
        }

        
        CallParticipant participant = CallParticipant.builder()
                .callRoom(room)
                .user(user)
                .joinedAt(LocalDateTime.now())
                .isMuted(false)
                .isVideoEnabled(true)
                .isScreenSharing(false)
                .build();
        
        participant = callParticipantRepository.save(participant);
        
        // Broadcast participant joined
        Map<String, Object> joinMap = new java.util.HashMap<>();
        joinMap.put("type", "participant_joined");
        joinMap.put("participant", mapToParticipantResponse(participant));
        messagingTemplate.convertAndSend("/topic/call/" + roomId, joinMap);
        
        log.info("User {} joined call room {}", userId, roomId);
        
        return mapToParticipantResponse(participant);
    }
    
    @Transactional
    public void removeParticipant(Long roomId, Long userId) {
        CallParticipant participant = callParticipantRepository
                .findByCallRoomIdAndUserIdAndLeftAtIsNull(roomId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Participant not found"));
        
        participant.setLeftAt(LocalDateTime.now());
        callParticipantRepository.save(participant);
        
        // Broadcast participant left
        Map<String, Object> leftMap = new java.util.HashMap<>();
        leftMap.put("type", "participant_left");
        leftMap.put("userId", userId);
        messagingTemplate.convertAndSend("/topic/call/" + roomId, leftMap);
        
        log.info("User {} left call room {}", userId, roomId);
        
        // If no participants left, end the call
        List<CallParticipant> activeParticipants = callParticipantRepository
                .findByCallRoomIdAndLeftAtIsNull(roomId);
        
        if (activeParticipants.isEmpty()) {
            endCall(roomId);
        }
    }
    
    @Transactional(readOnly = true)
    public List<CallDto.ParticipantResponse> getRoomParticipants(Long roomId) {
        return callParticipantRepository.findActiveParticipantsWithUser(roomId).stream()
                .map(this::mapToParticipantResponse)
                .collect(Collectors.toList());
    }
    
    // ============ Call State Operations ============
    
    @Transactional
    public CallDto.ParticipantResponse updateParticipantState(Long roomId, Long userId, 
            Boolean isMuted, Boolean isVideoEnabled, Boolean isScreenSharing) {
        
        CallParticipant participant = callParticipantRepository
                .findByCallRoomIdAndUserIdAndLeftAtIsNull(roomId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Participant not found"));

        if (isMuted != null) {
            participant.setIsMuted(isMuted);
        }
        if (isVideoEnabled != null) {
            participant.setIsVideoEnabled(isVideoEnabled);
        }
        if (isScreenSharing != null) {
            participant.setIsScreenSharing(isScreenSharing);
        }
        
        participant = callParticipantRepository.save(participant);
        
        // Broadcast state update
        Map<String, Object> stateMap = new java.util.HashMap<>();
        stateMap.put("type", "participant_state_changed");
        stateMap.put("participant", mapToParticipantResponse(participant));
        messagingTemplate.convertAndSend("/topic/call/" + roomId, stateMap);
        
        return mapToParticipantResponse(participant);
    }
    
    // ============ Direct Call Operations ============
    
    @Transactional
    public CallDto.CallRoomResponse createDirectCall(Long user1Id, Long user2Id) {
        User user1 = userRepository.findById(user1Id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", user1Id));
        
        User user2 = userRepository.findById(user2Id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", user2Id));
        
        CallRoom room = CallRoom.builder()
                .name("Direct call between " + user1.getUsername() + " and " + user2.getUsername())
                .type(CallRoom.CallRoomType.ONE_TO_ONE)
                .createdBy(user1)
                .isActive(true)
                .build();
        
        room = callRoomRepository.save(room);
        
        log.info("Direct call created between users {} and {}", user1Id, user2Id);
        
        return mapToCallRoomResponse(room);
    }
    
    // ============ Call Control Operations ============
    
    @Transactional
    public CallDto.CallRoomResponse endCall(Long roomId) {
        CallRoom room = callRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Call room", "id", roomId));
        
        room.setIsActive(false);
        room.setEndedAt(LocalDateTime.now());
        
        room = callRoomRepository.save(room);
        
        // Mark all participants as left
        List<CallParticipant> participants = callParticipantRepository
                .findByCallRoomIdAndLeftAtIsNull(roomId);
        
        for (CallParticipant participant : participants) {
            participant.setLeftAt(LocalDateTime.now());
            callParticipantRepository.save(participant);
        }
        
        // Broadcast call ended
        Map<String, Object> endMap = new java.util.HashMap<>();
        endMap.put("type", "call_ended");
        endMap.put("roomId", roomId);
        messagingTemplate.convertAndSend("/topic/call/" + roomId, endMap);
        
        log.info("Call room {} ended", roomId);
        
        return mapToCallRoomResponse(room);
    }
    
    // ============ Signaling Operations ============
    
    public void sendSignal(Long roomId, CallDto.SignalRequest signalRequest) {
        User targetUser = userRepository.findById(signalRequest.getTargetUserId()).orElse(null);
        if (targetUser == null) return;

        CallDto.SignalResponse signalResponse = CallDto.SignalResponse.builder()
                .roomId(roomId)
                .senderUserId(signalRequest.getSenderUserId())
                .type(signalRequest.getType())
                .sdp(signalRequest.getSdp())
                .candidate(signalRequest.getCandidate())
                .callType(signalRequest.getCallType())
                .build();

        messagingTemplate.convertAndSendToUser(
                targetUser.getUsername(),
                "/queue/call/signal",
                signalResponse
        );
    }

    /**
     * Notify a target user of an incoming call via their private WebSocket queue.
     * IMPORTANT: Spring's convertAndSendToUser routes by the WebSocket principal name,
     * which is the user's LOGIN USERNAME (set by WebSocketAuthInterceptor), NOT their numeric ID.
     */
    public void sendIncomingCallNotification(Long targetUserId, CallDto.IncomingCallNotification notification) {
        // Look up the callee's username to match the WebSocket principal name
        User targetUser = userRepository.findById(targetUserId)
                .orElse(null);

        if (targetUser == null) {
            log.warn("Cannot send call notification: target user {} not found", targetUserId);
            return;
        }

        // Route by username — this must match the principal set in WebSocketAuthInterceptor
        messagingTemplate.convertAndSendToUser(
                targetUser.getUsername(),
                "/queue/call/incoming",
                notification
        );
        log.info("Incoming call notification sent to user '{}' (id={}) for room {}",
                targetUser.getUsername(), targetUserId, notification.getRoomId());
    }

    /**
     * Invite an additional user into an EXISTING call room (the "add person to
     * the call" feature). Pre-registers the invitee as a participant so the SFU
     * token endpoint authorizes them the instant they accept (no join race),
     * then rings them with a GROUP incoming-call so their client joins via the
     * multi-party SFU path rather than the 1:1 mesh.
     */
    @Transactional
    public void inviteToRoom(Long roomId, Long callerId, Long targetUserId, String callType) {
        if (targetUserId == null) {
            throw new BadRequestException("targetUserId is required");
        }
        CallRoom room = callRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Call room", "id", roomId));
        if (!room.getIsActive()) {
            throw new BadRequestException("Cannot add someone to an inactive call");
        }
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", callerId));

        // Pre-authorize the invitee for this room's media token.
        addParticipant(roomId, targetUserId);

        CallDto.IncomingCallNotification notification = CallDto.IncomingCallNotification.builder()
                .roomId(roomId)
                .callerUserId(callerId)
                .callerUsername(caller.getUsername())
                .callerDisplayName(caller.getDisplayName())
                .callerAvatarUrl(caller.getAvatarUrl())
                .callType("video".equalsIgnoreCase(callType) ? "video" : "voice")
                .isGroup(true)
                .build();
        sendIncomingCallNotification(targetUserId, notification);

        log.info("User {} invited user {} into call room {}", callerId, targetUserId, roomId);
    }

    
    // ============ Mapping Methods ============
    
    private CallDto.CallRoomResponse mapToCallRoomResponse(CallRoom room) {
        // Use eager fetch to avoid LazyInitializationException
        List<CallParticipant> participants = callParticipantRepository
                .findActiveParticipantsWithUser(room.getId());
        
        String createdByUsername = null;
        Long hostId = null;
        try {
            if (room.getCreatedBy() != null) {
                createdByUsername = room.getCreatedBy().getUsername();
                hostId = room.getCreatedBy().getId();
            }
        } catch (Exception e) {
            log.warn("Could not load createdBy for room {}", room.getId());
        }

        return CallDto.CallRoomResponse.builder()
                .id(room.getId())
                .name(room.getName())
                .type(room.getType().name())
                .status(room.getIsActive() ? "ACTIVE" : "ENDED")
                .hostId(hostId)
                .createdByUsername(createdByUsername)
                .createdAt(room.getCreatedAt())
                .startedAt(room.getStartedAt())
                .endedAt(room.getEndedAt())
                .participants(participants.stream()
                        .map(this::mapToParticipantResponse)
                        .collect(Collectors.toList()))
                .participantCount(participants.size())
                .build();
    }
    
    private CallDto.ParticipantResponse mapToParticipantResponse(CallParticipant participant) {
        return CallDto.ParticipantResponse.builder()
                .id(participant.getId())
                .userId(participant.getUser().getId())
                .username(participant.getUser().getUsername())
                .displayName(participant.getUser().getDisplayName())
                .avatarUrl(participant.getUser().getAvatarUrl())
                .isMuted(participant.getIsMuted())
                .isVideoEnabled(participant.getIsVideoEnabled())
                .isScreenSharing(participant.getIsScreenSharing())
                .joinedAt(participant.getJoinedAt())
                .leftAt(participant.getLeftAt())
                .build();
    }
}
