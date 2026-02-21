-- Migration 029: Add SL verification columns to players table
-- Used by the Electron HUD to generate a code that links Discord -> SL avatar

ALTER TABLE players
    ADD COLUMN sl_verification_code VARCHAR(8) DEFAULT NULL,
    ADD COLUMN sl_verification_expires_at DATETIME DEFAULT NULL;
