package com.enterprise.collab.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * Connection Health Monitoring Service
 * Monitors WebSocket connections and user presence
 * Works with or without Redis
 */
@Service
@Slf4j
public class ConnectionHealthService {

    @Autowired(required = false)
    private RedisTemplate<String, Object> redisTemplate;
    
    private final SimpMessagingTemplate messagingTemplate;
    
    // In-memory fallback when Redis is not available
    private final Map<String, Set<String>> memoryConnections = new HashMap<>();
    private final Map<String, String> memoryPresence = new HashMap<>();
    
    public ConnectionHealthService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    // ============ Connection Tracking ============

    /**
     * Register a user's active connection
     */
    public void registerConnection(String username, String sessionId) {
        if (redisTemplate != null) {
            try {
                String key = "user:connections:" + username;
                redisTemplate.opsForSet().add(key, sessionId);
                redisTemplate.expire(key, 24, TimeUnit.HOURS);
                
                // Set presence to online
                redisTemplate.opsForValue().set("presence:" + username, "ONLINE", 24, TimeUnit.HOURS);
                
                log.debug("User {} connected with session {} (Redis)", username, sessionId);
                
                // Broadcast online status
                broadcastPresence(username, "ONLINE");
                return;
            } catch (Exception e) {
                log.warn("Redis unavailable for registerConnection: {}", e.getMessage());
            }
        }
        
        // Fallback to in-memory
        synchronized (memoryConnections) {
            Set<String> sessions = memoryConnections.computeIfAbsent(username, k -> new HashSet<>());
            sessions.add(sessionId);
        }
        memoryPresence.put(username, "ONLINE");
        log.debug("User {} connected with session {} (Memory)", username, sessionId);
        broadcastPresence(username, "ONLINE");
    }

    /**
     * Remove a connection when user disconnects
     */
    public void removeConnection(String username, String sessionId) {
        if (redisTemplate != null) {
            try {
                String key = "user:connections:" + username;
                redisTemplate.opsForSet().remove(key, sessionId);
                
                // Check if user has any remaining connections
                Set<Object> connections = redisTemplate.opsForSet().members(key);
                if (connections == null || connections.isEmpty()) {
                    redisTemplate.opsForValue().set("presence:" + username, "OFFLINE", 24, TimeUnit.HOURS);
                    broadcastPresence(username, "OFFLINE");
                }
                
                log.debug("User {} disconnected session {} (Redis)", username, sessionId);
                return;
            } catch (Exception e) {
                log.warn("Redis unavailable for removeConnection: {}", e.getMessage());
            }
        }
        
        // Fallback to in-memory
        synchronized (memoryConnections) {
            Set<String> sessions = memoryConnections.get(username);
            if (sessions != null) {
                sessions.remove(sessionId);
                if (sessions.isEmpty()) {
                    memoryPresence.put(username, "OFFLINE");
                    broadcastPresence(username, "OFFLINE");
                }
            }
        }
        log.debug("User {} disconnected session {} (Memory)", username, sessionId);
    }

    /**
     * Get all active connections for a user
     */
    public Set<String> getUserConnections(String username) {
        if (redisTemplate != null) {
            try {
                String key = "user:connections:" + username;
                Set<Object> connections = redisTemplate.opsForSet().members(key);
                
                if (connections == null) {
                    return new HashSet<>();
                }
                
                Set<String> result = new HashSet<>();
                for (Object conn : connections) {
                    result.add(conn.toString());
                }
                return result;
            } catch (Exception e) {
                log.warn("Redis unavailable for getUserConnections: {}", e.getMessage());
            }
        }
        
        // Fallback to in-memory
        synchronized (memoryConnections) {
            Set<String> sessions = memoryConnections.get(username);
            return sessions != null ? new HashSet<>(sessions) : new HashSet<>();
        }
    }

    /**
     * Get user's current presence status
     */
    public String getPresence(String username) {
        if (redisTemplate != null) {
            try {
                Object status = redisTemplate.opsForValue().get("presence:" + username);
                return status != null ? status.toString() : "OFFLINE";
            } catch (Exception e) {
                log.warn("Redis unavailable for getPresence: {}", e.getMessage());
            }
        }
        
        // Fallback to in-memory
        return memoryPresence.getOrDefault(username, "OFFLINE");
    }

    /**
     * Set user presence status
     */
    public void setPresence(String username, String status) {
        if (redisTemplate != null) {
            try {
                redisTemplate.opsForValue().set("presence:" + username, status, 24, TimeUnit.HOURS);
                broadcastPresence(username, status);
                return;
            } catch (Exception e) {
                log.warn("Redis unavailable for setPresence: {}", e.getMessage());
            }
        }
        
        // Fallback to in-memory
        memoryPresence.put(username, status);
        broadcastPresence(username, status);
    }

    // ============ Health Checks ============

