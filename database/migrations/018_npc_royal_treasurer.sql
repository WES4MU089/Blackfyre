-- Migration 018: Royal Treasurer NPC seed data
-- Test NPC that gives gold for development/testing purposes.
-- Same pattern as Ser Rodrik (migration 016).

USE blackfyre_hud;

-- 1. Player record (NPC pseudo-player)
INSERT INTO players (sl_uuid, sl_name, is_active, is_banned)
VALUES ('npc-royal-treasurer-0001', 'NPC: Royal Treasurer', TRUE, FALSE);

SET @npc_player_id = LAST_INSERT_ID();

-- 2. Character record
INSERT INTO characters (player_id, name, level, experience, is_active, is_npc,
                        yield_threshold, yield_response)
VALUES (@npc_player_id, 'The Royal Treasurer', 1, 0, TRUE, 1, 'heroic', 'merciful');

SET @npc_char_id = LAST_INSERT_ID();

-- 3. Aptitudes (minimal — this NPC does not fight)
INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES
  (@npc_char_id, 'prowess',     1, 1),
  (@npc_char_id, 'fortitude',   1, 1),
  (@npc_char_id, 'cunning',     3, 3),
  (@npc_char_id, 'command',     1, 1),
  (@npc_char_id, 'stewardship', 8, 8),
  (@npc_char_id, 'presence',    5, 5),
  (@npc_char_id, 'lore',        4, 4),
  (@npc_char_id, 'faith',       1, 1);

-- 4. Vitals (low HP — non-combatant)
INSERT INTO character_vitals (character_id, health, max_health, armor, max_armor,
                              stamina, max_stamina, hunger, thirst, stress, oxygen)
VALUES (@npc_char_id, 30.00, 30.00, 0.00, 100.00, 100.00, 100.00, 100.00, 100.00, 0.00, 100.00);

-- 5. Finances (the Crown's coffers — effectively unlimited for test purposes)
INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money)
VALUES (@npc_char_id, 999999999, 999999999, 0, 0);

-- 6. Position (Sparring Yard — placeholder coords, near Ser Rodrik)
INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
VALUES (@npc_char_id, 'Sparring Yard', 132.0, 128.0, 25.0);

-- 7. Reputation
INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
VALUES (@npc_char_id, 0, 0, 0, 0);

SELECT CONCAT('Migration 018 complete — The Royal Treasurer (NPC ID ', @npc_char_id, ') created.') AS Status;
