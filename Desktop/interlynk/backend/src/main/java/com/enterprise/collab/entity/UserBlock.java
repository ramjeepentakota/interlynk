package com.enterprise.collab.entity;

import lombok.*;
import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * User Block - Allows users to block other users
 * Enterprise-grade privacy feature
 */
@Entity
@Table(name = "user_blocks", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"blocker_id", "blocked_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserBlock {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocker_id", nullable = false)
    private User blocker;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocked_id", nullable = false)
    private User blocked;
    
    @Column(name = "reason")
    private String reason;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
