-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 04_retainers.sql
-- Purpose: Retainers, advisors, experience progression, combat stats
-- ============================================================================

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

-- Retainer types/classes
CREATE TABLE IF NOT EXISTS RetainerType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    PrimaryAptitudeId INT,          -- Main governing aptitude
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_RetainerType_Aptitude FOREIGN KEY (PrimaryAptitudeId) REFERENCES Aptitude(Id)
);

INSERT INTO RetainerType (Name, Description, PrimaryAptitudeId) VALUES
    ('Knight', 'Heavy cavalry, elite warrior', 1),        -- Prowess
    ('Man-at-Arms', 'Professional infantry soldier', 1),  -- Prowess
    ('Archer', 'Ranged combatant', 1),                    -- Prowess
    ('Scout', 'Reconnaissance and stealth', 4),           -- Cunning
    ('Assassin', 'Covert operations specialist', 4),      -- Cunning
    ('Spy', 'Intelligence gatherer', 4),                  -- Cunning
    ('Healer', 'Medical and wound treatment', 2),         -- Fortitude
    ('Septon', 'Faith of the Seven clergy', 7),          -- Faith
    ('Red Priest', 'R''hllor servant', 7),               -- Faith
    ('Maester', 'Learned scholar', 5);                    -- Stewardship

-- Advisor roles (one per aptitude)
CREATE TABLE IF NOT EXISTS AdvisorRole (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    AptitudeId INT NOT NULL UNIQUE, -- One role per aptitude
    Description TEXT,
    BonusDescription TEXT,          -- What bonus they provide
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_AdvisorRole_Aptitude FOREIGN KEY (AptitudeId) REFERENCES Aptitude(Id)
);

INSERT INTO AdvisorRole (Name, AptitudeId, Description, BonusDescription) VALUES
    ('Master-at-Arms', 1, 'Trains troops and oversees martial matters', 'Bonus to troop training, personal combat tutoring'),
    ('Maester', 2, 'Heals wounds and provides medical knowledge', 'Faster wound recovery, poison/disease resistance'),
    ('Castellan', 3, 'Manages military logistics and castle defense', 'Bonus to garrison efficiency, siege defense'),
    ('Spymaster', 4, 'Runs intelligence network', 'Counter-espionage, intrigue detection'),
    ('Steward', 5, 'Manages economy and resources', 'Income bonus, construction speed'),
    ('Diplomat', 6, 'Handles foreign relations', 'Better negotiation, opinion bonus'),
    ('Religious Advisor', 7, 'Spiritual guidance', 'Religious standing bonus, faithful loyalty');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Retainer instance (extends NPC)
CREATE TABLE IF NOT EXISTS Retainer (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    NPCId INT NOT NULL UNIQUE,      -- Links to NPC table
    RetainerTypeId INT NOT NULL,
    
    -- Tier (1-5)
    Tier INT NOT NULL DEFAULT 1,    -- 1-3 purchasable, 4-5 earned
    
    -- Experience (for tier 4-5 progression)
    Experience INT DEFAULT 0,
    
    -- Combat stats
    Health INT NOT NULL DEFAULT 100,
    MaxHealth INT NOT NULL DEFAULT 100,
    Armor INT DEFAULT 0,            -- Damage reduction
    DamageBonus INT DEFAULT 0,      -- Added to attack rolls
    
    -- Equipment slots
    WeaponId INT,                   -- Current weapon
    ArmorId INT,                    -- Current armor
    ShieldId INT,                   -- Current shield/offhand
    
    -- Status
    IsAvailable BOOLEAN DEFAULT TRUE,  -- Not wounded/deployed
    IsDeployed BOOLEAN DEFAULT FALSE,  -- In an army
    DeployedArmyId INT,
    
    -- Owner tracking
    HiredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    HiredFromHoldingId INT,         -- Where they were recruited
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Retainer_NPC FOREIGN KEY (NPCId) REFERENCES NPC(Id),
    CONSTRAINT FK_Retainer_Type FOREIGN KEY (RetainerTypeId) REFERENCES RetainerType(Id),
    CONSTRAINT CK_Retainer_Tier CHECK (Tier >= 1 AND Tier <= 5)
);

