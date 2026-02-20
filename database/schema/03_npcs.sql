-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 03_npcs.sql
-- Purpose: NPCs with personality traits, interests, loyalty, grudges
-- ============================================================================

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

-- Personality traits (NPCs have 3-5 of these)
CREATE TABLE IF NOT EXISTS PersonalityTrait (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Category ENUM('Positive', 'Negative', 'Neutral') NOT NULL,
    Description TEXT,
    
    -- Mechanical effects (optional)
    AffectedAptitudeId INT,
    Modifier INT DEFAULT 0,         -- +/- to related checks
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Trait_Aptitude FOREIGN KEY (AffectedAptitudeId) REFERENCES Aptitude(Id)
);

-- Sample traits based on ASOIAF archetypes
INSERT INTO PersonalityTrait (Name, Category, Description) VALUES
    -- Positive
    ('Honorable', 'Positive', 'Values oaths and keeping their word'),
    ('Brave', 'Positive', 'Faces danger willingly'),
    ('Generous', 'Positive', 'Freely shares wealth and resources'),
    ('Loyal', 'Positive', 'Steadfast to their liege and allies'),
    ('Just', 'Positive', 'Fair in judgments and dealings'),
    ('Wise', 'Positive', 'Makes thoughtful, considered decisions'),
    ('Merciful', 'Positive', 'Shows compassion to the defeated'),
    ('Pious', 'Positive', 'Devoted to their faith'),
    ('Ambitious', 'Neutral', 'Strives for power and advancement'),
    
    -- Negative
    ('Cruel', 'Negative', 'Takes pleasure in suffering'),
    ('Greedy', 'Negative', 'Hoards wealth, always wants more'),
    ('Treacherous', 'Negative', 'Will betray for personal gain'),
    ('Cowardly', 'Negative', 'Flees from danger'),
    ('Wrathful', 'Negative', 'Quick to anger, seeks revenge'),
    ('Proud', 'Negative', 'Cannot tolerate insults or slights'),
    ('Jealous', 'Negative', 'Envious of others'' success'),
    ('Lustful', 'Negative', 'Driven by carnal desires'),
    ('Deceitful', 'Negative', 'Habitually lies and misleads'),
    
    -- Neutral
    ('Cautious', 'Neutral', 'Careful, avoids unnecessary risk'),
    ('Cunning', 'Neutral', 'Clever and scheming'),
    ('Stubborn', 'Neutral', 'Unyielding once decided'),
    ('Skeptical', 'Neutral', 'Distrustful, questions everything'),
    ('Pragmatic', 'Neutral', 'Does what works, not what''s right'),
    ('Melancholic', 'Neutral', 'Prone to sadness and brooding');

