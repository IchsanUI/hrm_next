-- AlterTable
ALTER TABLE `late_arrival_requests` ADD COLUMN `locationLabel` VARCHAR(191) NULL,
    ADD COLUMN `locationLat` DOUBLE NULL,
    ADD COLUMN `locationLng` DOUBLE NULL;
