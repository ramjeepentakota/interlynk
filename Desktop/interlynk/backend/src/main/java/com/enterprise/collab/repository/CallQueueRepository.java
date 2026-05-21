package com.enterprise.collab.repository;

import com.enterprise.collab.entity.CallQueue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CallQueueRepository extends JpaRepository<CallQueue, Long> {
    Optional<CallQueue> findByName(String name);
    List<CallQueue> findAllByOrderByNameAsc();
}
