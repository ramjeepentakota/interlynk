package com.enterprise.collab.service;

import com.enterprise.collab.entity.*;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CodeReviewService {
    
    private final PullRequestRepository pullRequestRepository;
    private final PullRequestCommentRepository pullRequestCommentRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final CodeRepositoryRepository codeRepositoryRepository;
    private final NotificationService notificationService;
    
    @Transactional
    public PullRequest createPullRequest(Long workspaceId, Long reviewerId, String title, String description, 
            String sourceBranch, String targetBranch, Long userId) {
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new RuntimeException("Reviewer not found"));
        
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace not found"));
        
        CodeRepository repository = workspace.getRepository();
        
        PullRequest pullRequest = PullRequest.builder()
                .repository(repository)
                .workspace(workspace)
                .title(title)
                .description(description)
                .sourceBranch(sourceBranch)
                .targetBranch(targetBranch)
                .createdBy(user)
                .reviewer(reviewer)
                .status(PullRequest.PullRequestStatus.OPEN)
                .build();
        
        PullRequest saved = pullRequestRepository.save(pullRequest);
        
        // Send notification to reviewer
        notificationService.createNotification(
                reviewer.getId(),
                "PULL_REQUEST",
                "New Code Review Request",
                user.getUsername() + " has requested your review for: " + title,
                "/reviews/" + saved.getId()
        );
        
        return saved;
    }
    
    public List<PullRequest> getPullRequestsForUser(Long userId) {
        return pullRequestRepository.findByCreatedById(userId);
    }
    
    public List<PullRequest> getPullRequestsForReviewer(Long reviewerId) {
        return pullRequestRepository.findByReviewerId(reviewerId);
    }
    
    public List<PullRequest> getRepositoryPullRequests(Long repositoryId) {
        return pullRequestRepository.findByRepositoryId(repositoryId);
    }
    
    public Optional<PullRequest> getPullRequest(Long pullRequestId) {
        return pullRequestRepository.findById(pullRequestId);
    }
    
    @Transactional
    public PullRequest addComment(Long pullRequestId, String filePath, Integer lineNumber, 
            String content, Long userId) {
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        PullRequest pullRequest = pullRequestRepository.findById(pullRequestId)
                .orElseThrow(() -> new RuntimeException("Pull request not found"));
        
        PullRequestComment comment = PullRequestComment.builder()
                .pullRequest(pullRequest)
                .user(user)
                .filePath(filePath)
                .lineNumber(lineNumber)
                .content(content)
                .build();
        
        pullRequestCommentRepository.save(comment);
        
        // Notify PR author
        notificationService.createNotification(
                pullRequest.getCreatedBy().getId(),
                "PR_COMMENT",
                "New Comment on Pull Request",
                user.getUsername() + " commented on your pull request: " + pullRequest.getTitle(),
                "/reviews/" + pullRequestId
        );
        
        return pullRequest;
    }
    
    public List<PullRequestComment> getPullRequestComments(Long pullRequestId) {
        return pullRequestCommentRepository.findByPullRequestId(pullRequestId);
    }
    
    @Transactional
    public PullRequest approvePullRequest(Long pullRequestId, String comment, Long reviewerId) {
        
        PullRequest pullRequest = pullRequestRepository.findById(pullRequestId)
                .orElseThrow(() -> new RuntimeException("Pull request not found"));
        
        // Verify reviewer
        if (!pullRequest.getReviewer().getId().equals(reviewerId)) {
            throw new RuntimeException("Only the assigned reviewer can approve the pull request");
        }
        
        pullRequest.setStatus(PullRequest.PullRequestStatus.APPROVED);
        pullRequest.setReviewComment(comment);
        pullRequest.setReviewedAt(LocalDateTime.now());
        
        PullRequest saved = pullRequestRepository.save(pullRequest);
        
        // Notify PR author
        notificationService.createNotification(
                pullRequest.getCreatedBy().getId(),
                "PR_APPROVED",
                "Pull Request Approved",
                "Your pull request has been approved: " + pullRequest.getTitle(),
                "/reviews/" + pullRequestId
        );
        
        return saved;
    }
    
    @Transactional
    public PullRequest rejectPullRequest(Long pullRequestId, String comment, Long reviewerId) {
        
        PullRequest pullRequest = pullRequestRepository.findById(pullRequestId)
                .orElseThrow(() -> new RuntimeException("Pull request not found"));
        
        // Verify reviewer
        if (!pullRequest.getReviewer().getId().equals(reviewerId)) {
            throw new RuntimeException("Only the assigned reviewer can reject the pull request");
        }
        
        pullRequest.setStatus(PullRequest.PullRequestStatus.REJECTED);
        pullRequest.setReviewComment(comment);
        pullRequest.setReviewedAt(LocalDateTime.now());
        
        PullRequest saved = pullRequestRepository.save(pullRequest);
        
        // Notify PR author
        notificationService.createNotification(
                pullRequest.getCreatedBy().getId(),
                "PR_REJECTED",
                "Pull Request Rejected",
                "Your pull request has been rejected: " + pullRequest.getTitle(),
                "/reviews/" + pullRequestId
        );
        
        return saved;
    }
    
    @Transactional
    public PullRequest mergePullRequest(Long pullRequestId, Long userId) {
        
        PullRequest pullRequest = pullRequestRepository.findById(pullRequestId)
                .orElseThrow(() -> new RuntimeException("Pull request not found"));
        
        // Verify can merge
        if (pullRequest.getStatus() != PullRequest.PullRequestStatus.APPROVED) {
            throw new RuntimeException("Pull request must be approved before merging");
        }
        
        pullRequest.setStatus(PullRequest.PullRequestStatus.MERGED);
        pullRequest.setMergedAt(LocalDateTime.now());
        
        PullRequest saved = pullRequestRepository.save(pullRequest);
        
        // Notify PR author
        notificationService.createNotification(
                pullRequest.getCreatedBy().getId(),
                "PR_MERGED",
                "Pull Request Merged",
                "Your pull request has been merged: " + pullRequest.getTitle(),
                "/reviews/" + pullRequestId
        );
        
        return saved;
    }
    
    @Transactional
    public PullRequest closePullRequest(Long pullRequestId, Long userId) {
        
        PullRequest pullRequest = pullRequestRepository.findById(pullRequestId)
                .orElseThrow(() -> new RuntimeException("Pull request not found"));
        
        // Verify ownership
        if (!pullRequest.getCreatedBy().getId().equals(userId)) {
            throw new RuntimeException("Only the author can close the pull request");
        }
        
        pullRequest.setStatus(PullRequest.PullRequestStatus.CLOSED);
        
        return pullRequestRepository.save(pullRequest);
    }
}
