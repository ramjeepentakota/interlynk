package com.enterprise.collab.repository;

import com.enterprise.collab.entity.MessageReadReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Message Read Receipts
 */
@Repository
public interface MessageReadReceiptRepository extends JpaRepository<MessageReadReceipt, Long> {
    
    Optional<MessageReadReceipt> findByMessageIdAndUserId(Long messageId, Long userId);
    
    @Query("SELECT r FROM MessageReadReceipt r WHERE r.message.channel.id = :channelId AND r.user.id = :userId ORDER BY r.readAt DESC")
    List<MessageReadReceipt> findByChannelIdAndUserId(Long channelId, Long userId);
    
    @Query("SELECT COUNT(r) FROM MessageReadReceipt r WHERE r.message.channel.id = :channelId AND r.user.id = :userId AND r.message.createdAt > :since")
    long countUnreadSince(Long channelId, Long userId, java.time.LocalDateTime since);
    
    @Query("SELECT r.message.id FROM MessageReadReceipt r WHERE r.user.id = :userId AND r.message.channel.id = :channelId ORDER BY r.readAt DESC")
    List<Long> findReadMessageIdsByUserIdAndChannelId(Long userId, Long channelId);
}
