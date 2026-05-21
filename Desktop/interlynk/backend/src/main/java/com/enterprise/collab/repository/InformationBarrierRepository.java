package com.enterprise.collab.repository;

import com.enterprise.collab.entity.InformationBarrier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InformationBarrierRepository extends JpaRepository<InformationBarrier, Long> {
    List<InformationBarrier> findAllByOrderByNameAsc();
}
