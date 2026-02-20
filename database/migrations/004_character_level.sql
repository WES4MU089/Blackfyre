-- ============================================
-- Migration 004: Character Level & Experience
-- Adds level and experience columns to characters table
-- ============================================

USE blackfyre_hud;

ALTER TABLE characters
    ADD COLUMN level INT UNSIGNED DEFAULT 1 AFTER portrait_url,
    ADD COLUMN experience BIGINT DEFAULT 0 AFTER level;

SELECT 'Migration 004 complete — character level & experience columns added.' AS Status;
