package com.enterprise.collab.repository;

import com.enterprise.collab.entity.CallRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CallRoomRepository extends JpaRepository<CallRoom, Long> {
    List<CallRoom> findByIsActiveTrue();
    List<CallRoom> findByCreatedById(Long userId);
    Optional<CallRoom> findByIdAndIsActiveTrue(Long id);
}
