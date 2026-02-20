-- Migration 009: Skills System Overhaul
-- Replaces existing 24 skills with finalized 34-skill system across 8 aptitudes
-- Safe: no character_skills data exists yet

-- Clear existing skill data
DELETE FROM character_skills;
DELETE FROM skills;

-- Reset auto_increment
ALTER TABLE skills AUTO_INCREMENT = 1;

-- ============================================================================
-- PROWESS (6 skills) — Weapon specialization and physical combat
-- ============================================================================
INSERT INTO skills (skill_key, name, description, category, max_level) VALUES
('blades',         'Blades',         'Swords, daggers, and other edged weapons',                    'prowess', 10),
('blunt',          'Blunt',          'Maces, hammers, flails, and crushing weapons',                'prowess', 10),
('polearms',       'Polearms',       'Spears, halberds, pikes, and other polearm weapons',          'prowess', 10),
('archery',        'Archery',        'Bows, crossbows, and ranged weapons',                         'prowess', 10),
('brawling',       'Brawling',       'Unarmed combat, fists, and grappling',                        'prowess', 10),
('mountedCombat',  'Mounted Combat', 'Fighting from horseback or dragonback, mounted charges',      'prowess', 10);

-- ============================================================================
-- FORTITUDE (4 skills) — Physical resilience and endurance
-- ============================================================================
INSERT INTO skills (skill_key, name, description, category, max_level) VALUES
('endurance',      'Endurance',      'Physical stamina, determines max health',                     'fortitude', 10),
('resistance',     'Resistance',     'Resistance to disease, poison, and harmful substances',       'fortitude', 10),
('survival',       'Survival',       'Wilderness survival, foraging, tracking, and navigation',     'fortitude', 10),
('athletics',      'Athletics',      'Running, climbing, swimming, and fleeing combat',             'fortitude', 10);

-- ============================================================================
-- COMMAND (3 skills) — World Battle System combat specialization
-- ============================================================================
INSERT INTO skills (skill_key, name, description, category, max_level) VALUES
('fieldWarfare',   'Field Warfare',  'Open battlefield tactics, army formations, and field command', 'command', 10),
('siegeWarfare',   'Siege Warfare',  'Fortification assault and defense, siege engines, walls',      'command', 10),
('navalWarfare',   'Naval Warfare',  'Ship-to-ship combat, naval formations, sea battles',          'command', 10);

-- ============================================================================
-- CUNNING (5 skills) — Espionage, deception, and covert operations
-- ============================================================================
INSERT INTO skills (skill_key, name, description, category, max_level) VALUES
('espionage',      'Espionage',       'Spy networks, intelligence gathering, reading holdings',     'cunning', 10),
('subterfuge',     'Subterfuge',      'Forgery, lies, disguises, and deception checks',             'cunning', 10),
('stealth',        'Stealth',         'Moving unseen, on-sim proximity detection avoidance',        'cunning', 10),
('perception',     'Perception',      'Counter-espionage, intercepting ravens, spotting threats',   'cunning', 10),
('sleightOfHand',  'Sleight of Hand', 'Pickpocketing, theft, and unnoticed item manipulation',     'cunning', 10);

-- ============================================================================
-- STEWARDSHIP (4 skills) — Holdings, economy, and resource management
-- ============================================================================
INSERT INTO skills (skill_key, name, description, category, max_level) VALUES
('engineering',    'Engineering',    'Crafting node tiers, siege engine construction, building',     'stewardship', 10),
('mercantile',     'Mercantile',     'Reduces crafting costs, trade negotiation, market knowledge',  'stewardship', 10),
('logistics',      'Logistics',      'Resource management, food costs, levy upkeep, attrition',     'stewardship', 10),
('taxation',       'Taxation',       'Passive income and resource generation from holdings',         'stewardship', 10);

-- ============================================================================
-- PRESENCE (4 skills) — Social influence and personal authority
-- ============================================================================
INSERT INTO skills (skill_key, name, description, category, max_level) VALUES
('diplomacy',      'Diplomacy',      'Negotiation, alliance building, peaceful resolution',         'presence', 10),
('intimidation',   'Intimidation',   'Inspiring fear, coercion, threats, and domination',           'presence', 10),
('oratory',        'Oratory',        'Public speaking, speeches, ceremony, and rallying',           'presence', 10),
('authority',      'Authority',      'Personal leadership presence, inspiring trust and action',    'presence', 10);

-- ============================================================================
-- LORE (5 skills) — Knowledge, scholarship, and healing
-- ============================================================================
INSERT INTO skills (skill_key, name, description, category, max_level) VALUES
('medicine',       'Medicine',       'Healing wounds, treating injuries, combined with Ritual for greater effect', 'lore', 10),
('alchemy',        'Alchemy',        'Potion brewing, poison crafting, and substance knowledge',    'lore', 10),
('investigation',  'Investigation',  'Finding clues, solving mysteries, uncovering secrets',        'lore', 10),
('education',      'Education',      'Teaching others, knowledge transfer, scholarly pursuits',     'lore', 10),
('history',        'History',        'Dragon lore, ancient relics, cultural knowledge, lineages',   'lore', 10);

-- ============================================================================
-- FAITH (3 skills) — Religious devotion and spiritual practice
-- ============================================================================
INSERT INTO skills (skill_key, name, description, category, max_level) VALUES
('devotion',       'Devotion',       'Prayer, meditation, maintaining piety and religious standing', 'faith', 10),
('ritual',         'Ritual',         'Religious ceremonies, blessings, combined with Medicine for healing', 'faith', 10),
('prophecy',       'Prophecy',       'Visions, divination, interpreting omens and signs',           'faith', 10);
