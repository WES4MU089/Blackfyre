-- ============================================================================
-- Migration 042: Gauntlet Engine - Campaign Map System
-- Purpose: Free-movement campaign maps with pixel-based terrain texture maps
-- ============================================================================

-- Campaign maps
CREATE TABLE gauntlet_maps (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    width INT UNSIGNED NOT NULL,
    height INT UNSIGNED NOT NULL,
    grid_size TINYINT UNSIGNED NOT NULL DEFAULT 8,
    base_image_path VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_gauntlet_maps_creator FOREIGN KEY (created_by) REFERENCES players(id) ON DELETE SET NULL
);

-- Per-map terrain types (pixel color -> terrain properties)
CREATE TABLE gauntlet_terrain_types (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    map_id INT UNSIGNED NOT NULL,
    name VARCHAR(50) NOT NULL,
    hex_color CHAR(7) NOT NULL,
    movement_cost DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    is_passable BOOLEAN NOT NULL DEFAULT TRUE,
    attrition_rate DECIMAL(4,2) NOT NULL DEFAULT 0.00,
    defense_bonus INT NOT NULL DEFAULT 0,
    ambush_bonus INT NOT NULL DEFAULT 0,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_map_color (map_id, hex_color),
    UNIQUE KEY uq_map_name (map_id, name),
    CONSTRAINT fk_terrain_map FOREIGN KEY (map_id) REFERENCES gauntlet_maps(id) ON DELETE CASCADE
);

-- Map layers (terrain texture map, passability map, future layers)
CREATE TABLE gauntlet_map_layers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    map_id INT UNSIGNED NOT NULL,
    layer_type ENUM('terrain', 'passability') NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_map_layer (map_id, layer_type),
    CONSTRAINT fk_layer_map FOREIGN KEY (map_id) REFERENCES gauntlet_maps(id) ON DELETE CASCADE
);

-- Permission for managing gauntlet maps
INSERT INTO permissions (`key`, label, category, description)
VALUES ('content.manage_gauntlet', 'Manage Gauntlet Maps', 'content', 'Create, edit, and delete campaign maps and terrain definitions');
