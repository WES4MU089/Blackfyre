-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 11_audit.sql
-- Purpose: Audit logging, change tracking, game events
-- ============================================================================

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- General audit log for all table changes
CREATE TABLE IF NOT EXISTS AuditLog (
    Id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- What changed
    TableName VARCHAR(100) NOT NULL,
    RecordId INT NOT NULL,
    Action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    
    -- Who changed it
    UserId INT,                     -- System user
    CharacterId INT,                -- If done in-PlayerCharacter
    
    -- What changed
    OldValues JSON,
    NewValues JSON,
    ChangedFields TEXT,             -- Comma-separated field names
    
    -- Context
    Reason TEXT,
    IPAddress VARCHAR(45),
    SessionId VARCHAR(100),
    
    -- Timestamp
    OccurredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Audit_User FOREIGN KEY (UserId) REFERENCES User(Id),
    CONSTRAINT FK_Audit_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id)
);

-- Game event log (in-world events)
CREATE TABLE IF NOT EXISTS GameEvent (
    Id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Event type
    EventType VARCHAR(50) NOT NULL,
    EventCategory ENUM('Combat', 'Diplomacy', 'Economy', 'Political', 'Religious', 'Military', 'Personal', 'System') NOT NULL,
    
    -- Participants
    PrimaryCharacterId INT,
    SecondaryCharacterId INT,
    HoldingId INT,
    ArmyId INT,
    ZoneId INT,
    
    -- Details
    Title VARCHAR(200) NOT NULL,
    Description TEXT NOT NULL,
    Outcome TEXT,
    
    -- Visibility
    IsPublic BOOLEAN DEFAULT TRUE,  -- Visible to all
    VisibleToHouses JSON,           -- ["Stark", "Lannister"]
    
    -- IC Date
    ICDate DATE NOT NULL,
    
    -- Timestamp
    OccurredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Event_Primary FOREIGN KEY (PrimaryCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Event_Secondary FOREIGN KEY (SecondaryCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Event_Holding FOREIGN KEY (HoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_Event_Army FOREIGN KEY (ArmyId) REFERENCES Army(Id),
    CONSTRAINT FK_Event_Zone FOREIGN KEY (ZoneId) REFERENCES Zone(Id)
);

-- Staff action log (moderation)
CREATE TABLE IF NOT EXISTS StaffActionLog (
    Id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Staff member
    StaffUserId INT NOT NULL,
    
    -- Action
    ActionType VARCHAR(50) NOT NULL,
    TargetType VARCHAR(50),         -- PlayerCharacter, User, Holding, etc.
    TargetId INT,
    
    -- Details
    Description TEXT NOT NULL,
    OldState JSON,
    NewState JSON,
    
    -- Reason
    Reason TEXT NOT NULL,
    
    -- Timestamp
    OccurredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_StaffLog_User FOREIGN KEY (StaffUserId) REFERENCES User(Id)
);

-- Chat/message log
CREATE TABLE IF NOT EXISTS ChatMessage (
    Id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Sender
    SenderCharacterId INT NOT NULL,
    
    -- Channel
    ChannelType ENUM('Local', 'Holding', 'House', 'Army', 'Private', 'Global', 'OOC') NOT NULL,
    ChannelId INT,                  -- HoldingId, HouseId, etc.
    
    -- Recipient (for private)
    RecipientCharacterId INT,
    
    -- Message
    Message TEXT NOT NULL,
    
    -- IC Date
    ICDate DATE,
    
    -- Moderation
    IsHidden BOOLEAN DEFAULT FALSE,
    HiddenBy INT,
    HiddenReason TEXT,
    
    -- Timestamp
    SentAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Chat_Sender FOREIGN KEY (SenderCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Chat_Recipient FOREIGN KEY (RecipientCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Chat_HiddenBy FOREIGN KEY (HiddenBy) REFERENCES User(Id)
);

-- Dice roll log
CREATE TABLE IF NOT EXISTS DiceRollLog (
    Id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Roller
    CharacterId INT NOT NULL,
    
    -- Roll details
    RollType VARCHAR(50) NOT NULL,  -- Combat, Skill, etc.
    DiceFormula VARCHAR(50) NOT NULL, -- "2d6+3"
    
    -- Result
    RawRolls JSON NOT NULL,         -- [4, 2]
    Modifiers JSON,                 -- [{"source": "Prowess", "value": 3}]
    TotalResult INT NOT NULL,
    
    -- Context
    Purpose TEXT,
    OpponentCharacterId INT,
    RelatedBattleId INT,
    
    -- Timestamp
    RolledAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Dice_Character FOREIGN KEY (CharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Dice_Opponent FOREIGN KEY (OpponentCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_Dice_Battle FOREIGN KEY (RelatedBattleId) REFERENCES Battle(Id)
);

-- Economic transaction history (detailed)
CREATE TABLE IF NOT EXISTS TransactionHistory (
    Id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Parties
    FromHoldingId INT,
    FromCharacterId INT,
    ToHoldingId INT,
    ToCharacterId INT,
    
    -- Transaction
    TransactionTypeId INT NOT NULL,
    Amount INT NOT NULL,            -- In copper
    
    -- Resources (non-gold)
    ResourceType ENUM('Food', 'Wood', 'Stone', 'Iron', 'Gold', 'Luxury', 'Special'),
    ResourceAmount INT,
    
    -- Context
    Description TEXT,
    RelatedTradeId INT,
    
    -- IC Date
    ICDate DATE NOT NULL,
    
    -- Timestamp
    OccurredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_TxnHist_FromHold FOREIGN KEY (FromHoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_TxnHist_FromChar FOREIGN KEY (FromCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_TxnHist_ToHold FOREIGN KEY (ToHoldingId) REFERENCES Holding(Id),
    CONSTRAINT FK_TxnHist_ToChar FOREIGN KEY (ToCharacterId) REFERENCES PlayerCharacter(Id),
    CONSTRAINT FK_TxnHist_Type FOREIGN KEY (TransactionTypeId) REFERENCES TransactionType(Id)
);

-- Chronicle/history entries (major events for lore)
CREATE TABLE IF NOT EXISTS Chronicle (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Entry details
    Title VARCHAR(200) NOT NULL,
    Content TEXT NOT NULL,
    
    -- Categorization
    ChronicleType ENUM('War', 'Politics', 'Birth', 'Death', 'Marriage', 'Coronation', 'Religious', 'Discovery', 'Disaster') NOT NULL,
    
    -- Related entities
    HouseNames JSON,                -- Houses involved
    CharacterNames JSON,            -- Characters mentioned
    HoldingIds JSON,                -- Holdings involved
    
    -- IC Date range
    ICDateStart DATE NOT NULL,
    ICDateEnd DATE,
    
    -- Written by
    AuthorUserId INT,
    
    -- Timestamps
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_Chronicle_Author FOREIGN KEY (AuthorUserId) REFERENCES User(Id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_AuditLog_Table ON AuditLog(TableName);
CREATE INDEX IX_AuditLog_Record ON AuditLog(RecordId);
CREATE INDEX IX_AuditLog_User ON AuditLog(UserId);
CREATE INDEX IX_AuditLog_Occurred ON AuditLog(OccurredAt);

CREATE INDEX IX_GameEvent_Type ON GameEvent(EventType);
CREATE INDEX IX_GameEvent_Category ON GameEvent(EventCategory);
CREATE INDEX IX_GameEvent_Primary ON GameEvent(PrimaryCharacterId);
CREATE INDEX IX_GameEvent_Occurred ON GameEvent(OccurredAt);
CREATE INDEX IX_GameEvent_ICDate ON GameEvent(ICDate);

CREATE INDEX IX_StaffLog_Staff ON StaffActionLog(StaffUserId);
CREATE INDEX IX_StaffLog_Type ON StaffActionLog(ActionType);
CREATE INDEX IX_StaffLog_Occurred ON StaffActionLog(OccurredAt);

CREATE INDEX IX_Chat_Sender ON ChatMessage(SenderCharacterId);
CREATE INDEX IX_Chat_Channel ON ChatMessage(ChannelType, ChannelId);
CREATE INDEX IX_Chat_Sent ON ChatMessage(SentAt);

CREATE INDEX IX_DiceRoll_Character ON DiceRollLog(CharacterId);
CREATE INDEX IX_DiceRoll_Type ON DiceRollLog(RollType);
CREATE INDEX IX_DiceRoll_Rolled ON DiceRollLog(RolledAt);

CREATE INDEX IX_TxnHist_FromHold ON TransactionHistory(FromHoldingId);
CREATE INDEX IX_TxnHist_ToHold ON TransactionHistory(ToHoldingId);
CREATE INDEX IX_TxnHist_ICDate ON TransactionHistory(ICDate);

CREATE INDEX IX_Chronicle_Type ON Chronicle(ChronicleType);
CREATE INDEX IX_Chronicle_ICDate ON Chronicle(ICDateStart);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Recent game events
CREATE OR REPLACE VIEW V_RecentEvents AS
SELECT 
    e.Id,
    e.EventType,
    e.EventCategory,
    e.Title,
    e.Description,
    pc.Name AS PrimaryCharacter,
    pc.House AS PrimaryHouse,
    sc.Name AS SecondaryCharacter,
    h.Name AS HoldingName,
    z.Name AS ZoneName,
    e.ICDate,
    e.OccurredAt
FROM GameEvent e
LEFT JOIN PlayerCharacter pc ON e.PrimaryCharacterId = pc.Id
LEFT JOIN PlayerCharacter sc ON e.SecondaryCharacterId = sc.Id
LEFT JOIN Holding h ON e.HoldingId = h.Id
LEFT JOIN Zone z ON e.ZoneId = z.Id
WHERE e.IsPublic = TRUE
ORDER BY e.OccurredAt DESC
LIMIT 100;

-- Staff activity summary
CREATE OR REPLACE VIEW V_StaffActivity AS
SELECT 
    u.DiscordUsername AS StaffName,
    sal.ActionType,
    COUNT(*) AS ActionCount,
    MAX(sal.OccurredAt) AS LastAction
FROM StaffActionLog sal
JOIN User u ON sal.StaffUserId = u.Id
WHERE sal.OccurredAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY u.DiscordUsername, sal.ActionType;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Log a game event
CREATE PROCEDURE SP_LogGameEvent(
    IN p_EventType VARCHAR(50),
    IN p_EventCategory ENUM('Combat', 'Diplomacy', 'Economy', 'Political', 'Religious', 'Military', 'Personal', 'System'),
    IN p_PrimaryCharacterId INT,
    IN p_Title VARCHAR(200),
    IN p_Description TEXT,
    IN p_IsPublic BOOLEAN
)
BEGIN
    DECLARE v_ICDate DATE;
    
    -- Get current IC date
    SELECT CurrentDate INTO v_ICDate FROM WorldState LIMIT 1;
    
    INSERT INTO GameEvent (EventType, EventCategory, PrimaryCharacterId, Title, Description, IsPublic, ICDate)
    VALUES (p_EventType, p_EventCategory, p_PrimaryCharacterId, p_Title, p_Description, p_IsPublic, v_ICDate);
    
    SELECT LAST_INSERT_ID() AS EventId;
END //

-- Log a dice roll
CREATE PROCEDURE SP_LogDiceRoll(
    IN p_CharacterId INT,
    IN p_RollType VARCHAR(50),
    IN p_DiceFormula VARCHAR(50),
    IN p_RawRolls JSON,
    IN p_Modifiers JSON,
    IN p_TotalResult INT,
    IN p_Purpose TEXT
)
BEGIN
    INSERT INTO DiceRollLog (CharacterId, RollType, DiceFormula, RawRolls, Modifiers, TotalResult, Purpose)
    VALUES (p_CharacterId, p_RollType, p_DiceFormula, p_RawRolls, p_Modifiers, p_TotalResult, p_Purpose);
    
    SELECT LAST_INSERT_ID() AS RollId;
END //

-- Log staff action
CREATE PROCEDURE SP_LogStaffAction(
    IN p_StaffUserId INT,
    IN p_ActionType VARCHAR(50),
    IN p_TargetType VARCHAR(50),
    IN p_TargetId INT,
    IN p_Description TEXT,
    IN p_Reason TEXT
)
BEGIN
    INSERT INTO StaffActionLog (StaffUserId, ActionType, TargetType, TargetId, Description, Reason)
    VALUES (p_StaffUserId, p_ActionType, p_TargetType, p_TargetId, p_Description, p_Reason);
    
    SELECT LAST_INSERT_ID() AS LogId;
END //

-- Create chronicle entry
CREATE PROCEDURE SP_CreateChronicle(
    IN p_AuthorUserId INT,
    IN p_Title VARCHAR(200),
    IN p_Content TEXT,
    IN p_ChronicleType ENUM('War', 'Politics', 'Birth', 'Death', 'Marriage', 'Coronation', 'Religious', 'Discovery', 'Disaster'),
    IN p_ICDateStart DATE,
    IN p_ICDateEnd DATE
)
BEGIN
    INSERT INTO Chronicle (Title, Content, ChronicleType, ICDateStart, ICDateEnd, AuthorUserId)
    VALUES (p_Title, p_Content, p_ChronicleType, p_ICDateStart, p_ICDateEnd, p_AuthorUserId);
    
    SELECT LAST_INSERT_ID() AS ChronicleId;
END //

-- Cleanup old audit logs (keep 90 days)
CREATE PROCEDURE SP_CleanupAuditLogs()
BEGIN
    DELETE FROM AuditLog WHERE OccurredAt < DATE_SUB(NOW(), INTERVAL 90 DAY);
    DELETE FROM ChatMessage WHERE SentAt < DATE_SUB(NOW(), INTERVAL 30 DAY) AND ChannelType IN ('Local', 'OOC');
    DELETE FROM DiceRollLog WHERE RolledAt < DATE_SUB(NOW(), INTERVAL 60 DAY);
END //

DELIMITER ;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC AUDITING
-- ============================================================================

-- Note: In production, you'd create triggers for each important table
-- Example trigger for PlayerCharacter table:

DELIMITER //

CREATE TRIGGER TR_Character_Insert AFTER INSERT ON PlayerCharacter
FOR EACH ROW
BEGIN
    INSERT INTO AuditLog (TableName, RecordId, Action, NewValues, OccurredAt)
    VALUES ('PlayerCharacter', NEW.Id, 'INSERT', JSON_OBJECT(
        'Name', NEW.Name,
        'House', NEW.House,
        'UserId', NEW.UserId
    ), NOW());
END //

CREATE TRIGGER TR_Character_Update AFTER UPDATE ON PlayerCharacter
FOR EACH ROW
BEGIN
    INSERT INTO AuditLog (TableName, RecordId, Action, OldValues, NewValues, OccurredAt)
    VALUES ('PlayerCharacter', NEW.Id, 'UPDATE', 
        JSON_OBJECT('Name', OLD.Name, 'House', OLD.House, 'IsAlive', OLD.IsAlive),
        JSON_OBJECT('Name', NEW.Name, 'House', NEW.House, 'IsAlive', NEW.IsAlive),
        NOW());
END //

CREATE TRIGGER TR_Character_Delete AFTER DELETE ON PlayerCharacter
FOR EACH ROW
BEGIN
    INSERT INTO AuditLog (TableName, RecordId, Action, OldValues, OccurredAt)
    VALUES ('PlayerCharacter', OLD.Id, 'DELETE', JSON_OBJECT(
        'Name', OLD.Name,
        'House', OLD.House
    ), NOW());
END //

DELIMITER ;
