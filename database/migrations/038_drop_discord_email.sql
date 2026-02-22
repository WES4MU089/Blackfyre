-- Migration 038: Drop discord_email and ip_address columns
-- We no longer request or store the user's Discord email address.
-- The OAuth scope has been reduced from 'identify email' to 'identify'.
-- We also do not collect or store IP addresses.

USE blackfyre_hud;

ALTER TABLE players DROP COLUMN discord_email;
ALTER TABLE tos_acceptances DROP COLUMN ip_address;

SELECT 'Migration 038 complete — discord_email and ip_address columns dropped.' AS Status;
