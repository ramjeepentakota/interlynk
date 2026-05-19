package com.enterprise.collab.service;

import com.enterprise.collab.entity.*;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class WorkspaceService {
    
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceFileRepository workspaceFileRepository;
    private final CodeRepositoryRepository codeRepositoryRepository;
    private final UserRepository userRepository;
    
    @Value("${app.storage.workspaces-path}")
    private String workspacesBasePath;
    
    @Transactional
    public Workspace createWorkspace(Long userId, Long repositoryId, String branch) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        CodeRepository repository = codeRepositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new RuntimeException("Repository not found"));
        
        // Check if workspace already exists
        Optional<Workspace> existing = workspaceRepository.findByUserIdAndRepositoryId(userId, repositoryId);
        if (existing.isPresent()) {
            return existing.get();
        }
        
        // Create workspace directory
        String workspacePath = workspacesBasePath + "/" + userId + "/" + repositoryId + "-" + UUID.randomUUID();
        try {
            Files.createDirectories(Paths.get(workspacePath));
        } catch (IOException e) {
            throw new RuntimeException("Failed to create workspace directory", e);
        }
        
        // Create workspace entity
        Workspace workspace = Workspace.builder()
                .user(user)
                .repository(repository)
                .path(workspacePath)
                .branch(branch != null ? branch : "main")
                .status(Workspace.WorkspaceStatus.ACTIVE)
                .build();
        
        return workspaceRepository.save(workspace);
    }
    
    public List<Workspace> getUserWorkspaces(Long userId) {
        return workspaceRepository.findByUserId(userId);
    }
    
    public Optional<Workspace> getWorkspace(Long workspaceId) {
        return workspaceRepository.findById(workspaceId);
    }
    
    public Workspace getWorkspaceForUser(Long workspaceId, Long userId) {
        return workspaceRepository.findById(workspaceId)
                .filter(w -> w.getUser().getId().equals(userId))
                .orElseThrow(() -> new RuntimeException("Workspace not found or access denied"));
    }
    
    @Transactional
    public WorkspaceFile saveFile(Long workspaceId, String filePath, String content, Long userId) {
        Workspace workspace = getWorkspaceForUser(workspaceId, userId);
        
        Optional<WorkspaceFile> existing = workspaceFileRepository.findByWorkspaceIdAndFilePath(workspaceId, filePath);
        
        WorkspaceFile workspaceFile;
        if (existing.isPresent()) {
            workspaceFile = existing.get();
            workspaceFile.setContent(content);
        } else {
            workspaceFile = WorkspaceFile.builder()
                    .workspace(workspace)
                    .filePath(filePath)
                    .content(content)
                    .build();
        }
        
        // Also save to filesystem
        try {
            Path fullPath = Paths.get(workspace.getPath(), filePath);
            Files.createDirectories(fullPath.getParent());
            Files.write(fullPath, content.getBytes());
        } catch (IOException e) {
            log.error("Failed to write file to filesystem", e);
        }
        
        return workspaceFileRepository.save(workspaceFile);
    }
    
    public List<WorkspaceFile> getWorkspaceFiles(Long workspaceId, Long userId) {
        Workspace workspace = getWorkspaceForUser(workspaceId, userId);
        return workspaceFileRepository.findByWorkspaceId(workspaceId);
    }
    
    public Optional<WorkspaceFile> getWorkspaceFile(Long workspaceId, String filePath, Long userId) {
        getWorkspaceForUser(workspaceId, userId);
        return workspaceFileRepository.findByWorkspaceIdAndFilePath(workspaceId, filePath);
    }
    
    @Transactional
    public void deleteWorkspace(Long workspaceId, Long userId) {
        Workspace workspace = getWorkspaceForUser(workspaceId, userId);
        
        // Delete workspace directory
        try {
            Path workspacePath = Paths.get(workspace.getPath());
            if (Files.exists(workspacePath)) {
                Files.walk(workspacePath)
                        .sorted((a, b) -> b.compareTo(a))
                        .forEach(path -> {
                            try {
                                Files.delete(path);
                            } catch (IOException e) {
                                log.error("Failed to delete file: {}", path);
                            }
                        });
            }
        } catch (IOException e) {
            log.error("Failed to delete workspace directory", e);
        }
        
        workspace.setStatus(Workspace.WorkspaceStatus.CLOSED);
        workspaceRepository.save(workspace);
    }
}
