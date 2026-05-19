package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "workspace_files")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkspaceFile {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;
    
    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;
    
    @Column(columnDefinition = "TEXT")
    private String content;
    
    @Column(name = "last_modified")
    private LocalDateTime lastModified;
    
    @PrePersist
    protected void onCreate() {
        lastModified = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        lastModified = LocalDateTime.now();
    }
}
