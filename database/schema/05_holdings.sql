-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 05_holdings.sql
-- Purpose: Holdings, improvements, resource nodes, defenses, crafting
-- ============================================================================

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

-- Holding types
CREATE TABLE IF NOT EXISTS HoldingType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    
    -- Base capacity
    BasePopulation INT NOT NULL,
    BaseGarrison INT NOT NULL,
    BaseResourceSlots INT NOT NULL,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO HoldingType (Name, Description, BasePopulation, BaseGarrison, BaseResourceSlots) VALUES
    ('Fortress', 'Military stronghold, strong defenses, limited economy', 500, 200, 2),
    ('Township', 'Trade hub, large population, weak defenses', 2000, 50, 4),
    ('Citadel', 'Balanced, seat of power', 1000, 100, 3);

-- Improvement categories
CREATE TABLE IF NOT EXISTS ImprovementCategory (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ImprovementCategory (Name, Description) VALUES
    ('Military', 'Defenses, training, armory'),
    ('Economic', 'Trade, production, income'),
    ('Religious', 'Temples, shrines, faith'),
    ('Infrastructure', 'Roads, storage, administration'),
    ('Special', 'Unique buildings');

-- Improvement definitions
CREATE TABLE IF NOT EXISTS ImprovementType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    CategoryId INT NOT NULL,
    MaxTier INT NOT NULL DEFAULT 5,
    Description TEXT,
    
    -- Requirements
    RequiredHoldingType INT,        -- NULL = any
    PrerequisiteImprovementId INT,  -- Must have this first
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_ImpType_Category FOREIGN KEY (CategoryId) REFERENCES ImprovementCategory(Id),
    CONSTRAINT FK_ImpType_HoldingType FOREIGN KEY (RequiredHoldingType) REFERENCES HoldingType(Id),
    CONSTRAINT FK_ImpType_Prereq FOREIGN KEY (PrerequisiteImprovementId) REFERENCES ImprovementType(Id)
);

-- Insert improvements
INSERT INTO ImprovementType (Name, CategoryId, MaxTier, Description) VALUES
    -- Military (1)
    ('Walls', 1, 5, 'Stone fortifications around the holding'),
    ('Barracks', 1, 5, 'Training grounds for soldiers'),
    ('Armory', 1, 5, 'Weapon and armor storage'),
    ('Watchtower', 1, 3, 'Early warning against attacks'),
    ('Siege Workshop', 1, 3, 'Construct siege equipment'),
    
    -- Economic (2)
    ('Market', 2, 5, 'Trade hub for goods'),
    ('Smithy', 2, 5, 'Equipment crafting'),
    ('Granary', 2, 5, 'Food storage for winter'),
    ('Harbor', 2, 5, 'Sea trade and ships (coastal only)'),
    ('Mine', 2, 5, 'Extract ore and minerals'),
    
    -- Religious (3)
    ('Sept', 3, 5, 'Temple to the Seven'),
    ('Godswood', 3, 3, 'Sacred grove for Old Gods'),
    ('Red Temple', 3, 3, 'Shrine to R''hllor'),
    ('Drowned God Shrine', 3, 3, 'Ironborn religious site'),
    
    -- Infrastructure (4)
    ('Roads', 4, 3, 'Improve movement speed'),
    ('Warehouse', 4, 5, 'Increase storage capacity'),
    ('Town Hall', 4, 5, 'Administration center'),
    ('Aqueduct', 4, 3, 'Clean water, population health');

-- Improvement tier costs
CREATE TABLE IF NOT EXISTS ImprovementTierCost (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    ImprovementTypeId INT NOT NULL,
    Tier INT NOT NULL,
    
    -- Costs
    GoldCost INT NOT NULL,          -- In copper
    WoodCost INT DEFAULT 0,
    StoneCost INT DEFAULT 0,
    IronCost INT DEFAULT 0,
    
    -- Time
    BuildTimeDays INT NOT NULL,     -- IC days
    
    -- Manpower needed during construction
    ManpowerCost INT DEFAULT 0,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_ImpTierCost_Type FOREIGN KEY (ImprovementTypeId) REFERENCES ImprovementType(Id),
    CONSTRAINT UQ_ImpTierCost UNIQUE (ImprovementTypeId, Tier)
);

