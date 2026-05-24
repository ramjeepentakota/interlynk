package com.enterprise.collab.repository;

import com.enterprise.collab.entity.CallParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CallParticipantRepository extends JpaRepository<CallParticipant, Long> {
    List<CallParticipant> findByCallRoomId(Long roomId);
    Optional<CallParticipant> findByCallRoomIdAndUserId(Long roomId, Long userId);
    // Use this variant to avoid IncorrectResultSizeDataAccessException when a user has left-and-rejoined
    Optional<CallParticipant> findByCallRoomIdAndUserIdAndLeftAtIsNull(Long roomId, Long userId);
    List<CallParticipant> findByCallRoomIdAndLeftAtIsNull(Long roomId);

    // Eager-fetch the user to avoid LazyInitializationException when mapping outside a transaction
    @Query("SELECT cp FROM CallParticipant cp JOIN FETCH cp.user WHERE cp.callRoom.id = :roomId AND cp.leftAt IS NULL")
    List<CallParticipant> findActiveParticipantsWithUser(@Param("roomId") Long roomId);
}
