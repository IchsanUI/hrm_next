-- Additive, no data loss.
ALTER TABLE `login_ip_blocks` ADD COLUMN `recentFailedUsernames` JSON NOT NULL DEFAULT (JSON_ARRAY());
