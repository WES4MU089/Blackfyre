-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 02_characters.sql
-- Purpose: Player characters, aptitudes, skills, experience
-- ============================================================================

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

-- The 7 aptitudes
CREATE TABLE IF NOT EXISTS Aptitude (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    CouncilRole VARCHAR(50),        -- Corresponding advisor role
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO Aptitude (Name, Description, CouncilRole) VALUES
    ('Prowess', 'Physical combat ability, strength, martial skill', 'Master-at-Arms'),
    ('Fortitude', 'Endurance, health, resilience, constitution', 'Maester/Healer'),
    ('Command', 'Leadership, tactics, military strategy', 'Castellan/Marshal'),
    ('Cunning', 'Intelligence, deception, intrigue, perception', 'Spymaster'),
    ('Stewardship', 'Administration, economy, resource management', 'Steward'),
    ('Presence', 'Charisma, diplomacy, intimidation, social influence', 'Diplomat/Herald'),
    ('Faith', 'Piety, religious devotion, spiritual connection', 'Religious Advisor');

-- Skills linked to aptitudes
CREATE TABLE IF NOT EXISTS Skill (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    AptitudeId INT NOT NULL,        -- Governing aptitude
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Skill_Aptitude FOREIGN KEY (AptitudeId) REFERENCES Aptitude(Id)
);

-- Insert skills based on design docs
INSERT INTO Skill (Name, AptitudeId, Description) VALUES
    -- Prowess skills (Id: 1)
    ('Melee', 1, 'Sword, axe, mace, and other close combat weapons'),
    ('Archery', 1, 'Bow, crossbow, and ranged weapons'),
    ('Riding', 1, 'Mounted combat and horsemanship'),
    
    -- Fortitude skills (Id: 2)
    ('Athletics', 2, 'Running, climbing, swimming, physical feats'),
    ('Survival', 2, 'Wilderness survival, foraging, tracking'),
    
    -- Command skills (Id: 3)
    ('Tactics', 3, 'Battlefield strategy and small unit command'),
    ('Strategy', 3, 'Large scale warfare and campaign planning'),
    ('Logistics', 3, 'Supply lines, army movement, siegecraft'),
    
    -- Cunning skills (Id: 4)
    ('Intrigue', 4, 'Espionage, plotting, gathering secrets'),
    ('Investigation', 4, 'Finding clues, solving mysteries'),
    ('Stealth', 4, 'Moving unseen, hiding, ambush'),
    
    -- Stewardship skills (Id: 5)
    ('Trade', 5, 'Commerce, negotiation, market knowledge'),
    ('Construction', 5, 'Building, architecture, engineering'),
    ('Agriculture', 5, 'Farming, animal husbandry, land management'),
    
    -- Presence skills (Id: 6)
    ('Persuasion', 6, 'Convincing others, negotiation, charm'),
    ('Intimidation', 6, 'Inspiring fear, threats, domination'),
    ('Performance', 6, 'Public speaking, bardic arts, ceremony'),
    
    -- Faith skills (Id: 7)
    ('Theology', 7, 'Religious knowledge, scripture, rituals'),
    ('Devotion', 7, 'Prayer, meditation, maintaining piety');

-- Gender options
CREATE TABLE IF NOT EXISTS Gender (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(20) NOT NULL UNIQUE
);

INSERT INTO Gender (Name) VALUES ('Male'), ('Female'), ('Other');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Player PlayerCharacter
CREATE TABLE IF NOT EXISTS PlayerCharacter (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    UserId INT NOT NULL,            -- Owner of this PlayerCharacter
    SLAccountId INT,                -- Which SL avatar plays this PlayerCharacter
    
    -- Identity
    Name VARCHAR(100) NOT NULL,
    House VARCHAR(100),             -- Noble house, if any
    Title VARCHAR(100),             -- Current title (Lord, Ser, Lady, etc.)
    Epithet VARCHAR(100),           -- "The Young Wolf", "Kingslayer", etc.
    
    -- Demographics
    Age INT NOT NULL DEFAULT 20,
    GenderId INT NOT NULL,
    
    -- Religion (FK defined after Religion table exists)
    ReligionId INT,
    ReligiousStanding INT DEFAULT 0, -- -100 to 100+
    
    -- Status
    IsAlive BOOLEAN DEFAULT TRUE,
    DeathDate DATETIME,
    DeathCause TEXT,
    
    -- Location
    CurrentHoldingId INT,           -- Where they currently are
    CurrentZoneId INT,              -- Or which zone (traveling)
    
    -- Timestamps
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ApprovedAt DATETIME,            -- When PlayerCharacter was approved
    ApprovedById INT,               -- Staff who approved
    
    -- Soft delete
    IsDeleted BOOLEAN DEFAULT FALSE,
    DeletedAt DATETIME,
    
    CONSTRAINT FK_Character_User FOREIGN KEY (UserId) REFERENCES User(Id),
    CONSTRAINT FK_Character_SLAccount FOREIGN KEY (SLAccountId) REFERENCES SLAccount(Id),
    CONSTRAINT FK_Character_Gender FOREIGN KEY (GenderId) REFERENCES Gender(Id),
    CONSTRAINT FK_Character_ApprovedBy FOREIGN KEY (ApprovedById) REFERENCES User(Id)
    -- Religion FK added later after religion.sql runs
);

-- PlayerCharacter aptitude values
CREATE TABLE IF NOT EXISTS CharacterAptitude (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL,
    AptitudeId INT NOT NULL,
    
    BaseValue INT NOT NULL DEFAULT 3,     -- Initial value (1-10)
    CurrentValue INT NOT NULL DEFAULT 3,  -- May differ due to effects
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_CharApt_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_CharApt_Aptitude FOREIGN KEY (AptitudeId) REFERENCES Aptitude(Id),
    CONSTRAINT UQ_CharApt_Unique UNIQUE (CharacterId, AptitudeId),
    CONSTRAINT CK_CharApt_BaseValue CHECK (BaseValue >= 1 AND BaseValue <= 10),
    CONSTRAINT CK_CharApt_CurrentValue CHECK (CurrentValue >= 1 AND CurrentValue <= 10)
);

-- PlayerCharacter skill experience and levels
CREATE TABLE IF NOT EXISTS CharacterSkill (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL,
    SkillId INT NOT NULL,
    
    Experience INT NOT NULL DEFAULT 0,
    Level INT NOT NULL DEFAULT 0,         -- Derived from experience
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_CharSkill_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_CharSkill_Skill FOREIGN KEY (SkillId) REFERENCES Skill(Id),
    CONSTRAINT UQ_CharSkill_Unique UNIQUE (CharacterId, SkillId)
);

-- PlayerCharacter wounds/injuries (from combat)
CREATE TABLE IF NOT EXISTS CharacterWound (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL,
    
    WoundType ENUM('Light', 'Moderate', 'Severe', 'Critical', 'Mortal') NOT NULL,
    Location VARCHAR(50),           -- Head, Torso, Arm, Leg, etc.
    Description TEXT,
    
    ReceivedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    HealedAt DATETIME,
    IsHealed BOOLEAN DEFAULT FALSE,
    
    -- Effects while wounded
    AptitudeAffected INT,           -- Which aptitude is reduced
    Penalty INT DEFAULT 0,          -- How much reduction
    
    CONSTRAINT FK_CharWound_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_CharWound_Aptitude FOREIGN KEY (AptitudeAffected) REFERENCES Aptitude(Id)
);

-- PlayerCharacter biography/history
CREATE TABLE IF NOT EXISTS CharacterBiography (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL UNIQUE,
    
    Background TEXT,                -- Origin story
    Appearance TEXT,                -- Physical description
    Personality TEXT,               -- Behavioral traits
    Goals TEXT,                     -- What they want
    Secrets TEXT,                   -- Hidden information (staff only?)
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_CharBio_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id)
);

