package com.enterprise.collab.entity;

import lombok.*;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * A queued or completed outbound HTTP delivery. The dispatcher walks rows
 * where status = PENDING and attempts the POST; retries are exponential
 * (next_attempt_at), capped at maxAttempts.
 */
@Entity
@Table(name = "webhook_deliveries",
       indexes = {
           @Index(name = "idx_wd_status_next", columnList = "status, next_attempt_at"),
           @Index(name = "idx_wd_webhook", columnList = "webhook_id")
       })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebhookDelivery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "webhook_id", nullable = false)
    private Webhook webhook;

    @Column(name = "event_type", nullable = false, length = 60)
    private String eventType;

    @Lob
    @Column(name = "payload", nullable = false)
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "attempts", nullable = false)
    @Builder.Default
    private Integer attempts = 0;

    @Column(name = "max_attempts", nullable = false)
    @Builder.Default
    private Integer maxAttempts = 5;

    @Column(name = "next_attempt_at")
    private LocalDateTime nextAttemptAt;

    @Column(name = "last_response_code")
    private Integer lastResponseCode;

    @Column(name = "last_error", length = 500)
    private String lastError;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
        if (nextAttemptAt == null) nextAttemptAt = createdAt;
    }
    @PreUpdate void onUpdate() { updatedAt = LocalDateTime.now(); }

    public enum Status { PENDING, SUCCESS, FAILED, GIVEN_UP }
}
