-- ============================================
-- Migration 011: Item Seed Expansion
-- Adds ~50 new items across all categories
-- ============================================

USE blackfyre_hud;

-- ============================================
-- CLOTHING (equippable, no combat stats)
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('peasant_tunic', 'Peasant Tunic', 'A rough-spun tunic of undyed wool', 'clothing', 'common', 1, 'cloth', 'armor', FALSE, 0.5, 1, FALSE, TRUE, 20, NULL),
('noble_doublet', 'Noble Doublet', 'A finely tailored doublet of rich velvet with gold thread accents', 'clothing', 'uncommon', 2, 'cloth', 'armor', FALSE, 0.8, 1, FALSE, TRUE, 1200, NULL),
('fur_cloak', 'Fur Cloak', 'A heavy cloak of northern fur, warding against bitter cold', 'clothing', 'uncommon', 2, 'leather', 'armor', FALSE, 2.0, 1, FALSE, TRUE, 600, NULL),
('silk_gown', 'Silk Gown', 'An elegant gown of Myrish silk, fit for court', 'clothing', 'rare', 3, 'cloth', 'armor', FALSE, 0.6, 1, FALSE, TRUE, 3000, NULL),
('maester_robes', 'Maester Robes', 'Grey robes of the Citadel, bearing a chain of many links', 'clothing', 'uncommon', 2, 'cloth', 'armor', FALSE, 1.0, 1, FALSE, FALSE, 500, NULL),
('septon_vestments', 'Septon Vestments', 'White-and-gold vestments of the Faith of the Seven', 'clothing', 'uncommon', 2, 'cloth', 'armor', FALSE, 0.8, 1, FALSE, FALSE, 400, NULL),
('night_watch_blacks', 'Night Watch Blacks', 'The heavy black woolens of a sworn brother', 'clothing', 'common', 2, 'cloth', 'armor', FALSE, 2.5, 1, FALSE, FALSE, 150, NULL),
('leather_boots', 'Leather Boots', 'Sturdy riding boots of cured leather', 'clothing', 'common', 1, 'leather', 'accessory', FALSE, 1.0, 1, FALSE, TRUE, 80, NULL),
('riding_gloves', 'Riding Gloves', 'Supple calfskin gloves for grip and warmth', 'clothing', 'common', 1, 'leather', 'accessory', FALSE, 0.2, 1, FALSE, TRUE, 50, NULL);

-- ============================================
-- DOCUMENTS
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('sealed_letter', 'Sealed Letter', 'A folded parchment bearing a wax seal. The contents are unknown.', 'document', 'common', 0, NULL, NULL, FALSE, 0.05, 10, TRUE, TRUE, 5, NULL),
('royal_decree', 'Royal Decree', 'A proclamation stamped with the king''s own sigil', 'document', 'rare', 0, NULL, NULL, FALSE, 0.05, 1, TRUE, FALSE, 0, NULL),
('wanted_poster', 'Wanted Poster', 'A crude illustration of a criminal with a bounty listed beneath', 'document', 'common', 0, NULL, NULL, FALSE, 0.02, 10, FALSE, TRUE, 2, NULL),
('trade_manifest', 'Trade Manifest', 'A detailed ledger of goods, weights, and prices for a merchant caravan', 'document', 'common', 0, NULL, NULL, FALSE, 0.1, 5, TRUE, TRUE, 25, NULL),
('treasure_map', 'Treasure Map', 'A weathered map with a location marked in faded red ink', 'document', 'rare', 0, NULL, NULL, FALSE, 0.05, 1, TRUE, TRUE, 500, NULL),
('book_of_lineages', 'Book of Lineages', 'A heavy tome recording the bloodlines of noble houses', 'document', 'uncommon', 0, NULL, NULL, FALSE, 2.0, 1, TRUE, TRUE, 300, NULL),
('confession_scroll', 'Confession Scroll', 'A signed confession extracted under... persuasion', 'document', 'uncommon', 0, NULL, NULL, FALSE, 0.05, 5, TRUE, TRUE, 100, NULL);

