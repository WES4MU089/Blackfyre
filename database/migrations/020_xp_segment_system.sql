-- Migration 020: Segment-Based Experience System
-- Replaces exponential XP formula with simple 10-segment (character) / 5-segment (skill) bars
USE blackfyre_hud;

-- ============================================
-- ALTER characters: Replace BIGINT experience with segment counter
-- ============================================
ALTER TABLE characters
    DROP COLUMN experience,
    ADD COLUMN xp_segments TINYINT UNSIGNED DEFAULT 0 COMMENT 'Current segments toward next level (0-9)' AFTER level;

-- ============================================
-- ALTER character_skills: Replace BIGINT experience with segment counter
-- ============================================
ALTER TABLE character_skills
    DROP COLUMN experience,
    ADD COLUMN xp_segments TINYINT UNSIGNED DEFAULT 0 COMMENT 'Current segments toward next skill level (0-4)' AFTER level;

-- ============================================
-- NEW TABLE: Character XP Log (daily cap tracking + audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS character_xp_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    source ENUM('combat', 'dm_award', 'playtime', 'skill_levelup') NOT NULL,
    segments_granted TINYINT UNSIGNED NOT NULL DEFAULT 1,
    earned_date DATE NOT NULL COMMENT 'Date (server local) for daily cap queries',
    metadata JSON NULL COMMENT 'Context: duel_id, session_id, dm_user_id, skill_id, etc.',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_char_source_date (character_id, source, earned_date),
    INDEX idx_char_date (character_id, earned_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NEW TABLE: Skill XP Log (daily cap tracking + audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS skill_xp_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    skill_id INT UNSIGNED NOT NULL,
    source ENUM('combat_usage', 'dm_award', 'practice') NOT NULL,
    segments_granted TINYINT UNSIGNED NOT NULL DEFAULT 1,
    earned_date DATE NOT NULL,
    metadata JSON NULL COMMENT 'Context: session_id, dm_user_id, item_id, etc.',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
    INDEX idx_char_skill_date (character_id, skill_id, earned_date),
    INDEX idx_char_date (character_id, earned_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NEW TABLE: Playtime Session Tracking (IC post requirement)
-- ============================================
CREATE TABLE IF NOT EXISTS character_playtime (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    session_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP NULL,
    ic_post_count INT UNSIGNED DEFAULT 0 COMMENT 'Number of IC chat messages during this session window',
    segment_granted BOOLEAN DEFAULT FALSE COMMENT 'Whether this window earned a playtime XP segment',
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_char_active (character_id, session_end),
    INDEX idx_char_date (character_id, session_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NEW TABLE: XP Configuration (admin-tunable caps)
-- ============================================
CREATE TABLE IF NOT EXISTS xp_config (
    config_key VARCHAR(50) PRIMARY KEY,
    config_value INT NOT NULL,
    description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO xp_config (config_key, config_value, description) VALUES
    ('char_daily_cap', 3, 'Hard cap on total character XP segments per day (excludes dm_award)'),
    ('combat_daily_cap', 3, 'Max character XP segments from combat per day'),
    ('playtime_daily_cap', 1, 'Max character XP segments from playtime per day'),
    ('playtime_minutes_required', 60, 'Minutes of active play required for playtime segment'),
    ('playtime_ic_posts_required', 2, 'Minimum IC posts per hour to qualify for playtime segment'),
    ('skill_daily_cap_per_skill', 1, 'Max skill segments per skill per day (regardless of source)'),
    ('char_segments_per_level', 10, 'Segments needed to gain a character level'),
    ('skill_segments_per_level', 5, 'Segments needed to gain a skill level'),
    ('levelup_aptitude_points', 1, 'Aptitude points granted per character level-up'),
    ('levelup_skill_points', 3, 'Skill points granted per character level-up');
