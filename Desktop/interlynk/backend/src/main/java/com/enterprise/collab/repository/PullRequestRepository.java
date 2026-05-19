package com.enterprise.collab.repository;

import com.enterprise.collab.entity.PullRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PullRequestRepository extends JpaRepository<PullRequest, Long> {
    List<PullRequest> findByRepositoryId(Long repoId);
    List<PullRequest> findByCreatedById(Long userId);
    List<PullRequest> findByReviewerId(Long reviewerId);
    List<PullRequest> findByStatus(PullRequest.PullRequestStatus status);
}
