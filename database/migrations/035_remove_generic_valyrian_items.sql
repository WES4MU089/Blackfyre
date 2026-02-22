-- ============================================
-- Migration 035: Remove Generic Valyrian Steel Items
-- Named legendaries (Blackfyre, Dark Sister, Dawn, Ice) remain.
-- Generic unnamed Valyrian weapons/armor are removed.
-- Retainer tier 5 defaults updated to Castle-Forged.
-- ============================================

USE blackfyre_hud;

-- Update tier 5 retainer defaults from valyrian to castle-forged
UPDATE retainer_tiers
SET weapon_key = 'cf_bastard_sword', armor_key = 'plate_armor'
WHERE tier = 5;

-- Remove any equipped generic Valyrian items
DELETE ce FROM character_equipment ce
JOIN items i ON ce.item_id = i.id
WHERE i.item_key IN ('valyrian_bastard_sword','valyrian_dagger','valyrian_greatsword','valyrian_longsword','valyrian_plate');

-- Remove any inventory generic Valyrian items
DELETE ci FROM character_inventory ci
JOIN items i ON ci.item_id = i.id
WHERE i.item_key IN ('valyrian_bastard_sword','valyrian_dagger','valyrian_greatsword','valyrian_longsword','valyrian_plate');

-- Delete the item definitions
DELETE FROM items
WHERE item_key IN ('valyrian_bastard_sword','valyrian_dagger','valyrian_greatsword','valyrian_longsword','valyrian_plate');

SELECT 'Migration 035 complete — generic Valyrian steel items removed.' AS Status;
