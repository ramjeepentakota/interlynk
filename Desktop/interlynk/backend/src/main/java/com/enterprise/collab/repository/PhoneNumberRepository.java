package com.enterprise.collab.repository;

import com.enterprise.collab.entity.PhoneNumber;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PhoneNumberRepository extends JpaRepository<PhoneNumber, Long> {

    Optional<PhoneNumber> findByE164(String e164);

    List<PhoneNumber> findByAssignmentType(String assignmentType);

    List<PhoneNumber> findByAssignmentTypeAndAssignedToId(String assignmentType, Long assignedToId);

    long countByAssignmentType(String assignmentType);

    @Query("SELECT p FROM PhoneNumber p WHERE " +
           "(:q IS NULL OR LOWER(p.e164) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "  OR LOWER(p.label) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "AND (:assignmentType IS NULL OR p.assignmentType = :assignmentType)")
    Page<PhoneNumber> adminSearch(@Param("q") String q,
                                  @Param("assignmentType") String assignmentType,
                                  Pageable pageable);
}
