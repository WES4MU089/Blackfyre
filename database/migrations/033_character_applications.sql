-- Migration 033: Character Applications and Comments
-- Creates the character_applications table for tracking noble/featured role applications
-- and the application_comments table for threaded staff-applicant discussion.

-- ============================================
-- CHARACTER APPLICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS character_applications (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id      INT UNSIGNED NOT NULL           COMMENT 'FK to characters.id',
    player_id         INT UNSIGNED NOT NULL           COMMENT 'FK to players.id (denormalized for queries)',
    -- Lineage fields (as submitted)
    house_id          INT UNSIGNED NULL               COMMENT 'FK to houses.id',
    is_bastard        BOOLEAN DEFAULT FALSE,
    is_dragon_seed    BOOLEAN DEFAULT FALSE,
    father_name       VARCHAR(150) NOT NULL           COMMENT 'Free text — need not be a player character',
    mother_name       VARCHAR(150) NOT NULL           COMMENT 'Free text — need not be a player character',
    requested_role    ENUM('member','head_of_house','lord_paramount','royalty') DEFAULT 'member',
    is_featured_role  BOOLEAN DEFAULT FALSE           COMMENT 'Player toggle; auto-TRUE for HoH/LP/royalty',
    -- Head of House coordination
    hoh_contact       TEXT NULL                       COMMENT 'Short answer: did you contact the Head of House?',
    -- Bios
    application_bio   TEXT NOT NULL                   COMMENT 'Full backstory/justification (staff-only)',
    public_bio        TEXT NULL                       COMMENT 'Optional public-facing IC bio',
    -- Status
    status            ENUM('pending','approved','denied','revision') DEFAULT 'pending',
    staff_notes       TEXT NULL                       COMMENT 'Reviewer feedback (legacy field)',
    reviewed_by       INT UNSIGNED NULL               COMMENT 'FK to players.id (staff member)',
    reviewed_at       TIMESTAMP NULL,
    -- Timestamps
    submitted_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE SET NULL,
    INDEX idx_app_player (player_id),
    INDEX idx_app_status (status),
    INDEX idx_app_character (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- APPLICATION COMMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS application_comments (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id  INT UNSIGNED NOT NULL           COMMENT 'FK to character_applications.id',
    author_id       INT UNSIGNED NOT NULL           COMMENT 'FK to players.id (staff member)',
    body            TEXT NOT NULL                   COMMENT 'Comment text (markdown supported)',
    is_private      BOOLEAN DEFAULT FALSE           COMMENT 'TRUE = staff-only; FALSE = visible to applicant',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES character_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES players(id),
    INDEX idx_comment_app (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
