-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 09_world_map.sql
-- Purpose: Zones, terrain, movement, fog of war, visibility
-- ============================================================================

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

-- Terrain types
CREATE TABLE IF NOT EXISTS TerrainType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    
    -- Movement modifiers
    MovementCost DECIMAL(3,2) DEFAULT 1.00,  -- Multiplier
    CavalryPenalty DECIMAL(3,2) DEFAULT 0.00,
    NavalOnly BOOLEAN DEFAULT FALSE,
    
    -- Combat modifiers
    DefenseBonus INT DEFAULT 0,
    AmbushBonus INT DEFAULT 0,
    
    -- Attrition
    AttritionRate DECIMAL(3,2) DEFAULT 0.00,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO TerrainType (Name, Description, MovementCost, CavalryPenalty, DefenseBonus, AmbushBonus, AttritionRate) VALUES
    ('Plains', 'Open, flat terrain', 1.00, 0.00, 0, 0, 0.00),
    ('Forest', 'Dense woodland', 1.50, 0.20, 2, 3, 0.01),
    ('Hills', 'Rolling highlands', 1.30, 0.10, 3, 2, 0.01),
    ('Mountains', 'Steep, difficult terrain', 2.50, 0.50, 5, 4, 0.03),
    ('Swamp', 'Boggy wetlands', 2.00, 0.40, 1, 3, 0.05),
    ('Desert', 'Arid wasteland', 1.50, 0.00, 0, 1, 0.04),
    ('Tundra', 'Frozen north', 1.80, 0.20, 1, 1, 0.06),
    ('River', 'Major waterway', 1.00, 0.00, 2, 0, 0.00),
    ('Coast', 'Shoreline', 1.10, 0.00, 1, 1, 0.00),
    ('Sea', 'Open water (naval only)', 1.00, 0.00, 0, 0, 0.01),
    ('Road', 'Maintained roads', 0.70, 0.00, -1, -2, 0.00),
    ('Castle', 'Fortified position', 2.00, 0.30, 10, 0, 0.00);

-- Regions (larger areas containing zones)
CREATE TABLE IF NOT EXISTS Region (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL UNIQUE,
    Description TEXT,
    
    -- Climate
    ClimateZoneId INT,
    
    -- Political
    DefaultReligionId INT,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Region_Climate FOREIGN KEY (ClimateZoneId) REFERENCES ClimateZone(Id),
    CONSTRAINT FK_Region_Religion FOREIGN KEY (DefaultReligionId) REFERENCES Religion(Id)
);

-- Insert major regions
INSERT INTO Region (Name, Description, ClimateZoneId, DefaultReligionId) VALUES
    ('The North', 'Stark territory, harsh and cold', 2, 2),
    ('The Riverlands', 'Fertile but war-torn', 3, 1),
    ('The Vale', 'Mountain fortress of the Arryns', 3, 1),
    ('The Westerlands', 'Gold-rich Lannister domain', 3, 1),
    ('The Reach', 'Fertile breadbasket of Westeros', 4, 1),
    ('The Stormlands', 'Baratheon territory', 3, 1),
    ('Dorne', 'Desert kingdom', 5, 1),
    ('The Iron Islands', 'Home of the Ironborn', 3, 3),
    ('The Crownlands', 'King''s territory around the capital', 3, 1),
    ('Beyond the Wall', 'Wildling territory', 1, 2);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Map zones (~250 zones)
