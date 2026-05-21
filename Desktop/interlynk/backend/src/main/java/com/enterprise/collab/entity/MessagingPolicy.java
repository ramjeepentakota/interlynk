package com.enterprise.collab.entity;

import javax.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * A named bundle of chat/messaging rules. Teams reference one policy; it
 * governs edit/delete, retention, external sharing, attachments, etc.
 * Mirrors Microsoft Teams' messaging-policy concept.
 */
@Entity
@Table(name = "messaging_policies")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessagingPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String name;

    @Column(length = 500)
    private String description;

    /** Org-wide default applied when a team has no explicit policy. */
    @Column(name = "is_default", nullable = false)
    @Builder.Default
    private boolean defaultPolicy = false;

    @Column(name = "allow_owner_delete", nullable = false)
    @Builder.Default private boolean allowOwnerDelete = true;

    @Column(name = "allow_user_delete", nullable = false)
    @Builder.Default private boolean allowUserDelete = true;

    @Column(name = "allow_user_edit", nullable = false)
    @Builder.Default private boolean allowUserEdit = true;

    @Column(name = "allow_gifs", nullable = false)
    @Builder.Default private boolean allowGifs = true;

    @Column(name = "allow_stickers", nullable = false)
    @Builder.Default private boolean allowStickers = true;

    @Column(name = "allow_memes", nullable = false)
    @Builder.Default private boolean allowMemes = true;

    @Column(name = "read_receipts_enabled", nullable = false)
    @Builder.Default private boolean readReceiptsEnabled = true;

    @Column(name = "allow_external_chat", nullable = false)
    @Builder.Default private boolean allowExternalChat = false;

    @Column(name = "allow_file_attachments", nullable = false)
    @Builder.Default private boolean allowFileAttachments = true;

    @Column(name = "allow_url_previews", nullable = false)
    @Builder.Default private boolean allowUrlPreviews = true;

    @Column(name = "max_attachment_mb", nullable = false)
    @Builder.Default private int maxAttachmentMb = 25;

    /** 0 = keep forever, otherwise messages older than N days are eligible for purge. */
    @Column(name = "retention_days", nullable = false)
    @Builder.Default private int retentionDays = 0;

    /** When true, channel owners can supervise (read all) chats in their channels. */
    @Column(name = "chat_supervision", nullable = false)
    @Builder.Default private boolean chatSupervision = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
