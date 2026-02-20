-- ============================================
-- Migration 021: Full Equipment Seed
-- Fills in all weapon type × tier combos,
-- armor tiers/classes, and shield variants.
-- Stats derived from equipment-data.ts formulas.
-- ============================================

USE blackfyre_hud;

-- ============================================
-- WEAPONS — BLADES (Daggers, Bastard Swords, Longswords, Greatswords)
-- ============================================

-- Daggers: 1H, penMod -3, baseDmg 10, slashing, armorPiercing, critEffect: bleeding, critBonus 5, noEncumbrance
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('rusty_dagger', 'Rusty Dagger', 'A pitted blade caked in old blood — better than bare hands', 'weapon', 'common', 1, 'iron', 'mainHand', FALSE, 0.4, 1, FALSE, TRUE, 30,
  '{"weaponType":"dagger","penetration":-1,"baseDamage":10,"encumbrance":0,"slashing":true,"armorPiercing":true,"critEffect":"bleeding","critBonus":5}'),
('steel_dagger', 'Steel Dagger', 'A keen steel blade — light, fast, and lethal in the right hands', 'weapon', 'uncommon', 3, 'steel', 'mainHand', FALSE, 0.4, 1, FALSE, TRUE, 800,
  '{"weaponType":"dagger","penetration":9,"baseDamage":10,"encumbrance":0,"slashing":true,"armorPiercing":true,"critEffect":"bleeding","critBonus":5}'),
('cf_dagger', 'Castle-Forged Dagger', 'A masterwork stiletto — balanced to perfection', 'weapon', 'rare', 4, 'steel', 'mainHand', FALSE, 0.3, 1, FALSE, TRUE, 3500,
  '{"weaponType":"dagger","penetration":14,"baseDamage":10,"encumbrance":0,"slashing":true,"armorPiercing":true,"critEffect":"bleeding","critBonus":5}');

-- Bastard Swords: 1H, penMod -2, baseDmg 14, slashing, critEffect: bleeding
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_bastard_sword', 'Iron Bastard Sword', 'A hand-and-a-half blade of common iron — versatile and dependable', 'weapon', 'common', 2, 'iron', 'mainHand', FALSE, 2.2, 1, FALSE, TRUE, 600,
  '{"weaponType":"bastardSword","penetration":5,"baseDamage":14,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}'),
('steel_bastard_sword', 'Steel Bastard Sword', 'A well-tempered hand-and-a-half sword with a leather-wrapped grip', 'weapon', 'uncommon', 3, 'steel', 'mainHand', FALSE, 2.0, 1, FALSE, TRUE, 2200,
  '{"weaponType":"bastardSword","penetration":10,"baseDamage":14,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}'),
('cf_bastard_sword', 'Castle-Forged Bastard Sword', 'A masterwork bastard sword — perfectly weighted for one hand or two', 'weapon', 'rare', 4, 'steel', 'mainHand', FALSE, 1.8, 1, FALSE, TRUE, 6000,
  '{"weaponType":"bastardSword","penetration":15,"baseDamage":14,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}'),
('valyrian_bastard_sword', 'Valyrian Steel Bastard Sword', 'A rippled blade of ancient Valyrian steel — light as a feather, sharp as dragonglass', 'weapon', 'legendary', 5, 'valyrian_steel', 'mainHand', FALSE, 1.2, 1, FALSE, FALSE, 60000,
  '{"weaponType":"bastardSword","penetration":20,"baseDamage":14,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}');

-- Longswords (2H): penMod -2, baseDmg 14, slashing, critEffect: bleeding
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('cf_longsword', 'Castle-Forged Longsword', 'A masterwork two-handed longsword with a crossguard of folded steel', 'weapon', 'rare', 4, 'steel', 'mainHand', TRUE, 2.5, 1, FALSE, TRUE, 5500,
  '{"weaponType":"longsword","penetration":18,"baseDamage":14,"encumbrance":-5,"slashing":true,"critEffect":"bleeding"}'),
