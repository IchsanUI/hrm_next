-- AlterTable
ALTER TABLE `late_arrival_requests` ADD COLUMN `arrivalLat` DOUBLE NULL,
    ADD COLUMN `arrivalLng` DOUBLE NULL,
    ADD COLUMN `arrivalLocationLabel` VARCHAR(191) NULL;
