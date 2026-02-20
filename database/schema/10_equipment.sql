-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 10_equipment.sql
-- Purpose: Weapons, armor, items, special materials, inventory
-- ============================================================================

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

-- Equipment slots
CREATE TABLE IF NOT EXISTS EquipmentSlot (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO EquipmentSlot (Name, Description) VALUES
    ('MainHand', 'Primary weapon'),
    ('OffHand', 'Shield or secondary weapon'),
    ('TwoHand', 'Two-handed weapon'),
    ('Head', 'Helmet or headgear'),
    ('Body', 'Chest armor'),
    ('Hands', 'Gauntlets'),
    ('Feet', 'Boots'),
    ('Cloak', 'Cape or cloak'),
    ('Ring', 'Finger ring'),
    ('Neck', 'Necklace or chain');

-- Item categories
CREATE TABLE IF NOT EXISTS ItemCategory (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ItemCategory (Name, Description) VALUES
    ('Weapon', 'Offensive equipment'),
    ('Armor', 'Defensive equipment'),
    ('Accessory', 'Rings, amulets, cloaks'),
    ('Consumable', 'One-use items'),
    ('Material', 'Crafting materials'),
    ('Treasure', 'Valuables'),
    ('Relic', 'Unique historical items');

-- Weapon types
CREATE TABLE IF NOT EXISTS WeaponType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    SlotId INT NOT NULL,
    Description TEXT,
    
    -- Base stats
    BaseDamage INT NOT NULL,
    BaseSpeed INT NOT NULL,         -- Initiative modifier
    
    -- Skill used
    SkillId INT,                    -- Melee, Archery, etc.
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_WeaponType_Slot FOREIGN KEY (SlotId) REFERENCES EquipmentSlot(Id),
    CONSTRAINT FK_WeaponType_Skill FOREIGN KEY (SkillId) REFERENCES Skill(Id)
);

INSERT INTO WeaponType (Name, SlotId, Description, BaseDamage, BaseSpeed, SkillId) VALUES
    ('Longsword', 1, 'Standard knight''s weapon', 5, 3, 1),
    ('Greatsword', 3, 'Two-handed massive blade', 8, 1, 1),
    ('Dagger', 1, 'Quick, concealable blade', 2, 5, 1),
    ('Spear', 3, 'Reach weapon', 4, 2, 1),
    ('Mace', 1, 'Armor-crushing weapon', 5, 2, 1),
    ('Warhammer', 3, 'Heavy crushing weapon', 7, 1, 1),
    ('Battle Axe', 3, 'Chopping weapon', 7, 2, 1),
    ('Hand Axe', 1, 'One-handed axe', 4, 3, 1),
    ('Shortbow', 3, 'Quick ranged weapon', 3, 4, 2),
    ('Longbow', 3, 'Powerful ranged weapon', 5, 2, 2),
    ('Crossbow', 3, 'Mechanical ranged weapon', 6, 1, 2),
    ('Shield', 2, 'Defensive offhand', 0, 0, 1);

-- Armor types
CREATE TABLE IF NOT EXISTS ArmorType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    SlotId INT NOT NULL,
    Description TEXT,
    
    -- Base stats
    BaseArmor INT NOT NULL,
    MovementPenalty INT DEFAULT 0,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_ArmorType_Slot FOREIGN KEY (SlotId) REFERENCES EquipmentSlot(Id)
);

INSERT INTO ArmorType (Name, SlotId, Description, BaseArmor, MovementPenalty) VALUES
    ('Leather Armor', 5, 'Light, flexible protection', 2, 0),
    ('Chainmail', 5, 'Linked metal rings', 4, 1),
    ('Scale Armor', 5, 'Overlapping metal scales', 5, 1),
    ('Plate Armor', 5, 'Full metal plates', 8, 2),
    ('Leather Helm', 4, 'Light head protection', 1, 0),
    ('Iron Helm', 4, 'Standard metal helmet', 2, 0),
    ('Great Helm', 4, 'Full face coverage', 3, 1),
    ('Buckler', 2, 'Small shield', 1, 0),
    ('Kite Shield', 2, 'Medium shield', 2, 0),
    ('Tower Shield', 2, 'Large shield', 3, 1),
    ('Leather Gloves', 6, 'Light hand protection', 1, 0),
    ('Iron Gauntlets', 6, 'Metal hand protection', 2, 0);

