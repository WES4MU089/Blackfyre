-- Migration 040: Codex System
-- Knowledge base for lore, faiths, game rules, and player guides

CREATE TABLE IF NOT EXISTS codex_categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(50) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  sort_order  INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS codex_entries (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id  INT UNSIGNED NOT NULL,
  slug         VARCHAR(100) NOT NULL UNIQUE,
  title        VARCHAR(200) NOT NULL,
  content      TEXT NOT NULL,
  summary      VARCHAR(500),
  image_url    VARCHAR(500),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   INT UNSIGNED,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES codex_categories(id),
  FOREIGN KEY (created_by) REFERENCES players(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default categories
INSERT INTO codex_categories (slug, name, description, icon, sort_order) VALUES
  ('world',    'The Known World',      'Geography, regions, and landmarks',                   'globe',    1),
  ('houses',   'Noble Houses',         'History and heraldry of the great families',           'shield',   2),
  ('faiths',   'Faiths & Religion',    'The gods and their followers',                         'flame',    3),
  ('orders',   'Orders & Organizations','Kingsguard, Night''s Watch, Maesters, and more',      'sword',    4),
  ('history',  'History & Lore',       'Key events that shaped the realm',                     'scroll',   5),
  ('combat',   'Combat & Warfare',     'Rules of engagement, weapons, and tactics',            'crossed',  6),
  ('crafting', 'Crafting & Trade',     'Materials, recipes, and the economy',                   'anvil',    7),
  ('guide',    'Player Guide',         'How to play Dragon''s Dominion',                       'book',     8);
