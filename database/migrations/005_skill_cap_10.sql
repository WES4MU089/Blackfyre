-- ============================================
-- Migration 005: Skill Level Cap → 10
-- Changes max_level from 100 to 10 for all skills
-- to match the aptitude cap of 10
-- ============================================

USE blackfyre_hud;

UPDATE skills SET max_level = 10;

SELECT 'Migration 005 complete — skill max_level capped at 10.' AS Status;
