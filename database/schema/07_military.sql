-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 07_military.sql
-- Purpose: Armies, war councils, levies, mercenaries, battles
-- ============================================================================

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

-- Unit types
CREATE TABLE IF NOT EXISTS UnitType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Category ENUM('Infantry', 'Cavalry', 'Ranged', 'Siege', 'Naval') NOT NULL,
    Description TEXT,
    
    -- Combat stats
    AttackValue INT NOT NULL,
    DefenseValue INT NOT NULL,
    MoraleValue INT NOT NULL,
    
    -- Movement
    MovementSpeed INT NOT NULL,     -- Zones per day
    
    -- Cost
    MaintenancePerWeek INT NOT NULL, -- In copper
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO UnitType (Name, Category, Description, AttackValue, DefenseValue, MoraleValue, MovementSpeed, MaintenancePerWeek) VALUES
    ('Levy Infantry', 'Infantry', 'Peasant soldiers, poorly equipped', 2, 2, 3, 1, 10),
    ('Men-at-Arms', 'Infantry', 'Professional soldiers', 5, 5, 5, 1, 50),
    ('Heavy Infantry', 'Infantry', 'Armored footmen', 6, 7, 6, 1, 80),
    ('Light Cavalry', 'Cavalry', 'Scouts and skirmishers', 4, 3, 4, 3, 100),
    ('Heavy Cavalry', 'Cavalry', 'Knights and mounted warriors', 8, 6, 7, 2, 200),
    ('Archers', 'Ranged', 'Bowmen', 5, 2, 4, 1, 40),
    ('Crossbowmen', 'Ranged', 'Crossbow troops', 6, 3, 4, 1, 60),
    ('Siege Engines', 'Siege', 'Catapults, rams, towers', 2, 1, 3, 0, 150),
    ('Warships', 'Naval', 'Combat vessels', 5, 4, 5, 5, 300),
    ('Transports', 'Naval', 'Troop carriers', 1, 2, 3, 4, 100);

-- War council roles
CREATE TABLE IF NOT EXISTS WarCouncilRole (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    BonusType VARCHAR(50),          -- What bonus this role provides
    RequiredAptitudeId INT,         -- Primary aptitude for role
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_WCRole_Aptitude FOREIGN KEY (RequiredAptitudeId) REFERENCES Aptitude(Id)
);

INSERT INTO WarCouncilRole (Name, Description, BonusType, RequiredAptitudeId) VALUES
    ('Commander', 'Army leader, overall tactics', 'Tactics', 3),          -- Command
    ('Champion', 'Duelist, challenges enemy champions', 'Dueling', 1),    -- Prowess
    ('Quartermaster', 'Supply and logistics', 'Supply', 5),               -- Stewardship
    ('Scout-Master', 'Reconnaissance, ambushes', 'Scouting', 4),          -- Cunning
    ('Standard Bearer', 'Morale and rallying', 'Morale', 6),              -- Presence
    ('Chaplain', 'Spiritual guidance, last rites', 'Faith', 7);           -- Faith

-- Mercenary company templates
CREATE TABLE IF NOT EXISTS MercenaryCompany (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    Description TEXT,
    
    -- Composition
    TotalStrength INT NOT NULL,
    
    -- Reputation
    Reputation INT DEFAULT 50,      -- 0-100, affects reliability
    Loyalty INT DEFAULT 50,         -- How likely to betray
    
    -- Cost
    HireCost INT NOT NULL,          -- One-time
    WeeklyCost INT NOT NULL,        -- Ongoing
    
    -- Home region
    HomeRegion VARCHAR(100),
    
    -- Status
    IsAvailable BOOLEAN DEFAULT TRUE,
    CurrentEmployerId INT,          -- PlayerCharacter who hired them
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Merc_Employer FOREIGN KEY (CurrentEmployerId) REFERENCES PlayerCharacter(Id)
);

