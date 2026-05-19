package com.enterprise.collab.service;

import com.enterprise.collab.entity.Message;
import com.enterprise.collab.repository.MessageRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Offline Message Queue Service
 * Delivers queued messages to users when they come back online
 * Works with or without Redis
 */
@Service
@Slf4j
public class OfflineMessageQueueService {

    @Autowired(required = false)
    private RedisTemplate<String, Object> redisTemplate;
    
    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final ConnectionHealthService connectionHealthService;

    // In-memory fallback when Redis is not available
    private final Map<String, List<Map<String, Object>>> memoryQueue = new ConcurrentHashMap<>();

    private static final String OFFLINE_QUEUE_PREFIX = "offline:queue:";
    private static final int MAX_QUEUE_SIZE = 100;
    private static final int MAX_RETRY_ATTEMPTS = 3;

    public OfflineMessageQueueService(SimpMessagingTemplate messagingTemplate, 
                                       MessageRepository messageRepository,
                                       ConnectionHealthService connectionHealthService) {
        this.messagingTemplate = messagingTemplate;
        this.messageRepository = messageRepository;
        this.connectionHealthService = connectionHealthService;
    }

    /**
     * Queue a message for offline delivery
     */
    public void queueMessageForOfflineUser(Long userId, Message message) {
        if (redisTemplate != null) {
            try {
                String queueKey = OFFLINE_QUEUE_PREFIX + userId;
                
                // Check queue size
                Long queueSize = redisTemplate.opsForList().size(queueKey);
                if (queueSize != null && queueSize >= MAX_QUEUE_SIZE) {
                    log.warn("Offline queue full for user {}, dropping oldest message", userId);
                    redisTemplate.opsForList().rightPop(queueKey);
                }
                
                // Add to queue
                Map<String, Object> messageData = new HashMap<>();
                messageData.put("id", message.getId());
                messageData.put("content", message.getContent());
                messageData.put("senderId", message.getSender().getId());
                messageData.put("senderUsername", message.getSender().getUsername());
                messageData.put("channelId", message.getChannel().getId());
                messageData.put("createdAt", message.getCreatedAt().toString());
                messageData.put("queuedAt", LocalDateTime.now().toString());
                
                redisTemplate.opsForList().leftPush(queueKey, messageData);
                redisTemplate.expire(queueKey, 7, TimeUnit.DAYS);
                
                log.debug("Message {} queued for offline user {} (Redis)", message.getId(), userId);
                return;
            } catch (Exception e) {
                log.warn("Redis unavailable for queueMessageForOfflineUser: {}", e.getMessage());
            }
        }
        
        // Fallback to in-memory
        String queueKey = String.valueOf(userId);
        synchronized (memoryQueue) {
            List<Map<String, Object>> queue = memoryQueue.computeIfAbsent(queueKey, k -> new ArrayList<>());
            if (queue.size() >= MAX_QUEUE_SIZE) {
                queue.remove(0);
            }
            
            Map<String, Object> messageData = new HashMap<>();
            messageData.put("id", message.getId());
            messageData.put("content", message.getContent());
            messageData.put("senderId", message.getSender().getId());
            messageData.put("senderUsername", message.getSender().getUsername());
            messageData.put("channelId", message.getChannel().getId());
            messageData.put("createdAt", message.getCreatedAt().toString());
            messageData.put("queuedAt", LocalDateTime.now().toString());
            
            queue.add(messageData);
        }
        
        log.debug("Message {} queued for offline user {} (Memory)", message.getId(), userId);
    }

    /**
     * Deliver queued messages when user comes online
     */
    public void deliverQueuedMessages(String username) {
        List<Map<String, Object>> messages = new ArrayList<>();
        
        if (redisTemplate != null) {
            try {
                String queueKey = OFFLINE_QUEUE_PREFIX + username;
                Long queueSize = redisTemplate.opsForList().size(queueKey);
                
                if (queueSize == null || queueSize == 0) {
                    return;
                }
                
                log.info("Delivering {} queued messages to user {} (Redis)", queueSize, username);
                
                // Pop all messages from queue
                Object msg;
                while ((msg = redisTemplate.opsForList().rightPop(queueKey)) != null) {
                    if (msg instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> messageData = (Map<String, Object>) msg;
                        messages.add(messageData);
                    }
                }
            } catch (Exception e) {
                log.warn("Redis unavailable for deliverQueuedMessages: {}", e.getMessage());
            }
        }
        
        // Also check in-memory queue
        synchronized (memoryQueue) {
            List<Map<String, Object>> queue = memoryQueue.get(username);
            if (queue != null && !queue.isEmpty()) {
                messages.addAll(queue);
                queue.clear();
            }
        }
        
        if (messages.isEmpty()) {
            return;
        }
        
        // Reverse to maintain chronological order
        Collections.reverse(messages);
        
        // Deliver each message
        for (Map<String, Object> messageData : messages) {
            Map<String, Object> delivery = new HashMap<>();
            delivery.put("type", "offline_message");
            delivery.put("message", messageData);
            delivery.put("timestamp", System.currentTimeMillis());
            
            messagingTemplate.convertAndSend("/user/" + username + "/queue/messages", delivery);
        }
        
        log.info("Delivered {} offline messages to user {}", messages.size(), username);
    }

