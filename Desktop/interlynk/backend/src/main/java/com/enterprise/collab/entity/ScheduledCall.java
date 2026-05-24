package com.enterprise.collab.entity;

import lombok.*;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * A call planned for a future time. The poller in ScheduledCallService wakes
 * periodically, finds rows where status = PENDING and scheduled_at <= now(),
 * spins up a real CallRoom and notifies the creator + invitees that the call
 * is starting. Reminder notifications are sent once, a few minutes ahead.
 *
 * Polling (not an in-memory timer) because these rows are user data and must
 * survive a backend restart — exactly the rationale used by ScheduledMessage.
 */
@Entity
@Table(name = "scheduled_calls",
       indexes = {
           @Index(name = "idx_sched_call_activate", columnList = "status, scheduled_at"),
           @Index(name = "idx_sched_call_creator", columnList = "created_by"),
           @Index(name = "idx_sched_call_meeting_code", columnList = "meeting_code", unique = true)
       })
@Data
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduledCall {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Column(name = "duration_minutes")
    @Builder.Default
    private Integer durationMinutes = 30;

    /** "voice" or "video" — mirrors the frontend/WebRTC convention. */
    @Column(name = "call_type", nullable = false, length = 10)
    @Builder.Default
    private String callType = "video";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    @ToString.Exclude
    private User createdBy;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "scheduled_call_invitees",
        joinColumns = @JoinColumn(name = "scheduled_call_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    @Builder.Default
    @ToString.Exclude
    private Set<User> invitees = new HashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    /** Set once the call goes live and a CallRoom has been created. */
    @Column(name = "call_room_id")
    private Long callRoomId;

    /**
     * Human-shareable, URL-safe meeting code (e.g. "abc-defg-hij"). Generated at
     * schedule() time and unique across all scheduled calls. The corresponding
     * shareable join URL is just /join/{meetingCode} — clients build it from
     * this code so the backend never has to know the public host.
     */
    @Column(name = "meeting_code", length = 32, unique = true)
    private String meetingCode;

    /** Stamped when the "starting soon" reminder was pushed, so we send it once. */
    @Column(name = "reminder_sent_at")
    private LocalDateTime reminderSentAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = createdAt; }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }

    public enum Status { PENDING, ACTIVE, COMPLETED, CANCELLED }
}