-- Sample mercenary companies
INSERT INTO MercenaryCompany (Name, Description, TotalStrength, Reputation, HireCost, WeeklyCost, HomeRegion) VALUES
    ('Golden Company', 'Elite exiles from Westeros', 10000, 90, 50000000, 5000000, 'Essos'),
    ('Second Sons', 'Veteran sellswords', 2000, 60, 10000000, 1000000, 'Essos'),
    ('Brave Companions', 'Notorious and brutal', 500, 30, 2500000, 250000, 'Essos'),
    ('Windblown', 'Desert warriors', 2000, 70, 10000000, 1000000, 'Essos');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Armies
CREATE TABLE IF NOT EXISTS Army (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    
    -- Ownership
    OwnerCharacterId INT NOT NULL,
    OwningHoldingId INT,            -- Home base
    
    -- Location
    CurrentZoneId INT NOT NULL,
    IsMoving BOOLEAN DEFAULT FALSE,
    DestinationZoneId INT,
    EstimatedArrival DATETIME,
    
    -- Composition totals (cached)
    TotalStrength INT DEFAULT 0,
    CavalryCount INT DEFAULT 0,
    InfantryCount INT DEFAULT 0,
    ArcherCount INT DEFAULT 0,
    
    -- Status
    Morale INT DEFAULT 50,          -- 0-100
    Supply INT DEFAULT 100,         -- Days of food
    Attrition DECIMAL(5,2) DEFAULT 0.00, -- Daily loss rate
    
    -- Fleet
    IsNaval BOOLEAN DEFAULT FALSE,
    ShipCount INT DEFAULT 0,
    
    -- Siege
    IsBesieging BOOLEAN DEFAULT FALSE,
    BesiegingHoldingId INT,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Army_Owner FOREIGN KEY (OwnerCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Army_Holding FOREIGN KEY (OwningHoldingId) REFERENCES Holding(Id)
);

-- Army composition (units)
CREATE TABLE IF NOT EXISTS ArmyUnit (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    ArmyId INT NOT NULL,
    UnitTypeId INT NOT NULL,
    
    -- Numbers
    Count INT NOT NULL,
    MaxCount INT NOT NULL,          -- Starting strength
    
    -- Source
    SourceHoldingId INT,            -- Where levies came from
    IsMercenary BOOLEAN DEFAULT FALSE,
    MercenaryCompanyId INT,
    
    -- Status
    Morale INT DEFAULT 50,
    Experience INT DEFAULT 0,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_ArmyUnit_Army FOREIGN KEY (ArmyId) REFERENCES Army(Id),
    CONSTRAINT FK_ArmyUnit_Type FOREIGN KEY (UnitTypeId) REFERENCES UnitType(Id),
    CONSTRAINT FK_ArmyUnit_Source FOREIGN KEY (SourceHoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_ArmyUnit_Merc FOREIGN KEY (MercenaryCompanyId) REFERENCES MercenaryCompany(Id)
);

-- War council assignments
CREATE TABLE IF NOT EXISTS ArmyWarCouncil (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    ArmyId INT NOT NULL,
    RoleId INT NOT NULL,
    
    -- Assigned person (one of these)
    CharacterId INT,                -- Player PlayerCharacter
    RetainerId INT,                 -- Player's retainer
    
    -- Effectiveness
    AptitudeValue INT,              -- Relevant aptitude score
    BonusProvided INT DEFAULT 0,    -- Calculated bonus
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_WC_Army FOREIGN KEY (ArmyId) REFERENCES Army(Id),
    CONSTRAINT FK_WC_Role FOREIGN KEY (RoleId) REFERENCES WarCouncilRole(Id),
    CONSTRAINT FK_WC_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_WC_Retainer FOREIGN KEY (RetainerId) REFERENCES Retainer(Id),
    CONSTRAINT UQ_WC_Role UNIQUE (ArmyId, RoleId)
);

-- Battles
CREATE TABLE IF NOT EXISTS Battle (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100),
    
    -- Location
    ZoneId INT NOT NULL,
    
    -- Combatants
    AttackerArmyId INT NOT NULL,
    DefenderArmyId INT,             -- NULL = garrison defense
    DefenderHoldingId INT,          -- If siege assault
    
    -- Outcome
    Victor ENUM('Attacker', 'Defender', 'Draw', 'Ongoing'),
    
    -- Casualties
    AttackerCasualties INT DEFAULT 0,
    DefenderCasualties INT DEFAULT 0,
    AttackerRouted BOOLEAN DEFAULT FALSE,
    DefenderRouted BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    StartedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    EndedAt DATETIME,
    
    -- Detailed log
    BattleLog JSON,                 -- Round-by-round details
    
    CONSTRAINT FK_Battle_Attacker FOREIGN KEY (AttackerArmyId) REFERENCES Army(Id),
    CONSTRAINT FK_Battle_Defender FOREIGN KEY (DefenderArmyId) REFERENCES Army(Id),
    CONSTRAINT FK_Battle_Holding FOREIGN KEY (DefenderHoldingId) REFERENCES Holding(Id)
);

-- Battle participants (for XP/glory tracking)
CREATE TABLE IF NOT EXISTS BattleParticipant (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    BattleId INT NOT NULL,
    
    -- Participant (one of these)
    CharacterId INT,
    RetainerId INT,
    
    -- Role in battle
    WarCouncilRoleId INT,
    Side ENUM('Attacker', 'Defender') NOT NULL,
    
    -- Outcome for this participant
    Survived BOOLEAN DEFAULT TRUE,
    WasWounded BOOLEAN DEFAULT FALSE,
    KillCount INT DEFAULT 0,
    GloryEarned INT DEFAULT 0,
    ExpEarned INT DEFAULT 0,
    
    CONSTRAINT FK_BattlePart_Battle FOREIGN KEY (BattleId) REFERENCES Battle(Id),
    CONSTRAINT FK_BattlePart_Char FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_BattlePart_Ret FOREIGN KEY (RetainerId) REFERENCES Retainer(Id),
    CONSTRAINT FK_BattlePart_Role FOREIGN KEY (WarCouncilRoleId) REFERENCES WarCouncilRole(Id)
);

-- Siege tracking
CREATE TABLE IF NOT EXISTS Siege (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Combatants
    BesiegingArmyId INT NOT NULL,
    DefendingHoldingId INT NOT NULL,
    
    -- Progress
    StartedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    WallBreaches INT DEFAULT 0,
    AssaultAttempts INT DEFAULT 0,
    
    -- Status
    Status ENUM('Ongoing', 'Surrendered', 'Stormed', 'Lifted', 'Starved') DEFAULT 'Ongoing',
    EndedAt DATETIME,
    
    -- Defender supplies
    DefenderSupplyDays INT DEFAULT 100,
    
    CONSTRAINT FK_Siege_Army FOREIGN KEY (BesiegingArmyId) REFERENCES Army(Id),
    CONSTRAINT FK_Siege_Holding FOREIGN KEY (DefendingHoldingId) REFERENCES Holding(Id)
);

-- Levy contribution tracking (which holdings contributed to army)
CREATE TABLE IF NOT EXISTS ArmyLevySource (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    ArmyId INT NOT NULL,
    SourceHoldingId INT NOT NULL,
    
    -- Contribution
    LevyCount INT NOT NULL,
    ContributedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Status
    ReturnedCount INT DEFAULT 0,
    CasualtiesCount INT DEFAULT 0,
    
    CONSTRAINT FK_LevySource_Army FOREIGN KEY (ArmyId) REFERENCES Army(Id),
    CONSTRAINT FK_LevySource_Holding FOREIGN KEY (SourceHoldingId) REFERENCES Holding(Id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_Army_Owner ON Army(OwnerCharacterId);
CREATE INDEX IX_Army_Zone ON Army(CurrentZoneId);
CREATE INDEX IX_Army_Moving ON Army(IsMoving);
CREATE INDEX IX_Army_Besieging ON Army(IsBesieging);

CREATE INDEX IX_ArmyUnit_Army ON ArmyUnit(ArmyId);
CREATE INDEX IX_ArmyUnit_Type ON ArmyUnit(UnitTypeId);

CREATE INDEX IX_WarCouncil_Army ON ArmyWarCouncil(ArmyId);

CREATE INDEX IX_Battle_Zone ON Battle(ZoneId);
CREATE INDEX IX_Battle_Attacker ON Battle(AttackerArmyId);
CREATE INDEX IX_Battle_Defender ON Battle(DefenderArmyId);
CREATE INDEX IX_Battle_Started ON Battle(StartedAt);

CREATE INDEX IX_BattlePart_Battle ON BattleParticipant(BattleId);
CREATE INDEX IX_BattlePart_Char ON BattleParticipant(CharacterId);

CREATE INDEX IX_Siege_Army ON Siege(BesiegingArmyId);
CREATE INDEX IX_Siege_Holding ON Siege(DefendingHoldingId);
CREATE INDEX IX_Siege_Status ON Siege(Status);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Army overview with composition
CREATE OR REPLACE VIEW V_ArmyOverview AS
SELECT 
    a.Id,
    a.Name,
    c.Name AS CommanderName,
    a.TotalStrength,
    a.Morale,
    a.Supply,
    a.IsMoving,
    a.IsBesieging,
    a.CurrentZoneId,
    (SELECT COUNT(*) FROM ArmyUnit WHERE ArmyId = a.Id) AS UnitTypeCount
FROM Army a
JOIN PlayerCharacter c ON a.OwnerCharacterId = c.Id;

-- War council view
CREATE OR REPLACE VIEW V_WarCouncil AS
SELECT 
    wc.ArmyId,
    a.Name AS ArmyName,
    wcr.Name AS Role,
    COALESCE(c.Name, n.Name) AS AssigneeName,
    wc.AptitudeValue,
    wc.BonusProvided
FROM ArmyWarCouncil wc
JOIN Army a ON wc.ArmyId = a.Id
JOIN WarCouncilRole wcr ON wc.RoleId = wcr.Id
LEFT JOIN PlayerCharacter c ON wc.CharacterId = c.Id
LEFT JOIN Retainer r ON wc.RetainerId = r.Id
LEFT JOIN NPC n ON r.NPCId = n.Id;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Create a new army
CREATE PROCEDURE SP_CreateArmy(
    IN p_Name VARCHAR(100),
    IN p_OwnerCharacterId INT,
    IN p_OwningHoldingId INT,
    IN p_ZoneId INT
)
BEGIN
    DECLARE v_ArmyId INT;
    
    INSERT INTO Army (Name, OwnerCharacterId, OwningHoldingId, CurrentZoneId)
    VALUES (p_Name, p_OwnerCharacterId, p_OwningHoldingId, p_ZoneId);
    
    SET v_ArmyId = LAST_INSERT_ID();
    
    SELECT v_ArmyId AS ArmyId;
END //

-- Add units to army
CREATE PROCEDURE SP_AddUnitsToArmy(
    IN p_ArmyId INT,
    IN p_UnitTypeId INT,
    IN p_Count INT,
    IN p_SourceHoldingId INT
)
BEGIN
    -- Insert or update unit count
    INSERT INTO ArmyUnit (ArmyId, UnitTypeId, Count, MaxCount, SourceHoldingId)
    VALUES (p_ArmyId, p_UnitTypeId, p_Count, p_Count, p_SourceHoldingId)
    ON DUPLICATE KEY UPDATE
        Count = Count + p_Count,
        MaxCount = MaxCount + p_Count;
    
    -- Track levy source
    IF p_SourceHoldingId IS NOT NULL THEN
        INSERT INTO ArmyLevySource (ArmyId, SourceHoldingId, LevyCount)
        VALUES (p_ArmyId, p_SourceHoldingId, p_Count)
        ON DUPLICATE KEY UPDATE LevyCount = LevyCount + p_Count;
    END IF;
    
    -- Update army totals
    CALL SP_UpdateArmyStrength(p_ArmyId);
END //

-- Update army strength totals
CREATE PROCEDURE SP_UpdateArmyStrength(
    IN p_ArmyId INT
)
BEGIN
    UPDATE Army a
    SET TotalStrength = (SELECT COALESCE(SUM(Count), 0) FROM ArmyUnit WHERE ArmyId = p_ArmyId),
        InfantryCount = (SELECT COALESCE(SUM(au.Count), 0) FROM ArmyUnit au JOIN UnitType ut ON au.UnitTypeId = ut.Id WHERE au.ArmyId = p_ArmyId AND ut.Category = 'Infantry'),
        CavalryCount = (SELECT COALESCE(SUM(au.Count), 0) FROM ArmyUnit au JOIN UnitType ut ON au.UnitTypeId = ut.Id WHERE au.ArmyId = p_ArmyId AND ut.Category = 'Cavalry'),
        ArcherCount = (SELECT COALESCE(SUM(au.Count), 0) FROM ArmyUnit au JOIN UnitType ut ON au.UnitTypeId = ut.Id WHERE au.ArmyId = p_ArmyId AND ut.Category = 'Ranged')
    WHERE Id = p_ArmyId;
END //

-- Assign war council role
CREATE PROCEDURE SP_AssignWarCouncilRole(
    IN p_ArmyId INT,
    IN p_RoleId INT,
    IN p_CharacterId INT,
    IN p_RetainerId INT
)
BEGIN
    DECLARE v_AptitudeId INT;
    DECLARE v_AptitudeValue INT DEFAULT 0;
    
    -- Get required aptitude
    SELECT RequiredAptitudeId INTO v_AptitudeId FROM WarCouncilRole WHERE Id = p_RoleId;
    
    -- Get aptitude value from assignee
    IF p_CharacterId IS NOT NULL THEN
        SELECT CurrentValue INTO v_AptitudeValue
        FROM CharacterAptitude
        WHERE CharacterId = p_CharacterId AND AptitudeId = v_AptitudeId;
    ELSEIF p_RetainerId IS NOT NULL THEN
        SELECT na.CurrentValue INTO v_AptitudeValue
        FROM Retainer r
        JOIN NPCAptitude na ON r.NPCId = na.NPCId
        WHERE r.Id = p_RetainerId AND na.AptitudeId = v_AptitudeId;
    END IF;
    
    -- Insert or update assignment
    INSERT INTO ArmyWarCouncil (ArmyId, RoleId, CharacterId, RetainerId, AptitudeValue, BonusProvided)
    VALUES (p_ArmyId, p_RoleId, p_CharacterId, p_RetainerId, v_AptitudeValue, v_AptitudeValue)
    ON DUPLICATE KEY UPDATE
        CharacterId = p_CharacterId,
        RetainerId = p_RetainerId,
        AptitudeValue = v_AptitudeValue,
        BonusProvided = v_AptitudeValue;
END //

-- Apply battle casualties
CREATE PROCEDURE SP_ApplyBattleCasualties(
    IN p_ArmyId INT,
    IN p_CasualtyPercent DECIMAL(5,2)
)
BEGIN
    -- Reduce unit counts
    UPDATE ArmyUnit
    SET Count = GREATEST(0, FLOOR(Count * (1 - p_CasualtyPercent)))
    WHERE ArmyId = p_ArmyId;
    
    -- Update army totals
    CALL SP_UpdateArmyStrength(p_ArmyId);
    
    -- Record casualties in levy sources (proportional)
    UPDATE ArmyLevySource als
    SET CasualtiesCount = CasualtiesCount + FLOOR(LevyCount * p_CasualtyPercent)
    WHERE ArmyId = p_ArmyId;
END //

-- Start siege
CREATE PROCEDURE SP_StartSiege(
    IN p_ArmyId INT,
    IN p_HoldingId INT
)
BEGIN
    DECLARE v_DefenderSupply INT;
    
    -- Get defender supplies
    SELECT SuppliesRemaining INTO v_DefenderSupply
    FROM HoldingDefense WHERE HoldingId = p_HoldingId;
    
    -- Create siege record
    INSERT INTO Siege (BesiegingArmyId, DefendingHoldingId, DefenderSupplyDays)
    VALUES (p_ArmyId, p_HoldingId, COALESCE(v_DefenderSupply, 100));
    
    -- Update army status
    UPDATE Army SET IsBesieging = TRUE, BesiegingHoldingId = p_HoldingId
    WHERE Id = p_ArmyId;
    
    -- Update holding defense status
    UPDATE HoldingDefense SET IsUnderSiege = TRUE, SiegeStartedAt = NOW(), BesiegingArmyId = p_ArmyId
    WHERE HoldingId = p_HoldingId;
END //

DELIMITER ;
