package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Content sensitivity label (Public / Internal / Confidential / etc.).
 * Applied to teams or channels; drives the matching DLP enforcement.
 */
@Entity
@Table(name = "sensitivity_labels")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SensitivityLabel {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String name;

    @Column(length = 500)
    private String description;

    /** Hex color e.g. #f59e0b. */
    @Column(length = 9)
    private String color;

    /** Lower = less sensitive (0 public, 100 top-secret). */
    @Column(name = "priority", nullable = false)
    @Builder.Default
    private int priority = 50;

    @Column(name = "requires_encryption", nullable = false)
    @Builder.Default
    private boolean requiresEncryption = false;

    @Column(name = "watermark_text", length = 200)
    private String watermarkText;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
