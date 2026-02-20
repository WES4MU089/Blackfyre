-- Migration 022: NPC Ser Arthur Pain + 4 retainers
-- A significantly tougher sparring opponent than Ser Rodrik.
--
-- Arthur Pain: Prowess 7, Fortitude 6, Cunning 5, Blades 7, 80 HP
--   Gear: Castle-forged bastard sword, steel heavy plate, castle-forged heater shield
--
-- Retainers (4):
--   Sworn Shield — Prowess 5, Fort 5, Cun 3, Blades 5, 70 HP (defensive)
--   Serjeant    — Prowess 5, Fort 4, Cun 3, Blunt 4, 60 HP (blunt weapon)
--   Squire      — Prowess 4, Fort 3, Cun 4, Blades 3, 50 HP (weakest)
--   Bannerman   — Prowess 4, Fort 4, Cun 3, Blades 4, 60 HP (average)

-- 1. Player record (NPC pseudo-player) — use existing if already present
INSERT IGNORE INTO players (sl_uuid, sl_name, is_active, is_banned)
VALUES ('npc-arthur-pain-0001', 'NPC: Ser Arthur Pain', TRUE, FALSE);

SET @npc_player_id = (SELECT id FROM players WHERE sl_uuid = 'npc-arthur-pain-0001');

-- 2. Character record
INSERT INTO characters (player_id, name, level, xp_segments, is_active, is_npc,
                        yield_threshold, yield_response)
VALUES (@npc_player_id, 'Ser Arthur Pain', 8, 0, TRUE, 1, 'heroic', 'pragmatic');

SET @arthur_id = LAST_INSERT_ID();

-- 3. Aptitudes (Prowess 7, Fortitude 6, Cunning 5, rest 3)
INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES
  (@arthur_id, 'prowess',     7, 7),
  (@arthur_id, 'fortitude',   6, 6),
  (@arthur_id, 'cunning',     5, 5),
  (@arthur_id, 'command',     3, 3),
  (@arthur_id, 'stewardship', 3, 3),
  (@arthur_id, 'presence',    3, 3),
  (@arthur_id, 'lore',        3, 3),
  (@arthur_id, 'faith',       3, 3);

-- 4. Vitals (80 HP = 20 + Fortitude 6 * 10)
INSERT INTO character_vitals (character_id, health, max_health, armor, max_armor,
                              stamina, max_stamina, hunger, thirst, stress, oxygen)
VALUES (@arthur_id, 80.00, 80.00, 0.00, 100.00, 100.00, 100.00, 100.00, 100.00, 0.00, 100.00);

-- 5. Equipment: CF bastard sword, steel heavy plate, CF heater shield
INSERT INTO character_equipment (character_id, slot_id, item_id, durability) VALUES
  (@arthur_id, 'mainHand', (SELECT id FROM items WHERE item_key = 'cf_bastard_sword'), 100.00),
  (@arthur_id, 'armor',    (SELECT id FROM items WHERE item_key = 'steel_plate'),      100.00),
  (@arthur_id, 'offHand',  (SELECT id FROM items WHERE item_key = 'cf_heater'),        100.00);

-- 6. Skills: Blades 7
INSERT INTO character_skills (character_id, skill_id, level, xp_segments)
VALUES (@arthur_id, (SELECT id FROM skills WHERE skill_key = 'blades'), 7, 0);

-- 7. Finances (0)
INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money)
VALUES (@arthur_id, 0, 0, 0, 0);

-- 8. Position
INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
VALUES (@arthur_id, 'Sparring Yard', 128.0, 128.0, 25.0);

-- 9. Reputation
INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
VALUES (@arthur_id, 0, 0, 0, 0);

-- ============================================================================
-- Retainer 1: Arthur's Sworn Shield
-- Prowess 5, Fortitude 5, Cunning 3, Blades 5, 70 HP
-- Steel bastard sword + steel heavy plate + steel heater shield
-- ============================================================================

INSERT INTO characters (player_id, name, level, xp_segments, is_active, is_npc,
                        owner_character_id, retainer_type_key,
                        yield_threshold, yield_response)
VALUES (@npc_player_id, 'Arthur''s Sworn Shield', 5, 0, TRUE, 1,
        @arthur_id, NULL, 'brave', 'pragmatic');

SET @ret1_id = LAST_INSERT_ID();

INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES
  (@ret1_id, 'prowess',     5, 5),
  (@ret1_id, 'fortitude',   5, 5),
  (@ret1_id, 'cunning',     3, 3),
  (@ret1_id, 'command',     3, 3),
  (@ret1_id, 'stewardship', 3, 3),
  (@ret1_id, 'presence',    3, 3),
  (@ret1_id, 'lore',        3, 3),
  (@ret1_id, 'faith',       3, 3);

INSERT INTO character_vitals (character_id, health, max_health, armor, max_armor,
                              stamina, max_stamina, hunger, thirst, stress, oxygen)
VALUES (@ret1_id, 70.00, 70.00, 0.00, 100.00, 100.00, 100.00, 100.00, 100.00, 0.00, 100.00);

INSERT INTO character_equipment (character_id, slot_id, item_id, durability) VALUES
  (@ret1_id, 'mainHand', (SELECT id FROM items WHERE item_key = 'steel_bastard_sword'), 100.00),
  (@ret1_id, 'armor',    (SELECT id FROM items WHERE item_key = 'steel_plate'),         100.00),
  (@ret1_id, 'offHand',  (SELECT id FROM items WHERE item_key = 'steel_heater'),        100.00);

INSERT INTO character_skills (character_id, skill_id, level, xp_segments)
VALUES (@ret1_id, (SELECT id FROM skills WHERE skill_key = 'blades'), 5, 0);

INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money)
VALUES (@ret1_id, 0, 0, 0, 0);

INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
VALUES (@ret1_id, 'Sparring Yard', 128.0, 128.0, 25.0);

INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
VALUES (@ret1_id, 0, 0, 0, 0);

-- ============================================================================
-- Retainer 2: Arthur's Serjeant
-- Prowess 5, Fortitude 4, Cunning 3, Blunt 4, 60 HP
-- Steel battleaxe + chainmail + iron shield
-- ============================================================================

INSERT INTO characters (player_id, name, level, xp_segments, is_active, is_npc,
                        owner_character_id, retainer_type_key,
                        yield_threshold, yield_response)
VALUES (@npc_player_id, 'Arthur''s Serjeant', 4, 0, TRUE, 1,
        @arthur_id, NULL, 'brave', 'pragmatic');

SET @ret2_id = LAST_INSERT_ID();

INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES
  (@ret2_id, 'prowess',     5, 5),
  (@ret2_id, 'fortitude',   4, 4),
  (@ret2_id, 'cunning',     3, 3),
  (@ret2_id, 'command',     3, 3),
  (@ret2_id, 'stewardship', 3, 3),
  (@ret2_id, 'presence',    3, 3),
  (@ret2_id, 'lore',        3, 3),
  (@ret2_id, 'faith',       3, 3);

INSERT INTO character_vitals (character_id, health, max_health, armor, max_armor,
                              stamina, max_stamina, hunger, thirst, stress, oxygen)
VALUES (@ret2_id, 60.00, 60.00, 0.00, 100.00, 100.00, 100.00, 100.00, 100.00, 0.00, 100.00);

INSERT INTO character_equipment (character_id, slot_id, item_id, durability) VALUES
  (@ret2_id, 'mainHand', (SELECT id FROM items WHERE item_key = 'steel_battleaxe'), 100.00),
  (@ret2_id, 'armor',    (SELECT id FROM items WHERE item_key = 'chainmail'),       100.00),
  (@ret2_id, 'offHand',  (SELECT id FROM items WHERE item_key = 'iron_shield'),     100.00);

INSERT INTO character_skills (character_id, skill_id, level, xp_segments)
VALUES (@ret2_id, (SELECT id FROM skills WHERE skill_key = 'blunt'), 4, 0);

INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money)
VALUES (@ret2_id, 0, 0, 0, 0);

INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
VALUES (@ret2_id, 'Sparring Yard', 128.0, 128.0, 25.0);

INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
VALUES (@ret2_id, 0, 0, 0, 0);

-- ============================================================================
-- Retainer 3: Arthur's Squire
-- Prowess 4, Fortitude 3, Cunning 4, Blades 3, 50 HP
-- Iron sword + brigandine + iron shield
-- ============================================================================

INSERT INTO characters (player_id, name, level, xp_segments, is_active, is_npc,
                        owner_character_id, retainer_type_key,
                        yield_threshold, yield_response)
