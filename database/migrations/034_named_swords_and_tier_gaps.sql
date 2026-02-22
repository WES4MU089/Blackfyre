-- ============================================
-- Migration 034: Named Valyrian Swords, Tier Gap Fills, Longsword Removal
-- - Adds 4 named legendary swords (Blackfyre, Dark Sister, Dawn, Ice)
-- - Fills missing tier 1 weapons across all weapon types
-- - Converts longsword items to greatsword (removing longsword weaponType)
-- ============================================

USE blackfyre_hud;

-- ============================================
-- REMOVE LONGSWORD TYPE — convert to greatsword
-- ============================================

UPDATE items
SET model_data = JSON_SET(model_data, '$.weaponType', 'greatsword'),
    model_data = JSON_SET(model_data, '$.baseDamage', 15)
WHERE item_key IN ('cf_longsword', 'valyrian_longsword');

-- ============================================
-- NAMED VALYRIAN STEEL SWORDS (tier 5)
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('blackfyre', 'Blackfyre', 'The ancestral sword of House Targaryen — a hand-and-a-half blade of dark Valyrian steel, its ripples running black and red', 'weapon', 'legendary', 5, 'valyrian_steel', 'mainHand', FALSE, 1.2, 1, FALSE, FALSE, 100000,
  '{"weaponType":"bastardSword","penetration":20,"baseDamage":14,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}'),
('dark_sister', 'Dark Sister', 'The slender Valyrian steel blade once wielded by Visenya Targaryen — lighter than any greatsword, swift as a viper''s tongue', 'weapon', 'legendary', 5, 'valyrian_steel', 'mainHand', TRUE, 2.0, 1, FALSE, FALSE, 90000,
  '{"weaponType":"greatsword","penetration":23,"baseDamage":15,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}'),
('dawn', 'Dawn', 'The greatsword of House Dayne, forged from the heart of a fallen star — pale as milkglass and alive with light', 'weapon', 'legendary', 5, 'valyrian_steel', 'mainHand', TRUE, 2.5, 1, FALSE, FALSE, 100000,
  '{"weaponType":"greatsword","penetration":23,"baseDamage":15,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}'),
('ice', 'Ice', 'The ancestral greatsword of House Stark — a blade as wide as a man''s hand, taller than a boy, dark as smoke', 'weapon', 'legendary', 5, 'valyrian_steel', 'mainHand', TRUE, 2.5, 1, FALSE, FALSE, 100000,
  '{"weaponType":"greatsword","penetration":23,"baseDamage":15,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}');

-- ============================================
-- FILL TIER 1 GAPS — rustic/crude versions of each weapon type
-- ============================================

-- Bastard Sword tier 1: missing (tier 2 = iron_bastard_sword at pen 5)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('rusty_sword', 'Rusty Sword', 'A battered hand-and-a-half blade, pitted with rust — barely serviceable', 'weapon', 'common', 1, 'iron', 'mainHand', FALSE, 2.5, 1, FALSE, TRUE, 100,
  '{"weaponType":"bastardSword","penetration":2,"baseDamage":14,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}');

-- Greatsword tier 1: missing (tier 2 = iron_greatsword at pen 7)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('rusty_greatsword', 'Rusty Greatsword', 'A huge blade of corroded iron — more a bludgeon than a sword', 'weapon', 'common', 1, 'iron', 'mainHand', TRUE, 5.0, 1, FALSE, TRUE, 150,
  '{"weaponType":"greatsword","penetration":3,"baseDamage":15,"encumbrance":-5,"slashing":true,"critEffect":"bleeding"}');

-- Dagger tier 2: missing (tier 1 = rusty_dagger at pen -1, tier 3 = steel_dagger at pen 9)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_stiletto', 'Iron Stiletto', 'A narrow iron blade meant for thrusting between armor plates', 'weapon', 'common', 2, 'iron', 'mainHand', FALSE, 0.4, 1, FALSE, TRUE, 200,
  '{"weaponType":"dagger","penetration":4,"baseDamage":10,"encumbrance":0,"slashing":true,"armorPiercing":true,"critEffect":"bleeding","critBonus":5}');