-- ============================================
-- TOOLS
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('blacksmith_hammer', 'Blacksmith Hammer', 'A heavy hammer for working hot iron at the forge', 'tool', 'common', 1, 'iron', 'ancillary', FALSE, 2.0, 1, FALSE, TRUE, 120, NULL),
('fishing_rod', 'Fishing Rod', 'A simple rod of bent wood with a hook and line', 'tool', 'common', 1, 'wood', 'ancillary', FALSE, 0.8, 1, TRUE, TRUE, 30, NULL),
('pickaxe', 'Pickaxe', 'An iron-headed pickaxe for breaking stone and ore', 'tool', 'common', 1, 'iron', 'ancillary', FALSE, 3.0, 1, FALSE, TRUE, 80, NULL),
('sewing_kit', 'Sewing Kit', 'Needles, thread, and thimbles wrapped in oilcloth', 'tool', 'common', 0, NULL, 'ancillary', FALSE, 0.3, 1, TRUE, TRUE, 40, NULL),
('herbalist_pouch', 'Herbalist Pouch', 'A leather pouch of dried herbs, seeds, and tincture vials', 'tool', 'uncommon', 1, 'leather', 'ancillary', FALSE, 0.5, 1, TRUE, TRUE, 200, NULL),
('mason_chisel', 'Mason Chisel', 'A steel chisel for cutting and shaping stone blocks', 'tool', 'common', 1, 'steel', 'ancillary', FALSE, 0.8, 1, FALSE, TRUE, 60, NULL),
('alchemist_kit', 'Alchemist Kit', 'Glass vials, a mortar and pestle, and a small brazier for distillation', 'tool', 'rare', 2, NULL, 'ancillary', FALSE, 2.5, 1, TRUE, TRUE, 800, NULL),
('lockpick_set', 'Lockpick Set', 'A roll of slender picks and tension wrenches hidden in leather', 'tool', 'uncommon', 2, 'steel', 'ancillary', FALSE, 0.2, 1, TRUE, FALSE, 350, NULL),
('cartography_kit', 'Cartography Kit', 'Inks, quills, compasses, and blank vellum for mapmaking', 'tool', 'uncommon', 1, NULL, 'ancillary', FALSE, 1.0, 1, TRUE, TRUE, 250, NULL);

-- ============================================
-- KEYS (all non-tradeable)
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_key', 'Iron Key', 'A plain iron key, well-worn from use', 'key', 'common', 0, 'iron', NULL, FALSE, 0.1, 10, TRUE, FALSE, 0, NULL),
('ornate_key', 'Ornate Key', 'A gilded key bearing a house sigil on its bow', 'key', 'uncommon', 0, NULL, NULL, FALSE, 0.1, 5, TRUE, FALSE, 0, NULL),
('dungeon_key', 'Dungeon Key', 'A heavy key for the black cells below a keep', 'key', 'uncommon', 0, 'iron', NULL, FALSE, 0.2, 5, TRUE, FALSE, 0, NULL),
('master_key', 'Master Key', 'Opens every lock in a lord''s holdfast', 'key', 'rare', 0, 'steel', NULL, FALSE, 0.1, 1, TRUE, FALSE, 0, NULL),
('chest_key', 'Chest Key', 'A small brass key fitted to a strongbox', 'key', 'common', 0, NULL, NULL, FALSE, 0.05, 10, TRUE, FALSE, 0, NULL);

