-- Migration 031: Character Lineage Columns
-- Adds noble lineage, application status, and public bio fields to the characters table.

ALTER TABLE characters
    ADD COLUMN house_id INT UNSIGNED NULL
        COMMENT 'FK to houses.id — NULL for houseless characters'
        AFTER template_key,
    ADD COLUMN region_id INT UNSIGNED NULL
        COMMENT 'FK to regions.id — where this character is based'
        AFTER house_id,
    ADD COLUMN is_bastard BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Character has bastard blood'
        AFTER region_id,
    ADD COLUMN is_dragon_seed BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Character carries Valyrian/dragon blood outside the main Targaryen line'
        AFTER is_bastard,
    ADD COLUMN father_name VARCHAR(150) NULL
        COMMENT 'Free text father name (does not need to be a player character)'
        AFTER is_dragon_seed,
    ADD COLUMN mother_name VARCHAR(150) NULL
        COMMENT 'Free text mother name (does not need to be a player character)'
        AFTER father_name,
    ADD COLUMN title VARCHAR(100) NULL
        COMMENT 'Display title: Lord, Ser, Septa, etc.'
        AFTER mother_name,
    ADD COLUMN epithet VARCHAR(100) NULL
        COMMENT 'Informal name: The Kingslayer, Littlefinger, etc.'
        AFTER title,
    ADD COLUMN application_status ENUM('none','pending','approved','denied','revision') NOT NULL DEFAULT 'none'
        COMMENT 'Tracks approval state. none = auto-approved common character'
        AFTER epithet,
    ADD COLUMN application_reviewed_by INT UNSIGNED NULL
        COMMENT 'FK to players.id — the staff member who reviewed'
        AFTER application_status,
    ADD COLUMN application_reviewed_at TIMESTAMP NULL
        COMMENT 'When the review decision was made'
        AFTER application_reviewed_by,
    ADD COLUMN application_notes TEXT NULL
        COMMENT 'Staff-facing notes on the application decision'
        AFTER application_reviewed_at,
    ADD COLUMN public_bio TEXT NULL
        COMMENT 'Publicly visible biography (IC info, RP hooks)'
        AFTER application_notes;

-- Foreign key constraints
ALTER TABLE characters
    ADD CONSTRAINT fk_char_house FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_char_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- Index for querying characters by house
ALTER TABLE characters
    ADD INDEX idx_char_house (house_id),
    ADD INDEX idx_char_application_status (application_status);
