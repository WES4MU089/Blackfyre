-- Migration 014: Multiplayer Combat System
-- Adds lobby, combat session, position tracking, and action log tables.

-- ============================================
-- POSITION TRACKING (SL scripts report XYZ)
-- ============================================
CREATE TABLE IF NOT EXISTS character_positions (
    character_id INT UNSIGNED PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    pos_x FLOAT NOT NULL DEFAULT 0,
    pos_y FLOAT NOT NULL DEFAULT 0,
    pos_z FLOAT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_region (region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- COMBAT LOBBIES
-- ============================================
CREATE TABLE IF NOT EXISTS combat_lobbies (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    host_character_id INT UNSIGNED NOT NULL,
    region VARCHAR(100) NOT NULL,
    status ENUM('open', 'starting', 'started', 'cancelled') DEFAULT 'open',
    max_players TINYINT UNSIGNED DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    FOREIGN KEY (host_character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_region_status (region, status),
    INDEX idx_host (host_character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS combat_lobby_members (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lobby_id INT UNSIGNED NOT NULL,
    character_id INT UNSIGNED NOT NULL,
    team TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1 or 2',
    is_ready BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lobby_id) REFERENCES combat_lobbies(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE KEY uk_lobby_character (lobby_id, character_id),
    INDEX idx_lobby (lobby_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- COMBAT SESSIONS (active/completed fights)
-- ============================================
CREATE TABLE IF NOT EXISTS combat_sessions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lobby_id INT UNSIGNED NULL COMMENT 'NULL if from a direct duel',
    status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
    winning_team TINYINT UNSIGNED NULL,
    current_round SMALLINT UNSIGNED DEFAULT 1,
    current_turn_character_id INT UNSIGNED NULL,
    turn_started_at TIMESTAMP NULL,
    turn_order JSON COMMENT 'Array of {characterId, initiative, team}',
    combat_log JSON COMMENT 'Running log of all actions',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (lobby_id) REFERENCES combat_lobbies(id) ON DELETE SET NULL,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS combat_session_combatants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED NOT NULL,
    character_id INT UNSIGNED NOT NULL,
    team TINYINT UNSIGNED NOT NULL,
    initiative INT DEFAULT 0,
    current_health DECIMAL(7,2) NOT NULL,
    max_health DECIMAL(7,2) NOT NULL,
    is_alive BOOLEAN DEFAULT TRUE,
    is_yielded BOOLEAN DEFAULT FALSE,
    status_effects JSON COMMENT 'Array of {type, stacks, roundsRemaining, sourceCharacterId}',
    engaged_to JSON COMMENT 'Array of character IDs',
    protecting_id INT UNSIGNED NULL COMMENT 'Character being protected',
    is_bracing BOOLEAN DEFAULT FALSE,
    stats_snapshot JSON COMMENT 'CombatantStats frozen at combat start',
    FOREIGN KEY (session_id) REFERENCES combat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE KEY uk_session_character (session_id, character_id),
    INDEX idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- COMBAT ACTION LOG (per-action for replays)
-- ============================================
CREATE TABLE IF NOT EXISTS combat_action_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED NOT NULL,
    round_number SMALLINT UNSIGNED NOT NULL,
    turn_number SMALLINT UNSIGNED NOT NULL,
    actor_character_id INT UNSIGNED NOT NULL,
    action_type ENUM('attack', 'protect', 'grapple', 'disengage', 'brace', 'opportunity_attack', 'skip') NOT NULL,
    target_character_id INT UNSIGNED NULL,
    roll_data JSON COMMENT 'Attack/defense rolls, margins, etc.',
    damage_dealt SMALLINT DEFAULT 0,
    damage_label VARCHAR(30) NULL,
    crit BOOLEAN DEFAULT FALSE,
    crit_effect VARCHAR(30) NULL,
    status_effects_applied JSON COMMENT 'Effects added/removed this action',
    narrative TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES combat_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_round (session_id, round_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INIT POSITIONS FOR EXISTING CHARACTERS
-- ============================================
INSERT IGNORE INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
SELECT id, 'unknown', 128, 128, 25 FROM characters;

SELECT 'Migration 014 complete — multiplayer combat system tables created.' AS Status;
