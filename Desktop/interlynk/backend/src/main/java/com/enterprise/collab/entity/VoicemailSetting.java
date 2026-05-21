package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Per-user voicemail configuration.
 */
@Entity
@Table(name = "voicemail_settings", indexes = @Index(name = "idx_vm_user", columnList = "user_id", unique = true))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoicemailSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Column(name = "greeting_text", length = 1000)
    private String greetingText;

    @Column(name = "greeting_audio_url", length = 500)
    private String greetingAudioUrl;

    @Column(name = "transcription_enabled", nullable = false)
    @Builder.Default
    private boolean transcriptionEnabled = true;

    @Column(name = "email_notification", nullable = false)
    @Builder.Default
    private boolean emailNotification = true;

    @Column(name = "max_duration_seconds", nullable = false)
    @Builder.Default
    private int maxDurationSeconds = 90;

    @Column(name = "auto_delete_days", nullable = false)
    @Builder.Default
    private int autoDeleteDays = 30;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
