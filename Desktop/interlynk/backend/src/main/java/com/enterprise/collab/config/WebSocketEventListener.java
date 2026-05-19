package com.enterprise.collab.config;

import com.enterprise.collab.entity.User;
import com.enterprise.collab.repository.UserRepository;
import com.enterprise.collab.service.ConnectionHealthService;
import com.enterprise.collab.service.OfflineMessageQueueService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final SimpUserRegistry simpUserRegistry;
    private final UserRepository userRepository;
    private final ConnectionHealthService connectionHealthService;
    private final OfflineMessageQueueService offlineMessageQueueService;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        String sessionId = event.getMessage().getHeaders().get("simpSessionId", String.class);
        log.info("WebSocket connection established: {}", sessionId);

        // Get username from authentication if available
        String userName = event.getUser() != null ? event.getUser().getName() : null;

        if (userName != null) {
            // Register connection
            connectionHealthService.registerConnection(userName, sessionId);

            // Update user presence
            try {
                User user = userRepository.findByUsername(userName).orElse(null);
                if (user != null) {
                    user.setPresence(User.Presence.ONLINE);
                    user.setLastSeenAt(LocalDateTime.now());
                    userRepository.save(user);

                    // Broadcast online status
                    Map<String, Object> presenceMap = new java.util.HashMap<>();
                    presenceMap.put("type", "presence_update");
                    presenceMap.put("username", userName);
                    presenceMap.put("userId", user.getId());
                    presenceMap.put("presence", "ONLINE");
                    presenceMap.put("timestamp", System.currentTimeMillis());
                    messagingTemplate.convertAndSend("/topic/user/presence", presenceMap);
                }
            } catch (Exception e) {
                log.error("Error updating presence on connect", e);
            }
        }
    }

    @EventListener
    public void handleWebSocketSubscribeListener(SessionSubscribeEvent event) {
        String destination = event.getMessage().getHeaders().get("simpDestination", String.class);
        String sessionId = event.getMessage().getHeaders().get("simpSessionId", String.class);
        String userName = event.getUser() != null ? event.getUser().getName() : null;

        log.debug("User {} subscribed to {} on session {}", userName, destination, sessionId);

        // If user subscribes to their message queue, deliver offline messages
        if (userName != null && destination != null && destination.startsWith("/user/")) {
            offlineMessageQueueService.deliverQueuedMessages(userName);
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        log.info("WebSocket disconnection: {}", sessionId);

        // Get username from authentication if available
        String userName = event.getUser() != null ? event.getUser().getName() : null;

        if (userName != null) {
            // Remove connection from tracking
            connectionHealthService.removeConnection(userName, sessionId);

            // Check if user has other connections
            Set<String> remainingConnections = connectionHealthService.getUserConnections(userName);

            // Only update presence if no connections remain
            if (remainingConnections.isEmpty()) {
                try {
                    User user = userRepository.findByUsername(userName).orElse(null);
                    if (user != null) {
                        user.setPresence(User.Presence.OFFLINE);
                        user.setLastSeenAt(LocalDateTime.now());
                        userRepository.save(user);

                        // Broadcast offline status
                        Map<String, Object> presenceMap = new java.util.HashMap<>();
                        presenceMap.put("type", "presence_update");
                        presenceMap.put("username", userName);
                        presenceMap.put("userId", user.getId());
                        presenceMap.put("presence", "OFFLINE");
                        presenceMap.put("timestamp", System.currentTimeMillis());
                        messagingTemplate.convertAndSend("/topic/user/presence", presenceMap);
                    }
                } catch (Exception e) {
                    log.error("Error updating user presence on disconnect", e);
                }
            }
        }
    }

    public Set<String> getOnlineUsers() {
        return simpUserRegistry.getUsers().stream()
                .map(SimpUser::getName)
                .collect(Collectors.toSet());
    }

    public int getOnlineUserCount() {
        return simpUserRegistry.getUserCount();
    }
}
