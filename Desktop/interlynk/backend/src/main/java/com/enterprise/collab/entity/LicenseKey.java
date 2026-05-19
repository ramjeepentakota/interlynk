package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "license_keys")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LicenseKey {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "license_key", nullable = false, length = 100, unique = true)
    private String licenseKey;
    
    @Column(name = "max_users")
    @Builder.Default
    private Integer maxUsers = 100;
    
    @Column(name = "issued_to", length = 100)
    private String issuedTo;
    
    @Column(name = "issued_at")
    private LocalDateTime issuedAt;
    
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
    
    @PrePersist
    protected void onCreate() {
        issuedAt = LocalDateTime.now();
    }
}
