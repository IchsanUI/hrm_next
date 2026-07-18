-- AlterTable
ALTER TABLE `work_locations` ADD COLUMN `address` TEXT NULL;

-- CreateTable
CREATE TABLE `work_shift_adjustments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workShiftId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `checkInTime` TIME(0) NOT NULL,
    `checkOutTime` TIME(0) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `work_shift_adjustments` ADD CONSTRAINT `work_shift_adjustments_workShiftId_fkey` FOREIGN KEY (`workShiftId`) REFERENCES `work_shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
