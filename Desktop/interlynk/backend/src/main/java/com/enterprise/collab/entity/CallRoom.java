package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "call_rooms")
@Data
// equals/hashCode on id ONLY. The default @Data would hash every field,
// including the bidirectional `participants` set, which recurses into
// CallParticipant.hashCode → CallRoom.hashCode → … → StackOverflowError when
// the set is initialised (e.g. a 2nd person joining a voice channel).
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CallRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;
    
    @Column(length = 100)
    private String name;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private CallRoomType type = CallRoomType.GROUP;
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "created_by")
    @ToString.Exclude
    private User createdBy;

    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
    
    @Column(name = "started_at")
    private LocalDateTime startedAt;
    
    @Column(name = "ended_at")
    private LocalDateTime endedAt;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @OneToMany(mappedBy = "callRoom", cascade = CascadeType.ALL)
    @Builder.Default
    @ToString.Exclude
    private Set<CallParticipant> participants = new HashSet<>();
    
    @PrePersist
    protected void onCreate() {
        startedAt = LocalDateTime.now();
    }
    
    public enum CallRoomType {
        ONE_TO_ONE, DIRECT, GROUP, VOICE_CHANNEL
    }
}
