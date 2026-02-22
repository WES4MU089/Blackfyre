-- Migration 039: Organizations, Political Factions, Family Trees & Audit Log
-- Renames legacy FiveM-era faction/audit tables, creates new political model

-- ============================================
-- 1. RENAME LEGACY TABLES
-- ============================================

-- Rename legacy FiveM faction tables to preserve any data
RENAME TABLE factions TO legacy_factions;
RENAME TABLE faction_ranks TO legacy_faction_ranks;
RENAME TABLE faction_members TO legacy_faction_members;

-- Rename legacy audit_log
RENAME TABLE audit_log TO legacy_audit_log;

-- ============================================
-- 2. ORGANIZATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL UNIQUE,
    org_type            ENUM('order','guild','company') NOT NULL,
    description         TEXT NULL,
    sigil_url           VARCHAR(500) NULL,
    region_id           INT UNSIGNED NULL,
    leader_character_id INT UNSIGNED NULL,
    requires_approval   BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL,
    FOREIGN KEY (leader_character_id) REFERENCES characters(id) ON DELETE SET NULL,
    INDEX idx_org_type (org_type),
    INDEX idx_org_region (region_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_members (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id     INT UNSIGNED NOT NULL,
    character_id        INT UNSIGNED NOT NULL,
    rank                VARCHAR(50) NULL,
    joined_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_org_character (organization_id, character_id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_org_member_character (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. POLITICAL FACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS factions (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    description         TEXT NULL,
    banner_url          VARCHAR(500) NULL,
    leader_character_id INT UNSIGNED NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leader_character_id) REFERENCES characters(id) ON DELETE SET NULL,
    INDEX idx_faction_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS faction_members (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    faction_id          INT UNSIGNED NOT NULL,
    character_id        INT UNSIGNED NOT NULL,
    declared_publicly   BOOLEAN DEFAULT TRUE,
    joined_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_faction_character (faction_id, character_id),
    FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_faction_member_character (character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. FAMILY TREE
-- ============================================

CREATE TABLE IF NOT EXISTS family_tree_npcs (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    house_id            INT UNSIGNED NOT NULL,
    name                VARCHAR(150) NOT NULL,
    title               VARCHAR(100) NULL,
    epithet             VARCHAR(100) NULL,
    portrait_url        VARCHAR(500) NULL,
    public_bio          TEXT NULL,
    is_deceased         BOOLEAN DEFAULT FALSE,
    created_by          INT UNSIGNED NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES players(id),
    INDEX idx_ftnpc_house (house_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_tree_edges (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    house_id            INT UNSIGNED NOT NULL,
    relationship        ENUM('parent','spouse','sibling') NOT NULL,
    from_character_id   INT UNSIGNED NULL,
    from_npc_id         INT UNSIGNED NULL,
    to_character_id     INT UNSIGNED NULL,
    to_npc_id           INT UNSIGNED NULL,
    created_by          INT UNSIGNED NOT NULL,
    approved_by         INT UNSIGNED NULL,
    approved_at         TIMESTAMP NULL,
    status              ENUM('pending','approved','denied') DEFAULT 'pending',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (from_character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (from_npc_id) REFERENCES family_tree_npcs(id) ON DELETE CASCADE,
    FOREIGN KEY (to_character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (to_npc_id) REFERENCES family_tree_npcs(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES players(id),
    FOREIGN KEY (approved_by) REFERENCES players(id),
    INDEX idx_fte_house (house_id),
    INDEX idx_fte_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. STAFF AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_id            INT UNSIGNED NOT NULL,
    action_key          VARCHAR(100) NOT NULL,
    description         TEXT NOT NULL,
    target_type         VARCHAR(50) NULL,
    target_id           INT UNSIGNED NULL,
    metadata            JSON NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES players(id),
    INDEX idx_audit_actor (actor_id),
    INDEX idx_audit_action (action_key),
    INDEX idx_audit_target (target_type, target_id),
    INDEX idx_audit_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. ADD organization_id TO character_applications
-- ============================================

ALTER TABLE character_applications
  ADD COLUMN organization_id INT UNSIGNED NULL AFTER house_id,
  ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- ============================================
-- 7. SEED RESTRICTED ORGANIZATIONS
-- ============================================

INSERT INTO organizations (name, org_type, description, requires_approval, region_id) VALUES
('The Night''s Watch',   'order',   'The sworn brotherhood that guards the Wall and the realms of men.',             TRUE, (SELECT id FROM regions WHERE name = 'The North')),
('The Kingsguard',       'order',   'Seven knights sworn to protect the King and the royal family.',                  TRUE, (SELECT id FROM regions WHERE name = 'The Crownlands')),
('The Faith Militant',   'order',   'The military arm of the Faith of the Seven.',                                   TRUE, (SELECT id FROM regions WHERE name = 'The Crownlands')),
('The Maesters',         'order',   'The learned order of the Citadel, advisors and healers to the lords of Westeros.', TRUE, (SELECT id FROM regions WHERE name = 'The Reach')),
('The Golden Company',   'company', 'The most famous and powerful of the free companies, founded by Bittersteel.',   TRUE, NULL),
('The Iron Bank',        'guild',   'The most powerful financial institution in the known world, based in Braavos.', TRUE, NULL);

SELECT 'Migration 039 complete — organizations, factions, family tree, and audit log tables created.' AS Status;
