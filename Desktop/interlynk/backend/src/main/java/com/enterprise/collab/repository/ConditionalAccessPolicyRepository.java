package com.enterprise.collab.repository;

import com.enterprise.collab.entity.ConditionalAccessPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConditionalAccessPolicyRepository extends JpaRepository<ConditionalAccessPolicy, Long> {
    Optional<ConditionalAccessPolicy> findByName(String name);
    List<ConditionalAccessPolicy> findAllByOrderByNameAsc();
}
