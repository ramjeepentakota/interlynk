-- ──────────────────────────────────────────────────────────
-- InterLynk schema.sql — fully idempotent.
-- Runs on every startup (spring.sql.init.mode=always).
-- All statements use IF NOT EXISTS so data is preserved.
-- ──────────────────────────────────────────────────────────
SET FOREIGN_KEY_CHECKS = 0;

-- ── Core: roles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    permissions VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Core: users (with all admin profile + MFA fields) ────
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    presence VARCHAR(20) DEFAULT 'OFFLINE',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    last_seen_at DATETIME,
    job_title VARCHAR(120),
    department VARCHAR(120),
    phone_number VARCHAR(40),
    is_guest BOOLEAN NOT NULL DEFAULT FALSE,
    suspended_reason VARCHAR(255),
    suspended_at DATETIME,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret VARCHAR(64),
    mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_enrolled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_presence (presence),
    INDEX idx_last_seen (last_seen_at),
    INDEX idx_department (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tokens / RBAC join table ─────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Teams (entity-aligned: created_by, with admin fields) ──
CREATE TABLE IF NOT EXISTS teams (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at DATETIME,
    visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    template_name VARCHAR(60),
    messaging_policy_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_team_created_by (created_by),
    INDEX idx_team_archived (archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Channels (with admin fields) ─────────────────────────
CREATE TABLE IF NOT EXISTS channels (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    type VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    team_id BIGINT,
    created_by BIGINT,
    category VARCHAR(50),
    position INT DEFAULT 0,
    max_participants INT DEFAULT 25,
    is_locked BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    visibility VARCHAR(20) DEFAULT 'STANDARD',
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at DATETIME,
    voice_room_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_team (team_id),
    INDEX idx_created_by (created_by),
    INDEX idx_type (type),
    INDEX idx_active (is_active),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS channel_members (
    channel_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (channel_id, user_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    parent_id BIGINT,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'TEXT',
    is_edited BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE CASCADE,
    INDEX idx_channel_created (channel_id, created_at DESC),
    INDEX idx_channel_created_asc (channel_id, created_at ASC),
    INDEX idx_sender (sender_id),
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attachments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    INDEX idx_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_message_user_emoji (message_id, user_id, emoji),
    INDEX idx_reactions_message (message_id),
    INDEX idx_reactions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS direct_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender_id BIGINT NOT NULL,
    receiver_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_dm_sender (sender_id),
    INDEX idx_dm_receiver (receiver_id),
    INDEX idx_conversation (sender_id, receiver_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_read_receipts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_message_user (message_id, user_id),
    INDEX idx_read_user_msg (user_id, message_id),
    INDEX idx_read_at (read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_blocks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    blocker_id BIGINT NOT NULL,
    blocked_id BIGINT NOT NULL,
    reason VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_blocker_blocked (blocker_id, blocked_id),
    INDEX idx_blocker (blocker_id),
    INDEX idx_blocked (blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS call_rooms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    created_by BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    started_at DATETIME,
    ended_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS call_participants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    joined_at DATETIME,
    left_at DATETIME,
    is_muted BOOLEAN DEFAULT FALSE,
    is_video_enabled BOOLEAN DEFAULT TRUE,
    is_screen_sharing BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (room_id) REFERENCES call_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS license_keys (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    license_key VARCHAR(100) UNIQUE NOT NULL,
    max_users INT DEFAULT 100,
    issued_to VARCHAR(100),
    issued_at DATETIME,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_key_value VARCHAR(100),
    value TEXT,
    description VARCHAR(500),
    updated_at DATETIME,
    updated_by BIGINT,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Module 1: login history ──────────────────────────────
CREATE TABLE IF NOT EXISTS user_login_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NULL,
    username_attempted VARCHAR(100),
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(200),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    login_at DATETIME NOT NULL,
    INDEX idx_login_user (user_id),
    INDEX idx_login_time (login_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Module 2: messaging policies ─────────────────────────
CREATE TABLE IF NOT EXISTS messaging_policies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) UNIQUE NOT NULL,
    description VARCHAR(500),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    allow_owner_delete BOOLEAN NOT NULL DEFAULT TRUE,
    allow_user_delete BOOLEAN NOT NULL DEFAULT TRUE,
    allow_user_edit BOOLEAN NOT NULL DEFAULT TRUE,
    allow_gifs BOOLEAN NOT NULL DEFAULT TRUE,
    allow_stickers BOOLEAN NOT NULL DEFAULT TRUE,
    allow_memes BOOLEAN NOT NULL DEFAULT TRUE,
    read_receipts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    allow_external_chat BOOLEAN NOT NULL DEFAULT FALSE,
    allow_file_attachments BOOLEAN NOT NULL DEFAULT TRUE,
    allow_url_previews BOOLEAN NOT NULL DEFAULT TRUE,
    max_attachment_mb INT NOT NULL DEFAULT 25,
    retention_days INT NOT NULL DEFAULT 0,
    chat_supervision BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB;

-- ── Module 3: meetings policy ────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_policies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) UNIQUE NOT NULL,
    description VARCHAR(500),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    allow_recording BOOLEAN NOT NULL DEFAULT TRUE,
    auto_record BOOLEAN NOT NULL DEFAULT FALSE,
    allow_transcription BOOLEAN NOT NULL DEFAULT TRUE,
    allow_ai_recap BOOLEAN NOT NULL DEFAULT TRUE,
    lobby_mode VARCHAR(30) NOT NULL DEFAULT 'ORG_ONLY',
    allow_anonymous_join BOOLEAN NOT NULL DEFAULT FALSE,
    allow_screen_share BOOLEAN NOT NULL DEFAULT TRUE,
    allow_whiteboard BOOLEAN NOT NULL DEFAULT TRUE,
    allow_breakout_rooms BOOLEAN NOT NULL DEFAULT TRUE,
    allow_meeting_chat BOOLEAN NOT NULL DEFAULT TRUE,
    allow_reactions BOOLEAN NOT NULL DEFAULT TRUE,
    allow_polls BOOLEAN NOT NULL DEFAULT TRUE,
    attendance_reports BOOLEAN NOT NULL DEFAULT TRUE,
    allow_webinars BOOLEAN NOT NULL DEFAULT TRUE,
    allow_live_events BOOLEAN NOT NULL DEFAULT FALSE,
    max_attendees INT NOT NULL DEFAULT 1000,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB;

-- ── Module 3: calling ────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_numbers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    e164 VARCHAR(24) UNIQUE NOT NULL,
    label VARCHAR(80),
    assignment_type VARCHAR(30) NOT NULL DEFAULT 'UNASSIGNED',
    assigned_to_id BIGINT,
    caller_id_name VARCHAR(80),
    carrier VARCHAR(16) NOT NULL DEFAULT 'INTERNAL',
    emergency_address VARCHAR(255),
    country_code VARCHAR(4) NOT NULL DEFAULT '+1',
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS call_queues (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) UNIQUE NOT NULL,
    description VARCHAR(500),
    routing_method VARCHAR(30) NOT NULL DEFAULT 'ATTENDANT',
    greeting_language VARCHAR(10) NOT NULL DEFAULT 'en-US',
    music_on_hold_url VARCHAR(500),
    welcome_audio_url VARCHAR(500),
    max_wait_seconds INT NOT NULL DEFAULT 300,
    max_size INT NOT NULL DEFAULT 50,
    overflow_action VARCHAR(30) NOT NULL DEFAULT 'OVERFLOW_VOICEMAIL',
    overflow_target VARCHAR(80),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS call_queue_agents (
    queue_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    PRIMARY KEY (queue_id, user_id),
    FOREIGN KEY (queue_id) REFERENCES call_queues(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auto_attendants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) UNIQUE NOT NULL,
    description VARCHAR(500),
    language VARCHAR(10) NOT NULL DEFAULT 'en-US',
    time_zone VARCHAR(40) NOT NULL DEFAULT 'UTC',
    greeting_text VARCHAR(1000),
    greeting_audio_url VARCHAR(500),
    menu_json TEXT,
    business_hours_json VARCHAR(1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS voicemail_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    greeting_text VARCHAR(1000),
    greeting_audio_url VARCHAR(500),
    transcription_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_notification BOOLEAN NOT NULL DEFAULT TRUE,
    max_duration_seconds INT NOT NULL DEFAULT 90,
    auto_delete_days INT NOT NULL DEFAULT 30,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Module 4: security & compliance ──────────────────────
CREATE TABLE IF NOT EXISTS conditional_access_policies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(500),
    state VARCHAR(20) NOT NULL DEFAULT 'REPORT_ONLY',
    rules_json TEXT,
    trusted_ip_ranges VARCHAR(1000),
    block_action BOOLEAN NOT NULL DEFAULT FALSE,
    require_mfa BOOLEAN NOT NULL DEFAULT TRUE,
    block_legacy_auth BOOLEAN NOT NULL DEFAULT TRUE,
    session_minutes INT NOT NULL DEFAULT 60,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dlp_policies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(500),
    action VARCHAR(20) NOT NULL DEFAULT 'WARN',
    detectors VARCHAR(2000),
    scope VARCHAR(16) NOT NULL DEFAULT 'BOTH',
    applies_to_external BOOLEAN NOT NULL DEFAULT TRUE,
    applies_to_internal BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sensitivity_labels (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) UNIQUE NOT NULL,
    description VARCHAR(500),
    color VARCHAR(9),
    priority INT NOT NULL DEFAULT 50,
    requires_encryption BOOLEAN NOT NULL DEFAULT FALSE,
    watermark_text VARCHAR(200),
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS information_barriers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    segment_type VARCHAR(16) NOT NULL DEFAULT 'DEPARTMENT',
    segment_a VARCHAR(120) NOT NULL,
    segment_b VARCHAR(120) NOT NULL,
    action VARCHAR(10) NOT NULL DEFAULT 'BLOCK',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS retention_policies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(500),
    applies_to VARCHAR(12) NOT NULL DEFAULT 'BOTH',
    scope VARCHAR(64) NOT NULL DEFAULT 'ORG',
    retain_days INT NOT NULL DEFAULT 365,
    after_action VARCHAR(16) NOT NULL DEFAULT 'DELETE',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB;

-- ── Team-member join table (entity uses TeamMember entity) ──
CREATE TABLE IF NOT EXISTS team_members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    team_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_in_team VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tm_team (team_id),
    INDEX idx_tm_user (user_id),
    UNIQUE KEY uk_team_user (team_id, user_id)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