-- Resource node types
CREATE TABLE IF NOT EXISTS ResourceNodeType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    ResourceType ENUM('Food', 'Wood', 'Stone', 'Iron', 'Gold', 'Luxury', 'Special') NOT NULL,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ResourceNodeType (Name, ResourceType, Description) VALUES
    ('Farmland', 'Food', 'Fertile land for crops'),
    ('Pasture', 'Food', 'Grazing for livestock'),
    ('Fishery', 'Food', 'Fish from sea or river'),
    ('Forest', 'Wood', 'Timber for construction'),
    ('Quarry', 'Stone', 'Stone for building'),
    ('Iron Mine', 'Iron', 'Iron ore deposits'),
    ('Gold Mine', 'Gold', 'Precious metal deposits'),
    ('Silver Mine', 'Gold', 'Silver deposits'),
    ('Salt Mine', 'Luxury', 'Valuable preservative'),
    ('Vineyard', 'Luxury', 'Wine production'),
    ('Sheep Ranch', 'Luxury', 'Wool production'),
    ('Weirwood Grove', 'Special', 'Sacred trees, rare materials'),
    ('Dragon Glass Deposit', 'Special', 'Obsidian deposits');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Holdings
CREATE TABLE IF NOT EXISTS Holding (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Identity
    Name VARCHAR(100) NOT NULL,
    HoldingTypeId INT NOT NULL,
    
    -- Ownership
    OwnerCharacterId INT,           -- Player lord
    LiegeHoldingId INT,             -- Feudal superior (NULL = independent)
    
    -- Location
    ZoneId INT NOT NULL,
    
    -- Population
    Population INT NOT NULL DEFAULT 1000,
    MaxPopulation INT NOT NULL DEFAULT 2000,
    
    -- Religion
    DominantReligionId INT,
    ReligiousUnrest INT DEFAULT 0, -- 0-100
    
    -- Status
    IsDestroyed BOOLEAN DEFAULT FALSE,
    DestroyedAt DATETIME,
    
    -- Treasury (in copper)
    Treasury INT DEFAULT 0,
    
    -- Timestamps
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Holding_Type FOREIGN KEY (HoldingTypeId) REFERENCES HoldingType(Id),
    CONSTRAINT FK_Holding_Owner FOREIGN KEY (OwnerCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Holding_Liege FOREIGN KEY (LiegeHoldingId) REFERENCES Holding(Id)
);

-- Holding improvements (instances)
CREATE TABLE IF NOT EXISTS HoldingImprovement (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT NOT NULL,
    ImprovementTypeId INT NOT NULL,
    
    -- Current tier
    Tier INT NOT NULL DEFAULT 1,
    
    -- Construction status
    IsUnderConstruction BOOLEAN DEFAULT FALSE,
    ConstructionStartedAt DATETIME,
    ConstructionCompletesAt DATETIME,
    
    -- Damage (from siege/attacks)
    DamageLevel INT DEFAULT 0,      -- 0-100
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_HoldingImp_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_HoldingImp_Type FOREIGN KEY (ImprovementTypeId) REFERENCES ImprovementType(Id),
    CONSTRAINT UQ_HoldingImp UNIQUE (HoldingId, ImprovementTypeId)
);

-- Resource nodes attached to holdings
CREATE TABLE IF NOT EXISTS HoldingResourceNode (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT NOT NULL,
    ResourceNodeTypeId INT NOT NULL,
    
    -- Tier (1-5)
    Tier INT NOT NULL DEFAULT 1,
    
    -- Production
    BaseOutput INT NOT NULL,        -- Per week
    CurrentOutput INT NOT NULL,     -- Modified by workers, season
    
    -- Workers assigned (from Manpower)
    AssignedWorkers INT DEFAULT 0,
    MaxWorkers INT NOT NULL,
    
    -- Depletion (for mines)
    IsDepletable BOOLEAN DEFAULT FALSE,
    Remaining INT,                  -- NULL = infinite
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_HoldingNode_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_HoldingNode_Type FOREIGN KEY (ResourceNodeTypeId) REFERENCES ResourceNodeType(Id)
);

-- Holding defenses (garrison, walls effectiveness)
CREATE TABLE IF NOT EXISTS HoldingDefense (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT NOT NULL UNIQUE,
    
    -- Garrison
    CurrentGarrison INT DEFAULT 0,
    MaxGarrison INT NOT NULL,
    GarrisonMorale INT DEFAULT 50,  -- 0-100
    
    -- Defense values
    WallStrength INT DEFAULT 0,     -- From Walls improvement
    DefenseBonus INT DEFAULT 0,     -- Total defense rating
    
    -- Siege status
    IsUnderSiege BOOLEAN DEFAULT FALSE,
    SiegeStartedAt DATETIME,
    BesiegingArmyId INT,
    SuppliesRemaining INT DEFAULT 100, -- Days of food
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_HoldingDef_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id)
);

