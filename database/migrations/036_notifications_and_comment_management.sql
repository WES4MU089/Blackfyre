-- Migration 036: Persistent Notifications & Comment Management
-- Alters the existing (unused) notifications table to support player-level notifications,
-- expands notification types, and adds comment management columns to application_comments.

USE blackfyre_hud;

-- ============================================
-- NOTIFICATIONS TABLE — make player-aware & expand types
-- ============================================

-- Add player_id (required — every notification has a recipient player)
ALTER TABLE notifications
  ADD COLUMN player_id INT UNSIGNED NOT NULL AFTER id;

-- Make character_id nullable (player-level notifications have no character)
ALTER TABLE notifications
  MODIFY COLUMN character_id INT UNSIGNED NULL;

-- Expand notification_type ENUM
ALTER TABLE notifications
  MODIFY COLUMN notification_type ENUM(
    'info', 'success', 'warning', 'error',
    'achievement', 'quest', 'money', 'social',
    'application', 'combat', 'levelup', 'ailment',
    'raven', 'war', 'trade', 'staff'
  ) DEFAULT 'info';

-- Add metadata JSON for structured routing data (e.g. {"applicationId": 5})
ALTER TABLE notifications
  ADD COLUMN metadata JSON NULL AFTER action_url;

-- Add read_at timestamp for tracking when a notification was read
ALTER TABLE notifications
  ADD COLUMN read_at TIMESTAMP NULL AFTER is_read;

-- Add player_id index for efficient lookups
ALTER TABLE notifications
  ADD INDEX idx_notif_player (player_id);

-- Add composite index for unread-by-player queries (badge count)
ALTER TABLE notifications
  ADD INDEX idx_notif_player_unread (player_id, is_read);

-- Add foreign key for player_id
ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_player
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- Drop the existing character_id FK (named `1` in schema) and re-add to allow NULL
ALTER TABLE notifications
  DROP FOREIGN KEY `1`;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_character
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

-- ============================================
-- APPLICATION COMMENTS — add management columns
-- ============================================

-- Timestamp for when a comment was last edited
ALTER TABLE application_comments
  ADD COLUMN edited_at TIMESTAMP NULL AFTER updated_at;

-- Soft delete: NULL = active, non-NULL = deleted
ALTER TABLE application_comments
  ADD COLUMN deleted_at TIMESTAMP NULL AFTER edited_at;

-- Staff can toggle visibility (FALSE = hidden from player, still visible to staff)
ALTER TABLE application_comments
  ADD COLUMN is_visible BOOLEAN DEFAULT TRUE AFTER is_private;

SELECT 'Migration 036 complete — persistent notifications & comment management.' AS Status;
