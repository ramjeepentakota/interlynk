package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Retention policy for messages and files: keep-then-delete after N days,
 * scoped to a team / channel / org-wide.
 */
@Entity
@Table(name = "retention_policies")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class RetentionPolicy {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    /** MESSAGES | FILES | BOTH */
    @Column(name = "applies_to", length = 12, nullable = false)
    @Builder.Default
    private String appliesTo = "BOTH";

    /** Scope: ORG | TEAM:<id> | CHANNEL:<id> */
    @Column(name = "scope", length = 64, nullable = false)
    @Builder.Default
    private String scope = "ORG";

    @Column(name = "retain_days", nullable = false)
    @Builder.Default
    private int retainDays = 365;

    /** DELETE | ARCHIVE | LEGAL_HOLD */
    @Column(name = "after_action", length = 16, nullable = false)
    @Builder.Default
    private String afterAction = "DELETE";

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