-- Holding storage/inventory
CREATE TABLE IF NOT EXISTS HoldingStorage (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT NOT NULL,
    
    -- Resource type and amount
    ResourceType ENUM('Food', 'Wood', 'Stone', 'Iron', 'Gold', 'Luxury', 'Special') NOT NULL,
    Quantity INT NOT NULL DEFAULT 0,
    MaxCapacity INT NOT NULL,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_HoldingStore_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id),
    CONSTRAINT UQ_HoldingStore UNIQUE (HoldingId, ResourceType)
);

-- Smithy crafting queue
CREATE TABLE IF NOT EXISTS CraftingQueue (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT NOT NULL,
    
    -- What's being crafted
    ItemTemplateId INT NOT NULL,    -- Reference to equipment template
    CustomName VARCHAR(100),
    
    -- Requirements
    RequiredTier INT NOT NULL,      -- Smithy tier needed
    
    -- Progress
    StartedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CompletesAt DATETIME NOT NULL,
    IsComplete BOOLEAN DEFAULT FALSE,
    
    -- Special materials (for legendary items)
    UsesValyrianSteel BOOLEAN DEFAULT FALSE,
    UsesWeirwood BOOLEAN DEFAULT FALSE,
    UsesDragonGlass BOOLEAN DEFAULT FALSE,
    
    -- Result storage
    ResultItemId INT,               -- When complete
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Crafting_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id)
);