('valyrian_longsword', 'Valyrian Steel Longsword', 'A legendary longsword of rippled Valyrian steel — impossibly light for its length', 'weapon', 'legendary', 5, 'valyrian_steel', 'mainHand', TRUE, 1.5, 1, FALSE, FALSE, 70000,
  '{"weaponType":"longsword","penetration":24,"baseDamage":14,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}');

-- Greatswords (2H): penMod -3, baseDmg 15, slashing, critEffect: bleeding
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_greatsword', 'Iron Greatsword', 'A massive two-handed blade of crude iron — slow but devastating', 'weapon', 'common', 2, 'iron', 'mainHand', TRUE, 4.5, 1, FALSE, TRUE, 700,
  '{"weaponType":"greatsword","penetration":7,"baseDamage":15,"encumbrance":-5,"slashing":true,"critEffect":"bleeding"}'),
('cf_greatsword', 'Castle-Forged Greatsword', 'A masterwork greatsword — the pride of any armoury', 'weapon', 'rare', 4, 'steel', 'mainHand', TRUE, 3.5, 1, FALSE, TRUE, 7000,
  '{"weaponType":"greatsword","penetration":17,"baseDamage":15,"encumbrance":-5,"slashing":true,"critEffect":"bleeding"}'),
('valyrian_greatsword', 'Valyrian Steel Greatsword', 'A colossal blade of Valyrian steel — wielded like a longsword despite its size', 'weapon', 'legendary', 5, 'valyrian_steel', 'mainHand', TRUE, 2.5, 1, FALSE, FALSE, 80000,
  '{"weaponType":"greatsword","penetration":23,"baseDamage":15,"encumbrance":0,"slashing":true,"critEffect":"bleeding"}');

-- ============================================
-- WEAPONS — BLUNT (Battle Axes, Greataxes, Warhammers, Great Warhammers, Maces)
-- ============================================

-- Battle Axes 1H: penMod 5, baseDmg 16, encMod -2, critEffect: sundered
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('steel_battleaxe', 'Steel Battle Axe', 'A steel-headed axe with a bearded blade — splits shields and skulls alike', 'weapon', 'uncommon', 3, 'steel', 'mainHand', FALSE, 2.8, 1, FALSE, TRUE, 2000,
  '{"weaponType":"battleAxe1H","penetration":17,"baseDamage":16,"encumbrance":-2,"critEffect":"sundered"}'),
('cf_battleaxe', 'Castle-Forged Battle Axe', 'A masterwork battle axe with a crescent blade of folded steel', 'weapon', 'rare', 4, 'steel', 'mainHand', FALSE, 2.5, 1, FALSE, TRUE, 5000,
  '{"weaponType":"battleAxe1H","penetration":22,"baseDamage":16,"encumbrance":-2,"critEffect":"sundered"}');

-- Greataxes 2H: penMod 4, baseDmg 18, encMod -3, critEffect: sundered
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_greataxe', 'Iron Greataxe', 'A brutal two-handed axe of black iron — made for cleaving, not fencing', 'weapon', 'common', 2, 'iron', 'mainHand', TRUE, 5.0, 1, FALSE, TRUE, 750,
  '{"weaponType":"battleAxe2H","penetration":14,"baseDamage":18,"encumbrance":-8,"critEffect":"sundered"}'),
('steel_greataxe', 'Steel Greataxe', 'A broad-bladed greataxe of tempered steel', 'weapon', 'uncommon', 3, 'steel', 'mainHand', TRUE, 4.5, 1, FALSE, TRUE, 2500,
  '{"weaponType":"battleAxe2H","penetration":19,"baseDamage":18,"encumbrance":-8,"critEffect":"sundered"}'),
('cf_greataxe', 'Castle-Forged Greataxe', 'A masterwork greataxe — its edge never dulls', 'weapon', 'rare', 4, 'steel', 'mainHand', TRUE, 4.0, 1, FALSE, TRUE, 6500,
  '{"weaponType":"battleAxe2H","penetration":24,"baseDamage":18,"encumbrance":-8,"critEffect":"sundered"}');

