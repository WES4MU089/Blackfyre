-- Migration 013: Add encumbrance to weapons and shields
-- Encumbrance is a negative modifier applied to DEFENSE rolls.
-- Heavier gear = harder to dodge/parry = easier to hit.
--
-- Sources of encumbrance:
--   armor  → already has encumbrance values (mig 011)
--   weapon → blunt weapons and 2H weapons are heavy (this migration)
--   shield → medium/heavy shields slow you down (this migration)
--
-- Weapons already with encumbrance:
--   steel_greatsword: -5 (2H sword)
--   war_scythe: -3 (2H polearm)
--
-- Values aligned with Project Westeros combat simulator.

-- Blunt weapons: heavy swing recovery
UPDATE items SET model_data = JSON_SET(model_data, '$.encumbrance', -5)
WHERE item_key = 'iron_warhammer';

UPDATE items SET model_data = JSON_SET(model_data, '$.encumbrance', -3)
WHERE item_key = 'iron_mace';

-- Axes: moderate weight
UPDATE items SET model_data = JSON_SET(model_data, '$.encumbrance', -2)
WHERE item_key = 'iron_battleaxe';

-- Steel lance: heavy mounted weapon
UPDATE items SET model_data = JSON_SET(model_data, '$.encumbrance', -5)
WHERE item_key = 'steel_lance';

-- Iron shield (kite shield): medium shield encumbrance
UPDATE items SET model_data = JSON_SET(model_data, '$.encumbrance', -3)
WHERE item_key = 'iron_shield';

SELECT 'Migration 013 complete — weapon and shield encumbrance values applied.' AS Status;
