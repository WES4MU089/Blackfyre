-- Migration 008: Chat System Overhaul
-- Adds shout/low/gooc message types, whisper table, and system/whisper channels

-- Extend message_type ENUM to include shout, low, gooc
ALTER TABLE chat_messages
  MODIFY COLUMN message_type ENUM('say', 'emote', 'ooc', 'system', 'shout', 'low', 'gooc') DEFAULT 'say';

-- Seed whispers and system channels (global, not proximity)
INSERT IGNORE INTO chat_channels (channel_key, name, description, channel_type, is_proximity) VALUES
('whispers', 'Whispers', 'Direct IC whispers between players', 'ic', FALSE),
('system', 'System', 'System messages and announcements', 'ic', FALSE);

-- Direct whisper messages between characters (separate table for sender/target tracking)
CREATE TABLE IF NOT EXISTS chat_whispers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_character_id INT UNSIGNED NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    sender_portrait_url VARCHAR(500),
    target_character_id INT UNSIGNED NOT NULL,
    target_name VARCHAR(100) NOT NULL,
    target_portrait_url VARCHAR(500),
    content MEDIUMTEXT NOT NULL,
    region VARCHAR(100) NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (target_character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_sender_time (sender_character_id, created_at),
    INDEX idx_target_time (target_character_id, created_at),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
