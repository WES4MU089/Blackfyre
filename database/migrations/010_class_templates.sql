-- Migration 010: Class Templates for Character Creation
-- Creates class_templates table and seeds all 17 templates
-- Adds template_key column to characters table

-- ============================================================================
-- CLASS TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_templates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_key VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    category ENUM('nobility', 'military', 'religious', 'scholarly', 'commerce', 'criminal', 'common') NOT NULL,
    fantasy_examples VARCHAR(200),
    locked_aptitudes JSON NOT NULL,
    locked_skills JSON NOT NULL,
    free_aptitude_points TINYINT UNSIGNED NOT NULL,
    free_skill_points TINYINT UNSIGNED NOT NULL,
    starting_cash INT DEFAULT 500,
    starting_bank INT DEFAULT 5000,
    starting_job_key VARCHAR(30),
    starting_job_grade TINYINT UNSIGNED DEFAULT 0,
    starting_items JSON,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order TINYINT UNSIGNED DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ADD template_key TO characters
-- ============================================================================

ALTER TABLE characters
    ADD COLUMN template_key VARCHAR(30) DEFAULT NULL AFTER player_id;

-- ============================================================================
-- SEED 17 CLASS TEMPLATES
-- Skill keys use the new 34-skill system (migration 009)
-- ============================================================================

INSERT INTO class_templates (template_key, name, description, category, fantasy_examples, locked_aptitudes, locked_skills, free_aptitude_points, free_skill_points, starting_cash, starting_bank, starting_job_key, starting_job_grade, starting_items, sort_order) VALUES

-- ============================
-- NOBILITY
-- ============================

('noble_lord', 'Noble Lord',
 'Born to rule and command. The lord''s authority comes from birthright, military strength, and the loyalty of his bannermen. He leads from the front and governs from the great hall.',
 'nobility', 'Eddard Stark, Tywin Lannister, Stannis Baratheon',
 '{"prowess":3,"fortitude":2,"command":5,"cunning":2,"stewardship":4,"presence":4,"lore":2,"faith":2}',
 '{"fieldWarfare":3,"logistics":2,"diplomacy":2}',
 4, 2, 2000, 15000, 'lord', 0,
 '[{"item_key":"steel_sword","quantity":1},{"item_key":"chainmail","quantity":1},{"item_key":"iron_shield","quantity":1}]',
 1),

('noble_lady', 'Noble Lady',
 'The true power behind the throne. Where lords swing swords, the lady wields influence — navigating court intrigue, forging alliances through marriage and diplomacy, and managing the household that keeps the realm running.',
 'nobility', 'Cersei Lannister, Olenna Tyrell, Catelyn Stark',
 '{"prowess":2,"fortitude":2,"command":2,"cunning":5,"stewardship":4,"presence":4,"lore":3,"faith":2}',
 '{"subterfuge":3,"diplomacy":2,"logistics":2}',
 4, 2, 2000, 15000, 'lord', 0,
 '[]',
 2),

-- ============================
-- MILITARY / MARTIAL
-- ============================

('knight', 'Knight',
 'An anointed knight of the realm — sworn to uphold honor, defend the weak, and serve their liege. Years of squirehood forged a skilled fighter, rider, and battlefield commander.',
 'military', 'Jaime Lannister, Barristan Selmy, Loras Tyrell',
 '{"prowess":5,"fortitude":4,"command":4,"cunning":2,"stewardship":2,"presence":2,"lore":2,"faith":2}',
 '{"blades":3,"mountedCombat":2,"fieldWarfare":2}',
 5, 2, 1000, 5000, 'knight', 0,
 '[{"item_key":"steel_sword","quantity":1},{"item_key":"chainmail","quantity":1},{"item_key":"iron_shield","quantity":1}]',
 3),

('hedge_knight', 'Hedge Knight',
 'A knight without lord or land — sleeping in hedgerows, fighting in tourneys for coin and glory. What they lack in refinement, they make up for in toughness and self-reliance.',
 'military', 'Brienne of Tarth, Duncan the Tall, Sandor Clegane',
 '{"prowess":5,"fortitude":5,"command":2,"cunning":2,"stewardship":2,"presence":2,"lore":2,"faith":2}',
 '{"blades":3,"survival":2,"resistance":2}',
 6, 2, 300, 1000, 'knight', 0,
 '[{"item_key":"iron_sword","quantity":1},{"item_key":"leather_armor","quantity":1},{"item_key":"wooden_shield","quantity":1}]',
 4),

