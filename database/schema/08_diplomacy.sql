-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 08_diplomacy.sql
-- Purpose: Oaths, sins, virtues, religion, diplomatic relations
-- ============================================================================

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

-- Religions
CREATE TABLE IF NOT EXISTS Religion (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    
    -- Major tenets (as JSON for flexibility)
    Tenets JSON,
    
    -- Compatibility with other faiths (-100 to 100)
    ToleranceDefault INT DEFAULT 0,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO Religion (Name, Description, Tenets, ToleranceDefault) VALUES
    ('Faith of the Seven', 'The dominant religion of southern Westeros, worshipping seven aspects of one god', 
     '["Honor oaths", "Protect the weak", "Condemn kinslaying", "Guest right sacred", "Support the smallfolk"]', 0),
    ('Old Gods', 'The ancient religion of the North, worshipping nameless gods of nature',
     '["Keep vows before the heart tree", "Respect the old ways", "Honor guests", "No temples, pray in godswoods"]', 20),
    ('Drowned God', 'The god of the Ironborn, emphasizing strength and raiding',
     '["What is dead may never die", "Pay the iron price", "Reaving is righteous", "Drowning is sacred"]', -30),
    ('R''hllor', 'The Lord of Light, a fire god from Essos',
     '["Fire cleanses", "Oppose the Great Other", "Sacrifice for visions", "Red priests guide the faithful"]', -20);

-- Sin types (permanent marks)
CREATE TABLE IF NOT EXISTS SinType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    Severity INT NOT NULL,          -- 1-10
    
    -- Effects
    ReputationPenalty INT DEFAULT 0,
    OpinionPenalty INT DEFAULT 0,
    ReligiousStandingPenalty INT DEFAULT 0,
    
    -- Is this removable?
    IsRemovable BOOLEAN DEFAULT FALSE,
    RemovalMethod TEXT,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO SinType (Name, Description, Severity, ReputationPenalty, OpinionPenalty, ReligiousStandingPenalty, IsRemovable) VALUES
    ('Kinslayer', 'Murdered a blood relative', 10, -50, -30, -50, FALSE),
    ('Oathbreaker', 'Broke a sacred vow', 9, -40, -25, -30, FALSE),
    ('Guest Right Violator', 'Harmed someone under guest right', 10, -50, -35, -40, FALSE),
    ('Kingslayer', 'Killed a king or queen', 8, -30, -20, -20, FALSE),
    ('Apostate', 'Abandoned their faith', 6, -10, -10, -100, TRUE),
    ('Murderer', 'Killed unlawfully (not in war)', 5, -15, -15, -15, TRUE),
    ('Traitor', 'Betrayed their liege lord', 8, -35, -30, -20, FALSE),
    ('Slaver', 'Engaged in slave trade', 7, -20, -15, -25, TRUE);

-- Virtue types
CREATE TABLE IF NOT EXISTS VirtueType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    
    -- Benefits
    ReputationBonus INT DEFAULT 0,
    OpinionBonus INT DEFAULT 0,
    ReligiousStandingBonus INT DEFAULT 0,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO VirtueType (Name, Description, ReputationBonus, OpinionBonus, ReligiousStandingBonus) VALUES
    ('Defender of the Faith', 'Protected their religion from threats', 20, 15, 30),
    ('Champion of the Realm', 'Won glory in defense of the kingdom', 25, 20, 10),
    ('Merciful', 'Known for showing mercy to the defeated', 10, 15, 15),
    ('Just', 'Renowned for fair judgments', 15, 20, 10),
    ('Charitable', 'Generous to the poor and needy', 10, 10, 20),
    ('Faithful', 'Devoted and pious', 5, 5, 25),
    ('Honorable', 'Always keeps their word', 20, 25, 15),
    ('Dragon Slayer', 'Killed a dragon in combat', 50, 30, 20),
    ('Realm Uniter', 'Brought warring factions together', 30, 35, 15);

-- Oath types
CREATE TABLE IF NOT EXISTS OathType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    
    -- Violation consequences
    ViolationSinId INT,             -- What sin you get if broken
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_OathType_Sin FOREIGN KEY (ViolationSinId) REFERENCES SinType(Id)
);