-- Special materials
CREATE TABLE IF NOT EXISTS SpecialMaterial (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    
    -- Bonuses
    DamageBonus INT DEFAULT 0,
    ArmorBonus INT DEFAULT 0,
    SpeedBonus INT DEFAULT 0,
    
    -- Rarity/availability
    Rarity ENUM('Common', 'Uncommon', 'Rare', 'Legendary', 'Unique') DEFAULT 'Common',
    CanBeCrafted BOOLEAN DEFAULT TRUE,
    RequiredSmithyTier INT DEFAULT 1,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO SpecialMaterial (Name, Description, DamageBonus, ArmorBonus, SpeedBonus, Rarity, CanBeCrafted, RequiredSmithyTier) VALUES
    ('Iron', 'Standard material', 0, 0, 0, 'Common', TRUE, 1),
    ('Steel', 'Better quality iron', 1, 1, 0, 'Uncommon', TRUE, 2),
    ('Castle-Forged Steel', 'High quality steel', 2, 2, 0, 'Rare', TRUE, 3),
    ('Valyrian Steel', 'Legendary lost art, can only reforge', 5, 3, 2, 'Legendary', FALSE, 5),
    ('Dragon Glass', 'Obsidian, effective against Others', 3, 0, 1, 'Rare', TRUE, 3),
    ('Weirwood', 'Sacred wood of the Old Gods', 2, 2, 1, 'Legendary', FALSE, 4),
    ('Dawn Steel', 'Pale as milkglass, House Dayne''s metal', 4, 2, 2, 'Unique', FALSE, 5);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Item templates (definitions)
CREATE TABLE IF NOT EXISTS ItemTemplate (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    CategoryId INT NOT NULL,
    
    -- Type references (one will be set based on category)
    WeaponTypeId INT,
    ArmorTypeId INT,
    
    -- Tier (1-5)
    Tier INT NOT NULL DEFAULT 1,
    
    -- Base material
    MaterialId INT,
    
    -- Stats (base + material bonuses)
    Damage INT DEFAULT 0,
    Armor INT DEFAULT 0,
    Speed INT DEFAULT 0,
    
    -- Requirements
    RequiredStrength INT DEFAULT 0,
    RequiredSkillId INT,
    RequiredSkillLevel INT DEFAULT 0,
    
    -- Value
    BaseValue INT NOT NULL,         -- In copper
    
    -- Flavor
    Description TEXT,
    
    -- Is this a unique item?
    IsUnique BOOLEAN DEFAULT FALSE,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Item_Category FOREIGN KEY (CategoryId) REFERENCES ItemCategory(Id),
    CONSTRAINT FK_Item_WeaponType FOREIGN KEY (WeaponTypeId) REFERENCES WeaponType(Id),
    CONSTRAINT FK_Item_ArmorType FOREIGN KEY (ArmorTypeId) REFERENCES ArmorType(Id),
    CONSTRAINT FK_Item_Material FOREIGN KEY (MaterialId) REFERENCES SpecialMaterial(Id),
    CONSTRAINT FK_Item_ReqSkill FOREIGN KEY (RequiredSkillId) REFERENCES Skill(Id),
    CONSTRAINT CK_Item_Tier CHECK (Tier >= 1 AND Tier <= 5)
);

-- Create some sample weapons
INSERT INTO ItemTemplate (Name, CategoryId, WeaponTypeId, Tier, MaterialId, Damage, Speed, BaseValue, Description) VALUES
    ('Iron Longsword', 1, 1, 1, 1, 5, 3, 10000, 'A basic iron longsword'),
    ('Steel Longsword', 1, 1, 2, 2, 6, 3, 30000, 'A quality steel blade'),
    ('Castle-Forged Longsword', 1, 1, 3, 3, 7, 3, 100000, 'Master-crafted steel sword'),
    ('Valyrian Steel Longsword', 1, 1, 5, 4, 10, 5, 10000000, 'Legendary Valyrian blade');

-- Item instances (actual items in game)
CREATE TABLE IF NOT EXISTS Item (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    TemplateId INT NOT NULL,
    
    -- Custom name (for named weapons)
    CustomName VARCHAR(100),
    
    -- Ownership
    OwnerCharacterId INT,
    OwnerNPCId INT,
    OwnerHoldingId INT,             -- In storage
    
    -- History
    OriginalCrafterId INT,          -- Who made it
    CraftedAt DATETIME,
    ForgedAtHoldingId INT,
    
    -- Special properties
    IsMagical BOOLEAN DEFAULT FALSE,
    Enchantments JSON,              -- Additional effects
    History TEXT,                   -- Lore/provenance
    
    -- Condition
    Durability INT DEFAULT 100,     -- 0-100
    
    -- Equipped?
    IsEquipped BOOLEAN DEFAULT FALSE,
    EquippedSlotId INT,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_ItemInst_Template FOREIGN KEY (TemplateId) REFERENCES ItemTemplate(Id),
    CONSTRAINT FK_ItemInst_OwnerChar FOREIGN KEY (OwnerCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_ItemInst_OwnerNPC FOREIGN KEY (OwnerNPCId) REFERENCES NPC(Id),
    CONSTRAINT FK_ItemInst_OwnerHold FOREIGN KEY (OwnerHoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_ItemInst_Crafter FOREIGN KEY (OriginalCrafterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_ItemInst_Forged FOREIGN KEY (ForgedAtHoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_ItemInst_Slot FOREIGN KEY (EquippedSlotId) REFERENCES EquipmentSlot(Id)
);

-- PlayerCharacter equipment loadout
CREATE TABLE IF NOT EXISTS CharacterEquipment (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL,
    SlotId INT NOT NULL,
    ItemId INT,                     -- NULL = empty slot
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_CharEquip_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_CharEquip_Slot FOREIGN KEY (SlotId) REFERENCES EquipmentSlot(Id),
    CONSTRAINT FK_CharEquip_Item FOREIGN KEY (ItemId) REFERENCES Item(Id),
    CONSTRAINT UQ_CharEquip UNIQUE (CharacterId, SlotId)
);

-- Retainer equipment (separate FK targets)
ALTER TABLE Retainer ADD CONSTRAINT FK_Retainer_Weapon FOREIGN KEY (WeaponId) REFERENCES Item(Id);
ALTER TABLE Retainer ADD CONSTRAINT FK_Retainer_Armor FOREIGN KEY (ArmorId) REFERENCES Item(Id);
ALTER TABLE Retainer ADD CONSTRAINT FK_Retainer_Shield FOREIGN KEY (ShieldId) REFERENCES Item(Id);

-- Famous/legendary items (pre-defined unique items)
CREATE TABLE IF NOT EXISTS LegendaryItem (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    ItemId INT NOT NULL UNIQUE,
    
    -- Lore
    OriginalName VARCHAR(100) NOT NULL,
    House VARCHAR(100),             -- Associated house
    History TEXT NOT NULL,
    
    -- Status
    IsLost BOOLEAN DEFAULT FALSE,
    LastKnownLocation TEXT,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_LegItem_Item FOREIGN KEY (ItemId) REFERENCES Item(Id)
);

-- Material stockpile (for special crafting)
CREATE TABLE IF NOT EXISTS MaterialStockpile (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT NOT NULL,
    MaterialId INT NOT NULL,
    
    Quantity INT NOT NULL DEFAULT 0,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_MatStock_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_MatStock_Material FOREIGN KEY (MaterialId) REFERENCES SpecialMaterial(Id),
    CONSTRAINT UQ_MatStock UNIQUE (HoldingId, MaterialId)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_ItemTemplate_Category ON ItemTemplate(CategoryId);
CREATE INDEX IX_ItemTemplate_Tier ON ItemTemplate(Tier);
CREATE INDEX IX_ItemTemplate_WeaponType ON ItemTemplate(WeaponTypeId);
CREATE INDEX IX_ItemTemplate_ArmorType ON ItemTemplate(ArmorTypeId);

CREATE INDEX IX_Item_Template ON Item(TemplateId);
CREATE INDEX IX_Item_OwnerChar ON Item(OwnerCharacterId);
CREATE INDEX IX_Item_OwnerNPC ON Item(OwnerNPCId);
CREATE INDEX IX_Item_OwnerHold ON Item(OwnerHoldingId);
CREATE INDEX IX_Item_Equipped ON Item(IsEquipped);

CREATE INDEX IX_CharEquip_Character ON CharacterEquipment(CharacterId);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- PlayerCharacter inventory view
CREATE OR REPLACE VIEW V_CharacterInventory AS
SELECT 
    c.Id AS CharacterId,
    c.Name AS CharacterName,
    COALESCE(i.CustomName, it.Name) AS ItemName,
    ic.Name AS Category,
    it.Tier,
    sm.Name AS Material,
    it.Damage,
    it.Armor,
    i.Durability,
    i.IsEquipped,
    es.Name AS EquippedSlot
FROM Item i
JOIN ItemTemplate it ON i.TemplateId = it.Id
JOIN ItemCategory ic ON it.CategoryId = ic.Id
LEFT JOIN SpecialMaterial sm ON it.MaterialId = sm.Id
LEFT JOIN EquipmentSlot es ON i.EquippedSlotId = es.Id
JOIN PlayerCharacter c ON i.OwnerCharacterId = c.Id;

-- Legendary items tracker
CREATE OR REPLACE VIEW V_LegendaryItems AS
SELECT 
    li.OriginalName,
    li.House,
    COALESCE(i.CustomName, it.Name) AS CurrentName,
    sm.Name AS Material,
    COALESCE(c.Name, n.Name, 'Unknown') AS CurrentOwner,
    li.IsLost,
    li.LastKnownLocation
FROM LegendaryItem li
JOIN Item i ON li.ItemId = i.Id
JOIN ItemTemplate it ON i.TemplateId = it.Id
LEFT JOIN SpecialMaterial sm ON it.MaterialId = sm.Id
LEFT JOIN PlayerCharacter c ON i.OwnerCharacterId = c.Id
LEFT JOIN NPC n ON i.OwnerNPCId = n.Id;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Craft an item
CREATE PROCEDURE SP_CraftItem(
    IN p_TemplateId INT,
    IN p_CustomName VARCHAR(100),
    IN p_HoldingId INT,
    IN p_CrafterId INT
)
BEGIN
    INSERT INTO Item (TemplateId, CustomName, OwnerHoldingId, OriginalCrafterId, CraftedAt, ForgedAtHoldingId)
    VALUES (p_TemplateId, p_CustomName, p_HoldingId, p_CrafterId, NOW(), p_HoldingId);
    
    SELECT LAST_INSERT_ID() AS ItemId;
END //

-- Equip item to PlayerCharacter
CREATE PROCEDURE SP_EquipItem(
    IN p_CharacterId INT,
    IN p_ItemId INT
)
BEGIN
    DECLARE v_SlotId INT;
    DECLARE v_OldItemId INT;
    
    -- Get slot from item's template
    SELECT COALESCE(wt.SlotId, at.SlotId) INTO v_SlotId
    FROM Item i
    JOIN ItemTemplate it ON i.TemplateId = it.Id
    LEFT JOIN WeaponType wt ON it.WeaponTypeId = wt.Id
    LEFT JOIN ArmorType at ON it.ArmorTypeId = at.Id
    WHERE i.Id = p_ItemId;
    
    IF v_SlotId IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item cannot be equipped';
    END IF;
    
    -- Check for existing item in slot
    SELECT ItemId INTO v_OldItemId
    FROM CharacterEquipment
    WHERE CharacterId = p_CharacterId AND SlotId = v_SlotId;
    
    -- Unequip old item if exists
    IF v_OldItemId IS NOT NULL THEN
        UPDATE Item SET IsEquipped = FALSE, EquippedSlotId = NULL WHERE Id = v_OldItemId;
    END IF;
    
    -- Transfer ownership and equip new item
    UPDATE Item
    SET OwnerCharacterId = p_CharacterId,
        OwnerNPCId = NULL,
        OwnerHoldingId = NULL,
        IsEquipped = TRUE,
        EquippedSlotId = v_SlotId
    WHERE Id = p_ItemId;
    
    -- Update equipment slot
    INSERT INTO CharacterEquipment (CharacterId, SlotId, ItemId)
    VALUES (p_CharacterId, v_SlotId, p_ItemId)
    ON DUPLICATE KEY UPDATE ItemId = p_ItemId;
END //

-- Transfer item between characters
CREATE PROCEDURE SP_TransferItem(
    IN p_ItemId INT,
    IN p_ToCharacterId INT
)
BEGIN
    -- Unequip if equipped
    UPDATE Item
    SET IsEquipped = FALSE, EquippedSlotId = NULL
    WHERE Id = p_ItemId AND IsEquipped = TRUE;
    
    -- Transfer ownership
    UPDATE Item
    SET OwnerCharacterId = p_ToCharacterId,
        OwnerNPCId = NULL,
        OwnerHoldingId = NULL
    WHERE Id = p_ItemId;
    
    -- Remove from old owner's equipment slots
    DELETE FROM CharacterEquipment WHERE ItemId = p_ItemId;
END //

-- Repair item
CREATE PROCEDURE SP_RepairItem(
    IN p_ItemId INT,
    IN p_RepairAmount INT
)
BEGIN
    UPDATE Item
    SET Durability = LEAST(100, Durability + p_RepairAmount)
    WHERE Id = p_ItemId;
END //

DELIMITER ;
