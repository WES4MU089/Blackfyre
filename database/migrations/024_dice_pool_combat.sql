-- Migration 024: Dice Pool Combat System
-- Switches from d100 contested rolls to Xd10 dice pool resolution.
-- No schema changes needed — roll_data and stats_snapshot are JSON columns.
-- Abandon any active combat sessions since their data format is now incompatible.

UPDATE combat_sessions SET status = 'abandoned' WHERE status = 'active';
