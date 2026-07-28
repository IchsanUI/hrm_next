-- AlterTable
ALTER TABLE `attendance_settings` ADD COLUMN `scheduledTimes` VARCHAR(191) NULL,
    ADD COLUMN `syncMode` ENUM('INTERVAL', 'SCHEDULED') NOT NULL DEFAULT 'INTERVAL';
