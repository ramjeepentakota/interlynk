package com.enterprise.collab.entity;

import lombok.*;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * An outbound integration endpoint. When events on a subscribed type occur
 * (message.created, channel.created, user.mentioned, …) a {@link WebhookDelivery}
 * row is enqueued; WebhookDispatcher picks it up and POSTs the JSON body.
 *
 * The HMAC secret is appended as an X-Interlynk-Signature header so receivers
 * can validate the payload was not tampered with in flight.
 */
@Entity
@Table(name = "webhooks",
       indexes = { @Index(name = "idx_webhook_active", columnList = "active") })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Webhook {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 500)
    private String url;

    /** Comma-separated event type list, e.g. "message.created,channel.created". */
    @Column(nullable = false, length = 500)
    private String events;

    @Column(length = 64)
    private String secret;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = Boolean.TRUE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = createdAt; }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