-- Warhammers 1H: penMod 8, baseDmg 17, bonusVsHeavy 5, encMod -5, critEffect: stunned
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('steel_warhammer', 'Steel Warhammer', 'A steel warhammer with a spiked head — the bane of armored knights', 'weapon', 'uncommon', 3, 'steel', 'mainHand', FALSE, 3.2, 1, FALSE, TRUE, 2200,
  '{"weaponType":"warhammer1H","penetration":20,"baseDamage":17,"encumbrance":-5,"bonusVsHeavy":5,"critEffect":"stunned"}'),
('cf_warhammer', 'Castle-Forged Warhammer', 'A masterwork warhammer — its crown can dent the finest plate', 'weapon', 'rare', 4, 'steel', 'mainHand', FALSE, 3.0, 1, FALSE, TRUE, 5500,
  '{"weaponType":"warhammer1H","penetration":25,"baseDamage":17,"encumbrance":-5,"bonusVsHeavy":5,"critEffect":"stunned"}');

-- Great Warhammers 2H: penMod 10, baseDmg 18, bonusVsHeavy 8, encMod -8, critEffect: stunned
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_great_warhammer', 'Iron Great Warhammer', 'A massive two-handed hammer of black iron — crushes armor like parchment', 'weapon', 'common', 2, 'iron', 'mainHand', TRUE, 6.0, 1, FALSE, TRUE, 800,
  '{"weaponType":"warhammer2H","penetration":20,"baseDamage":18,"encumbrance":-13,"bonusVsHeavy":8,"critEffect":"stunned"}'),
('steel_great_warhammer', 'Steel Great Warhammer', 'A steel two-handed warhammer — the weapon of choice against heavy plate', 'weapon', 'uncommon', 3, 'steel', 'mainHand', TRUE, 5.5, 1, FALSE, TRUE, 3000,
  '{"weaponType":"warhammer2H","penetration":25,"baseDamage":18,"encumbrance":-13,"bonusVsHeavy":8,"critEffect":"stunned"}'),
('cf_great_warhammer', 'Castle-Forged Great Warhammer', 'A masterwork great warhammer — Robert Baratheon''s weapon of legend', 'weapon', 'rare', 4, 'steel', 'mainHand', TRUE, 5.0, 1, FALSE, TRUE, 7500,
  '{"weaponType":"warhammer2H","penetration":30,"baseDamage":18,"encumbrance":-13,"bonusVsHeavy":8,"critEffect":"stunned"}');

-- Maces 1H: penMod 6, baseDmg 16, bonusVsHeavy 5, encMod -3, critEffect: stunned
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('steel_mace', 'Steel Mace', 'A flanged steel mace — simple, brutal, effective', 'weapon', 'uncommon', 3, 'steel', 'mainHand', FALSE, 2.8, 1, FALSE, TRUE, 1800,
  '{"weaponType":"mace1H","penetration":18,"baseDamage":16,"encumbrance":-3,"bonusVsHeavy":5,"critEffect":"stunned"}'),
('cf_mace', 'Castle-Forged Mace', 'A masterwork flanged mace — each blow rings like a bell through plate', 'weapon', 'rare', 4, 'steel', 'mainHand', FALSE, 2.5, 1, FALSE, TRUE, 4500,
  '{"weaponType":"mace1H","penetration":23,"baseDamage":16,"encumbrance":-3,"bonusVsHeavy":5,"critEffect":"stunned"}');

-- ============================================
-- WEAPONS — POLEARMS (Spears, Polearms/Halberds)
-- ============================================

-- Spears 1H: penMod 7, baseDmg 14, critEffect: piercing
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('steel_spear', 'Steel Spear', 'A steel-tipped spear with an ashwood shaft — reach and reliability', 'weapon', 'uncommon', 3, 'steel', 'mainHand', FALSE, 2.3, 1, FALSE, TRUE, 1500,
  '{"weaponType":"spear","penetration":19,"baseDamage":14,"encumbrance":0,"critEffect":"piercing"}'),