INSERT INTO OathType (Name, Description, ViolationSinId) VALUES
    ('Fealty', 'Sworn loyalty to a liege lord', 7),         -- Traitor
    ('Knighthood', 'Sacred vows of knighthood', 2),         -- Oathbreaker
    ('Marriage', 'Wedding vows', 2),                         -- Oathbreaker
    ('Guest Right', 'Accepting bread and salt', 3),         -- Guest Right Violator
    ('Night''s Watch', 'Taking the black (if applicable)', 2), -- Oathbreaker
    ('Alliance', 'Sworn military alliance', 7),             -- Traitor
    ('Protection', 'Vow to protect someone', 2),            -- Oathbreaker
    ('Debt', 'Promise to repay', 2);                        -- Oathbreaker

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- PlayerCharacter sins
CREATE TABLE IF NOT EXISTS CharacterSin (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL,
    SinTypeId INT NOT NULL,
    
    -- Context
    Description TEXT,               -- What happened
    VictimName VARCHAR(100),        -- Who was wronged
    
    -- Evidence
    IsPublicKnowledge BOOLEAN DEFAULT FALSE,
    WitnessCount INT DEFAULT 0,
    
    -- Timestamp
    CommittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Removal (if possible)
    IsRemoved BOOLEAN DEFAULT FALSE,
    RemovedAt DATETIME,
    RemovalReason TEXT,
    
    CONSTRAINT FK_CharSin_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_CharSin_Type FOREIGN KEY (SinTypeId) REFERENCES SinType(Id)
);

-- PlayerCharacter virtues
CREATE TABLE IF NOT EXISTS CharacterVirtue (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL,
    VirtueTypeId INT NOT NULL,
    
    -- Context
    Description TEXT,               -- What deed earned it
    
    -- Timestamp
    EarnedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_CharVirtue_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_CharVirtue_Type FOREIGN KEY (VirtueTypeId) REFERENCES VirtueType(Id),
    CONSTRAINT UQ_CharVirtue UNIQUE (CharacterId, VirtueTypeId)
);

