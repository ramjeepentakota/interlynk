package com.enterprise.collab.repository;

import com.enterprise.collab.entity.Team;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    Optional<Team> findByName(String name);
    List<Team> findByCreatedById(Long userId);

    long countByArchivedTrue();
    long countByArchivedFalse();

    @Query("SELECT t FROM Team t WHERE " +
           "(:q IS NULL OR LOWER(t.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "  OR LOWER(t.description) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "AND (:archived IS NULL OR t.archived = :archived) " +
           "AND (:visibility IS NULL OR t.visibility = :visibility)")
    Page<Team> adminSearch(@Param("q") String q,
                           @Param("archived") Boolean archived,
                           @Param("visibility") Team.Visibility visibility,
                           Pageable pageable);
}
