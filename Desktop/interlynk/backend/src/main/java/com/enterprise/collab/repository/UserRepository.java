package com.enterprise.collab.repository;

import com.enterprise.collab.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    Optional<User> findByUsername(String username);
    
    Optional<User> findByEmail(String email);
    
    boolean existsByUsername(String username);
    
    boolean existsByEmail(String email);
    
    List<User> findByStatus(User.UserStatus status);
    
    Page<User> findByStatus(User.UserStatus status, Pageable pageable);
    
    @Query("SELECT u FROM User u WHERE u.presence = 'ONLINE'")
    List<User> findOnlineUsers();
    
    @Query("SELECT u FROM User u WHERE u.username LIKE %:query% OR u.displayName LIKE %:query%")
    List<User> searchUsers(String query);
    
    @Query("SELECT u FROM User u WHERE LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(u.displayName) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<User> searchUsersByUsernameOrDisplayName(String query);
    
    @Query("SELECT COUNT(u) FROM User u WHERE u.status = 'ACTIVE'")
    long countActiveUsers();
    
    @Query("SELECT u FROM User u WHERE u.status = :status AND u.presence = :presence")
    List<User> findByStatusAndPresence(User.UserStatus status, User.Presence presence);

    // ── Admin directory: combined search + filters + pagination ──────────
    @Query("SELECT u FROM User u WHERE " +
           "(:q IS NULL OR LOWER(u.username) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "  OR LOWER(u.displayName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "  OR LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "AND (:status IS NULL OR u.status = :status) " +
           "AND (:guest IS NULL OR u.guest = :guest) " +
           "AND (:department IS NULL OR LOWER(u.department) = LOWER(:department))")
    Page<User> adminSearch(@Param("q") String q,
                           @Param("status") User.UserStatus status,
                           @Param("guest") Boolean guest,
                           @Param("department") String department,
                           Pageable pageable);

    long countByStatus(User.UserStatus status);

    long countByGuestTrue();

    long countByCreatedAtAfter(LocalDateTime since);

    @Query("SELECT DISTINCT u.department FROM User u WHERE u.department IS NOT NULL AND u.department <> '' ORDER BY u.department")
    List<String> findDistinctDepartments();
}
