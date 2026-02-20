-- Migration 027: Survival check system
-- Adds death state tracking to characters and "wounded" persistent status effect.
-- When a player character reaches 0 HP, a Fortitude-based survival roll determines
-- whether they survive (wounded) or enter a dying/dead state.

USE blackfyre_hud;

-- Death state columns on characters table
ALTER TABLE characters
  ADD COLUMN death_state ENUM('alive', 'wounded', 'dying', 'dead') NOT NULL DEFAULT 'alive'
    COMMENT 'Current survival state after reaching 0 HP',
  ADD COLUMN death_timer_expires_at TIMESTAMP NULL DEFAULT NULL
    COMMENT 'Real-time deadline for dying characters. NULL if not dying.',
  ADD COLUMN death_roll_result TINYINT UNSIGNED NULL DEFAULT NULL
    COMMENT 'The d6 roll that determined death state (1-6). NULL if alive/wounded.',
  ADD INDEX idx_death_state (death_state);

-- Insert "wounded" persistent status effect
INSERT INTO status_effects (effect_key, name, description, effect_type, default_duration, effect_data)
VALUES ('wounded', 'Wounded', 'Survived a mortal blow. -2 dice to all combat pools.', 'debuff', 86400,
        '{"combat_dice_penalty": 2}');

-- Verify
SELECT id, name, death_state, death_timer_expires_at FROM characters LIMIT 5;
SELECT id, effect_key, name FROM status_effects WHERE effect_key = 'wounded';
