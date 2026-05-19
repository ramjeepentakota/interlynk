package com.enterprise.collab.repository;

import com.enterprise.collab.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    Page<Notification> findByUserId(Long userId, Pageable pageable);
    List<Notification> findByUserIdAndIsReadFalse(Long userId);
}
