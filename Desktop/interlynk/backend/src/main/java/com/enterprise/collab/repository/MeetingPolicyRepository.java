package com.enterprise.collab.repository;

import com.enterprise.collab.entity.MeetingPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MeetingPolicyRepository extends JpaRepository<MeetingPolicy, Long> {
    Optional<MeetingPolicy> findByName(String name);
    Optional<MeetingPolicy> findFirstByDefaultPolicyTrue();
    List<MeetingPolicy> findAllByOrderByNameAsc();
}