-- Interest categories (what NPCs care about)
CREATE TABLE IF NOT EXISTS InterestType (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO InterestType (Name, Description) VALUES
    ('Martial', 'Warfare, combat, tournaments'),
    ('Political', 'Power, intrigue, alliances'),
    ('Economic', 'Trade, wealth, prosperity'),
    ('Religious', 'Faith, piety, church matters'),
    ('Scholarly', 'Learning, history, maesters'),
    ('Romantic', 'Love, marriage, affairs'),
    ('Family', 'Bloodline, heirs, dynasty'),
    ('Justice', 'Laws, punishments, order'),
    ('Mercy', 'Compassion, pardons, charity'),
    ('Glory', 'Fame, reputation, legacy'),
    ('Revenge', 'Settling old scores'),
    ('Stability', 'Peace, avoiding conflict'),
    ('Independence', 'Freedom from overlords'),
    ('Tradition', 'Customs, the old ways'),
    ('Progress', 'Change, new ideas');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- NPC table (separate from player characters)
CREATE TABLE IF NOT EXISTS NPC (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Identity
    Name VARCHAR(100) NOT NULL,
    House VARCHAR(100),
    Title VARCHAR(100),
    Epithet VARCHAR(100),
    
    -- Demographics
    Age INT NOT NULL DEFAULT 30,
    GenderId INT NOT NULL,
    
    -- Religion
    ReligionId INT,
    ReligiousStanding INT DEFAULT 0,
    
    -- Status
    IsAlive BOOLEAN DEFAULT TRUE,
    DeathDate DATETIME,
    DeathCause TEXT,
    
    -- Ownership/Control
    OwnerCharacterId INT,           -- Player who controls this NPC (if any)
    OwnerHoldingId INT,             -- Or holding they belong to
    
    -- Role
    NPCType ENUM('Retainer', 'Advisor', 'Smallfolk', 'Noble', 'Merchant', 'Clergy', 'Other') NOT NULL,
    
    -- Location
    CurrentHoldingId INT,
    CurrentZoneId INT,
    
    -- Loyalty (to current lord/owner)
    Loyalty INT DEFAULT 50,         -- 0-100
    
    -- Timestamps
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Soft delete
    IsDeleted BOOLEAN DEFAULT FALSE,
    DeletedAt DATETIME,
    
    CONSTRAINT FK_NPC_Gender FOREIGN KEY (GenderId) REFERENCES Gender(Id),
    CONSTRAINT FK_NPC_Owner FOREIGN KEY (OwnerCharacterId) REFERENCES PlayerCharacter(Id)
    -- Religion, Holding FKs added later
);

-- NPC aptitude values (same structure as characters)
CREATE TABLE IF NOT EXISTS NPCAptitude (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    NPCId INT NOT NULL,
    AptitudeId INT NOT NULL,
    
    BaseValue INT NOT NULL DEFAULT 3,
    CurrentValue INT NOT NULL DEFAULT 3,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_NPCApt_NPC FOREIGN KEY (NPCId) REFERENCES NPC(Id),
    CONSTRAINT FK_NPCApt_Aptitude FOREIGN KEY (AptitudeId) REFERENCES Aptitude(Id),
    CONSTRAINT UQ_NPCApt_Unique UNIQUE (NPCId, AptitudeId),
    CONSTRAINT CK_NPCApt_BaseValue CHECK (BaseValue >= 1 AND BaseValue <= 10),
    CONSTRAINT CK_NPCApt_CurrentValue CHECK (CurrentValue >= 1 AND CurrentValue <= 10)
);

-- NPC personality traits (3-5 per NPC)
CREATE TABLE IF NOT EXISTS NPCTrait (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    NPCId INT NOT NULL,
    TraitId INT NOT NULL,
    
    Intensity INT DEFAULT 1,        -- How strong this trait is (1-3)
    IsHidden BOOLEAN DEFAULT FALSE, -- Unknown until discovered
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_NPCTrait_NPC FOREIGN KEY (NPCId) REFERENCES NPC(Id),
    CONSTRAINT FK_NPCTrait_Trait FOREIGN KEY (TraitId) REFERENCES PersonalityTrait(Id),
    CONSTRAINT UQ_NPCTrait_Unique UNIQUE (NPCId, TraitId)
);

-- NPC interests (what they care about)
CREATE TABLE IF NOT EXISTS NPCInterest (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    NPCId INT NOT NULL,
    InterestTypeId INT NOT NULL,
    
    Importance INT DEFAULT 5,       -- 1-10 how much they care
    Stance ENUM('Positive', 'Negative', 'Neutral') DEFAULT 'Positive',
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_NPCInterest_NPC FOREIGN KEY (NPCId) REFERENCES NPC(Id),
    CONSTRAINT FK_NPCInterest_Type FOREIGN KEY (InterestTypeId) REFERENCES InterestType(Id),
    CONSTRAINT UQ_NPCInterest_Unique UNIQUE (NPCId, InterestTypeId)
);

-- NPC grudges (permanent, pass to heirs)
CREATE TABLE IF NOT EXISTS NPCGrudge (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    NPCId INT NOT NULL,             -- NPC holding the grudge
    
    -- Target (one of these)
    TargetCharacterId INT,          -- Against a player PlayerCharacter
    TargetNPCId INT,                -- Against another NPC
    TargetHouse VARCHAR(100),       -- Against an entire house
    
    -- Details
    Reason TEXT NOT NULL,           -- Why the grudge exists
    Severity INT DEFAULT 5,         -- 1-10 how serious
    
    -- Origin
    OriginEventId INT,              -- What caused this (if tracked)
    InheritedFromNPCId INT,         -- If passed down from ancestor
    
    -- Timestamps
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ResolvedAt DATETIME,            -- If grudge was settled
    IsResolved BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT FK_NPCGrudge_NPC FOREIGN KEY (NPCId) REFERENCES NPC(Id),
    CONSTRAINT FK_NPCGrudge_TargetChar FOREIGN KEY (TargetCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_NPCGrudge_TargetNPC FOREIGN KEY (TargetNPCId) REFERENCES NPC(Id),
    CONSTRAINT FK_NPCGrudge_Inherited FOREIGN KEY (InheritedFromNPCId) REFERENCES NPC(Id)
);

-- PlayerCharacter grudges (player characters can also have grudges)
CREATE TABLE IF NOT EXISTS CharacterGrudge (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL,
    
    -- Target (one of these)
    TargetCharacterId INT,
    TargetNPCId INT,
    TargetHouse VARCHAR(100),
    
    -- Details
    Reason TEXT NOT NULL,
    Severity INT DEFAULT 5,
    
    -- Origin
    OriginEventId INT,
    InheritedFromCharacterId INT,
    
    -- Timestamps
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ResolvedAt DATETIME,
    IsResolved BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT FK_CharGrudge_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_CharGrudge_TargetChar FOREIGN KEY (TargetCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_CharGrudge_TargetNPC FOREIGN KEY (TargetNPCId) REFERENCES NPC(Id),
    CONSTRAINT FK_CharGrudge_Inherited FOREIGN KEY (InheritedFromCharacterId) REFERENCES PlayerCharacter(Id)
);

-- NPC relationship to player (beyond loyalty)
CREATE TABLE IF NOT EXISTS NPCRelationship (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    NPCId INT NOT NULL,
    CharacterId INT NOT NULL,
    
    -- Relationship values
    Opinion INT DEFAULT 0,          -- -100 to 100
    Trust INT DEFAULT 0,            -- -100 to 100
    Fear INT DEFAULT 0,             -- 0 to 100
    Respect INT DEFAULT 0,          -- 0 to 100
    
    -- Last interaction
    LastInteractionAt DATETIME,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_NPCRel_NPC FOREIGN KEY (NPCId) REFERENCES NPC(Id),
    CONSTRAINT FK_NPCRel_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT UQ_NPCRel_Unique UNIQUE (NPCId, CharacterId)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_NPC_Name ON NPC(Name);
CREATE INDEX IX_NPC_House ON NPC(House);
CREATE INDEX IX_NPC_IsAlive ON NPC(IsAlive);
CREATE INDEX IX_NPC_IsDeleted ON NPC(IsDeleted);
CREATE INDEX IX_NPC_NPCType ON NPC(NPCType);
CREATE INDEX IX_NPC_Owner ON NPC(OwnerCharacterId);
CREATE INDEX IX_NPC_CurrentHolding ON NPC(CurrentHoldingId);

CREATE INDEX IX_NPCAptitude_NPCId ON NPCAptitude(NPCId);
CREATE INDEX IX_NPCTrait_NPCId ON NPCTrait(NPCId);
CREATE INDEX IX_NPCInterest_NPCId ON NPCInterest(NPCId);
CREATE INDEX IX_NPCGrudge_NPCId ON NPCGrudge(NPCId);
CREATE INDEX IX_NPCGrudge_TargetChar ON NPCGrudge(TargetCharacterId);
CREATE INDEX IX_NPCGrudge_TargetHouse ON NPCGrudge(TargetHouse);
CREATE INDEX IX_NPCGrudge_IsResolved ON NPCGrudge(IsResolved);

CREATE INDEX IX_CharGrudge_CharacterId ON CharacterGrudge(CharacterId);
CREATE INDEX IX_CharGrudge_TargetChar ON CharacterGrudge(TargetCharacterId);

CREATE INDEX IX_NPCRelationship_NPCId ON NPCRelationship(NPCId);
CREATE INDEX IX_NPCRelationship_CharId ON NPCRelationship(CharacterId);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- NPC overview with traits
CREATE OR REPLACE VIEW V_NPCOverview AS
SELECT 
    n.Id,
    n.Name,
    n.House,
    n.Title,
    n.NPCType,
    n.Loyalty,
    n.IsAlive,
    c.Name AS OwnerName,
    GROUP_CONCAT(pt.Name ORDER BY pt.Name SEPARATOR ', ') AS Traits
FROM NPC n
LEFT JOIN PlayerCharacter c ON n.OwnerCharacterId = c.Id
LEFT JOIN NPCTrait nt ON n.Id = nt.NPCId AND nt.IsHidden = FALSE
LEFT JOIN PersonalityTrait pt ON nt.TraitId = pt.Id
WHERE n.IsDeleted = FALSE
GROUP BY n.Id, n.Name, n.House, n.Title, n.NPCType, n.Loyalty, n.IsAlive, c.Name;

-- Active grudges view
CREATE OR REPLACE VIEW V_ActiveGrudges AS
SELECT 
    'NPC' AS GrudgeHolderType,
    n.Id AS HolderId,
    n.Name AS HolderName,
    n.House AS HolderHouse,
    COALESCE(tc.Name, tn.Name, g.TargetHouse) AS TargetName,
    g.Reason,
    g.Severity,
    g.CreatedAt
FROM NPCGrudge g
JOIN NPC n ON g.NPCId = n.Id
LEFT JOIN PlayerCharacter tc ON g.TargetCharacterId = tc.Id
LEFT JOIN NPC tn ON g.TargetNPCId = tn.Id
WHERE g.IsResolved = FALSE AND n.IsAlive = TRUE

UNION ALL

SELECT 
    'PlayerCharacter' AS GrudgeHolderType,
    c.Id AS HolderId,
    c.Name AS HolderName,
    c.House AS HolderHouse,
    COALESCE(tc.Name, tn.Name, g.TargetHouse) AS TargetName,
    g.Reason,
    g.Severity,
    g.CreatedAt
FROM CharacterGrudge g
JOIN PlayerCharacter c ON g.CharacterId = c.Id
LEFT JOIN PlayerCharacter tc ON g.TargetCharacterId = tc.Id
LEFT JOIN NPC tn ON g.TargetNPCId = tn.Id
WHERE g.IsResolved = FALSE AND c.IsAlive = TRUE;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Create NPC with traits
CREATE PROCEDURE SP_CreateNPC(
    IN p_Name VARCHAR(100),
    IN p_House VARCHAR(100),
    IN p_GenderId INT,
    IN p_Age INT,
    IN p_NPCType ENUM('Retainer', 'Advisor', 'Smallfolk', 'Noble', 'Merchant', 'Clergy', 'Other'),
    IN p_OwnerCharacterId INT
)
BEGIN
    DECLARE v_NPCId INT;
    
    INSERT INTO NPC (Name, House, GenderId, Age, NPCType, OwnerCharacterId)
    VALUES (p_Name, p_House, p_GenderId, p_Age, p_NPCType, p_OwnerCharacterId);
    
    SET v_NPCId = LAST_INSERT_ID();
    
    -- Initialize default aptitudes (all 3)
    INSERT INTO NPCAptitude (NPCId, AptitudeId, BaseValue, CurrentValue)
    SELECT v_NPCId, Id, 3, 3 FROM Aptitude;
    
    SELECT v_NPCId AS NPCId;
END //

-- Add trait to NPC
CREATE PROCEDURE SP_AddNPCTrait(
    IN p_NPCId INT,
    IN p_TraitId INT,
    IN p_Intensity INT,
    IN p_IsHidden BOOLEAN
)
BEGIN
    DECLARE v_TraitCount INT;
    
    -- Check current trait count
    SELECT COUNT(*) INTO v_TraitCount FROM NPCTrait WHERE NPCId = p_NPCId;
    
    IF v_TraitCount >= 5 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NPC cannot have more than 5 traits';
    ELSE
        INSERT INTO NPCTrait (NPCId, TraitId, Intensity, IsHidden)
        VALUES (p_NPCId, p_TraitId, p_Intensity, p_IsHidden)
        ON DUPLICATE KEY UPDATE Intensity = p_Intensity, IsHidden = p_IsHidden;
    END IF;
END //

-- Create grudge and pass to heirs on death
CREATE PROCEDURE SP_PassGrudgesToHeir(
    IN p_DeceasedNPCId INT,
    IN p_HeirNPCId INT
)
BEGIN
    -- Copy all unresolved grudges to heir
    INSERT INTO NPCGrudge (NPCId, TargetCharacterId, TargetNPCId, TargetHouse, Reason, Severity, InheritedFromNPCId)
    SELECT 
        p_HeirNPCId,
        TargetCharacterId,
        TargetNPCId,
        TargetHouse,
        CONCAT('[Inherited] ', Reason),
        GREATEST(Severity - 1, 1),  -- Slightly diminished but never below 1
        p_DeceasedNPCId
    FROM NPCGrudge
    WHERE NPCId = p_DeceasedNPCId AND IsResolved = FALSE;
END //

-- Modify NPC relationship
CREATE PROCEDURE SP_ModifyNPCRelationship(
    IN p_NPCId INT,
    IN p_CharacterId INT,
    IN p_OpinionDelta INT,
    IN p_TrustDelta INT,
    IN p_FearDelta INT,
    IN p_RespectDelta INT
)
BEGIN
    INSERT INTO NPCRelationship (NPCId, CharacterId, Opinion, Trust, Fear, Respect, LastInteractionAt)
    VALUES (p_NPCId, p_CharacterId, p_OpinionDelta, p_TrustDelta, p_FearDelta, p_RespectDelta, NOW())
    ON DUPLICATE KEY UPDATE
        Opinion = GREATEST(-100, LEAST(100, Opinion + p_OpinionDelta)),
        Trust = GREATEST(-100, LEAST(100, Trust + p_TrustDelta)),
        Fear = GREATEST(0, LEAST(100, Fear + p_FearDelta)),
        Respect = GREATEST(0, LEAST(100, Respect + p_RespectDelta)),
        LastInteractionAt = NOW();
END //

DELIMITER ;
