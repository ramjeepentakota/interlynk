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

public class CodeReviewDto {
    
    // ============ Pull Request DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreatePullRequestRequest {
        @NotNull(message = "Workspace ID is required")
        private Long workspaceId;
        
        @NotNull(message = "Reviewer ID is required")
        private Long reviewerId;
        
        @NotBlank(message = "Title is required")
        @Size(max = 200, message = "Title must not exceed 200 characters")
        private String title;
        
        @Size(max = 5000, message = "Description must not exceed 5000 characters")
        private String description;
        
        @NotBlank(message = "Source branch is required")
        private String sourceBranch;
        
        @NotBlank(message = "Target branch is required")
        private String targetBranch;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PullRequestResponse {
        private Long id;
        private String title;
        private String description;
        private String status;
        private String sourceBranch;
        private String targetBranch;
        private Long repositoryId;
        private String repositoryName;
        private UserDto createdBy;
        private UserDto reviewer;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private LocalDateTime reviewedAt;
        private LocalDateTime mergedAt;
        private LocalDateTime closedAt;
        private String reviewComment;
        private int commentCount;
        private int changedFilesCount;
        private int additions;
        private int deletions;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PullRequestListResponse {
        private List<PullRequestResponse> pullRequests;
        private int totalCount;
        private int openCount;
        private int mergedCount;
        private int closedCount;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdatePullRequestRequest {
        @Size(max = 200, message = "Title must not exceed 200 characters")
        private String title;
        
        @Size(max = 5000, message = "Description must not exceed 5000 characters")
        private String description;
    }
    
    // ============ Pull Request Comment DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AddCommentRequest {
        @NotBlank(message = "File path is required")
        private String filePath;
        
        private Integer lineNumber;
        
        @NotBlank(message = "Comment content is required")
        @Size(max = 5000, message = "Comment must not exceed 5000 characters")
        private String content;
        
        private Integer originalLine;
        private Integer proposedChange;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CommentResponse {
        private Long id;
        private String filePath;
        private Integer lineNumber;
        private String content;
        private UserDto author;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private String diff;
        private boolean isResolved;
        private List<CommentResponse> replies;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CommentListResponse {
        private List<CommentResponse> comments;
        private int totalCount;
    }
    
    // ============ Review Actions DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReviewActionRequest {
        @Size(max = 2000, message = "Comment must not exceed 2000 characters")
        private String comment;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReviewActionResponse {
        private Long pullRequestId;
        private String action;
        private String status;
        private String message;
    }
    
    // ============ Diff DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DiffResponse {
        private String filePath;
        private String oldContent;
        private String newContent;
        private String diff;
        private int additions;
        private int deletions;
        private List<DiffHunk> hunks;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DiffHunk {
        private int oldStart;
        private int oldLines;
        private int newStart;
        private int newLines;
        private List<DiffLine> lines;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DiffLine {
        private String content;
        private String type; // add, delete, context
        private int oldLineNumber;
        private int newLineNumber;
    }
    
    // ============ Code Execution DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ExecuteCodeRequest {
        @NotNull(message = "Workspace ID is required")
        private Long workspaceId;
        
        @NotBlank(message = "Language is required")
        private String language;
        
        @NotBlank(message = "Code is required")
        private String code;
        
        private String fileName;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ExecutionResponse {
        private Long id;
        private String status;
        private String output;
        private String error;
        private String language;
        private Long executionTimeMs;
        private Long memoryUsageBytes;
        private LocalDateTime createdAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ExecutionListResponse {
        private List<ExecutionResponse> executions;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ExecuteCodeResponse {
        private Long id;
        private String status;
        private String output;
        private String error;
        private String language;
        private Long executionTimeMs;
        private Long memoryUsageBytes;
        private LocalDateTime createdAt;
    }
    
    // ============ Common DTOs ============
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserDto {
        private Long id;
        private String username;
        private String displayName;
        private String avatarUrl;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MessageResponse {
        private String message;
        private boolean success;
    }
}