    /**
     * Scheduled health check - runs every 5 minutes
     */
    @Scheduled(fixedRate = 300000) // 5 minutes
    public void performHealthCheck() {
        log.debug("Running connection health check...");
        
        if (redisTemplate != null) {
            try {
                Set<String> presenceKeys = redisTemplate.keys("presence:*");
                if (presenceKeys == null || presenceKeys.isEmpty()) {
                    return;
                }
                
                int onlineCount = 0;
                for (String key : presenceKeys) {
                    Object status = redisTemplate.opsForValue().get(key);
                    if (status != null && "ONLINE".equals(status.toString())) {
                        onlineCount++;
                    }
                }
                
                log.info("Health check: {} users online (Redis)", onlineCount);
                
                // Broadcast health metrics
                Map<String, Object> metrics = new HashMap<>();
                metrics.put("type", "health_metrics");
                metrics.put("onlineUsers", onlineCount);
                metrics.put("timestamp", System.currentTimeMillis());
                
                messagingTemplate.convertAndSend("/topic/admin/health", metrics);
                return;
            } catch (Exception e) {
                log.warn("Redis unavailable for health check: {}", e.getMessage());
            }
        }
        
        // Fallback to in-memory
        int onlineCount = 0;
        synchronized (memoryPresence) {
            for (String status : memoryPresence.values()) {
                if ("ONLINE".equals(status)) {
                    onlineCount++;
                }
            }
        }
        
        log.info("Health check: {} users online (Memory)", onlineCount);
        
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("type", "health_metrics");
        metrics.put("onlineUsers", onlineCount);
        metrics.put("timestamp", System.currentTimeMillis());
        
        messagingTemplate.convertAndSend("/topic/admin/health", metrics);
    }

    /**
     * Get detailed connection statistics
     */
    public Map<String, Object> getConnectionStats() {
        Map<String, Object> stats = new HashMap<>();
        
        int totalUsers, online = 0, away = 0, dnd = 0, offline = 0;
        
        if (redisTemplate != null) {
            try {
                Set<String> presenceKeys = redisTemplate.keys("presence:*");
                totalUsers = presenceKeys != null ? presenceKeys.size() : 0;
                
                if (presenceKeys != null) {
                    for (String key : presenceKeys) {
                        Object status = redisTemplate.opsForValue().get(key);
                        String statusStr = status != null ? status.toString() : "OFFLINE";
                        
                        switch (statusStr) {
                            case "ONLINE": online++; break;
                            case "AWAY": away++; break;
                            case "DO_NOT_DISTURB": dnd++; break;
                            default: offline++; break;
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Redis unavailable for getConnectionStats: {}", e.getMessage());
                // Fallback to in-memory
                synchronized (memoryPresence) {
                    totalUsers = memoryPresence.size();
                    for (String status : memoryPresence.values()) {
                        switch (status) {
                            case "ONLINE": online++; break;
                            case "AWAY": away++; break;
                            case "DO_NOT_DISTURB": dnd++; break;
                            default: offline++; break;
                        }
                    }
                }
            }
        } else {
            // In-memory only
            synchronized (memoryPresence) {
                totalUsers = memoryPresence.size();
                for (String status : memoryPresence.values()) {
                    switch (status) {
                        case "ONLINE": online++; break;
                        case "AWAY": away++; break;
                        case "DO_NOT_DISTURB": dnd++; break;
                        default: offline++; break;
                    }
                }
            }
        }
        
        stats.put("totalUsers", totalUsers);
        stats.put("online", online);
        stats.put("away", away);
        stats.put("doNotDisturb", dnd);
        stats.put("offline", offline);
        stats.put("timestamp", System.currentTimeMillis());
        
        return stats;
    }

    // ============ Private Methods ============

    private void broadcastPresence(String username, String status) {
        Map<String, Object> presence = new HashMap<>();
        presence.put("type", "presence_update");
        presence.put("username", username);
        presence.put("status", status);
        presence.put("timestamp", System.currentTimeMillis());
        
        messagingTemplate.convertAndSend("/topic/user/presence", presence);
    }

    // ============ Ping/Pong for Latency Measurement ============

    /**
     * Send ping to measure latency
     */
    public void sendPing(String username) {
        if (redisTemplate != null) {
            try {
                String pingKey = "ping:" + username + ":" + System.currentTimeMillis();
                redisTemplate.opsForValue().set(pingKey, "pong", 10, TimeUnit.SECONDS);
            } catch (Exception e) {
                log.warn("Redis unavailable for sendPing: {}", e.getMessage());
            }
        }
        
        Map<String, Object> ping = new HashMap<>();
        ping.put("type", "ping");
        ping.put("timestamp", System.currentTimeMillis());
        
        messagingTemplate.convertAndSend("/user/" + username + "/queue/ping", ping);
    }
}
