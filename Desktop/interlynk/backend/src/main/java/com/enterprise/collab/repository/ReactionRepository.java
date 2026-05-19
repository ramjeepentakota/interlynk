package com.enterprise.collab.repository;

import com.enterprise.collab.entity.Reaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReactionRepository extends JpaRepository<Reaction, Long> {
    
    Reaction findByMessageIdAndUserIdAndEmoji(Long messageId, Long userId, String emoji);
    
    List<Reaction> findByMessageId(Long messageId);
    
    void deleteByMessageIdAndUserIdAndEmoji(Long messageId, Long userId, String emoji);
    
    void deleteAllByMessageId(Long messageId);
}
