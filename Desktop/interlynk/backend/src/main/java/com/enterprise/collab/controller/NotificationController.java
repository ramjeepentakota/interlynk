package com.enterprise.collab.controller;

import com.enterprise.collab.entity.Notification;
import com.enterprise.collab.security.JwtTokenProvider;
import com.enterprise.collab.service.NotificationService;
import javax.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    
    private final NotificationService notificationService;
    private final JwtTokenProvider jwtTokenProvider;
    
    @GetMapping
    public ResponseEntity<List<Notification>> getNotifications(HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(notificationService.getUserNotifications(userId));
    }
    
    @GetMapping("/page")
    public ResponseEntity<Page<Notification>> getNotificationsPage(
            HttpServletRequest request,
            Pageable pageable) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(notificationService.getUserNotifications(userId, pageable));
    }
    
    @GetMapping("/unread")
    public ResponseEntity<List<Notification>> getUnreadNotifications(HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(notificationService.getUnreadNotifications(userId));
    }
    
    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        Map<String, Long> countMap = new HashMap<>();
        countMap.put("count", notificationService.getUnreadCount(userId));
        return ResponseEntity.ok(countMap);
    }
    
    @PostMapping("/{notificationId}/read")
    public ResponseEntity<Notification> markAsRead(
            @PathVariable Long notificationId,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(notificationService.markAsRead(notificationId, userId));
    }
    
    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead(HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }
    
    private Long getUserIdFromRequest(HttpServletRequest request) {
        String token = jwtTokenProvider.getTokenFromRequest(request);
        return jwtTokenProvider.getUserIdFromToken(token);
    }
}
