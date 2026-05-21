package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Information barrier — prevents members of one segment from messaging or
 * meeting with members of another. Segments are identified by department
 * or role name to keep the model simple and provider-neutral.
 */
@Entity
@Table(name = "information_barriers")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class InformationBarrier {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 500)
    private String description;

    /** SEGMENT_TYPE = DEPARTMENT | ROLE */
    @Column(name = "segment_type", length = 16, nullable = false)
    @Builder.Default
    private String segmentType = "DEPARTMENT";

    /** Left segment identifier (department name or role name). */
    @Column(name = "segment_a", length = 120, nullable = false)
    private String segmentA;

    /** Right segment identifier. */
    @Column(name = "segment_b", length = 120, nullable = false)
    private String segmentB;

    /** BLOCK | WARN */
    @Column(name = "action", length = 10, nullable = false)
    @Builder.Default
    private String action = "BLOCK";

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
