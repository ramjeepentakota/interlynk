package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "system_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemSetting {
    
    @Id
    @Column(name = "setting_key", length = 100)
    private String keyName;
    
    @Column(name = "setting_key_value", length = 100)
    private String key;
    
    @Column(columnDefinition = "TEXT")
    private String value;
    
    @Column(length = 500)
    private String description;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private User updatedBy;
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
