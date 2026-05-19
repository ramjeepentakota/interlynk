package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "code_executions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodeExecution {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(nullable = false, length = 20)
    private String language;
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String code;
    
    @Column(columnDefinition = "TEXT")
    private String output;
    
    @Column(name = "error_output", columnDefinition = "TEXT")
    private String errorOutput;
    
    @Column(name = "exit_code")
    private Integer exitCode;
    
    @Column(name = "execution_time_ms")
    private Integer executionTimeMs;
    
    @Column(name = "memory_usage_bytes")
    private Long memoryUsageBytes;
    
    @Column(name = "error", columnDefinition = "TEXT")
    private String error;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ExecutionStatus status = ExecutionStatus.RUNNING;
    
    @Column(name = "executed_at")
    private LocalDateTime executedAt;
    
    @PrePersist
    protected void onCreate() {
        executedAt = LocalDateTime.now();
    }
    
    public enum ExecutionStatus {
        PENDING, RUNNING, COMPLETED, ERROR, TIMEOUT
    }
}