-- Retainer-specific skills/abilities that unlock with XP
CREATE TABLE IF NOT EXISTS RetainerAbility (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    RetainerTypeId INT,             -- NULL = universal
    RequiredTier INT NOT NULL,      -- Minimum tier to have this
    
    -- Effects
    EffectType ENUM('Passive', 'Active', 'Triggered') NOT NULL,
    EffectData JSON,                -- Flexible effect storage
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_RetAbility_Type FOREIGN KEY (RetainerTypeId) REFERENCES RetainerType(Id)
);

-- Retainer's unlocked abilities
CREATE TABLE IF NOT EXISTS RetainerUnlockedAbility (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    RetainerId INT NOT NULL,
    AbilityId INT NOT NULL,
    
    UnlockedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_RetUnlock_Retainer FOREIGN KEY (RetainerId) REFERENCES Retainer(Id),
    CONSTRAINT FK_RetUnlock_Ability FOREIGN KEY (AbilityId) REFERENCES RetainerAbility(Id),
    CONSTRAINT UQ_RetUnlock_Unique UNIQUE (RetainerId, AbilityId)
);

-- Advisor instance (extends NPC)
CREATE TABLE IF NOT EXISTS Advisor (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    NPCId INT NOT NULL UNIQUE,
    RoleId INT NOT NULL,
    
    -- Tier (1-5)
    Tier INT NOT NULL DEFAULT 1,
    
    -- Assigned holding
    AssignedHoldingId INT,
    
    -- Effectiveness (modified by loyalty, traits)
    EffectivenessBonus DECIMAL(5,2) DEFAULT 0.00,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Advisor_NPC FOREIGN KEY (NPCId) REFERENCES NPC(Id),
    CONSTRAINT FK_Advisor_Role FOREIGN KEY (RoleId) REFERENCES AdvisorRole(Id),
    CONSTRAINT CK_Advisor_Tier CHECK (Tier >= 1 AND Tier <= 5)
);

-- Retainer tier cost/requirements
CREATE TABLE IF NOT EXISTS RetainerTierCost (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    RetainerTypeId INT NOT NULL,
    Tier INT NOT NULL,
    
    -- Gold cost (in copper for precision)
    HireCost INT NOT NULL,          -- One-time
    WageCost INT NOT NULL,          -- Per IC week
    
    -- Requirements
    RequiredHoldingTier INT,        -- Need this tier holding to recruit
    RequiredBuildingType VARCHAR(50), -- Specific building needed
    
    -- Stats at this tier
    BaseHealth INT NOT NULL,
    BaseArmor INT NOT NULL,
    BaseDamageBonus INT NOT NULL,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_RetCost_Type FOREIGN KEY (RetainerTypeId) REFERENCES RetainerType(Id),
    CONSTRAINT UQ_RetCost_Unique UNIQUE (RetainerTypeId, Tier)
);

-- Sample tier costs for Knights
INSERT INTO RetainerTierCost (RetainerTypeId, Tier, HireCost, WageCost, RequiredHoldingTier, BaseHealth, BaseArmor, BaseDamageBonus) VALUES
    (1, 1, 50000, 1000, 1, 100, 2, 1),   -- Tier 1 Knight: 5 silver hire, 10 copper/week
    (1, 2, 150000, 3000, 2, 120, 4, 2),  -- Tier 2 Knight: 15 silver hire
    (1, 3, 500000, 10000, 3, 150, 6, 3), -- Tier 3 Knight: 50 silver hire
    (1, 4, 0, 20000, 4, 180, 8, 5),      -- Tier 4 Knight: XP only, no hire cost
    (1, 5, 0, 50000, 5, 220, 10, 7);     -- Tier 5 Knight: XP only

