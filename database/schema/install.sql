-- ============================================================================
-- Dragon's Dominion Database Schema
-- Master Installation Script
-- 
-- Run this file to install the complete database schema
-- Execute from MariaDB command line:
--   mysql -u root -p blackfyre_hud < install.sql
-- ============================================================================

-- Configuration
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS blackfyre_hud 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE blackfyre_hud;

-- ============================================================================
-- INSTALLATION ORDER
-- Files must be loaded in this order due to foreign key dependencies
-- ============================================================================

-- 1. Accounts (no dependencies)
SOURCE d:/Blackfyre/database/schema/01_accounts.sql;

-- 2. Characters (depends on: accounts)
SOURCE d:/Blackfyre/database/schema/02_characters.sql;

-- 3. NPCs (depends on: accounts, characters)
SOURCE d:/Blackfyre/database/schema/03_npcs.sql;

-- 4. Retainers (depends on: characters, npcs)
SOURCE d:/Blackfyre/database/schema/04_retainers.sql;

-- 5. Holdings (depends on: characters)
SOURCE d:/Blackfyre/database/schema/05_holdings.sql;

-- 6. Resources (depends on: holdings)
SOURCE d:/Blackfyre/database/schema/06_resources.sql;

-- 7. Military (depends on: characters, holdings, retainers)
SOURCE d:/Blackfyre/database/schema/07_military.sql;

-- 8. Diplomacy (depends on: characters, holdings)
-- NOTE: This file adds FK constraints to Character, NPC, Holding for Religion
SOURCE d:/Blackfyre/database/schema/08_diplomacy.sql;

-- 9. World Map (depends on: holdings, characters, npcs, armies)
-- NOTE: This file adds FK constraints for Zone references
SOURCE d:/Blackfyre/database/schema/09_world_map.sql;

-- 10. Equipment (depends on: characters, npcs, holdings, skills)
SOURCE d:/Blackfyre/database/schema/10_equipment.sql;

-- 11. Audit (depends on: all other tables)
SOURCE d:/Blackfyre/database/schema/11_audit.sql;

-- ============================================================================
-- POST-INSTALLATION
-- ============================================================================

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Verify installation
SELECT 'Installation complete!' AS Status;

SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    DATA_LENGTH,
    INDEX_LENGTH
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'blackfyre_hud'
ORDER BY TABLE_NAME;

-- Show procedure count
SELECT COUNT(*) AS 'Stored Procedures' FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = 'blackfyre_hud' AND ROUTINE_TYPE = 'PROCEDURE';

-- Show view count
SELECT COUNT(*) AS 'Views' FROM information_schema.VIEWS 
WHERE TABLE_SCHEMA = 'blackfyre_hud';

-- Show trigger count
SELECT COUNT(*) AS 'Triggers' FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = 'blackfyre_hud';
