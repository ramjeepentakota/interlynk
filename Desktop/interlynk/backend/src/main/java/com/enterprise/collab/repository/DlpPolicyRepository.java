package com.enterprise.collab.repository;

import com.enterprise.collab.entity.DlpPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DlpPolicyRepository extends JpaRepository<DlpPolicy, Long> {
    Optional<DlpPolicy> findByName(String name);
    List<DlpPolicy> findAllByOrderByNameAsc();
}
