-- Migration 002: Chat System
-- Para RP chat with channels, proximity-based messaging, and persistent history

-- Channel definitions (IC, OOC, custom)
CREATE TABLE IF NOT EXISTS chat_channels (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    channel_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    channel_type ENUM('ic', 'ooc', 'custom') NOT NULL DEFAULT 'custom',
    is_proximity BOOLEAN DEFAULT TRUE,
    created_by INT UNSIGNED,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES characters(id) ON DELETE SET NULL,
    INDEX idx_channel_type (channel_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Persistent message history with region for proximity filtering
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    channel_id INT UNSIGNED NOT NULL,
    character_id INT UNSIGNED NOT NULL,
    content MEDIUMTEXT NOT NULL,
    message_type ENUM('say', 'emote', 'ooc', 'system') DEFAULT 'say',
    region VARCHAR(100) NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_channel_region_time (channel_id, region, created_at),
    INDEX idx_character (character_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default channels
INSERT INTO chat_channels (channel_key, name, description, channel_type, is_proximity) VALUES
('ic', 'In-Character', 'Main in-character roleplay channel', 'ic', TRUE),
('ooc', 'Out-of-Character', 'Out-of-character discussion', 'ooc', TRUE);