CREATE TABLE IF NOT EXISTS Zone (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    
    -- Location
    RegionId INT NOT NULL,
    TerrainTypeId INT NOT NULL,
    
    -- Coordinates for map display
    MapX INT NOT NULL,
    MapY INT NOT NULL,
    
    -- Features
    HasPort BOOLEAN DEFAULT FALSE,
    HasRiver BOOLEAN DEFAULT FALSE,
    HasRoad BOOLEAN DEFAULT FALSE,
    
    -- Control
    ControllingHoldingId INT,       -- Which holding controls this zone
    
    -- Special
    IsCapital BOOLEAN DEFAULT FALSE,
    IsSacred BOOLEAN DEFAULT FALSE, -- Religious significance
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Zone_Region FOREIGN KEY (RegionId) REFERENCES Region(Id),
    CONSTRAINT FK_Zone_Terrain FOREIGN KEY (TerrainTypeId) REFERENCES TerrainType(Id),
    CONSTRAINT FK_Zone_Holding FOREIGN KEY (ControllingHoldingId) REFERENCES Holding(Id)
);

-- Zone adjacencies (which zones connect)
CREATE TABLE IF NOT EXISTS ZoneConnection (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    ZoneAId INT NOT NULL,
    ZoneBId INT NOT NULL,
    
    -- Connection type
    IsNaval BOOLEAN DEFAULT FALSE,  -- Requires ships
    IsRoad BOOLEAN DEFAULT FALSE,   -- Has road bonus
    IsBridge BOOLEAN DEFAULT FALSE, -- River crossing
    IsPass BOOLEAN DEFAULT FALSE,   -- Mountain pass
    
    -- Travel modifiers
    TravelModifier DECIMAL(3,2) DEFAULT 1.00,
    
    -- Blockade/control
    IsBlocked BOOLEAN DEFAULT FALSE,
    BlockedReason TEXT,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_ZoneConn_A FOREIGN KEY (ZoneAId) REFERENCES Zone(Id),
    CONSTRAINT FK_ZoneConn_B FOREIGN KEY (ZoneBId) REFERENCES Zone(Id),
    CONSTRAINT UQ_ZoneConn UNIQUE (ZoneAId, ZoneBId)
);

-- Add FKs that reference Zone
ALTER TABLE Holding ADD CONSTRAINT FK_Holding_Zone FOREIGN KEY (ZoneId) REFERENCES Zone(Id);
ALTER TABLE PlayerCharacter ADD CONSTRAINT FK_Character_Zone FOREIGN KEY (CurrentZoneId) REFERENCES Zone(Id);
ALTER TABLE PlayerCharacter ADD CONSTRAINT FK_Character_Holding FOREIGN KEY (CurrentHoldingId) REFERENCES Holding(Id);
ALTER TABLE NPC ADD CONSTRAINT FK_NPC_Zone FOREIGN KEY (CurrentZoneId) REFERENCES Zone(Id);
ALTER TABLE NPC ADD CONSTRAINT FK_NPC_Holding FOREIGN KEY (CurrentHoldingId) REFERENCES Holding(Id);
ALTER TABLE Army ADD CONSTRAINT FK_Army_Zone FOREIGN KEY (CurrentZoneId) REFERENCES Zone(Id);
ALTER TABLE Army ADD CONSTRAINT FK_Army_DestZone FOREIGN KEY (DestinationZoneId) REFERENCES Zone(Id);
ALTER TABLE Battle ADD CONSTRAINT FK_Battle_Zone FOREIGN KEY (ZoneId) REFERENCES Zone(Id);

-- Army movement queue
CREATE TABLE IF NOT EXISTS ArmyMovement (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    ArmyId INT NOT NULL,
    
    -- Path (ordered list of zones)
    FromZoneId INT NOT NULL,
    ToZoneId INT NOT NULL,
    PathZones JSON,                 -- Full path as array of zone IDs
    
    -- Timing
    StartedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    EstimatedArrival DATETIME NOT NULL,
    ActualArrival DATETIME,
    
    -- Status
    Status ENUM('InProgress', 'Completed', 'Cancelled', 'Intercepted') DEFAULT 'InProgress',
    
    -- Speed modifiers
    TerrainSpeedMod DECIMAL(3,2) DEFAULT 1.00,
    SeasonSpeedMod DECIMAL(3,2) DEFAULT 1.00,
    
    CONSTRAINT FK_ArmyMove_Army FOREIGN KEY (ArmyId) REFERENCES Army(Id),
    CONSTRAINT FK_ArmyMove_From FOREIGN KEY (FromZoneId) REFERENCES Zone(Id),
    CONSTRAINT FK_ArmyMove_To FOREIGN KEY (ToZoneId) REFERENCES Zone(Id)
);

