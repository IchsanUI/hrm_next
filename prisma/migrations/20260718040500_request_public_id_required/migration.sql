-- AlterTable
ALTER TABLE `overtime_requests` MODIFY COLUMN `publicId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `office_exit_requests` MODIFY COLUMN `publicId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `early_leave_requests` MODIFY COLUMN `publicId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `late_arrival_requests` MODIFY COLUMN `publicId` VARCHAR(191) NOT NULL;
