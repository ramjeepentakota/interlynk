package com.enterprise.collab.entity;

import lombok.*;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * A message queued for future delivery. The dispatcher polls rows where
 * status = PENDING and dispatch_at <= now() and resends them through the
 * normal ChatService.sendMessage path so all the usual side-effects (audit,
 * mention notification, websocket broadcast) fire.
 */
@Entity
@Table(name = "scheduled_messages",
       indexes = {
           @Index(name = "idx_sched_dispatch", columnList = "status, dispatch_at"),
           @Index(name = "idx_sched_sender", columnList = "sender_id")
       })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduledMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "channel_id", nullable = false)
    private Channel channel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "dispatch_at", nullable = false)
    private LocalDateTime dispatchAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "delivered_message_id")
    private Long deliveredMessageId;

    @Column(name = "last_error", length = 500)
    private String lastError;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = createdAt; }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }

    public enum Status { PENDING, SENT, FAILED, CANCELLED }
}
