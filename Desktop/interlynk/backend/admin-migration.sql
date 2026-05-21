-- ──────────────────────────────────────────────────────────
-- Admin Center migration (Modules 1–4)
-- Run-once for existing databases. Idempotent: safe to re-run.
-- Wrapped in a stored proc to add columns only when missing,
-- so MySQL < 8.0.29 (without IF NOT EXISTS on columns) is fine.
-- ──────────────────────────────────────────────────────────
SET FOREIGN_KEY_CHECKS = 0;

DROP PROCEDURE IF EXISTS interlynk_add_col;
DELIMITER //
CREATE PROCEDURE interlynk_add_col(
    IN p_table  VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_def    VARCHAR(255))
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = p_table
          AND COLUMN_NAME  = p_column
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_def);
        PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

-- ── users: profile + lifecycle + MFA fields (Modules 1 & 4) ──
CALL interlynk_add_col('users','job_title',        'VARCHAR(120)');
CALL interlynk_add_col('users','department',       'VARCHAR(120)');
CALL interlynk_add_col('users','phone_number',     'VARCHAR(40)');
CALL interlynk_add_col('users','is_guest',         'BOOLEAN NOT NULL DEFAULT FALSE');
CALL interlynk_add_col('users','suspended_reason', 'VARCHAR(255)');
CALL interlynk_add_col('users','suspended_at',     'DATETIME');
CALL interlynk_add_col('users','mfa_enabled',      'BOOLEAN NOT NULL DEFAULT FALSE');
CALL interlynk_add_col('users','mfa_secret',       'VARCHAR(64)');
CALL interlynk_add_col('users','mfa_required',     'BOOLEAN NOT NULL DEFAULT FALSE');
CALL interlynk_add_col('users','mfa_enrolled_at',  'DATETIME');

-- ── teams: archive + visibility + template + policy (Module 2) ──
CALL interlynk_add_col('teams','archived',             'BOOLEAN NOT NULL DEFAULT FALSE');
CALL interlynk_add_col('teams','archived_at',          'DATETIME');
CALL interlynk_add_col('teams','visibility',           'VARCHAR(20) NOT NULL DEFAULT ''PRIVATE''');
CALL interlynk_add_col('teams','template_name',        'VARCHAR(60)');
CALL interlynk_add_col('teams','messaging_policy_id',  'BIGINT');

-- ── channels: visibility + archive (Module 2) ──
CALL interlynk_add_col('channels','visibility',  'VARCHAR(20) DEFAULT ''STANDARD''');
CALL interlynk_add_col('channels','archived',    'BOOLEAN NOT NULL DEFAULT FALSE');
CALL interlynk_add_col('channels','archived_at', 'DATETIME');

DROP PROCEDURE interlynk_add_col;

-- ── Module 1: login history ──────────────────────────────────
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

-- ── Module 2: messaging policies ─────────────────────────────
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

-- ── Module 3: meetings ───────────────────────────────────────
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

-- ── Module 3: calling ────────────────────────────────────────
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

-- ── Module 4: security & compliance ──────────────────────────
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

SET FOREIGN_KEY_CHECKS = 1;