-- Experience thresholds
CREATE TABLE IF NOT EXISTS RetainerExpThreshold (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Tier INT NOT NULL UNIQUE,
    RequiredExp INT NOT NULL,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO RetainerExpThreshold (Tier, RequiredExp) VALUES
    (1, 0),
    (2, 100),
    (3, 500),
    (4, 2000),
    (5, 10000);

-- Combat log for retainers (permadeath tracking)
CREATE TABLE IF NOT EXISTS RetainerCombatLog (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    RetainerId INT NOT NULL,
    
    -- Combat details
    CombatType ENUM('Duel', 'Battle', 'Skirmish', 'Assassination') NOT NULL,
    OpponentDescription TEXT,
    
    -- Outcome
    Victory BOOLEAN,
    ExpGained INT DEFAULT 0,
    DamageTaken INT DEFAULT 0,
    DamageDealt INT DEFAULT 0,
    
    -- Death
    DiedInCombat BOOLEAN DEFAULT FALSE,
    DeathDescription TEXT,
    
    -- Timestamp
    OccurredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_RetCombatLog_Retainer FOREIGN KEY (RetainerId) REFERENCES Retainer(Id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_Retainer_NPCId ON Retainer(NPCId);
CREATE INDEX IX_Retainer_Type ON Retainer(RetainerTypeId);
CREATE INDEX IX_Retainer_Tier ON Retainer(Tier);
CREATE INDEX IX_Retainer_IsAvailable ON Retainer(IsAvailable);
CREATE INDEX IX_Retainer_DeployedArmy ON Retainer(DeployedArmyId);

CREATE INDEX IX_Advisor_NPCId ON Advisor(NPCId);
CREATE INDEX IX_Advisor_Role ON Advisor(RoleId);
CREATE INDEX IX_Advisor_AssignedHolding ON Advisor(AssignedHoldingId);

CREATE INDEX IX_RetCombatLog_Retainer ON RetainerCombatLog(RetainerId);
CREATE INDEX IX_RetCombatLog_OccurredAt ON RetainerCombatLog(OccurredAt);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Full retainer view with NPC info
CREATE OR REPLACE VIEW V_RetainerFull AS
SELECT 
    r.Id AS RetainerId,
    n.Id AS NPCId,
    n.Name,
    n.House,
    rt.Name AS RetainerType,
    r.Tier,
    r.Experience,
    r.Health,
    r.MaxHealth,
    r.Armor,
    r.DamageBonus,
    r.IsAvailable,
    r.IsDeployed,
    n.Loyalty,
    owner.Name AS OwnerName,
    n.OwnerCharacterId
FROM Retainer r
JOIN NPC n ON r.NPCId = n.Id
JOIN RetainerType rt ON r.RetainerTypeId = rt.Id
LEFT JOIN PlayerCharacter owner ON n.OwnerCharacterId = owner.Id
WHERE n.IsDeleted = FALSE AND n.IsAlive = TRUE;

-- Advisor view with bonuses
CREATE OR REPLACE VIEW V_AdvisorFull AS
SELECT 
    a.Id AS AdvisorId,
    n.Id AS NPCId,
    n.Name,
    ar.Name AS Role,
    apt.Name AS Aptitude,
    a.Tier,
    n.Loyalty,
    a.EffectivenessBonus,
    n.OwnerCharacterId,
    a.AssignedHoldingId
FROM Advisor a
JOIN NPC n ON a.NPCId = n.Id
JOIN AdvisorRole ar ON a.RoleId = ar.Id
JOIN Aptitude apt ON ar.AptitudeId = apt.Id
WHERE n.IsDeleted = FALSE AND n.IsAlive = TRUE;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Hire a new retainer
CREATE PROCEDURE SP_HireRetainer(
    IN p_CharacterId INT,
    IN p_Name VARCHAR(100),
    IN p_GenderId INT,
    IN p_Age INT,
    IN p_RetainerTypeId INT,
    IN p_Tier INT,
    IN p_HoldingId INT
)
BEGIN
    DECLARE v_NPCId INT;
    DECLARE v_RetainerId INT;
    DECLARE v_BaseHealth INT;
    DECLARE v_BaseArmor INT;
    DECLARE v_BaseDamage INT;
    
    -- Get tier stats
    SELECT BaseHealth, BaseArmor, BaseDamageBonus
    INTO v_BaseHealth, v_BaseArmor, v_BaseDamage
    FROM RetainerTierCost
    WHERE RetainerTypeId = p_RetainerTypeId AND Tier = p_Tier;
    
    -- Create NPC record
    INSERT INTO NPC (Name, GenderId, Age, NPCType, OwnerCharacterId, CurrentHoldingId, Loyalty)
    VALUES (p_Name, p_GenderId, p_Age, 'Retainer', p_CharacterId, p_HoldingId, 50);
    
    SET v_NPCId = LAST_INSERT_ID();
    
    -- Initialize NPC aptitudes
    INSERT INTO NPCAptitude (NPCId, AptitudeId, BaseValue, CurrentValue)
    SELECT v_NPCId, Id, 3, 3 FROM Aptitude;
    
    -- Create Retainer record
    INSERT INTO Retainer (NPCId, RetainerTypeId, Tier, Health, MaxHealth, Armor, DamageBonus, HiredFromHoldingId)
    VALUES (v_NPCId, p_RetainerTypeId, p_Tier, v_BaseHealth, v_BaseHealth, v_BaseArmor, v_BaseDamage, p_HoldingId);
    
    SET v_RetainerId = LAST_INSERT_ID();
    
    SELECT v_RetainerId AS RetainerId, v_NPCId AS NPCId;
END //

-- Grant experience to retainer
CREATE PROCEDURE SP_GrantRetainerExp(
    IN p_RetainerId INT,
    IN p_ExpAmount INT
)
BEGIN
    DECLARE v_NewExp INT;
    DECLARE v_CurrentTier INT;
    DECLARE v_NewTier INT;
    DECLARE v_NewHealth INT;
    DECLARE v_NewArmor INT;
    DECLARE v_NewDamage INT;
    DECLARE v_RetainerTypeId INT;
    
    -- Update experience
    UPDATE Retainer SET Experience = Experience + p_ExpAmount WHERE Id = p_RetainerId;
    
    -- Get current state
    SELECT Experience, Tier, RetainerTypeId INTO v_NewExp, v_CurrentTier, v_RetainerTypeId
    FROM Retainer WHERE Id = p_RetainerId;
    
    -- Check for tier up
    SELECT Tier INTO v_NewTier
    FROM RetainerExpThreshold
    WHERE RequiredExp <= v_NewExp
    ORDER BY Tier DESC LIMIT 1;
    
    -- If tier changed, update stats
    IF v_NewTier > v_CurrentTier AND v_NewTier <= 5 THEN
        SELECT BaseHealth, BaseArmor, BaseDamageBonus
        INTO v_NewHealth, v_NewArmor, v_NewDamage
        FROM RetainerTierCost
        WHERE RetainerTypeId = v_RetainerTypeId AND Tier = v_NewTier;
        
        UPDATE Retainer
        SET Tier = v_NewTier,
            MaxHealth = v_NewHealth,
            Health = LEAST(Health, v_NewHealth), -- Keep current health if lower
            Armor = v_NewArmor,
            DamageBonus = v_NewDamage
        WHERE Id = p_RetainerId;
    END IF;
    
    SELECT v_NewExp AS Experience, v_NewTier AS Tier;
END //

-- Kill retainer (permadeath)
CREATE PROCEDURE SP_KillRetainer(
    IN p_RetainerId INT,
    IN p_DeathCause TEXT
)
BEGIN
    DECLARE v_NPCId INT;
    
    SELECT NPCId INTO v_NPCId FROM Retainer WHERE Id = p_RetainerId;
    
    -- Mark NPC as dead
    UPDATE NPC
    SET IsAlive = FALSE,
        DeathDate = NOW(),
        DeathCause = p_DeathCause
    WHERE Id = v_NPCId;
    
    -- Mark retainer unavailable
    UPDATE Retainer
    SET IsAvailable = FALSE,
        IsDeployed = FALSE,
        DeployedArmyId = NULL
    WHERE Id = p_RetainerId;
    
    -- Log death
    INSERT INTO RetainerCombatLog (RetainerId, CombatType, DiedInCombat, DeathDescription)
    VALUES (p_RetainerId, 'Battle', TRUE, p_DeathCause);
END //

DELIMITER ;
