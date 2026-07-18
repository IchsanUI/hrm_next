/*
  Warnings:

  - You are about to drop the column `isActive` on the `work_shifts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `employees` ADD COLUMN `workShiftId` INTEGER NULL;

-- AlterTable
ALTER TABLE `work_locations` ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL;

-- AlterTable
ALTER TABLE `work_shifts` DROP COLUMN `isActive`,
    ADD COLUMN `type` ENUM('PEGAWAI', 'OUTSOURCING') NOT NULL DEFAULT 'PEGAWAI';

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_workShiftId_fkey` FOREIGN KEY (`workShiftId`) REFERENCES `work_shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
