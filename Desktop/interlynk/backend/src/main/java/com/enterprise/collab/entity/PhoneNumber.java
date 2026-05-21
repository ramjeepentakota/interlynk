package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * An organizationally-owned phone number that can be assigned to a user
 * (DID), call queue, or auto-attendant. Carrier integration (PSTN/SIP)
 * is configured per-number; the assignment lives here.
 */
@Entity
@Table(name = "phone_numbers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhoneNumber {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** E.164 format, e.g. +14155550100. */
    @Column(nullable = false, unique = true, length = 24)
    private String e164;

    @Column(length = 80)
    private String label;

    /** USER | CALL_QUEUE | AUTO_ATTENDANT | EMERGENCY | UNASSIGNED */
    @Column(name = "assignment_type", nullable = false, length = 30)
    @Builder.Default
    private String assignmentType = "UNASSIGNED";

    /** The user/queue/AA id this number routes to. */
    @Column(name = "assigned_to_id")
    private Long assignedToId;

    /** Display name shown on outbound calls. */
    @Column(name = "caller_id_name", length = 80)
    private String callerIdName;

    /** PSTN | SIP | INTERNAL */
    @Column(length = 16, nullable = false)
    @Builder.Default
    private String carrier = "INTERNAL";

    @Column(name = "emergency_address", length = 255)
    private String emergencyAddress;

    @Column(name = "country_code", length = 4, nullable = false)
    @Builder.Default
    private String countryCode = "+1";

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
