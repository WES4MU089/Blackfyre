-- ============================================
-- Migration 006: Unspent Allocation Points
-- Tracks free aptitude/skill points available to spend
-- (earned via level-ups, 1 aptitude + 3 skill per level)
-- ============================================

USE blackfyre_hud;

ALTER TABLE characters
    ADD COLUMN unspent_aptitude_points TINYINT UNSIGNED DEFAULT 0 AFTER experience,
    ADD COLUMN unspent_skill_points TINYINT UNSIGNED DEFAULT 0 AFTER unspent_aptitude_points;

SELECT 'Migration 006 complete — unspent allocation point columns added.' AS Status;
