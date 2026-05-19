package com.enterprise.collab.repository;

import com.enterprise.collab.entity.PullRequestComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PullRequestCommentRepository extends JpaRepository<PullRequestComment, Long> {
    List<PullRequestComment> findByPullRequestId(Long pullRequestId);
}
