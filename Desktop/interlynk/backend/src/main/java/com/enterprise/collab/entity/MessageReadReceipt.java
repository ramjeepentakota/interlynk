package com.enterprise.collab.entity;

import lombok.*;
import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * Message Read Receipt - Tracks when users read messages
 * Enterprise-grade feature for chat applications
 */
@Entity
@Table(name = "message_read_receipts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageReadReceipt {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(name = "read_at", nullable = false)
    private LocalDateTime readAt;
    
    @PrePersist
    protected void onCreate() {
        readAt = LocalDateTime.now();
    }
}
