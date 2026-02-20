-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 06_resources.sql
-- Purpose: Economy, manpower, currency, seasons, trade
-- ============================================================================

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

-- Seasons
CREATE TABLE IF NOT EXISTS Season (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(20) NOT NULL UNIQUE,
    Description TEXT,
    
    -- Effects
    FoodProductionModifier DECIMAL(3,2) DEFAULT 1.00,
    TravelSpeedModifier DECIMAL(3,2) DEFAULT 1.00,
    MoraleModifier INT DEFAULT 0,
    AttritionModifier DECIMAL(3,2) DEFAULT 1.00,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO Season (Name, Description, FoodProductionModifier, TravelSpeedModifier, MoraleModifier, AttritionModifier) VALUES
    ('Spring', 'Time of growth and renewal', 1.20, 1.00, 5, 0.80),
    ('Summer', 'Peak productivity', 1.50, 1.10, 10, 0.50),
    ('Autumn', 'Harvest season', 1.00, 0.90, 0, 1.00),
    ('Winter', 'Harsh and unforgiving', 0.20, 0.60, -10, 2.00),
    ('Long Winter', 'Years-long winter', 0.00, 0.40, -20, 3.00);

-- Climate zones
CREATE TABLE IF NOT EXISTS ClimateZone (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    
    -- Season effects multiplier
    WinterSeverity DECIMAL(3,2) DEFAULT 1.00,
    SummerProductivity DECIMAL(3,2) DEFAULT 1.00,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ClimateZone (Name, Description, WinterSeverity, SummerProductivity) VALUES
    ('Far North', 'Beyond the Wall - extreme cold', 2.00, 0.50),
    ('North', 'The North - harsh winters', 1.50, 0.80),
    ('Riverlands', 'Temperate - fertile but war-torn', 1.00, 1.00),
    ('South', 'The Reach and surrounding - mild', 0.70, 1.20),
    ('Dorne', 'Desert and arid - minimal winter impact', 0.30, 0.90);

-- Transaction types
CREATE TABLE IF NOT EXISTS TransactionType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Category ENUM('Income', 'Expense', 'Transfer') NOT NULL,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO TransactionType (Name, Category, Description) VALUES
    ('Tax Collection', 'Income', 'Regular taxes from population'),
    ('Resource Sale', 'Income', 'Selling goods at market'),
    ('Vassal Tribute', 'Income', 'Payment from vassals'),
    ('Wage Payment', 'Expense', 'Retainer and garrison wages'),
    ('Construction', 'Expense', 'Building improvements'),
    ('Equipment Purchase', 'Expense', 'Buying weapons, armor'),
    ('Trade Purchase', 'Expense', 'Buying resources'),
    ('Gift', 'Transfer', 'Diplomatic gift'),
    ('Ransom', 'Transfer', 'Payment for prisoner release'),
    ('Tribute', 'Expense', 'Payment to overlord'),
    ('Mercenary Hire', 'Expense', 'Hiring sellswords'),
    ('Levy Maintenance', 'Expense', 'Extended levy upkeep');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Current world state
CREATE TABLE IF NOT EXISTS WorldState (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Current IC date
    CurrentDate DATE NOT NULL DEFAULT '298-01-01',  -- Dance of Dragons era
    
    -- Current season
    CurrentSeasonId INT NOT NULL DEFAULT 2,         -- Summer
    SeasonStartDate DATE NOT NULL DEFAULT '298-01-01',
    ExpectedSeasonEndDate DATE,
    
    -- Winter tracking (ASOIAF specific)
    WinterYearsElapsed INT DEFAULT 0,
    IsLongWinter BOOLEAN DEFAULT FALSE,
    
    -- Global events
    IsPlagueActive BOOLEAN DEFAULT FALSE,
    IsFamineActive BOOLEAN DEFAULT FALSE,
    
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_World_Season FOREIGN KEY (CurrentSeasonId) REFERENCES Season(Id)
);

-- Initialize world state
INSERT INTO WorldState (CurrentDate, CurrentSeasonId) VALUES ('129-01-01', 2);

-- Holding manpower tracking
CREATE TABLE IF NOT EXISTS HoldingManpower (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT NOT NULL UNIQUE,
    
    -- Total manpower (50% of population)
    TotalManpower INT NOT NULL DEFAULT 0,
    
    -- Allocation
    WorkersAssigned INT DEFAULT 0,    -- In resource nodes
    SoldiersRaised INT DEFAULT 0,     -- As levies
    AvailableManpower INT DEFAULT 0,  -- Unassigned
    
    -- Levy state
    LevyRaisedAt DATETIME,
    FreeLevyDaysRemaining INT DEFAULT 45, -- First 45 days free
    IsLevyPaid BOOLEAN DEFAULT TRUE,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_HoldManpower_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id)
);

-- Income/expense tracking
CREATE TABLE IF NOT EXISTS HoldingLedger (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT NOT NULL,
    TransactionTypeId INT NOT NULL,
    
    -- Amount (in copper, negative = expense)
    Amount INT NOT NULL,
    
    -- Context
    Description TEXT,
    RelatedHoldingId INT,           -- For transfers
    RelatedCharacterId INT,
    
    -- Timestamp
    TransactionDate DATE NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Ledger_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_Ledger_Type FOREIGN KEY (TransactionTypeId) REFERENCES TransactionType(Id),
    CONSTRAINT FK_Ledger_RelHolding FOREIGN KEY (RelatedHoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_Ledger_RelChar FOREIGN KEY (RelatedCharacterId) REFERENCES PlayerCharacter(Id)
);

-- Trade routes
CREATE TABLE IF NOT EXISTS TradeRoute (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Endpoints
    HoldingAId INT NOT NULL,
    HoldingBId INT NOT NULL,
    
    -- Route details
    Distance INT NOT NULL,          -- In zones/days
    IsSea BOOLEAN DEFAULT FALSE,    -- Sea route vs land
    DangerLevel INT DEFAULT 1,      -- 1-5, affects losses
    
    -- Status
    IsActive BOOLEAN DEFAULT TRUE,
    BlockedReason TEXT,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Trade_HoldingA FOREIGN KEY (HoldingAId) REFERENCES Holding(Id),
    CONSTRAINT FK_Trade_HoldingB FOREIGN KEY (HoldingBId) REFERENCES Holding(Id)
);

-- Active trade agreements
CREATE TABLE IF NOT EXISTS TradeAgreement (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    TradeRouteId INT NOT NULL,
    
    -- Terms
    SellerHoldingId INT NOT NULL,
    BuyerHoldingId INT NOT NULL,
    
    -- What's being traded
    ResourceType ENUM('Food', 'Wood', 'Stone', 'Iron', 'Gold', 'Luxury', 'Special') NOT NULL,
    QuantityPerWeek INT NOT NULL,
    PricePerUnit INT NOT NULL,      -- In copper
    
    -- Duration
    StartDate DATE NOT NULL,
    EndDate DATE,                   -- NULL = indefinite
    IsActive BOOLEAN DEFAULT TRUE,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_TradeAgree_Route FOREIGN KEY (TradeRouteId) REFERENCES TradeRoute(Id),
    CONSTRAINT FK_TradeAgree_Seller FOREIGN KEY (SellerHoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_TradeAgree_Buyer FOREIGN KEY (BuyerHoldingId) REFERENCES Holding(Id)
);

-- Resource production log (weekly)
CREATE TABLE IF NOT EXISTS ProductionLog (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT NOT NULL,
    ResourceNodeId INT NOT NULL,
    
    -- Production week
    WeekStartDate DATE NOT NULL,
    
    -- Output
    BaseOutput INT NOT NULL,
    SeasonModifier DECIMAL(3,2) NOT NULL,
    WorkerModifier DECIMAL(3,2) NOT NULL,
    FinalOutput INT NOT NULL,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_ProdLog_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_ProdLog_Node FOREIGN KEY (ResourceNodeId) REFERENCES HoldingResourceNode(Id)
);

-- Market prices (fluctuate by region/season)
CREATE TABLE IF NOT EXISTS MarketPrice (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT,                  -- NULL = global default
    
    ResourceType ENUM('Food', 'Wood', 'Stone', 'Iron', 'Gold', 'Luxury', 'Special') NOT NULL,
    
    -- Prices in copper
    BasePrice INT NOT NULL,
    CurrentPrice INT NOT NULL,
    
    -- Modifiers
    SupplyLevel ENUM('Scarce', 'Low', 'Normal', 'High', 'Surplus') DEFAULT 'Normal',
    
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Market_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id)
);

-- Default market prices
INSERT INTO MarketPrice (HoldingId, ResourceType, BasePrice, CurrentPrice) VALUES
    (NULL, 'Food', 100, 100),       -- 1 copper per unit
    (NULL, 'Wood', 200, 200),       -- 2 copper
    (NULL, 'Stone', 300, 300),      -- 3 copper
    (NULL, 'Iron', 500, 500),       -- 5 copper
    (NULL, 'Gold', 10000, 10000),   -- 1 silver
    (NULL, 'Luxury', 5000, 5000),   -- 50 copper
    (NULL, 'Special', 100000, 100000); -- 1 gold

-- Levy payment tracking
CREATE TABLE IF NOT EXISTS LevyPayment (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    HoldingId INT NOT NULL,
    
    -- Payment period
    PeriodStartDate DATE NOT NULL,
    PeriodEndDate DATE NOT NULL,
    
    -- Numbers
    LevyCount INT NOT NULL,
    DailyWage INT NOT NULL,         -- Per soldier
    TotalOwed INT NOT NULL,
    TotalPaid INT NOT NULL DEFAULT 0,
    
    -- Status
    IsPaid BOOLEAN DEFAULT FALSE,
    PaidAt DATETIME,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_LevyPay_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_HoldingManpower_Holding ON HoldingManpower(HoldingId);

CREATE INDEX IX_Ledger_Holding ON HoldingLedger(HoldingId);
CREATE INDEX IX_Ledger_Date ON HoldingLedger(TransactionDate);
CREATE INDEX IX_Ledger_Type ON HoldingLedger(TransactionTypeId);

CREATE INDEX IX_TradeRoute_HoldingA ON TradeRoute(HoldingAId);
CREATE INDEX IX_TradeRoute_HoldingB ON TradeRoute(HoldingBId);
CREATE INDEX IX_TradeRoute_Active ON TradeRoute(IsActive);

CREATE INDEX IX_TradeAgreement_Route ON TradeAgreement(TradeRouteId);
CREATE INDEX IX_TradeAgreement_Active ON TradeAgreement(IsActive);

CREATE INDEX IX_ProductionLog_Holding ON ProductionLog(HoldingId);
CREATE INDEX IX_ProductionLog_Week ON ProductionLog(WeekStartDate);

CREATE INDEX IX_MarketPrice_Holding ON MarketPrice(HoldingId);
CREATE INDEX IX_MarketPrice_Resource ON MarketPrice(ResourceType);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Holding economic summary
CREATE OR REPLACE VIEW V_HoldingEconomy AS
SELECT 
    h.Id AS HoldingId,
    h.Name,
    h.Treasury,
    h.Population,
    hm.TotalManpower,
    hm.WorkersAssigned,
    hm.SoldiersRaised,
    hm.AvailableManpower,
    (SELECT SUM(CASE WHEN Amount > 0 THEN Amount ELSE 0 END) 
     FROM HoldingLedger 
     WHERE HoldingId = h.Id AND TransactionDate >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS WeeklyIncome,
    (SELECT SUM(CASE WHEN Amount < 0 THEN ABS(Amount) ELSE 0 END) 
     FROM HoldingLedger 
     WHERE HoldingId = h.Id AND TransactionDate >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS WeeklyExpenses
FROM Holding h
LEFT JOIN HoldingManpower hm ON h.Id = hm.HoldingId
WHERE h.IsDestroyed = FALSE;

-- Active trade view
CREATE OR REPLACE VIEW V_ActiveTrades AS
SELECT 
    ta.Id,
    sh.Name AS SellerHolding,
    bh.Name AS BuyerHolding,
    ta.ResourceType,
    ta.QuantityPerWeek,
    ta.PricePerUnit,
    (ta.QuantityPerWeek * ta.PricePerUnit) AS WeeklyValue,
    tr.Distance,
    tr.IsSea
FROM TradeAgreement ta
JOIN TradeRoute tr ON ta.TradeRouteId = tr.Id
JOIN Holding sh ON ta.SellerHoldingId = sh.Id
JOIN Holding bh ON ta.BuyerHoldingId = bh.Id
WHERE ta.IsActive = TRUE AND tr.IsActive = TRUE;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Initialize manpower for a holding
CREATE PROCEDURE SP_InitializeManpower(
    IN p_HoldingId INT
)
BEGIN
    DECLARE v_Population INT;
    DECLARE v_Manpower INT;
    
    SELECT Population INTO v_Population FROM Holding WHERE Id = p_HoldingId;
    SET v_Manpower = FLOOR(v_Population * 0.5);  -- 50% of population
    
    INSERT INTO HoldingManpower (HoldingId, TotalManpower, AvailableManpower)
    VALUES (p_HoldingId, v_Manpower, v_Manpower)
    ON DUPLICATE KEY UPDATE
        TotalManpower = v_Manpower,
        AvailableManpower = v_Manpower - WorkersAssigned - SoldiersRaised;
END //

-- Raise levies
CREATE PROCEDURE SP_RaiseLevies(
    IN p_HoldingId INT,
    IN p_Count INT
)
BEGIN
    DECLARE v_Available INT;
    
    SELECT AvailableManpower INTO v_Available
    FROM HoldingManpower WHERE HoldingId = p_HoldingId;
    
    IF p_Count > v_Available THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Not enough available manpower';
    ELSE
        UPDATE HoldingManpower
        SET SoldiersRaised = SoldiersRaised + p_Count,
            AvailableManpower = AvailableManpower - p_Count,
            LevyRaisedAt = COALESCE(LevyRaisedAt, NOW())
        WHERE HoldingId = p_HoldingId;
    END IF;
END //

-- Disband levies
CREATE PROCEDURE SP_DisbandLevies(
    IN p_HoldingId INT,
    IN p_Count INT
)
BEGIN
    DECLARE v_Raised INT;
    
    SELECT SoldiersRaised INTO v_Raised
    FROM HoldingManpower WHERE HoldingId = p_HoldingId;
    
    IF p_Count > v_Raised THEN
        SET p_Count = v_Raised;  -- Can't disband more than raised
    END IF;
    
    UPDATE HoldingManpower
    SET SoldiersRaised = SoldiersRaised - p_Count,
        AvailableManpower = AvailableManpower + p_Count
    WHERE HoldingId = p_HoldingId;
    
    -- Reset levy timer if all disbanded
    UPDATE HoldingManpower
    SET LevyRaisedAt = NULL, FreeLevyDaysRemaining = 45
    WHERE HoldingId = p_HoldingId AND SoldiersRaised = 0;
END //

-- Record transaction
CREATE PROCEDURE SP_RecordTransaction(
    IN p_HoldingId INT,
    IN p_TransactionTypeId INT,
    IN p_Amount INT,
    IN p_Description TEXT
)
BEGIN
    -- Record in ledger
    INSERT INTO HoldingLedger (HoldingId, TransactionTypeId, Amount, Description, TransactionDate)
    VALUES (p_HoldingId, p_TransactionTypeId, p_Amount, p_Description, CURDATE());
    
    -- Update treasury
    UPDATE Holding
    SET Treasury = Treasury + p_Amount
    WHERE Id = p_HoldingId;
END //

-- Process weekly production for a holding
CREATE PROCEDURE SP_ProcessWeeklyProduction(
    IN p_HoldingId INT
)
BEGIN
    DECLARE v_SeasonMod DECIMAL(3,2);
    DECLARE v_ClimateWinter DECIMAL(3,2);
    DECLARE v_ClimateSummer DECIMAL(3,2);
    DECLARE v_CurrentSeasonId INT;
    
    -- Get current season
    SELECT CurrentSeasonId INTO v_CurrentSeasonId FROM WorldState LIMIT 1;
    
    -- Get season modifier
    SELECT FoodProductionModifier INTO v_SeasonMod FROM Season WHERE Id = v_CurrentSeasonId;
    
    -- Get climate zone modifiers (would need zone link)
    SET v_ClimateWinter = 1.00;  -- Placeholder
    SET v_ClimateSummer = 1.00;
    
    -- Calculate production for each resource node
    INSERT INTO ProductionLog (HoldingId, ResourceNodeId, WeekStartDate, BaseOutput, SeasonModifier, WorkerModifier, FinalOutput)
    SELECT 
        p_HoldingId,
        hrn.Id,
        CURDATE(),
        hrn.BaseOutput,
        v_SeasonMod,
        CASE WHEN hrn.MaxWorkers > 0 THEN hrn.AssignedWorkers / hrn.MaxWorkers ELSE 1 END,
        FLOOR(hrn.BaseOutput * v_SeasonMod * 
              CASE WHEN hrn.MaxWorkers > 0 THEN hrn.AssignedWorkers / hrn.MaxWorkers ELSE 1 END)
    FROM HoldingResourceNode hrn
    WHERE hrn.HoldingId = p_HoldingId;
    
    -- Update storage with production
    UPDATE HoldingStorage hs
    JOIN HoldingResourceNode hrn ON hs.HoldingId = hrn.HoldingId
    JOIN ResourceNodeType rnt ON hrn.ResourceNodeTypeId = rnt.Id AND rnt.ResourceType = hs.ResourceType
    SET hs.Quantity = LEAST(hs.Quantity + FLOOR(hrn.CurrentOutput), hs.MaxCapacity)
    WHERE hs.HoldingId = p_HoldingId;
END //

-- Advance season (GM/system call)
CREATE PROCEDURE SP_AdvanceSeason(
    IN p_NewSeasonId INT
)
BEGIN
    UPDATE WorldState
    SET CurrentSeasonId = p_NewSeasonId,
        SeasonStartDate = CURDATE();
END //

DELIMITER ;
