package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Auto-attendant — an interactive voice menu that routes inbound callers
 * to users, queues, or other attendants. Menu options are stored as JSON.
 */
@Entity
@Table(name = "auto_attendants")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AutoAttendant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "language", length = 10, nullable = false)
    @Builder.Default
    private String language = "en-US";

    @Column(name = "time_zone", length = 40, nullable = false)
    @Builder.Default
    private String timeZone = "UTC";

    @Column(name = "greeting_text", length = 1000)
    private String greetingText;

    @Column(name = "greeting_audio_url", length = 500)
    private String greetingAudioUrl;

    /**
     * JSON-encoded menu of {key, label, action, target}.
     * action ∈ TRANSFER_USER | TRANSFER_QUEUE | TRANSFER_AA | VOICEMAIL | DISCONNECT.
     */
    @Lob
    @Column(name = "menu_json", columnDefinition = "TEXT")
    private String menuJson;

    @Column(name = "business_hours_json", length = 1000)
    private String businessHoursJson;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
