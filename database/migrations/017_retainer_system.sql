-- Migration 017: Retainer System
-- Adds retainer_types lookup table and ownership columns to characters.
-- Retainers are full characters owned by a player's character.
-- 10 retainer types with predefined stat templates.

USE blackfyre_hud;

-- ============================================================================
-- 1. retainer_types lookup table
-- ============================================================================

CREATE TABLE IF NOT EXISTS retainer_types (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    hire_cost INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Gold cost to hire',
    tier TINYINT UNSIGNED NOT NULL DEFAULT 1,

    -- Aptitude template values
    prowess TINYINT UNSIGNED NOT NULL DEFAULT 3,
    fortitude TINYINT UNSIGNED NOT NULL DEFAULT 3,
    cunning TINYINT UNSIGNED NOT NULL DEFAULT 3,
    command TINYINT UNSIGNED NOT NULL DEFAULT 3,
    stewardship TINYINT UNSIGNED NOT NULL DEFAULT 3,
    presence TINYINT UNSIGNED NOT NULL DEFAULT 3,
    lore TINYINT UNSIGNED NOT NULL DEFAULT 3,
    faith TINYINT UNSIGNED NOT NULL DEFAULT 3,

    -- Equipment template (item_key references)
    weapon_key VARCHAR(100) DEFAULT NULL,
    armor_key VARCHAR(100) DEFAULT NULL,
    shield_key VARCHAR(100) DEFAULT NULL,

    -- Primary combat skill
    skill_key VARCHAR(100) NOT NULL,
    skill_level TINYINT UNSIGNED NOT NULL DEFAULT 1,

    -- Derived
    max_health SMALLINT UNSIGNED NOT NULL DEFAULT 50,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. Seed retainer types
-- ============================================================================

INSERT INTO retainer_types
  (type_key, name, description, hire_cost, tier,
   prowess, fortitude, cunning, command, stewardship, presence, lore, faith,
   weapon_key, armor_key, shield_key, skill_key, skill_level, max_health)
VALUES
  ('knight', 'Knight', 'A trained and sworn knight, formidable in melee combat.',
   500, 1,
   5, 5, 3, 4, 3, 3, 3, 3,
   'iron_sword', 'chainmail', 'iron_shield', 'blades', 5, 70),

  ('man_at_arms', 'Man-at-Arms', 'A professional soldier, reliable in formation fighting.',
   300, 1,
   4, 4, 3, 3, 3, 3, 3, 3,
   'iron_sword', 'chainmail', 'iron_shield', 'blades', 4, 60),

  ('archer', 'Archer', 'A skilled bowman who strikes from distance.',
   250, 1,
   3, 3, 4, 3, 3, 3, 3, 3,
   'hunting_bow', 'leather_armor', NULL, 'archery', 5, 50),

  ('scout', 'Scout', 'A quick and cunning outrider, adept at reconnaissance.',
   200, 1,
   3, 3, 5, 3, 3, 3, 3, 3,
   'iron_dagger', 'leather_armor', NULL, 'blades', 3, 50),

  ('assassin', 'Assassin', 'A lethal shadow, trained to strike and vanish.',
   400, 1,
   4, 3, 5, 3, 3, 3, 3, 3,
   'iron_dagger', NULL, NULL, 'blades', 5, 45),

  ('spy', 'Spy', 'A charming infiltrator who gathers secrets and manipulates courts.',
   350, 1,
   3, 3, 5, 3, 3, 4, 3, 3,
   'iron_dagger', NULL, NULL, 'blades', 2, 45),

  ('healer', 'Healer', 'A learned healer who tends wounds on the battlefield.',
   300, 1,
   2, 4, 3, 3, 3, 3, 4, 3,
   'iron_mace', 'leather_armor', NULL, 'blunt', 2, 55),

  ('septon', 'Septon', 'A devout servant of the Seven, offering prayer and guidance.',
   250, 1,
   2, 3, 3, 3, 3, 4, 3, 5,
   'iron_mace', NULL, NULL, 'blunt', 2, 50),

  ('red_priest', 'Red Priest', 'A follower of R''hllor, wielding fire and faith.',
   350, 1,
   3, 3, 4, 3, 3, 3, 4, 5,
   'iron_mace', NULL, NULL, 'blunt', 2, 50),

  ('maester', 'Maester', 'A chain-bearing scholar of the Citadel, wise in many arts.',
   400, 1,
   2, 3, 4, 3, 4, 3, 5, 3,
   'iron_mace', NULL, NULL, 'blunt', 1, 45);

-- ============================================================================
-- 3. Add ownership columns to characters
-- ============================================================================

ALTER TABLE characters
  ADD COLUMN owner_character_id INT UNSIGNED DEFAULT NULL
    COMMENT 'NULL for player chars, set for retainers — references owning character',
  ADD COLUMN retainer_type_key VARCHAR(50) DEFAULT NULL
    COMMENT 'Links to retainer_types.type_key for retainer characters';

ALTER TABLE characters
  ADD INDEX idx_characters_owner (owner_character_id),
  ADD CONSTRAINT fk_characters_owner
    FOREIGN KEY (owner_character_id) REFERENCES characters(id) ON DELETE SET NULL;

SELECT 'Migration 017 complete — retainer_types table created with 10 types, characters table extended.' AS Status;
