package com.enterprise.collab.repository;

import com.enterprise.collab.entity.UserBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for User Blocks
 */
@Repository
public interface UserBlockRepository extends JpaRepository<UserBlock, Long> {
    
    Optional<UserBlock> findByBlockerIdAndBlockedId(Long blockerId, Long blockedId);
    
    boolean existsByBlockerIdAndBlockedId(Long blockerId, Long blockedId);
    
    @Query("SELECT ub.blocked.id FROM UserBlock ub WHERE ub.blocker.id = :userId")
    List<Long> findBlockedUserIdsByBlockerId(Long userId);
    
    @Query("SELECT CASE WHEN COUNT(ub) > 0 THEN true ELSE false END FROM UserBlock ub " +
           "WHERE (ub.blocker.id = :userId1 AND ub.blocked.id = :userId2) " +
           "OR (ub.blocker.id = :userId2 AND ub.blocked.id = :userId1)")
    boolean areUsersBlocked(Long userId1, Long userId2);
}
