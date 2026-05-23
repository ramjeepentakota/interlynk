package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "call_participants")
@Data
// equals/hashCode on id ONLY — avoids recursing through the bidirectional
// `callRoom` association (see CallRoom for the StackOverflowError this prevents).
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CallParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    @ToString.Exclude
    private CallRoom callRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private User user;
    
    @Column(name = "joined_at")
    private LocalDateTime joinedAt;
    
    @Column(name = "left_at")
    private LocalDateTime leftAt;
    
    @Column(name = "is_muted")
    @Builder.Default
    private Boolean isMuted = false;
    
    @Column(name = "is_video_enabled")
    @Builder.Default
    private Boolean isVideoEnabled = true;
    
    @Column(name = "is_screen_sharing")
    @Builder.Default
    private Boolean isScreenSharing = false;
    
    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now();
    }
}
