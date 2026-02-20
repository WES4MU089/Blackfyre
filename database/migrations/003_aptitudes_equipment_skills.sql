-- ============================================
-- Migration 003: Aptitudes, Equipment & Medieval Seed Data
-- Adds character_aptitudes, character_equipment tables
-- Replaces FiveM placeholder seeds with medieval content
-- ============================================

USE blackfyre_hud;

-- ============================================
-- NEW TABLES
-- ============================================

-- Character aptitudes (8 stats: prowess, fortitude, command, cunning, stewardship, presence, lore, faith)
CREATE TABLE IF NOT EXISTS character_aptitudes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    aptitude_key VARCHAR(20) NOT NULL,
    base_value TINYINT UNSIGNED NOT NULL DEFAULT 3,
    current_value TINYINT UNSIGNED NOT NULL DEFAULT 3,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE KEY uk_char_aptitude (character_id, aptitude_key),
    INDEX idx_character (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Character equipment (7 slots: mainHand, offHand, armor, accessory1, accessory2, ancillary1, ancillary2)
CREATE TABLE IF NOT EXISTS character_equipment (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    slot_id VARCHAR(20) NOT NULL,
    item_id INT UNSIGNED NOT NULL,
    equipped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE KEY uk_char_slot (character_id, slot_id),
    INDEX idx_character (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CLEAR EXISTING DATA BEFORE ENUM CHANGES
-- ============================================

DELETE FROM character_inventory;
DELETE FROM character_skills;
DELETE FROM character_jobs;
DELETE FROM character_status_effects;
DELETE FROM job_grades;
DELETE FROM items;
DELETE FROM skills;
DELETE FROM jobs;
DELETE FROM status_effects;

-- ============================================
-- ITEMS TABLE: ADD COMBAT COLUMNS
-- ============================================

ALTER TABLE items
    ADD COLUMN tier TINYINT UNSIGNED DEFAULT 0 AFTER rarity,
    ADD COLUMN material VARCHAR(50) DEFAULT NULL AFTER tier,
    ADD COLUMN slot_type VARCHAR(20) DEFAULT NULL AFTER material,
    ADD COLUMN is_two_handed BOOLEAN DEFAULT FALSE AFTER slot_type;

-- ============================================
-- ENUM UPDATES (safe now that data is cleared)
-- ============================================

ALTER TABLE items
    MODIFY COLUMN category ENUM(
        'weapon', 'armor', 'shield', 'mount', 'consumable',
        'material', 'tool', 'clothing', 'document', 'key', 'misc'
    ) DEFAULT 'misc';

ALTER TABLE skills
    MODIFY COLUMN category ENUM(
        'prowess', 'fortitude', 'command', 'cunning', 'stewardship',
        'presence', 'lore', 'faith', 'misc'
    ) DEFAULT 'misc';

ALTER TABLE jobs
    MODIFY COLUMN category ENUM(
        'military', 'government', 'civilian', 'religious', 'criminal'
    ) DEFAULT 'civilian';

-- ============================================
-- SEED DATA: 24 CANONICAL SKILLS (3 per aptitude)
-- ============================================

INSERT INTO skills (skill_key, name, description, category, max_level) VALUES
-- Prowess (3)
('meleeArms', 'Melee Arms', 'Swords, axes, hammers, polearms — all melee weaponry', 'prowess', 10),
('archery', 'Archery', 'Bows, crossbows, ranged combat', 'prowess', 10),
('horsemanship', 'Horsemanship', 'Mounted combat, cavalry charges, jousting', 'prowess', 10),
-- Fortitude (3)
('endurance', 'Endurance', 'Forced marches, resisting fatigue, physical stamina under duress', 'fortitude', 10),
('painTolerance', 'Pain Tolerance', 'Fighting through wounds, resisting torture, staying conscious', 'fortitude', 10),
('survival', 'Survival', 'Foraging, weather hardship, field medicine basics, camping', 'fortitude', 10),
-- Command (3)
('fieldWarfare', 'Field Warfare', 'Pitched battles, army engagements, troop coordination', 'command', 10),
('siegeWarfare', 'Siege Warfare', 'Attacking and defending fortifications, siege engines', 'command', 10),
('navalWarfare', 'Naval Warfare', 'Naval battles, fleet coordination, sea warfare', 'command', 10),
-- Cunning (3)
('espionage', 'Espionage', 'Spy networks, intelligence gathering, surveillance', 'cunning', 10),
('intrigue', 'Intrigue', 'Court manipulation, deception, political maneuvering', 'cunning', 10),
('subterfuge', 'Subterfuge', 'Disguise, sleight of hand, forgery, smuggling, stealth', 'cunning', 10),
-- Stewardship (3)
('trade', 'Trade', 'Commerce, market manipulation, trade route management', 'stewardship', 10),
('administration', 'Administration', 'Holding management, taxation, bureaucracy', 'stewardship', 10),
('engineering', 'Engineering', 'Construction, fortification design, siege engines', 'stewardship', 10),
-- Presence (3)
('oratory', 'Oratory', 'Speeches, rallying troops, inspiring, propaganda', 'presence', 10),
('intimidation', 'Intimidation', 'Breaking enemy morale, demands for surrender', 'presence', 10),
('diplomacy', 'Diplomacy', 'Parley, negotiation, treaty-making', 'presence', 10),
-- Lore (3)
('alchemy', 'Alchemy', 'Potion-brewing, poisons, wildfire, chemical knowledge', 'lore', 10),
('medicine', 'Medicine', 'Healing wounds, treating disease, surgery', 'lore', 10),
('history', 'History', 'Knowledge of lineages, precedents, ancient lore', 'lore', 10),
-- Faith (3)
('devotion', 'Devotion', 'Piety, prayer, maintaining sacred sites', 'faith', 10),
('ritual', 'Ritual', 'Performing ceremonies — weddings, funerals, blessings', 'faith', 10),
('prophecy', 'Prophecy', 'Dream interpretation, omens, visions', 'faith', 10);

-- ============================================
-- SEED DATA: MEDIEVAL ITEMS
-- ============================================

INSERT INTO items (item_key, name, description, category, rarity, tier, material, slot_type, is_two_handed, weight, max_stack, is_usable, base_price, model_data) VALUES
-- Consumables (no combat stats)
('bread', 'Bread', 'A fresh loaf of bread', 'consumable', 'common', 0, NULL, NULL, FALSE, 0.3, 10, TRUE, 25, NULL),
('water_skin', 'Water Skin', 'Leather skin filled with water', 'consumable', 'common', 0, NULL, NULL, FALSE, 0.5, 10, TRUE, 15, NULL),
('bandage', 'Bandage', 'Linen wound dressing', 'consumable', 'common', 0, NULL, NULL, FALSE, 0.1, 20, TRUE, 100, NULL),
('poultice', 'Healing Poultice', 'Herbal healing mixture', 'consumable', 'uncommon', 0, NULL, NULL, FALSE, 0.2, 10, TRUE, 300, NULL),
('milk_of_poppy', 'Milk of the Poppy', 'Powerful pain remedy', 'consumable', 'rare', 0, NULL, NULL, FALSE, 0.1, 5, TRUE, 800, NULL),
-- Weapons
('iron_sword', 'Iron Sword', 'A standard iron longsword', 'weapon', 'common', 2, 'iron', 'mainHand', FALSE, 2.0, 1, FALSE, 500, '{"penetration":5,"baseDamage":14,"penMod":-2}'),
('steel_sword', 'Steel Sword', 'A well-forged steel longsword', 'weapon', 'uncommon', 3, 'steel', 'mainHand', FALSE, 1.8, 1, FALSE, 2000, '{"penetration":10,"baseDamage":14,"penMod":-2}'),
('iron_battleaxe', 'Iron Battle Axe', 'A heavy iron battle axe', 'weapon', 'common', 2, 'iron', 'mainHand', FALSE, 3.0, 1, FALSE, 600, '{"penetration":12,"baseDamage":16,"penMod":5}'),
('iron_warhammer', 'Iron Warhammer', 'An iron warhammer', 'weapon', 'common', 2, 'iron', 'mainHand', FALSE, 3.5, 1, FALSE, 550, '{"penetration":15,"baseDamage":14,"penMod":8}'),
('iron_spear', 'Iron Spear', 'A simple iron-tipped spear', 'weapon', 'common', 2, 'iron', 'mainHand', FALSE, 2.5, 1, FALSE, 300, '{"penetration":14,"baseDamage":14,"penMod":7}'),
('steel_greatsword', 'Steel Greatsword', 'A massive two-handed steel blade', 'weapon', 'uncommon', 3, 'steel', 'mainHand', TRUE, 4.0, 1, FALSE, 3000, '{"penetration":12,"baseDamage":15,"penMod":-3,"encumbrance":-5}'),
('hunting_bow', 'Hunting Bow', 'A simple shortbow', 'weapon', 'common', 2, 'wood', 'mainHand', TRUE, 1.0, 1, FALSE, 400, '{"penetration":10,"baseDamage":12,"penMod":3}'),
-- Armor
('leather_armor', 'Leather Armor', 'Boiled leather chestpiece', 'armor', 'common', 2, 'leather', 'armor', FALSE, 5.0, 1, FALSE, 800, '{"mitigation":8,"encumbrance":-5}'),
('chainmail', 'Chainmail', 'Interlocking steel rings', 'armor', 'uncommon', 3, 'steel', 'armor', FALSE, 12.0, 1, FALSE, 3000, '{"mitigation":12,"encumbrance":-8}'),
('plate_armor', 'Plate Armor', 'Full plate steel armor', 'armor', 'rare', 4, 'steel', 'armor', FALSE, 20.0, 1, FALSE, 8000, '{"mitigation":16,"encumbrance":-12}'),
-- Shields
('wooden_shield', 'Wooden Shield', 'A sturdy wooden roundshield', 'shield', 'common', 2, 'wood', 'offHand', FALSE, 3.0, 1, FALSE, 200, '{"blockBonus":12}'),
('iron_shield', 'Iron Shield', 'An iron-banded kite shield', 'shield', 'uncommon', 3, 'iron', 'offHand', FALSE, 5.0, 1, FALSE, 1000, '{"blockBonus":18}'),
-- Materials
('iron_ingot', 'Iron Ingot', 'A bar of smelted iron', 'material', 'common', 0, NULL, NULL, FALSE, 1.0, 50, FALSE, 50, NULL),
('steel_ingot', 'Steel Ingot', 'Refined steel ingot', 'material', 'common', 0, NULL, NULL, FALSE, 1.0, 50, FALSE, 100, NULL),
('timber', 'Timber', 'Cut and seasoned wood', 'material', 'common', 0, NULL, NULL, FALSE, 2.0, 50, FALSE, 30, NULL),
('leather_hide', 'Leather Hide', 'Tanned animal hide', 'material', 'common', 0, NULL, NULL, FALSE, 1.5, 30, FALSE, 60, NULL);

-- ============================================
-- SEED DATA: MEDIEVAL JOBS
-- ============================================

INSERT INTO jobs (job_key, name, description, category, base_salary, max_grade) VALUES
('smallfolk', 'Smallfolk', 'Common peasant, no formal title', 'civilian', 0, 0),
('soldier', 'Soldier', 'Man-at-arms in service to a lord', 'military', 500, 5),
('knight', 'Knight', 'Anointed knight of the realm', 'military', 1500, 3),
('maester', 'Maester', 'Trained scholar and healer', 'government', 1000, 3),
('septon', 'Septon', 'Clergy of the Faith of the Seven', 'religious', 500, 3),
('merchant', 'Merchant', 'Trader and shopkeeper', 'civilian', 800, 5),
('smith', 'Smith', 'Blacksmith and armorer', 'civilian', 600, 5),
('lord', 'Lord', 'Landed nobility', 'government', 5000, 3),
('steward', 'Steward', 'Estate manager for a lord', 'civilian', 1200, 3),
('spy', 'Spy', 'Intelligence operative', 'criminal', 0, 3);

INSERT INTO job_grades (job_id, grade, name, salary) VALUES
((SELECT id FROM jobs WHERE job_key = 'soldier'), 0, 'Recruit', 300),
((SELECT id FROM jobs WHERE job_key = 'soldier'), 1, 'Man-at-Arms', 500),
((SELECT id FROM jobs WHERE job_key = 'soldier'), 2, 'Sergeant', 800),
((SELECT id FROM jobs WHERE job_key = 'soldier'), 3, 'Captain', 1200),
((SELECT id FROM jobs WHERE job_key = 'soldier'), 4, 'Commander', 2000),
((SELECT id FROM jobs WHERE job_key = 'soldier'), 5, 'Marshal', 3500);

-- ============================================
-- SEED DATA: MEDIEVAL STATUS EFFECTS
-- ============================================

INSERT INTO status_effects (effect_key, name, description, effect_type, default_duration, effect_data) VALUES
('bleeding', 'Bleeding', 'Losing blood from an open wound', 'debuff', 300, '{"health_drain": 0.5}'),
('poisoned', 'Poisoned', 'Toxins coursing through veins', 'debuff', 600, '{"health_drain": 0.25, "stamina_drain": 0.5}'),
('fevered', 'Fevered', 'Wracked with fever and chills', 'debuff', 3600, '{"stamina_drain": 0.3, "strength_penalty": -2}'),
('drunk', 'In Cups', 'Deep in drink', 'debuff', 1800, '{"vision_blur": true, "movement_sway": true}'),
('milk_of_poppy', 'Milk of the Poppy', 'Pain-numbed by poppy extract', 'neutral', 1200, '{"wound_penalty_removed": true, "reaction_penalty": -2}'),
('battle_fury', 'Battle Fury', 'Blood runs hot in combat', 'buff', 60, '{"damage_boost": 1.25, "defense_penalty": -5}'),
('well_fed', 'Well Fed', 'Satisfied from a good meal', 'buff', 3600, '{"health_regen": 0.1, "stamina_regen": 0.2}'),
('rested', 'Well Rested', 'Fresh and recovered', 'buff', 7200, '{"xp_boost": 1.1, "stamina_regen": 0.15}'),
('inspired', 'Inspired', 'Lifted by a rousing speech', 'buff', 1800, '{"morale_bonus": 5, "xp_boost": 1.05}'),
('wounded', 'Wounded', 'Carrying battle injuries', 'debuff', 0, '{"speed_reduction": 0.2, "max_health_reduction": 20}');

SELECT 'Migration 003 complete — aptitudes, equipment, medieval seeds applied.' AS Status;
