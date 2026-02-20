-- Migration 016: NPC Sparring Soldier seed data
-- Adds is_npc flag to characters table and creates "Ser Rodrik" sparring soldier.
--
-- Stats: Prowess 5, Fortitude 5, Cunning 4, rest 3
-- Gear:  Iron bastard sword, Chainmail (medium), Iron heater shield (medium)
-- Skills: Blades 5
-- HP: 70

-- 1. Add NPC flag to characters (if not already present)
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS is_npc TINYINT(1) NOT NULL DEFAULT 0;

-- 2. Player record (NPC pseudo-player)
INSERT INTO players (sl_uuid, sl_name, is_active, is_banned)
VALUES ('npc-sparring-soldier-0001', 'NPC: Sparring Soldier', TRUE, FALSE);

SET @npc_player_id = LAST_INSERT_ID();

-- 3. Character record
INSERT INTO characters (player_id, name, level, experience, is_active, is_npc,
                        yield_threshold, yield_response)
VALUES (@npc_player_id, 'Ser Rodrik', 5, 0, TRUE, 1, 'heroic', 'merciful');

SET @npc_char_id = LAST_INSERT_ID();

-- 4. Aptitudes (Prowess 5, Fortitude 5, Cunning 4, rest 3)
INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES
  (@npc_char_id, 'prowess',     5, 5),
  (@npc_char_id, 'fortitude',   5, 5),
  (@npc_char_id, 'cunning',     4, 4),
  (@npc_char_id, 'command',     3, 3),
  (@npc_char_id, 'stewardship', 3, 3),
  (@npc_char_id, 'presence',    3, 3),
  (@npc_char_id, 'lore',        3, 3),
  (@npc_char_id, 'faith',       3, 3);

-- 5. Vitals (70 HP)
INSERT INTO character_vitals (character_id, health, max_health, armor, max_armor,
                              stamina, max_stamina, hunger, thirst, stress, oxygen)
VALUES (@npc_char_id, 70.00, 70.00, 0.00, 100.00, 100.00, 100.00, 100.00, 100.00, 0.00, 100.00);

-- 6. Equipment: iron_sword (mainHand), chainmail (armor), iron_shield (offHand)
INSERT INTO character_equipment (character_id, slot_id, item_id, durability)
VALUES
  (@npc_char_id, 'mainHand', (SELECT id FROM items WHERE item_key = 'iron_sword'), 100.00),
  (@npc_char_id, 'armor',    (SELECT id FROM items WHERE item_key = 'chainmail'),  100.00),
  (@npc_char_id, 'offHand',  (SELECT id FROM items WHERE item_key = 'iron_shield'), 100.00);

-- 7. Skills: Blades level 5
INSERT INTO character_skills (character_id, skill_id, level, experience)
VALUES (@npc_char_id, (SELECT id FROM skills WHERE skill_key = 'blades'), 5, 0);

-- 8. Finances (0 — NPCs don't need money)
INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money)
VALUES (@npc_char_id, 0, 0, 0, 0);

-- 9. Position (sparring yard — placeholder coords)
INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
VALUES (@npc_char_id, 'Sparring Yard', 128.0, 128.0, 25.0);

-- 10. Reputation (neutral)
INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
VALUES (@npc_char_id, 0, 0, 0, 0);

SELECT CONCAT('Migration 016 complete — Ser Rodrik (NPC ID ', @npc_char_id, ') created.') AS Status;