-- Mace tier 1: missing (tier 2 = iron_mace)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('wooden_club', 'Wooden Club', 'A gnarled wooden club, little more than a branch — but it cracks skulls all the same', 'weapon', 'common', 1, NULL, 'mainHand', FALSE, 2.0, 1, FALSE, TRUE, 15,
  '{"weaponType":"mace1H","penetration":10,"baseDamage":16,"encumbrance":-3,"bonusVsHeavy":5,"critEffect":"stunned"}');

-- Warhammer 1H tier 1: missing (tier 2 = iron_warhammer)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('crude_hammer', 'Crude Hammer', 'A blacksmith''s hammer repurposed for war — heavy and graceless', 'weapon', 'common', 1, 'iron', 'mainHand', FALSE, 3.5, 1, FALSE, TRUE, 80,
  '{"weaponType":"warhammer1H","penetration":12,"baseDamage":17,"encumbrance":-5,"bonusVsHeavy":5,"critEffect":"stunned"}');

-- Warhammer 2H tier 1: missing (tier 2 = iron_great_warhammer at pen 20)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('sledgehammer', 'Sledgehammer', 'A mason''s sledgehammer — devastatingly slow but crushes anything it hits', 'weapon', 'common', 1, 'iron', 'mainHand', TRUE, 7.0, 1, FALSE, TRUE, 60,
  '{"weaponType":"warhammer2H","penetration":15,"baseDamage":18,"encumbrance":-13,"bonusVsHeavy":8,"critEffect":"stunned"}');

-- Spear tier 1: missing (tier 2 = iron_spear)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('wooden_spear', 'Wooden Spear', 'A fire-hardened wooden spear — the first weapon of mankind', 'weapon', 'common', 1, 'wood', 'mainHand', FALSE, 1.5, 1, FALSE, TRUE, 20,
  '{"weaponType":"spear","penetration":10,"baseDamage":14,"encumbrance":0,"critEffect":"piercing"}');

-- Polearm tier 1: missing (tier 2 = iron_halberd at pen 16)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('pitchfork', 'Pitchfork', 'A peasant''s tool — three iron tines on a long haft, deadly enough in desperate hands', 'weapon', 'common', 1, 'iron', 'mainHand', TRUE, 3.0, 1, FALSE, TRUE, 10,
  '{"weaponType":"polearm","penetration":10,"baseDamage":16,"encumbrance":-5,"critEffect":"piercing"}');

-- Battle Axe 1H tier 1: missing (tier 2 = iron_battleaxe)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('hatchet', 'Hatchet', 'A woodsman''s hatchet — small enough to throw, sharp enough to split a helm', 'weapon', 'common', 1, 'iron', 'mainHand', FALSE, 1.5, 1, FALSE, TRUE, 40,
  '{"weaponType":"battleAxe1H","penetration":10,"baseDamage":16,"encumbrance":-2,"critEffect":"sundered"}');

-- Battle Axe 2H tier 1: missing (tier 2 = iron_greataxe at pen 14)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('woodcutter_axe', 'Woodcutter''s Axe', 'A long-hafted axe meant for felling trees — but men fall just as easy', 'weapon', 'common', 1, 'iron', 'mainHand', TRUE, 4.5, 1, FALSE, TRUE, 50,
  '{"weaponType":"battleAxe2H","penetration":8,"baseDamage":18,"encumbrance":-8,"critEffect":"sundered"}');

-- Bow tier 1: missing (tier 2 = hunting_bow)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('shortbow', 'Shortbow', 'A simple shortbow of bent yew — short range but quick to draw', 'weapon', 'common', 1, 'wood', 'mainHand', TRUE, 0.8, 1, FALSE, TRUE, 100,
  '{"weaponType":"bow","penetration":6,"baseDamage":12,"encumbrance":-5,"critEffect":"piercing"}');

-- Shield tier 1: missing (tier 2 = wooden_shield, iron_buckler, etc.)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('makeshift_shield', 'Makeshift Shield', 'A plank of wood with a leather strap nailed to the back — barely a shield at all', 'shield', 'common', 1, 'wood', 'offHand', FALSE, 3.0, 1, FALSE, TRUE, 20,
  '{"shieldClass":"light","blockBonus":4,"encumbrance":0}');

SELECT 'Migration 034 complete — named swords, tier gaps filled, longsword type removed.' AS Status;