VALUES (@npc_player_id, 'Arthur''s Squire', 3, 0, TRUE, 1,
        @arthur_id, NULL, 'cautious', 'pragmatic');

SET @ret3_id = LAST_INSERT_ID();

INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES
  (@ret3_id, 'prowess',     4, 4),
  (@ret3_id, 'fortitude',   3, 3),
  (@ret3_id, 'cunning',     4, 4),
  (@ret3_id, 'command',     3, 3),
  (@ret3_id, 'stewardship', 3, 3),
  (@ret3_id, 'presence',    3, 3),
  (@ret3_id, 'lore',        3, 3),
  (@ret3_id, 'faith',       3, 3);

INSERT INTO character_vitals (character_id, health, max_health, armor, max_armor,
                              stamina, max_stamina, hunger, thirst, stress, oxygen)
VALUES (@ret3_id, 50.00, 50.00, 0.00, 100.00, 100.00, 100.00, 100.00, 100.00, 0.00, 100.00);

INSERT INTO character_equipment (character_id, slot_id, item_id, durability) VALUES
  (@ret3_id, 'mainHand', (SELECT id FROM items WHERE item_key = 'iron_sword'),  100.00),
  (@ret3_id, 'armor',    (SELECT id FROM items WHERE item_key = 'brigandine'),  100.00),
  (@ret3_id, 'offHand',  (SELECT id FROM items WHERE item_key = 'iron_shield'), 100.00);

INSERT INTO character_skills (character_id, skill_id, level, xp_segments)
VALUES (@ret3_id, (SELECT id FROM skills WHERE skill_key = 'blades'), 3, 0);

INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money)
VALUES (@ret3_id, 0, 0, 0, 0);

INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
VALUES (@ret3_id, 'Sparring Yard', 128.0, 128.0, 25.0);

INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
VALUES (@ret3_id, 0, 0, 0, 0);

-- ============================================================================
-- Retainer 4: Arthur's Bannerman
-- Prowess 4, Fortitude 4, Cunning 3, Blades 4, 60 HP
-- Iron bastard sword + chainmail + iron shield
-- ============================================================================

INSERT INTO characters (player_id, name, level, xp_segments, is_active, is_npc,
                        owner_character_id, retainer_type_key,
                        yield_threshold, yield_response)
VALUES (@npc_player_id, 'Arthur''s Bannerman', 4, 0, TRUE, 1,
        @arthur_id, NULL, 'brave', 'pragmatic');

SET @ret4_id = LAST_INSERT_ID();

INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES
  (@ret4_id, 'prowess',     4, 4),
  (@ret4_id, 'fortitude',   4, 4),
  (@ret4_id, 'cunning',     3, 3),
  (@ret4_id, 'command',     3, 3),
  (@ret4_id, 'stewardship', 3, 3),
  (@ret4_id, 'presence',    3, 3),
  (@ret4_id, 'lore',        3, 3),
  (@ret4_id, 'faith',       3, 3);

INSERT INTO character_vitals (character_id, health, max_health, armor, max_armor,
                              stamina, max_stamina, hunger, thirst, stress, oxygen)
VALUES (@ret4_id, 60.00, 60.00, 0.00, 100.00, 100.00, 100.00, 100.00, 100.00, 0.00, 100.00);

INSERT INTO character_equipment (character_id, slot_id, item_id, durability) VALUES
  (@ret4_id, 'mainHand', (SELECT id FROM items WHERE item_key = 'iron_bastard_sword'), 100.00),
  (@ret4_id, 'armor',    (SELECT id FROM items WHERE item_key = 'chainmail'),          100.00),
  (@ret4_id, 'offHand',  (SELECT id FROM items WHERE item_key = 'iron_shield'),        100.00);

INSERT INTO character_skills (character_id, skill_id, level, xp_segments)
VALUES (@ret4_id, (SELECT id FROM skills WHERE skill_key = 'blades'), 4, 0);

INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money)
VALUES (@ret4_id, 0, 0, 0, 0);

INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
VALUES (@ret4_id, 'Sparring Yard', 128.0, 128.0, 25.0);

INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
VALUES (@ret4_id, 0, 0, 0, 0);

SELECT CONCAT('Migration 022 complete — Ser Arthur Pain (ID ', @arthur_id,
  ') + 4 retainers (IDs: ', @ret1_id, ', ', @ret2_id, ', ', @ret3_id, ', ', @ret4_id, ')') AS Status;
