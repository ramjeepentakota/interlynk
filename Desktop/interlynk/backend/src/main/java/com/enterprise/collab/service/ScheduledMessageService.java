package com.enterprise.collab.service;

import com.enterprise.collab.dto.ChatDto;
import com.enterprise.collab.entity.Channel;
import com.enterprise.collab.entity.ScheduledMessage;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ForbiddenException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.ChannelRepository;
import com.enterprise.collab.repository.ScheduledMessageRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

/**
 * Queue + dispatcher for messages the user wants to send later
 * ("schedule for 9am Monday"). Every 30 seconds, a polling tick wakes up,
 * grabs any PENDING rows whose dispatchAt has passed, and delivers them
 * through the normal ChatService.sendMessage path so all the usual hooks
 * (audit, mentions, websocket broadcast) fire.
 *
 * Polling rather than scheduled tasks: ScheduledMessage rows are user data
 * and need to survive restarts. Java's ScheduledExecutorService wouldn't.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduledMessageService {

    private final ScheduledMessageRepository repository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;
    private final ChatService chatService;

    @Transactional
    public ScheduledMessage schedule(Long channelId, String content, LocalDateTime dispatchAt, String username) {
        if (dispatchAt == null || dispatchAt.isBefore(LocalDateTime.now().plusSeconds(30))) {
            throw new BadRequestException("dispatchAt must be at least 30 seconds in the future");
        }
        if (content == null || content.isBlank()) {
            throw new BadRequestException("content is required");
        }
        if (content.length() > 10000) {
            throw new BadRequestException("content exceeds 10000 characters");
        }

        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));

        if (!channel.getMembers().contains(sender) && !sender.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }

        ScheduledMessage sm = ScheduledMessage.builder()
                .channel(channel)
                .sender(sender)
                .content(content)
                .dispatchAt(dispatchAt)
                .status(ScheduledMessage.Status.PENDING)
                .build();

        return repository.save(sm);
    }

    @Transactional
    public void cancel(Long id, String username) {
        ScheduledMessage sm = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ScheduledMessage", "id", id));
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        if (!sm.getSender().getId().equals(user.getId()) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("Cannot cancel another user's scheduled message");
        }
        if (sm.getStatus() != ScheduledMessage.Status.PENDING) {
            throw new BadRequestException("Only PENDING messages can be cancelled");
        }
        sm.setStatus(ScheduledMessage.Status.CANCELLED);
        repository.save(sm);
    }

    public List<ScheduledMessage> listForUser(String username) {
        return userRepository.findByUsername(username)
                .map(u -> repository.findBySenderIdOrderByDispatchAtAsc(u.getId()))
                .orElse(Collections.emptyList());
    }

    /**
     * Tick every 30s. Each due row is dispatched in its own transaction so a
     * single bad row can't poison the batch.
     */
    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    public void dispatchTick() {
        List<ScheduledMessage> due;
        try {
            due = repository.findDue(LocalDateTime.now());
        } catch (Exception e) {
            log.warn("scheduled-message poll failed: {}", e.getMessage());
            return;
        }
        for (ScheduledMessage sm : due) {
            dispatchOne(sm.getId());
        }
    }

    @Transactional
    public void dispatchOne(Long id) {
        ScheduledMessage sm = repository.findById(id).orElse(null);
        if (sm == null || sm.getStatus() != ScheduledMessage.Status.PENDING) return;
        try {
            ChatDto.MessageResponse delivered = chatService.sendMessage(
                    sm.getChannel().getId(),
                    sm.getContent(),
                    sm.getSender().getUsername(),
                    Collections.emptyList());
            sm.setStatus(ScheduledMessage.Status.SENT);
            sm.setDeliveredMessageId(delivered.getId());
            sm.setLastError(null);
            repository.save(sm);
        } catch (Exception e) {
            log.warn("scheduled-message dispatch failed id={}: {}", id, e.getMessage());
            sm.setStatus(ScheduledMessage.Status.FAILED);
            String err = e.getMessage();
            if (err != null && err.length() > 500) err = err.substring(0, 500);
            sm.setLastError(err);
            repository.save(sm);
        }
    }
}
