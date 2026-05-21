package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * A call queue distributes inbound calls to a group of agents.
 * Routing strategy + overflow + business hours configurable.
 */
@Entity
@Table(name = "call_queues")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CallQueue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    @Column(length = 500)
    private String description;

    /** ATTENDANT | SERIAL | ROUND_ROBIN | LONGEST_IDLE */
    @Column(name = "routing_method", nullable = false, length = 30)
    @Builder.Default
    private String routingMethod = "ATTENDANT";

    /** Comma-separated language code, e.g. en-US. */
    @Column(name = "greeting_language", length = 10, nullable = false)
    @Builder.Default
    private String greetingLanguage = "en-US";

    @Column(name = "music_on_hold_url", length = 500)
    private String musicOnHoldUrl;

    @Column(name = "welcome_audio_url", length = 500)
    private String welcomeAudioUrl;

    @Column(name = "max_wait_seconds", nullable = false)
    @Builder.Default
    private int maxWaitSeconds = 300;

    @Column(name = "max_size", nullable = false)
    @Builder.Default
    private int maxSize = 50;

    /** OVERFLOW_VOICEMAIL | OVERFLOW_DISCONNECT | OVERFLOW_REDIRECT */
    @Column(name = "overflow_action", length = 30, nullable = false)
    @Builder.Default
    private String overflowAction = "OVERFLOW_VOICEMAIL";

    @Column(name = "overflow_target", length = 80)
    private String overflowTarget;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "call_queue_agents",
            joinColumns = @JoinColumn(name = "queue_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id"))
    @Builder.Default
    private Set<User> agents = new HashSet<>();

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
