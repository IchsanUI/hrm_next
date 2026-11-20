-- Lanjutan 20261120120000_password_policy: pencabutan sesi saat reset admin &
-- jumlah riwayat password yang dicek.
ALTER TABLE `users` ADD COLUMN `sessionsRevokedAt` DATETIME(3) NULL;

ALTER TABLE `password_policy` ADD COLUMN `historyCount` INTEGER NOT NULL DEFAULT 5;
