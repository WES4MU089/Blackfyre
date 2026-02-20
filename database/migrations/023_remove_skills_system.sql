-- Migration 023: Remove Skills System — Aptitude-Only Refactor
-- Skills are removed entirely. Aptitudes are the sole stat system for combat,
-- difficulty checks, and character differentiation.
--
-- Changes:
--   - Drop skill_xp_log, character_skills, skills tables
--   - Remove unspent_skill_points from characters
--   - Remove locked_skills, free_skill_points from class_templates
--   - Remove skill_key, skill_level from retainer_types
--   - Clean up skill-related xp_config rows
--   - Narrow character_xp_log source enum
--   - Update all 17 templates: base aptitude 1, total budget = 32

USE blackfyre_hud;

-- ============================================================================
-- 1. DROP SKILL TABLES (FK dependency order)
-- ============================================================================

DROP TABLE IF EXISTS skill_xp_log;
DROP TABLE IF EXISTS character_skills;
DROP TABLE IF EXISTS skills;

-- ============================================================================
-- 2. REMOVE SKILL COLUMNS FROM OTHER TABLES
-- ============================================================================

ALTER TABLE characters DROP COLUMN IF EXISTS unspent_skill_points;

ALTER TABLE class_templates
  DROP COLUMN IF EXISTS locked_skills,
  DROP COLUMN IF EXISTS free_skill_points;

ALTER TABLE retainer_types
  DROP COLUMN IF EXISTS skill_key,
  DROP COLUMN IF EXISTS skill_level;

-- ============================================================================
-- 3. CLEAN UP XP CONFIG
-- ============================================================================

DELETE FROM xp_config
WHERE config_key IN ('skill_daily_cap_per_skill', 'skill_segments_per_level', 'levelup_skill_points');

-- ============================================================================
-- 4. NARROW character_xp_log SOURCE ENUM (remove skill_levelup)
-- ============================================================================

ALTER TABLE character_xp_log
  MODIFY COLUMN source ENUM('combat', 'dm_award', 'playtime') NOT NULL;

-- ============================================================================
-- 5. UPDATE ALL 17 TEMPLATES — new aptitude budget
--    Base minimum: 1 (was 2). Total locked + free = 32 for all templates.
-- ============================================================================

-- NOBILITY
UPDATE class_templates SET
  locked_aptitudes = '{"prowess":3,"fortitude":2,"command":5,"cunning":2,"stewardship":4,"presence":4,"lore":2,"faith":2}',
  free_aptitude_points = 8
WHERE template_key = 'noble_lord';

UPDATE class_templates SET
  locked_aptitudes = '{"prowess":1,"fortitude":1,"command":2,"cunning":5,"stewardship":4,"presence":4,"lore":3,"faith":1}',
  free_aptitude_points = 11
WHERE template_key = 'noble_lady';

-- MILITARY
UPDATE class_templates SET
  locked_aptitudes = '{"prowess":5,"fortitude":4,"command":4,"cunning":1,"stewardship":1,"presence":1,"lore":1,"faith":1}',
  free_aptitude_points = 14
WHERE template_key = 'knight';

UPDATE class_templates SET
  locked_aptitudes = '{"prowess":5,"fortitude":5,"command":1,"cunning":1,"stewardship":1,"presence":1,"lore":1,"faith":1}',
  free_aptitude_points = 16
WHERE template_key = 'hedge_knight';

UPDATE class_templates SET
  locked_aptitudes = '{"prowess":4,"fortitude":5,"command":3,"cunning":1,"stewardship":1,"presence":1,"lore":1,"faith":1}',
  free_aptitude_points = 15
WHERE template_key = 'man_at_arms';

UPDATE class_templates SET
  locked_aptitudes = '{"prowess":5,"fortitude":3,"command":1,"cunning":4,"stewardship":1,"presence":1,"lore":1,"faith":1}',
  free_aptitude_points = 15
WHERE template_key = 'sellsword';

UPDATE class_templates SET
  locked_aptitudes = '{"prowess":3,"fortitude":4,"command":1,"cunning":3,"stewardship":1,"presence":1,"lore":3,"faith":1}',
  free_aptitude_points = 15
WHERE template_key = 'ranger';

-- RELIGIOUS
UPDATE class_templates SET
  locked_aptitudes = '{"prowess":1,"fortitude":1,"command":1,"cunning":1,"stewardship":2,"presence":4,"lore":3,"faith":5}',
  free_aptitude_points = 14
WHERE template_key = 'septon';

-- SCHOLARLY
UPDATE class_templates SET
  locked_aptitudes = '{"prowess":1,"fortitude":1,"command":1,"cunning":4,"stewardship":3,"presence":1,"lore":5,"faith":1}',
  free_aptitude_points = 15
WHERE template_key = 'maester';

-- COMMERCE
UPDATE class_templates SET
  locked_aptitudes = '{"prowess":1,"fortitude":1,"command":1,"cunning":4,"stewardship":5,"presence":4,"lore":1,"faith":1}',
  free_aptitude_points = 14
WHERE template_key = 'merchant';

UPDATE class_templates SET
  locked_aptitudes = '{"prowess":1,"fortitude":4,"command":1,"cunning":1,"stewardship":5,"presence":1,"lore":3,"faith":1}',
  free_aptitude_points = 15
WHERE template_key = 'artisan';

-- CRIMINAL
UPDATE class_templates SET
  locked_aptitudes = '{"prowess":1,"fortitude":1,"command":1,"cunning":5,"stewardship":1,"presence":4,"lore":3,"faith":1}',
  free_aptitude_points = 15
WHERE template_key = 'spy';

UPDATE class_templates SET
  locked_aptitudes = '{"prowess":1,"fortitude":3,"command":1,"cunning":5,"stewardship":3,"presence":1,"lore":1,"faith":1}',
  free_aptitude_points = 16
WHERE template_key = 'smuggler';

UPDATE class_templates SET
  locked_aptitudes = '{"prowess":4,"fortitude":3,"command":1,"cunning":4,"stewardship":1,"presence":1,"lore":1,"faith":1}',
  free_aptitude_points = 16
WHERE template_key = 'outlaw';

-- COMMON
UPDATE class_templates SET
  locked_aptitudes = '{"prowess":1,"fortitude":3,"command":1,"cunning":1,"stewardship":1,"presence":1,"lore":5,"faith":4}',
  free_aptitude_points = 15
WHERE template_key = 'healer';

UPDATE class_templates SET
  locked_aptitudes = '{"prowess":3,"fortitude":4,"command":3,"cunning":1,"stewardship":1,"presence":1,"lore":1,"faith":1}',
  free_aptitude_points = 17
WHERE template_key = 'sailor';

UPDATE class_templates SET
  locked_aptitudes = '{"prowess":1,"fortitude":1,"command":1,"cunning":1,"stewardship":1,"presence":1,"lore":1,"faith":1}',
  free_aptitude_points = 24
WHERE template_key = 'smallfolk';

SELECT 'Migration 023 complete — skills system removed, templates updated to 32-point aptitude budget' AS Status;
