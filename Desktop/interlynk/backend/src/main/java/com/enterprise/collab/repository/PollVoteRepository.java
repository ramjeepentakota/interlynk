package com.enterprise.collab.repository;

import com.enterprise.collab.entity.PollVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PollVoteRepository extends JpaRepository<PollVote, Long> {

    List<PollVote> findByPollId(Long pollId);

    List<PollVote> findByPollIdAndUserId(Long pollId, Long userId);

    long countByOptionId(Long optionId);

    boolean existsByOptionIdAndUserId(Long optionId, Long userId);

    void deleteByPollIdAndUserId(Long pollId, Long userId);

    void deleteByPollId(Long pollId);

    @Query("SELECT v.option.id FROM PollVote v WHERE v.poll.id = :pollId AND v.user.id = :userId")
    List<Long> findOptionIdsByPollIdAndUserId(Long pollId, Long userId);
}
