package com.enterprise.collab.service;

import com.enterprise.collab.entity.Channel;
import com.enterprise.collab.entity.Message;
import com.enterprise.collab.entity.MessageReadReceipt;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.exception.ForbiddenException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.ChannelRepository;
import com.enterprise.collab.repository.MessageReadReceiptRepository;
import com.enterprise.collab.repository.MessageRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Read receipts: when a user opens a channel and scrolls past a message, the
 * client calls markRead(channelId, lastSeenMessageId) once. We backfill receipts
 * for every message in that channel up to that id that the user has not read
 * yet, then broadcast a single delta event to the channel topic so other
 * members can render "seen by N" indicators in real time.
 *
 * Why: MessageReadReceipt was modeled but never written. Without it, mobile-
 * style "unread" badges and "seen by" UIs can't be built.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReadReceiptService {

    private final MessageReadReceiptRepository receiptRepository;
    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public ReadReceiptResult markChannelReadUpTo(Long channelId, Long lastMessageId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));

        if (!channel.getMembers().contains(user) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }

        Message marker = messageRepository.findById(lastMessageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", lastMessageId));
        if (!Objects.equals(marker.getChannel().getId(), channelId)) {
            throw new ForbiddenException("Message does not belong to this channel");
        }

        // Already-read message ids for this user in this channel.
        Set<Long> already = new HashSet<>(
                receiptRepository.findReadMessageIdsByUserIdAndChannelId(user.getId(), channelId));

        // Walk only the recent unread window (most recent 200 messages). For an
        // active channel this is the typical "catch-up" range; bigger gaps are
        // best served by re-pulling history client-side anyway.
        org.springframework.data.domain.Page<Message> page = messageRepository.findByChannelId(
                channelId, org.springframework.data.domain.PageRequest.of(0, 200,
                        org.springframework.data.domain.Sort.by(
                                org.springframework.data.domain.Sort.Direction.DESC, "createdAt")));

        List<Long> newlyRead = new ArrayList<>();
        for (Message m : page.getContent()) {
            if (m.getCreatedAt() == null || marker.getCreatedAt() == null) continue;
            if (m.getCreatedAt().isAfter(marker.getCreatedAt())) continue;
            if (already.contains(m.getId())) continue;
            if (m.getSender() != null && m.getSender().getId().equals(user.getId())) continue;

            MessageReadReceipt receipt = MessageReadReceipt.builder()
                    .message(m)
                    .user(user)
                    .build();
            receiptRepository.save(receipt);
            newlyRead.add(m.getId());
        }

        if (!newlyRead.isEmpty()) {
            Map<String, Object> event = new HashMap<>();
            event.put("type", "messages_read");
            event.put("channelId", channelId);
            event.put("userId", user.getId());
            event.put("username", user.getUsername());
            event.put("messageIds", newlyRead);
            messagingTemplate.convertAndSend("/topic/channel/" + channelId, event);
        }

        return new ReadReceiptResult(newlyRead.size(), newlyRead);
    }

    /** Lookup ids of messages in this channel the caller has read. */
    public List<Long> readMessageIds(Long channelId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        return receiptRepository.findReadMessageIdsByUserIdAndChannelId(user.getId(), channelId);
    }

    public static class ReadReceiptResult {
        public final int updated;
        public final List<Long> messageIds;
        public ReadReceiptResult(int updated, List<Long> messageIds) {
            this.updated = updated;
            this.messageIds = messageIds;
        }
    }
}
