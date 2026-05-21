package com.enterprise.collab.repository;

import com.enterprise.collab.entity.WebhookDelivery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface WebhookDeliveryRepository extends JpaRepository<WebhookDelivery, Long> {

    @Query("SELECT d FROM WebhookDelivery d " +
           "WHERE d.status = com.enterprise.collab.entity.WebhookDelivery$Status.PENDING " +
           "AND (d.nextAttemptAt IS NULL OR d.nextAttemptAt <= :now) " +
           "ORDER BY d.id ASC")
    List<WebhookDelivery> findDue(@Param("now") LocalDateTime now);
}
