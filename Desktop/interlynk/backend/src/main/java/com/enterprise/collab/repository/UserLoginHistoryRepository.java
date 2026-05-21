package com.enterprise.collab.repository;

import com.enterprise.collab.entity.UserLoginHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface UserLoginHistoryRepository extends JpaRepository<UserLoginHistory, Long> {

    Page<UserLoginHistory> findByUserIdOrderByLoginAtDesc(Long userId, Pageable pageable);

    Page<UserLoginHistory> findAllByOrderByLoginAtDesc(Pageable pageable);

    long countByLoginAtAfter(LocalDateTime since);

    @Query("SELECT COUNT(h) FROM UserLoginHistory h WHERE h.success = false AND h.loginAt > :since")
    long countFailedSince(@Param("since") LocalDateTime since);
}
