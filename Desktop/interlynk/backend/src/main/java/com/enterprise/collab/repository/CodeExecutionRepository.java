package com.enterprise.collab.repository;

import com.enterprise.collab.entity.CodeExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodeExecutionRepository extends JpaRepository<CodeExecution, Long> {
    List<CodeExecution> findByWorkspaceId(Long workspaceId);
    List<CodeExecution> findByUserId(Long userId);
    List<CodeExecution> findByLanguage(String language);
    List<CodeExecution> findByUserIdOrderByExecutedAtDesc(Long userId);
}
