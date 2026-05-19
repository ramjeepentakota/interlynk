package com.enterprise.collab.repository;

import com.enterprise.collab.entity.WorkspaceFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface WorkspaceFileRepository extends JpaRepository<WorkspaceFile, Long> {
    List<WorkspaceFile> findByWorkspaceId(Long workspaceId);
    Optional<WorkspaceFile> findByWorkspaceIdAndFilePath(Long workspaceId, String filePath);
}
