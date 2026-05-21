package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Data Loss Prevention policy. Patterns are configured as regex / detector
 * names; matched content triggers the policy action.
 */
@Entity
@Table(name = "dlp_policies")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class DlpPolicy {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    /** AUDIT | WARN | BLOCK | TOMBSTONE */
    @Column(name = "action", length = 20, nullable = false)
    @Builder.Default
    private String action = "WARN";

    /** Comma-separated detector ids (e.g. CREDIT_CARD, SSN, EMAIL, REGEX:^PROJ-\d+). */
    @Column(name = "detectors", length = 2000)
    private String detectors;

    /** Scope: CHATS | FILES | BOTH. */
    @Column(name = "scope", length = 16, nullable = false)
    @Builder.Default
    private String scope = "BOTH";

    /** External vs internal recipients. */
    @Column(name = "applies_to_external", nullable = false)
    @Builder.Default
    private boolean appliesToExternal = true;

    @Column(name = "applies_to_internal", nullable = false)
    @Builder.Default
    private boolean appliesToInternal = false;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
