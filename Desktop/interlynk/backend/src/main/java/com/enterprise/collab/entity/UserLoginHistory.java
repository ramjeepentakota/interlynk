package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * One row per authentication attempt (successful or failed). Backs the
 * admin "Login history" and feeds dashboard security alerts.
 */
@Entity
@Table(name = "user_login_history", indexes = {
        @Index(name = "idx_login_user", columnList = "user_id"),
        @Index(name = "idx_login_time", columnList = "login_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserLoginHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    /** Username as typed — retained even for failed attempts where no user resolves. */
    @Column(name = "username_attempted", length = 100)
    private String usernameAttempted;

    @Column(nullable = false)
    private boolean success;

    @Column(name = "failure_reason", length = 200)
    private String failureReason;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "login_at", nullable = false)
    private LocalDateTime loginAt;

    @PrePersist
    protected void onCreate() {
        if (loginAt == null) loginAt = LocalDateTime.now();
    }
}