-- Visibility (fog of war)
CREATE TABLE IF NOT EXISTS ZoneVisibility (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Who can see
    CharacterId INT,                -- Player
    HoldingId INT,                  -- Or holding's scouts
    
    -- What zone
    ZoneId INT NOT NULL,
    
    -- Visibility level
    VisibilityLevel ENUM('None', 'Rumor', 'Partial', 'Full') DEFAULT 'None',
    
    -- When last updated
    LastScouted DATETIME,
    IntelligenceAge INT DEFAULT 0, -- Days since last update
    
    -- What we know
    KnownArmies JSON,              -- [{ armyId, estimatedStrength, lastSeen }]
    KnownHolding BOOLEAN DEFAULT FALSE,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_ZoneVis_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_ZoneVis_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_ZoneVis_Zone FOREIGN KEY (ZoneId) REFERENCES Zone(Id)
);

-- Scout missions
CREATE TABLE IF NOT EXISTS ScoutMission (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Who is scouting
    RetainerId INT,                 -- Scout retainer
    ArmyId INT,                     -- Or army's scouts
    
    -- Target
    TargetZoneId INT NOT NULL,
    
    -- Timing
    StartedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CompletesAt DATETIME NOT NULL,
    
    -- Status
    Status ENUM('Active', 'Complete', 'Failed', 'Detected') DEFAULT 'Active',
    
    -- Results (filled on completion)
    ArmiesFound JSON,
    HoldingInfo JSON,
    TerrainInfo JSON,
    
    CONSTRAINT FK_Scout_Retainer FOREIGN KEY (RetainerId) REFERENCES Retainer(Id),
    CONSTRAINT FK_Scout_Army FOREIGN KEY (ArmyId) REFERENCES Army(Id),
    CONSTRAINT FK_Scout_Zone FOREIGN KEY (TargetZoneId) REFERENCES Zone(Id)
);