('man_at_arms', 'Man-at-Arms',
 'A professional soldier in the service of a lord. Not born to nobility, but drilled in formation fighting, endurance marches, and the grim reality of medieval warfare.',
 'military', 'Jory Cassel, Grey Worm, the Gold Cloaks',
 '{"prowess":4,"fortitude":5,"command":3,"cunning":2,"stewardship":2,"presence":2,"lore":2,"faith":2}',
 '{"endurance":3,"blades":2,"fieldWarfare":2}',
 6, 2, 500, 2000, 'soldier', 1,
 '[{"item_key":"iron_spear","quantity":1},{"item_key":"leather_armor","quantity":1},{"item_key":"wooden_shield","quantity":1}]',
 5),

('sellsword', 'Sellsword',
 'A mercenary who fights for coin, not honor. Sellswords are pragmatic killers — skilled enough to survive, cunning enough to get paid, and smart enough to know when to switch sides.',
 'military', 'Bronn, Daario Naharis, the Second Sons',
 '{"prowess":5,"fortitude":3,"command":2,"cunning":4,"stewardship":2,"presence":2,"lore":2,"faith":2}',
 '{"blades":3,"subterfuge":2,"intimidation":2}',
 6, 2, 800, 2000, 'smallfolk', 0,
 '[{"item_key":"iron_sword","quantity":1},{"item_key":"leather_armor","quantity":1}]',
 6),

('ranger', 'Ranger',
 'A frontier scout, hunter, or warden of the wilds. Rangers patrol the borderlands, track outlaws through dense forests, and survive where softer men would perish.',
 'military', 'Night''s Watch rangers, Brotherhood Without Banners, Meera Reed',
 '{"prowess":3,"fortitude":4,"command":2,"cunning":3,"stewardship":2,"presence":2,"lore":3,"faith":2}',
 '{"survival":3,"archery":2,"endurance":2}',
 7, 2, 200, 500, 'soldier', 0,
 '[{"item_key":"hunting_bow","quantity":1},{"item_key":"leather_armor","quantity":1},{"item_key":"bandage","quantity":3}]',
 7),

-- ============================
-- RELIGIOUS
-- ============================

('septon', 'Septon / Septa',
 'An ordained member of the clergy. Whether preaching in a humble sept or advising lords in their castles, the faithful carry the authority of the divine and the weight of moral conviction.',
 'religious', 'The High Sparrow, Septa Unella, Septon Meribald',
 '{"prowess":2,"fortitude":2,"command":2,"cunning":2,"stewardship":2,"presence":4,"lore":3,"faith":5}',
 '{"devotion":3,"ritual":2,"oratory":2}',
 6, 2, 100, 1000, 'septon', 0,
 '[]',
 8),

-- ============================
-- SCHOLARLY
-- ============================

('maester', 'Maester',
 'Trained at the Citadel in Oldtown, a maester has forged chains of knowledge — in healing, history, alchemy, and the sciences. They serve as advisors, healers, and keepers of ravens.',
 'scholarly', 'Maester Luwin, Maester Aemon, Samwell Tarly, Qyburn',
 '{"prowess":2,"fortitude":2,"command":2,"cunning":4,"stewardship":3,"presence":2,"lore":5,"faith":2}',
 '{"medicine":3,"history":2,"alchemy":2}',
 6, 2, 500, 3000, 'maester', 0,
 '[{"item_key":"bandage","quantity":3},{"item_key":"poultice","quantity":2}]',
 9),

-- ============================
-- COMMERCE / TRADE
-- ============================

('merchant', 'Merchant',
 'Where others see war and chaos, the merchant sees opportunity. Masters of trade, negotiation, and coin — they build empires not with swords but with ledgers and handshakes.',
 'commerce', 'Illyrio Mopatis, Salladhor Saan, the Iron Bank representatives',
 '{"prowess":2,"fortitude":2,"command":2,"cunning":4,"stewardship":5,"presence":4,"lore":2,"faith":2}',
 '{"mercantile":3,"diplomacy":2,"logistics":2}',
 5, 2, 3000, 20000, 'merchant', 0,
 '[]',
 10),

