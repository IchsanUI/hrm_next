-- AlterTable
ALTER TABLE `activity_logs` ADD COLUMN `ipAddress` VARCHAR(191) NULL,
    ADD COLUMN `userAgent` TEXT NULL;
