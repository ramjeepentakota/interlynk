package com.enterprise.collab.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

public class WorkspaceDto {
    
    // ============ Workspace DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateWorkspaceRequest {
        @NotNull(message = "Repository ID is required")
        private Long repositoryId;
        
        @Size(max = 100, message = "Branch name must not exceed 100 characters")
        private String branch;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class WorkspaceResponse {
        private Long id;
        private String name;
        private String path;
        private String branch;
        private String status;
        private Long repositoryId;
        private String repositoryName;
        private String ownerUsername;
        private LocalDateTime createdAt;
        private LocalDateTime lastAccessedAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class WorkspaceListResponse {
        private List<WorkspaceResponse> workspaces;
    }
    
    // ============ File DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SaveFileRequest {
        @NotBlank(message = "File path is required")
        private String filePath;
        
        @NotBlank(message = "File content is required")
        private String content;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FileResponse {
        private Long id;
        private String filePath;
        private String content;
        private String fileName;
        private String fileExtension;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FileListResponse {
        private List<FileResponse> files;
        private List<FolderResponse> folders;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FolderResponse {
        private String path;
        private String name;
        private int fileCount;
    }
    
    // ============ Repository DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateRepositoryRequest {
        @NotBlank(message = "Repository name is required")
        @Size(min = 2, max = 100, message = "Repository name must be between 2 and 100 characters")
        private String name;
        
        @Size(max = 500, message = "Description must not exceed 500 characters")
        private String description;
        
        private String visibility; // PUBLIC, PRIVATE
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RepositoryResponse {
        private Long id;
        private String name;
        private String description;
        private String visibility;
        private String ownerUsername;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private int branchCount;
        private int pullRequestCount;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RepositoryListResponse {
        private List<RepositoryResponse> repositories;
        private int totalCount;
    }
    
    // ============ Branch DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BranchResponse {
        private String name;
        private String lastCommitHash;
        private LocalDateTime lastCommitDate;
        private String lastCommitAuthor;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BranchListResponse {
        private List<BranchResponse> branches;
    }
    
    // ============ Response DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MessageResponse {
        private String message;
        private boolean success;
    }
}
