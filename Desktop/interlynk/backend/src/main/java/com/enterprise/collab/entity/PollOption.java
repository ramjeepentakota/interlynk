package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;

/** A single selectable choice within a {@link Poll}. */
@Entity
@Table(name = "poll_options")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PollOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "poll_id", nullable = false)
    private Poll poll;

    @Column(nullable = false, length = 300)
    private String text;

    @Column(name = "position")
    @Builder.Default
    private Integer position = 0;
}
