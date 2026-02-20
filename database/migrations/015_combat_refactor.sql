-- ============================================
-- Migration 015: Combat System Refactor
-- Aligns combat data model with admin-battle.js bible.
--
-- Changes:
--   1. Add durability column to character_equipment
--   2. Update weapon model_data with bible weaponType values
--   3. Add armorClass to armor items
--   4. Add shieldClass to shield items
-- ============================================

USE blackfyre_hud;

-- ============================================
-- 1. Add durability to character_equipment
-- ============================================

ALTER TABLE character_equipment
  ADD COLUMN IF NOT EXISTS durability DECIMAL(5,2) NOT NULL DEFAULT 100.00
  COMMENT 'Equipment condition (0-100). Degrades in combat by material tier rate.';

-- ============================================
-- 2. Update weapon types to bible names
-- Mapping: sword → bastardSword (1H) or longsword (2H)
--          axe → battleAxe1H
--          warhammer → warhammer1H
--          crossbow stays as-is (not in bible weapon types, treated as bow)
-- ============================================

-- Migration 003 weapons
UPDATE items SET model_data = JSON_SET(model_data, '$.weaponType', 'bastardSword')
WHERE item_key = 'iron_sword';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponType', 'bastardSword')
WHERE item_key = 'steel_sword';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponType', 'battleAxe1H')
WHERE item_key = 'iron_battleaxe';

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponType', 'warhammer1H')
WHERE item_key = 'iron_warhammer';

-- iron_spear already has weaponType 'spear' — matches bible

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponType', 'greatsword')
WHERE item_key = 'steel_greatsword';

-- hunting_bow already has weaponType 'bow' — matches bible

-- Migration 011 weapons
-- iron_dagger already has weaponType 'dagger' — matches bible

UPDATE items SET model_data = JSON_SET(model_data, '$.weaponType', 'mace1H')
WHERE item_key = 'iron_mace';

-- steel_lance: not a bible weapon type, treat as polearm
UPDATE items SET model_data = JSON_SET(model_data, '$.weaponType', 'polearm')
WHERE item_key = 'steel_lance';

-- crossbow: treat as bow for combat purposes
UPDATE items SET model_data = JSON_SET(model_data, '$.weaponType', 'bow')
WHERE item_key = 'crossbow';

-- longbow already has weaponType 'bow' — matches bible

-- valyrian_dagger already has weaponType 'dagger' — matches bible

-- war_scythe: polearm type already matches bible

-- ============================================
-- 3. Add armorClass to armor items
-- Maps based on material/weight:
--   gambeson (cloth, tier 1) → light
--   leather_armor (leather, tier 2) → light
--   chainmail (steel, tier 3) → medium
--   scale_armor (steel, tier 3) → medium
--   plate_armor (steel, tier 4) → heavy
--   valyrian_plate (valyrian, tier 5) → heavy
-- Clothing items (peasant_tunic, etc.) are not combat armor — skip.
-- ============================================

UPDATE items SET model_data = JSON_SET(COALESCE(model_data, '{}'), '$.armorClass', 'light')
WHERE item_key = 'gambeson';

UPDATE items SET model_data = JSON_SET(COALESCE(model_data, '{}'), '$.armorClass', 'light')
WHERE item_key = 'leather_armor';

UPDATE items SET model_data = JSON_SET(COALESCE(model_data, '{}'), '$.armorClass', 'medium')
WHERE item_key = 'chainmail';

UPDATE items SET model_data = JSON_SET(COALESCE(model_data, '{}'), '$.armorClass', 'medium')
WHERE item_key = 'scale_armor';

UPDATE items SET model_data = JSON_SET(COALESCE(model_data, '{}'), '$.armorClass', 'heavy')
WHERE item_key = 'plate_armor';

UPDATE items SET model_data = JSON_SET(COALESCE(model_data, '{}'), '$.armorClass', 'heavy')
WHERE item_key = 'valyrian_plate';

-- ============================================
-- 4. Add shieldClass to shield items
-- Maps based on type/weight:
--   wooden_shield (tier 2) → light (buckler)
--   iron_shield (tier 3) → medium (heater)
--   tower_shield (tier 3) → heavy (tower)
-- ============================================

UPDATE items SET model_data = JSON_SET(COALESCE(model_data, '{}'), '$.shieldClass', 'light')
WHERE item_key = 'wooden_shield';

UPDATE items SET model_data = JSON_SET(COALESCE(model_data, '{}'), '$.shieldClass', 'medium')
WHERE item_key = 'iron_shield';

UPDATE items SET model_data = JSON_SET(COALESCE(model_data, '{}'), '$.shieldClass', 'heavy')
WHERE item_key = 'tower_shield';

-- ============================================
-- Note: Existing model_data fields (penetration, baseDamage, mitigation,
-- blockBonus, encumbrance) are kept for reference but IGNORED at runtime.
-- load-stats.ts now computes all values from tier + class via
-- equipment-data.ts constants.
-- ============================================

SELECT 'Migration 015 complete — durability column added, weapon types aligned with bible, armorClass and shieldClass applied.' AS Status;
