-- ============================================================================
-- Dragon's Dominion Database Schema
-- File: 01_accounts.sql
-- Purpose: User authentication, Discord OAuth, Second Life account linking
-- ============================================================================

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS UserRole (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO UserRole (Name, Description) VALUES
    ('Player', 'Standard player account'),
    ('Moderator', 'Can moderate chat and minor disputes'),
    ('GameMaster', 'Can manage events, NPCs, and game state'),
    ('Admin', 'Full system access');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Discord-authenticated user account
CREATE TABLE IF NOT EXISTS User (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Discord OAuth fields
    DiscordId VARCHAR(32) NOT NULL UNIQUE,
    DiscordUsername VARCHAR(100) NOT NULL,
    DiscordDiscriminator VARCHAR(10),
    DiscordEmail VARCHAR(255),
    DiscordAvatarHash VARCHAR(100),
    DiscordAccessToken TEXT,
    DiscordRefreshToken TEXT,
    DiscordTokenExpiresAt DATETIME,
    
    -- Account status
    RoleId INT NOT NULL DEFAULT 1,
    IsBanned BOOLEAN DEFAULT FALSE,
    BanReason TEXT,
    BannedAt DATETIME,
    BannedById INT,
    
    -- Timestamps
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    LastLoginAt DATETIME,
    
    -- Soft delete
    IsDeleted BOOLEAN DEFAULT FALSE,
    DeletedAt DATETIME,
    
    CONSTRAINT FK_User_Role FOREIGN KEY (RoleId) REFERENCES UserRole(Id),
    CONSTRAINT FK_User_BannedBy FOREIGN KEY (BannedById) REFERENCES User(Id)
);

-- Second Life account linking
CREATE TABLE IF NOT EXISTS SLAccount (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    UserId INT NOT NULL,
    
    -- Second Life identifiers
    SLUUID VARCHAR(36) NOT NULL UNIQUE,  -- SL avatar UUID
    SLUsername VARCHAR(100) NOT NULL,     -- Display name
    SLLegacyName VARCHAR(100),            -- firstname.lastname format
    
    -- Verification
    VerificationCode VARCHAR(64),
    VerificationExpiresAt DATETIME,
    IsVerified BOOLEAN DEFAULT FALSE,
    VerifiedAt DATETIME,
    
    -- Status
    IsPrimary BOOLEAN DEFAULT TRUE,       -- Primary SL account for this user
    
    -- Timestamps
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    LastSeenAt DATETIME,
    
    -- Soft delete
    IsDeleted BOOLEAN DEFAULT FALSE,
    DeletedAt DATETIME,
    
    CONSTRAINT FK_SLAccount_User FOREIGN KEY (UserId) REFERENCES User(Id)
);

-- Session tracking for security
CREATE TABLE IF NOT EXISTS UserSession (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    UserId INT NOT NULL,
    
    SessionToken VARCHAR(255) NOT NULL UNIQUE,
    IPAddress VARCHAR(45),          -- Supports IPv6
    UserAgent TEXT,
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt DATETIME NOT NULL,
    LastActivityAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    IsRevoked BOOLEAN DEFAULT FALSE,
    RevokedAt DATETIME,
    
    CONSTRAINT FK_UserSession_User FOREIGN KEY (UserId) REFERENCES User(Id)
);

-- Login history for audit
CREATE TABLE IF NOT EXISTS LoginHistory (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    UserId INT NOT NULL,
    
    LoginMethod ENUM('Discord', 'Session', 'API') NOT NULL,
    IPAddress VARCHAR(45),
    UserAgent TEXT,
    Success BOOLEAN NOT NULL,
    FailureReason VARCHAR(255),
    
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_LoginHistory_User FOREIGN KEY (UserId) REFERENCES User(Id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_User_DiscordId ON User(DiscordId);
CREATE INDEX IX_User_IsDeleted ON User(IsDeleted);
CREATE INDEX IX_User_IsBanned ON User(IsBanned);

CREATE INDEX IX_SLAccount_UserId ON SLAccount(UserId);
CREATE INDEX IX_SLAccount_SLUUID ON SLAccount(SLUUID);
CREATE INDEX IX_SLAccount_IsVerified ON SLAccount(IsVerified);

CREATE INDEX IX_UserSession_UserId ON UserSession(UserId);
CREATE INDEX IX_UserSession_SessionToken ON UserSession(SessionToken);
CREATE INDEX IX_UserSession_ExpiresAt ON UserSession(ExpiresAt);

CREATE INDEX IX_LoginHistory_UserId ON LoginHistory(UserId);
CREATE INDEX IX_LoginHistory_CreatedAt ON LoginHistory(CreatedAt);

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW V_ActiveUsers AS
SELECT 
    u.Id,
    u.DiscordUsername,
    u.DiscordEmail,
    ur.Name AS Role,
    sl.SLUsername,
    sl.IsVerified AS SLVerified,
    u.LastLoginAt,
    u.CreatedAt
FROM User u
JOIN UserRole ur ON u.RoleId = ur.Id
LEFT JOIN SLAccount sl ON u.Id = sl.UserId AND sl.IsPrimary = TRUE AND sl.IsDeleted = FALSE
WHERE u.IsDeleted = FALSE AND u.IsBanned = FALSE;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Create or update user from Discord OAuth
CREATE PROCEDURE SP_UpsertDiscordUser(
    IN p_DiscordId VARCHAR(32),
    IN p_DiscordUsername VARCHAR(100),
    IN p_DiscordDiscriminator VARCHAR(10),
    IN p_DiscordEmail VARCHAR(255),
    IN p_DiscordAvatarHash VARCHAR(100),
    IN p_AccessToken TEXT,
    IN p_RefreshToken TEXT,
    IN p_TokenExpiresAt DATETIME
)
BEGIN
    INSERT INTO User (
        DiscordId, DiscordUsername, DiscordDiscriminator, DiscordEmail,
        DiscordAvatarHash, DiscordAccessToken, DiscordRefreshToken,
        DiscordTokenExpiresAt, LastLoginAt
    )
    VALUES (
        p_DiscordId, p_DiscordUsername, p_DiscordDiscriminator, p_DiscordEmail,
        p_DiscordAvatarHash, p_AccessToken, p_RefreshToken,
        p_TokenExpiresAt, NOW()
    )
    ON DUPLICATE KEY UPDATE
        DiscordUsername = p_DiscordUsername,
        DiscordDiscriminator = p_DiscordDiscriminator,
        DiscordEmail = p_DiscordEmail,
        DiscordAvatarHash = p_DiscordAvatarHash,
        DiscordAccessToken = p_AccessToken,
        DiscordRefreshToken = p_RefreshToken,
        DiscordTokenExpiresAt = p_TokenExpiresAt,
        LastLoginAt = NOW();
    
    SELECT Id FROM User WHERE DiscordId = p_DiscordId;
END //

-- Link SL account to user
CREATE PROCEDURE SP_LinkSLAccount(
    IN p_UserId INT,
    IN p_SLUUID VARCHAR(36),
    IN p_SLUsername VARCHAR(100),
    IN p_SLLegacyName VARCHAR(100)
)
BEGIN
    DECLARE v_ExistingId INT;
    
    -- Check if this SL account is already linked to another user
    SELECT Id INTO v_ExistingId 
    FROM SLAccount 
    WHERE SLUUID = p_SLUUID AND UserId != p_UserId AND IsDeleted = FALSE;
    
    IF v_ExistingId IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SL account already linked to another user';
    END IF;
    
    -- Generate verification code
    INSERT INTO SLAccount (
        UserId, SLUUID, SLUsername, SLLegacyName,
        VerificationCode, VerificationExpiresAt
    )
    VALUES (
        p_UserId, p_SLUUID, p_SLUsername, p_SLLegacyName,
        SUBSTRING(MD5(RAND()), 1, 8),  -- 8-character code
        DATE_ADD(NOW(), INTERVAL 15 MINUTE)
    )
    ON DUPLICATE KEY UPDATE
        SLUsername = p_SLUsername,
        SLLegacyName = p_SLLegacyName,
        VerificationCode = SUBSTRING(MD5(RAND()), 1, 8),
        VerificationExpiresAt = DATE_ADD(NOW(), INTERVAL 15 MINUTE);
    
    SELECT VerificationCode FROM SLAccount WHERE SLUUID = p_SLUUID;
END //

-- Verify SL account
CREATE PROCEDURE SP_VerifySLAccount(
    IN p_SLUUID VARCHAR(36),
    IN p_VerificationCode VARCHAR(64)
)
BEGIN
    UPDATE SLAccount
    SET IsVerified = TRUE, VerifiedAt = NOW(), VerificationCode = NULL
    WHERE SLUUID = p_SLUUID 
      AND VerificationCode = p_VerificationCode
      AND VerificationExpiresAt > NOW()
      AND IsDeleted = FALSE;
    
    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid or expired verification code';
    END IF;
    
    SELECT Id, UserId FROM SLAccount WHERE SLUUID = p_SLUUID;
END //

DELIMITER ;
