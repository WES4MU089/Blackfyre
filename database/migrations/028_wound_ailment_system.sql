-- Migration 028: Wound, Ailment & Alchemy System
-- Replaces the survival check system (migration 027) with a wound severity model.
-- Untended wounds develop infection via a dual-clock ailment engine.
-- Includes alchemy recipes and ingredient seeds for crafting medicines.

USE blackfyre_hud;

-- ============================================
-- 1. Rework characters table
-- ============================================

-- Simplify death_state: remove 'wounded'/'dying' (wounds tracked by wound_severity)
ALTER TABLE characters
  MODIFY COLUMN death_state ENUM('alive','dead') NOT NULL DEFAULT 'alive';

-- Add wound tracking columns
ALTER TABLE characters
  ADD COLUMN wound_severity ENUM('healthy','light','serious','severe','grave')
    NOT NULL DEFAULT 'healthy'
    COMMENT 'Current wound state from last combat',
  ADD COLUMN wound_received_at TIMESTAMP NULL DEFAULT NULL
    COMMENT 'When wounds were received (for infection onset timing)',
  ADD COLUMN wound_heals_at TIMESTAMP NULL DEFAULT NULL
    COMMENT 'For light wounds: when they self-heal. NULL for serious+.',
  ADD INDEX idx_wound_severity (wound_severity);

-- Drop old survival columns (added in migration 027)
ALTER TABLE characters
  DROP COLUMN death_timer_expires_at,
  DROP COLUMN death_roll_result;

-- ============================================
-- 2. Ailment definitions (configurable)
-- ============================================

CREATE TABLE IF NOT EXISTS ailment_definitions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ailment_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  stage_count TINYINT UNSIGNED NOT NULL DEFAULT 4,
  on_final_terminal ENUM('death','transform') NOT NULL DEFAULT 'death',
  transform_to_ailment_key VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-stage configuration for each ailment