    /**
     * Get count of queued messages for a user
     */
    public long getQueuedMessageCount(String username) {
        if (redisTemplate != null) {
            try {
                String queueKey = OFFLINE_QUEUE_PREFIX + username;
                Long size = redisTemplate.opsForList().size(queueKey);
                return size != null ? size : 0;
            } catch (Exception e) {
                log.warn("Redis unavailable for getQueuedMessageCount: {}", e.getMessage());
            }
        }
        
        // Fallback to in-memory
        synchronized (memoryQueue) {
            List<Map<String, Object>> queue = memoryQueue.get(username);
            return queue != null ? queue.size() : 0;
        }
    }

    /**
     * Clear queued messages for a user
     */
    public void clearQueuedMessages(String username) {
        if (redisTemplate != null) {
            try {
                String queueKey = OFFLINE_QUEUE_PREFIX + username;
                redisTemplate.delete(queueKey);
            } catch (Exception e) {
                log.warn("Redis unavailable for clearQueuedMessages: {}", e.getMessage());
            }
        }
        
        // Also clear in-memory
        synchronized (memoryQueue) {
            memoryQueue.remove(username);
        }
        
        log.info("Cleared offline message queue for user {}", username);
    }

    // ============ Scheduled Tasks ============

    /**
     * Periodic cleanup of old queued messages - runs daily
     */
    @Scheduled(cron = "0 0 3 * * ?") // 3 AM daily
    public void cleanupOldQueuedMessages() {
        log.info("Running offline queue cleanup...");
        
        if (redisTemplate != null) {
            try {
                Set<String> keys = redisTemplate.keys(OFFLINE_QUEUE_PREFIX + "*");
                if (keys == null || keys.isEmpty()) {
                    return;
                }
                
                int cleaned = 0;
                for (String key : keys) {
                    Long size = redisTemplate.opsForList().size(key);
                    if (size != null && size > 0) {
                        // Check oldest message age
                        Object oldest = redisTemplate.opsForList().index(key, size - 1);
                        if (oldest instanceof Map) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> msg = (Map<String, Object>) oldest;
                            String queuedAt = (String) msg.get("queuedAt");
                            
                            if (queuedAt != null) {
                                LocalDateTime queuedTime = LocalDateTime.parse(queuedAt);
                                if (queuedTime.isBefore(LocalDateTime.now().minusDays(7))) {
                                    redisTemplate.delete(key);
                                    cleaned++;
                                }
                            }
                        }
                    }
                }
                
                log.info("Cleaned {} old offline queues (Redis)", cleaned);
                return;
            } catch (Exception e) {
                log.warn("Redis unavailable for cleanup: {}", e.getMessage());
            }
        }
        
        // In-memory cleanup
        synchronized (memoryQueue) {
            int cleaned = 0;
            LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
            
            Iterator<Map.Entry<String, List<Map<String, Object>>>> iterator = memoryQueue.entrySet().iterator();
            while (iterator.hasNext()) {
                Map.Entry<String, List<Map<String, Object>>> entry = iterator.next();
                List<Map<String, Object>> queue = entry.getValue();
                
                if (!queue.isEmpty()) {
                    Map<String, Object> oldest = queue.get(0);
                    String queuedAt = (String) oldest.get("queuedAt");
                    
                    if (queuedAt != null) {
                        LocalDateTime queuedTime = LocalDateTime.parse(queuedAt);
                        if (queuedTime.isBefore(sevenDaysAgo)) {
                            iterator.remove();
                            cleaned++;
                        }
                    }
                }
            }
            
            log.info("Cleaned {} old offline queues (Memory)", cleaned);
        }
    }

    /**
     * Retry delivery for failed messages - runs every minute
     */
    @Scheduled(fixedRate = 60000) // 1 minute
    public void retryFailedDeliveries() {
        if (redisTemplate != null) {
            try {
                Set<String> keys = redisTemplate.keys("offline:retry:*");
                if (keys == null || keys.isEmpty()) {
                    return;
                }
                
                for (String key : keys) {
                    String username = key.replace("offline:retry:", "");
                    
                    // Check if user is online now
                    if ("ONLINE".equals(connectionHealthService.getPresence(username))) {
                        // Move from retry queue back to main queue
                        List<Object> retryMessages = redisTemplate.opsForList().range(key, 0, -1);
                        if (retryMessages != null) {
                            String queueKey = OFFLINE_QUEUE_PREFIX + username;
                            for (Object msg : retryMessages) {
                                redisTemplate.opsForList().leftPush(queueKey, msg);
                            }
                            redisTemplate.delete(key);
                            
                            // Trigger delivery
                            deliverQueuedMessages(username);
                        }
                    }
                }
                
                return;
            } catch (Exception e) {
                log.warn("Redis unavailable for retry: {}", e.getMessage());
            }
        }
        
        // Without Redis, messages are delivered immediately when user comes online
        // so no retry needed
    }
}