-- Active oaths
CREATE TABLE IF NOT EXISTS Oath (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    OathTypeId INT NOT NULL,
    
    -- Parties
    SwornerCharacterId INT NOT NULL,    -- Who swore
    ReceiverCharacterId INT,            -- Who received (for fealty)
    ReceiverHoldingId INT,              -- Or to a holding/institution
    
    -- Terms
    Description TEXT,
    Terms TEXT,                     -- Specific obligations
    
    -- Status
    IsActive BOOLEAN DEFAULT TRUE,
    SwornAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    BrokenAt DATETIME,
    FulfilledAt DATETIME,
    
    -- Breaking
    IsBroken BOOLEAN DEFAULT FALSE,
    BrokenReason TEXT,
    
    CONSTRAINT FK_Oath_Type FOREIGN KEY (OathTypeId) REFERENCES OathType(Id),
    CONSTRAINT FK_Oath_Sworner FOREIGN KEY (SwornerCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Oath_Receiver FOREIGN KEY (ReceiverCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Oath_RecHolding FOREIGN KEY (ReceiverHoldingId) REFERENCES Holding(Id)
);

-- Add FK now that Religion table exists
ALTER TABLE PlayerCharacter ADD CONSTRAINT FK_Character_Religion FOREIGN KEY (ReligionId) REFERENCES Religion(Id);
ALTER TABLE NPC ADD CONSTRAINT FK_NPC_Religion FOREIGN KEY (ReligionId) REFERENCES Religion(Id);
ALTER TABLE Holding ADD CONSTRAINT FK_Holding_Religion FOREIGN KEY (DominantReligionId) REFERENCES Religion(Id);

-- Religious standing modifiers (events that affected standing)
CREATE TABLE IF NOT EXISTS ReligiousStandingEvent (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL,
    ReligionId INT NOT NULL,
    
    -- Change
    StandingChange INT NOT NULL,
    Reason TEXT NOT NULL,
    
    -- Timestamp
    OccurredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_RSE_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_RSE_Religion FOREIGN KEY (ReligionId) REFERENCES Religion(Id)
);

-- Inter-religion relations
CREATE TABLE IF NOT EXISTS ReligionRelation (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    ReligionAId INT NOT NULL,
    ReligionBId INT NOT NULL,
    
    -- Stance (-100 to 100)
    Tolerance INT DEFAULT 0,
    
    -- Special status
    IsHolyWar BOOLEAN DEFAULT FALSE,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_RelRel_A FOREIGN KEY (ReligionAId) REFERENCES Religion(Id),
    CONSTRAINT FK_RelRel_B FOREIGN KEY (ReligionBId) REFERENCES Religion(Id),
    CONSTRAINT UQ_RelRel UNIQUE (ReligionAId, ReligionBId)
);

-- Initialize religion relations
INSERT INTO ReligionRelation (ReligionAId, ReligionBId, Tolerance) VALUES
    (1, 2, 20),   -- Seven tolerate Old Gods (Guest right/North tradition)
    (1, 3, -40),  -- Seven dislike Drowned God
    (1, 4, -30),  -- Seven distrust R'hllor
    (2, 3, -20),  -- Old Gods vs Drowned God
    (2, 4, -10),  -- Old Gods neutral-ish to R'hllor
    (3, 4, -50);  -- Drowned God hates fire god

-- Diplomatic treaties
CREATE TABLE IF NOT EXISTS Treaty (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    TreatyType ENUM('Alliance', 'Non-Aggression', 'Trade', 'Marriage', 'Vassalage', 'Peace') NOT NULL,
    
    -- Parties (holdings or characters)
    PartyAHoldingId INT,
    PartyACharacterId INT,
    PartyBHoldingId INT,
    PartyBCharacterId INT,
    
    -- Terms
    Terms TEXT,
    Duration INT,                   -- In days, NULL = permanent
    
    -- Status
    IsActive BOOLEAN DEFAULT TRUE,
    SignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt DATETIME,
    BrokenAt DATETIME,
    BrokenById INT,                 -- Who broke it
    
    CONSTRAINT FK_Treaty_PartyAH FOREIGN KEY (PartyAHoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_Treaty_PartyAC FOREIGN KEY (PartyACharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Treaty_PartyBH FOREIGN KEY (PartyBHoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_Treaty_PartyBC FOREIGN KEY (PartyBCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Treaty_BrokenBy FOREIGN KEY (BrokenById) REFERENCES PlayerCharacter(Id)
);

-- Reputation tracking (per region or global)
CREATE TABLE IF NOT EXISTS CharacterReputation (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL,
    
    -- Scope
    Region VARCHAR(100),            -- NULL = global
    
    -- Values
    Honor INT DEFAULT 50,           -- 0-100
    Prestige INT DEFAULT 0,         -- Accumulated glory
    Infamy INT DEFAULT 0,           -- Notoriety for bad deeds
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_CharRep_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT UQ_CharRep UNIQUE (CharacterId, Region)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_CharSin_Character ON CharacterSin(CharacterId);
CREATE INDEX IX_CharSin_Type ON CharacterSin(SinTypeId);
CREATE INDEX IX_CharSin_Public ON CharacterSin(IsPublicKnowledge);

CREATE INDEX IX_CharVirtue_Character ON CharacterVirtue(CharacterId);
CREATE INDEX IX_CharVirtue_Type ON CharacterVirtue(VirtueTypeId);

CREATE INDEX IX_Oath_Sworner ON Oath(SwornerCharacterId);
CREATE INDEX IX_Oath_Receiver ON Oath(ReceiverCharacterId);
CREATE INDEX IX_Oath_Active ON Oath(IsActive);
CREATE INDEX IX_Oath_Type ON Oath(OathTypeId);

CREATE INDEX IX_RSE_Character ON ReligiousStandingEvent(CharacterId);
CREATE INDEX IX_RSE_Religion ON ReligiousStandingEvent(ReligionId);

CREATE INDEX IX_Treaty_Active ON Treaty(IsActive);
CREATE INDEX IX_Treaty_Type ON Treaty(TreatyType);

CREATE INDEX IX_CharRep_Character ON CharacterReputation(CharacterId);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- PlayerCharacter reputation summary
CREATE OR REPLACE VIEW V_CharacterReputation AS
SELECT 
    c.Id,
    c.Name,
    c.House,
    cr.Honor,
    cr.Prestige,
    cr.Infamy,
    (SELECT COUNT(*) FROM CharacterSin WHERE CharacterId = c.Id AND IsRemoved = FALSE) AS SinCount,
    (SELECT COUNT(*) FROM CharacterVirtue WHERE CharacterId = c.Id) AS VirtueCount,
    (SELECT COUNT(*) FROM Oath WHERE SwornerCharacterId = c.Id AND IsActive = TRUE) AS ActiveOaths
FROM PlayerCharacter c
LEFT JOIN CharacterReputation cr ON c.Id = cr.CharacterId AND cr.Region IS NULL
WHERE c.IsDeleted = FALSE AND c.IsAlive = TRUE;

-- Active oaths view
CREATE OR REPLACE VIEW V_ActiveOaths AS
SELECT 
    o.Id,
    ot.Name AS OathType,
    sworner.Name AS SwornerName,
    sworner.House AS SwornerHouse,
    COALESCE(receiver.Name, h.Name) AS ReceiverName,
    o.Description,
    o.SwornAt
FROM Oath o
JOIN OathType ot ON o.OathTypeId = ot.Id
JOIN PlayerCharacter sworner ON o.SwornerCharacterId = sworner.Id
LEFT JOIN PlayerCharacter receiver ON o.ReceiverCharacterId = receiver.Id
LEFT JOIN Holding h ON o.ReceiverHoldingId = h.Id
WHERE o.IsActive = TRUE AND o.IsBroken = FALSE;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Swear an oath
CREATE PROCEDURE SP_SwearOath(
    IN p_OathTypeId INT,
    IN p_SwornerCharacterId INT,
    IN p_ReceiverCharacterId INT,
    IN p_ReceiverHoldingId INT,
    IN p_Description TEXT,
    IN p_Terms TEXT
)
BEGIN
    INSERT INTO Oath (OathTypeId, SwornerCharacterId, ReceiverCharacterId, ReceiverHoldingId, Description, Terms)
    VALUES (p_OathTypeId, p_SwornerCharacterId, p_ReceiverCharacterId, p_ReceiverHoldingId, p_Description, p_Terms);
    
    SELECT LAST_INSERT_ID() AS OathId;
END //

-- Break an oath (applies sin)
CREATE PROCEDURE SP_BreakOath(
    IN p_OathId INT,
    IN p_Reason TEXT
)
BEGIN
    DECLARE v_SinTypeId INT;
    DECLARE v_SworderId INT;
    DECLARE v_ReceiverName VARCHAR(100);
    
    -- Get oath details
    SELECT ot.ViolationSinId, o.SwornerCharacterId, COALESCE(c.Name, h.Name)
    INTO v_SinTypeId, v_SworderId, v_ReceiverName
    FROM Oath o
    JOIN OathType ot ON o.OathTypeId = ot.Id
    LEFT JOIN PlayerCharacter c ON o.ReceiverCharacterId = c.Id
    LEFT JOIN Holding h ON o.ReceiverHoldingId = h.Id
    WHERE o.Id = p_OathId;
    
    -- Mark oath as broken
    UPDATE Oath
    SET IsActive = FALSE, IsBroken = TRUE, BrokenAt = NOW(), BrokenReason = p_Reason
    WHERE Id = p_OathId;
    
    -- Apply sin
    IF v_SinTypeId IS NOT NULL THEN
        INSERT INTO CharacterSin (CharacterId, SinTypeId, Description, VictimName, IsPublicKnowledge)
        VALUES (v_SworderId, v_SinTypeId, p_Reason, v_ReceiverName, TRUE);
    END IF;
END //

-- Mark sin on PlayerCharacter
CREATE PROCEDURE SP_MarkSin(
    IN p_CharacterId INT,
    IN p_SinTypeId INT,
    IN p_Description TEXT,
    IN p_VictimName VARCHAR(100),
    IN p_IsPublic BOOLEAN
)
BEGIN
    DECLARE v_RepPenalty INT;
    DECLARE v_ReligiousPenalty INT;
    
    -- Get penalties
    SELECT ReputationPenalty, ReligiousStandingPenalty
    INTO v_RepPenalty, v_ReligiousPenalty
    FROM SinType WHERE Id = p_SinTypeId;
    
    -- Record sin
    INSERT INTO CharacterSin (CharacterId, SinTypeId, Description, VictimName, IsPublicKnowledge)
    VALUES (p_CharacterId, p_SinTypeId, p_Description, p_VictimName, p_IsPublic);
    
    -- Apply reputation penalty
    UPDATE CharacterReputation
    SET Honor = GREATEST(0, Honor + v_RepPenalty),
        Infamy = Infamy + ABS(v_RepPenalty)
    WHERE CharacterId = p_CharacterId AND Region IS NULL;
    
    -- Apply religious standing penalty
    UPDATE PlayerCharacter
    SET ReligiousStanding = ReligiousStanding + v_ReligiousPenalty
    WHERE Id = p_CharacterId;
END //

-- Award virtue
CREATE PROCEDURE SP_AwardVirtue(
    IN p_CharacterId INT,
    IN p_VirtueTypeId INT,
    IN p_Description TEXT
)
BEGIN
    DECLARE v_RepBonus INT;
    DECLARE v_ReligiousBonus INT;
    
    -- Get bonuses
    SELECT ReputationBonus, ReligiousStandingBonus
    INTO v_RepBonus, v_ReligiousBonus
    FROM VirtueType WHERE Id = p_VirtueTypeId;
    
    -- Record virtue
    INSERT INTO CharacterVirtue (CharacterId, VirtueTypeId, Description)
    VALUES (p_CharacterId, p_VirtueTypeId, p_Description)
    ON DUPLICATE KEY UPDATE Description = CONCAT(Description, '; ', p_Description);
    
    -- Apply reputation bonus
    UPDATE CharacterReputation
    SET Honor = LEAST(100, Honor + v_RepBonus),
        Prestige = Prestige + v_RepBonus
    WHERE CharacterId = p_CharacterId AND Region IS NULL;
    
    -- Apply religious standing bonus
    UPDATE PlayerCharacter
    SET ReligiousStanding = ReligiousStanding + v_ReligiousBonus
    WHERE Id = p_CharacterId;
END //

-- Modify religious standing
CREATE PROCEDURE SP_ModifyReligiousStanding(
    IN p_CharacterId INT,
    IN p_ReligionId INT,
    IN p_Amount INT,
    IN p_Reason TEXT
)
BEGIN
    -- Record event
    INSERT INTO ReligiousStandingEvent (CharacterId, ReligionId, StandingChange, Reason)
    VALUES (p_CharacterId, p_ReligionId, p_Amount, p_Reason);
    
    -- Update PlayerCharacter standing (only if same religion)
    UPDATE PlayerCharacter
    SET ReligiousStanding = ReligiousStanding + p_Amount
    WHERE Id = p_CharacterId AND ReligionId = p_ReligionId;
END //

DELIMITER ;
