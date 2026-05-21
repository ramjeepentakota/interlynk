package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Meetings &amp; webinars policy — recording, transcription, lobby, screen share,
 * breakout rooms, AI recap, attendance reports. Modeled after the corresponding
 * Microsoft Teams policy bundle.
 */
@Entity
@Table(name = "meeting_policies")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MeetingPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "is_default", nullable = false)
    @Builder.Default
    private boolean defaultPolicy = false;

    /* Recording / transcription */
    @Column(name = "allow_recording", nullable = false)        @Builder.Default private boolean allowRecording = true;
    @Column(name = "auto_record",      nullable = false)        @Builder.Default private boolean autoRecord = false;
    @Column(name = "allow_transcription", nullable = false)     @Builder.Default private boolean allowTranscription = true;
    @Column(name = "allow_ai_recap",   nullable = false)        @Builder.Default private boolean allowAiRecap = true;

    /* Lobby + access */
    /** EVERYONE | ORG_ONLY | INVITED_ONLY */
    @Column(name = "lobby_mode", length = 30, nullable = false)
    @Builder.Default
    private String lobbyMode = "ORG_ONLY";

    @Column(name = "allow_anonymous_join", nullable = false)    @Builder.Default private boolean allowAnonymousJoin = false;

    /* In-meeting capabilities */
    @Column(name = "allow_screen_share", nullable = false)      @Builder.Default private boolean allowScreenShare = true;
    @Column(name = "allow_whiteboard",   nullable = false)      @Builder.Default private boolean allowWhiteboard = true;
    @Column(name = "allow_breakout_rooms", nullable = false)    @Builder.Default private boolean allowBreakoutRooms = true;
    @Column(name = "allow_meeting_chat", nullable = false)      @Builder.Default private boolean allowMeetingChat = true;
    @Column(name = "allow_reactions",    nullable = false)      @Builder.Default private boolean allowReactions = true;
    @Column(name = "allow_polls",        nullable = false)      @Builder.Default private boolean allowPolls = true;

    /* Reports */
    @Column(name = "attendance_reports", nullable = false)      @Builder.Default private boolean attendanceReports = true;

    /* Webinar / live events */
    @Column(name = "allow_webinars",     nullable = false)      @Builder.Default private boolean allowWebinars = true;
    @Column(name = "allow_live_events",  nullable = false)      @Builder.Default private boolean allowLiveEvents = false;
    @Column(name = "max_attendees",      nullable = false)      @Builder.Default private int maxAttendees = 1000;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
