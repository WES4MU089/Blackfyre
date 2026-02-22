-- Migration 037: TOS and Privacy Policy acceptance tracking
-- Tracks when players accept specific versions of the Terms of Service and Privacy Policy

CREATE TABLE IF NOT EXISTS tos_acceptances (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id INT UNSIGNED NOT NULL,
  tos_version VARCHAR(20) NOT NULL,
  privacy_version VARCHAR(20) NOT NULL,
  accepted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY uq_player_tos (player_id, tos_version, privacy_version)
);
