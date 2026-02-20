-- Migration 026: Per-tier aptitude caps for retainers
-- Each tier has its own maximum aptitude value instead of a flat cap.

USE blackfyre_hud;

ALTER TABLE retainer_tiers
  ADD COLUMN aptitude_cap TINYINT UNSIGNED NOT NULL DEFAULT 7
    COMMENT 'Maximum value for any single aptitude at this tier';

UPDATE retainer_tiers SET aptitude_cap = 4 WHERE tier = 1;
UPDATE retainer_tiers SET aptitude_cap = 5 WHERE tier = 2;
UPDATE retainer_tiers SET aptitude_cap = 6 WHERE tier = 3;
UPDATE retainer_tiers SET aptitude_cap = 7 WHERE tier = 4;
UPDATE retainer_tiers SET aptitude_cap = 8 WHERE tier = 5;

SELECT tier, name, aptitude_budget, aptitude_cap FROM retainer_tiers ORDER BY tier;
