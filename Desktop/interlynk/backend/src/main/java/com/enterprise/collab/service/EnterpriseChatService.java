package com.enterprise.collab.service;

import com.enterprise.collab.dto.ChatDto;
import com.enterprise.collab.entity.*;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ConflictException;
import com.enterprise.collab.exception.ForbiddenException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.HashSet;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Enterprise Chat Service - Works with or without Redis
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EnterpriseChatService {

    private final ChannelRepository channelRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ReactionRepository reactionRepository;
    private final AttachmentRepository attachmentRepository;
    private final MessageReadReceiptRepository messageReadReceiptRepository;
    private final UserBlockRepository userBlockRepository;
    private final SimpMessagingTemplate messagingTemplate;
    
    @Autowired(required = false)
    private RedisTemplate<String, Object> redisTemplate;

    /**
     * Send a message with persistence guarantee
     */
    @Transactional
    public ChatDto.MessageResponse sendMessage(Long channelId, String content, String username, List<ChatDto.AttachmentDto> attachments) {
        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        if (!channel.getMembers().contains(sender)) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        // Rate limiting check (Redis optional)
        try {
            checkMessageRateLimit(sender.getId());
        } catch (Exception e) {
            log.warn("Rate limiting unavailable: {}", e.getMessage());
        }
        
        if (content != null && content.length() > 10000) {
            throw new BadRequestException("Message content exceeds maximum length of 10000 characters");
        }
        
        Message message = Message.builder()
                .channel(channel)
                .sender(sender)
                .content(content)
                .messageType(Message.MessageType.TEXT)
                .build();
        
        message = messageRepository.save(message);
        
        if (attachments != null && !attachments.isEmpty()) {
            for (ChatDto.AttachmentDto att : attachments) {
                Attachment attachment = Attachment.builder()
                        .message(message)
                        .fileName(att.getFileName())
                        .filePath(att.getFileUrl())
                        .fileSize(att.getFileSize())
                        .mimeType(att.getFileType())
                        .build();
                attachmentRepository.save(attachment);
            }
        }
        
        ChatDto.MessageResponse response = mapToMessageResponse(message);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, response);
        
        log.info("Message {} sent to channel {} by {}", message.getId(), channelId, username);
        
        return response;
    }

    /**
     * Get paginated messages from a channel
     */
    public ChatDto.MessageListResponse getMessages(Long channelId, String username, int page, int size) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        boolean isMember = channelRepository.isUserMember(channelId, user.getId());
        if (!isMember && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Message> messagePage = messageRepository.findByChannelId(channelId, pageable);
        
        List<Long> blockedUserIds = userBlockRepository.findBlockedUserIdsByBlockerId(user.getId());
        
        List<ChatDto.MessageResponse> messages = messagePage.getContent().stream()
                .filter(msg -> !blockedUserIds.contains(msg.getSender().getId()))
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
        
        Collections.reverse(messages);
        
        return ChatDto.MessageListResponse.builder()
                .messages(messages)
                .page(page)
                .size(size)
                .totalElements(messagePage.getTotalElements())
                .totalPages(messagePage.getTotalPages())
                .hasNext(messagePage.hasNext())
                .hasPrevious(messagePage.hasPrevious())
                .build();
    }



    /**
     * Mark messages as read
     */
    @Transactional
    public void markMessagesAsRead(Long channelId, Long messageId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        List<Message> messagesToMark = messageRepository.findByChannelId(
                channelId, 
                PageRequest.of(0, 1000, Sort.by(Sort.Direction.ASC, "createdAt")))
                .getContent();
        
        boolean markFromHere = false;
        for (Message msg : messagesToMark) {
            if (msg.getId().equals(messageId)) {
                markFromHere = true;
            }
            if (markFromHere) {
                if (!messageReadReceiptRepository.findByMessageIdAndUserId(msg.getId(), user.getId()).isPresent()) {
                    MessageReadReceipt receipt = MessageReadReceipt.builder()
                            .message(msg)
                            .user(user)
                            .build();
                    messageReadReceiptRepository.save(receipt);
                }
            }
        }
        
        Map<String, Object> readReceipt = new HashMap<>();
        readReceipt.put("type", "read_receipt");
        readReceipt.put("channelId", channelId);
        readReceipt.put("messageId", messageId);
        readReceipt.put("userId", user.getId());
        readReceipt.put("username", username);
        readReceipt.put("readAt", LocalDateTime.now().toString());
        
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, readReceipt);
    }

    /**
     * Get unread message count
     */
    public long getUnreadCount(Long channelId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        List<Long> readMessageIds = messageReadReceiptRepository
                .findReadMessageIdsByUserIdAndChannelId(user.getId(), channelId);
        
        return messageRepository.countByChannelId(channelId) - readMessageIds.size();
    }

    /**
     * Search messages
     */
    public List<ChatDto.MessageResponse> searchMessages(Long channelId, String query, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        boolean isMember = channelRepository.isUserMember(channelId, user.getId());
        if (!isMember && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        List<Message> messages = messageRepository.searchMessages(channelId, query);
        
        return messages.stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    /**
     * Block a user
     */
    @Transactional
    public void blockUser(String blockerUsername, String blockedUsername, String reason) {
        User blocker = userRepository.findByUsername(blockerUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", blockerUsername));
        
        User blocked = userRepository.findByUsername(blockedUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", blockedUsername));
        
        if (blocker.getId().equals(blocked.getId())) {
            throw new BadRequestException("You cannot block yourself");
        }
        
        if (userBlockRepository.existsByBlockerIdAndBlockedId(blocker.getId(), blocked.getId())) {
            throw new ConflictException("User is already blocked");
        }
        
        UserBlock block = UserBlock.builder()
                .blocker(blocker)
                .blocked(blocked)
                .reason(reason)
                .build();
        
        userBlockRepository.save(block);
        
        log.info("User {} blocked by {}", blockedUsername, blockerUsername);
    }

    /**
     * Unblock a user
     */
    @Transactional
    public void unblockUser(String blockerUsername, String blockedUsername) {
        User blocker = userRepository.findByUsername(blockerUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", blockerUsername));
        
        User blocked = userRepository.findByUsername(blockedUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", blockedUsername));
        
        UserBlock block = userBlockRepository.findByBlockerIdAndBlockedId(blocker.getId(), blocked.getId())
                .orElseThrow(() -> new BadRequestException("User is not blocked"));
        
        userBlockRepository.delete(block);
        
        log.info("User {} unblocked by {}", blockedUsername, blockerUsername);
    }

    /**
     * Get blocked users
     */
    public List<Long> getBlockedUserIds(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        return userBlockRepository.findBlockedUserIdsByBlockerId(user.getId());
    }

    /**
     * Update user presence
     */
    public void updatePresence(String username, String status) {
        if (redisTemplate != null) {
            try {
                String presenceKey = "presence:" + username;
                redisTemplate.opsForValue().set(presenceKey, status, 24, TimeUnit.HOURS);
            } catch (Exception e) {
                log.warn("Redis unavailable for presence: {}", e.getMessage());
            }
        }
        
        Map<String, Object> presence = new HashMap<>();
        presence.put("type", "presence_update");
        presence.put("username", username);
        presence.put("status", status);
        presence.put("timestamp", System.currentTimeMillis());
        
        messagingTemplate.convertAndSend("/topic/user/presence", presence);
    }

    /**
     * Send typing indicator
     */
    public void sendTypingIndicator(Long channelId, String username, boolean isTyping) {
        Map<String, Object> typing = new HashMap<>();
        typing.put("type", "typing");
        typing.put("channelId", channelId);
        typing.put("username", username);
        typing.put("isTyping", isTyping);
        typing.put("timestamp", System.currentTimeMillis());
        
        messagingTemplate.convertAndSend("/topic/channel/" + channelId + "/typing", typing);
    }
    
    /**
     * Get online users in a channel (Redis optional)
     */
    public java.util.Set<String> getOnlineUsersInChannel(Long channelId) {
        java.util.Set<String> onlineUsers = new java.util.HashSet<>();
        try {
            String key = "channel:" + channelId + ":online";
            java.util.Set<Object> members = redisTemplate.opsForSet().members(key);
            if (members != null) {
                for (Object member : members) {
                    onlineUsers.add(member.toString());
                }
            }
        } catch (Exception e) {
            log.warn("Could not get online users from Redis: {}", e.getMessage());
        }
        return onlineUsers;
    }

    /**
     * Rate limiting
     */
    private void checkMessageRateLimit(Long userId) {
        if (redisTemplate == null) {
            return; // Skip rate limiting if Redis is not available
        }
        
        try {
            String rateKey = "ratelimit:messages:" + userId;
            Long count = redisTemplate.opsForValue().increment(rateKey);
            
            if (count != null && count == 1) {
                redisTemplate.expire(rateKey, 60, TimeUnit.SECONDS);
            }
            
            if (count != null && count > 30) {
                throw new BadRequestException("Rate limit exceeded. Please wait before sending more messages.");
            }
        } catch (Exception e) {
            log.warn("Rate limiting unavailable: {}", e.getMessage());
        }
    }

    /**
     * Map message to response DTO
     */
    private ChatDto.MessageResponse mapToMessageResponse(Message message) {
        return ChatDto.MessageResponse.builder()
                .id(message.getId())
                .content(message.getContent())
                .messageType(message.getMessageType().name())
                .isEdited(message.getIsEdited())
                .isPinned(message.getIsPinned())
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .build();
    }
}
