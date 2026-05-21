-- Aligns pre-existing teams / team_members tables with the new JPA entities.
-- Idempotent and non-destructive (preserves existing rows). MySQL 8.x.
SET FOREIGN_KEY_CHECKS = 0;

-- ── teams.created_by (add if missing) ────────────────────────
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teams' AND COLUMN_NAME='created_by');
SET @sql := IF(@has=0, 'ALTER TABLE teams ADD COLUMN created_by BIGINT NULL', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── teams.owner_id -> nullable (so entity inserts succeed) ───
SET @nn := (SELECT IS_NULLABLE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teams' AND COLUMN_NAME='owner_id');
SET @sql := IF(@nn='NO', 'ALTER TABLE teams MODIFY COLUMN owner_id BIGINT NULL', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- backfill created_by from legacy owner_id
UPDATE teams SET created_by = owner_id WHERE created_by IS NULL AND owner_id IS NOT NULL;

-- ── team_members.role_in_team enum -> varchar ────────────────
SET @rt := (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_members' AND COLUMN_NAME='role_in_team');
SET @sql := IF(@rt LIKE 'enum%',
    'ALTER TABLE team_members MODIFY COLUMN role_in_team VARCHAR(20) NOT NULL DEFAULT ''MEMBER''', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── team_members surrogate id PK (add if missing) ────────────
SET @hasid := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='team_members' AND COLUMN_NAME='id');
SET @sql := IF(@hasid=0,
    'ALTER TABLE team_members DROP PRIMARY KEY, ADD COLUMN id BIGINT AUTO_INCREMENT PRIMARY KEY FIRST, ADD UNIQUE KEY uk_team_user (team_id, user_id)',
    'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET FOREIGN_KEY_CHECKS = 1;
