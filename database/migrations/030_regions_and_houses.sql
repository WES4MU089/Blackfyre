-- Migration 030: Regions and Houses
-- Creates the regions and houses tables with seed data for the 9 canonical regions
-- and Great/Royal Houses of Westeros.

-- ============================================
-- REGIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS regions (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL UNIQUE,
    description         TEXT NULL,
    banner_url          VARCHAR(500) NULL,
    ruling_house_id     INT UNSIGNED NULL,
    warden_character_id INT UNSIGNED NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOUSES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS houses (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name              VARCHAR(100) NOT NULL UNIQUE,
    motto             VARCHAR(255) NULL,
    sigil_url         VARCHAR(500) NULL,
    seat              VARCHAR(100) NULL,
    region_id         INT UNSIGNED NULL,
    is_great_house    BOOLEAN DEFAULT FALSE,
    is_royal_house    BOOLEAN DEFAULT FALSE,
    is_extinct        BOOLEAN DEFAULT FALSE,
    head_character_id INT UNSIGNED NULL,
    lore_summary      TEXT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add FK from regions back to houses (circular reference resolved via ALTER)
ALTER TABLE regions
    ADD CONSTRAINT fk_regions_ruling_house
    FOREIGN KEY (ruling_house_id) REFERENCES houses(id) ON DELETE SET NULL;

-- ============================================
-- SEED DATA: REGIONS
-- ============================================

INSERT INTO regions (id, name, description) VALUES
(1, 'The Crownlands',  'The lands surrounding King''s Landing, seat of the Iron Throne and heart of the Seven Kingdoms.'),
(2, 'The North',        'The largest region by area, stretching from the Neck to the Wall. Cold, vast, and fiercely independent.'),
(3, 'The Westerlands',  'The wealthiest region, rich in gold mines beneath the hills and mountains.'),
(4, 'The Stormlands',   'A region of fierce storms and hardy warriors along the eastern coast.'),
(5, 'The Vale',         'An isolated mountain realm protected by the Bloody Gate and the towering Eyrie.'),
(6, 'The Riverlands',   'The central crossroads of Westeros, fertile but war-torn and difficult to defend.'),
(7, 'The Iron Islands', 'A chain of harsh, rocky islands in Ironman''s Bay, home to raiders and reavers.'),
(8, 'The Reach',        'The most fertile and populous region, breadbasket of the Seven Kingdoms.'),
(9, 'Dorne',            'The southernmost region, culturally distinct with ties to Rhoynish tradition.');

-- ============================================
-- SEED DATA: HOUSES
-- ============================================

INSERT INTO houses (id, name, motto, seat, region_id, is_great_house, is_royal_house) VALUES
(1, 'Targaryen',  'Fire and Blood',            'King''s Landing', 1, FALSE, TRUE),
(2, 'Stark',      'Winter Is Coming',          'Winterfell',      2, TRUE,  FALSE),
(3, 'Lannister',  'Hear Me Roar!',             'Casterly Rock',   3, TRUE,  FALSE),
(4, 'Baratheon',  'Ours Is the Fury',          'Storm''s End',    4, TRUE,  FALSE),
(5, 'Arryn',      'As High as Honor',          'The Eyrie',       5, TRUE,  FALSE),
(6, 'Tully',      'Family, Duty, Honor',       'Riverrun',        6, TRUE,  FALSE),
(7, 'Greyjoy',    'We Do Not Sow',             'Pyke',            7, TRUE,  FALSE),
(8, 'Tyrell',     'Growing Strong',            'Highgarden',      8, TRUE,  FALSE),
(9, 'Martell',    'Unbowed, Unbent, Unbroken', 'Sunspear',        9, TRUE,  FALSE);

-- Wire regions to their ruling houses
UPDATE regions SET ruling_house_id = 1 WHERE id = 1;  -- Crownlands -> Targaryen
UPDATE regions SET ruling_house_id = 2 WHERE id = 2;  -- North -> Stark
UPDATE regions SET ruling_house_id = 3 WHERE id = 3;  -- Westerlands -> Lannister
UPDATE regions SET ruling_house_id = 4 WHERE id = 4;  -- Stormlands -> Baratheon
UPDATE regions SET ruling_house_id = 5 WHERE id = 5;  -- Vale -> Arryn
UPDATE regions SET ruling_house_id = 6 WHERE id = 6;  -- Riverlands -> Tully
UPDATE regions SET ruling_house_id = 7 WHERE id = 7;  -- Iron Islands -> Greyjoy
UPDATE regions SET ruling_house_id = 8 WHERE id = 8;  -- Reach -> Tyrell
UPDATE regions SET ruling_house_id = 9 WHERE id = 9;  -- Dorne -> Martell
