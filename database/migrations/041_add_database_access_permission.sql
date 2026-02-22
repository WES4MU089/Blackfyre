-- Migration 041: Add system.database_access permission for Schema Viewer and Query Console
INSERT INTO permissions (`key`, label, category, description)
VALUES ('system.database_access', 'Database access', 'system', 'Access the schema viewer, query console, and migration runner');
