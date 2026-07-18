-- AlterTable
ALTER TABLE `overtime_requests` ADD COLUMN `locationLabel` VARCHAR(191) NULL,
    ADD COLUMN `locationLat` DOUBLE NULL,
    ADD COLUMN `locationLng` DOUBLE NULL;

-- AlterTable
ALTER TABLE `work_locations` ADD COLUMN `geofenceRadius` DOUBLE NOT NULL DEFAULT 100;
