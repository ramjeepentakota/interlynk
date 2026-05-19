package com.enterprise.collab.repository;

import com.enterprise.collab.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
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
}
