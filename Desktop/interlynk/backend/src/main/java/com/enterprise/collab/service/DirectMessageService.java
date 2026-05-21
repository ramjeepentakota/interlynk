package com.enterprise.collab.service;

import com.enterprise.collab.dto.ChatDto;
import com.enterprise.collab.entity.DirectMessage;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.DirectMessageRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Person-to-person direct messaging ("inbox"). Conversations are derived from
 * the {@link DirectMessage} table; there is no separate conversation entity.
 *
 * Realtime: each persisted message is pushed to BOTH participants' private
 * STOMP queue ({@code /user/queue/dm}) so open clients update instantly. The
 * queue is routed by login username (the WebSocket principal name set by
 * {@code WebSocketAuthInterceptor}).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DirectMessageService {

    private final DirectMessageRepository directMessageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /** Page size cap when loading a single conversation thread. */
    private static final int CONVERSATION_PAGE_SIZE = 200;

    @Transactional
    public ChatDto.DirectMessageResponse sendMessage(String senderUsername, Long recipientId, String content) {
        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", senderUsername));
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", recipientId));

        if (sender.getId().equals(recipient.getId())) {
            throw new BadRequestException("You cannot send a direct message to yourself");
        }
        if (content == null || content.trim().isEmpty()) {
            throw new BadRequestException("Message content is required");
        }

        DirectMessage dm = DirectMessage.builder()
                .sender(sender)
                .receiver(recipient)
                .content(content.trim())
                .isRead(false)
                .build();
        dm = directMessageRepository.save(dm);

        ChatDto.DirectMessageResponse response = mapToResponse(dm);

        // Deliver to recipient and echo to sender (multi-device support).
        messagingTemplate.convertAndSendToUser(recipient.getUsername(), "/queue/dm", response);
        messagingTemplate.convertAndSendToUser(sender.getUsername(), "/queue/dm", response);

        log.info("Direct message {} sent from {} to {}", dm.getId(), senderUsername, recipient.getUsername());
        return response;
    }

    /** One row per other-party, newest conversation first, with unread counts. */
    @Transactional(readOnly = true)
    public List<ChatDto.ConversationResponse> getConversations(String username) {
        User me = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        // Newest-first across every message I sent or received.
        List<DirectMessage> all = directMessageRepository
                .findBySenderIdOrReceiverIdOrderByCreatedAtDesc(me.getId(), me.getId());

        Map<Long, ChatDto.ConversationResponse> byOther = new LinkedHashMap<>();
        for (DirectMessage dm : all) {
            User other = dm.getSender().getId().equals(me.getId()) ? dm.getReceiver() : dm.getSender();
            Long otherId = other.getId();

            ChatDto.ConversationResponse convo = byOther.get(otherId);
            if (convo == null) {
                // First (newest) message with this person becomes the preview.
                convo = ChatDto.ConversationResponse.builder()
                        .oderId(otherId)
                        .otherUser(mapUser(other))
                        .lastMessageContent(dm.getContent())
                        .lastMessageTime(dm.getCreatedAt())
                        .unreadCount(0)
                        .build();
                byOther.put(otherId, convo);
            }
            boolean unreadForMe = dm.getReceiver().getId().equals(me.getId())
                    && Boolean.FALSE.equals(dm.getIsRead());
            if (unreadForMe) {
                convo.setUnreadCount(convo.getUnreadCount() + 1);
            }
        }
        return new ArrayList<>(byOther.values());
    }

    /**
     * Returns the full thread with {@code otherUserId} oldest-first and marks any
     * messages addressed to the caller as read.
     */
    @Transactional
    public List<ChatDto.DirectMessageResponse> getConversation(String username, Long otherUserId) {
        User me = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        userRepository.findById(otherUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", otherUserId));

        Page<DirectMessage> page = directMessageRepository.findConversation(
                me.getId(), otherUserId, PageRequest.of(0, CONVERSATION_PAGE_SIZE));

        List<DirectMessage> messages = new ArrayList<>(page.getContent());
        Collections.reverse(messages); // query is DESC; UI wants oldest-first

        List<DirectMessage> toMarkRead = new ArrayList<>();
        for (DirectMessage dm : messages) {
            if (dm.getReceiver().getId().equals(me.getId()) && Boolean.FALSE.equals(dm.getIsRead())) {
                dm.setIsRead(true);
                toMarkRead.add(dm);
            }
        }
        if (!toMarkRead.isEmpty()) {
            directMessageRepository.saveAll(toMarkRead);
        }

        return messages.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Transactional
    public void markConversationRead(String username, Long otherUserId) {
        getConversation(username, otherUserId);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(String username) {
        User me = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        Long count = directMessageRepository.countByReceiverIdAndIsReadFalse(me.getId());
        return count == null ? 0L : count;
    }

    // ── Mapping ──────────────────────────────────────────────

    private ChatDto.DirectMessageResponse mapToResponse(DirectMessage dm) {
        return ChatDto.DirectMessageResponse.builder()
                .id(dm.getId())
                .content(dm.getContent())
                .messageType("TEXT")
                .isEdited(false)
                .createdAt(dm.getCreatedAt())
                .updatedAt(dm.getCreatedAt())
                .sender(mapUser(dm.getSender()))
                .recipient(mapUser(dm.getReceiver()))
                .isRead(Boolean.TRUE.equals(dm.getIsRead()))
                .build();
    }

    private ChatDto.UserDto mapUser(User user) {
        return ChatDto.UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus() != null ? user.getStatus().name() : null)
                .presence(user.getPresence() != null ? user.getPresence().name() : null)
                .build();
    }
}
