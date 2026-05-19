package com.enterprise.collab.config;

import com.enterprise.collab.dto.ChatDto;
import com.enterprise.collab.entity.Channel;
import com.enterprise.collab.entity.Message;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.repository.ChannelRepository;
import com.enterprise.collab.repository.MessageRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

/**
 * WebSocket Message Handler for real-time messaging.
 * 
 * Handles:
 * - Channel messages (/app/chat/channel/{channelId})
 * - Typing indicators
 * - Message acknowledgments
 * - Presence updates
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class WebSocketMessageHandler {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;

    /**
     * Handle incoming chat messages via WebSocket
     * Broadcasts to all subscribers of /topic/channel/{channelId}
     */
    @MessageMapping("/chat/channel/{channelId}")
    @SendTo("/topic/channel/{channelId}")
    @Transactional
    public ChatDto.MessageResponse handleChannelMessage(
            @DestinationVariable Long channelId,
            Map<String, Object> request) {
        
        log.debug("Received WebSocket message for channel {}: {}", channelId, request.get("content"));
        
        String username = (String) request.get("username");
        String content = (String) request.get("content");
        
        // Validate user
        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));
        
        // Validate channel
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new IllegalArgumentException("Channel not found: " + channelId));
        
        // Check membership
        if (!channel.getMembers().contains(sender)) {
            throw new IllegalArgumentException("User is not a member of this channel");
        }
        
        // Save message to database (ensures persistence)
        Message message = Message.builder()
                .channel(channel)
                .sender(sender)
                .content(content)
                .messageType(Message.MessageType.TEXT)
                .build();
        
        message = messageRepository.save(message);
        
        log.info("WebSocket message saved to DB: {} for channel {}", message.getId(), channelId);
        
        // Return the saved message (will be broadcast to /topic/channel/{channelId})
        return mapToMessageResponse(message);
    }

    /**
     * Handle typing indicator events
     */
    @MessageMapping("/typing/channel/{channelId}")
    public void handleTypingIndicator(
            @DestinationVariable Long channelId,
            Map<String, Object> request) {
        
        log.debug("Typing indicator: {} in channel {}", request.get("username"), channelId);
        
        Map<String, Object> typing = new HashMap<>();
        typing.put("type", "typing");
        typing.put("username", request.get("username"));
        typing.put("isTyping", request.get("isTyping"));
        
        // Broadcast typing indicator to channel
        messagingTemplate.convertAndSend("/topic/channel/" + channelId + "/typing", typing);
    }

    /**
     * Handle message edit via WebSocket
     */
    @MessageMapping("/chat/message/{messageId}/edit")
    @SendTo("/topic/channel/{channelId}")
    public ChatDto.MessageResponse handleMessageEdit(
            Map<String, Object> request) {
        
        Long messageId = ((Number) request.get("messageId")).longValue();
        Long channelId = ((Number) request.get("channelId")).longValue();
        
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));
        
        // Verify ownership
        String username = (String) request.get("username");
        if (!message.getSender().getUsername().equals(username)) {
            throw new IllegalArgumentException("Cannot edit another user's message");
        }
        
        // Update message
        message.setContent((String) request.get("content"));
        message.setIsEdited(true);
        message = messageRepository.save(message);
        
        log.info("Message {} edited via WebSocket", messageId);
        
        return mapToMessageResponse(message);
    }

    /**
     * Handle message deletion via WebSocket
     */
    @MessageMapping("/chat/message/{messageId}/delete")
    public void handleMessageDelete(
            Map<String, Object> request) {
        
        Long messageId = ((Number) request.get("messageId")).longValue();
        
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));
        
        Long channelId = message.getChannel().getId();
        
        // Verify ownership or admin
        String username = (String) request.get("username");
        boolean isOwner = message.getSender().getUsername().equals(username);
        Boolean isAdmin = (Boolean) request.get("isAdmin");
        
        if (!isOwner && (isAdmin == null || !isAdmin)) {
            throw new IllegalArgumentException("Cannot delete another user's message");
        }
        
        // Delete message
        messageRepository.delete(message);
        
        log.info("Message {} deleted via WebSocket", messageId);
        
        // Broadcast deletion
        Map<String, Object> deleteMap = new HashMap<>();
        deleteMap.put("type", "message_deleted");
        deleteMap.put("messageId", messageId);
        
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, deleteMap);
    }

    private ChatDto.MessageResponse mapToMessageResponse(Message message) {
        return ChatDto.MessageResponse.builder()
                .id(message.getId())
                .content(message.getContent())
                .senderId(message.getSender().getId())
                .senderUsername(message.getSender().getUsername())
                .senderDisplayName(message.getSender().getDisplayName())
                .channelId(message.getChannel().getId())
                .messageType(message.getMessageType().name())
                .isEdited(message.getIsEdited())
                .isPinned(message.getIsPinned())
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .build();
    }
}
