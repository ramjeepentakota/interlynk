package com.enterprise.collab.repository;

import com.enterprise.collab.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface WorkspaceRepository extends JpaRepository<Workspace, Long> {
    List<Workspace> findByUserId(Long userId);
    List<Workspace> findByRepositoryId(Long repoId);
    Optional<Workspace> findByUserIdAndRepositoryId(Long userId, Long repoId);
    Optional<Workspace> findByPath(String path);
}
