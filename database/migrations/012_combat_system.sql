-- ============================================
-- Migration 012: Combat System
-- Adds personal duel system, reputation tracking, and yield behavior
-- Updates weapon model_data with weaponSkill/weaponType fields
-- Fixes health formula: 20 + (fortitude * 10)
-- ============================================

USE blackfyre_hud;

-- ============================================
-- NEW TABLE: Character Reputation
-- ============================================

CREATE TABLE IF NOT EXISTS character_reputation (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL UNIQUE,
    honor INT DEFAULT 0 COMMENT 'Can go negative (executing yielders, etc.)',
    chivalry INT DEFAULT 0 COMMENT 'Can go negative',
    dread INT DEFAULT 0 COMMENT 'Generally positive',
    renown INT DEFAULT 0 COMMENT 'Generally positive',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_character (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NEW TABLE: Duels
-- ============================================

CREATE TABLE IF NOT EXISTS duels (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    attacker_character_id INT UNSIGNED NOT NULL,
    defender_character_id INT UNSIGNED NOT NULL,
    winner_character_id INT UNSIGNED NULL,
    status ENUM('pending', 'active', 'completed', 'cancelled') DEFAULT 'pending',
    outcome ENUM('victory', 'yield_accepted', 'yield_rejected_slain', 'desperate_stand_win', 'draw', 'cancelled') NULL,
    total_rounds SMALLINT UNSIGNED DEFAULT 0,
    combat_log JSON COMMENT 'Full round-by-round array for frontend replay',
    attacker_hp_start DECIMAL(5,2) NULL,
    attacker_hp_end DECIMAL(5,2) NULL,
    defender_hp_start DECIMAL(5,2) NULL,
    defender_hp_end DECIMAL(5,2) NULL,
    reputation_changes JSON COMMENT 'Snapshot of reputation deltas applied',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (attacker_character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (defender_character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_character_id) REFERENCES characters(id) ON DELETE SET NULL,
    INDEX idx_attacker (attacker_character_id),
    INDEX idx_defender (defender_character_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NEW TABLE: Duel Rounds
-- ============================================

CREATE TABLE IF NOT EXISTS duel_rounds (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    duel_id INT UNSIGNED NOT NULL,
    round_number SMALLINT UNSIGNED NOT NULL,
    attacker_initiative SMALLINT NULL,
    defender_initiative SMALLINT NULL,
    first_actor ENUM('attacker', 'defender') NULL,
    first_attack_roll SMALLINT NULL,
    first_defense_roll SMALLINT NULL,
    first_hit BOOLEAN NULL,
    first_margin SMALLINT NULL,
    first_damage SMALLINT NULL,
    first_damage_label VARCHAR(20) NULL,
    second_attack_roll SMALLINT NULL,
    second_defense_roll SMALLINT NULL,
    second_hit BOOLEAN NULL,
    second_margin SMALLINT NULL,
    second_damage SMALLINT NULL,
    second_damage_label VARCHAR(20) NULL,
    attacker_hp_after DECIMAL(5,2) NULL,
    defender_hp_after DECIMAL(5,2) NULL,
    yield_attempted_by ENUM('attacker', 'defender') NULL,
    yield_accepted BOOLEAN NULL,
    desperate_stand BOOLEAN DEFAULT FALSE,
    round_narrative TEXT NULL,
    FOREIGN KEY (duel_id) REFERENCES duels(id) ON DELETE CASCADE,
    UNIQUE KEY uk_duel_round (duel_id, round_number),
    INDEX idx_duel (duel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ALTER characters: Add yield behavior columns
-- ============================================

ALTER TABLE characters
    ADD COLUMN yield_threshold ENUM('heroic', 'brave', 'cautious', 'cowardly') DEFAULT 'brave'
        COMMENT 'HP threshold at which character attempts to yield',
    ADD COLUMN yield_response ENUM('merciful', 'pragmatic', 'ruthless') DEFAULT 'pragmatic'
        COMMENT 'How character responds when an opponent yields';

-- ============================================
-- UPDATE items: Add weaponSkill + weaponType to model_data
-- ============================================

-- Migration 003 weapons
UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'blades', '$.weaponType', 'sword')
WHERE item_key = 'iron_sword';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'blades', '$.weaponType', 'sword')
WHERE item_key = 'steel_sword';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'blades', '$.weaponType', 'axe')
WHERE item_key = 'iron_battleaxe';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'blunt', '$.weaponType', 'warhammer')
WHERE item_key = 'iron_warhammer';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'polearms', '$.weaponType', 'spear')
WHERE item_key = 'iron_spear';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'blades', '$.weaponType', 'sword')
WHERE item_key = 'steel_greatsword';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'archery', '$.weaponType', 'bow')
WHERE item_key = 'hunting_bow';

-- Migration 011 weapons
UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'blades', '$.weaponType', 'dagger')
WHERE item_key = 'iron_dagger';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'blunt', '$.weaponType', 'warhammer')
WHERE item_key = 'iron_mace';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'mountedCombat', '$.weaponType', 'spear')
WHERE item_key = 'steel_lance';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'archery', '$.weaponType', 'crossbow')
WHERE item_key = 'crossbow';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'archery', '$.weaponType', 'bow')
WHERE item_key = 'longbow';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'blades', '$.weaponType', 'dagger')
WHERE item_key = 'valyrian_dagger';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponSkill', 'polearms', '$.weaponType', 'polearm')
WHERE item_key = 'war_scythe';

-- ============================================
-- Recalculate max_health for existing characters
-- Formula: 20 + (fortitude * 10)  [was: 10 + (fortitude * 5)]
-- ============================================

UPDATE character_vitals cv
JOIN character_aptitudes ca ON cv.character_id = ca.character_id AND ca.aptitude_key = 'fortitude'
SET cv.max_health = 20 + (ca.current_value * 10),
    cv.health = LEAST(cv.health, 20 + (ca.current_value * 10));

-- ============================================
-- Initialize reputation for existing characters
-- ============================================

INSERT IGNORE INTO character_reputation (character_id)
SELECT id FROM characters;

SELECT 'Migration 012 complete — combat system tables, reputation, yield behavior, weapon skills applied.' AS Status;
