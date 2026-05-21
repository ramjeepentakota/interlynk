package com.enterprise.collab.repository;

import com.enterprise.collab.entity.SensitivityLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SensitivityLabelRepository extends JpaRepository<SensitivityLabel, Long> {
    Optional<SensitivityLabel> findByName(String name);
    List<SensitivityLabel> findAllByOrderByPriorityAscNameAsc();
}