-- ============================================
-- MOUNTS
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('draft_horse', 'Draft Horse', 'A broad-chested workhorse bred for pulling carts and plows', 'mount', 'common', 1, NULL, NULL, FALSE, 0.0, 1, FALSE, TRUE, 1500, '{"speed":3,"stamina":8,"carryCapacity":120}'),
('destrier', 'Destrier', 'A powerful warhorse trained for the fury of battle', 'mount', 'rare', 3, NULL, NULL, FALSE, 0.0, 1, FALSE, TRUE, 12000, '{"speed":6,"stamina":7,"chargeBonus":8,"armorSlots":1}'),
('courser', 'Courser', 'A swift and agile horse favored by scouts and messengers', 'mount', 'uncommon', 2, NULL, NULL, FALSE, 0.0, 1, FALSE, TRUE, 5000, '{"speed":9,"stamina":5,"carryCapacity":40}'),
('sand_steed', 'Sand Steed', 'A slender Dornish breed, tireless in desert heat', 'mount', 'uncommon', 2, NULL, NULL, FALSE, 0.0, 1, FALSE, TRUE, 6000, '{"speed":8,"stamina":9,"carryCapacity":35}'),
('palfrey', 'Palfrey', 'A gentle riding horse with a smooth gait, suited for long journeys', 'mount', 'common', 1, NULL, NULL, FALSE, 0.0, 1, FALSE, TRUE, 2500, '{"speed":5,"stamina":7,"carryCapacity":50}'),
('mule', 'Mule', 'A stubborn but sure-footed beast of burden', 'mount', 'common', 1, NULL, NULL, FALSE, 0.0, 1, FALSE, TRUE, 800, '{"speed":2,"stamina":10,"carryCapacity":100}');

-- ============================================
-- WEAPONS (additional)
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('iron_dagger', 'Iron Dagger', 'A short iron blade — quick, concealable, and deadly at close range', 'weapon', 'common', 1, 'iron', 'mainHand', FALSE, 0.5, 1, FALSE, TRUE, 150, '{"penetration":3,"baseDamage":8,"penMod":0}'),
('iron_mace', 'Iron Mace', 'A flanged iron mace that caves in helm and bone alike', 'weapon', 'common', 2, 'iron', 'mainHand', FALSE, 3.0, 1, FALSE, TRUE, 450, '{"penetration":18,"baseDamage":12,"penMod":10}'),
('steel_lance', 'Steel Lance', 'A mounted lance of tempered steel tipped with a hardened point', 'weapon', 'uncommon', 3, 'steel', 'mainHand', TRUE, 5.0, 1, FALSE, TRUE, 2500, '{"penetration":20,"baseDamage":18,"penMod":6,"mountedOnly":true}'),
('crossbow', 'Crossbow', 'A heavy crossbow with a windlass crank — slow but devastating', 'weapon', 'uncommon', 3, 'wood', 'mainHand', TRUE, 4.0, 1, FALSE, TRUE, 2000, '{"penetration":22,"baseDamage":16,"penMod":8}'),
('longbow', 'Longbow', 'A yew longbow standing taller than most men, with fearsome range', 'weapon', 'uncommon', 3, 'wood', 'mainHand', TRUE, 1.2, 1, FALSE, TRUE, 1800, '{"penetration":14,"baseDamage":14,"penMod":5}'),
('valyrian_dagger', 'Valyrian Steel Dagger', 'A dagger of Valyrian steel — impossibly sharp and light as a whisper', 'weapon', 'legendary', 5, 'valyrian_steel', 'mainHand', FALSE, 0.3, 1, FALSE, FALSE, 50000, '{"penetration":15,"baseDamage":12,"penMod":2}'),
('war_scythe', 'War Scythe', 'A peasant tool reforged for war — a curved blade on a long haft', 'weapon', 'common', 2, 'iron', 'mainHand', TRUE, 3.5, 1, FALSE, TRUE, 200, '{"penetration":8,"baseDamage":15,"penMod":3,"encumbrance":-3}');

