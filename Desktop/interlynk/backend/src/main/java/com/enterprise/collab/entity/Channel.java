package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "channels")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Channel {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 100)
    private String name;
    
    @Column(length = 500)
    private String description;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ChannelType type = ChannelType.TEXT;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    private Team team;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;
    
    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.EAGER)
    @JoinTable(
        name = "channel_members",
        joinColumns = @JoinColumn(name = "channel_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    @Builder.Default
    private Set<User> members = new HashSet<>();
    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
    
    @Column(name = "position")
    @Builder.Default
    private Integer position = 0;
    
    @Column(name = "category")
    private String category;
    
    // Voice channel specific settings
    @Column(name = "max_participants")
    @Builder.Default
    private Integer maxParticipants = 25;
    
    @Column(name = "is_locked")
    @Builder.Default
    private Boolean isLocked = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", length = 20)
    @Builder.Default
    private Visibility visibility = Visibility.STANDARD;

    @Column(name = "archived", nullable = false)
    @Builder.Default
    private boolean archived = false;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;
    
    // Link to voice call room for voice channels
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voice_room_id")
    private CallRoom voiceRoom;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public enum ChannelType {
        TEXT,   // Text channel for messaging
        VOICE,  // Voice channel for audio calls
        PUBLIC, // Public channel anyone can join
        PRIVATE, // Private channel requires invitation
        DIRECT  // Direct message channel
    }
    
    public boolean isVoiceChannel() {
        return this.type == ChannelType.VOICE;
    }
    
    public boolean isTextChannel() {
        return this.type == ChannelType.TEXT || this.type == ChannelType.PUBLIC || this.type == ChannelType.PRIVATE;
    }

    public enum Visibility {
        STANDARD,  // visible to all team members
        PRIVATE,   // restricted to selected members
        SHARED     // shared with external/other teams
    }
}
