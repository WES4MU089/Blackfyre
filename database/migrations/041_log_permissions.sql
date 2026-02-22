-- Migration 041: Add permissions for combat and chat log viewers
INSERT IGNORE INTO permissions (`key`, label, category, description) VALUES
  ('system.view_combat_log', 'View Combat Logs', 'system', 'Access the combat log viewer'),
  ('system.view_chat_log', 'View Chat Logs', 'system', 'Access the chat log viewer');
