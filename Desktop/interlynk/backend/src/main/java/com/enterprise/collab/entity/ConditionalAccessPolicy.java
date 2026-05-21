package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Conditional access — gates sign-in based on user/group, location, and
 * device posture. Granular rules stored as JSON for flexibility.
 */
@Entity
@Table(name = "conditional_access_policies")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ConditionalAccessPolicy {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    /** ENFORCED | REPORT_ONLY | DISABLED */
    @Column(name = "state", length = 20, nullable = false)
    @Builder.Default
    private String state = "REPORT_ONLY";

    /**
     * JSON: { "users": "ALL"|[ids], "roles":[names], "platforms":[], "locationsCidr":[], "requireMfa":true, "blockLegacyAuth":true, "sessionMinutes":60 }
     */
    @Lob @Column(name = "rules_json", columnDefinition = "TEXT")
    private String rulesJson;

    /** Comma-separated CIDR ranges this policy considers "trusted". */
    @Column(name = "trusted_ip_ranges", length = 1000)
    private String trustedIpRanges;

    @Column(name = "block_action", nullable = false)
    @Builder.Default
    private boolean blockAction = false;

    @Column(name = "require_mfa", nullable = false)
    @Builder.Default
    private boolean requireMfa = true;

    @Column(name = "block_legacy_auth", nullable = false)
    @Builder.Default
    private boolean blockLegacyAuth = true;

    @Column(name = "session_minutes", nullable = false)
    @Builder.Default
    private int sessionMinutes = 60;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