-- Ambush positions
CREATE TABLE IF NOT EXISTS Ambush (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    ArmyId INT NOT NULL,
    ZoneId INT NOT NULL,
    
    -- Setup
    SetupAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    IsActive BOOLEAN DEFAULT TRUE,
    
    -- Concealment
    ConcealmentLevel INT DEFAULT 0, -- From Scout-Master
    
    -- Trigger conditions
    TriggerOnAnyArmy BOOLEAN DEFAULT TRUE,
    TriggerOnSpecificArmy INT,      -- Only ambush this army
    
    -- Status
    WasTriggered BOOLEAN DEFAULT FALSE,
    TriggeredAt DATETIME,
    TargetArmyId INT,
    
    CONSTRAINT FK_Ambush_Army FOREIGN KEY (ArmyId) REFERENCES Army(Id),
    CONSTRAINT FK_Ambush_Zone FOREIGN KEY (ZoneId) REFERENCES Zone(Id),
    CONSTRAINT FK_Ambush_Target FOREIGN KEY (TargetArmyId) REFERENCES Army(Id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_Zone_Region ON Zone(RegionId);
CREATE INDEX IX_Zone_Terrain ON Zone(TerrainTypeId);
CREATE INDEX IX_Zone_Controlling ON Zone(ControllingHoldingId);
CREATE INDEX IX_Zone_Coords ON Zone(MapX, MapY);

CREATE INDEX IX_ZoneConn_ZoneA ON ZoneConnection(ZoneAId);
CREATE INDEX IX_ZoneConn_ZoneB ON ZoneConnection(ZoneBId);

CREATE INDEX IX_ArmyMove_Army ON ArmyMovement(ArmyId);
CREATE INDEX IX_ArmyMove_Status ON ArmyMovement(Status);

CREATE INDEX IX_ZoneVis_Character ON ZoneVisibility(CharacterId);
CREATE INDEX IX_ZoneVis_Holding ON ZoneVisibility(HoldingId);
CREATE INDEX IX_ZoneVis_Zone ON ZoneVisibility(ZoneId);

CREATE INDEX IX_Scout_Status ON ScoutMission(Status);
CREATE INDEX IX_Scout_Zone ON ScoutMission(TargetZoneId);

CREATE INDEX IX_Ambush_Zone ON Ambush(ZoneId);
CREATE INDEX IX_Ambush_Active ON Ambush(IsActive);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Zone overview with terrain and control
CREATE OR REPLACE VIEW V_ZoneOverview AS
SELECT 
    z.Id,
    z.Name,
    r.Name AS Region,
    tt.Name AS Terrain,
    h.Name AS ControllingHolding,
    c.Name AS ControllerName,
    z.HasPort,
    z.HasRiver,
    z.HasRoad,
    z.IsCapital,
    z.MapX,
    z.MapY
FROM Zone z
JOIN Region r ON z.RegionId = r.Id
JOIN TerrainType tt ON z.TerrainTypeId = tt.Id
LEFT JOIN Holding h ON z.ControllingHoldingId = h.Id
LEFT JOIN PlayerCharacter c ON h.OwnerCharacterId = c.Id;

-- Active armies in zones
CREATE OR REPLACE VIEW V_ZoneArmies AS
SELECT 
    z.Id AS ZoneId,
    z.Name AS ZoneName,
    a.Id AS ArmyId,
    a.Name AS ArmyName,
    c.Name AS CommanderName,
    a.TotalStrength,
    a.IsMoving,
    a.IsBesieging
FROM Zone z
JOIN Army a ON z.Id = a.CurrentZoneId
JOIN PlayerCharacter c ON a.OwnerCharacterId = c.Id;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Calculate travel time between zones
CREATE PROCEDURE SP_CalculateTravelTime(
    IN p_ArmyId INT,
    IN p_FromZoneId INT,
    IN p_ToZoneId INT,
    OUT p_TravelDays INT
)
BEGIN
    DECLARE v_TerrainMod DECIMAL(3,2);
    DECLARE v_SeasonMod DECIMAL(3,2);
    DECLARE v_BaseSpeed INT;
    DECLARE v_ConnectionMod DECIMAL(3,2);
    
    -- Get base army speed (slowest unit)
    SELECT MIN(ut.MovementSpeed) INTO v_BaseSpeed
    FROM ArmyUnit au
    JOIN UnitType ut ON au.UnitTypeId = ut.Id
    WHERE au.ArmyId = p_ArmyId AND au.Count > 0;
    
    IF v_BaseSpeed IS NULL OR v_BaseSpeed = 0 THEN
        SET v_BaseSpeed = 1;
    END IF;
    
    -- Get terrain modifier
    SELECT tt.MovementCost INTO v_TerrainMod
    FROM Zone z
    JOIN TerrainType tt ON z.TerrainTypeId = tt.Id
    WHERE z.Id = p_ToZoneId;
    
    -- Get season modifier
    SELECT s.TravelSpeedModifier INTO v_SeasonMod
    FROM WorldState ws
    JOIN Season s ON ws.CurrentSeasonId = s.Id
    LIMIT 1;
    
    -- Get connection modifier (if exists)
    SELECT COALESCE(TravelModifier, 1.00) INTO v_ConnectionMod
    FROM ZoneConnection
    WHERE (ZoneAId = p_FromZoneId AND ZoneBId = p_ToZoneId)
       OR (ZoneAId = p_ToZoneId AND ZoneBId = p_FromZoneId)
    LIMIT 1;
    
    -- Calculate: base is 1 day, modified by terrain, season, connection
    SET p_TravelDays = CEILING(1 * v_TerrainMod * (1/v_SeasonMod) * v_ConnectionMod / v_BaseSpeed);
END //

-- Start army movement
CREATE PROCEDURE SP_StartArmyMovement(
    IN p_ArmyId INT,
    IN p_DestinationZoneId INT
)
BEGIN
    DECLARE v_CurrentZoneId INT;
    DECLARE v_TravelDays INT;
    DECLARE v_Arrival DATETIME;
    
    -- Get current location
    SELECT CurrentZoneId INTO v_CurrentZoneId FROM Army WHERE Id = p_ArmyId;
    
    -- Calculate travel time
    CALL SP_CalculateTravelTime(p_ArmyId, v_CurrentZoneId, p_DestinationZoneId, v_TravelDays);
    
    SET v_Arrival = DATE_ADD(NOW(), INTERVAL v_TravelDays DAY);
    
    -- Update army
    UPDATE Army
    SET IsMoving = TRUE,
        DestinationZoneId = p_DestinationZoneId,
        EstimatedArrival = v_Arrival
    WHERE Id = p_ArmyId;
    
    -- Create movement record
    INSERT INTO ArmyMovement (ArmyId, FromZoneId, ToZoneId, EstimatedArrival)
    VALUES (p_ArmyId, v_CurrentZoneId, p_DestinationZoneId, v_Arrival);
    
    SELECT v_TravelDays AS TravelDays, v_Arrival AS EstimatedArrival;
END //

-- Complete army movement
CREATE PROCEDURE SP_CompleteArmyMovement(
    IN p_MovementId INT
)
BEGIN
    DECLARE v_ArmyId INT;
    DECLARE v_DestinationZoneId INT;
    
    -- Get movement details
    SELECT ArmyId, ToZoneId INTO v_ArmyId, v_DestinationZoneId
    FROM ArmyMovement WHERE Id = p_MovementId;
    
    -- Update movement record
    UPDATE ArmyMovement
    SET Status = 'Completed', ActualArrival = NOW()
    WHERE Id = p_MovementId;
    
    -- Update army location
    UPDATE Army
    SET CurrentZoneId = v_DestinationZoneId,
        IsMoving = FALSE,
        DestinationZoneId = NULL,
        EstimatedArrival = NULL
    WHERE Id = v_ArmyId;
    
    -- Check for ambushes in destination zone
    -- (Would trigger ambush battle if found - left to application logic)
END //

-- Update zone visibility for a PlayerCharacter
CREATE PROCEDURE SP_UpdateVisibility(
    IN p_CharacterId INT,
    IN p_ZoneId INT,
    IN p_Level ENUM('None', 'Rumor', 'Partial', 'Full')
)
BEGIN
    INSERT INTO ZoneVisibility (CharacterId, ZoneId, VisibilityLevel, LastScouted)
    VALUES (p_CharacterId, p_ZoneId, p_Level, NOW())
    ON DUPLICATE KEY UPDATE
        VisibilityLevel = p_Level,
        LastScouted = NOW(),
        IntelligenceAge = 0;
END //

-- Set up ambush
CREATE PROCEDURE SP_SetupAmbush(
    IN p_ArmyId INT,
    IN p_ZoneId INT,
    IN p_ScoutMasterBonus INT
)
BEGIN
    DECLARE v_Concealment INT;
    DECLARE v_TerrainBonus INT;
    
    -- Get terrain ambush bonus
    SELECT tt.AmbushBonus INTO v_TerrainBonus
    FROM Zone z
    JOIN TerrainType tt ON z.TerrainTypeId = tt.Id
    WHERE z.Id = p_ZoneId;
    
    SET v_Concealment = p_ScoutMasterBonus + COALESCE(v_TerrainBonus, 0);
    
    INSERT INTO Ambush (ArmyId, ZoneId, ConcealmentLevel)
    VALUES (p_ArmyId, p_ZoneId, v_Concealment);
    
    SELECT LAST_INSERT_ID() AS AmbushId, v_Concealment AS ConcealmentLevel;
END //

DELIMITER ;
