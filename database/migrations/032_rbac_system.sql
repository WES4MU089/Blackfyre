-- Migration 032: Role-Based Access Control (RBAC)
-- Creates roles, permissions, and role_permissions tables.
-- Adds role_id and is_super_admin to players.
-- Seeds default permissions and two starter roles (Moderator, Admin).

-- ============================================
-- ROLES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    color       VARCHAR(7) NULL                  COMMENT 'Hex color for badge display, e.g. #c9a84c',
    is_default  BOOLEAN DEFAULT FALSE            COMMENT 'If TRUE, auto-assigned to new players (only one)',
    sort_order  INT UNSIGNED DEFAULT 0           COMMENT 'Display priority (lower = higher rank)',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PERMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS permissions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key`       VARCHAR(100) NOT NULL UNIQUE     COMMENT 'Machine-readable key, e.g. applications.review',
    label       VARCHAR(150) NOT NULL            COMMENT 'Human-readable label for the UI',
    category    VARCHAR(50) NOT NULL             COMMENT 'Grouping: applications, family_tree, content, players, system',
    description VARCHAR(255) NULL                COMMENT 'Tooltip explanation'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ROLE_PERMISSIONS JUNCTION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INT UNSIGNED NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ADD ROLE AND SUPER ADMIN COLUMNS TO PLAYERS
-- ============================================

ALTER TABLE players
    ADD COLUMN role_id INT UNSIGNED NULL
        COMMENT 'FK to roles.id — NULL means no staff role',
    ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Hard-coded escape hatch — bypasses all permission checks';

ALTER TABLE players
    ADD CONSTRAINT fk_player_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;

-- ============================================
-- SEED PERMISSIONS (20 keys across 5 categories)
-- ============================================

INSERT INTO permissions (`key`, label, category, description) VALUES
-- Applications
('applications.view_queue',      'View application queue',                   'applications', 'View the list of pending and past character applications'),
('applications.review',          'Approve, deny, or request revision',       'applications', 'Make decisions on character applications'),
('applications.comment_public',  'Post public staff comments',               'applications', 'Post comments visible to the applicant'),
('applications.comment_private', 'Post and view private staff comments',     'applications', 'Post and read internal staff-only comments'),
('applications.delete',          'Delete applications',                      'applications', 'Permanently delete application records'),
-- Family Tree
('family_tree.manage',              'Add/remove/edit nodes and edges',       'family_tree', 'Directly manage family tree entries without approval'),
('family_tree.approve_suggestions', 'Approve or deny player suggestions',   'family_tree', 'Review and approve player-submitted family tree edits'),
-- Content
('content.edit_bios',              'Flag or edit player public bios',       'content', 'Review and modify player-written public biographies'),
('content.manage_houses',          'Manage houses',                         'content', 'Create, edit, and delete noble houses'),
('content.manage_regions',         'Manage regions',                        'content', 'Create, edit, and delete regions'),
('content.manage_organizations',   'Manage organizations',                  'content', 'Create, edit, and delete organizations'),
('content.manage_factions',        'Manage factions',                       'content', 'Create, edit, and delete factions'),
-- Players
('players.view_list',       'View player list',          'players', 'View the full list of registered players'),
('players.assign_roles',    'Assign roles to players',   'players', 'Change a player''s staff role assignment'),
('players.ban',             'Ban or suspend players',     'players', 'Ban or suspend player accounts'),
('players.delete_characters', 'Delete characters',       'players', 'Permanently delete player characters'),
-- System
('system.view_audit_log', 'View the audit log',                    'system', 'View the log of all staff actions'),
('system.manage_roles',   'Create/edit/delete roles & permissions', 'system', 'Manage the RBAC role and permission configuration'),
('system.server_config',  'Access server configuration settings',   'system', 'Modify server-wide configuration values');

-- ============================================
-- SEED ROLES
-- ============================================

INSERT INTO roles (id, name, description, color, sort_order) VALUES
(1, 'Moderator', 'Application review, family tree management, bio moderation', '#4a90d9', 2),
(2, 'Admin',     'Full staff access including house/region management and player administration', '#c9a84c', 1);

-- ============================================
-- ASSIGN PERMISSIONS TO ROLES
-- ============================================

-- Moderator: 10 permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE `key` IN (
    'applications.view_queue',
    'applications.review',
    'applications.comment_public',
    'applications.comment_private',
    'family_tree.manage',
    'family_tree.approve_suggestions',
    'content.edit_bios',
    'players.view_list',
    'system.view_audit_log'
);

-- Admin: all 20 permissions (superset of Moderator, but NOT super_admin)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions;
