package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "teams")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Team {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 100)
    private String name;
    
    @Column(length = 500)
    private String description;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    // Team membership is modeled exclusively by the TeamMember entity
    // (which maps the team_members table with id / role_in_team / joined_at).
    // A second @ManyToMany over the same table caused dual-ownership write
    // conflicts on delete, so it has been removed.

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // ── Lifecycle / governance ────────────────────────────
    @Column(name = "archived", nullable = false)
    @Builder.Default
    private boolean archived = false;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false, length = 20)
    @Builder.Default
    private Visibility visibility = Visibility.PRIVATE;

    /** Template the team was provisioned from (e.g. "default", "engineering"). */
    @Column(name = "template_name", length = 60)
    private String templateName;

    /** Optional governing messaging policy. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "messaging_policy_id")
    private MessagingPolicy messagingPolicy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum Visibility {
        PUBLIC,    // discoverable by all org members
        PRIVATE,   // invite-only
        ORG_WIDE   // every active member auto-joined
    }
}
