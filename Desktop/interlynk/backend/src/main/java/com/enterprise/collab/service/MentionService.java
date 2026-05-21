package com.enterprise.collab.service;

import com.enterprise.collab.entity.Channel;
import com.enterprise.collab.entity.Message;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses @mentions from message bodies and fans out a notification to each
 * mentioned user that is also a member of the channel. Two synthetic mention
 * tokens are supported:
 *
 *   @here     → every currently-presence==ONLINE member of the channel
 *   @channel  → every member of the channel
 *
 * Why: messages already worked end-to-end but mentions were the missing
 * "you have new activity" hook that drives engagement. Notification entity
 * already existed; we just connect message-send to it.
 *
 * Mention syntax allows letters, digits, dot, underscore, dash. We deliberately
 * do not require word boundaries on the right side so "@john!" still resolves.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MentionService {

    private static final Pattern MENTION = Pattern.compile("(?<![A-Za-z0-9_])@([A-Za-z0-9._-]{2,40})");

    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public Set<User> extractMentionedUsers(String content, Channel channel) {
        if (content == null || content.isEmpty() || channel == null) return Collections.emptySet();

        Set<User> mentioned = new LinkedHashSet<>();
        Matcher m = MENTION.matcher(content);
        while (m.find()) {
            String token = m.group(1);
            if ("channel".equalsIgnoreCase(token) || "all".equalsIgnoreCase(token)) {
                mentioned.addAll(channel.getMembers());
            } else if ("here".equalsIgnoreCase(token)) {
                for (User u : channel.getMembers()) {
                    if (u.getPresence() != null && u.getPresence() == User.Presence.ONLINE) {
                        mentioned.add(u);
                    }
                }
            } else {
                userRepository.findByUsername(token).ifPresent(u -> {
                    // Only notify if the user is actually a member of this channel.
                    if (channel.getMembers().contains(u)) mentioned.add(u);
                });
            }
        }
        return mentioned;
    }

    /**
     * Notify the parent message's author that someone replied in their thread.
     * No-op if the reply is from the author themselves or has no parent.
     */
    public void notifyThreadReply(Message reply) {
        try {
            Message parent = reply.getParent();
            if (parent == null || parent.getSender() == null) return;
            if (parent.getSender().getId().equals(reply.getSender().getId())) return;

            String channelName = reply.getChannel().getName();
            String senderName = reply.getSender().getDisplayName() != null
                    ? reply.getSender().getDisplayName()
                    : reply.getSender().getUsername();
            String snippet = reply.getContent();
            if (snippet != null && snippet.length() > 140) snippet = snippet.substring(0, 137) + "...";

            notificationService.createNotification(
                    parent.getSender().getId(),
                    "THREAD_REPLY",
                    senderName + " replied to your message in #" + channelName,
                    snippet,
                    "/channels/" + reply.getChannel().getId() + "?thread=" + parent.getId()
            );
        } catch (Exception e) {
            log.warn("thread-reply notify failed for message {}: {}", reply.getId(), e.getMessage());
        }
    }

    public void notifyMentions(Message message) {
        try {
            Set<User> targets = extractMentionedUsers(message.getContent(), message.getChannel());
            if (targets.isEmpty()) return;

            String channelName = message.getChannel().getName();
            String senderName = message.getSender().getDisplayName() != null
                    ? message.getSender().getDisplayName()
                    : message.getSender().getUsername();

            String snippet = message.getContent();
            if (snippet.length() > 140) snippet = snippet.substring(0, 137) + "...";

            for (User target : targets) {
                if (target.getId().equals(message.getSender().getId())) continue; // self-mentions are no-ops
                notificationService.createNotification(
                        target.getId(),
                        "MENTION",
                        senderName + " mentioned you in #" + channelName,
                        snippet,
                        "/channels/" + message.getChannel().getId() + "?message=" + message.getId()
                );
            }
        } catch (Exception e) {
            // Mentions are a quality-of-life feature — never block a send.
            log.warn("mention fan-out failed for message {}: {}", message.getId(), e.getMessage());
        }
    }
}
