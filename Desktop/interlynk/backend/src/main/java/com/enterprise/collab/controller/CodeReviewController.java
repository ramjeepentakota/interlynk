package com.enterprise.collab.controller;

import com.enterprise.collab.entity.PullRequest;
import com.enterprise.collab.entity.PullRequestComment;
import com.enterprise.collab.security.JwtTokenProvider;
import com.enterprise.collab.service.CodeReviewService;
import javax.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class CodeReviewController {
    
    private final CodeReviewService codeReviewService;
    private final JwtTokenProvider jwtTokenProvider;
    
    @PostMapping
    public ResponseEntity<PullRequest> createPullRequest(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest) {
        Long userId = getUserIdFromRequest(httpRequest);
        
        return ResponseEntity.ok(codeReviewService.createPullRequest(
                Long.parseLong(request.get("workspaceId")),
                Long.parseLong(request.get("reviewerId")),
                request.get("title"),
                request.get("description"),
                request.get("sourceBranch"),
                request.get("targetBranch"),
                userId
        ));
    }
    
    @GetMapping
    public ResponseEntity<List<PullRequest>> getMyPullRequests(HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(codeReviewService.getPullRequestsForUser(userId));
    }
    
    @GetMapping("/assigned")
    public ResponseEntity<List<PullRequest>> getAssignedReviews(HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(codeReviewService.getPullRequestsForReviewer(userId));
    }
    
    @GetMapping("/repository/{repoId}")
    public ResponseEntity<List<PullRequest>> getRepositoryPullRequests(@PathVariable Long repoId) {
        return ResponseEntity.ok(codeReviewService.getRepositoryPullRequests(repoId));
    }
    
    @GetMapping("/{prId}")
    public ResponseEntity<PullRequest> getPullRequest(@PathVariable Long prId) {
        return codeReviewService.getPullRequest(prId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/{prId}/comments")
    public ResponseEntity<PullRequest> addComment(
            @PathVariable Long prId,
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        Long userId = getUserIdFromRequest(httpRequest);
        
        String filePath = (String) request.get("filePath");
        Integer lineNumber = (Integer) request.get("lineNumber");
        String content = (String) request.get("content");
        
        return ResponseEntity.ok(codeReviewService.addComment(prId, filePath, lineNumber, content, userId));
    }
    
    @GetMapping("/{prId}/comments")
    public ResponseEntity<List<PullRequestComment>> getComments(@PathVariable Long prId) {
        return ResponseEntity.ok(codeReviewService.getPullRequestComments(prId));
    }
    
    @PostMapping("/{prId}/approve")
    public ResponseEntity<PullRequest> approve(
            @PathVariable Long prId,
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest) {
        Long userId = getUserIdFromRequest(httpRequest);
        
        return ResponseEntity.ok(codeReviewService.approvePullRequest(
                prId, 
                request.get("comment"), 
                userId
        ));
    }
    
    @PostMapping("/{prId}/reject")
    public ResponseEntity<PullRequest> reject(
            @PathVariable Long prId,
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest) {
        Long userId = getUserIdFromRequest(httpRequest);
        
        return ResponseEntity.ok(codeReviewService.rejectPullRequest(
                prId, 
                request.get("comment"), 
                userId
        ));
    }
    
    @PostMapping("/{prId}/merge")
    public ResponseEntity<PullRequest> merge(
            @PathVariable Long prId,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        
        return ResponseEntity.ok(codeReviewService.mergePullRequest(prId, userId));
    }
    
    @PostMapping("/{prId}/close")
    public ResponseEntity<PullRequest> close(
            @PathVariable Long prId,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        
        return ResponseEntity.ok(codeReviewService.closePullRequest(prId, userId));
    }
    
    private Long getUserIdFromRequest(HttpServletRequest request) {
        String token = jwtTokenProvider.getTokenFromRequest(request);
        return jwtTokenProvider.getUserIdFromToken(token);
    }
}
