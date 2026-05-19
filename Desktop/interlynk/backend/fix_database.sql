-- Run these SQL commands on your MySQL database (interlynk) to fix the missing columns

-- ============================================
-- Fix channels table - add missing columns
-- ============================================

-- Add is_active column if not exists
ALTER TABLE channels ADD COLUMN is_active TINYINT(1) DEFAULT 1;

-- Add position column if not exists
ALTER TABLE channels ADD COLUMN position INT DEFAULT 0;

-- Add category column if not exists
ALTER TABLE channels ADD COLUMN category VARCHAR(255);

-- Add max_participants column if not exists
ALTER TABLE channels ADD COLUMN max_participants INT DEFAULT 25;

-- Add is_locked column if not exists
ALTER TABLE channels ADD COLUMN is_locked TINYINT(1) DEFAULT 0;

-- Add voice_room_id column if not exists
ALTER TABLE channels ADD COLUMN voice_room_id BIGINT;

-- Add created_at column if not exists
ALTER TABLE channels ADD COLUMN created_at DATETIME;

-- Add updated_at column if not exists
ALTER TABLE channels ADD COLUMN updated_at DATETIME;

-- ============================================
-- Fix call_participants table - add missing id column
-- ============================================

-- Check if call_participants has id column, if not add it
-- Note: This may fail if table already has data without id
ALTER TABLE call_participants ADD COLUMN id BIGINT AUTO_INCREMENT PRIMARY KEY;

-- Add missing columns if not exists
ALTER TABLE call_participants ADD COLUMN joined_at DATETIME;
ALTER TABLE call_participants ADD COLUMN left_at DATETIME;
ALTER TABLE call_participants ADD COLUMN is_muted TINYINT(1) DEFAULT 0;
ALTER TABLE call_participants ADD COLUMN is_video_enabled TINYINT(1) DEFAULT 1;
ALTER TABLE call_participants ADD COLUMN is_screen_sharing TINYINT(1) DEFAULT 0;
