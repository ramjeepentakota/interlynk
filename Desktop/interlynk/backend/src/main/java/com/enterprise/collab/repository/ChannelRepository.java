package com.enterprise.collab.repository;

import com.enterprise.collab.entity.Channel;
import com.enterprise.collab.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChannelRepository extends JpaRepository<Channel, Long> {
    
    List<Channel> findByMembersContaining(User user);
    
    List<Channel> findByTeamId(Long teamId);
    
    List<Channel> findByType(Channel.ChannelType type);
    
    List<Channel> findByTeamIdAndIsActiveTrue(Long teamId);
    
    List<Channel> findByTeamIdAndType(Long teamId, Channel.ChannelType type);
    
    List<Channel> findByTeamIdOrderByPositionAsc(Long teamId);
    
    Optional<Channel> findByNameAndTeamId(String name, Long teamId);
    
    @Query("SELECT c FROM Channel c WHERE c.team.id = :teamId AND c.type = 'TEXT' AND c.isActive = true ORDER BY c.position ASC")
    List<Channel> findTextChannelsByTeamId(@Param("teamId") Long teamId);
    
    @Query("SELECT c FROM Channel c WHERE c.team.id = :teamId AND c.type = 'VOICE' AND c.isActive = true ORDER BY c.position ASC")
    List<Channel> findVoiceChannelsByTeamId(@Param("teamId") Long teamId);
    
    @Query("SELECT c FROM Channel c WHERE c.isActive = true ORDER BY c.category ASC, c.position ASC")
    List<Channel> findAllActiveChannels();
    
    @Query("SELECT DISTINCT c.category FROM Channel c WHERE c.category IS NOT NULL ORDER BY c.category ASC")
    List<String> findAllCategories();
    
    @Query("SELECT c FROM Channel c WHERE c.team.id = :teamId AND c.category = :category ORDER BY c.position ASC")
    List<Channel> findByTeamIdAndCategory(@Param("teamId") Long teamId, @Param("category") String category);
    
    boolean existsByNameAndTeamId(String name, Long teamId);
    
    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM Channel c WHERE c.name = :name AND c.team IS NULL")
    boolean existsByNameAndNoTeam(@Param("name") String name);
    
    // ============ Security-aware queries (DB-level access control) ============
    
    /**
     * Get all channels a specific user is a member of - DB level security
     */
    @Query("SELECT c FROM Channel c JOIN c.members m WHERE m.id = :userId AND c.isActive = true ORDER BY c.position ASC")
    List<Channel> findChannelsForUser(@Param("userId") Long userId);
    
    /**
     * Check if user is a member of a specific channel - DB level security check
     */
    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM Channel c " +
           "JOIN c.members m WHERE c.id = :channelId AND m.id = :userId")
    boolean isUserMember(@Param("channelId") Long channelId, @Param("userId") Long userId);
    
    /**
     * Get channel with member verification - returns null if user is not a member
     */
    @Query("SELECT c FROM Channel c JOIN c.members m WHERE c.id = :channelId AND m.id = :userId")
    Optional<Channel> findChannelForUser(@Param("channelId") Long channelId, @Param("userId") Long userId);

    // ── Admin Module 2 search ─────────────────────────────────
    @Query("SELECT c FROM Channel c WHERE " +
           "(:q IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "  OR LOWER(c.description) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "AND (:teamId IS NULL OR c.team.id = :teamId) " +
           "AND (:archived IS NULL OR c.archived = :archived) " +
           "AND (:type IS NULL OR c.type = :type) " +
           "AND (:visibility IS NULL OR c.visibility = :visibility)")
    org.springframework.data.domain.Page<Channel> adminSearch(
            @Param("q") String q,
            @Param("teamId") Long teamId,
            @Param("archived") Boolean archived,
            @Param("type") Channel.ChannelType type,
            @Param("visibility") Channel.Visibility visibility,
            org.springframework.data.domain.Pageable pageable);

    long countByArchivedTrue();
    long countByVisibility(Channel.Visibility visibility);
}
