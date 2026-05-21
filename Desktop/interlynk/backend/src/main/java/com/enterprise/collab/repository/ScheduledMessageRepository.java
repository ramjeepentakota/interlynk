package com.enterprise.collab.repository;

import com.enterprise.collab.entity.ScheduledMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ScheduledMessageRepository extends JpaRepository<ScheduledMessage, Long> {

    @Query("SELECT s FROM ScheduledMessage s WHERE s.status = com.enterprise.collab.entity.ScheduledMessage$Status.PENDING " +
           "AND s.dispatchAt <= :now ORDER BY s.dispatchAt ASC")
    List<ScheduledMessage> findDue(@Param("now") LocalDateTime now);

    List<ScheduledMessage> findBySenderIdOrderByDispatchAtAsc(Long senderId);
}
