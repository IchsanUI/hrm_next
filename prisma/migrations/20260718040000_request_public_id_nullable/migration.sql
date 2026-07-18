-- AlterTable
ALTER TABLE `overtime_requests` ADD COLUMN `publicId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `office_exit_requests` ADD COLUMN `publicId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `early_leave_requests` ADD COLUMN `publicId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `late_arrival_requests` ADD COLUMN `publicId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `overtime_requests_publicId_key` ON `overtime_requests`(`publicId`);

-- CreateIndex
CREATE UNIQUE INDEX `office_exit_requests_publicId_key` ON `office_exit_requests`(`publicId`);

-- CreateIndex
CREATE UNIQUE INDEX `early_leave_requests_publicId_key` ON `early_leave_requests`(`publicId`);

-- CreateIndex
CREATE UNIQUE INDEX `late_arrival_requests_publicId_key` ON `late_arrival_requests`(`publicId`);
