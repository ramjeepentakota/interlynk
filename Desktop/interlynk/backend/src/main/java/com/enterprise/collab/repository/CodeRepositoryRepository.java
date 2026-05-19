package com.enterprise.collab.repository;

import com.enterprise.collab.entity.CodeRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CodeRepositoryRepository extends JpaRepository<CodeRepository, Long> {
    Optional<CodeRepository> findByName(String name);
    Optional<CodeRepository> findByPath(String path);
    List<CodeRepository> findByTeamId(Long teamId);
    List<CodeRepository> findByCreatedById(Long userId);
    
    @Query("SELECT r FROM CodeRepository r LEFT JOIN r.members m WHERE r.isPublic = true OR m.id = :userId")
    List<CodeRepository> findAccessibleByUserId(Long userId);
}
