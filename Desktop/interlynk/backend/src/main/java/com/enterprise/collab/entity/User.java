package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 50)
    private String username;
    
    @Column(nullable = false, unique = true, length = 100)
    private String email;
    
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    
    @Column(name = "display_name", length = 100)
    private String displayName;
    
    // Stored as TEXT so the column can hold either a public URL OR a
    // base64-encoded data: URL for the avatar (resized client-side to ~256px JPEG,
    // typically ~20-30 KB encoded). The original length=500 cap rejected every
    // data: URL upload and was the root cause of "profile pic does not upload".
    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Presence presence = Presence.OFFLINE;
    
    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    // ── Directory / org profile (admin-managed) ──────────────
    @Column(name = "job_title", length = 120)
    private String jobTitle;

    @Column(length = 120)
    private String department;

    @Column(name = "phone_number", length = 40)
    private String phoneNumber;

    @Column(name = "is_guest", nullable = false)
    @Builder.Default
    private boolean guest = false;

    @Column(name = "suspended_reason", length = 255)
    private String suspendedReason;

    @Column(name = "suspended_at")
    private LocalDateTime suspendedAt;

    // ── MFA enrollment ──────────────────────────────────────
    @Column(name = "mfa_enabled", nullable = false)
    @Builder.Default
    private boolean mfaEnabled = false;

    /** TOTP secret (base32). Stored only when enrolled. */
    @Column(name = "mfa_secret", length = 64)
    private String mfaSecret;

    @Column(name = "mfa_required", nullable = false)
    @Builder.Default
    private boolean mfaRequired = false;

    @Column(name = "mfa_enrolled_at")
    private LocalDateTime mfaEnrolledAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    @Builder.Default
    private Set<Role> roles = new HashSet<>();
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public enum UserStatus {
        ACTIVE, INACTIVE, SUSPENDED, BLOCKED
    }
    
    public enum Presence {
        ONLINE, OFFLINE, BUSY, AWAY
    }
    
    public boolean hasRole(String roleName) {
        return roles.stream().anyMatch(r -> r.getName().equals(roleName));
    }
    
    public boolean isAdmin() {
        return hasRole("ADMIN");
    }
    
    public boolean isManager() {
        return hasRole("MANAGER");
    }
}
