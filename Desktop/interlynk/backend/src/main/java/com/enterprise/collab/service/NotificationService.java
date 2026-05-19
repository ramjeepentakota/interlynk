package com.enterprise.collab.service;

import com.enterprise.collab.entity.Notification;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.repository.NotificationRepository;
import com.enterprise.collab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {
    
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    
    @Transactional
    public Notification createNotification(Long userId, String type, String title, String content, String link) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Notification notification = Notification.builder()
                .user(user)
                .type(type)
                .title(title)
                .content(content)
                .link(link)
                .isRead(false)
                .build();
        
        notification = notificationRepository.save(notification);
        
        // Send real-time notification via WebSocket
        try {
            messagingTemplate.convertAndSendToUser(
                    user.getUsername(),
                    "/queue/notifications",
                    notification
            );
        } catch (Exception e) {
            log.error("Failed to send real-time notification", e);
        }
        
        return notification;
    }
    
    public List<Notification> getUserNotifications(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
    
    public Page<Notification> getUserNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserId(userId, pageable);
    }
    
    public List<Notification> getUnreadNotifications(Long userId) {
        return notificationRepository.findByUserIdAndIsReadFalse(userId);
    }
    
    @Transactional
    public Notification markAsRead(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        
        if (!notification.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        
        notification.setIsRead(true);
        return notificationRepository.save(notification);
    }
    
    @Transactional
    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndIsReadFalse(userId);
        for (Notification notification : unread) {
            notification.setIsRead(true);
            notificationRepository.save(notification);
        }
    }
    
    public Long getUnreadCount(Long userId) {
        return (long) notificationRepository.findByUserIdAndIsReadFalse(userId).size();
    }
}