-- ============================================
-- ARMOR / SHIELDS (additional)
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('gambeson', 'Gambeson', 'A padded jacket of quilted linen, worn beneath plate or alone by common soldiers', 'armor', 'common', 1, 'cloth', 'armor', FALSE, 3.0, 1, FALSE, TRUE, 300, '{"mitigation":4,"encumbrance":-2}'),
('scale_armor', 'Scale Armor', 'Overlapping steel scales riveted to a leather backing', 'armor', 'uncommon', 3, 'steel', 'armor', FALSE, 15.0, 1, FALSE, TRUE, 4000, '{"mitigation":14,"encumbrance":-10}'),
('valyrian_plate', 'Valyrian Steel Plate', 'Armor of rippled Valyrian steel — lighter than any plate and harder than any known metal', 'armor', 'legendary', 5, 'valyrian_steel', 'armor', FALSE, 10.0, 1, FALSE, FALSE, 100000, '{"mitigation":20,"encumbrance":-4}'),
('tower_shield', 'Tower Shield', 'A massive rectangular shield that can shelter a man from arrow volleys', 'shield', 'uncommon', 3, 'wood', 'offHand', FALSE, 8.0, 1, FALSE, TRUE, 1500, '{"blockBonus":24,"encumbrance":-6}');

-- ============================================
-- CONSUMABLES (additional)
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('ale', 'Ale', 'A wooden tankard of dark, bitter ale — the drink of the smallfolk', 'consumable', 'common', 0, NULL, NULL, FALSE, 0.5, 10, TRUE, TRUE, 10, NULL),
('arbor_wine', 'Arbor Wine', 'A bottle of fine gold wine from the Arbor', 'consumable', 'uncommon', 0, NULL, NULL, FALSE, 1.0, 5, TRUE, TRUE, 200, NULL),
('venison', 'Venison', 'Salt-cured deer meat, wrapped in cloth for travel', 'consumable', 'common', 0, NULL, NULL, FALSE, 0.8, 10, TRUE, TRUE, 40, NULL),
('antidote', 'Antidote', 'A vial of bitter liquid that neutralizes common poisons', 'consumable', 'uncommon', 0, NULL, NULL, FALSE, 0.1, 5, TRUE, TRUE, 500, NULL),
('essence_of_nightshade', 'Essence of Nightshade', 'A single drop brings sleep. Three drops bring death.', 'consumable', 'rare', 0, NULL, NULL, FALSE, 0.1, 3, TRUE, FALSE, 2000, NULL);

-- ============================================
-- MATERIALS (additional)
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('cloth_bolt', 'Bolt of Cloth', 'A roll of woven linen suitable for tailoring', 'material', 'common', 0, NULL, NULL, FALSE, 1.5, 30, FALSE, TRUE, 40, NULL),
('gold_ingot', 'Gold Ingot', 'A gleaming bar of pure gold, stamped with a mint mark', 'material', 'rare', 0, NULL, NULL, FALSE, 2.0, 20, FALSE, TRUE, 2000, NULL),
('weirwood_branch', 'Weirwood Branch', 'A pale white branch with red sap — sacred to the Old Gods', 'material', 'epic', 0, NULL, NULL, FALSE, 0.5, 10, FALSE, FALSE, 5000, NULL),
('dragonglass_shard', 'Dragonglass Shard', 'A jagged obsidian shard, cold to the touch and razor-edged', 'material', 'rare', 0, NULL, NULL, FALSE, 0.3, 20, FALSE, TRUE, 800, NULL);

-- ============================================
-- MISCELLANEOUS
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, is_tradeable, base_price, model_data) VALUES
('torch', 'Torch', 'A pitch-wrapped brand that casts flickering light in the darkness', 'misc', 'common', 0, 'wood', NULL, FALSE, 0.5, 10, TRUE, TRUE, 5, NULL),
('rope', 'Hempen Rope', 'Fifty feet of coiled hemp rope, fraying at the ends', 'misc', 'common', 0, NULL, NULL, FALSE, 2.0, 5, FALSE, TRUE, 15, NULL),
('waterskin_empty', 'Empty Waterskin', 'A dried-out leather skin — useless until refilled', 'misc', 'common', 0, 'leather', NULL, FALSE, 0.2, 5, FALSE, TRUE, 5, NULL);