('artisan', 'Artisan',
 'A master of craft — the smith who forges steel, the mason who raises walls, the shipwright who builds fleets. Artisans are the backbone of civilization, turning raw materials into the instruments of power.',
 'commerce', 'Gendry, Tobho Mott, the builders of the Wall',
 '{"prowess":2,"fortitude":4,"command":2,"cunning":2,"stewardship":5,"presence":2,"lore":3,"faith":2}',
 '{"engineering":3,"mercantile":2,"endurance":2}',
 6, 2, 800, 5000, 'smith', 0,
 '[{"item_key":"iron_ingot","quantity":5},{"item_key":"timber","quantity":5}]',
 11),

-- ============================
-- CRIMINAL / UNDERWORLD
-- ============================

('spy', 'Spy',
 'The unseen hand that shapes the fate of kingdoms. Spies deal in secrets, whispers, and the carefully placed lie. They serve no banner but their own — or the highest bidder.',
 'criminal', 'Varys, Littlefinger, Arya Stark (Faceless Men)',
 '{"prowess":2,"fortitude":2,"command":2,"cunning":5,"stewardship":2,"presence":4,"lore":3,"faith":2}',
 '{"espionage":3,"subterfuge":2,"stealth":2}',
 6, 2, 500, 5000, 'spy', 0,
 '[]',
 12),

('smuggler', 'Smuggler',
 'Where there are borders, there are smugglers. They know every hidden cove, back alley, and corrupt guard. Coin flows through their hands like water — some of it clean, most of it not.',
 'criminal', 'Davos Seaworth, Salladhor Saan, the pirates of the Stepstones',
 '{"prowess":2,"fortitude":3,"command":2,"cunning":5,"stewardship":3,"presence":2,"lore":2,"faith":2}',
 '{"subterfuge":3,"mercantile":2,"survival":2}',
 7, 2, 1500, 3000, 'smallfolk', 0,
 '[]',
 13),

('outlaw', 'Outlaw',
 'Whether a rebel with a cause or a common bandit, the outlaw lives outside the law. They strike from the shadows, take what they need, and vanish before the lord''s men arrive.',
 'criminal', 'Brotherhood Without Banners, Kingswood Brotherhood, wildlings',
 '{"prowess":4,"fortitude":3,"command":2,"cunning":4,"stewardship":2,"presence":2,"lore":2,"faith":2}',
 '{"subterfuge":2,"blades":2,"intimidation":2}',
 7, 3, 200, 0, 'smallfolk', 0,
 '[{"item_key":"iron_sword","quantity":1}]',
 14),

-- ============================
-- COMMON / OTHER
-- ============================

('healer', 'Healer',
 'The village wise woman, the battlefield surgeon, the herb-gatherer who knows which plants mend and which ones kill. Healers are valued in war and peace alike — sometimes feared, always needed.',
 'common', 'Mirri Maz Duur, the woods witches, Talisa Maegyr',
 '{"prowess":2,"fortitude":3,"command":2,"cunning":2,"stewardship":2,"presence":2,"lore":5,"faith":4}',
 '{"medicine":3,"alchemy":2,"devotion":2}',
 6, 2, 300, 1000, 'smallfolk', 0,
 '[{"item_key":"bandage","quantity":5},{"item_key":"poultice","quantity":2},{"item_key":"milk_of_poppy","quantity":1}]',
 15),

('sailor', 'Sailor',
 'Born to the sea. Whether an honest deckhand, a merchant captain, or a pirate of the Stepstones — sailors are tough, resourceful, and at home on the waves.',
 'common', 'Davos Seaworth, Euron Greyjoy, Yara Greyjoy',
 '{"prowess":3,"fortitude":4,"command":3,"cunning":2,"stewardship":2,"presence":2,"lore":2,"faith":2}',
 '{"navalWarfare":3,"survival":2,"endurance":2}',
 8, 2, 400, 1500, 'smallfolk', 0,
 '[{"item_key":"iron_sword","quantity":1},{"item_key":"leather_armor","quantity":1}]',
 16),

('smallfolk', 'Smallfolk',
 'A common man or woman — farmer, innkeeper, stable hand, fishwife. No great training, no noble name, no particular destiny. But in this world, even the lowborn can rise. The most flexible template for players who want full control over their build.',
 'common', 'Hot Pie, Gendry (before the forge), Shae',
 '{"prowess":2,"fortitude":2,"command":2,"cunning":2,"stewardship":2,"presence":2,"lore":2,"faith":2}',
 '{}',
 12, 6, 100, 500, 'smallfolk', 0,
 '[{"item_key":"bread","quantity":3},{"item_key":"water_skin","quantity":2}]',
 17);
