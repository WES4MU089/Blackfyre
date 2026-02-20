-- Migration 019: NPC retainers for Ser Rodrik
-- Creates 3 retainer characters owned by Ser Rodrik so the NPC can match
-- opposing team size in combat lobbies.
--
-- Each retainer is weaker than the leader (level 3, lower aptitudes, less HP).
-- They use owner_character_id to link back to Ser Rodrik.
-- No retainer_type_key — NPC retainers bypass the retainer shop system.

-- Look up Ser Rodrik
SET @rodrik_id = (SELECT id FROM characters WHERE name = 'Ser Rodrik' AND is_npc = 1 LIMIT 1);
SET @rodrik_player_id = (SELECT player_id FROM characters WHERE id = @rodrik_id);

-- ============================================================================
-- Retainer 1: Rodrik's Squire — Prowess 4, Fortitude 4, Cunning 3, Blades 4, 60 HP
-- ============================================================================

INSERT INTO characters (player_id, name, level, experience, is_active, is_npc,
                        owner_character_id, retainer_type_key,
                        yield_threshold, yield_response)
VALUES (@rodrik_player_id, 'Rodrik''s Squire', 3, 0, TRUE, 1,
        @rodrik_id, NULL, 'brave', 'pragmatic');

SET @ret1_id = LAST_INSERT_ID();

INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES
  (@ret1_id, 'prowess',     4, 4),
  (@ret1_id, 'fortitude',   4, 4),
  (@ret1_id, 'cunning',     3, 3),
  (@ret1_id, 'command',     3, 3),
  (@ret1_id, 'stewardship', 3, 3),
  (@ret1_id, 'presence',    3, 3),
  (@ret1_id, 'lore',        3, 3),
  (@ret1_id, 'faith',       3, 3);

INSERT INTO character_vitals (character_id, health, max_health, armor, max_armor,
                              stamina, max_stamina, hunger, thirst, stress, oxygen)
VALUES (@ret1_id, 60.00, 60.00, 0.00, 100.00, 100.00, 100.00, 100.00, 100.00, 0.00, 100.00);

INSERT INTO character_equipment (character_id, slot_id, item_id, durability) VALUES
  (@ret1_id, 'mainHand', (SELECT id FROM items WHERE item_key = 'iron_sword'), 100.00),
  (@ret1_id, 'armor',    (SELECT id FROM items WHERE item_key = 'chainmail'),  100.00),
  (@ret1_id, 'offHand',  (SELECT id FROM items WHERE item_key = 'iron_shield'), 100.00);

INSERT INTO character_skills (character_id, skill_id, level, experience)
VALUES (@ret1_id, (SELECT id FROM skills WHERE skill_key = 'blades'), 4, 0);

INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money)
VALUES (@ret1_id, 0, 0, 0, 0);

INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
VALUES (@ret1_id, 'Sparring Yard', 128.0, 128.0, 25.0);

INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
VALUES (@ret1_id, 0, 0, 0, 0);

-- ============================================================================
-- Retainer 2: Rodrik's Man-at-Arms — Prowess 4, Fortitude 4, Cunning 3, Blades 4, 60 HP
-- ============================================================================

INSERT INTO characters (player_id, name, level, experience, is_active, is_npc,
                        owner_character_id, retainer_type_key,
                        yield_threshold, yield_response)
VALUES (@rodrik_player_id, 'Rodrik''s Man-at-Arms', 3, 0, TRUE, 1,
        @rodrik_id, NULL, 'brave', 'pragmatic');

SET @ret2_id = LAST_INSERT_ID();

INSERT INTO character_aptitudes (character_id, aptitude_key, base_value, current_value) VALUES
  (@ret2_id, 'prowess',     4, 4),
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
  (@ret2_id, 'mainHand', (SELECT id FROM items WHERE item_key = 'iron_sword'), 100.00),
  (@ret2_id, 'armor',    (SELECT id FROM items WHERE item_key = 'chainmail'),  100.00),
  (@ret2_id, 'offHand',  (SELECT id FROM items WHERE item_key = 'iron_shield'), 100.00);

INSERT INTO character_skills (character_id, skill_id, level, experience)
VALUES (@ret2_id, (SELECT id FROM skills WHERE skill_key = 'blades'), 4, 0);

INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money)
VALUES (@ret2_id, 0, 0, 0, 0);

INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
VALUES (@ret2_id, 'Sparring Yard', 128.0, 128.0, 25.0);

INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
VALUES (@ret2_id, 0, 0, 0, 0);

-- ============================================================================
-- Retainer 3: Rodrik's Sentry — Prowess 4, Fortitude 3, Cunning 4, Blades 4, 55 HP
-- ============================================================================

INSERT INTO characters (player_id, name, level, experience, is_active, is_npc,
                        owner_character_id, retainer_type_key,
                        yield_threshold, yield_response)
VALUES (@rodrik_player_id, 'Rodrik''s Sentry', 3, 0, TRUE, 1,
        @rodrik_id, NULL, 'brave', 'pragmatic');

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
VALUES (@ret3_id, 55.00, 55.00, 0.00, 100.00, 100.00, 100.00, 100.00, 100.00, 0.00, 100.00);

INSERT INTO character_equipment (character_id, slot_id, item_id, durability) VALUES
  (@ret3_id, 'mainHand', (SELECT id FROM items WHERE item_key = 'iron_sword'), 100.00),
  (@ret3_id, 'armor',    (SELECT id FROM items WHERE item_key = 'chainmail'),  100.00),
  (@ret3_id, 'offHand',  (SELECT id FROM items WHERE item_key = 'iron_shield'), 100.00);

INSERT INTO character_skills (character_id, skill_id, level, experience)
VALUES (@ret3_id, (SELECT id FROM skills WHERE skill_key = 'blades'), 4, 0);

INSERT INTO character_finances (character_id, cash, bank, crypto, dirty_money)
VALUES (@ret3_id, 0, 0, 0, 0);

INSERT INTO character_positions (character_id, region, pos_x, pos_y, pos_z)
VALUES (@ret3_id, 'Sparring Yard', 128.0, 128.0, 25.0);

INSERT INTO character_reputation (character_id, honor, chivalry, dread, renown)
VALUES (@ret3_id, 0, 0, 0, 0);

SELECT CONCAT('Migration 019 complete — 3 NPC retainers created for Ser Rodrik (IDs: ',
  @ret1_id, ', ', @ret2_id, ', ', @ret3_id, ')') AS Status;
