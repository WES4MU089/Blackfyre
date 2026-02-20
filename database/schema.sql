-- ============================================
-- Blackfyre RPG HUD Database Schema
-- Second Life External Overlay System
-- Version 1.0.0
-- ============================================

USE blackfyre_hud;

-- ============================================
-- CORE TABLES
-- ============================================

-- Players table - Links Second Life avatars to HUD system
CREATE TABLE IF NOT EXISTS players (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sl_uuid VARCHAR(36) NOT NULL UNIQUE COMMENT 'Second Life Avatar UUID',
    sl_name VARCHAR(100) NOT NULL COMMENT 'Second Life Display Name',
    sl_legacy_name VARCHAR(100) COMMENT 'Second Life Legacy Name (username)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    INDEX idx_sl_uuid (sl_uuid),
    INDEX idx_sl_name (sl_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Characters table - RPG characters (players can have multiple)
CREATE TABLE IF NOT EXISTS characters (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    backstory TEXT,
    portrait_url VARCHAR(500),
    level INT UNSIGNED DEFAULT 1,
    experience BIGINT DEFAULT 0,
    unspent_aptitude_points TINYINT UNSIGNED DEFAULT 0,
    unspent_skill_points TINYINT UNSIGNED DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    played_time INT UNSIGNED DEFAULT 0 COMMENT 'Total playtime in seconds',
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    INDEX idx_player (player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- VITAL STATS (Health, Hunger, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS character_vitals (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL UNIQUE,
    health DECIMAL(5,2) DEFAULT 100.00,
    max_health DECIMAL(5,2) DEFAULT 100.00,
    armor DECIMAL(5,2) DEFAULT 0.00,
    max_armor DECIMAL(5,2) DEFAULT 100.00,
    stamina DECIMAL(5,2) DEFAULT 100.00,
    max_stamina DECIMAL(5,2) DEFAULT 100.00,
    hunger DECIMAL(5,2) DEFAULT 100.00,
    thirst DECIMAL(5,2) DEFAULT 100.00,
    stress DECIMAL(5,2) DEFAULT 0.00,
    oxygen DECIMAL(5,2) DEFAULT 100.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ECONOMY SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS character_finances (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL UNIQUE,
    cash BIGINT DEFAULT 500 COMMENT 'Physical cash',
    bank BIGINT DEFAULT 5000 COMMENT 'Bank account balance',
    crypto BIGINT DEFAULT 0 COMMENT 'Cryptocurrency balance',
    dirty_money BIGINT DEFAULT 0 COMMENT 'Laundered money',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transaction history
CREATE TABLE IF NOT EXISTS transactions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    transaction_type ENUM('deposit', 'withdraw', 'transfer_in', 'transfer_out', 'purchase', 'sale', 'paycheck', 'fine', 'reward') NOT NULL,
    amount BIGINT NOT NULL,
    currency_type ENUM('cash', 'bank', 'crypto', 'dirty_money') DEFAULT 'cash',
    description VARCHAR(255),
    reference_id INT UNSIGNED COMMENT 'Related entity ID (item, job, etc.)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_character (character_id),
    INDEX idx_type (transaction_type),
    INDEX idx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INVENTORY SYSTEM
-- ============================================

-- Item definitions
CREATE TABLE IF NOT EXISTS items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_key VARCHAR(50) NOT NULL UNIQUE COMMENT 'Unique identifier like weapon_pistol',
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('weapon', 'consumable', 'material', 'tool', 'clothing', 'vehicle_part', 'electronics', 'document', 'key', 'misc') DEFAULT 'misc',
    rarity ENUM('common', 'uncommon', 'rare', 'epic', 'legendary') DEFAULT 'common',
    weight DECIMAL(6,2) DEFAULT 0.00 COMMENT 'Weight in kg',
    max_stack INT UNSIGNED DEFAULT 1,
    is_usable BOOLEAN DEFAULT FALSE,
    is_tradeable BOOLEAN DEFAULT TRUE,
    base_price BIGINT DEFAULT 0,
    icon_url VARCHAR(500),
    model_data JSON COMMENT 'Additional item properties',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_rarity (rarity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Character inventory
CREATE TABLE IF NOT EXISTS character_inventory (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    item_id INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED DEFAULT 1,
    slot_number INT UNSIGNED,
    durability DECIMAL(5,2) DEFAULT 100.00,
    metadata JSON COMMENT 'Item-specific data (ammo count, serial number, etc.)',
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    INDEX idx_character (character_id),
    INDEX idx_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SKILLS & PROGRESSION
-- ============================================

-- Skill definitions
CREATE TABLE IF NOT EXISTS skills (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    skill_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('combat', 'crafting', 'social', 'technical', 'physical', 'mental', 'misc') DEFAULT 'misc',
    max_level INT UNSIGNED DEFAULT 10,
    icon_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Character skills
CREATE TABLE IF NOT EXISTS character_skills (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    skill_id INT UNSIGNED NOT NULL,
    level INT UNSIGNED DEFAULT 1,
    experience BIGINT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
    UNIQUE KEY uk_char_skill (character_id, skill_id),
    INDEX idx_character (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- JOBS & EMPLOYMENT
-- ============================================

CREATE TABLE IF NOT EXISTS jobs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('legal', 'illegal', 'government', 'emergency', 'civilian') DEFAULT 'civilian',
    base_salary BIGINT DEFAULT 0,
    max_grade INT UNSIGNED DEFAULT 5,
    icon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Job grades/ranks
CREATE TABLE IF NOT EXISTS job_grades (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_id INT UNSIGNED NOT NULL,
    grade INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    salary BIGINT DEFAULT 0,
    permissions JSON,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    UNIQUE KEY uk_job_grade (job_id, grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Character employment
CREATE TABLE IF NOT EXISTS character_jobs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    job_id INT UNSIGNED NOT NULL,
    grade INT UNSIGNED DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    hired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    INDEX idx_character (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- FACTIONS & ORGANIZATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS factions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    faction_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    faction_type ENUM('gang', 'mafia', 'corporation', 'government', 'military', 'cult', 'guild', 'club') DEFAULT 'guild',
    color_primary VARCHAR(7) DEFAULT '#FFFFFF' COMMENT 'Hex color',
    color_secondary VARCHAR(7) DEFAULT '#000000',
    logo_url VARCHAR(500),
    territory_data JSON,
    is_public BOOLEAN DEFAULT FALSE,
    max_members INT UNSIGNED DEFAULT 50,
    bank_balance BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type (faction_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Faction ranks
CREATE TABLE IF NOT EXISTS faction_ranks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    faction_id INT UNSIGNED NOT NULL,
    rank_level INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    permissions JSON,
    FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
    UNIQUE KEY uk_faction_rank (faction_id, rank_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Faction membership
CREATE TABLE IF NOT EXISTS faction_members (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    faction_id INT UNSIGNED NOT NULL,
    character_id INT UNSIGNED NOT NULL,
    rank_level INT UNSIGNED DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE KEY uk_faction_char (faction_id, character_id),
    INDEX idx_character (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STATUS EFFECTS (Buffs/Debuffs)
-- ============================================

CREATE TABLE IF NOT EXISTS status_effects (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    effect_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    effect_type ENUM('buff', 'debuff', 'neutral') DEFAULT 'neutral',
    icon_url VARCHAR(500),
    default_duration INT UNSIGNED DEFAULT 0 COMMENT 'Duration in seconds, 0 = permanent',
    effect_data JSON COMMENT 'Stat modifiers, visual effects, etc.',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Active status effects on characters
CREATE TABLE IF NOT EXISTS character_status_effects (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    effect_id INT UNSIGNED NOT NULL,
    stacks INT UNSIGNED DEFAULT 1,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    source_type VARCHAR(50) COMMENT 'item, skill, npc, etc.',
    source_id INT UNSIGNED,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (effect_id) REFERENCES status_effects(id) ON DELETE CASCADE,
    INDEX idx_character (character_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- VEHICLES
-- ============================================

CREATE TABLE IF NOT EXISTS vehicle_models (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    model_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    category ENUM('car', 'motorcycle', 'boat', 'aircraft', 'bicycle', 'truck', 'military', 'emergency') DEFAULT 'car',
    base_price BIGINT DEFAULT 0,
    top_speed INT UNSIGNED DEFAULT 100,
    acceleration DECIMAL(4,2) DEFAULT 5.00,
    handling DECIMAL(4,2) DEFAULT 5.00,
    thumbnail_url VARCHAR(500),
    model_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS character_vehicles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    model_id INT UNSIGNED NOT NULL,
    plate VARCHAR(20) NOT NULL UNIQUE,
    color_primary VARCHAR(7) DEFAULT '#FFFFFF',
    color_secondary VARCHAR(7) DEFAULT '#000000',
    fuel DECIMAL(5,2) DEFAULT 100.00,
    engine_health DECIMAL(5,2) DEFAULT 100.00,
    body_health DECIMAL(5,2) DEFAULT 100.00,
    mileage INT UNSIGNED DEFAULT 0,
    is_stolen BOOLEAN DEFAULT FALSE,
    is_impounded BOOLEAN DEFAULT FALSE,
    garage_id INT UNSIGNED,
    modifications JSON,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES vehicle_models(id),
    INDEX idx_character (character_id),
    INDEX idx_plate (plate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PROPERTIES (Homes, Businesses)
-- ============================================

CREATE TABLE IF NOT EXISTS properties (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    property_type ENUM('apartment', 'house', 'mansion', 'business', 'warehouse', 'garage', 'office') DEFAULT 'apartment',
    location_data JSON COMMENT 'SL region, coordinates, etc.',
    base_price BIGINT DEFAULT 0,
    rental_price BIGINT DEFAULT 0,
    storage_capacity INT UNSIGNED DEFAULT 50,
    thumbnail_url VARCHAR(500),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS character_properties (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    property_id INT UNSIGNED NOT NULL,
    ownership_type ENUM('owned', 'rented') DEFAULT 'rented',
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rental_expires_at TIMESTAMP NULL,
    key_holders JSON COMMENT 'List of character IDs with access',
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id),
    UNIQUE KEY uk_property (property_id),
    INDEX idx_character (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- QUESTS & MISSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS quests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quest_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    quest_type ENUM('main', 'side', 'daily', 'weekly', 'event', 'faction') DEFAULT 'side',
    required_level INT UNSIGNED DEFAULT 1,
    reward_xp BIGINT DEFAULT 0,
    reward_money BIGINT DEFAULT 0,
    reward_items JSON,
    prerequisites JSON COMMENT 'Required quests, skills, items, etc.',
    steps JSON COMMENT 'Quest objectives',
    is_repeatable BOOLEAN DEFAULT FALSE,
    cooldown_hours INT UNSIGNED DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS character_quests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    quest_id INT UNSIGNED NOT NULL,
    status ENUM('active', 'completed', 'failed', 'abandoned') DEFAULT 'active',
    current_step INT UNSIGNED DEFAULT 0,
    progress_data JSON,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (quest_id) REFERENCES quests(id),
    INDEX idx_character (character_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ACHIEVEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS achievements (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    achievement_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    points INT UNSIGNED DEFAULT 10,
    icon_url VARCHAR(500),
    requirements JSON,
    reward_items JSON,
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS character_achievements (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    achievement_id INT UNSIGNED NOT NULL,
    progress INT UNSIGNED DEFAULT 0,
    unlocked_at TIMESTAMP NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id),
    UNIQUE KEY uk_char_achievement (character_id, achievement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NOTIFICATIONS & MESSAGES
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNSIGNED NOT NULL,
    notification_type ENUM('info', 'success', 'warning', 'error', 'achievement', 'quest', 'money', 'social') DEFAULT 'info',
    title VARCHAR(100) NOT NULL,
    message TEXT,
    icon VARCHAR(100),
    action_url VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_character (character_id),
    INDEX idx_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HUD CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS hud_settings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id INT UNSIGNED NOT NULL UNIQUE,
    theme VARCHAR(50) DEFAULT 'default',
    opacity DECIMAL(3,2) DEFAULT 0.85,
    scale DECIMAL(3,2) DEFAULT 1.00,
    position_preset ENUM('top_left', 'top_right', 'bottom_left', 'bottom_right', 'custom') DEFAULT 'bottom_right',
    custom_positions JSON,
    visible_elements JSON COMMENT 'Which HUD elements to show',
    keybindings JSON,
    sound_enabled BOOLEAN DEFAULT TRUE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id INT UNSIGNED,
    character_id INT UNSIGNED,
    action_type VARCHAR(50) NOT NULL,
    action_details JSON,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_player (player_id),
    INDEX idx_character (character_id),
    INDEX idx_action (action_type),
    INDEX idx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default skills
INSERT INTO skills (skill_key, name, description, category, max_level) VALUES
('combat_melee', 'Melee Combat', 'Fighting skill with fists and melee weapons', 'combat', 10),
('combat_ranged', 'Ranged Combat', 'Accuracy and handling of firearms', 'combat', 10),
('driving', 'Driving', 'Vehicle handling and racing skills', 'physical', 10),
('flying', 'Flying', 'Aircraft piloting skills', 'physical', 10),
('crafting', 'Crafting', 'Creating items and modifications', 'crafting', 10),
('hacking', 'Hacking', 'Computer and electronic skills', 'technical', 10),
('lockpicking', 'Lockpicking', 'Breaking into locked doors and vehicles', 'technical', 10),
('stealth', 'Stealth', 'Moving undetected and pickpocketing', 'physical', 10),
('charisma', 'Charisma', 'Persuasion and negotiation skills', 'social', 10),
('medical', 'Medical', 'Healing and first aid abilities', 'technical', 10),
('cooking', 'Cooking', 'Preparing food and drinks', 'crafting', 10),
('fishing', 'Fishing', 'Catching fish and sea creatures', 'physical', 10),
('mining', 'Mining', 'Extracting resources from the ground', 'physical', 10),
('stamina', 'Stamina', 'Overall physical endurance', 'physical', 10),
('strength', 'Strength', 'Physical power and carry capacity', 'physical', 10);

-- Insert default jobs
INSERT INTO jobs (job_key, name, description, category, base_salary) VALUES
('unemployed', 'Unemployed', 'No current employment', 'civilian', 0),
('police', 'Police Officer', 'Law enforcement', 'government', 3500),
('ems', 'EMS Paramedic', 'Emergency Medical Services', 'emergency', 3000),
('mechanic', 'Mechanic', 'Vehicle repair and customization', 'civilian', 2000),
('taxi', 'Taxi Driver', 'Public transportation', 'civilian', 1500),
('trucker', 'Trucker', 'Long-haul delivery', 'civilian', 2500),
('garbage', 'Sanitation Worker', 'Waste management', 'civilian', 1800),
('judge', 'Judge', 'Court judicial officer', 'government', 5000),
('lawyer', 'Lawyer', 'Legal representation', 'civilian', 4000),
('realestate', 'Real Estate Agent', 'Property sales', 'civilian', 2500),
('reporter', 'Reporter', 'News and journalism', 'civilian', 2200),
('banker', 'Banker', 'Financial services', 'civilian', 3500);

-- Insert job grades for police as example
INSERT INTO job_grades (job_id, grade, name, salary, permissions) VALUES
((SELECT id FROM jobs WHERE job_key = 'police'), 0, 'Cadet', 2500, '{"arrest": false, "ticket": false}'),
((SELECT id FROM jobs WHERE job_key = 'police'), 1, 'Officer', 3500, '{"arrest": true, "ticket": true}'),
((SELECT id FROM jobs WHERE job_key = 'police'), 2, 'Sergeant', 4500, '{"arrest": true, "ticket": true, "manage_roster": true}'),
((SELECT id FROM jobs WHERE job_key = 'police'), 3, 'Lieutenant', 5500, '{"arrest": true, "ticket": true, "manage_roster": true, "promote": true}'),
((SELECT id FROM jobs WHERE job_key = 'police'), 4, 'Captain', 7000, '{"arrest": true, "ticket": true, "manage_roster": true, "promote": true, "admin": true}'),
((SELECT id FROM jobs WHERE job_key = 'police'), 5, 'Chief', 10000, '{"all": true}');

-- Insert default status effects
INSERT INTO status_effects (effect_key, name, description, effect_type, default_duration, effect_data) VALUES
('bleeding', 'Bleeding', 'Losing health over time', 'debuff', 300, '{"health_drain": 0.5}'),
('burning', 'Burning', 'On fire, taking damage', 'debuff', 60, '{"health_drain": 2.0}'),
('poisoned', 'Poisoned', 'Toxins affecting your body', 'debuff', 600, '{"health_drain": 0.25, "stamina_drain": 0.5}'),
('drunk', 'Intoxicated', 'Under the influence of alcohol', 'debuff', 1800, '{"vision_blur": true, "movement_sway": true}'),
('high', 'High', 'Under the influence of drugs', 'debuff', 1200, '{"vision_effects": true, "time_dilation": true}'),
('adrenaline', 'Adrenaline Rush', 'Increased combat abilities', 'buff', 60, '{"damage_boost": 1.25, "speed_boost": 1.1}'),
('shields_up', 'Armored', 'Damage reduction active', 'buff', 300, '{"damage_reduction": 0.25}'),
('well_fed', 'Well Fed', 'Recently ate a good meal', 'buff', 3600, '{"health_regen": 0.1, "stamina_regen": 0.2}'),
('rested', 'Well Rested', 'Fully rested and recovered', 'buff', 7200, '{"xp_boost": 1.1, "stamina_regen": 0.15}'),
('injured', 'Injured', 'Wounds affecting movement', 'debuff', 0, '{"speed_reduction": 0.2, "max_health_reduction": 20}');

-- Insert sample items
INSERT INTO items (item_key, name, description, category, rarity, weight, max_stack, is_usable, base_price) VALUES
('bread', 'Bread', 'A fresh loaf of bread', 'consumable', 'common', 0.3, 10, true, 25),
('water_bottle', 'Water Bottle', 'Clean drinking water', 'consumable', 'common', 0.5, 10, true, 15),
('bandage', 'Bandage', 'Basic wound dressing', 'consumable', 'common', 0.1, 20, true, 100),
('medkit', 'First Aid Kit', 'Complete medical kit', 'consumable', 'uncommon', 1.0, 5, true, 500),
('lockpick', 'Lockpick', 'Tool for picking locks', 'tool', 'common', 0.1, 10, true, 150),
('phone', 'Mobile Phone', 'Communication device', 'electronics', 'common', 0.2, 1, true, 800),
('radio', 'Radio', 'Two-way communication', 'electronics', 'common', 0.5, 1, true, 300),
('weapon_pistol', 'Pistol', 'Standard 9mm handgun', 'weapon', 'uncommon', 1.2, 1, false, 5000),
('weapon_rifle', 'Assault Rifle', 'Military-grade rifle', 'weapon', 'rare', 3.5, 1, false, 25000),
('ammo_pistol', 'Pistol Ammo', '9mm ammunition', 'weapon', 'common', 0.02, 100, false, 10),
('repair_kit', 'Repair Kit', 'Vehicle repair tools', 'tool', 'uncommon', 5.0, 3, true, 1500),
('aluminum', 'Aluminum', 'Raw aluminum material', 'material', 'common', 0.5, 50, false, 50),
('steel', 'Steel', 'Refined steel material', 'material', 'common', 1.0, 50, false, 100),
('electronics_parts', 'Electronic Parts', 'Assorted electronic components', 'material', 'uncommon', 0.3, 30, false, 200);

SELECT 'Schema created successfully!' AS Status;
