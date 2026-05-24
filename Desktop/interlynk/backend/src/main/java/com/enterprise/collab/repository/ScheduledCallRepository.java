package com.enterprise.collab.repository;

import com.enterprise.collab.entity.ScheduledCall;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ScheduledCallRepository extends JpaRepository<ScheduledCall, Long> {

    /** Look up a scheduled call by its shareable meeting code. */
    Optional<ScheduledCall> findByMeetingCode(String meetingCode);

    /** PENDING calls whose start time has passed — ready to go live. */
    @Query("SELECT s FROM ScheduledCall s WHERE s.status = com.enterprise.collab.entity.ScheduledCall$Status.PENDING " +
           "AND s.scheduledAt <= :now ORDER BY s.scheduledAt ASC")
    List<ScheduledCall> findDue(@Param("now") LocalDateTime now);

    List<ScheduledCall> findByStatus(ScheduledCall.Status status);

    /** PENDING calls starting within the reminder window that haven't been reminded yet. */
    @Query("SELECT s FROM ScheduledCall s WHERE s.status = com.enterprise.collab.entity.ScheduledCall$Status.PENDING " +
           "AND s.reminderSentAt IS NULL AND s.scheduledAt > :now AND s.scheduledAt <= :until " +
           "ORDER BY s.scheduledAt ASC")
    List<ScheduledCall> findReminderDue(@Param("now") LocalDateTime now, @Param("until") LocalDateTime until);

    /** Every call the user created OR was invited to, newest start first. */
    @Query("SELECT DISTINCT s FROM ScheduledCall s LEFT JOIN s.invitees i " +
           "WHERE s.createdBy.id = :userId OR i.id = :userId " +
           "ORDER BY s.scheduledAt ASC")
    List<ScheduledCall> findForUser(@Param("userId") Long userId);

    /** Upcoming (PENDING/ACTIVE) calls the user created OR was invited to. */
    @Query("SELECT DISTINCT s FROM ScheduledCall s LEFT JOIN s.invitees i " +
           "WHERE (s.createdBy.id = :userId OR i.id = :userId) " +
           "AND s.status IN (com.enterprise.collab.entity.ScheduledCall$Status.PENDING, " +
           "com.enterprise.collab.entity.ScheduledCall$Status.ACTIVE) " +
           "ORDER BY s.scheduledAt ASC")
    List<ScheduledCall> findUpcomingForUser(@Param("userId") Long userId);
}
