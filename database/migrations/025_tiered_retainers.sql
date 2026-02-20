-- Migration 025: Tiered Retainer System
-- Replaces fixed archetypes with a 5-tier generic system.
-- Players choose retainer name and allocate aptitude points from a tier-determined budget.
-- Aptitude hard cap: 7 (vs player's 10). Level cap: 10. Max 4 retainers per player.

USE blackfyre_hud;

-- ============================================================================
-- 1. retainer_tiers lookup table
-- ============================================================================

CREATE TABLE IF NOT EXISTS retainer_tiers (
    tier TINYINT UNSIGNED PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    hire_cost INT UNSIGNED NOT NULL COMMENT 'Gold cost in stars (copper)',
    aptitude_budget TINYINT UNSIGNED NOT NULL COMMENT 'Total aptitude points to distribute across 8 aptitudes',
    weapon_key VARCHAR(100) NOT NULL COMMENT 'Starting weapon item_key',
    armor_key VARCHAR(100) DEFAULT NULL COMMENT 'Starting armor item_key',
    shield_key VARCHAR(100) DEFAULT NULL COMMENT 'Starting shield item_key',
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. Seed tier definitions
-- ============================================================================
-- Budget reference: PCs get 32 points (min 1, max 7 at creation).
-- T5 is special: all aptitudes fixed at 7 (budget 56 = 8×7), no allocation needed.

INSERT INTO retainer_tiers (tier, name, hire_cost, aptitude_budget, weapon_key, armor_key, shield_key, description)
VALUES
  (1, 'Conscript',  200, 16, 'iron_dagger',              'gambeson',       NULL,            'A raw recruit, barely trained but cheap to hire. Provide them better arms if you expect them to survive.'),
  (2, 'Footman',    500, 20, 'iron_sword',               'leather_armor',  'wooden_shield', 'A professional soldier with basic training and reliable equipment.'),
  (3, 'Veteran',   2000, 24, 'steel_sword',              'chainmail',      'steel_heater',  'A battle-hardened warrior with quality steel arms and armor.'),
  (4, 'Elite',    10000, 28, 'cf_bastard_sword',         'plate_armor',    'cf_heater',     'A masterfully trained fighter clad in castle-forged steel. Nearly as capable as a landed knight.'),
  (5, 'Legendary', 50000, 56, 'valyrian_bastard_sword',  'valyrian_plate', NULL,            'A once-in-a-generation warrior of unmatched prowess. Commands a king''s ransom.');

-- ============================================================================
-- 3. Add retainer_tier column to characters
-- ============================================================================

ALTER TABLE characters
  ADD COLUMN retainer_tier TINYINT UNSIGNED DEFAULT NULL
    COMMENT '1-5 for retainers (maps to retainer_tiers.tier), NULL for player characters';

-- ============================================================================
-- 4. Migrate existing retainers to tier 2 (Footman)
-- ============================================================================
-- Existing archetype-based retainers map to T2 quality.
-- NPC retainers (retainer_type_key IS NULL but owner_character_id IS NOT NULL) also get T2.

UPDATE characters
SET retainer_tier = 2
WHERE retainer_type_key IS NOT NULL;

UPDATE characters
SET retainer_tier = 2
WHERE owner_character_id IS NOT NULL AND retainer_tier IS NULL;

-- ============================================================================
-- 5. Mark retainer_types as deprecated (do NOT drop yet)
-- ============================================================================
-- The retainer_types table is kept for backward compatibility during migration.
-- It will be dropped in a future cleanup migration once all code paths use retainer_tiers.

SELECT 'Migration 025 complete — retainer_tiers table created, existing retainers mapped to T2.' AS Status;