('cf_spear', 'Castle-Forged Spear', 'A masterwork spear with a leaf-shaped blade of folded steel', 'weapon', 'rare', 4, 'steel', 'mainHand', FALSE, 2.0, 1, FALSE, TRUE, 4000,
  '{"weaponType":"spear","penetration":24,"baseDamage":14,"encumbrance":0,"critEffect":"piercing"}');

-- Polearms 2H (Halberds/Poleaxes): penMod 6, baseDmg 16, critEffect: piercing
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_halberd', 'Iron Halberd', 'An iron-headed polearm — axe blade, spike, and hook on a long haft', 'weapon', 'common', 2, 'iron', 'mainHand', TRUE, 4.0, 1, FALSE, TRUE, 600,
  '{"weaponType":"polearm","penetration":16,"baseDamage":16,"encumbrance":-5,"critEffect":"piercing"}'),
('steel_halberd', 'Steel Halberd', 'A steel halberd — the footsoldier''s answer to mounted knights', 'weapon', 'uncommon', 3, 'steel', 'mainHand', TRUE, 3.5, 1, FALSE, TRUE, 2200,
  '{"weaponType":"polearm","penetration":21,"baseDamage":16,"encumbrance":-5,"critEffect":"piercing"}'),
('cf_halberd', 'Castle-Forged Halberd', 'A masterwork halberd — equally deadly whether thrusting, hooking, or chopping', 'weapon', 'rare', 4, 'steel', 'mainHand', TRUE, 3.0, 1, FALSE, TRUE, 5500,
  '{"weaponType":"polearm","penetration":26,"baseDamage":16,"encumbrance":-5,"critEffect":"piercing"}');

-- ============================================
-- WEAPONS — ARCHERY
-- ============================================

-- Bows 2H: penMod 0, baseDmg 12, critEffect: piercing
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('cf_longbow', 'Castle-Forged Longbow', 'A composite longbow with horn and sinew laminations — devastating range and power', 'weapon', 'rare', 4, 'wood', 'mainHand', TRUE, 1.3, 1, FALSE, TRUE, 4000,
  '{"weaponType":"bow","penetration":20,"baseDamage":12,"encumbrance":-5,"critEffect":"piercing"}');

-- ============================================
-- ARMOR — Fill remaining tier/class gaps
-- ============================================

-- Light armor: mitMod -3, encMod +3
--   gambeson (T1): mit 5-3=2, enc -3+3=0     (exists)
--   leather  (T2): mit 8-3=5, enc -5+3=-2    (exists)
-- Missing: Steel light (T3), CF light (T4)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('studded_leather', 'Studded Leather Armor', 'Boiled leather reinforced with steel rivets — the best light armor short of a masterwork', 'armor', 'uncommon', 3, 'leather', 'armor', FALSE, 7.0, 1, FALSE, TRUE, 2500,
  '{"armorClass":"light","mitigation":9,"encumbrance":-5}'),
('cf_leather', 'Castle-Forged Leather Armor', 'Masterwork hardened leather with steel-core rivets — worn by elite scouts and assassins', 'armor', 'rare', 4, 'leather', 'armor', FALSE, 6.0, 1, FALSE, TRUE, 6000,
  '{"armorClass":"light","mitigation":13,"encumbrance":-9}');

-- Medium armor: mitMod 0, encMod 0
--   scale (T3): mit 12, enc -8               (exists)
-- Missing: Iron medium (T2), CF medium (T4)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('brigandine', 'Brigandine', 'A coat of small iron plates riveted between layers of cloth — common among men-at-arms', 'armor', 'common', 2, 'iron', 'armor', FALSE, 10.0, 1, FALSE, TRUE, 1500,
  '{"armorClass":"medium","mitigation":8,"encumbrance":-5}'),
