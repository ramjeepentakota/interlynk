package com.enterprise.collab.repository;

import com.enterprise.collab.entity.DirectMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DirectMessageRepository extends JpaRepository<DirectMessage, Long> {
    List<DirectMessage> findBySenderIdOrReceiverIdOrderByCreatedAtDesc(Long senderId, Long receiverId);
    
    @Query("SELECT dm FROM DirectMessage dm WHERE (dm.sender.id = :user1 AND dm.receiver.id = :user2) OR (dm.sender.id = :user2 AND dm.receiver.id = :user1) ORDER BY dm.createdAt DESC")
    Page<DirectMessage> findConversation(Long user1, Long user2, Pageable pageable);
    
    Long countByReceiverIdAndIsReadFalse(Long receiverId);
}
