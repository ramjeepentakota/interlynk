package com.enterprise.collab.repository;

import com.enterprise.collab.entity.AutoAttendant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AutoAttendantRepository extends JpaRepository<AutoAttendant, Long> {
    Optional<AutoAttendant> findByName(String name);
    List<AutoAttendant> findAllByOrderByNameAsc();
}