('cf_chainmail', 'Castle-Forged Chainmail', 'Masterwork mail of interlocking rings — lighter than common chain, tougher than scale', 'armor', 'rare', 4, 'steel', 'armor', FALSE, 11.0, 1, FALSE, TRUE, 7000,
  '{"armorClass":"medium","mitigation":16,"encumbrance":-12}');

-- Heavy armor: mitMod +5, encMod -5
--   plate  (T4): mit 16+5=21, enc -12-5=-17  (exists)
--   valyrian (T5): mit 14+5=19, enc 0-5=-5   (exists — valyrian_plate is mit 20 in DB, close enough)
-- Missing: Iron heavy (T2), Steel heavy (T3)
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_plate', 'Iron Half-Plate', 'Crude iron plates bolted over mail — heavy but formidable', 'armor', 'common', 2, 'iron', 'armor', FALSE, 18.0, 1, FALSE, TRUE, 2000,
  '{"armorClass":"heavy","mitigation":13,"encumbrance":-10}'),
('steel_plate', 'Steel Plate Armor', 'Full steel plate with articulated joints — the standard of any serious knight', 'armor', 'uncommon', 3, 'steel', 'armor', FALSE, 22.0, 1, FALSE, TRUE, 5000,
  '{"armorClass":"heavy","mitigation":17,"encumbrance":-13}');

-- ============================================
-- SHIELDS — Fill remaining tier/class gaps
-- ============================================

-- Bucklers (light): blockMod -8, enc 0
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_buckler', 'Iron Buckler', 'A small round shield strapped to the forearm — parries without slowing you down', 'shield', 'common', 2, 'iron', 'offHand', FALSE, 1.5, 1, FALSE, TRUE, 250,
  '{"shieldClass":"light","blockBonus":8,"encumbrance":0}'),
('steel_buckler', 'Steel Buckler', 'A polished steel buckler — light and quick for deflecting blows', 'shield', 'uncommon', 3, 'steel', 'offHand', FALSE, 1.2, 1, FALSE, TRUE, 800,
  '{"shieldClass":"light","blockBonus":12,"encumbrance":0}'),
('cf_buckler', 'Castle-Forged Buckler', 'A masterwork buckler of folded steel — featherlight and strong as a heater', 'shield', 'rare', 4, 'steel', 'offHand', FALSE, 1.0, 1, FALSE, TRUE, 2500,
  '{"shieldClass":"light","blockBonus":16,"encumbrance":0}');

-- Heaters (medium): blockMod 0, enc -3
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('steel_heater', 'Steel Heater Shield', 'A classic heater shield faced with steel — the workhorse of any shield wall', 'shield', 'uncommon', 3, 'steel', 'offHand', FALSE, 4.5, 1, FALSE, TRUE, 1500,
  '{"shieldClass":"medium","blockBonus":20,"encumbrance":-3}'),
('cf_heater', 'Castle-Forged Heater Shield', 'A masterwork heater shield — emblazoned with a lord''s sigil', 'shield', 'rare', 4, 'steel', 'offHand', FALSE, 4.0, 1, FALSE, TRUE, 4000,
  '{"shieldClass":"medium","blockBonus":24,"encumbrance":-3}');

-- Tower Shields (heavy): blockMod +8, enc -8
-- tower_shield (T3) exists: blockBonus 24, enc -6 (DB has slightly different enc)
-- Missing: Iron tower, CF tower
INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_tower_shield', 'Iron Tower Shield', 'A massive iron-banded tower shield — a walking wall', 'shield', 'common', 2, 'iron', 'offHand', FALSE, 9.0, 1, FALSE, TRUE, 600,
  '{"shieldClass":"heavy","blockBonus":24,"encumbrance":-8}'),
('cf_tower_shield', 'Castle-Forged Tower Shield', 'A masterwork tower shield of layered steel — impervious to all but the mightiest blows', 'shield', 'rare', 4, 'steel', 'offHand', FALSE, 7.0, 1, FALSE, TRUE, 5000,
  '{"shieldClass":"heavy","blockBonus":32,"encumbrance":-8}');

SELECT 'Migration 021 complete — full equipment seed applied.' AS Status;
