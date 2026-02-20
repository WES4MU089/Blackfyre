-- Migration 007: Add SL verification code columns to user table
-- Stores temporary verification codes for SL account linking

ALTER TABLE user ADD COLUMN SLVerificationCode VARCHAR(8);
ALTER TABLE user ADD COLUMN SLVerificationCodeExpiresAt DATETIME;
