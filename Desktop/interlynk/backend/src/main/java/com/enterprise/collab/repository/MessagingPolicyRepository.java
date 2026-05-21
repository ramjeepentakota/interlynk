package com.enterprise.collab.repository;

import com.enterprise.collab.entity.MessagingPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessagingPolicyRepository extends JpaRepository<MessagingPolicy, Long> {
    Optional<MessagingPolicy> findByName(String name);
    Optional<MessagingPolicy> findFirstByDefaultPolicyTrue();
    List<MessagingPolicy> findAllByOrderByNameAsc();
}