-- PlayerCharacter relationships (family)
CREATE TABLE IF NOT EXISTS CharacterRelationship (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    CharacterId INT NOT NULL,
    RelatedCharacterId INT NOT NULL,
    
    RelationshipType ENUM(
        'Parent', 'Child', 'Sibling', 'Spouse', 
        'Cousin', 'Uncle', 'Aunt', 'Nephew', 'Niece',
        'Grandparent', 'Grandchild', 'InLaw', 'Bastard'
    ) NOT NULL,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    IsDeleted BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT FK_CharRel_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_CharRel_Related FOREIGN KEY (RelatedCharacterId) REFERENCES PlayerCharacter(Id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_Character_UserId ON PlayerCharacter(UserId);
CREATE INDEX IX_Character_House ON PlayerCharacter(House);
CREATE INDEX IX_Character_IsAlive ON PlayerCharacter(IsAlive);
CREATE INDEX IX_Character_IsDeleted ON PlayerCharacter(IsDeleted);
CREATE INDEX IX_Character_CurrentHolding ON PlayerCharacter(CurrentHoldingId);
CREATE INDEX IX_Character_CurrentZone ON PlayerCharacter(CurrentZoneId);

CREATE INDEX IX_CharacterAptitude_CharacterId ON CharacterAptitude(CharacterId);
CREATE INDEX IX_CharacterSkill_CharacterId ON CharacterSkill(CharacterId);
CREATE INDEX IX_CharacterWound_CharacterId ON CharacterWound(CharacterId);
CREATE INDEX IX_CharacterWound_IsHealed ON CharacterWound(IsHealed);

CREATE INDEX IX_CharRelationship_CharacterId ON CharacterRelationship(CharacterId);
CREATE INDEX IX_CharRelationship_RelatedId ON CharacterRelationship(RelatedCharacterId);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Full PlayerCharacter view with aptitudes
CREATE OR REPLACE VIEW V_CharacterFull AS
SELECT 
    c.Id,
    c.UserId,
    c.Name,
    c.House,
    c.Title,
    c.Epithet,
    c.Age,
    g.Name AS Gender,
    c.IsAlive,
    c.CreatedAt,
    
    -- Aptitudes (pivoted)
    MAX(CASE WHEN a.Name = 'Prowess' THEN ca.CurrentValue END) AS Prowess,
    MAX(CASE WHEN a.Name = 'Fortitude' THEN ca.CurrentValue END) AS Fortitude,
    MAX(CASE WHEN a.Name = 'Command' THEN ca.CurrentValue END) AS Command,
    MAX(CASE WHEN a.Name = 'Cunning' THEN ca.CurrentValue END) AS Cunning,
    MAX(CASE WHEN a.Name = 'Stewardship' THEN ca.CurrentValue END) AS Stewardship,
    MAX(CASE WHEN a.Name = 'Presence' THEN ca.CurrentValue END) AS Presence,
    MAX(CASE WHEN a.Name = 'Faith' THEN ca.CurrentValue END) AS Faith

FROM PlayerCharacter c
JOIN Gender g ON c.GenderId = g.Id
LEFT JOIN CharacterAptitude ca ON c.Id = ca.CharacterId
LEFT JOIN Aptitude a ON ca.AptitudeId = a.Id
WHERE c.IsDeleted = FALSE
GROUP BY c.Id, c.UserId, c.Name, c.House, c.Title, c.Epithet, c.Age, g.Name, c.IsAlive, c.CreatedAt;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Create a new PlayerCharacter with default aptitudes
CREATE PROCEDURE SP_CreateCharacter(
    IN p_UserId INT,
    IN p_SLAccountId INT,
    IN p_Name VARCHAR(100),
    IN p_House VARCHAR(100),
    IN p_GenderId INT,
    IN p_Age INT,
    IN p_Prowess INT,
    IN p_Fortitude INT,
    IN p_Command INT,
    IN p_Cunning INT,
    IN p_Stewardship INT,
    IN p_Presence INT,
    IN p_Faith INT
)
BEGIN
    DECLARE v_CharacterId INT;
    
    -- Insert PlayerCharacter
    INSERT INTO PlayerCharacter (UserId, SLAccountId, Name, House, GenderId, Age)
    VALUES (p_UserId, p_SLAccountId, p_Name, p_House, p_GenderId, p_Age);
    
    SET v_CharacterId = LAST_INSERT_ID();
    
    -- Insert aptitudes
    INSERT INTO CharacterAptitude (CharacterId, AptitudeId, BaseValue, CurrentValue) VALUES
        (v_CharacterId, 1, p_Prowess, p_Prowess),
        (v_CharacterId, 2, p_Fortitude, p_Fortitude),
        (v_CharacterId, 3, p_Command, p_Command),
        (v_CharacterId, 4, p_Cunning, p_Cunning),
        (v_CharacterId, 5, p_Stewardship, p_Stewardship),
        (v_CharacterId, 6, p_Presence, p_Presence),
        (v_CharacterId, 7, p_Faith, p_Faith);
    
    -- Initialize all skills at 0
    INSERT INTO CharacterSkill (CharacterId, SkillId, Experience, Level)
    SELECT v_CharacterId, Id, 0, 0 FROM Skill;
    
    -- Create empty biography
    INSERT INTO CharacterBiography (CharacterId) VALUES (v_CharacterId);
    
    SELECT v_CharacterId AS CharacterId;
END //

-- Kill a PlayerCharacter
CREATE PROCEDURE SP_KillCharacter(
    IN p_CharacterId INT,
    IN p_DeathCause TEXT
)
BEGIN
    UPDATE PlayerCharacter
    SET IsAlive = FALSE,
        DeathDate = NOW(),
        DeathCause = p_DeathCause
    WHERE Id = p_CharacterId;
    
    -- Note: Grudges, oaths, etc. should be handled by application logic
    -- This just updates the PlayerCharacter state
END //

-- Add experience to a skill
CREATE PROCEDURE SP_AddSkillExperience(
    IN p_CharacterId INT,
    IN p_SkillId INT,
    IN p_Amount INT
)
BEGIN
    DECLARE v_NewExp INT;
    DECLARE v_NewLevel INT;
    
    UPDATE CharacterSkill
    SET Experience = Experience + p_Amount
    WHERE CharacterId = p_CharacterId AND SkillId = p_SkillId;
    
    -- Get new experience total
    SELECT Experience INTO v_NewExp
    FROM CharacterSkill
    WHERE CharacterId = p_CharacterId AND SkillId = p_SkillId;
    
    -- Calculate level (simple formula: level = floor(sqrt(exp/10)))
    SET v_NewLevel = FLOOR(SQRT(v_NewExp / 10));
    
    UPDATE CharacterSkill
    SET Level = v_NewLevel
    WHERE CharacterId = p_CharacterId AND SkillId = p_SkillId;
    
    SELECT v_NewExp AS NewExperience, v_NewLevel AS NewLevel;
END //

DELIMITER ;
