-- Migration: Add Discord OAuth columns to players table
-- Run this after the initial schema is created

USE blackfyre_hud;

-- Add Discord authentication columns
ALTER TABLE players
    ADD COLUMN discord_id VARCHAR(20) UNIQUE AFTER sl_legacy_name,
    ADD COLUMN discord_username VARCHAR(100) AFTER discord_id,
    ADD COLUMN discord_email VARCHAR(255) AFTER discord_username;

-- Make sl_uuid nullable (Discord users may not have SL linked yet)
ALTER TABLE players
    MODIFY COLUMN sl_uuid VARCHAR(36) NULL DEFAULT NULL;

-- Add index on discord_id for OAuth lookups
CREATE INDEX idx_discord_id ON players(discord_id);