CREATE TABLE IF NOT EXISTS ailment_stages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ailment_id INT UNSIGNED NOT NULL,
  stage_number TINYINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  terminal_seconds INT UNSIGNED NOT NULL
    COMMENT 'Seconds until this stage progresses to next (or triggers on_final_terminal)',
  immunity_base_seconds INT UNSIGNED NOT NULL
    COMMENT 'Base seconds for immunity to beat this stage (before Fortitude scaling)',
  symptoms JSON COMMENT 'Array of symptom strings for identification',
  FOREIGN KEY (ailment_id) REFERENCES ailment_definitions(id) ON DELETE CASCADE,
  UNIQUE KEY uk_ailment_stage (ailment_id, stage_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. Active ailments on characters
-- ============================================

CREATE TABLE IF NOT EXISTS character_ailments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_id INT UNSIGNED NOT NULL,
  ailment_id INT UNSIGNED NOT NULL,
  current_stage TINYINT UNSIGNED NOT NULL DEFAULT 1,
  terminal_expires_at TIMESTAMP NOT NULL
    COMMENT 'When terminal clock fires for current stage',
  immunity_expires_at TIMESTAMP NOT NULL
    COMMENT 'When immunity clock fires for current stage',
  is_terminal_paused BOOLEAN DEFAULT FALSE,
  terminal_paused_remaining_seconds INT UNSIGNED NULL
    COMMENT 'Seconds left on terminal when paused (for resume)',
  source VARCHAR(50) DEFAULT 'wound'
    COMMENT 'What caused this ailment (wound, environmental, etc.)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  FOREIGN KEY (ailment_id) REFERENCES ailment_definitions(id) ON DELETE CASCADE,
  INDEX idx_character (character_id),
  INDEX idx_terminal (terminal_expires_at),
  INDEX idx_immunity (immunity_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. Wound / ailment config tables
-- ============================================

-- How long until untended wounds develop infection
CREATE TABLE IF NOT EXISTS wound_infection_config (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  wound_severity ENUM('serious','severe','grave') NOT NULL UNIQUE,
  infection_onset_seconds INT UNSIGNED NOT NULL
    COMMENT 'Seconds after wound received before infection develops if untended'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Light wound self-heal timing
CREATE TABLE IF NOT EXISTS wound_heal_config (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  wound_severity ENUM('light') NOT NULL UNIQUE,
  self_heal_seconds INT UNSIGNED NOT NULL DEFAULT 86400
    COMMENT 'Seconds for light wounds to self-heal (default 24h)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. Alchemy recipes
-- ============================================

CREATE TABLE IF NOT EXISTS alchemy_recipes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  recipe_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  target_ailment_key VARCHAR(50) NOT NULL
    COMMENT 'Which ailment this medicine treats',
  result_item_key VARCHAR(50) NOT NULL
    COMMENT 'The item_key of the produced medicine',
  lore_requirement TINYINT UNSIGNED DEFAULT 1
    COMMENT 'Minimum Lore aptitude to attempt',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recipe ingredient requirements
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT UNSIGNED NOT NULL,
  item_key VARCHAR(50) NOT NULL,
  quantity TINYINT UNSIGNED NOT NULL DEFAULT 1,
  FOREIGN KEY (recipe_id) REFERENCES alchemy_recipes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. Seed data
-- ============================================

-- Infection ailment definition
INSERT INTO ailment_definitions (ailment_key, name, description, stage_count, on_final_terminal)
VALUES ('infection', 'Infection', 'Wound infection from untended injuries.', 4, 'death');

SET @infection_id = LAST_INSERT_ID();

-- Infection stages (terminal gets shorter, immunity base gets longer at higher stages)
INSERT INTO ailment_stages (ailment_id, stage_number, name, terminal_seconds, immunity_base_seconds, symptoms)
VALUES
  (@infection_id, 1, 'Mild Infection',     86400,  57600,
    '["redness around wound", "mild swelling", "warmth to touch"]'),
  (@infection_id, 2, 'Moderate Infection',  72000,  86400,
    '["pus discharge", "fever", "throbbing pain", "swollen lymph nodes"]'),
  (@infection_id, 3, 'Severe Infection',    43200, 100800,
    '["high fever", "spreading redness", "delirium", "foul smell"]'),
  (@infection_id, 4, 'Sepsis',              21600, 129600,
    '["organ pain", "rapid breathing", "confusion", "cold extremities", "mottled skin"]');

-- Wound infection onset timers (how long untended wounds take to develop infection)
INSERT INTO wound_infection_config (wound_severity, infection_onset_seconds) VALUES
  ('serious', 172800),  -- 48 hours
  ('severe',   86400),  -- 24 hours
  ('grave',    43200);  -- 12 hours

-- Light wound self-heal timer
INSERT INTO wound_heal_config (wound_severity, self_heal_seconds) VALUES
  ('light', 86400);  -- 24 hours

-- Update existing wounded status effect to match new severity-scaled system
UPDATE status_effects
SET description = 'Carrying battle injuries. Combat dice penalty scales with severity.',
    effect_data = '{"dice_penalty_light": 1, "dice_penalty_serious": 2, "dice_penalty_severe": 3}'
WHERE effect_key = 'wounded';

-- ============================================
-- 7. Ingredient and medicine items
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, is_usable, max_stack, base_price, icon_url)
VALUES
  ('herb_kingsblood', 'Kingsblood',
    'A crimson-leafed herb with potent healing properties.',
    'material', 'uncommon', FALSE, 10, 15, NULL),
  ('herb_firemoss', 'Firemoss',
    'A moss that grows near hot springs, known for its antiseptic qualities.',
    'material', 'common', FALSE, 10, 8, NULL),
  ('clean_water', 'Clean Water',
    'Purified water, essential for poultices.',
    'material', 'common', FALSE, 5, 3, NULL),
  ('infection_poultice', 'Poultice of Purging',
    'A medicine that fights wound infection. Pauses infection and greatly boosts recovery.',
    'consumable', 'uncommon', TRUE, 3, 50, NULL);

-- Infection cure recipe
INSERT INTO alchemy_recipes (recipe_key, name, description, target_ailment_key, result_item_key, lore_requirement)
VALUES ('infection_poultice', 'Poultice of Purging',
  'Combine kingsblood, firemoss, and clean water to create a powerful antiseptic poultice.',
  'infection', 'infection_poultice', 3);

SET @recipe_id = LAST_INSERT_ID();

INSERT INTO recipe_ingredients (recipe_id, item_key, quantity) VALUES
  (@recipe_id, 'herb_kingsblood', 1),
  (@recipe_id, 'herb_firemoss', 2),
  (@recipe_id, 'clean_water', 1);

-- ============================================
-- 8. Verify
-- ============================================

SELECT id, name, death_state, wound_severity FROM characters LIMIT 5;
SELECT * FROM ailment_definitions;
SELECT * FROM ailment_stages;
SELECT * FROM wound_infection_config;
SELECT * FROM alchemy_recipes ar JOIN recipe_ingredients ri ON ar.id = ri.recipe_id;