-- Vassal relationships
CREATE TABLE IF NOT EXISTS VassalRelation (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    LiegeHoldingId INT NOT NULL,
    VassalHoldingId INT NOT NULL,
    
    -- Terms
    TaxRate DECIMAL(5,2) DEFAULT 0.10, -- % of income
    LevyRate DECIMAL(5,2) DEFAULT 0.20, -- % of manpower
    
    -- Status
    RelationQuality INT DEFAULT 50, -- 0-100
    IsRebelling BOOLEAN DEFAULT FALSE,
    
    -- History
    EstablishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    EndedAt DATETIME,
    IsActive BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT FK_Vassal_Liege FOREIGN KEY (LiegeHoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_Vassal_Vassal FOREIGN KEY (VassalHoldingId) REFERENCES Holding(Id),
    CONSTRAINT UQ_Vassal UNIQUE (LiegeHoldingId, VassalHoldingId)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_Holding_Owner ON Holding(OwnerCharacterId);
CREATE INDEX IX_Holding_Zone ON Holding(ZoneId);
CREATE INDEX IX_Holding_Liege ON Holding(LiegeHoldingId);
CREATE INDEX IX_Holding_Type ON Holding(HoldingTypeId);

CREATE INDEX IX_HoldingImp_Holding ON HoldingImprovement(HoldingId);
CREATE INDEX IX_HoldingImp_Type ON HoldingImprovement(ImprovementTypeId);
CREATE INDEX IX_HoldingImp_Construction ON HoldingImprovement(IsUnderConstruction);

CREATE INDEX IX_HoldingNode_Holding ON HoldingResourceNode(HoldingId);
CREATE INDEX IX_HoldingStorage_Holding ON HoldingStorage(HoldingId);

CREATE INDEX IX_VassalRel_Liege ON VassalRelation(LiegeHoldingId);
CREATE INDEX IX_VassalRel_Vassal ON VassalRelation(VassalHoldingId);
CREATE INDEX IX_VassalRel_Active ON VassalRelation(IsActive);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Full holding overview
CREATE OR REPLACE VIEW V_HoldingOverview AS
SELECT 
    h.Id,
    h.Name,
    ht.Name AS HoldingType,
    c.Name AS OwnerName,
    h.Population,
    h.Treasury,
    hd.CurrentGarrison,
    hd.MaxGarrison,
    hd.IsUnderSiege,
    (SELECT COUNT(*) FROM HoldingImprovement WHERE HoldingId = h.Id) AS ImprovementCount,
    (SELECT COUNT(*) FROM HoldingResourceNode WHERE HoldingId = h.Id) AS ResourceNodeCount
FROM Holding h
JOIN HoldingType ht ON h.HoldingTypeId = ht.Id
LEFT JOIN PlayerCharacter c ON h.OwnerCharacterId = c.Id
LEFT JOIN HoldingDefense hd ON h.Id = hd.HoldingId
WHERE h.IsDestroyed = FALSE;

-- Vassal tree
CREATE OR REPLACE VIEW V_VassalTree AS
SELECT 
    lh.Id AS LiegeId,
    lh.Name AS LiegeName,
    vh.Id AS VassalId,
    vh.Name AS VassalName,
    vr.TaxRate,
    vr.LevyRate,
    vr.RelationQuality,
    vr.IsRebelling
FROM VassalRelation vr
JOIN Holding lh ON vr.LiegeHoldingId = lh.Id
JOIN Holding vh ON vr.VassalHoldingId = vh.Id
WHERE vr.IsActive = TRUE;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Create a new holding
CREATE PROCEDURE SP_CreateHolding(
    IN p_Name VARCHAR(100),
    IN p_HoldingTypeId INT,
    IN p_OwnerCharacterId INT,
    IN p_ZoneId INT
)
BEGIN
    DECLARE v_HoldingId INT;
    DECLARE v_BasePop INT;
    DECLARE v_BaseGarrison INT;
    
    -- Get base values
    SELECT BasePopulation, BaseGarrison INTO v_BasePop, v_BaseGarrison
    FROM HoldingType WHERE Id = p_HoldingTypeId;
    
    -- Create holding
    INSERT INTO Holding (Name, HoldingTypeId, OwnerCharacterId, ZoneId, Population, MaxPopulation)
    VALUES (p_Name, p_HoldingTypeId, p_OwnerCharacterId, p_ZoneId, v_BasePop, v_BasePop * 2);
    
    SET v_HoldingId = LAST_INSERT_ID();
    
    -- Create defense record
    INSERT INTO HoldingDefense (HoldingId, MaxGarrison)
    VALUES (v_HoldingId, v_BaseGarrison);
    
    -- Initialize storage for each resource type
    INSERT INTO HoldingStorage (HoldingId, ResourceType, MaxCapacity) VALUES
        (v_HoldingId, 'Food', 100),
        (v_HoldingId, 'Wood', 100),
        (v_HoldingId, 'Stone', 100),
        (v_HoldingId, 'Iron', 50),
        (v_HoldingId, 'Gold', 1000),
        (v_HoldingId, 'Luxury', 50),
        (v_HoldingId, 'Special', 10);
    
    SELECT v_HoldingId AS HoldingId;
END //

-- Start improvement construction
CREATE PROCEDURE SP_StartImprovement(
    IN p_HoldingId INT,
    IN p_ImprovementTypeId INT,
    IN p_TargetTier INT
)
BEGIN
    DECLARE v_BuildTime INT;
    DECLARE v_CompletionDate DATETIME;
    
    -- Get build time
    SELECT BuildTimeDays INTO v_BuildTime
    FROM ImprovementTierCost
    WHERE ImprovementTypeId = p_ImprovementTypeId AND Tier = p_TargetTier;
    
    SET v_CompletionDate = DATE_ADD(NOW(), INTERVAL v_BuildTime DAY);
    
    -- Insert or update improvement
    INSERT INTO HoldingImprovement (HoldingId, ImprovementTypeId, Tier, IsUnderConstruction, ConstructionStartedAt, ConstructionCompletesAt)
    VALUES (p_HoldingId, p_ImprovementTypeId, p_TargetTier, TRUE, NOW(), v_CompletionDate)
    ON DUPLICATE KEY UPDATE
        Tier = p_TargetTier,
        IsUnderConstruction = TRUE,
        ConstructionStartedAt = NOW(),
        ConstructionCompletesAt = v_CompletionDate;
    
    SELECT v_CompletionDate AS CompletionDate;
END //

-- Complete construction
CREATE PROCEDURE SP_CompleteConstruction(
    IN p_HoldingImprovementId INT
)
BEGIN
    UPDATE HoldingImprovement
    SET IsUnderConstruction = FALSE,
        ConstructionStartedAt = NULL,
        ConstructionCompletesAt = NULL
    WHERE Id = p_HoldingImprovementId;
END //

-- Transfer holding ownership
CREATE PROCEDURE SP_TransferHolding(
    IN p_HoldingId INT,
    IN p_NewOwnerId INT,
    IN p_NewLiegeHoldingId INT
)
BEGIN
    UPDATE Holding
    SET OwnerCharacterId = p_NewOwnerId,
        LiegeHoldingId = p_NewLiegeHoldingId
    WHERE Id = p_HoldingId;
    
    -- Update vassal relations if needed
    UPDATE VassalRelation
    SET IsActive = FALSE, EndedAt = NOW()
    WHERE VassalHoldingId = p_HoldingId AND IsActive = TRUE;
    
    -- Create new vassal relation if has liege
    IF p_NewLiegeHoldingId IS NOT NULL THEN
        INSERT INTO VassalRelation (LiegeHoldingId, VassalHoldingId)
        VALUES (p_NewLiegeHoldingId, p_HoldingId);
    END IF;
END //

DELIMITER ;
