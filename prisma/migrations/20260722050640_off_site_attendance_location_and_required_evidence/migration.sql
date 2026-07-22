/*
  Warnings:

  - Made the column `evidenceUrl` on table `off_site_attendance_requests` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `off_site_attendance_requests` ADD COLUMN `locationLabel` VARCHAR(191) NULL,
    ADD COLUMN `locationLat` DOUBLE NULL,
    ADD COLUMN `locationLng` DOUBLE NULL,
    MODIFY `evidenceUrl` VARCHAR(191) NOT NULL;
