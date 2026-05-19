package com.enterprise.collab.repository;

import com.enterprise.collab.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    
    Page<Message> findByChannelIdOrderByCreatedAtAsc(Long channelId, Pageable pageable);
    
    Page<Message> findByChannelId(Long channelId, Pageable pageable);
    
    List<Message> findByParentId(Long parentId);
    
    List<Message> findByParentIdOrderByCreatedAtAsc(Long parentId);
    
    @Query("SELECT m FROM Message m WHERE m.sender.id = :userId ORDER BY m.createdAt DESC")
    List<Message> findBySenderId(Long userId);
    
    @Query("SELECT COUNT(m) FROM Message m WHERE m.channel.id = :channelId")
    long countByChannelId(Long channelId);
    
    @Query("SELECT m FROM Message m WHERE m.channel.id = :channelId AND m.parent IS NULL ORDER BY m.createdAt DESC")
    Page<Message> findRootMessagesByChannelId(Long channelId, Pageable pageable);
    
    @Query("SELECT m FROM Message m WHERE m.content LIKE %:query% AND m.channel.id = :channelId")
    List<Message> searchMessages(Long channelId, String query);
    
    // ============ Security-aware queries (DB-level access control) ============
    
    /**
     * Check if a user is a member of a channel - DB level security check
     */
    @Query("SELECT CASE WHEN COUNT(cm) > 0 THEN true ELSE false END FROM Channel c " +
           "JOIN c.members cm WHERE c.id = :channelId AND cm.id = :userId")
    boolean isUserMemberOfChannel(Long channelId, Long userId);
    
    /**
     * Get messages only from channels where user is a member - DB level security
     */
    @Query("SELECT m FROM Message m JOIN m.channel c JOIN c.members cm " +
           "WHERE cm.id = :userId AND m.channel.id = :channelId ORDER BY m.createdAt DESC")
    Page<Message> findMessagesByChannelIdForUser(Long channelId, Long userId, Pageable pageable);
    
    /**
     * Get all messages for a user across all their channels - for audit purposes
     */
    @Query("SELECT m FROM Message m JOIN m.channel c JOIN c.members cm " +
           "WHERE cm.id = :userId ORDER BY m.createdAt DESC")
    List<Message> findAllMessagesForUser(Long userId);
}
